package wailsapp

import (
	"io"
	"net/url"
	"os"
	"path/filepath"
	"testing"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestGetSidecarUsageAttributionResolvesCodexAPIKeyLocalID(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	item := cliproxyapi.CodexAPIKeyInput{
		LocalID: "codex-api-key:stable-001",
		APIKey:  "sk-upstream",
		BaseURL: "https://api.example.com/v1",
	}
	if err := rememberCodexAPIKeyAttributionIdentities([]cliproxyapi.CodexAPIKeyInput{item}); err != nil {
		t.Fatalf("remember codex api key attribution: %v", err)
	}
	authID := buildStableRouteAuthID("codex:apikey", item.APIKey, item.BaseURL)
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method != "GET" {
				t.Fatalf("unexpected method: %s", method)
			}
			switch path {
			case ManagementAPIPrefix + "/gettokens/usage-attribution":
				if query.Get("window") != "24h" || query.Get("bucket") != "1h" {
					t.Fatalf("unexpected query: %s", query.Encode())
				}
				return []byte(`{
					"window":"24h",
					"bucket":"1h",
					"generatedAt":"2026-05-15T00:00:00Z",
					"items":[],
					"unresolved":[{
						"attributionKey":"auth-id:` + authID + `",
						"attributionKind":"auth_id",
						"provider":"codex",
						"requestedModels":["gpt-5.4"],
						"requestCount":2,
						"totalTokens":30,
						"buckets":[{"start":"2026-05-15T00:00:00Z","requestCount":2,"totalTokens":30}]
					}]
				}`), 200, nil
			case ManagementAPIPrefix + "/accounts":
				return []byte(`{"accounts":[]}`), 200, nil
			case ManagementAPIPrefix + "/codex-api-key":
				return []byte(`{"codex-api-key":[]}`), 200, nil
			case ManagementAPIPrefix + "/openai-compatibility":
				return []byte(`{"openai-compatibility":[]}`), 200, nil
			default:
				t.Fatalf("unexpected path: %s", path)
			}
			return nil, 404, nil
		},
	}

	result, err := app.GetSidecarUsageAttribution(SidecarUsageAttributionInput{Window: "24h", Bucket: "1h", IncludeUnresolved: true})
	if err != nil {
		t.Fatalf("GetSidecarUsageAttribution: %v", err)
	}
	if len(result.Items) != 1 {
		t.Fatalf("items = %d, want 1", len(result.Items))
	}
	if got := result.Items[0].AccountKey; got != "codex-api-key:stable-001" {
		t.Fatalf("account key = %q, want local id", got)
	}
	if len(result.Unresolved) != 0 {
		t.Fatalf("unresolved = %d, want 0", len(result.Unresolved))
	}
}

func TestGetSidecarUsageAttributionCanSkipAccountResolution(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	resolveAccountKeys := false
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method != "GET" {
				t.Fatalf("unexpected method: %s", method)
			}
			switch path {
			case ManagementAPIPrefix + "/gettokens/usage-attribution":
				return []byte(`{
					"window":"24h",
					"bucket":"1h",
					"generatedAt":"2026-05-15T00:00:00Z",
					"items":[{
						"attributionKey":"account:acct_runtime",
						"attributionKind":"account_key",
						"accountKey":"acct_runtime",
						"provider":"codex",
						"requestCount":2,
						"totalTokens":30,
						"buckets":[{"start":"2026-05-15T00:00:00Z","requestCount":2,"totalTokens":30}]
					}],
					"unresolved":[{
						"attributionKey":"auth-index:needs_resolution",
						"attributionKind":"auth_index",
						"provider":"codex",
						"requestCount":1,
						"totalTokens":10,
						"buckets":[{"start":"2026-05-15T00:00:00Z","requestCount":1,"totalTokens":10}]
					}]
				}`), 200, nil
			case ManagementAPIPrefix + "/accounts", ManagementAPIPrefix + "/codex-api-key", ManagementAPIPrefix + "/openai-compatibility":
				t.Fatalf("background attribution sync must not resolve accounts through %s", path)
			default:
				t.Fatalf("unexpected path: %s", path)
			}
			return nil, 404, nil
		},
	}

	result, err := app.GetSidecarUsageAttribution(SidecarUsageAttributionInput{
		Window:             "24h",
		Bucket:             "1h",
		ResolveAccountKeys: &resolveAccountKeys,
	})
	if err != nil {
		t.Fatalf("GetSidecarUsageAttribution: %v", err)
	}
	if len(result.Items) != 1 {
		t.Fatalf("items = %d, want 1", len(result.Items))
	}
	if got := result.Items[0].AccountKey; got != "acct_runtime" {
		t.Fatalf("account key = %q, want sidecar account key", got)
	}
	if len(result.Unresolved) != 0 {
		t.Fatalf("unresolved = %d, want 0 when not requested", len(result.Unresolved))
	}
}

