package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	wailsapp "github.com/linhay/gettokens/internal/wailsapp"
	"github.com/wailsapp/wails/v2/pkg/menu"
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

func TestAppRuntimeSettingsRootMappingPreservesShowMenuBarIcon(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	app := NewApp()
	updated, err := app.UpdateAppRuntimeSettings(AppRuntimeSettings{
		LaunchAtLogin:   false,
		CloseAction:     wailsapp.AppCloseActionQuitAppAndService,
		ShowMenuBarIcon: false,
	})
	if err != nil {
		t.Fatalf("UpdateAppRuntimeSettings() error = %v", err)
	}
	if updated.ShowMenuBarIcon {
		t.Fatal("updated ShowMenuBarIcon = true, want false")
	}
	if updated.MenuBarResident {
		t.Fatal("updated MenuBarResident = true, want false")
	}

	resident, err := app.UpdateAppRuntimeSettings(AppRuntimeSettings{
		LaunchAtLogin:   false,
		CloseAction:     wailsapp.AppCloseActionKeepServiceInMenuBar,
		ShowMenuBarIcon: false,
	})
	if err != nil {
		t.Fatalf("UpdateAppRuntimeSettings(resident) error = %v", err)
	}
	if !resident.ShowMenuBarIcon {
		t.Fatal("resident ShowMenuBarIcon = false, want forced true")
	}
	if !resident.MenuBarResident {
		t.Fatal("resident MenuBarResident = false, want true")
	}
}

func TestChannelRoutingRootMappingPreservesManualRequestableAccountIDs(t *testing.T) {
	root := ChannelRoutingConfig{
		Channel:                     "codex",
		RouteMode:                   "balanced",
		OrderedAccountIDs:           []string{"auth-file:codex.json"},
		ManualRequestableAccountIDs: []string{"codex-api-key:manual"},
		ChannelGroupStates:          map[string]ChannelGroupState{},
	}
	core := mapWailsChannelRoutingConfig(root)
	if got := core.ManualRequestableAccountIDs; len(got) != 1 || got[0] != "codex-api-key:manual" {
		t.Fatalf("core ManualRequestableAccountIDs = %#v", got)
	}

	roundtrip := mapChannelRoutingConfig(&core)
	if roundtrip == nil {
		t.Fatal("mapChannelRoutingConfig returned nil")
	}
	if got := roundtrip.ManualRequestableAccountIDs; len(got) != 1 || got[0] != "codex-api-key:manual" {
		t.Fatalf("roundtrip ManualRequestableAccountIDs = %#v", got)
	}
}

func TestMapRateLimitStatePreservesExplainFields(t *testing.T) {
	input := &wailsapp.RateLimitState{
		AccountKey:      "acct_00000000-0000-4000-8000-000000000001",
		Blocked:         true,
		BlockReason:     "1h requests 已满",
		UpdatedAt:       "2026-05-31T10:00:00Z",
		LastEvaluatedAt: "2026-05-31T10:00:00Z",
		NextReset:       "2026-05-31T11:00:00Z",
		Stale:           true,
		DegradedReason:  "evaluation delayed",
		Sources: []wailsapp.RateLimitSourceState{{
			Source:      "rate-limit",
			Reason:      "1h requests 已满",
			RuleID:      "rule-1",
			Strategy:    "request-window",
			Window:      "1h",
			UsageValue:  2,
			LimitValue:  2,
			WindowStart: "2026-05-31T09:00:00Z",
			WindowEnd:   "2026-05-31T10:00:00Z",
			NextReset:   "2026-05-31T11:00:00Z",
		}},
		Rules: []wailsapp.RateLimitRuleState{{
			Rule:         wailsapp.RateLimitRule{ID: "rule-1", AccountKey: "acct_00000000-0000-4000-8000-000000000001", Strategy: "request-window", Window: "1h", LimitValue: 2, Action: "block", Enabled: true},
			Exceeded:     true,
			Reason:       "1h requests 已满",
			UsagePct:     100,
			CurrentUsage: 2,
			LimitValue:   2,
			WindowStart:  "2026-05-31T09:00:00Z",
			WindowEnd:    "2026-05-31T10:00:00Z",
			NextReset:    "2026-05-31T11:00:00Z",
		}},
	}

	got := mapRateLimitState(input)
	if got == nil || !got.Blocked || got.LastEvaluatedAt != input.LastEvaluatedAt || got.NextReset != input.NextReset || !got.Stale || got.DegradedReason != input.DegradedReason {
		t.Fatalf("mapped state = %#v, want top-level explain fields", got)
	}
	if len(got.Sources) != 1 || got.Sources[0].RuleID != "rule-1" || got.Sources[0].UsageValue != 2 || got.Sources[0].NextReset != input.NextReset {
		t.Fatalf("mapped sources = %#v, want source explain fields", got.Sources)
	}
	if len(got.Rules) != 1 || got.Rules[0].LimitValue != 2 || got.Rules[0].WindowStart == "" || got.Rules[0].NextReset == "" {
		t.Fatalf("mapped rules = %#v, want rule explain fields", got.Rules)
	}
}

