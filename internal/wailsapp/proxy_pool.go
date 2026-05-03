package wailsapp

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"golang.org/x/net/proxy"
)

const defaultProxyProbeTargetURL = "https://example.com"

type ProbeProxyNodeInput struct {
	ProxyURL  string `json:"proxyUrl"`
	TargetURL string `json:"targetUrl,omitempty"`
}

type ProbeProxyNodeResult struct {
	ProxyURL   string `json:"proxyUrl"`
	TargetURL  string `json:"targetUrl"`
	Success    bool   `json:"success"`
	StatusCode int    `json:"statusCode,omitempty"`
	LatencyMs  int    `json:"latencyMs"`
	CheckedAt  string `json:"checkedAt"`
	Message    string `json:"message"`
}

type FetchProxySubscriptionInput struct {
	URL         string `json:"url"`
	SourceLabel string `json:"sourceLabel,omitempty"`
}

type FetchProxySubscriptionResult struct {
	URL         string `json:"url"`
	SourceLabel string `json:"sourceLabel"`
	Content     string `json:"content"`
}

func (a *App) ProbeProxyNode(input ProbeProxyNodeInput) (*ProbeProxyNodeResult, error) {
	proxyURL := strings.TrimSpace(input.ProxyURL)
	if proxyURL == "" {
		return nil, errors.New("proxy url 不能为空")
	}

	targetURL := strings.TrimSpace(input.TargetURL)
	if targetURL == "" {
		targetURL = defaultProxyProbeTargetURL
	}

	transport, err := buildProxyProbeTransport(proxyURL)
	if err != nil {
		return nil, err
	}
	defer transport.CloseIdleConnections()

	ctx, cancel := context.WithTimeout(context.Background(), 12*time.Second)
	defer cancel()

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("User-Agent", "GetTokens-ProxyPoolProbe/1.0")

	client := &http.Client{
		Transport: transport,
		Timeout:   12 * time.Second,
	}

	startedAt := time.Now()
	response, err := client.Do(request)
	latencyMs := int(time.Since(startedAt).Milliseconds())
	checkedAt := time.Now().Format("2006-01-02 15:04")

	if err != nil {
		return &ProbeProxyNodeResult{
			ProxyURL:  proxyURL,
			TargetURL: targetURL,
			Success:   false,
			LatencyMs: latencyMs,
			CheckedAt: checkedAt,
			Message:   fmt.Sprintf("检测失败：%s", err.Error()),
		}, nil
	}
	defer response.Body.Close()

	success := response.StatusCode >= 200 && response.StatusCode < 400
	message := fmt.Sprintf("检测成功：%d", response.StatusCode)
	if !success {
		message = fmt.Sprintf("检测失败：%d", response.StatusCode)
	}

	return &ProbeProxyNodeResult{
		ProxyURL:   proxyURL,
		TargetURL:  targetURL,
		Success:    success,
		StatusCode: response.StatusCode,
		LatencyMs:  latencyMs,
		CheckedAt:  checkedAt,
		Message:    message,
	}, nil
}

func (a *App) FetchProxySubscription(input FetchProxySubscriptionInput) (*FetchProxySubscriptionResult, error) {
	subscriptionURL := strings.TrimSpace(input.URL)
	if subscriptionURL == "" {
		return nil, errors.New("订阅链接不能为空")
	}

	parsed, err := url.Parse(subscriptionURL)
	if err != nil || parsed.Host == "" {
		return nil, errors.New("订阅链接不合法")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return nil, errors.New("订阅链接仅支持 http/https")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, subscriptionURL, nil)
	if err != nil {
		return nil, err
	}
	request.Header.Set("User-Agent", "GetTokens-ProxyPoolSubscription/1.0")

	client := &http.Client{Timeout: 15 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("拉取订阅失败：%w", err)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("拉取订阅失败：HTTP %d", response.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(response.Body, 2<<20))
	if err != nil {
		return nil, fmt.Errorf("读取订阅内容失败：%w", err)
	}

	return &FetchProxySubscriptionResult{
		URL:         subscriptionURL,
		SourceLabel: strings.TrimSpace(input.SourceLabel),
		Content:     string(body),
	}, nil
}

func buildProxyProbeTransport(raw string) (*http.Transport, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return nil, errors.New("proxy url 不合法")
	}

	switch strings.ToLower(parsed.Scheme) {
	case "http", "https":
		transport := http.DefaultTransport.(*http.Transport).Clone()
		transport.Proxy = http.ProxyURL(parsed)
		return transport, nil
	case "socks5", "socks5h":
		baseDialer := &net.Dialer{Timeout: 10 * time.Second}
		socksDialer, errDialer := proxy.FromURL(parsed, baseDialer)
		if errDialer != nil {
			return nil, errors.New("socks5 proxy url 不合法")
		}

		transport := http.DefaultTransport.(*http.Transport).Clone()
		transport.Proxy = nil
		transport.DialContext = func(ctx context.Context, network string, address string) (net.Conn, error) {
			type dialResult struct {
				conn net.Conn
				err  error
			}

			resultCh := make(chan dialResult, 1)
			go func() {
				conn, errDial := socksDialer.Dial(network, address)
				resultCh <- dialResult{conn: conn, err: errDial}
			}()

			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case result := <-resultCh:
				return result.conn, result.err
			}
		}
		return transport, nil
	default:
		return nil, errors.New("仅支持 http/https/socks5/socks5h 代理")
	}
}