func TestCodexAttributionIdentityStoreKeepsHistoricalAuthID(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	oldItem := cliproxyapi.CodexAPIKeyInput{
		LocalID: "codex-api-key:stable-001",
		APIKey:  "sk-old",
		BaseURL: "https://old.example.com/v1",
	}
	newItem := cliproxyapi.CodexAPIKeyInput{
		LocalID: "codex-api-key:stable-001",
		APIKey:  "sk-new",
		BaseURL: "https://new.example.com/v1",
	}
	if err := rememberCodexAPIKeyAttributionIdentities([]cliproxyapi.CodexAPIKeyInput{oldItem}); err != nil {
		t.Fatalf("remember old: %v", err)
	}
	if err := rememberCodexAPIKeyAttributionIdentities([]cliproxyapi.CodexAPIKeyInput{newItem}); err != nil {
		t.Fatalf("remember new: %v", err)
	}

	index, err := loadCodexAttributionIdentityIndex()
	if err != nil {
		t.Fatalf("load index: %v", err)
	}
	oldAuthID := buildStableRouteAuthID("codex:apikey", oldItem.APIKey, oldItem.BaseURL)
	newAuthID := buildStableRouteAuthID("codex:apikey", newItem.APIKey, newItem.BaseURL)
	if got := index["auth-id:"+oldAuthID]; got != "codex-api-key:stable-001" {
		t.Fatalf("old auth id maps to %q", got)
	}
	if got := index["auth-id:"+newAuthID]; got != "codex-api-key:stable-001" {
		t.Fatalf("new auth id maps to %q", got)
	}
	storePath := filepath.Join(home, ".config", "gettokens-data", "codex-api-key-attribution-identities-v1.json")
	if _, err := os.Stat(storePath); err != nil {
		t.Fatalf("identity store not written: %v", err)
	}
}