func TestMapProjectCandidatePoolRulePreservesProjectIdentity(t *testing.T) {
	input := ProjectCandidatePoolRule{
		ID:                   "pcp-1",
		Channel:              "codex",
		ProjectKey:           "workspace:0123456789abcdef",
		ProjectName:          "GetTokens",
		ProjectKeySource:     "codex-turn-workspace",
		ProjectKeyConfidence: "strong",
		Enabled:              true,
		AllowAccountIDs:      []string{"auth-file:codex-a.json", "codex-api-key:relay-b"},
		CreatedAt:            "2026-06-07T10:00:00Z",
		UpdatedAt:            "2026-06-07T11:00:00Z",
	}

	core := mapProjectCandidatePoolRuleToCore(input)
	if core.ID != input.ID ||
		core.Channel != input.Channel ||
		core.ProjectKey != input.ProjectKey ||
		core.ProjectName != input.ProjectName ||
		core.ProjectKeySource != input.ProjectKeySource ||
		core.ProjectKeyConfidence != input.ProjectKeyConfidence ||
		core.Enabled != input.Enabled ||
		core.CreatedAt != input.CreatedAt ||
		core.UpdatedAt != input.UpdatedAt {
		t.Fatalf("core project candidate pool rule = %#v, want project identity fields preserved", core)
	}
	if got := core.AllowAccountIDs; len(got) != 2 || got[0] != input.AllowAccountIDs[0] || got[1] != input.AllowAccountIDs[1] {
		t.Fatalf("core AllowAccountIDs = %#v, want %#v", got, input.AllowAccountIDs)
	}
	core.AllowAccountIDs[0] = "mutated"
	if input.AllowAccountIDs[0] == "mutated" {
		t.Fatal("mapProjectCandidatePoolRuleToCore aliased AllowAccountIDs")
	}

	roundtrip := mapProjectCandidatePoolRule(core)
	if roundtrip.ID != core.ID ||
		roundtrip.Channel != core.Channel ||
		roundtrip.ProjectKey != core.ProjectKey ||
		roundtrip.ProjectName != core.ProjectName ||
		roundtrip.ProjectKeySource != core.ProjectKeySource ||
		roundtrip.ProjectKeyConfidence != core.ProjectKeyConfidence ||
		roundtrip.Enabled != core.Enabled ||
		roundtrip.CreatedAt != core.CreatedAt ||
		roundtrip.UpdatedAt != core.UpdatedAt {
		t.Fatalf("roundtrip project candidate pool rule = %#v, want core fields preserved", roundtrip)
	}
	if got := roundtrip.AllowAccountIDs; len(got) != 2 || got[0] != "mutated" || got[1] != input.AllowAccountIDs[1] {
		t.Fatalf("roundtrip AllowAccountIDs = %#v, want mapped core values", got)
	}
	roundtrip.AllowAccountIDs[0] = "mutated-again"
	if core.AllowAccountIDs[0] == "mutated-again" {
		t.Fatal("mapProjectCandidatePoolRule aliased AllowAccountIDs")
	}

	if got := mapProjectCandidatePoolRules(nil); got == nil || len(got) != 0 {
		t.Fatalf("mapProjectCandidatePoolRules(nil) = %#v, want empty non-nil slice", got)
	}
}

