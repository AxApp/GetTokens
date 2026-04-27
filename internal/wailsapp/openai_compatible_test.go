package wailsapp

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
)

func TestVerifyOpenAICompatibleProviderRequiresModel(t *testing.T) {
	app := &App{}

	_, err := app.VerifyOpenAICompatibleProvider(VerifyOpenAICompatibleProviderInput{
		BaseURL: "https://api.deepseek.com/v1",
		APIKey:  "sk-test",
	})
	if err == nil {
		t.Fatal("expected error when model is missing")
	}
	if !strings.Contains(err.Error(), "model") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestVerifyOpenAICompatibleProviderBuildsChatCompletionsRequest(t *testing.T) {
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method != http.MethodPost {
				t.Fatalf("expected POST, got %s", method)
			}
			if path != ManagementAPIPrefix+"/api-call" {
				t.Fatalf("unexpected path: %s", path)
			}
			if contentType != "application/json" {
				t.Fatalf("unexpected content type: %s", contentType)
			}

			payload, err := io.ReadAll(body)
			if err != nil {
				t.Fatalf("read body: %v", err)
			}

			var request managementAPICallRequest
			if err := json.Unmarshal(payload, &request); err != nil {
				t.Fatalf("unmarshal request: %v", err)
			}
			if request.Method != http.MethodPost {
				t.Fatalf("unexpected request method: %s", request.Method)
			}
			if request.URL != "https://api.deepseek.com/v1/chat/completions" {
				t.Fatalf("unexpected request url: %s", request.URL)
			}
			if request.Header["Authorization"] != "Bearer sk-test" {
				t.Fatalf("unexpected authorization header: %#v", request.Header)
			}
			if request.Header["X-Test"] != "abc" {
				t.Fatalf("unexpected custom header: %#v", request.Header)
			}

			var data map[string]any
			if err := json.Unmarshal([]byte(request.Data), &data); err != nil {
				t.Fatalf("unmarshal data: %v", err)
			}
			if data["model"] != "deepseek-chat" {
				t.Fatalf("unexpected model: %#v", data["model"])
			}

			return []byte(`{"status_code":200,"body":"{\"id\":\"chatcmpl-1\"}"}`), 200, nil
		},
	}

	result, err := app.VerifyOpenAICompatibleProvider(VerifyOpenAICompatibleProviderInput{
		BaseURL: "https://api.deepseek.com/v1",
		APIKey:  "sk-test",
		Model:   "deepseek-chat",
		Headers: map[string]string{
			"X-Test": "abc",
		},
	})
	if err != nil {
		t.Fatalf("VerifyOpenAICompatibleProvider returned error: %v", err)
	}
	if !result.Success {
		t.Fatalf("expected verify success, got %#v", result)
	}
	if result.StatusCode != 200 {
		t.Fatalf("unexpected status code: %d", result.StatusCode)
	}
	if result.Message == "" {
		t.Fatalf("expected success message, got %#v", result)
	}
}
