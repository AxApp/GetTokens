package wailsapp

import (
	"path/filepath"
	"testing"
	"time"
)

func TestMergeRelayServiceAPIKeyMetadataCreatesAndPrunesEntries(t *testing.T) {
	now := time.Date(2026, 4, 30, 10, 0, 0, 0, time.UTC)
	existing := map[string]relayServiceAPIKeyMetadata{
		relayServiceAPIKeyMetadataID("sk-old"): {
			CreatedAt: "2026-04-29T10:00:00Z",
		},
	}

	next, changed := mergeRelayServiceAPIKeyMetadata([]string{"sk-new"}, existing, now)
	if !changed {
		t.Fatalf("expected metadata merge to report changes")
	}
	if len(next) != 1 {
		t.Fatalf("expected 1 metadata entry, got %d", len(next))
	}

	item := next[relayServiceAPIKeyMetadataID("sk-new")]
	if item.CreatedAt != now.Format(time.RFC3339) {
		t.Fatalf("createdAt = %q, want %q", item.CreatedAt, now.Format(time.RFC3339))
	}
	if item.LastUsedAt != "" {
		t.Fatalf("lastUsedAt = %q, want empty", item.LastUsedAt)
	}
}

func TestMarkRelayServiceAPIKeyLastUsedSetsCreatedAndLastUsed(t *testing.T) {
	now := time.Date(2026, 4, 30, 11, 0, 0, 0, time.UTC)

	next, changed := markRelayServiceAPIKeyLastUsed(map[string]relayServiceAPIKeyMetadata{}, "sk-test", now)
	if !changed {
		t.Fatalf("expected markRelayServiceAPIKeyLastUsed to report changes")
	}

	item := next[relayServiceAPIKeyMetadataID("sk-test")]
	want := now.Format(time.RFC3339)
	if item.CreatedAt != want {
		t.Fatalf("createdAt = %q, want %q", item.CreatedAt, want)
	}
	if item.LastUsedAt != want {
		t.Fatalf("lastUsedAt = %q, want %q", item.LastUsedAt, want)
	}
}

func TestRelayServiceAPIKeyMetadataRoundTrip(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	items := map[string]relayServiceAPIKeyMetadata{
		relayServiceAPIKeyMetadataID("sk-test"): {
			CreatedAt:  "2026-04-30T12:00:00Z",
			LastUsedAt: "2026-04-30T12:05:00Z",
		},
	}

	if err := saveRelayServiceAPIKeyMetadata(items); err != nil {
		t.Fatalf("saveRelayServiceAPIKeyMetadata: %v", err)
	}

	path, err := relayServiceAPIKeyMetadataFilePath()
	if err != nil {
		t.Fatalf("relayServiceAPIKeyMetadataFilePath: %v", err)
	}
	if filepath.Base(path) != relayServiceAPIKeyMetadataFileName {
		t.Fatalf("metadata path = %q", path)
	}

	loaded, err := loadRelayServiceAPIKeyMetadata()
	if err != nil {
		t.Fatalf("loadRelayServiceAPIKeyMetadata: %v", err)
	}
	if len(loaded) != 1 {
		t.Fatalf("expected 1 loaded metadata entry, got %d", len(loaded))
	}

	item := loaded[relayServiceAPIKeyMetadataID("sk-test")]
	if item.CreatedAt != "2026-04-30T12:00:00Z" || item.LastUsedAt != "2026-04-30T12:05:00Z" {
		t.Fatalf("unexpected metadata payload: %#v", item)
	}
}