func TestMapChannelRoutingExplainPreservesProjectCandidatePool(t *testing.T) {
	rootInput := ChannelRoutingExplainInput{
		Channel:              "codex",
		TriedAccountIDs:      []string{"auth-file:tried.json"},
		ActiveSessions:       map[string]int{"auth-file:active.json": 2},
		StickyAccountID:      "auth-file:sticky.json",
		ProjectKey:           "workspace:0123456789abcdef",
		ProjectName:          "GetTokens",
		ProjectKeySource:     "codex-turn-workspace",
		ProjectKeyConfidence: "strong",
		ProjectMatchKeys:     []string{"workspace:0123456789abcdef"},
	}

	coreInput := mapChannelRoutingExplainInputToCore(rootInput)
	if coreInput.Channel != rootInput.Channel ||
		coreInput.StickyAccountID != rootInput.StickyAccountID ||
		coreInput.ProjectKey != rootInput.ProjectKey ||
		coreInput.ProjectName != rootInput.ProjectName ||
		coreInput.ProjectKeySource != rootInput.ProjectKeySource ||
		coreInput.ProjectKeyConfidence != rootInput.ProjectKeyConfidence {
		t.Fatalf("core explain input = %#v, want project identity preserved", coreInput)
	}
	if got := coreInput.ProjectMatchKeys; len(got) != 1 || got[0] != rootInput.ProjectMatchKeys[0] {
		t.Fatalf("core ProjectMatchKeys = %#v, want %#v", got, rootInput.ProjectMatchKeys)
	}
	if got := coreInput.TriedAccountIDs; len(got) != 1 || got[0] != rootInput.TriedAccountIDs[0] {
		t.Fatalf("core TriedAccountIDs = %#v, want %#v", got, rootInput.TriedAccountIDs)
	}
	coreInput.ProjectMatchKeys[0] = "mutated"
	coreInput.TriedAccountIDs[0] = "mutated"
	coreInput.ActiveSessions["auth-file:active.json"] = 9
	if rootInput.ProjectMatchKeys[0] == "mutated" ||
		rootInput.TriedAccountIDs[0] == "mutated" ||
		rootInput.ActiveSessions["auth-file:active.json"] == 9 {
		t.Fatal("mapChannelRoutingExplainInputToCore aliased mutable fields")
	}

	coreResult := &wailsapp.ChannelRoutingExplainResult{
		Channel:           "codex",
		RouteMode:         wailsapp.ChannelRouteModeSequential,
		SelectedAccountID: "auth-file:allowed.json",
		Candidates: []wailsapp.ChannelRoutingCandidate{{
			ID:          "auth-file:allowed.json",
			DisplayName: "Allowed",
		}},
		Filtered: []wailsapp.ChannelRoutingFilteredAccount{{
			ID:     "auth-file:outside.json",
			Reason: "project-candidate-pool",
		}},
		Steps:           []string{"mode:sequential", "project-candidate-pool:matched", "candidates:1"},
		SnapshotVersion: "snapshot-project",
		PolicyVersion:   "channel-routing-v1",
		ProjectCandidatePool: &wailsapp.ChannelRoutingProjectCandidatePoolInfo{
			Evaluated:            true,
			Activated:            true,
			Reason:               "project-candidate-pool:matched",
			RuleID:               "rule-gettokens",
			ProjectKey:           "workspace:0123456789abcdef",
			ProjectName:          "GetTokens",
			ProjectKeySource:     "codex-turn-workspace",
			ProjectKeyConfidence: "strong",
			AllowAccountIDs:      []string{"auth-file:allowed.json"},
			FilteredAccountIDs:   []string{"auth-file:outside.json"},
			BeforeCandidateCount: 2,
			AfterCandidateCount:  1,
		},
	}

	rootResult := mapChannelRoutingExplainResult(coreResult)
	if rootResult == nil || rootResult.ProjectCandidatePool == nil {
		t.Fatalf("root explain result = %#v, want project candidate pool", rootResult)
	}
	project := rootResult.ProjectCandidatePool
	if !project.Evaluated ||
		!project.Activated ||
		project.Reason != "project-candidate-pool:matched" ||
		project.RuleID != "rule-gettokens" ||
		project.ProjectKey != "workspace:0123456789abcdef" ||
		project.ProjectName != "GetTokens" ||
		project.ProjectKeySource != "codex-turn-workspace" ||
		project.ProjectKeyConfidence != "strong" ||
		project.BeforeCandidateCount != 2 ||
		project.AfterCandidateCount != 1 {
		t.Fatalf("project candidate pool = %#v, want explain fields preserved", project)
	}
	if got := project.AllowAccountIDs; len(got) != 1 || got[0] != "auth-file:allowed.json" {
		t.Fatalf("AllowAccountIDs = %#v, want allowed account", got)
	}
	if got := project.FilteredAccountIDs; len(got) != 1 || got[0] != "auth-file:outside.json" {
		t.Fatalf("FilteredAccountIDs = %#v, want filtered account", got)
	}
	project.AllowAccountIDs[0] = "mutated"
	project.FilteredAccountIDs[0] = "mutated"
	if coreResult.ProjectCandidatePool.AllowAccountIDs[0] == "mutated" ||
		coreResult.ProjectCandidatePool.FilteredAccountIDs[0] == "mutated" {
		t.Fatal("mapChannelRoutingExplainResult aliased project candidate pool slices")
	}
}

