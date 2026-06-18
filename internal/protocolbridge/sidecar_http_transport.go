package protocolbridge

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

type SidecarHTTPTransportOption func(*sidecarHTTPTransportConfig)

type sidecarHTTPTransportConfig struct {
	client      *http.Client
	timeout     time.Duration
	bearerToken string
}

type realSidecarHTTPTransport struct {
	baseURL     *url.URL
	client      *http.Client
	bearerToken string
}

func NewSidecarHTTPTransport(baseURL string, options ...SidecarHTTPTransportOption) (SidecarTransport, error) {
	parsedBaseURL, err := parseSidecarHTTPBaseURL(baseURL)
	if err != nil {
		return nil, err
	}

	config := sidecarHTTPTransportConfig{}
	for _, option := range options {
		if option != nil {
			option(&config)
		}
	}

	return newRealSidecarHTTPTransport(parsedBaseURL, config)
}

func newRealSidecarHTTPTransport(baseURL *url.URL, config sidecarHTTPTransportConfig) (SidecarTransport, error) {
	if baseURL == nil {
		return nil, fmt.Errorf("sidecar HTTP transport: base URL is required")
	}

	client := cloneHTTPClient(config.client)
	if client == nil {
		client = &http.Client{}
	}
	if config.timeout > 0 {
		client.Timeout = config.timeout
	}
	// Do not follow redirects; the transport is pinned to one explicit endpoint boundary.
	client.CheckRedirect = func(_ *http.Request, _ []*http.Request) error {
		return http.ErrUseLastResponse
	}

	normalizedBaseURL := *baseURL

	return &realSidecarHTTPTransport{
		baseURL:     &normalizedBaseURL,
		client:      client,
		bearerToken: strings.TrimSpace(config.bearerToken),
	}, nil
}

func WithSidecarHTTPClient(client *http.Client) SidecarHTTPTransportOption {
	return func(config *sidecarHTTPTransportConfig) {
		if config == nil || client == nil {
			return
		}
		config.client = client
	}
}

func WithSidecarHTTPTimeout(timeout time.Duration) SidecarHTTPTransportOption {
	return func(config *sidecarHTTPTransportConfig) {
		if config == nil || timeout <= 0 {
			return
		}
		config.timeout = timeout
	}
}

func WithSidecarHTTPBearerToken(token string) SidecarHTTPTransportOption {
	return func(config *sidecarHTTPTransportConfig) {
		if config == nil {
			return
		}
		config.bearerToken = strings.TrimSpace(token)
	}
}

func (t *realSidecarHTTPTransport) RoundTrip(ctx context.Context, req SidecarHTTPRequest) (SidecarHTTPResponse, error) {
	if t == nil || t.baseURL == nil || t.client == nil {
		return SidecarHTTPResponse{}, fmt.Errorf("sidecar HTTP transport is not configured")
	}
	if ctx == nil {
		ctx = context.Background()
	}

	endpoint, err := t.resolveEndpoint(req.Path)
	if err != nil {
		return SidecarHTTPResponse{}, err
	}
	method := strings.TrimSpace(req.Method)
	if method == "" {
		method = http.MethodPost
	}
	httpReq, err := http.NewRequestWithContext(ctx, method, endpoint.String(), bytes.NewReader(req.Body))
	if err != nil {
		return SidecarHTTPResponse{}, fmt.Errorf("sidecar HTTP transport: build request: %w", err)
	}
	for name, value := range req.Headers {
		normalized := http.CanonicalHeaderKey(strings.TrimSpace(name))
		if normalized == "" {
			continue
		}
		if forbiddenSidecarHTTPHeader(normalized) {
			return SidecarHTTPResponse{}, fmt.Errorf("sidecar HTTP transport: forbidden header %q", normalized)
		}
		httpReq.Header.Set(normalized, value)
	}
	if httpReq.Header.Get("Accept") == "" {
		httpReq.Header.Set("Accept", "application/json")
	}
	if t.bearerToken != "" {
		httpReq.Header.Set("Authorization", "Bearer "+t.bearerToken)
	}

	resp, err := t.client.Do(httpReq)
	if err != nil {
		return SidecarHTTPResponse{}, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return SidecarHTTPResponse{}, fmt.Errorf("sidecar HTTP transport: read response body: %w", err)
	}
	return SidecarHTTPResponse{
		StatusCode: resp.StatusCode,
		Body:       body,
	}, nil
}

