package github

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"testing"
	"time"
)

func displayMetadataBody() map[string]any {
	return map[string]any{
		"number": 31, "html_url": "https://github.com/owner/repo/pull/31", "title": "Refresh sessions",
		"state": "open", "merged": false, "created_at": "2026-11-01T00:00:00Z", "updated_at": "2026-11-02T00:00:00Z",
		"merged_at": nil, "user": map[string]any{"login": "author"}, "base": map[string]any{"repo": map[string]any{"full_name": "owner/repo"}},
	}
}

func TestReadDisplayMetadataWithoutSourceFields(t *testing.T) {
	pr, audit := metadataFixture(t)
	for _, state := range []string{"open", "closed", "merged"} {
		value := displayMetadataBody()
		if state != "open" {
			value["state"] = "closed"
		}
		if state == "merged" {
			value["merged"], value["merged_at"] = true, "2026-11-02T00:00:00Z"
		}
		body, _ := json.Marshal(value)
		t.Setenv("SHELDON_TEST_GH_RESPONSE", "HTTP/2.0 200 OK\r\n\r\n"+string(body))
		got, err := ReadDisplayMetadata(context.Background(), pr)
		if err != nil || got.State != state || got.PRID != pr.ID || got.Title == nil || got.FetchedAt.IsZero() {
			t.Fatalf("%s: %+v %v", state, got, err)
		}
	}
	if _, err := os.Stat(audit); err != nil {
		t.Fatal("offline gh fixture was not called")
	}
}

func TestDisplayMetadataRejectsInconsistentFacts(t *testing.T) {
	pr, _ := metadataFixture(t)
	for _, change := range []func(map[string]any){
		func(v map[string]any) { v["number"] = 32 }, func(v map[string]any) { v["html_url"] = "https://github.com/other/repo/pull/31" },
		func(v map[string]any) { v["base"] = nil }, func(v map[string]any) { delete(v, "merged") },
		func(v map[string]any) { v["merged"] = true }, func(v map[string]any) { v["state"] = "merged" },
		func(v map[string]any) { v["merged_at"] = "2026-11-02T00:00:00Z" }, func(v map[string]any) { v["updated_at"] = "2020-01-01T00:00:00Z" },
		func(v map[string]any) { v["title"] = strings.Repeat("x", 513) },
	} {
		value := displayMetadataBody()
		change(value)
		body, _ := json.Marshal(value)
		if _, err := parseDisplayMetadata(body, pr); err == nil {
			t.Fatalf("accepted %s", body)
		}
	}
}

func TestDisplayMetadataCommandFailureAndCancellation(t *testing.T) {
	for _, mode := range []string{"auth", "large-stdout", "large-stderr", "failed"} {
		t.Run(mode, func(t *testing.T) {
			pr, _ := metadataFixture(t)
			t.Setenv("SHELDON_TEST_GH_MODE", mode)
			if _, err := ReadDisplayMetadata(context.Background(), pr); err == nil {
				t.Fatal("failed command became valid metadata")
			}
		})
	}
	pr, _ := metadataFixture(t)
	ctx, cancel := context.WithTimeout(context.Background(), time.Nanosecond)
	defer cancel()
	if _, err := ReadDisplayMetadata(ctx, pr); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("deadline lost: %v", err)
	}
}