func TestMapAccountStoreDiagnosticsUsesFrontendFieldNames(t *testing.T) {
	input := &wailsapp.AccountStoreDiagnostics{
		PathBasename: "accounts-v1.sqlite",
		Configured:   true,
		Open:         true,
		ReadRecovery: wailsapp.AccountStoreReadRecoveryDiagnostics{
			Count:             2,
			LastEndpoint:      "accounts",
			LastRecovered:     true,
			LastError:         "query accounts: disk I/O error (522)",
			LastRecoveredUnix: 1780460000000,
		},
	}

	got := mapAccountStoreDiagnostics(input)
	if got == nil || got.PathBasename != input.PathBasename || !got.Open || got.ReadRecovery.Count != 2 {
		t.Fatalf("mapped diagnostics = %#v", got)
	}
	payload, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("marshal diagnostics: %v", err)
	}
	text := string(payload)
	for _, want := range []string{"pathBasename", "readRecovery", "lastRecoveredAtUnixMs"} {
		if !strings.Contains(text, want) {
			t.Fatalf("payload %s missing %s", text, want)
		}
	}
	if strings.Contains(text, "path_basename") || strings.Contains(text, "read_recovery") {
		t.Fatalf("payload %s should use frontend field names", text)
	}
}

func TestOpenAICompatibleRootDTOsPreserveBillingFields(t *testing.T) {
	payloads := []struct {
		name  string
		value interface{}
	}{
		{
			name: "provider",
			value: OpenAICompatibleProvider{
				QuotaCurl:      "curl https://api.example.com/usage",
				QuotaEnabled:   true,
				BillingCurl:    "curl https://api.example.com/billing",
				BillingEnabled: true,
				PlatformCookie: "session=abc",
				CurlVariables:  map[string]string{"region": "cn"},
			},
		},
		{
			name: "create",
			value: CreateOpenAICompatibleProviderInput{
				QuotaCurl:      "curl https://api.example.com/usage",
				QuotaEnabled:   true,
				BillingCurl:    "curl https://api.example.com/billing",
				BillingEnabled: true,
				PlatformCookie: "session=abc",
				CurlVariables:  map[string]string{"region": "cn"},
			},
		},
		{
			name: "update",
			value: UpdateOpenAICompatibleProviderInput{
				QuotaCurl:      "curl https://api.example.com/usage",
				QuotaEnabled:   true,
				BillingCurl:    "curl https://api.example.com/billing",
				BillingEnabled: true,
				PlatformCookie: "session=abc",
				CurlVariables:  map[string]string{"region": "cn"},
			},
		},
	}

	for _, payload := range payloads {
		body, err := json.Marshal(payload.value)
		if err != nil {
			t.Fatalf("marshal %s dto: %v", payload.name, err)
		}
		text := string(body)
		for _, want := range []string{"quotaCurl", "quotaEnabled", "billingCurl", "billingEnabled", "platformCookie", "curlVariables"} {
			if !strings.Contains(text, want) {
				t.Fatalf("%s dto payload %s missing %s", payload.name, text, want)
			}
		}
	}
}

