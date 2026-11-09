package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/SophearithSaing/sheldon/internal/github"
	"github.com/SophearithSaing/sheldon/internal/githubpr"
)

type testPRLibrary struct {
	*testPRRegistry
	query      githubpr.LibraryQuery
	listErr    error
	refreshErr error
	refreshes  int
}

func (l *testPRLibrary) ListPRs(query githubpr.LibraryQuery) (githubpr.LibraryResult, error) {
	l.query = query
	return githubpr.LibraryResult{Items: []githubpr.LibraryRow{}}, l.listErr
}

func (l *testPRLibrary) RefreshPRMetadata(ctx context.Context, pr githubpr.PullRequest) (githubpr.LibraryRow, error) {
	l.refreshes++
	if _, ok := ctx.Deadline(); !ok {
		return githubpr.LibraryRow{}, errors.New("missing refresh deadline")
	}
	return githubpr.LibraryRow{PR: pr, Route: "/reviews/" + pr.ID, State: "open", MetadataStatus: "cached"}, l.refreshErr
}

func TestLibraryQueryParsing(t *testing.T) {
	for _, raw := range []string{"q=x&q=y", "state=closed", "state=", "unknown=1", "limit=0", "limit=101", "limit=01", "limit=%2B1", "offset=-1", "offset=1000001", "offset=9999999999999999999999", "q=%ff", "q=%", "q=x;y", "q=" + strings.Repeat("x", 257)} {
		if _, err := parseLibraryQuery(raw); err == nil {
			t.Errorf("accepted %q", raw)
		}
	}
	got, err := parseLibraryQuery("q=%20SESSION%20&state=merged&limit=20&offset=40")
	if err != nil || got != (githubpr.LibraryQuery{Search: "SESSION", State: "merged", Limit: 20, Offset: 40}) {
		t.Fatalf("parsed: %+v %v", got, err)
	}
}

func TestLibraryHTTPProtectionAndFailures(t *testing.T) {
	library := &testPRLibrary{testPRRegistry: &testPRRegistry{prs: map[string]githubpr.PullRequest{}}}
	s, err := Listen("", "", library)
	if err != nil {
		t.Fatal(err)
	}
	client := startTestServer(t, s)
	for _, tt := range []struct {
		path    string
		headers map[string]string
		status  int
	}{
		{"/api/reviews", nil, 401},
		{"/api/reviews", map[string]string{"Authorization": "Bearer " + s.APIToken(), "Host": "attacker.example"}, 403},
		{"/api/reviews", map[string]string{"Authorization": "Bearer " + s.APIToken(), "Origin": "https://attacker.example"}, 403},
		{"/api/reviews?limit=01", map[string]string{"Authorization": "Bearer " + s.APIToken()}, 400},
		{"/api/reviews?state=merged", map[string]string{"Authorization": "Bearer " + s.APIToken()}, 200},
	} {
		r := request(t, s, client, "GET", tt.path, "", tt.headers)
		if r.StatusCode != tt.status {
			t.Fatalf("%s: %d want %d", tt.path, r.StatusCode, tt.status)
		}
	}
	if library.query.State != "merged" || library.query.Limit != 50 || library.refreshes != 0 {
		t.Fatalf("read dispatched refresh or lost query: %+v", library)
	}
	library.listErr = errors.New("private path and secret")
	r := request(t, s, client, "GET", "/api/reviews", "", map[string]string{"Authorization": "Bearer " + s.APIToken()})
	body, _ := io.ReadAll(r.Body)
	if r.StatusCode != 500 || strings.Contains(string(body), "secret") || r.Header.Get("Cache-Control") != "no-store" {
		t.Fatalf("unsafe failure: %d %s", r.StatusCode, body)
	}
}

func TestMetadataRefreshHTTPValidationAndErrors(t *testing.T) {
	library := &testPRLibrary{testPRRegistry: &testPRRegistry{prs: map[string]githubpr.PullRequest{}}}
	pr, _ := library.RegisterPR("https://github.com/owner/repo/pull/1")
	s, err := Listen("", "", library)
	if err != nil {
		t.Fatal(err)
	}
	client := startTestServer(t, s)
	path := "/api/reviews/" + pr.ID + "/metadata/refresh"
	for _, tt := range []struct {
		body   string
		status int
	}{
		{"", 400}, {"null", 400}, {"[]", 400}, {`{"extra":true}`, 400}, {"{} {}", 400},
		{"{}" + strings.Repeat(" ", 4096), 413}, {"{}", 200},
	} {
		r := request(t, s, client, "POST", path, tt.body, map[string]string{"Authorization": "Bearer " + s.APIToken(), "Content-Type": "application/json"})
		if r.StatusCode != tt.status {
			t.Fatalf("body %q: %d want %d", tt.body, r.StatusCode, tt.status)
		}
		if tt.status == 200 {
			var row githubpr.LibraryRow
			if json.NewDecoder(r.Body).Decode(&row) != nil || row.PR.ID != pr.ID || r.Header.Get("Cache-Control") != "no-store" {
				t.Fatal("invalid success projection")
			}
		}
	}
	if library.refreshes != 1 {
		t.Fatalf("invalid request reached refresh: %d", library.refreshes)
	}
	for _, tt := range []struct {
		err    error
		status int
	}{
		{githubpr.ErrMetadataBusy, 409}, {context.DeadlineExceeded, 504}, {context.Canceled, 503},
		{&github.MetadataError{Code: "authentication-required"}, 502}, {errors.New("private secret"), 500},
	} {
		library.refreshErr = tt.err
		r := request(t, s, client, "POST", path, "{}", map[string]string{"Authorization": "Bearer " + s.APIToken(), "Content-Type": "application/json"})
		body, _ := io.ReadAll(r.Body)
		if r.StatusCode != tt.status || strings.Contains(string(body), "secret") {
			t.Fatalf("error %v: %d %s", tt.err, r.StatusCode, body)
		}
	}
	for _, tt := range []struct {
		path, media, token string
		status             int
	}{
		{path, "application/json", "", 401}, {path, "text/plain", s.APIToken(), 415},
		{path + "?x=1", "application/json", s.APIToken(), 404},
		{"/api/reviews/" + strings.Repeat("a", 64) + "/metadata/refresh", "application/json", s.APIToken(), 404},
	} {
		r := request(t, s, client, "POST", tt.path, "{}", map[string]string{"Authorization": "Bearer " + tt.token, "Content-Type": tt.media})
		if r.StatusCode != tt.status {
			t.Fatalf("path %s: %d want %d", tt.path, r.StatusCode, tt.status)
		}
	}
}

func TestLibraryUnavailableDoesNotFallBack(t *testing.T) {
	s, client := newTestServer(t, "")
	pr, _ := s.prs.RegisterPR("https://github.com/owner/repo/pull/1")
	for method, path := range map[string]string{"GET": "/api/reviews", "POST": "/api/reviews/" + pr.ID + "/metadata/refresh"} {
		r := request(t, s, client, method, path, "{}", map[string]string{"Authorization": "Bearer " + s.APIToken(), "Content-Type": "application/json"})
		if r.StatusCode != 503 {
			t.Fatalf("%s %s: %d", method, path, r.StatusCode)
		}
	}
}
