package wailsapp

import "testing"

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
