package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/SophearithSaing/sheldon/internal/githubpr"
)

func TestRefreshPRMetadataOffline(t *testing.T) {
	bin := t.TempDir()
	name := "gh"
	if runtime.GOOS == "windows" {
		name += ".exe"
	}
	cmd := exec.Command("go", "build", "-o", filepath.Join(bin, name), "../github/testdata/gh")
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("build fixture: %v %s", err, output)
	}
	for key, value := range map[string]string{
		"PATH": bin, "GH_TOKEN": "synthetic-auth-token", "SHELDON_TEST_GH_AUDIT": filepath.Join(t.TempDir(), "audit"),
		"SHELDON_TEST_GH_MODE": "", "SHELDON_TEST_GH_RESPONSE": "HTTP/2.0 200 OK\r\n\r\n" + `{"number":31,"html_url":"https://github.com/owner/repo/pull/31","title":"Refreshed title","state":"open","merged":false,"created_at":"2026-11-01T00:00:00Z","updated_at":"2026-11-02T00:00:00Z","base":{"repo":{"full_name":"owner/repo"}}}`,
	} {
		t.Setenv(key, value)
	}
	paths := testPaths(t)
	i := ownedPRInstance(t, paths.Data)
	s := questionHTTP(t, questionFixture{owner: i, service: &sourceRegistry{instance: i, paths: paths}})
	registration := questionPost(t, context.Background(), s, "/api/open", map[string]string{"url": "https://github.com/owner/repo/pull/31"})
	if registration.StatusCode != 202 {
		t.Fatalf("registration: %d", registration.StatusCode)
	}
	pr, _ := i.ReadPR(mustPRID(t, "https://github.com/owner/repo/pull/31"))
	initial := historyGET(t, s, "/api/reviews")
	var initialList githubpr.LibraryResult
	if initial.StatusCode != 200 || json.NewDecoder(initial.Body).Decode(&initialList) != nil || initialList.Counts.Unknown != 1 {
		t.Fatal("new registration missing from local library")
	}
	response := questionPost(t, context.Background(), s, "/api/reviews/"+pr.ID+"/metadata/refresh", map[string]any{})
	var row githubpr.LibraryRow
	if response.StatusCode != 200 || json.NewDecoder(response.Body).Decode(&row) != nil || row.State != "open" || row.PR.Title == nil || *row.PR.Title != "Refreshed title" {
		t.Fatalf("refresh: %d %+v", response.StatusCode, row)
	}
	file := filepath.Join(paths.Data, "reviews", pr.ID, "pr-metadata.json")
	before, _ := os.ReadFile(file)
	i.metadataRefreshing[pr.ID] = true
	if _, err := i.RefreshPRMetadata(context.Background(), pr); !errors.Is(err, githubpr.ErrMetadataBusy) {
		t.Fatalf("busy: %v", err)
	}
	delete(i.metadataRefreshing, pr.ID)
	t.Setenv("SHELDON_TEST_GH_MODE", "auth")
	if _, err := i.RefreshPRMetadata(context.Background(), pr); err == nil {
		t.Fatal("auth failure became refresh success")
	}
	after, _ := os.ReadFile(file)
	if !bytes.Equal(before, after) || len(i.metadataRefreshing) != 0 {
		t.Fatal("failed refresh changed cache or retained slot")
	}
	t.Setenv("SHELDON_TEST_GH_MODE", "hang")
	ctx, cancel := context.WithTimeout(context.Background(), 150*time.Millisecond)
	defer cancel()
	if _, err := i.RefreshPRMetadata(ctx, pr); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("deadline: %v", err)
	}
	if len(i.metadataRefreshing) != 0 {
		t.Fatal("cancelled command retained slot")
	}
	unregistered, _ := githubpr.ParseURL("https://github.com/owner/repo/pull/32")
	if _, err := i.RefreshPRMetadata(context.Background(), unregistered); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("unregistered refresh: %v", err)
	}
	if _, err := os.Stat(paths.Cache); !os.IsNotExist(err) {
		t.Fatal("metadata refresh initialized source")
	}
	if err := s.Shutdown(context.Background()); err != nil {
		t.Fatal(err)
	}
	if err := i.close(); err != nil {
		t.Fatal(err)
	}
	i = ownedPRInstance(t, paths.Data)
	t.Setenv("PATH", t.TempDir())
	s = questionHTTP(t, questionFixture{owner: i, service: &sourceRegistry{instance: i, paths: paths}})
	listed := historyGET(t, s, "/api/reviews?q=REFRESHED&state=open")
	var result githubpr.LibraryResult
	if listed.StatusCode != 200 || json.NewDecoder(listed.Body).Decode(&result) != nil || result.Total != 1 || result.Items[0].PR.ID != pr.ID {
		t.Fatalf("restart list: %d %+v", listed.StatusCode, result)
	}
	reopened := historyGET(t, s, "/api/reviews/"+pr.ID)
	if reopened.StatusCode != 200 || i.cache != nil || i.questions != nil || i.quizzes != nil || i.semantics != nil {
		t.Fatal("source-free reopening failed or started services")
	}
}

func mustPRID(t *testing.T, raw string) string {
	t.Helper()
	pr, err := githubpr.ParseURL(raw)
	if err != nil {
		t.Fatal(err)
	}
	return pr.ID
}
