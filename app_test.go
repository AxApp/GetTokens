package main

import (
	"net/http"
	"net/http/httptest"
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

func TestMapAccountRecordPreservesStatusMessage(t *testing.T) {
	record := mapAccountRecord(accountsdomain.AccountRecord{
		ID:               "auth-file:broken.json",
		Provider:         "codex",
		CredentialSource: "auth-file",
		DisplayName:      "broken.json",
		Status:           "error",
		StatusMessage:    "refresh token expired",
	})

	if got := record.StatusMessage; got != "refresh token expired" {
		t.Fatalf("StatusMessage = %q, want refresh token expired", got)
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
		PlanType: "metered",
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