func (t *realSidecarHTTPTransport) resolveEndpoint(requestPath string) (*url.URL, error) {
	requestPath = strings.TrimSpace(requestPath)
	if requestPath == "" {
		return nil, fmt.Errorf("sidecar HTTP transport: request path is required")
	}
	parsedPath, err := url.Parse(requestPath)
	if err != nil {
		return nil, fmt.Errorf("sidecar HTTP transport: invalid request path: %w", err)
	}
	if parsedPath.IsAbs() || parsedPath.Host != "" || parsedPath.RawQuery != "" || parsedPath.Fragment != "" {
		return nil, fmt.Errorf("sidecar HTTP transport: request path must be relative to configured base URL")
	}
	if !strings.HasPrefix(parsedPath.Path, "/") {
		return nil, fmt.Errorf("sidecar HTTP transport: request path must start with '/'")
	}

	endpoint := *t.baseURL
	endpoint.Path = joinURLPath(endpoint.Path, parsedPath.Path)
	endpoint.RawPath = ""
	endpoint.RawQuery = ""
	endpoint.Fragment = ""
	return &endpoint, nil
}

func parseSidecarHTTPBaseURL(raw string) (*url.URL, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, fmt.Errorf("sidecar HTTP transport: base URL is required")
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("sidecar HTTP transport: parse base URL: %w", err)
	}
	if !parsed.IsAbs() {
		return nil, fmt.Errorf("sidecar HTTP transport: base URL must be absolute")
	}
	if parsed.User != nil {
		return nil, fmt.Errorf("sidecar HTTP transport: base URL must not contain userinfo")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return nil, fmt.Errorf("sidecar HTTP transport: base URL must not contain query or fragment")
	}
	switch strings.ToLower(parsed.Scheme) {
	case "http", "https":
	default:
		return nil, fmt.Errorf("sidecar HTTP transport: base URL scheme must be http or https")
	}
	host := strings.TrimSpace(parsed.Hostname())
	if host == "" {
		return nil, fmt.Errorf("sidecar HTTP transport: base URL host is required")
	}
	if !isLoopbackHost(host) {
		return nil, fmt.Errorf("sidecar HTTP transport: base URL host must be loopback or localhost")
	}
	normalized := *parsed
	normalized.Path = strings.TrimRight(normalized.Path, "/")
	normalized.RawPath = ""
	return &normalized, nil
}

func isLoopbackHost(host string) bool {
	if strings.EqualFold(strings.TrimSpace(host), "localhost") {
		return true
	}
	ip := net.ParseIP(strings.TrimSpace(host))
	return ip != nil && ip.IsLoopback()
}

func joinURLPath(basePath, requestPath string) string {
	if strings.TrimSpace(basePath) == "" {
		return requestPath
	}
	return path.Clean(strings.TrimRight(basePath, "/") + "/" + strings.TrimLeft(requestPath, "/"))
}

func forbiddenSidecarHTTPHeader(name string) bool {
	switch http.CanonicalHeaderKey(strings.TrimSpace(name)) {
	case "Authorization", "Cookie", "Idempotency-Key", "X-Gettokens-Bridge-Idempotency-Key":
		return true
	default:
		return false
	}
}

func cloneHTTPClient(client *http.Client) *http.Client {
	if client == nil {
		return nil
	}
	cloned := *client
	return &cloned
}
