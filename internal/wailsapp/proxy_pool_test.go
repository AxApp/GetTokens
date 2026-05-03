package wailsapp

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestProbeProxyNodeUsesHTTPProxy(t *testing.T) {
	target := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusNoContent)
		_, _ = writer.Write([]byte("ok"))
	}))
	defer target.Close()

	proxyRequests := 0
	proxyServer := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		proxyRequests++
		outbound, err := http.NewRequestWithContext(request.Context(), request.Method, request.URL.String(), nil)
		if err != nil {
			t.Fatalf("new outbound request: %v", err)
		}
		outbound.Header = request.Header.Clone()
		response, err := http.DefaultTransport.RoundTrip(outbound)
		if err != nil {
			t.Fatalf("proxy round trip: %v", err)
		}
		defer response.Body.Close()

		for key, values := range response.Header {
			for _, value := range values {
				writer.Header().Add(key, value)
			}
		}
		writer.WriteHeader(response.StatusCode)
		_, _ = io.Copy(writer, response.Body)
	}))
	defer proxyServer.Close()

	app := &App{}
	result, err := app.ProbeProxyNode(ProbeProxyNodeInput{
		ProxyURL:  proxyServer.URL,
		TargetURL: target.URL,
	})
	if err != nil {
		t.Fatalf("ProbeProxyNode returned error: %v", err)
	}
	if !result.Success {
		t.Fatalf("expected success result, got %#v", result)
	}
	if result.StatusCode != http.StatusNoContent {
		t.Fatalf("unexpected status code: %d", result.StatusCode)
	}
	if proxyRequests == 0 {
		t.Fatal("expected request to pass through proxy server")
	}
}

func TestProbeProxyNodeRejectsUnsupportedScheme(t *testing.T) {
	app := &App{}
	_, err := app.ProbeProxyNode(ProbeProxyNodeInput{
		ProxyURL: "ftp://127.0.0.1:21",
	})
	if err == nil {
		t.Fatal("expected error for unsupported proxy scheme")
	}
}

func TestFetchProxySubscriptionDownloadsPlainTextList(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.Header().Set("Content-Type", "text/plain; charset=utf-8")
		_, _ = writer.Write([]byte("127.0.0.1:7897\n127.0.0.1:7898\n"))
	}))
	defer server.Close()

	app := &App{}
	result, err := app.FetchProxySubscription(FetchProxySubscriptionInput{
		URL:         server.URL + "/proxy.txt",
		SourceLabel: "本地测试源",
	})
	if err != nil {
		t.Fatalf("FetchProxySubscription returned error: %v", err)
	}
	if result.URL != server.URL+"/proxy.txt" {
		t.Fatalf("unexpected subscription url: %s", result.URL)
	}
	if result.SourceLabel != "本地测试源" {
		t.Fatalf("unexpected source label: %s", result.SourceLabel)
	}
	if result.Content == "" {
		t.Fatal("expected plain text content")
	}
}

func TestFetchProxySubscriptionRejectsUnsupportedScheme(t *testing.T) {
	app := &App{}
	_, err := app.FetchProxySubscription(FetchProxySubscriptionInput{
		URL: "ftp://example.com/proxy.txt",
	})
	if err == nil {
		t.Fatal("expected error for unsupported subscription scheme")
	}
}
