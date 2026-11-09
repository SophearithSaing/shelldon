package github

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/SophearithSaing/sheldon/internal/githubpr"
)

// ReadDisplayMetadata observes GitHub facts without requiring source-resolution fields.
func ReadDisplayMetadata(ctx context.Context, pr githubpr.PullRequest) (githubpr.Metadata, error) {
	if pr.Validate() != nil {
		return githubpr.Metadata{}, &MetadataError{Code: "invalid-metadata"}
	}
	body, err := metadataBody(ctx, pr)
	if err != nil {
		return githubpr.Metadata{}, err
	}
	return parseDisplayMetadata(body, pr)
}

// parseDisplayMetadata validates canonical identity and lifecycle without source loading.
func parseDisplayMetadata(body []byte, expected githubpr.PullRequest) (githubpr.Metadata, error) {
	var value struct {
		Number    uint64     `json:"number"`
		URL       string     `json:"html_url"`
		Title     *string    `json:"title"`
		State     string     `json:"state"`
		Merged    *bool      `json:"merged"`
		CreatedAt time.Time  `json:"created_at"`
		UpdatedAt time.Time  `json:"updated_at"`
		MergedAt  *time.Time `json:"merged_at"`
		User      *struct {
			Login *string `json:"login"`
		} `json:"user"`
		Base struct {
			Repo struct {
				FullName string `json:"full_name"`
			} `json:"repo"`
		} `json:"base"`
	}
	failure := &MetadataError{Code: "invalid-metadata"}
	decoder := json.NewDecoder(bytes.NewReader(body))
	if !utf8.Valid(body) || decoder.Decode(&value) != nil || decoder.Decode(new(any)) != io.EOF {
		return githubpr.Metadata{}, failure
	}
	pr, err := githubpr.ParseURL(value.URL)
	if err != nil || pr.ID != expected.ID || value.Number != expected.Number || !strings.EqualFold(value.Base.Repo.FullName, expected.Owner+"/"+expected.Repository) || value.Merged == nil || value.State != "open" && value.State != "closed" {
		return githubpr.Metadata{}, failure
	}
	metadata := githubpr.Metadata{SchemaVersion: 1, PRID: pr.ID, Title: value.Title, State: value.State, CreatedAt: value.CreatedAt, UpdatedAt: value.UpdatedAt, MergedAt: value.MergedAt, FetchedAt: time.Now().UTC()}
	if value.User != nil {
		metadata.Author = value.User.Login
	}
	if *value.Merged {
		if value.State != "closed" {
			return githubpr.Metadata{}, failure
		}
		metadata.State = "merged"
	}
	if metadata.Validate(expected.ID) != nil {
		return githubpr.Metadata{}, failure
	}
	return metadata, nil
}
