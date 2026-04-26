package wailsapp

import (
	"io"
	"net/url"
	"testing"
)

func TestGetUsageStatistics(t *testing.T) {
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method != "GET" {
				t.Fatalf("unexpected method: %s", method)
			}
			if path != ManagementAPIPrefix+"/usage" {
				t.Fatalf("unexpected path: %s", path)
			}
			if query != nil {
				t.Fatalf("unexpected query: %#v", query)
			}
			if body != nil {
				t.Fatal("expected nil body")
			}
			if contentType != "" {
				t.Fatalf("unexpected content type: %s", contentType)
			}
			return []byte(`{"usage":{"total_requests":3,"apis":{"codex":{"models":{"gpt-5":{"details":[]}}}},"failure_count":1},"failed_requests":1}`), 200, nil
		},
	}

	result, err := app.GetUsageStatistics()
	if err != nil {
		t.Fatalf("GetUsageStatistics returned error: %v", err)
	}
	if result.FailedRequests != 1 {
		t.Fatalf("failed requests = %d, want 1", result.FailedRequests)
	}
	if got := result.Usage["total_requests"]; got != float64(3) {
		t.Fatalf("unexpected total_requests: %#v", got)
	}
	if _, ok := result.Usage["apis"]; !ok {
		t.Fatal("expected apis map in usage payload")
	}
}
