package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGitHubRepoUsesPublishedReleaseRepository(t *testing.T) {
	if GitHubRepo != "AxApp/GetTokens" {
		t.Fatalf("GitHubRepo = %q, want %q", GitHubRepo, "AxApp/GetTokens")
	}
}

func TestFetchVendorStatusRSSReturnsBody(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Accept"); !strings.Contains(got, "application/rss+xml") {
			t.Fatalf("Accept header = %q, want rss accept header", got)
		}
		if got := r.Header.Get("User-Agent"); got != "GetTokens Vendor Status/1.0" {
			t.Fatalf("User-Agent = %q, want %q", got, "GetTokens Vendor Status/1.0")
		}

		w.Header().Set("Content-Type", "application/rss+xml")
		_, _ = w.Write([]byte("<rss><channel><title>OpenAI status</title></channel></rss>"))
	}))
	defer server.Close()

	body, err := (&App{}).FetchVendorStatusRSS(server.URL)
	if err != nil {
		t.Fatalf("FetchVendorStatusRSS returned error: %v", err)
	}

	if body != "<rss><channel><title>OpenAI status</title></channel></rss>" {
		t.Fatalf("FetchVendorStatusRSS body = %q", body)
	}
}

func TestFetchVendorStatusRSSErrorOnNon2xx(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "upstream unavailable", http.StatusBadGateway)
	}))
	defer server.Close()

	_, err := (&App{}).FetchVendorStatusRSS(server.URL)
	if err == nil {
		t.Fatal("FetchVendorStatusRSS error = nil, want non-nil")
	}
	if !strings.Contains(err.Error(), "vendor status rss returned 502") {
		t.Fatalf("FetchVendorStatusRSS error = %q, want status code message", err.Error())
	}
}
