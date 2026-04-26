package accounts

import "testing"

func TestBuildAuthFileAccountRecordKeepsStatusMessage(t *testing.T) {
	record := BuildAuthFileAccountRecord(AuthFileRecord{
		Name:          "broken.json",
		Provider:      "codex",
		Status:        "error",
		StatusMessage: "refresh token expired",
	})

	if got := record.Status; got != "error" {
		t.Fatalf("Status = %q, want error", got)
	}
	if got := record.StatusMessage; got != "refresh token expired" {
		t.Fatalf("StatusMessage = %q, want refresh token expired", got)
	}
}
