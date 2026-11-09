package app

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"errors"
	"io"
	"os"
	"unicode/utf8"

	"github.com/SophearithSaing/sheldon/internal/githubpr"
)

var errPRMetadataStore = errors.New("cannot read or save private PR metadata; existing data was preserved")

// ListPRs projects registered membership without fetching source or changing saved history.
func (i *instance) ListPRs(query githubpr.LibraryQuery) (githubpr.LibraryResult, error) {
	if err := query.Validate(); err != nil {
		return githubpr.LibraryResult{}, err
	}
	i.mu.Lock()
	defer i.mu.Unlock()
	index, err := i.readPRIndex()
	if err != nil {
		return githubpr.LibraryResult{}, err
	}
	rows := make([]githubpr.LibraryRow, 0, len(index.PRs))
	for _, pr := range index.PRs {
		rows = append(rows, i.prLibraryRow(pr))
	}
	return githubpr.SelectLibrary(rows, query)
}

// prLibraryRow projects checked membership with optional metadata under the instance mutex.
func (i *instance) prLibraryRow(pr githubpr.PullRequest) githubpr.LibraryRow {
	route, _ := githubpr.ReviewPath(pr.ID)
	row := githubpr.LibraryRow{PR: pr, Route: route, State: "unknown", MetadataStatus: "missing"}
	root, err := i.registeredReviewDirectory(pr.ID, false)
	if err != nil {
		row.MetadataStatus = "unavailable"
		return row
	}
	if root == nil {
		return row
	}
	defer root.Close()
	metadata, err := readPRMetadata(root, pr.ID)
	if errors.Is(err, os.ErrNotExist) {
		return row
	}
	if err != nil {
		row.MetadataStatus = "unavailable"
		return row
	}
	if metadata.Title != nil {
		row.PR.Title = metadata.Title
	}
	if metadata.Author != nil {
		row.PR.Author = metadata.Author
	}
	row.State, row.MetadataStatus = metadata.State, "cached"
	row.CreatedAt, row.UpdatedAt = &metadata.CreatedAt, &metadata.UpdatedAt
	row.MergedAt, row.FetchedAt = metadata.MergedAt, &metadata.FetchedAt
	return row
}

// readPRMetadata refuses unsafe leaves and bounds decoding without changing invalid bytes.
func readPRMetadata(root *os.Root, prID string) (githubpr.Metadata, error) {
	info, err := root.Lstat("pr-metadata.json")
	if errors.Is(err, os.ErrNotExist) {
		return githubpr.Metadata{}, os.ErrNotExist
	}
	if err != nil || !info.Mode().IsRegular() {
		return githubpr.Metadata{}, errPRMetadataStore
	}
	f, err := root.Open("pr-metadata.json")
	if err != nil {
		return githubpr.Metadata{}, errPRMetadataStore
	}
	defer f.Close()
	actual, statErr := f.Stat()
	if statErr != nil || !os.SameFile(info, actual) || checkPrivateFile(f) != nil {
		return githubpr.Metadata{}, errPRMetadataStore
	}
	data, err := io.ReadAll(io.LimitReader(f, githubpr.MaxMetadataBytes+1))
	if err != nil || len(data) > githubpr.MaxMetadataBytes || !utf8.Valid(data) {
		return githubpr.Metadata{}, errPRMetadataStore
	}
	var metadata githubpr.Metadata
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&metadata) != nil || decoder.Decode(new(any)) != io.EOF || metadata.Validate(prID) != nil {
		return githubpr.Metadata{}, errPRMetadataStore
	}
	return metadata, nil
}

// savePRMetadata replaces only healthy or absent metadata for a registered PR.
func (i *instance) savePRMetadata(metadata githubpr.Metadata) (githubpr.LibraryRow, error) {
	if metadata.Validate(metadata.PRID) != nil {
		return githubpr.LibraryRow{}, errPRMetadataStore
	}
	i.mu.Lock()
	defer i.mu.Unlock()
	index, err := i.readPRIndex()
	if err != nil {
		return githubpr.LibraryRow{}, errPRMetadataStore
	}
	var registered *githubpr.PullRequest
	for _, pr := range index.PRs {
		if pr.ID == metadata.PRID {
			registered = &pr
			break
		}
	}
	if registered == nil {
		return githubpr.LibraryRow{}, os.ErrNotExist
	}
	root, err := i.registeredReviewDirectory(metadata.PRID, true)
	if err != nil {
		return githubpr.LibraryRow{}, errPRMetadataStore
	}
	defer root.Close()
	if _, err := readPRMetadata(root, metadata.PRID); err != nil && !errors.Is(err, os.ErrNotExist) {
		return githubpr.LibraryRow{}, errPRMetadataStore
	}
	data, err := json.Marshal(metadata)
	if err != nil || len(data)+1 > githubpr.MaxMetadataBytes {
		return githubpr.LibraryRow{}, errPRMetadataStore
	}
	if err := replacePRMetadata(root, append(data, '\n')); err != nil {
		return githubpr.LibraryRow{}, err
	}
	row := i.prLibraryRow(*registered)
	if row.MetadataStatus != "cached" {
		return githubpr.LibraryRow{}, errPRMetadataStore
	}
	return row, nil
}

// replacePRMetadata syncs a private operation-owned temporary before replacement.
func replacePRMetadata(root *os.Root, data []byte) error {
	name := ".pr-metadata-" + rand.Text() + ".tmp"
	f, err := root.OpenFile(name, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return errPRMetadataStore
	}
	defer root.Remove(name)
	if checkPrivateFile(f) != nil {
		f.Close()
		return errPRMetadataStore
	}
	_, writeErr := f.Write(data)
	syncErr := f.Sync()
	closeErr := f.Close()
	if writeErr != nil || syncErr != nil || closeErr != nil || root.Rename(name, "pr-metadata.json") != nil {
		return errPRMetadataStore
	}
	return nil
}
