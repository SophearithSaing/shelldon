package githubpr

import (
	"fmt"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestLibrarySelection(t *testing.T) {
	rows := []LibraryRow{}
	for n, state := range []string{"unknown", "merged", "closed", "open"} {
		pr, _ := ParseURL(fmt.Sprintf("https://github.com/owner/repo/pull/%d", 12-n))
		title := "Session refresh"
		pr.Title = &title
		rows = append(rows, LibraryRow{PR: pr, State: state})
	}
	before := append([]LibraryRow{}, rows...)
	for _, tt := range []struct {
		search, state string
		total, count  int
	}{
		{"", "all", 4, 4}, {"SESSION", "open", 1, 4}, {"OWNER/REPO", "merged", 1, 4},
		{"#12", "all", 1, 1}, {"1", "all", 3, 3}, {"absent", "all", 0, 0},
	} {
		got, err := SelectLibrary(rows, LibraryQuery{Search: tt.search, State: tt.state, Limit: 50})
		if err != nil || got.Total != tt.total || got.Counts.All != tt.count || got.Items == nil {
			t.Fatalf("%+v: %+v, %v", tt, got, err)
		}
	}
	first, _ := SelectLibrary(rows, LibraryQuery{State: "all", Limit: 2})
	if first.Items[0].PR.Number != 9 || first.Items[1].PR.Number != 10 || first.NextOffset == nil || *first.NextOffset != 2 || first.Counts != (LibraryCounts{All: 4, Open: 1, Merged: 1, Closed: 1, Unknown: 1}) {
		t.Fatalf("first page: %+v", first)
	}
	last, _ := SelectLibrary(rows, LibraryQuery{State: "all", Limit: 2, Offset: 2})
	if len(last.Items) != 2 || last.Items[0].PR.Number != 11 || last.NextOffset != nil {
		t.Fatalf("last page: %+v", last)
	}
	empty, _ := SelectLibrary(rows, LibraryQuery{State: "all", Limit: 2, Offset: 100})
	if len(empty.Items) != 0 || empty.Total != 4 || !reflect.DeepEqual(rows, before) {
		t.Fatal("pagination changed input or total")
	}
}

func TestLibraryQueryValidation(t *testing.T) {
	for _, q := range []LibraryQuery{
		{}, {State: "closed", Limit: 50}, {State: "all", Limit: 101}, {State: "all", Limit: 50, Offset: -1},
		{State: "all", Limit: 50, Offset: 1_000_001}, {State: "all", Limit: 50, Search: " padded "},
		{State: "all", Limit: 50, Search: strings.Repeat("x", 257)}, {State: "all", Limit: 50, Search: "\xff"},
	} {
		if _, err := SelectLibrary(nil, q); err == nil {
			t.Fatalf("accepted %+v", q)
		}
	}
}

func TestMetadataValidation(t *testing.T) {
	pr, _ := ParseURL("https://github.com/owner/repo/pull/1")
	now := time.Date(2026, 11, 10, 0, 0, 0, 0, time.UTC)
	valid := Metadata{SchemaVersion: 1, PRID: pr.ID, State: "open", CreatedAt: now, UpdatedAt: now, FetchedAt: now}
	if err := valid.Validate(pr.ID); err != nil {
		t.Fatal(err)
	}
	for _, change := range []func(*Metadata){
		func(m *Metadata) { m.SchemaVersion++ }, func(m *Metadata) { m.PRID = strings.Repeat("a", 64) },
		func(m *Metadata) { m.State = "unknown" }, func(m *Metadata) { m.State = "merged" },
		func(m *Metadata) { m.MergedAt = &now }, func(m *Metadata) { m.CreatedAt = now.Add(time.Hour) },
		func(m *Metadata) { m.FetchedAt = time.Time{} }, func(m *Metadata) { m.UpdatedAt = now.In(time.FixedZone("offset", 3600)) },
		func(m *Metadata) { title := "\nunsafe"; m.Title = &title },
	} {
		value := valid
		change(&value)
		if value.Validate(pr.ID) == nil {
			t.Fatalf("accepted %+v", value)
		}
	}
	valid.State, valid.MergedAt = "merged", &now
	if err := valid.Validate(pr.ID); err != nil {
		t.Fatal(err)
	}
}
