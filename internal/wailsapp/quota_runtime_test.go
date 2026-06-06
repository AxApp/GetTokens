package wailsapp

import (
	"io"
	"net/url"
	"testing"
)

func TestQuotaRuntimeBridgeCallsReadOnlyManagementAPI(t *testing.T) {
	var refreshCalled bool
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if path == ManagementAPIPrefix+"/gettokens/quota-refresh/acct_runtime" {
				refreshCalled = true
				t.Fatalf("runtime sync must not call quota refresh")
			}
			switch {
			case method == "GET" && path == ManagementAPIPrefix+"/gettokens/quota-status" && query.Get("account_key") == "":
				return []byte(`{"items":[{"account_key":"acct_runtime","status":"success","plan_type":"plus","windows":[{"id":"five-hour","label":"5H","remaining_percent":42,"reset_label":"later"}],"sources":[]}]}`), 200, nil
			case method == "GET" && path == ManagementAPIPrefix+"/gettokens/quota-status" && query.Get("account_key") == "acct_runtime":
				return []byte(`{"account_key":"acct_runtime","status":"success","plan_type":"plus","windows":[{"id":"five-hour","label":"5H","remaining_percent":42,"reset_label":"later"}],"sources":[]}`), 200, nil
			default:
				t.Fatalf("unexpected request: %s %s query=%s", method, path, query.Encode())
			}
			return nil, 404, nil
		},
	}

	statuses, err := app.GetAllQuotaStatuses()
	if err != nil || len(statuses) != 1 {
		t.Fatalf("GetAllQuotaStatuses = %#v, err = %v", statuses, err)
	}
	if statuses[0].AccountKey != "acct_runtime" || statuses[0].PlanType != "plus" || len(statuses[0].Windows) != 1 {
		t.Fatalf("unexpected quota statuses: %#v", statuses)
	}

	status, err := app.GetQuotaStatus("acct_runtime")
	if err != nil || status == nil {
		t.Fatalf("GetQuotaStatus = %#v, err = %v", status, err)
	}
	if status.AccountKey != "acct_runtime" || status.PlanType != "plus" {
		t.Fatalf("unexpected quota status: %#v", status)
	}
	if refreshCalled {
		t.Fatal("quota refresh was called")
	}
}