func TestGetSidecarUsageAttributionResolvesAuthIndexToAuthFileAndProvider(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch path {
			case ManagementAPIPrefix + "/gettokens/usage-attribution":
				return []byte(`{
					"window":"24h",
					"bucket":"1h",
					"generatedAt":"2026-05-15T00:00:00Z",
					"items":[],
					"unresolved":[
						{
							"attributionKey":"auth-index:acct_auth",
							"attributionKind":"auth_index",
							"provider":"codex",
							"requestCount":1,
							"buckets":[{"start":"2026-05-15T00:00:00Z","requestCount":1,"totalTokens":0}]
						},
						{
							"attributionKey":"auth-index:provider-001",
							"attributionKind":"auth_index",
							"provider":"mi",
							"requestCount":2,
							"buckets":[{"start":"2026-05-15T00:00:00Z","requestCount":2,"totalTokens":20}]
						}
					]
				}`), 200, nil
			case ManagementAPIPrefix + "/accounts":
				return []byte(`{"accounts":[
					{"account_key":"acct_auth","kind":"auth-file","title":"auth.json","provider":"codex","priority":1,"auth_file":{"source_file_name":"auth.json","auth_type":"codex","email":"dev@example.com","plan_type":"pro"}},
					{"account_key":"acct_mi","kind":"openai-compatible","title":"MI","provider":"MI","priority":2,"openai_compatible":{"provider_name":"MI","base_url":"https://api.example.com/v1","api_key_entries_json":"[{\"api-key\":\"tp-test\",\"auth-index\":\"provider-001\"}]"}}
				]}`), 200, nil
			case ManagementAPIPrefix + "/codex-api-key", ManagementAPIPrefix + "/openai-compatibility":
				t.Fatalf("legacy attribution endpoint should not be used after account-store migration: %s", path)
			default:
				t.Fatalf("unexpected path: %s", path)
			}
			return nil, 404, nil
		},
	}

	result, err := app.GetSidecarUsageAttribution(SidecarUsageAttributionInput{Window: "24h", Bucket: "1h", IncludeUnresolved: true})
	if err != nil {
		t.Fatalf("GetSidecarUsageAttribution: %v", err)
	}
	if len(result.Items) != 2 {
		t.Fatalf("items = %d, want 2", len(result.Items))
	}
	if got := result.Items[0].AccountKey; got != "acct_auth" {
		t.Fatalf("first account key = %q, want acct_auth", got)
	}
	if got := result.Items[1].AccountKey; got != "acct_mi" {
		t.Fatalf("second account key = %q, want acct_mi", got)
	}
	if len(result.Unresolved) != 0 {
		t.Fatalf("unresolved = %d, want 0", len(result.Unresolved))
	}
}

func TestGetSidecarUsageAttributionIncludesUnresolvedSourceForJoinEvenWhenCallerDoesNotRequestIt(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	item := cliproxyapi.CodexAPIKeyInput{
		LocalID: "codex-api-key:stable-001",
		APIKey:  "sk-upstream",
		BaseURL: "https://api.example.com/v1",
	}
	if err := rememberCodexAPIKeyAttributionIdentities([]cliproxyapi.CodexAPIKeyInput{item}); err != nil {
		t.Fatalf("remember codex api key attribution: %v", err)
	}
	authID := buildStableRouteAuthID("codex:apikey", item.APIKey, item.BaseURL)
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch path {
			case ManagementAPIPrefix + "/gettokens/usage-attribution":
				if query.Get("include_unresolved") != "true" {
					t.Fatalf("include_unresolved = %q, want true", query.Get("include_unresolved"))
				}
				return []byte(`{
					"window":"24h",
					"bucket":"1h",
					"generatedAt":"2026-05-15T00:00:00Z",
					"items":[],
					"unresolved":[{
						"attributionKey":"auth-id:` + authID + `",
						"attributionKind":"auth_id",
						"provider":"codex",
						"requestCount":1,
						"totalTokens":30,
						"buckets":[{"start":"2026-05-15T00:00:00Z","requestCount":1,"totalTokens":30}]
					}]
				}`), 200, nil
			case ManagementAPIPrefix + "/accounts":
				return []byte(`{"accounts":[]}`), 200, nil
			case ManagementAPIPrefix + "/codex-api-key":
				return []byte(`{"codex-api-key":[]}`), 200, nil
			case ManagementAPIPrefix + "/openai-compatibility":
				return []byte(`{"openai-compatibility":[]}`), 200, nil
			default:
				t.Fatalf("unexpected path: %s", path)
			}
			return nil, 404, nil
		},
	}

	result, err := app.GetSidecarUsageAttribution(SidecarUsageAttributionInput{Window: "24h", Bucket: "1h"})
	if err != nil {
		t.Fatalf("GetSidecarUsageAttribution: %v", err)
	}
	if len(result.Items) != 1 {
		t.Fatalf("items = %d, want 1", len(result.Items))
	}
	if got := result.Items[0].AccountKey; got != "codex-api-key:stable-001" {
		t.Fatalf("account key = %q, want local id", got)
	}
	if len(result.Unresolved) != 0 {
		t.Fatalf("unresolved = %d, want 0", len(result.Unresolved))
	}
}
