package wailsapp

import (
	"io"
	"net/url"
	"strings"
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
			case method == "GET" && path == ManagementAPIPrefix+"/gettokens/quota-status" && query.Get("account_key") == "" && query.Get("account_keys") == "":
				return []byte(`{"items":[{"account_key":"acct_runtime","status":"success","plan_type":"plus","windows":[{"id":"five-hour","label":"5H","remaining_percent":42,"reset_label":"later"}],"sources":[]}]}`), 200, nil
			case method == "GET" && path == ManagementAPIPrefix+"/gettokens/quota-status" && query.Get("account_keys") == "acct_runtime,acct_second":
				return []byte(`{"items":[{"account_key":"acct_runtime","status":"success","plan_type":"plus","windows":[{"id":"five-hour","label":"5H","remaining_percent":42,"reset_label":"later"}],"sources":[]},{"account_key":"acct_second","status":"stale","windows":[],"sources":[]}]}`), 200, nil
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

	selectedStatuses, err := app.GetQuotaStatuses([]string{"acct_runtime", "acct_runtime", "acct_second"})
	if err != nil || len(selectedStatuses) != 2 {
		t.Fatalf("GetQuotaStatuses = %#v, err = %v", selectedStatuses, err)
	}
	if selectedStatuses[0].AccountKey != "acct_runtime" || selectedStatuses[1].AccountKey != "acct_second" {
		t.Fatalf("unexpected selected quota statuses: %#v", selectedStatuses)
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

func TestRefreshCodexQuotasBatchCallsBatchManagementAPI(t *testing.T) {
	var gotPayload string
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if path == ManagementAPIPrefix+"/gettokens/quota-refresh/acct_runtime" {
				t.Fatalf("batch refresh must not call single-account quota refresh")
			}
			if method != "POST" || path != ManagementAPIPrefix+"/gettokens/quota-refresh-batch" {
				t.Fatalf("unexpected request: %s %s", method, path)
			}
			payload, _ := io.ReadAll(body)
			gotPayload = string(payload)
			return []byte(`{"items":[{"account_key":"acct_runtime","status":"success","plan_type":"team","windows":[],"sources":[]}],"errors":[{"account_key":"acct_failed","error":"quota curl missing"}],"succeeded":1,"failed":1}`), 200, nil
		},
	}

	result, err := app.RefreshCodexQuotasBatch(CodexQuotaBatchRefreshInput{
		AccountKeys:    []string{"acct_runtime", "acct_runtime", "acct_failed"},
		IncludeBilling: true,
		Concurrency:    4,
	})
	if err != nil || result == nil || result.Succeeded != 1 || result.Failed != 1 {
		t.Fatalf("RefreshCodexQuotasBatch = %#v, err = %v", result, err)
	}
	if len(result.Items) != 1 || result.Items[0].AccountKey != "acct_runtime" || result.Items[0].PlanType != "team" {
		t.Fatalf("batch items = %#v", result.Items)
	}
	if len(result.Errors) != 1 || result.Errors[0].AccountKey != "acct_failed" {
		t.Fatalf("batch errors = %#v", result.Errors)
	}
	if !strings.Contains(gotPayload, `"account_keys":["acct_runtime","acct_failed"]`) ||
		!strings.Contains(gotPayload, `"include_billing":true`) ||
		!strings.Contains(gotPayload, `"concurrency":4`) {
		t.Fatalf("batch payload = %s", gotPayload)
	}
}

func TestRefreshCodexQuotasBatchJobBridge(t *testing.T) {
	var gotPayload string
	app := &App{
		sidecarRequest: func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if path == ManagementAPIPrefix+"/gettokens/quota-refresh-batch" {
				t.Fatalf("job bridge must not call synchronous batch refresh")
			}
			switch {
			case method == "POST" && path == ManagementAPIPrefix+"/gettokens/quota-refresh-batch/jobs":
				payload, _ := io.ReadAll(body)
				gotPayload = string(payload)
				return []byte(`{"job_id":"job_1","status":"running","total":2,"pending":0,"running":2,"succeeded":0,"failed":0,"items":[],"errors":[]}`), 202, nil
			case method == "GET" && path == ManagementAPIPrefix+"/gettokens/quota-refresh-batch/jobs/job_1":
				return []byte(`{"job_id":"job_1","status":"succeeded","total":2,"pending":0,"running":0,"succeeded":1,"failed":1,"items":[{"account_key":"acct_runtime","status":"success","plan_type":"team","windows":[],"sources":[]}],"errors":[{"account_key":"acct_failed","error":"quota curl missing"}]}`), 200, nil
			default:
				t.Fatalf("unexpected request: %s %s query=%s", method, path, query.Encode())
			}
			return nil, 404, nil
		},
	}

	started, err := app.StartCodexQuotasBatchRefreshJob(CodexQuotaBatchRefreshInput{
		AccountKeys:    []string{"acct_runtime", "acct_runtime", "acct_failed"},
		IncludeBilling: true,
		Concurrency:    4,
	})
	if err != nil || started == nil || started.JobID != "job_1" || started.Status != "running" {
		t.Fatalf("StartCodexQuotasBatchRefreshJob = %#v, err = %v", started, err)
	}
	if !strings.Contains(gotPayload, `"account_keys":["acct_runtime","acct_failed"]`) ||
		!strings.Contains(gotPayload, `"include_billing":true`) ||
		!strings.Contains(gotPayload, `"concurrency":4`) {
		t.Fatalf("job payload = %s", gotPayload)
	}

	completed, err := app.GetCodexQuotaBatchRefreshJob("job_1")
	if err != nil || completed == nil || completed.Status != "succeeded" || completed.Succeeded != 1 || completed.Failed != 1 {
		t.Fatalf("GetCodexQuotaBatchRefreshJob = %#v, err = %v", completed, err)
	}
	if len(completed.Items) != 1 || completed.Items[0].AccountKey != "acct_runtime" || completed.Items[0].PlanType != "team" {
		t.Fatalf("job items = %#v", completed.Items)
	}
	if len(completed.Errors) != 1 || completed.Errors[0].AccountKey != "acct_failed" {
		t.Fatalf("job errors = %#v", completed.Errors)
	}
}
