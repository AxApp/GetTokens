package wailsapp

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
)

func TestChannelRoutingStorePathUsesProfileConfigDir(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("GETTOKENS_APP_PROFILE", "dev")

	path, err := channelRoutingStorePath()
	if err != nil {
		t.Fatalf("channelRoutingStorePath: %v", err)
	}

	want := filepath.Join(home, ".config", "gettokens-dev", "channel-routing", "config.json")
	if path != want {
		t.Fatalf("channelRoutingStorePath = %q, want %q", path, want)
	}
}

func TestNormalizeChannelRoutingConfigDropsLegacyRoutingFields(t *testing.T) {
	normalized, meta := normalizeChannelRoutingConfig(ChannelRoutingConfig{
		Channel:           "codex",
		RouteMode:         "weighted",
		OrderedAccountIDs: []string{" auth-file:a.json ", "auth-file:a.json", ""},
	}, "codex")

	if normalized.RouteMode != "sequential" {
		t.Fatalf("RouteMode = %q, want sequential", normalized.RouteMode)
	}
	if got := normalized.OrderedAccountIDs; len(got) != 1 || got[0] != "auth-file:a.json" {
		t.Fatalf("OrderedAccountIDs = %#v", got)
	}
	if got := meta.InvalidModes; len(got) != 1 || got[0] != "weighted" {
		t.Fatalf("InvalidModes = %#v", got)
	}
}

func TestChannelRoutingConfigStoreKeepsCodexAndClaudeIsolated(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	app := New("dev", "", "AxApp/GetTokens")
	if _, err := app.SaveChannelRoutingConfig(ChannelRoutingConfig{
		Channel:           "codex",
		RouteMode:         "balanced",
		OrderedAccountIDs: []string{"auth-file:codex.json"},
	}); err != nil {
		t.Fatalf("SaveChannelRoutingConfig codex: %v", err)
	}
	if _, err := app.SaveChannelRoutingConfig(ChannelRoutingConfig{
		Channel:           "claude",
		RouteMode:         "project",
		OrderedAccountIDs: []string{"openai-compatible:anthropic"},
	}); err != nil {
		t.Fatalf("SaveChannelRoutingConfig claude: %v", err)
	}

	codex, err := app.GetChannelRoutingConfig("codex")
	if err != nil {
		t.Fatalf("GetChannelRoutingConfig codex: %v", err)
	}
	claude, err := app.GetChannelRoutingConfig("claude")
	if err != nil {
		t.Fatalf("GetChannelRoutingConfig claude: %v", err)
	}

	if codex.RouteMode != "balanced" || len(codex.OrderedAccountIDs) != 1 || codex.OrderedAccountIDs[0] != "auth-file:codex.json" {
		t.Fatalf("unexpected codex config: %#v", codex)
	}
	if claude.RouteMode != "sequential" || len(claude.OrderedAccountIDs) != 1 || claude.OrderedAccountIDs[0] != "openai-compatible:anthropic" {
		t.Fatalf("unexpected claude config: %#v", claude)
	}
}

func TestExplainChannelRoutingSequentialFiltersDisabledAndUnsupportedAccounts(t *testing.T) {
	accounts := []accountsdomain.AccountRecord{
		{
			ID:               "auth-file:codex-a.json",
			DisplayName:      "Codex A",
			Status:           "active",
			Priority:         9,
			SupportedFormats: []string{"codex"},
		},
		{
			ID:               "auth-file:codex-b.json",
			DisplayName:      "Codex B",
			Status:           "active",
			Priority:         1,
			Disabled:         true,
			SupportedFormats: []string{"codex"},
		},
		{
			ID:               "openai-compatible:anthropic",
			DisplayName:      "Anthropic",
			Status:           "active",
			Priority:         0,
			SupportedFormats: []string{"anthropic"},
		},
	}

	result := explainChannelRoutingWithAccounts(accounts, ChannelRoutingConfig{
		Channel:           "codex",
		RouteMode:         "sequential",
		OrderedAccountIDs: []string{"auth-file:codex-b.json", "auth-file:codex-a.json"},
	}, ChannelRoutingExplainInput{})

	if result.SelectedAccountID != "auth-file:codex-a.json" {
		t.Fatalf("SelectedAccountID = %q", result.SelectedAccountID)
	}
	if len(result.Candidates) != 1 || result.Candidates[0].ID != "auth-file:codex-a.json" {
		t.Fatalf("Candidates = %#v", result.Candidates)
	}
	assertFilteredReason(t, result.Filtered, "auth-file:codex-b.json", "account-disabled")
	assertFilteredReason(t, result.Filtered, "openai-compatible:anthropic", "channel-unsupported")
}

