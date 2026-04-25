package cliproxyapi

import (
	"io"
	"net/url"
	"strings"
	"testing"
)

func TestListAPIKeys(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		if method != "GET" {
			t.Fatalf("expected GET, got %s", method)
		}
		if path != "/v0/management/api-keys" {
			t.Fatalf("unexpected path: %s", path)
		}
		return []byte(`{"api-keys":["relay-a","relay-b"]}`), 200, nil
	})

	items, err := client.ListAPIKeys()
	if err != nil {
		t.Fatalf("ListAPIKeys returned error: %v", err)
	}
	if len(items) != 2 || items[0] != "relay-a" || items[1] != "relay-b" {
		t.Fatalf("unexpected api keys: %#v", items)
	}
}

func TestPutAPIKeys(t *testing.T) {
	client := New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
		if method != "PUT" {
			t.Fatalf("expected PUT, got %s", method)
		}
		if path != "/v0/management/api-keys" {
			t.Fatalf("unexpected path: %s", path)
		}
		if contentType != "application/json" {
			t.Fatalf("unexpected content type: %s", contentType)
		}

		payload, err := io.ReadAll(body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		if strings.TrimSpace(string(payload)) != `["relay-updated"]` {
			t.Fatalf("unexpected payload: %s", payload)
		}
		return nil, 200, nil
	})

	if err := client.PutAPIKeys([]string{"relay-updated"}); err != nil {
		t.Fatalf("PutAPIKeys returned error: %v", err)
	}
}