func TestCodexAPIKeyRootInputsPreserveManagementFields(t *testing.T) {
	testCurlInput := mapTestCodexAPIKeyQuotaCurlInputToWails(TestCodexAPIKeyQuotaCurlInput{
		APIKey:         "sk-test",
		BaseURL:        "https://relay.example.com/openai/v1",
		Prefix:         "team-a",
		QuotaCurl:      `curl -sS "{{baseUrl}}/usage" -b "{{platformCookie}}"`,
		PlatformCookie: "session=abc",
		CurlVariables:  map[string]string{"region": "cn"},
	})
	if testCurlInput.PlatformCookie != "session=abc" || testCurlInput.CurlVariables["region"] != "cn" {
		t.Fatalf("quota test input = %#v, want management fields preserved", testCurlInput)
	}

	createInput := mapCreateCodexAPIKeyInputToWails(CreateCodexAPIKeyInput{
		APIKey:         "sk-test",
		BaseURL:        "https://relay.example.com/codex/v1",
		QuotaCurl:      `curl -sS "{{baseUrl}}/usage"`,
		QuotaEnabled:   true,
		BillingCurl:    `curl -sS "{{baseUrl}}/billing"`,
		BillingEnabled: true,
		PlatformCookie: "session=abc",
		CurlVariables:  map[string]string{"region": "cn"},
	})
	if createInput.PlatformCookie != "session=abc" || createInput.CurlVariables["region"] != "cn" {
		t.Fatalf("create input = %#v, want management fields preserved", createInput)
	}

	updateInput := mapUpdateCodexAPIKeyConfigInputToWails(UpdateCodexAPIKeyConfigInput{
		ID:             "acct_codex_key",
		APIKey:         "sk-test",
		BaseURL:        "https://relay.example.com/codex/v1",
		QuotaCurl:      `curl -sS "{{baseUrl}}/usage"`,
		QuotaEnabled:   true,
		BillingCurl:    `curl -sS "{{baseUrl}}/billing"`,
		BillingEnabled: true,
		PlatformCookie: "session=abc",
		CurlVariables:  map[string]string{"region": "cn"},
	})
	if updateInput.PlatformCookie != "session=abc" || updateInput.CurlVariables["region"] != "cn" {
		t.Fatalf("update input = %#v, want management fields preserved", updateInput)
	}
}

func TestBuildApplicationMenuKeepsCheckForUpdatesOutOfHelpMenu(t *testing.T) {
	appMenu := buildApplicationMenuWithUpdateAction(func() {})
	updateItem := findMenuItemByLabel(appMenu, macOSCheckForUpdatesMenuLabel)

	if macOSCheckForUpdatesMenuLabel != "检查更新..." {
		t.Fatalf("macOS update menu label = %q, want %q", macOSCheckForUpdatesMenuLabel, "检查更新...")
	}
	if updateItem != nil {
		t.Fatalf("application menu model should not include %q; it is inserted into the native App menu", macOSCheckForUpdatesMenuLabel)
	}
}

