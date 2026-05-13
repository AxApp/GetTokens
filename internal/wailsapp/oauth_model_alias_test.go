package wailsapp

import (
	"encoding/json"
	"io"
	"net/url"
	"testing"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func TestListOAuthModelAliasesReturnsChannelModels(t *testing.T) {
	app := New("dev", "", "AxApp/GetTokens")
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			_ = query
			_ = body
			_ = contentType
			if method != "GET" || path != "/v0/management/oauth-model-alias" {
				t.Fatalf("unexpected request: %s %s", method, path)
			}
			return []byte(`{"oauth-model-alias":{"codex":[{"name":"gpt-5.4-mini","alias":"gpt-5.4"}]}}`), 200, nil
		})
	}

	models, err := app.ListOAuthModelAliases(" Codex ")
	if err != nil {
		t.Fatalf("ListOAuthModelAliases returned error: %v", err)
	}
	if len(models) != 1 || models[0].Name != "gpt-5.4-mini" || models[0].Alias != "gpt-5.4" {
		t.Fatalf("unexpected models: %#v", models)
	}
}

func TestUpdateOAuthModelAliasesMergesChannelAndDropsIdentityMappings(t *testing.T) {
	var putPayload map[string][]cliproxyapi.OAuthModelAlias
	app := New("dev", "", "AxApp/GetTokens")
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			_ = query
			_ = contentType
			switch method + " " + path {
			case "GET /v0/management/oauth-model-alias":
				return []byte(`{"oauth-model-alias":{"claude":[{"name":"claude-sonnet","alias":"sonnet"}],"codex":[{"name":"old","alias":"old-alias"}]}}`), 200, nil
			case "PUT /v0/management/oauth-model-alias":
				data, _ := io.ReadAll(body)
				if err := json.Unmarshal(data, &putPayload); err != nil {
					t.Fatalf("invalid put payload: %v", err)
				}
				return []byte(`{}`), 200, nil
			default:
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 404, nil
			}
		})
	}

	err := app.UpdateOAuthModelAliases(UpdateOAuthModelAliasesInput{
		Channel: "codex",
		Models: []OpenAICompatibleModel{
			{Name: "gpt-5.4-mini", Alias: "gpt-5.4"},
			{Name: "gpt-5.4-mini", Alias: "gpt-5.4"},
			{Name: "gpt-5.4", Alias: "gpt-5.4"},
			{Name: "", Alias: "ignored"},
		},
	})
	if err != nil {
		t.Fatalf("UpdateOAuthModelAliases returned error: %v", err)
	}

	if len(putPayload["claude"]) != 1 {
		t.Fatalf("expected unrelated channel to be preserved: %#v", putPayload)
	}
	codex := putPayload["codex"]
	if len(codex) != 1 || codex[0].Name != "gpt-5.4-mini" || codex[0].Alias != "gpt-5.4" {
		t.Fatalf("unexpected codex aliases: %#v", codex)
	}
}

func TestUpdateOAuthModelAliasesDeletesChannelWhenNoAliasesRemain(t *testing.T) {
	var putPayload map[string][]cliproxyapi.OAuthModelAlias
	app := New("dev", "", "AxApp/GetTokens")
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			_ = query
			_ = contentType
			switch method + " " + path {
			case "GET /v0/management/oauth-model-alias":
				return []byte(`{"oauth-model-alias":{"codex":[{"name":"old","alias":"old-alias"}]}}`), 200, nil
			case "PUT /v0/management/oauth-model-alias":
				data, _ := io.ReadAll(body)
				if err := json.Unmarshal(data, &putPayload); err != nil {
					t.Fatalf("invalid put payload: %v", err)
				}
				return []byte(`{}`), 200, nil
			default:
				t.Fatalf("unexpected request: %s %s", method, path)
				return nil, 404, nil
			}
		})
	}

	err := app.UpdateOAuthModelAliases(UpdateOAuthModelAliasesInput{
		Channel: "codex",
		Models:  []OpenAICompatibleModel{{Name: "gpt-5.4", Alias: "gpt-5.4"}},
	})
	if err != nil {
		t.Fatalf("UpdateOAuthModelAliases returned error: %v", err)
	}
	if _, ok := putPayload["codex"]; ok {
		t.Fatalf("expected codex channel to be deleted: %#v", putPayload)
	}
}