func TestExplainChannelRoutingDropsLegacyProjectModeAndProjectBindings(t *testing.T) {
	accounts := []accountsdomain.AccountRecord{
		{ID: "auth-file:a.json", DisplayName: "A", Status: "active", Priority: 2, SupportedFormats: []string{"codex"}},
		{ID: "auth-file:b.json", DisplayName: "B", Status: "active", Priority: 1, SupportedFormats: []string{"codex"}},
		{ID: "auth-file:c.json", DisplayName: "C", Status: "active", Priority: 0, SupportedFormats: []string{"codex"}},
	}
	var cfg ChannelRoutingConfig
	if err := json.Unmarshal([]byte(`{
	  "channel": "codex",
	  "routeMode": "project",
	  "accountGroups": [
	    {"id":"paid","enabled":true,"routeOrder":0,"accountIDs":["auth-file:a.json","auth-file:b.json"]},
	    {"id":"free","enabled":true,"routeOrder":0,"accountIDs":["auth-file:c.json"]}
	  ],
	  "projectBindings": [
	    {"projectName":"GetTokens","targetType":"group","targetID":"paid","fallbackMode":"fail-closed"}
	  ]
	}`), &cfg); err != nil {
		t.Fatalf("unmarshal legacy config: %v", err)
	}

	result := explainChannelRoutingWithAccounts(accounts, cfg, ChannelRoutingExplainInput{})

	if result.RouteMode != "sequential" {
		t.Fatalf("RouteMode = %q, want sequential", result.RouteMode)
	}
	if result.SelectedAccountID != "auth-file:c.json" {
		t.Fatalf("SelectedAccountID = %q, want auth-file:c.json", result.SelectedAccountID)
	}
	for _, step := range result.Steps {
		if strings.HasPrefix(step, "project:") || strings.HasPrefix(step, "legacy:") {
			t.Fatalf("legacy/project step remained: %#v", result.Steps)
		}
	}
}

func TestExplainChannelRoutingBalancedUsesActiveSessionsThenSortOrder(t *testing.T) {
	accounts := []accountsdomain.AccountRecord{
		{ID: "auth-file:a.json", DisplayName: "A", Status: "active", Priority: 0, SupportedFormats: []string{"codex"}},
		{ID: "auth-file:b.json", DisplayName: "B", Status: "active", Priority: 0, SupportedFormats: []string{"codex"}},
	}

	result := explainChannelRoutingWithAccounts(accounts, ChannelRoutingConfig{
		Channel:           "codex",
		RouteMode:         "balanced",
		OrderedAccountIDs: []string{"auth-file:a.json", "auth-file:b.json"},
	}, ChannelRoutingExplainInput{
		ActiveSessions: map[string]int{
			"auth-file:a.json": 5,
			"auth-file:b.json": 1,
		},
	})

	if result.SelectedAccountID != "auth-file:b.json" {
		t.Fatalf("SelectedAccountID = %q, want auth-file:b.json", result.SelectedAccountID)
	}
	for _, step := range result.Steps {
		if strings.HasPrefix(step, "legacy:") {
			t.Fatalf("legacy step remained: %#v", result.Steps)
		}
	}
}

