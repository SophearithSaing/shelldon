package app

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/SophearithSaing/sheldon/internal/githubpr"
)

func libraryQuery() githubpr.LibraryQuery {
	return githubpr.LibraryQuery{State: "all", Limit: 50}
}

func libraryMetadata(prID string) githubpr.Metadata {
	now := time.Date(2026, 11, 10, 0, 0, 0, 0, time.UTC)
	title := "Session refresh"
	return githubpr.Metadata{SchemaVersion: 1, PRID: prID, Title: &title, State: "open", CreatedAt: now, UpdatedAt: now, FetchedAt: now}
}

func TestPRLibraryMissingIndexDoesNotWrite(t *testing.T) {
	paths := testPaths(t)
	i := ownedPRInstance(t, paths.Data)
	t.Setenv("PATH", t.TempDir())
	got, err := i.ListPRs(libraryQuery())
	if err != nil || got.Items == nil || len(got.Items) != 0 || got.Total != 0 {
		t.Fatalf("empty library: %+v %v", got, err)
	}
	entries, err := os.ReadDir(paths.Data)
	if err != nil || len(entries) != 1 || entries[0].Name() != "instance.lock" {
		t.Fatalf("read created storage: %v, %v", entries, err)
	}
}

func TestPRLibrarySavedMetadataAndRestart(t *testing.T) {
	paths := testPaths(t)
	i := ownedPRInstance(t, paths.Data)
	pr, _ := i.RegisterPR("https://github.com/owner/repo/pull/12")
	other, _ := i.RegisterPR("https://github.com/owner/repo/pull/2")
	indexPath := filepath.Join(paths.Data, "prs.json")
	before, _ := os.ReadFile(indexPath)
	got, err := i.ListPRs(libraryQuery())
	if err != nil || got.Counts.Unknown != 2 || got.Items[0].PR.ID != other.ID || got.Items[0].MetadataStatus != "missing" {
		t.Fatalf("missing metadata: %+v %v", got, err)
	}
	row, err := i.savePRMetadata(libraryMetadata(pr.ID))
	if err != nil || row.State != "open" || row.MetadataStatus != "cached" || *row.PR.Title != "Session refresh" {
		t.Fatalf("save: %+v %v", row, err)
	}
	file := filepath.Join(paths.Data, "reviews", pr.ID, "pr-metadata.json")
	saved, _ := os.ReadFile(file)
	t.Setenv("PATH", t.TempDir())
	if err := i.close(); err != nil {
		t.Fatal(err)
	}
	reopened := ownedPRInstance(t, paths.Data)
	query := libraryQuery()
	query.Search, query.State = "SESSION", "open"
	got, err = reopened.ListPRs(query)
	if err != nil || got.Total != 1 || got.Items[0].PR.ID != pr.ID || got.Items[0].FetchedAt == nil {
		t.Fatalf("restart: %+v %v", got, err)
	}
	after, _ := os.ReadFile(indexPath)
	metadataAfter, _ := os.ReadFile(file)
	if !bytes.Equal(before, after) || !bytes.Equal(saved, metadataAfter) {
		t.Fatal("listing changed saved bytes")
	}
	if _, err := os.Stat(paths.Cache); !os.IsNotExist(err) {
		t.Fatal("library initialized source cache")
	}
	if _, err := os.Stat(filepath.Join(paths.Data, "reviews", other.ID)); !os.IsNotExist(err) {
		t.Fatal("listing initialized absent review directory")
	}
}

func TestPRLibraryPreservesInvalidMetadata(t *testing.T) {
	for _, kind := range []string{"corrupt", "future", "foreign", "oversized", "directory", "symlink", "unknown-field"} {
		t.Run(kind, func(t *testing.T) {
			paths := testPaths(t)
			i := ownedPRInstance(t, paths.Data)
			pr, _ := i.RegisterPR("https://github.com/owner/repo/pull/1")
			if _, err := i.savePRMetadata(libraryMetadata(pr.ID)); err != nil {
				t.Fatal(err)
			}
			file := filepath.Join(paths.Data, "reviews", pr.ID, "pr-metadata.json")
			metadata := libraryMetadata(pr.ID)
			data := []byte("{")
			switch kind {
			case "future":
				metadata.SchemaVersion++
				data, _ = json.Marshal(metadata)
			case "foreign":
				metadata.PRID = strings.Repeat("a", 64)
				data, _ = json.Marshal(metadata)
			case "oversized":
				data = bytes.Repeat([]byte(" "), githubpr.MaxMetadataBytes+1)
			case "unknown-field":
				data, _ = json.Marshal(metadata)
				data = append([]byte(`{"extra":true,`), data[1:]...)
			}
			if err := os.Remove(file); err != nil {
				t.Fatal(err)
			}
			if kind == "directory" {
				if err := os.Mkdir(file, 0700); err != nil {
					t.Fatal(err)
				}
			} else if kind == "symlink" {
				if err := os.Symlink(filepath.Join(paths.Data, "prs.json"), file); err != nil {
					t.Skipf("symlinks unavailable: %v", err)
				}
			} else if err := os.WriteFile(file, data, 0600); err != nil {
				t.Fatal(err)
			}
			got, err := i.ListPRs(libraryQuery())
			if err != nil || got.Total != 1 || got.Items[0].MetadataStatus != "unavailable" || got.Items[0].State != "unknown" || got.Items[0].PR.Title != nil {
				t.Fatalf("invalid metadata hid membership: %+v %v", got, err)
			}
			if _, err := i.savePRMetadata(metadata); err == nil {
				t.Fatal("overwrote invalid existing metadata")
			}
			if kind != "directory" && kind != "symlink" {
				after, _ := os.ReadFile(file)
				if !bytes.Equal(data, after) {
					t.Fatal("invalid bytes changed")
				}
			}
		})
	}
}