func TestConsumeLoginItemArgRemovesCustomArgBeforeWailsParsesFlags(t *testing.T) {
	args, found := consumeLoginItemArg([]string{
		"/Applications/GetTokens.app/Contents/MacOS/GetTokens",
		"-loglevel",
		"Info",
		wailsapp.GetTokensLoginItemArg,
		"-assetdir",
		"frontend/dist",
	})

	if !found {
		t.Fatal("consumeLoginItemArg found = false, want true")
	}
	if strings.Contains(strings.Join(args, " "), wailsapp.GetTokensLoginItemArg) {
		t.Fatalf("consumeLoginItemArg did not remove %q from %v", wailsapp.GetTokensLoginItemArg, args)
	}
	want := []string{
		"/Applications/GetTokens.app/Contents/MacOS/GetTokens",
		"-loglevel",
		"Info",
		"-assetdir",
		"frontend/dist",
	}
	if strings.Join(args, "\x00") != strings.Join(want, "\x00") {
		t.Fatalf("consumeLoginItemArg args = %v, want %v", args, want)
	}
}

func TestConsumeLoginItemArgReportsMissingArg(t *testing.T) {
	args, found := consumeLoginItemArg([]string{
		"/Applications/GetTokens.app/Contents/MacOS/GetTokens",
		"-loglevel",
		"Info",
	})

	if found {
		t.Fatal("consumeLoginItemArg found = true, want false")
	}
	if strings.Join(args, "\x00") != "/Applications/GetTokens.app/Contents/MacOS/GetTokens\x00-loglevel\x00Info" {
		t.Fatalf("consumeLoginItemArg changed args unexpectedly: %v", args)
	}
}

func TestAppSingleInstanceUniqueIDSeparatesDevAndProd(t *testing.T) {
	if got := appSingleInstanceUniqueIDFrom("", "/Applications/GetTokens.app/Contents/MacOS/GetTokens"); got != "com.linhay.gettokens" {
		t.Fatalf("prod single instance id = %q", got)
	}
	if got := appSingleInstanceUniqueIDFrom("dev", "/Applications/GetTokens.app/Contents/MacOS/GetTokens"); got != "com.linhay.gettokens.dev" {
		t.Fatalf("dev env single instance id = %q", got)
	}
	if got := appSingleInstanceUniqueIDFrom("", "/repo/build/bin/GetTokens.app/Contents/MacOS/GetTokens"); got != "com.linhay.gettokens.dev" {
		t.Fatalf("dev bundle single instance id = %q", got)
	}
}

func TestConsumeDeepLinkArgsRemovesGetTokensURLsBeforeWailsParsesFlags(t *testing.T) {
	args, links := consumeDeepLinkArgs([]string{
		"/Applications/GetTokens.app/Contents/MacOS/GetTokens",
		"gt://app/v1/import?payload=abc",
		"-loglevel",
		"Info",
		"GT-DEV://app/v1/import?payload=def",
	})

	wantArgs := []string{
		"/Applications/GetTokens.app/Contents/MacOS/GetTokens",
		"-loglevel",
		"Info",
	}
	if strings.Join(args, "\x00") != strings.Join(wantArgs, "\x00") {
		t.Fatalf("consumeDeepLinkArgs args = %v, want %v", args, wantArgs)
	}
	wantLinks := []string{
		"gt://app/v1/import?payload=abc",
		"GT-DEV://app/v1/import?payload=def",
	}
	if strings.Join(links, "\x00") != strings.Join(wantLinks, "\x00") {
		t.Fatalf("consumeDeepLinkArgs links = %v, want %v", links, wantLinks)
	}
}