func TestExplainChannelRoutingDisabledStickyInvalidatesAndFallsBack(t *testing.T) {
	accounts := []accountsdomain.AccountRecord{
		{ID: "auth-file:sticky.json", DisplayName: "Sticky", Status: "active", Disabled: true, Priority: 0, SupportedFormats: []string{"codex"}},
		{ID: "auth-file:next.json", DisplayName: "Next", Status: "active", Priority: 1, SupportedFormats: []string{"codex"}},
	}

	result := explainChannelRoutingWithAccounts(accounts, ChannelRoutingConfig{
		Channel:           "codex",
		RouteMode:         "sequential",
		OrderedAccountIDs: []string{"auth-file:sticky.json", "auth-file:next.json"},
	}, ChannelRoutingExplainInput{StickyAccountID: "auth-file:sticky.json"})

	if result.SelectedAccountID != "auth-file:next.json" {
		t.Fatalf("SelectedAccountID = %q, want auth-file:next.json", result.SelectedAccountID)
	}
	assertFilteredReason(t, result.Filtered, "auth-file:sticky.json", "account-disabled")
	assertStepContains(t, result.Steps, "sticky:invalidated:account-disabled")
}

func TestExplainChannelRoutingActivationDoesNotPreemptExistingSticky(t *testing.T) {
	accounts := []accountsdomain.AccountRecord{
		{ID: "auth-file:reactivated.json", DisplayName: "Reactivated", Status: "active", Priority: 0, SupportedFormats: []string{"codex"}},
		{ID: "auth-file:current.json", DisplayName: "Current", Status: "active", Priority: 9, SupportedFormats: []string{"codex"}},
	}

	result := explainChannelRoutingWithAccounts(accounts, ChannelRoutingConfig{
		Channel:           "codex",
		RouteMode:         "sequential",
		OrderedAccountIDs: []string{"auth-file:reactivated.json", "auth-file:current.json"},
	}, ChannelRoutingExplainInput{StickyAccountID: "auth-file:current.json"})

	if result.SelectedAccountID != "auth-file:current.json" {
		t.Fatalf("SelectedAccountID = %q, want sticky current account", result.SelectedAccountID)
	}
	assertStepContains(t, result.Steps, "sticky:hit:auth-file:current.json")
}

func TestChannelRouteAccountResultPersistsCooldownAndExplainFiltersRuntimeState(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	app := New("dev", "", "AxApp/GetTokens")

	state, err := app.MarkChannelRouteAccountResult(ChannelRouteAccountResultInput{
		AccountID:       "auth-file:limited.json",
		StatusCode:      429,
		CooldownSeconds: 60,
		Reason:          "quota window exhausted",
	})
	if err != nil {
		t.Fatalf("MarkChannelRouteAccountResult: %v", err)
	}
	if _, ok := state.Sources["rate-limit"]; !ok {
		t.Fatalf("state missing rate-limit source: %#v", state)
	}

	store, err := loadChannelRoutingStore()
	if err != nil {
		t.Fatalf("loadChannelRoutingStore: %v", err)
	}
	if _, ok := store.RuntimeStates["auth-file:limited.json"].Sources["rate-limit"]; !ok {
		t.Fatalf("persisted runtime state missing rate-limit source: %#v", store.RuntimeStates)
	}

	accounts := []accountsdomain.AccountRecord{
		{ID: "auth-file:limited.json", DisplayName: "Limited", Status: "active", Priority: 0, SupportedFormats: []string{"codex"}},
		{ID: "auth-file:fallback.json", DisplayName: "Fallback", Status: "active", Priority: 1, SupportedFormats: []string{"codex"}},
	}
	result := explainChannelRoutingWithRuntime(accounts, ChannelRoutingConfig{
		Channel:           "codex",
		RouteMode:         "sequential",
		OrderedAccountIDs: []string{"auth-file:limited.json", "auth-file:fallback.json"},
	}, ChannelRoutingExplainInput{}, store.RuntimeStates)

	if result.SelectedAccountID != "auth-file:fallback.json" {
		t.Fatalf("SelectedAccountID = %q, want auth-file:fallback.json", result.SelectedAccountID)
	}
	assertFilteredReason(t, result.Filtered, "auth-file:limited.json", "runtime-rate-limit")
}