func TestPRLibraryRegistryFailureAndOwnership(t *testing.T) {
	paths := testPaths(t)
	i := ownedPRInstance(t, paths.Data)
	if err := os.WriteFile(filepath.Join(paths.Data, "prs.json"), []byte("{"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := i.ListPRs(libraryQuery()); err == nil {
		t.Fatal("corrupt registry became healthy empty library")
	}
	if err := i.close(); err != nil {
		t.Fatal(err)
	}
	if _, err := i.ListPRs(libraryQuery()); err == nil {
		t.Fatal("closed writer listed PRs")
	}
}

func TestPRLibraryConcurrentRegistration(t *testing.T) {
	i := ownedPRInstance(t, testPaths(t).Data)
	var wg sync.WaitGroup
	for n := 1; n <= 12; n++ {
		wg.Go(func() {
			if _, err := i.RegisterPR(fmt.Sprintf("https://github.com/owner/repo/pull/%d", n)); err != nil {
				t.Error(err)
			}
			if _, err := i.ListPRs(libraryQuery()); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	got, err := i.ListPRs(libraryQuery())
	if err != nil || got.Total != 12 {
		t.Fatalf("lost membership: %+v %v", got, err)
	}
}

func TestPRLibraryLegacyFallbackAndUnsafeStorage(t *testing.T) {
	for _, kind := range []string{"legacy", "linked-parent", "public-file", "blocked-parent"} {
		t.Run(kind, func(t *testing.T) {
			paths := testPaths(t)
			i := ownedPRInstance(t, paths.Data)
			pr, _ := i.RegisterPR("https://github.com/owner/repo/pull/1")
			title, author := "Legacy title", "legacy-author"
			pr.Title, pr.Author = &title, &author
			if err := i.savePRIndex(prIndex{SchemaVersion: 1, PRs: []githubpr.PullRequest{pr}}); err != nil {
				t.Fatal(err)
			}
			expectedStatus := "missing"
			switch kind {
			case "linked-parent":
				if err := os.Symlink(t.TempDir(), filepath.Join(paths.Data, "reviews")); err != nil {
					t.Skipf("symlinks unavailable: %v", err)
				}
				expectedStatus = "unavailable"
			case "blocked-parent":
				if err := os.WriteFile(filepath.Join(paths.Data, "reviews"), []byte("preserve"), 0600); err != nil {
					t.Fatal(err)
				}
				expectedStatus = "unavailable"
			case "public-file":
				if runtime.GOOS == "windows" {
					t.Skip("POSIX permission check")
				}
				if _, err := i.savePRMetadata(libraryMetadata(pr.ID)); err != nil {
					t.Fatal(err)
				}
				if err := os.Chmod(filepath.Join(paths.Data, "reviews", pr.ID, "pr-metadata.json"), 0644); err != nil {
					t.Fatal(err)
				}
				expectedStatus = "unavailable"
			}
			result, err := i.ListPRs(libraryQuery())
			if err != nil || result.Total != 1 || result.Items[0].MetadataStatus != expectedStatus || result.Items[0].State != "unknown" || *result.Items[0].PR.Title != title || *result.Items[0].PR.Author != author {
				t.Fatalf("fallback: %+v %v", result, err)
			}
			if kind != "legacy" {
				if _, err := i.savePRMetadata(libraryMetadata(pr.ID)); err == nil {
					t.Fatal("refresh replaced unsafe storage")
				}
			}
		})
	}
}

func BenchmarkPRLibrary1000(b *testing.B) {
	dir := filepath.Join(b.TempDir(), "private")
	if err := os.Mkdir(dir, 0700); err != nil {
		b.Fatal(err)
	}
	i, err := openInstance(dir)
	if err != nil {
		b.Fatal(err)
	}
	defer i.close()
	if owned, err := i.acquire(); err != nil || !owned {
		b.Fatal("writer unavailable")
	}
	index := prIndex{SchemaVersion: 1, PRs: []githubpr.PullRequest{}}
	for n := 1; n <= 1000; n++ {
		pr, _ := githubpr.ParseURL(fmt.Sprintf("https://github.com/owner/repo/pull/%d", n))
		index.PRs = append(index.PRs, pr)
		dir := filepath.Join(filepath.Dir(i.file.Name()), "reviews", pr.ID)
		if err := os.MkdirAll(dir, 0700); err != nil {
			b.Fatal(err)
		}
		data, _ := json.Marshal(libraryMetadata(pr.ID))
		if err := os.WriteFile(filepath.Join(dir, "pr-metadata.json"), data, 0600); err != nil {
			b.Fatal(err)
		}
	}
	if err := i.savePRIndex(index); err != nil {
		b.Fatal(err)
	}
	b.ResetTimer()
	for b.Loop() {
		result, err := i.ListPRs(libraryQuery())
		if err != nil || result.Total != 1000 {
			b.Fatalf("list: %d %v", result.Total, err)
		}
	}
}
