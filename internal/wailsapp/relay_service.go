package wailsapp

import (
	"errors"
	"fmt"
	"net"
	"os"
	"slices"
	"strings"

	"github.com/linhay/gettokens/internal/sidecar"
)

type RelayServiceEndpoint struct {
	ID      string `json:"id"`
	Kind    string `json:"kind"`
	Host    string `json:"host"`
	BaseURL string `json:"baseUrl"`
}

type RelayServiceConfig struct {
	APIKeys   []string               `json:"apiKeys"`
	Endpoints []RelayServiceEndpoint `json:"endpoints"`
}

func (a *App) GetRelayServiceConfig() (*RelayServiceConfig, error) {
	status := a.sidecar.CurrentStatus()
	if status.Code != sidecar.StatusReady || status.Port <= 0 {
		return nil, errors.New("后端未就绪")
	}

	apiKeys := normalizeRelayAPIKeys(nil)
	if items, err := a.managementClient().ListAPIKeys(); err == nil {
		apiKeys = normalizeRelayAPIKeys(items)
	}
	if len(apiKeys) == 0 {
		fallback := strings.TrimSpace(a.sidecar.CurrentServiceAPIKey())
		if fallback != "" {
			apiKeys = []string{fallback}
		}
	}
	if len(apiKeys) == 0 {
		return nil, errors.New("中转服务 API KEY 未配置")
	}

	a.sidecar.SetCurrentServiceAPIKey(apiKeys[0])

	return &RelayServiceConfig{
		APIKeys:   apiKeys,
		Endpoints: buildRelayServiceEndpoints(status.Port, relayServiceHostname(), relayServiceLANHosts()),
	}, nil
}

func (a *App) UpdateRelayServiceAPIKey(apiKey string) (*RelayServiceConfig, error) {
	return a.UpdateRelayServiceAPIKeys([]string{apiKey})
}

func (a *App) UpdateRelayServiceAPIKeys(apiKeys []string) (*RelayServiceConfig, error) {
	status := a.sidecar.CurrentStatus()
	if status.Code != sidecar.StatusReady || status.Port <= 0 {
		return nil, errors.New("后端未就绪")
	}

	normalized := normalizeRelayAPIKeys(apiKeys)
	if len(normalized) == 0 {
		return nil, errors.New("至少保留一个 API KEY")
	}

	if err := a.managementClient().PutAPIKeys(normalized); err != nil {
		return nil, err
	}
	a.sidecar.SetCurrentServiceAPIKey(normalized[0])

	return &RelayServiceConfig{
		APIKeys:   normalized,
		Endpoints: buildRelayServiceEndpoints(status.Port, relayServiceHostname(), relayServiceLANHosts()),
	}, nil
}

func normalizeRelayAPIKeys(items []string) []string {
	if len(items) == 0 {
		return nil
	}

	normalized := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		trimmed := strings.TrimSpace(item)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	return normalized
}

func buildRelayServiceEndpoints(port int, hostname string, lanHosts []string) []RelayServiceEndpoint {
	endpoints := []RelayServiceEndpoint{
		{
			ID:      "localhost",
			Kind:    "localhost",
			Host:    "127.0.0.1",
			BaseURL: fmt.Sprintf("http://127.0.0.1:%d/v1", port),
		},
	}

	if host := strings.TrimSpace(hostname); host != "" && !strings.EqualFold(host, "localhost") && host != "127.0.0.1" {
		endpoints = append(endpoints, RelayServiceEndpoint{
			ID:      "hostname",
			Kind:    "hostname",
			Host:    host,
			BaseURL: fmt.Sprintf("http://%s:%d/v1", host, port),
		})
	}

	for index, host := range normalizeRelayHosts(lanHosts) {
		endpoints = append(endpoints, RelayServiceEndpoint{
			ID:      fmt.Sprintf("lan-%d", index+1),
			Kind:    "lan",
			Host:    host,
			BaseURL: fmt.Sprintf("http://%s:%d/v1", host, port),
		})
	}

	return endpoints
}

func relayServiceHostname() string {
	hostname, err := os.Hostname()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(hostname)
}

func relayServiceLANHosts() []string {
	interfaces, err := net.Interfaces()
	if err != nil {
		return nil
	}

	hosts := make([]string, 0, len(interfaces))
	for _, iface := range interfaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok || ipNet == nil {
				continue
			}
			ip := ipNet.IP.To4()
			if ip == nil || !ip.IsPrivate() {
				continue
			}
			hosts = append(hosts, ip.String())
		}
	}

	return normalizeRelayHosts(hosts)
}

func normalizeRelayHosts(hosts []string) []string {
	if len(hosts) == 0 {
		return nil
	}

	normalized := make([]string, 0, len(hosts))
	seen := make(map[string]struct{}, len(hosts))
	for _, host := range hosts {
		trimmed := strings.TrimSpace(host)
		if trimmed == "" || trimmed == "127.0.0.1" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		normalized = append(normalized, trimmed)
	}
	slices.Sort(normalized)
	return normalized
}
