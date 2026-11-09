package app

import (
	"bytes"
	"context"
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
	pr, _ := i.RegisterPR("https://github.com/owner/repo/pull/31")
	row, err := i.RefreshPRMetadata(context.Background(), pr)
	if err != nil || row.State != "open" || row.PR.Title == nil || *row.PR.Title != "Refreshed title" {
		t.Fatalf("refresh: %+v %v", row, err)
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
}
