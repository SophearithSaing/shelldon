package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/SophearithSaing/sheldon/internal/github"
	"github.com/SophearithSaing/sheldon/internal/githubpr"
)

// PRLibrary provides local navigation independently of source and native services.
type PRLibrary interface {
	ListPRs(githubpr.LibraryQuery) (githubpr.LibraryResult, error)
}

// PRMetadataRefresher explicitly updates cached GitHub display facts only.
type PRMetadataRefresher interface {
	RefreshPRMetadata(context.Context, githubpr.PullRequest) (githubpr.LibraryRow, error)
}

// prLibrary returns a fresh local view without fetching or changing history.
func (s *Server) prLibrary(w http.ResponseWriter, r *http.Request) {
	if r.URL.EscapedPath() != r.URL.Path {
		http.NotFound(w, r)
		return
	}
	query, err := parseLibraryQuery(r.URL.RawQuery)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid PR library query")
		return
	}
	library, ok := s.prs.(PRLibrary)
	if !ok {
		writeError(w, http.StatusServiceUnavailable, "PR library is unavailable")
		return
	}
	result, err := library.ListPRs(query)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "cannot read PR library; existing data was preserved")
		return
	}
	writeJSON(w, http.StatusOK, result)
}

// parseLibraryQuery rejects duplicate, unknown, malformed and unbounded parameters.
func parseLibraryQuery(raw string) (githubpr.LibraryQuery, error) {
	invalid := errors.New("invalid PR library query")
	query := githubpr.LibraryQuery{State: "all", Limit: 50}
	if len(raw) > 4096 {
		return query, invalid
	}
	values, err := url.ParseQuery(raw)
	if err != nil {
		return query, invalid
	}
	for key, entries := range values {
		if len(entries) != 1 {
			return query, invalid
		}
		value := entries[0]
		switch key {
		case "q":
			query.Search = strings.TrimSpace(value)
		case "state":
			query.State = value
		case "limit", "offset":
			number, err := strconv.Atoi(value)
			if err != nil || strconv.Itoa(number) != value {
				return query, invalid
			}
			if key == "limit" {
				query.Limit = number
			} else {
				query.Offset = number
			}
		default:
			return query, invalid
		}
	}
	return query, query.Validate()
}

// refreshPRMetadata admits one bounded explicit display refresh, never source loading.
func (s *Server) refreshPRMetadata(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !githubpr.ValidID(id) || r.URL.RawQuery != "" || r.URL.EscapedPath() != r.URL.Path {
		http.NotFound(w, r)
		return
	}
	media, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || media != "application/json" {
		writeError(w, http.StatusUnsupportedMediaType, "JSON body required")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4096)
	var input *struct{}
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	err = decoder.Decode(&input)
	if err == nil {
		if end := decoder.Decode(new(any)); !errors.Is(end, io.EOF) {
			err = end
			if err == nil {
				err = errors.New("trailing JSON")
			}
		}
	}
	if err != nil || input == nil {
		if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
			writeError(w, http.StatusRequestEntityTooLarge, "metadata refresh body too large")
		} else {
			writeError(w, http.StatusBadRequest, "invalid metadata refresh body")
		}
		return
	}
	if s.prs == nil {
		writeError(w, http.StatusServiceUnavailable, "PR registry is unavailable")
		return
	}
	pr, err := s.prs.ReadPR(id)
	if errors.Is(err, os.ErrNotExist) {
		writeError(w, http.StatusNotFound, "PR is not registered in this Sheldon instance")
		return
	}
	if err != nil || pr.ID != id || pr.Validate() != nil {
		writeError(w, http.StatusInternalServerError, "cannot read registered PR")
		return
	}
	refresher, ok := s.prs.(PRMetadataRefresher)
	if !ok {
		writeError(w, http.StatusServiceUnavailable, "PR metadata refresh is unavailable")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	row, err := refresher.RefreshPRMetadata(ctx, pr)
	if err != nil {
		switch {
		case errors.Is(err, githubpr.ErrMetadataBusy):
			writeError(w, http.StatusConflict, "PR metadata refresh is already active; retry explicitly")
		case errors.Is(err, context.DeadlineExceeded):
			writeError(w, http.StatusGatewayTimeout, "PR metadata refresh timed out")
		case errors.Is(err, context.Canceled):
			writeError(w, http.StatusServiceUnavailable, "PR metadata refresh was cancelled")
		case errors.Is(err, os.ErrNotExist):
			writeError(w, http.StatusNotFound, "PR is not registered in this Sheldon instance")
		default:
			if _, ok := errors.AsType[*github.MetadataError](err); ok {
				writeError(w, http.StatusBadGateway, "GitHub metadata unavailable; cached data was preserved")
			} else {
				writeError(w, http.StatusInternalServerError, "cannot save PR metadata; reread the library before retrying")
			}
		}
		return
	}
	if row.PR.Validate() != nil || row.PR.ID != id || row.Route != "/reviews/"+id || row.MetadataStatus != "cached" {
		writeError(w, http.StatusInternalServerError, "invalid saved PR metadata")
		return
	}
	writeJSON(w, http.StatusOK, row)
}