func TestExplainChannelRoutingShadowComputesDiffWithoutChangingProductionDecision(t *testing.T) {
	accounts := []accountsdomain.AccountRecord{
		{ID: "auth-file:a.json", DisplayName: "A", Status: "active", Priority: 0, SupportedFormats: []string{"codex"}},
		{ID: "auth-file:b.json", DisplayName: "B", Status: "active", Priority: 1, SupportedFormats: []string{"codex"}},
	}

	result := explainChannelRoutingWithAccounts(accounts, ChannelRoutingConfig{
		Channel:           "codex",
		RouteMode:         "sequential",
		ShadowEnabled:     true,
		ShadowRouteMode:   "balanced",
		OrderedAccountIDs: []string{"auth-file:a.json", "auth-file:b.json"},
	}, ChannelRoutingExplainInput{
		ActiveSessions: map[string]int{
			"auth-file:a.json": 8,
			"auth-file:b.json": 1,
		},
	})

	if result.SelectedAccountID != "auth-file:a.json" {
		t.Fatalf("SelectedAccountID = %q, want production sequential account", result.SelectedAccountID)
	}
	if result.Shadow == nil || !result.Shadow.Enabled {
		t.Fatalf("Shadow = %#v, want enabled shadow decision", result.Shadow)
	}
	if result.Shadow.RouteMode != "balanced" || result.Shadow.SelectedAccountID != "auth-file:b.json" || !result.Shadow.Diff {
		t.Fatalf("Shadow = %#v, want balanced diff to auth-file:b.json", result.Shadow)
	}
	if result.SnapshotVersion == "" || result.PolicyVersion != "channel-routing-v1" {
		t.Fatalf("versions missing: snapshot=%q policy=%q", result.SnapshotVersion, result.PolicyVersion)
	}
}

func TestChannelRouteEventLedgerStoresRedactedShadowSummary(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	result := ChannelRoutingExplainResult{
		Channel:           "codex",
		RouteMode:         "sequential",
		SelectedAccountID: "auth-file:a.json",
		Candidates:        []ChannelRoutingCandidate{{ID: "auth-file:a.json"}},
		Filtered:          []ChannelRoutingFilteredAccount{{ID: "auth-file:b.json", Reason: "account-disabled"}},
		SnapshotVersion:   "sha256:test",
		PolicyVersion:     "channel-routing-v1",
		Shadow: &ChannelRoutingShadowDecision{
			Enabled:           true,
			RouteMode:         "balanced",
			SelectedAccountID: "auth-file:c.json",
			Diff:              true,
		},
	}
	if err := appendChannelRouteEvent(ChannelRoutingExplainInput{Channel: "codex"}, result); err != nil {
		t.Fatalf("appendChannelRouteEvent: %v", err)
	}

	app := New("dev", "", "AxApp/GetTokens")
	events, err := app.ListChannelRouteEvents(ChannelRouteEventsInput{Channel: "codex", Limit: 10})
	if err != nil {
		t.Fatalf("ListChannelRouteEvents: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("events = %#v, want one event", events)
	}
	event := events[0]
	if !event.Redacted || !event.ShadowEnabled || !event.ShadowDiff {
		t.Fatalf("event redaction/shadow mismatch: %#v", event)
	}
	if event.CandidateCount != 1 || event.FilteredCount != 1 {
		t.Fatalf("event summary mismatch: %#v", event)
	}
	body, err := json.Marshal(event)
	if err != nil {
		t.Fatalf("marshal event: %v", err)
	}
	lower := strings.ToLower(string(body))
	for _, forbidden := range []string{"payload", "bearer", "access_token", "refresh_token", "id_token", "cookie", "api_key", "apikey"} {
		if strings.Contains(lower, forbidden) {
			t.Fatalf("event contains forbidden sensitive marker %q: %s", forbidden, lower)
		}
	}
}

func assertFilteredReason(t *testing.T, filtered []ChannelRoutingFilteredAccount, id string, reason string) {
	t.Helper()
	for _, item := range filtered {
		if item.ID == id {
			if item.Reason != reason {
				t.Fatalf("filtered %s reason = %q, want %q", id, item.Reason, reason)
			}
			return
		}
	}
	t.Fatalf("filtered reason for %s not found in %#v", id, filtered)
}

func assertStepContains(t *testing.T, steps []string, want string) {
	t.Helper()
	for _, step := range steps {
		if step == want {
			return
		}
	}
	t.Fatalf("step %q not found in %#v", want, steps)
}
