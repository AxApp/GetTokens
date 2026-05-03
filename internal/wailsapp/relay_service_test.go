package wailsapp

import "testing"

func TestNormalizeRelayAPIKeys(t *testing.T) {
	items := normalizeRelayAPIKeys([]string{"  relay-a  ", "", "relay-b", "relay-a", "  "})
	if len(items) != 2 {
		t.Fatalf("expected 2 api keys, got %d", len(items))
	}
	if items[0] != "relay-a" || items[1] != "relay-b" {
		t.Fatalf("unexpected api keys: %#v", items)
	}
}

func TestBuildRelayServiceEndpoints(t *testing.T) {
	endpoints := buildRelayServiceEndpoints(8317, "nolon-mac", []string{"192.168.1.12", "192.168.1.8", "192.168.1.12"})
	if len(endpoints) != 4 {
		t.Fatalf("expected 4 endpoints, got %d", len(endpoints))
	}

	if endpoints[0].Kind != "localhost" || endpoints[0].BaseURL != "http://127.0.0.1:8317/v1" {
		t.Fatalf("unexpected localhost endpoint: %#v", endpoints[0])
	}
	if endpoints[1].Kind != "hostname" || endpoints[1].Host != "nolon-mac" {
		t.Fatalf("unexpected hostname endpoint: %#v", endpoints[1])
	}
	if endpoints[2].Host != "192.168.1.12" && endpoints[2].Host != "192.168.1.8" {
		t.Fatalf("unexpected lan endpoint: %#v", endpoints[2])
	}
	if endpoints[3].Host != "192.168.1.12" && endpoints[3].Host != "192.168.1.8" {
		t.Fatalf("unexpected lan endpoint: %#v", endpoints[3])
	}
}
