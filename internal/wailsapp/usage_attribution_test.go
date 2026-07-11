package wailsapp

import (
	"io"
	"net/url"
	"testing"
)

func TestGetSidecarUsageAttributionDoesNotResolveLegacyIdentityInApp(t *testing.T) {
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
						"attributionKey":"auth-id:legacy-auth",
						"attributionKind":"auth_id",
						"provider":"codex",
						"requestedModels":["gpt-5.4"],
						"requestCount":2,
						"totalTokens":30,
						"buckets":[{"start":"2026-05-15T00:00:00Z","requestCount":2,"totalTokens":30}]
					}]
				}`), 200, nil
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
	if len(result.Items) != 0 || len(result.Unresolved) != 1 {
		t.Fatalf("result = %#v, want sidecar unresolved item unchanged", result)
	}
}

func TestGetSidecarUsageAttributionUsesSidecarAccountKeysWithoutInventoryReads(t *testing.T) {
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
		Window: "24h",
		Bucket: "1h",
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

func TestGetSidecarUsageAttributionDoesNotReadAccountInventoryForResolution(t *testing.T) {
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
	if len(result.Items) != 0 || len(result.Unresolved) != 2 {
		t.Fatalf("result = %#v, want unresolved items owned by sidecar", result)
	}
}

func TestGetSidecarUsageAttributionOmitsUnresolvedWhenCallerDoesNotRequestIt(t *testing.T) {
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch path {
			case ManagementAPIPrefix + "/gettokens/usage-attribution":
				if query.Get("include_unresolved") != "" {
					t.Fatalf("include_unresolved = %q, want omitted", query.Get("include_unresolved"))
				}
				return []byte(`{
					"window":"24h",
					"bucket":"1h",
					"generatedAt":"2026-05-15T00:00:00Z",
					"items":[{
						"attributionKey":"account:acct_sidecar",
						"attributionKind":"account_key",
						"accountKey":"acct_sidecar",
						"provider":"codex",
						"requestCount":1,
						"totalTokens":30,
						"buckets":[{"start":"2026-05-15T00:00:00Z","requestCount":1,"totalTokens":30}]
					}],
					"unresolved":[]
				}`), 200, nil
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
	if got := result.Items[0].AccountKey; got != "acct_sidecar" {
		t.Fatalf("account key = %q, want sidecar account key", got)
	}
	if len(result.Unresolved) != 0 {
		t.Fatalf("unresolved = %d, want 0", len(result.Unresolved))
	}
}