func TestWailsConfigRegistersProdAndDevDeepLinkSchemes(t *testing.T) {
	prodPList, err := os.ReadFile("build/darwin/Info.plist")
	if err != nil {
		t.Fatalf("read build/darwin/Info.plist: %v", err)
	}
	devPList, err := os.ReadFile("build/darwin/Info.dev.plist")
	if err != nil {
		t.Fatalf("read build/darwin/Info.dev.plist: %v", err)
	}
	prodStr := string(prodPList)
	devStr := string(devPList)
	// Prod plist must register gt but NOT gt-dev
	if !strings.Contains(prodStr, "<string>gt</string>") {
		t.Fatal("build/darwin/Info.plist missing gt scheme registration")
	}
	if strings.Contains(prodStr, "<string>gt-dev</string>") {
		t.Fatal("build/darwin/Info.plist must NOT register gt-dev scheme")
	}
	// Dev plist must also register gt (Wails v2.12.0 always uses Info.dev.plist)
	if !strings.Contains(devStr, "<string>gt</string>") {
		t.Fatal("build/darwin/Info.dev.plist missing gt scheme registration")
	}
	if strings.Contains(devStr, "<string>gt-dev</string>") {
		t.Fatal("build/darwin/Info.dev.plist must NOT register gt-dev scheme")
	}
}

func TestAppSingleInstanceUniqueIDUsesDevProfileLock(t *testing.T) {
	t.Setenv("GETTOKENS_APP_PROFILE", "dev")

	if got := appSingleInstanceUniqueID(); got != "com.linhay.gettokens.dev" {
		t.Fatalf("appSingleInstanceUniqueID() = %q, want dev lock id", got)
	}
}

func TestAppSingleInstanceUniqueIDDefaultsToProductionLock(t *testing.T) {
	t.Setenv("GETTOKENS_APP_PROFILE", "")

	if got := appSingleInstanceUniqueID(); got != "com.linhay.gettokens" {
		t.Fatalf("appSingleInstanceUniqueID() = %q, want production lock id", got)
	}
}

func TestMapAccountRecordPreservesStatusMessage(t *testing.T) {
	record := mapAccountRecord(accountsdomain.AccountRecord{
		ID:               "auth-file:broken.json",
		AccountKind:      "auth-file",
		Provider:         "codex",
		CredentialSource: "auth-file",
		DisplayName:      "broken.json",
		Status:           "error",
		StatusMessage:    "refresh token expired",
	})

	if got := record.StatusMessage; got != "refresh token expired" {
		t.Fatalf("StatusMessage = %q, want refresh token expired", got)
	}
	if got := record.AccountKind; got != "auth-file" {
		t.Fatalf("AccountKind = %q, want auth-file", got)
	}
}

func TestMapAccountRecordPreservesRequestabilityEvidence(t *testing.T) {
	record := mapAccountRecord(accountsdomain.AccountRecord{
		ID:               "codex-api-key:verified",
		AccountKind:      accountsdomain.AccountKindCodexAPIKey,
		Provider:         "codex",
		CredentialSource: accountsdomain.CredentialSourceAPIKey,
		DisplayName:      "Verified",
		Status:           "configured",
		Requestability: accountsdomain.AccountRequestability{
			Evidence: []string{"verified"},
			Manual:   true,
		},
	})

	if !record.Requestability.Manual {
		t.Fatal("Requestability.Manual = false, want true")
	}
	if got := record.Requestability.Evidence; len(got) != 1 || got[0] != "verified" {
		t.Fatalf("Requestability.Evidence = %#v, want [verified]", got)
	}
}

func TestMapAccountRecordPreservesRuntimeRouteability(t *testing.T) {
	record := mapAccountRecord(accountsdomain.AccountRecord{
		ID:                   "acct_codex_key",
		AccountKind:          accountsdomain.AccountKindCodexAPIKey,
		Provider:             "codex",
		CredentialSource:     accountsdomain.CredentialSourceAPIKey,
		DisplayName:          "Primary Codex",
		Status:               "configured",
		RuntimeStatus:        "applied_not_registered",
		RuntimeReason:        "runtime auth missing from registry",
		Routeable:            false,
		RegisteredModelCount: 0,
	})

	if got := record.RuntimeStatus; got != "applied_not_registered" {
		t.Fatalf("RuntimeStatus = %q, want applied_not_registered", got)
	}
	if got := record.RuntimeReason; got != "runtime auth missing from registry" {
		t.Fatalf("RuntimeReason = %q, want runtime auth missing from registry", got)
	}
	if record.Routeable {
		t.Fatal("Routeable = true, want false")
	}
	if got := record.RegisteredModelCount; got != 0 {
		t.Fatalf("RegisteredModelCount = %d, want 0", got)
	}
}

