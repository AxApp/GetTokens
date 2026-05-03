package wailsapp

import (
	"strings"
	"testing"
)

func TestParseRelayRoutingConfigAppliesDefaults(t *testing.T) {
	body := []byte(`{
	  "request-retry": 3,
	  "max-retry-credentials": 0,
	  "max-retry-interval": 30,
	  "routing": {
	    "strategy": "",
	    "session-affinity": true,
	    "session-affinity-ttl": ""
	  },
	  "quota-exceeded": {
	    "switch-project": true,
	    "switch-preview-model": false,
	    "antigravity-credits": true
	  }
	}`)

	config, err := parseRelayRoutingConfig(body)
	if err != nil {
		t.Fatalf("parseRelayRoutingConfig returned error: %v", err)
	}

	if config.Strategy != "round-robin" {
		t.Fatalf("unexpected strategy: %q", config.Strategy)
	}
	if !config.SessionAffinity {
		t.Fatal("expected session affinity to be true")
	}
	if config.SessionAffinityTTL != "1h" {
		t.Fatalf("unexpected session affinity ttl: %q", config.SessionAffinityTTL)
	}
	if config.RequestRetry != 3 || config.MaxRetryCredentials != 0 || config.MaxRetryInterval != 30 {
		t.Fatalf("unexpected retry config: %#v", config)
	}
	if !config.SwitchProject || config.SwitchPreviewModel || !config.AntigravityCredits {
		t.Fatalf("unexpected quota switches: %#v", config)
	}
}

func TestUpdateRelayRoutingConfigYAMLPreservesShapeAndNormalizesValues(t *testing.T) {
	original := []byte(`server:
  port: 8080
routing:
  strategy: round-robin
  session-affinity: false
quota-exceeded:
  switch-project: false
`)

	input := RelayRoutingConfig{
		Strategy:            " fill-first ",
		SessionAffinity:     true,
		SessionAffinityTTL:  " 30m ",
		RequestRetry:        -1,
		MaxRetryCredentials: -2,
		MaxRetryInterval:    -3,
		SwitchProject:       true,
		SwitchPreviewModel:  false,
		AntigravityCredits:  true,
	}

	nextYAML, err := updateRelayRoutingConfigYAML(original, input)
	if err != nil {
		t.Fatalf("updateRelayRoutingConfigYAML returned error: %v", err)
	}

	output := string(nextYAML)

	for _, fragment := range []string{
		"server:",
		"port: 8080",
		"strategy: fill-first",
		"session-affinity: true",
		"session-affinity-ttl: 30m",
		"request-retry: 0",
		"max-retry-credentials: 0",
		"max-retry-interval: 0",
		"switch-project: true",
		"switch-preview-model: false",
		"antigravity-credits: true",
	} {
		if !strings.Contains(output, fragment) {
			t.Fatalf("updated yaml should contain %q, got:\n%s", fragment, output)
		}
	}
}
