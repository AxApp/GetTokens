package wailsapp

import (
	"encoding/json"
	"io"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/cliproxyapi"
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

func TestNormalizeChannelRoutingConfigKeepsManualRequestableAccountIDs(t *testing.T) {
	normalized, _ := normalizeChannelRoutingConfig(ChannelRoutingConfig{
		Channel:                     "codex",
		ManualRequestableAccountIDs: []string{" codex-api-key:manual ", "codex-api-key:manual", ""},
	}, "codex")

	if got := normalized.ManualRequestableAccountIDs; len(got) != 1 || got[0] != "codex-api-key:manual" {
		t.Fatalf("ManualRequestableAccountIDs = %#v", got)
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
	assertFilteredReason(t, result.Filtered, "openai-compatible:anthropic", "missing_format:openai_responses")
}

func TestExplainChannelRoutingRequestedModelFiltersDeclaredModelAccounts(t *testing.T) {
	accounts := []accountsdomain.AccountRecord{
		{
			ID:               "openai-compatible:deepseek",
			DisplayName:      "DeepSeek",
			Status:           "active",
			Priority:         1,
			SupportedFormats: []string{"codex"},
			Models:           []cliproxyapi.CodexModel{{Name: "deepseek-chat", Alias: "deepseek"}},
		},
		{
			ID:               "openai-compatible:openai",
			DisplayName:      "OpenAI",
			Status:           "active",
			Priority:         2,
			SupportedFormats: []string{"codex"},
			Models:           []cliproxyapi.CodexModel{{Name: "gpt-5.4"}},
		},
		{
			ID:               "auth-file:codex.json",
			DisplayName:      "OAuth",
			Status:           "active",
			Priority:         3,
			SupportedFormats: []string{"codex"},
		},
	}

	result := explainChannelRoutingWithAccounts(accounts, ChannelRoutingConfig{
		Channel:           "codex",
		RouteMode:         "sequential",
		OrderedAccountIDs: []string{"openai-compatible:deepseek", "openai-compatible:openai", "auth-file:codex.json"},
	}, ChannelRoutingExplainInput{RequestedModel: "deepseek"})

	if result.RequestedModel != "deepseek" {
		t.Fatalf("RequestedModel = %q, want deepseek", result.RequestedModel)
	}
	if got := len(result.Candidates); got != 2 {
		t.Fatalf("Candidates length = %d, want 2: %#v", got, result.Candidates)
	}
	if result.Candidates[0].ID != "openai-compatible:deepseek" || result.Candidates[1].ID != "auth-file:codex.json" {
		t.Fatalf("Candidates = %#v", result.Candidates)
	}
	assertFilteredReason(t, result.Filtered, "openai-compatible:openai", "runtime-model-unavailable")
	assertStepContains(t, result.Steps, "model:deepseek")
}

func TestExplainChannelRoutingIgnoresLegacyManualDisabledRuntimeState(t *testing.T) {
	accounts := []accountsdomain.AccountRecord{
		{
			ID:               "acct_codex_key",
			AccountKind:      accountsdomain.AccountKindCodexAPIKey,
			Provider:         "codex",
			CredentialSource: accountsdomain.CredentialSourceAPIKey,
			DisplayName:      "公司 1",
			Status:           "active",
			Priority:         1,
			SupportedFormats: []string{"codex"},
		},
	}

	result := explainChannelRoutingWithRuntime(accounts, ChannelRoutingConfig{
		Channel:           "codex",
		RouteMode:         "sequential",
		OrderedAccountIDs: []string{"acct_codex_key"},
	}, ChannelRoutingExplainInput{}, map[string]ChannelAccountRuntimeState{
		"acct_codex_key": {
			AccountID: "acct_codex_key",
			Sources: map[string]ChannelRuntimeStateSource{
				"manual-disabled": {
					Source:    "manual-disabled",
					Reason:    "account disabled",
					UpdatedAt: "2026-06-10T02:00:56Z",
				},
			},
		},
	})

	if result.SelectedAccountID != "acct_codex_key" {
		t.Fatalf("SelectedAccountID = %q, want acct_codex_key", result.SelectedAccountID)
	}
	if len(result.Candidates) != 1 || result.Candidates[0].ID != "acct_codex_key" {
		t.Fatalf("Candidates = %#v, want enabled account candidate", result.Candidates)
	}
	if _, ok := findChannelFilteredReason(result.Filtered, "acct_codex_key"); ok {
		t.Fatalf("enabled account was filtered by legacy manual-disabled: %#v", result.Filtered)
	}
}

func TestExplainChannelRoutingCodexRequiresResponsesFormat(t *testing.T) {
	accounts := []accountsdomain.AccountRecord{
		{
			ID:               "openai-compatible:chat-only",
			AccountKind:      accountsdomain.AccountKindOpenAICompatible,
			DisplayName:      "Chat Only",
			Status:           "active",
			SupportedFormats: []string{accountsdomain.APIFmtOpenAIChat},
		},
		{
			ID:               "openai-compatible:responses",
			AccountKind:      accountsdomain.AccountKindOpenAICompatible,
			DisplayName:      "Responses",
			Status:           "active",
			SupportedFormats: []string{accountsdomain.APIFmtOpenAIResponses},
		},
	}

	result := explainChannelRoutingWithAccounts(accounts, ChannelRoutingConfig{
		Channel:   "codex",
		RouteMode: "sequential",
	}, ChannelRoutingExplainInput{})

	if result.SelectedAccountID != "openai-compatible:responses" {
		t.Fatalf("SelectedAccountID = %q, want openai-compatible:responses", result.SelectedAccountID)
	}
	assertCandidateIDs(t, result.Candidates, []string{"openai-compatible:responses"})
	assertFilteredReason(t, result.Filtered, "openai-compatible:chat-only", "missing_format:openai_responses")
}

func TestSaveChannelRoutingStorePrunesManualDisabledRuntimeStates(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("GETTOKENS_APP_PROFILE", "dev")

	err := saveChannelRoutingStore(channelRoutingStore{
		Channels: map[string]ChannelRoutingConfig{
			"codex": defaultChannelRoutingConfig("codex"),
		},
		RuntimeStates: map[string]ChannelAccountRuntimeState{
			"acct_codex_key": {
				AccountID: "acct_codex_key",
				Sources: map[string]ChannelRuntimeStateSource{
					"manual-disabled": {
						Source: "manual-disabled",
						Reason: "account disabled",
					},
					"quota-empty": {
						Source: "quota-empty",
						Reason: "requests exhausted",
					},
				},
			},
			"acct_only_manual": {
				AccountID: "acct_only_manual",
				Sources: map[string]ChannelRuntimeStateSource{
					"manual-disabled": {
						Source: "manual-disabled",
						Reason: "account disabled",
					},
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("saveChannelRoutingStore: %v", err)
	}

	store, err := loadChannelRoutingStore()
	if err != nil {
		t.Fatalf("loadChannelRoutingStore: %v", err)
	}
	if _, ok := store.RuntimeStates["acct_only_manual"]; ok {
		t.Fatalf("manual-only runtime state should be pruned: %#v", store.RuntimeStates)
	}
	state := store.RuntimeStates["acct_codex_key"]
	if _, ok := state.Sources["manual-disabled"]; ok {
		t.Fatalf("manual-disabled source should be pruned: %#v", state.Sources)
	}
	if source := state.Sources["quota-empty"]; source.Source != "quota-empty" {
		t.Fatalf("quota-empty source = %#v, want preserved", source)
	}
}

func TestExplainChannelRoutingClaudeReportsMissingAnthropicFormat(t *testing.T) {
	accounts := []accountsdomain.AccountRecord{
		{
			ID:               "openai-compatible:responses",
			AccountKind:      accountsdomain.AccountKindOpenAICompatible,
			DisplayName:      "Responses",
			Status:           "active",
			SupportedFormats: []string{accountsdomain.APIFmtOpenAIResponses},
		},
	}

	result := explainChannelRoutingWithAccounts(accounts, ChannelRoutingConfig{
		Channel:   "claude",
		RouteMode: "sequential",
	}, ChannelRoutingExplainInput{})

	if result.SelectedAccountID != "" {
		t.Fatalf("SelectedAccountID = %q, want empty", result.SelectedAccountID)
	}
	assertFilteredReason(t, result.Filtered, "openai-compatible:responses", "missing_format:anthropic")
}

func TestExplainChannelRoutingSeparatesWaitingCheckFromManualRequestable(t *testing.T) {
	accounts := []accountsdomain.AccountRecord{
		{
			ID:               "codex-api-key:waiting",
			AccountKind:      accountsdomain.AccountKindCodexAPIKey,
			Provider:         "codex",
			CredentialSource: accountsdomain.CredentialSourceAPIKey,
			DisplayName:      "Waiting",
			Status:           "configured",
			Priority:         0,
			SupportedFormats: []string{"codex"},
		},
		{
			ID:               "codex-api-key:manual",
			AccountKind:      accountsdomain.AccountKindCodexAPIKey,
			Provider:         "codex",
			CredentialSource: accountsdomain.CredentialSourceAPIKey,
			DisplayName:      "Manual",
			Status:           "configured",
			Priority:         1,
			SupportedFormats: []string{"codex"},
		},
		{
			ID:               "auth-file:fallback.json",
			AccountKind:      accountsdomain.AccountKindAuthFile,
			Provider:         "codex",
			CredentialSource: accountsdomain.CredentialSourceAuthFile,
			DisplayName:      "Fallback",
			Status:           "active",
			Priority:         2,
			SupportedFormats: []string{"codex"},
		},
		{
			ID:               "openai-compatible:router",
			AccountKind:      accountsdomain.AccountKindOpenAICompatible,
			Provider:         "router",
			CredentialSource: accountsdomain.CredentialSourceAPIKey,
			DisplayName:      "Router",
			Status:           "configured",
			Priority:         3,
			SupportedFormats: []string{"codex"},
		},
	}

	result := explainChannelRoutingWithAccounts(accounts, ChannelRoutingConfig{
		Channel:           "codex",
		RouteMode:         "sequential",
		OrderedAccountIDs: []string{"codex-api-key:waiting", "codex-api-key:manual", "auth-file:fallback.json", "openai-compatible:router"},
	}, ChannelRoutingExplainInput{})

	if result.SelectedAccountID != "auth-file:fallback.json" {
		t.Fatalf("SelectedAccountID = %q, want auth-file:fallback.json", result.SelectedAccountID)
	}
	assertFilteredReason(t, result.Filtered, "codex-api-key:waiting", "waiting-check")
	assertFilteredReason(t, result.Filtered, "codex-api-key:manual", "waiting-check")
	assertCandidateIDs(t, result.Candidates, []string{"auth-file:fallback.json", "openai-compatible:router"})

	result = explainChannelRoutingWithAccounts(accounts, ChannelRoutingConfig{
		Channel:                     "codex",
		RouteMode:                   "sequential",
		OrderedAccountIDs:           []string{"codex-api-key:waiting", "codex-api-key:manual", "auth-file:fallback.json", "openai-compatible:router"},
		ManualRequestableAccountIDs: []string{"codex-api-key:manual"},
	}, ChannelRoutingExplainInput{})

	if result.SelectedAccountID != "codex-api-key:manual" {
		t.Fatalf("SelectedAccountID = %q, want codex-api-key:manual", result.SelectedAccountID)
	}
	assertFilteredReason(t, result.Filtered, "codex-api-key:waiting", "waiting-check")
	assertCandidateIDs(t, result.Candidates, []string{"codex-api-key:manual", "auth-file:fallback.json", "openai-compatible:router"})
}

func TestExplainChannelRoutingManualRequestableStillHonorsRuntimeBlocks(t *testing.T) {
	expiresAt := time.Now().UTC().Add(time.Hour).Format(time.RFC3339Nano)
	accounts := []accountsdomain.AccountRecord{
		{
			ID:               "codex-api-key:manual",
			AccountKind:      accountsdomain.AccountKindCodexAPIKey,
			Provider:         "codex",
			CredentialSource: accountsdomain.CredentialSourceAPIKey,
			DisplayName:      "Manual",
			Status:           "configured",
			Priority:         0,
			SupportedFormats: []string{"codex"},
		},
		{
			ID:               "auth-file:fallback.json",
			AccountKind:      accountsdomain.AccountKindAuthFile,
			Provider:         "codex",
			CredentialSource: accountsdomain.CredentialSourceAuthFile,
			DisplayName:      "Fallback",
			Status:           "active",
			Priority:         1,
			SupportedFormats: []string{"codex"},
		},
	}

	result := explainChannelRoutingWithRuntime(accounts, ChannelRoutingConfig{
		Channel:                     "codex",
		RouteMode:                   "sequential",
		OrderedAccountIDs:           []string{"codex-api-key:manual", "auth-file:fallback.json"},
		ManualRequestableAccountIDs: []string{"codex-api-key:manual"},
	}, ChannelRoutingExplainInput{}, map[string]ChannelAccountRuntimeState{
		"codex-api-key:manual": {
			AccountID: "codex-api-key:manual",
			Sources: map[string]ChannelRuntimeStateSource{
				"rate-limit": {
					Source:    "rate-limit",
					Reason:    "quota window exhausted",
					ExpiresAt: expiresAt,
				},
			},
		},
	})

	if result.SelectedAccountID != "auth-file:fallback.json" {
		t.Fatalf("SelectedAccountID = %q, want auth-file:fallback.json", result.SelectedAccountID)
	}
	assertFilteredReason(t, result.Filtered, "codex-api-key:manual", "runtime-rate-limit")
	assertCandidateIDs(t, result.Candidates, []string{"auth-file:fallback.json"})
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

func TestExplainChannelRoutingProjectCandidatePoolStrictAllowsAccounts(t *testing.T) {
	accounts := []accountsdomain.AccountRecord{
		{ID: "auth-file:a.json", DisplayName: "A", Status: "active", Priority: 0, SupportedFormats: []string{"codex"}},
		{ID: "auth-file:b.json", DisplayName: "B", Status: "active", Priority: 1, SupportedFormats: []string{"codex"}},
		{ID: "auth-file:c.json", DisplayName: "C", Status: "active", Priority: 2, SupportedFormats: []string{"codex"}},
	}

	result := explainChannelRoutingWithProjectCandidatePool(accounts, ChannelRoutingConfig{
		Channel:           "codex",
		RouteMode:         "sequential",
		OrderedAccountIDs: []string{"auth-file:a.json", "auth-file:b.json", "auth-file:c.json"},
	}, ChannelRoutingExplainInput{
		ProjectKey:           "workspace:abc",
		ProjectName:          "GetTokens",
		ProjectKeySource:     "codex-turn-workspace",
		ProjectKeyConfidence: "strong",
		ProjectMatchKeys:     []string{"workspace:abc"},
	}, nil, []ProjectCandidatePoolRule{{
		ID:              "rule-gettokens",
		Channel:         "codex",
		ProjectKey:      "workspace:abc",
		ProjectName:     "GetTokens",
		Enabled:         true,
		AllowAccountIDs: []string{"auth-file:b.json", "auth-file:a.json"},
	}})

	if result.SelectedAccountID != "auth-file:b.json" {
		t.Fatalf("SelectedAccountID = %q, want auth-file:b.json", result.SelectedAccountID)
	}
	assertCandidateIDs(t, result.Candidates, []string{"auth-file:b.json", "auth-file:a.json"})
	assertFilteredReason(t, result.Filtered, "auth-file:c.json", "project-candidate-pool")
	if result.ProjectCandidatePool == nil ||
		!result.ProjectCandidatePool.Evaluated ||
		!result.ProjectCandidatePool.Activated ||
		result.ProjectCandidatePool.Reason != "project-candidate-pool:matched" ||
		result.ProjectCandidatePool.RuleID != "rule-gettokens" ||
		result.ProjectCandidatePool.BeforeCandidateCount != 3 ||
		result.ProjectCandidatePool.AfterCandidateCount != 2 {
		t.Fatalf("project candidate pool explain = %#v", result.ProjectCandidatePool)
	}
	assertStepContains(t, result.Steps, "project-candidate-pool:matched")
}

func TestExplainChannelRoutingLoadsProjectCandidatePoolRulesFromManagementAPI(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch {
			case method == "GET" && path == ManagementAPIPrefix+"/accounts":
				return []byte(`{"accounts":[
					{"account_key":"auth-file:a.json","kind":"auth-file","title":"a.json","provider":"codex","credential_source":"sidecar-management-api","priority":0,"auth_file":{"source_file_name":"a.json","auth_type":"codex"}},
					{"account_key":"auth-file:b.json","kind":"auth-file","title":"b.json","provider":"codex","credential_source":"sidecar-management-api","priority":1,"auth_file":{"source_file_name":"b.json","auth_type":"codex"}},
					{"account_key":"auth-file:c.json","kind":"auth-file","title":"c.json","provider":"codex","credential_source":"sidecar-management-api","priority":2,"auth_file":{"source_file_name":"c.json","auth_type":"codex"}}
				]}`), 200, nil
			case method == "GET" && path == ManagementAPIPrefix+"/gettokens/project-candidate-pool-rules":
				if got := query.Get("channel"); got != "codex" {
					t.Fatalf("project rule channel = %q, want codex", got)
				}
				return []byte(`{"items":[{"id":"rule-workspace-abc","channel":"codex","projectKey":"workspace:abc","projectName":"GetTokens","projectKeySource":"codex-turn-workspace","projectKeyConfidence":"strong","enabled":true,"allowAccountIDs":["auth-file:b.json"]}]}`), 200, nil
			default:
				t.Fatalf("unexpected sidecar request: %s %s", method, path)
			}
			return nil, 404, nil
		},
	}
	if _, err := app.SaveChannelRoutingConfig(ChannelRoutingConfig{
		Channel:           "codex",
		RouteMode:         "sequential",
		OrderedAccountIDs: []string{"auth-file:a.json", "auth-file:b.json", "auth-file:c.json"},
	}); err != nil {
		t.Fatalf("SaveChannelRoutingConfig: %v", err)
	}

	result, err := app.ExplainChannelRouting(ChannelRoutingExplainInput{
		Channel:              "codex",
		ProjectKey:           "workspace:abc",
		ProjectName:          "GetTokens",
		ProjectKeySource:     "codex-turn-workspace",
		ProjectKeyConfidence: "strong",
		ProjectMatchKeys:     []string{"workspace:abc"},
	})
	if err != nil {
		t.Fatalf("ExplainChannelRouting: %v", err)
	}

	if result.SelectedAccountID != "auth-file:b.json" {
		t.Fatalf("SelectedAccountID = %q, want auth-file:b.json", result.SelectedAccountID)
	}
	assertCandidateIDs(t, result.Candidates, []string{"auth-file:b.json"})
	assertFilteredReason(t, result.Filtered, "auth-file:a.json", "project-candidate-pool")
	assertFilteredReason(t, result.Filtered, "auth-file:c.json", "project-candidate-pool")
	if result.ProjectCandidatePool == nil ||
		!result.ProjectCandidatePool.Evaluated ||
		!result.ProjectCandidatePool.Activated ||
		result.ProjectCandidatePool.Reason != "project-candidate-pool:matched" ||
		result.ProjectCandidatePool.RuleID != "rule-workspace-abc" ||
		result.ProjectCandidatePool.BeforeCandidateCount != 3 ||
		result.ProjectCandidatePool.AfterCandidateCount != 1 {
		t.Fatalf("project candidate pool explain = %#v", result.ProjectCandidatePool)
	}
	assertStepContains(t, result.Steps, "project-candidate-pool:matched")
}

func TestExplainChannelRoutingProjectCandidatePoolAmbiguousDoesNotFilter(t *testing.T) {
	accounts := []accountsdomain.AccountRecord{
		{ID: "auth-file:a.json", DisplayName: "A", Status: "active", Priority: 0, SupportedFormats: []string{"codex"}},
		{ID: "auth-file:b.json", DisplayName: "B", Status: "active", Priority: 1, SupportedFormats: []string{"codex"}},
	}

	result := explainChannelRoutingWithProjectCandidatePool(accounts, ChannelRoutingConfig{
		Channel:           "codex",
		RouteMode:         "sequential",
		OrderedAccountIDs: []string{"auth-file:a.json", "auth-file:b.json"},
	}, ChannelRoutingExplainInput{
		ProjectKeySource:     "codex-turn-workspace",
		ProjectKeyConfidence: "ambiguous",
	}, nil, []ProjectCandidatePoolRule{{
		ID:              "rule-gettokens",
		Channel:         "codex",
		ProjectKey:      "workspace:abc",
		Enabled:         true,
		AllowAccountIDs: []string{"auth-file:b.json"},
	}})

	if result.SelectedAccountID != "auth-file:a.json" {
		t.Fatalf("SelectedAccountID = %q, want auth-file:a.json", result.SelectedAccountID)
	}
	assertCandidateIDs(t, result.Candidates, []string{"auth-file:a.json", "auth-file:b.json"})
	if result.ProjectCandidatePool == nil ||
		result.ProjectCandidatePool.Evaluated ||
		result.ProjectCandidatePool.Activated ||
		result.ProjectCandidatePool.Reason != "project-candidate-pool:not-evaluated:ambiguous-project" {
		t.Fatalf("project candidate pool explain = %#v", result.ProjectCandidatePool)
	}
}

func TestExplainChannelRoutingProjectCandidatePoolNoRouteableAccountFailsClosed(t *testing.T) {
	accounts := []accountsdomain.AccountRecord{
		{ID: "auth-file:a.json", DisplayName: "A", Status: "active", Priority: 0, SupportedFormats: []string{"codex"}},
	}

	result := explainChannelRoutingWithProjectCandidatePool(accounts, ChannelRoutingConfig{
		Channel:           "codex",
		RouteMode:         "sequential",
		OrderedAccountIDs: []string{"auth-file:a.json"},
	}, ChannelRoutingExplainInput{
		ProjectKey:       "workspace:abc",
		ProjectMatchKeys: []string{"workspace:abc"},
	}, nil, []ProjectCandidatePoolRule{{
		ID:              "rule-gettokens",
		Channel:         "codex",
		ProjectKey:      "workspace:abc",
		Enabled:         true,
		AllowAccountIDs: []string{"auth-file:missing.json"},
	}})

	if result.SelectedAccountID != "" {
		t.Fatalf("SelectedAccountID = %q, want empty fail-closed selection", result.SelectedAccountID)
	}
	assertCandidateIDs(t, result.Candidates, []string{})
	assertFilteredReason(t, result.Filtered, "auth-file:a.json", "project-candidate-pool-no-routeable-account")
	if result.ProjectCandidatePool == nil ||
		!result.ProjectCandidatePool.Evaluated ||
		!result.ProjectCandidatePool.Activated ||
		result.ProjectCandidatePool.Reason != "project-candidate-pool:no-routeable-account" {
		t.Fatalf("project candidate pool explain = %#v", result.ProjectCandidatePool)
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
	if len(result.Shadow.Candidates) != 2 || result.Shadow.Candidates[0].ID != "auth-file:b.json" || result.Shadow.Candidates[1].ID != "auth-file:a.json" {
		t.Fatalf("Shadow.Candidates = %#v, want balanced candidate order b then a", result.Shadow.Candidates)
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
	if err := appendChannelRouteEvent(ChannelRoutingExplainInput{
		Channel:              "codex",
		ProjectKey:           "workspace:abc",
		ProjectName:          "GetTokens",
		ProjectKeySource:     "codex-turn-workspace",
		ProjectKeyConfidence: "strong",
	}, result); err != nil {
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
	if event.ProjectKey != "workspace:abc" || event.ProjectName != "GetTokens" {
		t.Fatalf("event project identity mismatch: %#v", event)
	}
	if event.ProjectKeySource != "codex-turn-workspace" || event.ProjectKeyConfidence != "strong" {
		t.Fatalf("event project identity metadata mismatch: %#v", event)
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

func assertCandidateIDs(t *testing.T, candidates []ChannelRoutingCandidate, want []string) {
	t.Helper()
	got := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		got = append(got, candidate.ID)
	}
	if len(got) != len(want) {
		t.Fatalf("candidate IDs = %#v, want %#v", got, want)
	}
	for index := range want {
		if got[index] != want[index] {
			t.Fatalf("candidate IDs = %#v, want %#v", got, want)
		}
	}
}
