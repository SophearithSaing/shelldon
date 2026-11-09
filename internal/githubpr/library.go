package githubpr

import (
	"errors"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

const MaxMetadataBytes = 16 << 10

// Metadata is a saved display observation, independent of pinned source.
type Metadata struct {
	SchemaVersion int        `json:"schemaVersion"`
	PRID          string     `json:"prID"`
	Title         *string    `json:"title"`
	Author        *string    `json:"author"`
	State         string     `json:"state"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
	MergedAt      *time.Time `json:"mergedAt"`
	FetchedAt     time.Time  `json:"fetchedAt"`
}

// Validate checks identity, bounded display fields and consistent observed facts.
func (m Metadata) Validate(prID string) error {
	if m.SchemaVersion != 1 || !ValidID(prID) || m.PRID != prID || !validDescription(m.Title, 512) || !validDescription(m.Author, 256) {
		return errors.New("invalid PR metadata")
	}
	if m.State != "open" && m.State != "closed" && m.State != "merged" {
		return errors.New("invalid PR lifecycle")
	}
	if !validMetadataTime(m.CreatedAt) || !validMetadataTime(m.UpdatedAt) || !validMetadataTime(m.FetchedAt) || m.UpdatedAt.Before(m.CreatedAt) {
		return errors.New("invalid PR timestamps")
	}
	if (m.State == "merged") != (m.MergedAt != nil) || m.MergedAt != nil && (!validMetadataTime(*m.MergedAt) || m.MergedAt.Before(m.CreatedAt) || m.MergedAt.After(m.UpdatedAt)) {
		return errors.New("invalid PR merge timestamp")
	}
	return nil
}

// validMetadataTime accepts nonzero UTC timestamps within JSON's year range.
func validMetadataTime(value time.Time) bool {
	_, offset := value.Zone()
	return !value.IsZero() && offset == 0 && value.Year() >= 1 && value.Year() <= 9999
}

// LibraryRow exposes cached facts without private paths or source/session state.
type LibraryRow struct {
	PR             PullRequest `json:"pr"`
	Route          string      `json:"route"`
	State          string      `json:"state"`
	MetadataStatus string      `json:"metadataStatus"`
	CreatedAt      *time.Time  `json:"createdAt"`
	UpdatedAt      *time.Time  `json:"updatedAt"`
	MergedAt       *time.Time  `json:"mergedAt"`
	FetchedAt      *time.Time  `json:"fetchedAt"`
}

// LibraryQuery bounds local search and pagination; all fields must be explicit.
type LibraryQuery struct {
	Search string
	State  string
	Limit  int
	Offset int
}

// Validate rejects unsupported filters and unbounded local queries.
func (q LibraryQuery) Validate() error {
	if !utf8.ValidString(q.Search) || len(q.Search) > 256 || strings.TrimSpace(q.Search) != q.Search || q.State != "all" && q.State != "open" && q.State != "merged" || q.Limit < 1 || q.Limit > 100 || q.Offset < 0 || q.Offset > 1_000_000 {
		return errors.New("invalid PR library query")
	}
	return nil
}

// LibraryCounts counts search matches before lifecycle filtering and pagination.
type LibraryCounts struct {
	Open    int `json:"open"`
	Merged  int `json:"merged"`
	Closed  int `json:"closed"`
	Unknown int `json:"unknown"`
	All     int `json:"all"`
}

// LibraryResult is a fresh local view, not a cross-request pagination snapshot.
type LibraryResult struct {
	Items      []LibraryRow  `json:"items"`
	Total      int           `json:"total"`
	Counts     LibraryCounts `json:"counts"`
	NextOffset *int          `json:"nextOffset"`
}

// SelectLibrary searches, counts and pages a private copy of cached rows.
func SelectLibrary(rows []LibraryRow, q LibraryQuery) (LibraryResult, error) {
	if err := q.Validate(); err != nil {
		return LibraryResult{}, err
	}
	result := LibraryResult{Items: []LibraryRow{}}
	matches := make([]LibraryRow, 0, len(rows))
	search := strings.ToLower(q.Search)
	for _, row := range rows {
		title := ""
		if row.PR.Title != nil {
			title = *row.PR.Title
		}
		number := strings.TrimPrefix(search, "#")
		if search != "" && !strings.Contains(strings.ToLower(title), search) && !strings.Contains(row.PR.Owner+"/"+row.PR.Repository, search) && (number == "" || !strings.Contains(strconv.FormatUint(row.PR.Number, 10), number)) {
			continue
		}
		result.Counts.All++
		switch row.State {
		case "open":
			result.Counts.Open++
		case "merged":
			result.Counts.Merged++
		case "closed":
			result.Counts.Closed++
		default:
			result.Counts.Unknown++
		}
		if q.State == "all" || row.State == q.State {
			matches = append(matches, row)
		}
	}
	slices.SortFunc(matches, compareLibraryRows)
	result.Total = len(matches)
	start := min(q.Offset, len(matches))
	end := min(start+q.Limit, len(matches))
	result.Items = append(result.Items, matches[start:end]...)
	if end < len(matches) {
		result.NextOffset = &end
	}
	return result, nil
}

// compareLibraryRows orders canonical repository, numeric PR number and ID.
func compareLibraryRows(a, b LibraryRow) int {
	if order := strings.Compare(a.PR.Owner+"/"+a.PR.Repository, b.PR.Owner+"/"+b.PR.Repository); order != 0 {
		return order
	}
	if a.PR.Number < b.PR.Number {
		return -1
	}
	if a.PR.Number > b.PR.Number {
		return 1
	}
	return strings.Compare(a.PR.ID, b.PR.ID)
}
