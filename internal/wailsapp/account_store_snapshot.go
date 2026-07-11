package wailsapp

import (
	"strings"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
)

// ListCachedAccounts returns a best-effort first-paint account snapshot through
// the sidecar management API. The App process must not open the primary
// account-store SQLite file directly.
func (a *App) ListCachedAccounts() ([]accountsdomain.AccountRecord, error) {
	if !a.hasManagementClient() {
		return []accountsdomain.AccountRecord{}, nil
	}
	accounts, err := a.managementClient().ListAccountSnapshot(true)
	if err != nil {
		return nil, err
	}
	return sanitizeLocalAccountSnapshotRecords(accountsdomain.BuildUnifiedAccountRecords(accounts)), nil
}

func sanitizeLocalAccountSnapshotRecords(records []accountsdomain.AccountRecord) []accountsdomain.AccountRecord {
	out := make([]accountsdomain.AccountRecord, 0, len(records))
	for _, record := range records {
		if strings.TrimSpace(record.ID) == "" {
			continue
		}
		record.APIKey = ""
		record.APIKeys = nil
		record.Headers = nil
		record.QuotaCurl = ""
		record.BillingCurl = ""
		record.PlatformCookie = ""
		record.CurlVariables = nil
		record.ModelFetchAPIKey = ""
		record.ModelFetchBaseURL = ""
		out = append(out, record)
	}
	return out
}