func findMenuItemByLabel(appMenu *menu.Menu, label string) *menu.MenuItem {
	for _, item := range appMenu.Items {
		if found := findMenuItemByLabelInItem(item, label); found != nil {
			return found
		}
	}
	return nil
}

func findMenuItemByLabelInItem(item *menu.MenuItem, label string) *menu.MenuItem {
	if item.Label == label {
		return item
	}
	if item.SubMenu == nil {
		return nil
	}
	for _, child := range item.SubMenu.Items {
		if found := findMenuItemByLabelInItem(child, label); found != nil {
			return found
		}
	}
	return nil
}

func TestMapCodexQuotaResponsePreservesBilling(t *testing.T) {
	usedTokens := 125.0
	limitTokens := 1000.0
	remainingTokens := 875.0
	result := mapCodexQuotaResponse(&wailsapp.CodexQuotaResponse{
		PlanType:    "metered",
		Status:      "success",
		Blocked:     true,
		BlockReason: "quota empty: weekly",
		Sources: []wailsapp.CodexQuotaSourceState{
			{
				Source:    "quota-empty",
				Reason:    "quota empty: weekly",
				ExpiresAt: "2026-05-31T12:00:00Z",
				NextReset: "2026-05-31T12:00:00Z",
			},
		},
		Windows: []wailsapp.CodexQuotaWindow{
			{
				ID:              "weekly",
				Label:           "7D",
				UsedTokens:      &usedTokens,
				LimitTokens:     &limitTokens,
				RemainingTokens: &remainingTokens,
				ResetLabel:      "tomorrow",
			},
		},
		Billing: &wailsapp.CodexQuotaBillingInfo{
			IsAvailable: true,
			BalanceInfos: []wailsapp.CodexQuotaBillingBalanceInfo{
				{
					Currency:       "USD",
					TotalBalance:   "12.34",
					GrantedBalance: "5.67",
				},
			},
		},
	})

	if result == nil {
		t.Fatal("mapCodexQuotaResponse returned nil")
	}
	if result.Billing == nil {
		t.Fatal("mapCodexQuotaResponse billing = nil, want preserved billing")
	}
	if !result.Blocked || result.BlockReason != "quota empty: weekly" || len(result.Sources) != 1 || result.Sources[0].Source != "quota-empty" {
		t.Fatalf("mapCodexQuotaResponse guard = blocked:%v reason:%q sources:%#v, want preserved quota guard source", result.Blocked, result.BlockReason, result.Sources)
	}
	if !result.Billing.IsAvailable {
		t.Fatal("mapCodexQuotaResponse billing availability = false, want true")
	}
	if got := len(result.Billing.BalanceInfos); got != 1 {
		t.Fatalf("mapCodexQuotaResponse billing entries = %d, want 1", got)
	}
	if got := result.Billing.BalanceInfos[0].Currency; got != "USD" {
		t.Fatalf("mapCodexQuotaResponse currency = %q, want %q", got, "USD")
	}
	if result.Windows[0].UsedTokens == nil || *result.Windows[0].UsedTokens != 125 {
		t.Fatalf("mapCodexQuotaResponse used tokens = %#v, want 125", result.Windows[0].UsedTokens)
	}
	if result.Windows[0].LimitTokens == nil || *result.Windows[0].LimitTokens != 1000 {
		t.Fatalf("mapCodexQuotaResponse limit tokens = %#v, want 1000", result.Windows[0].LimitTokens)
	}
	if result.Windows[0].RemainingTokens == nil || *result.Windows[0].RemainingTokens != 875 {
		t.Fatalf("mapCodexQuotaResponse remaining tokens = %#v, want 875", result.Windows[0].RemainingTokens)
	}
}
