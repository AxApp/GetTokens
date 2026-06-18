package wailsapp

import (
	"encoding/json"
	"errors"
	"io"
	"net/url"
	"testing"

	"github.com/linhay/gettokens/internal/cliproxyapi"
	"github.com/linhay/gettokens/internal/sidecar"
)

func doctorBoolPtr(value bool) *bool {
	return &value
}

func TestDoctorSnapshotNotReadyReturnsNotReadyCheck(t *testing.T) {
	app := New("dev", "", "AxApp/GetTokens")

	snapshot, err := app.GetDoctorSnapshot(DoctorSnapshotInput{IncludeEvidence: true})
	if err != nil {
		t.Fatalf("GetDoctorSnapshot: %v", err)
	}
	if snapshot.SidecarReady {
		t.Fatal("SidecarReady = true, want false")
	}
	if snapshot.Status != "not_ready" {
		t.Fatalf("Status = %q, want not_ready", snapshot.Status)
	}
	if snapshot.Summary.NotReady == 0 {
		t.Fatalf("Summary.NotReady = 0, snapshot = %#v", snapshot)
	}
	check := findDoctorCheck(snapshot.Checks, "sidecar-runtime-not-ready")
	if check == nil || check.Status != "not_ready" || check.Authority != "wails" {
		t.Fatalf("not-ready check mismatch: %#v", check)
	}
}

func TestDoctorSnapshotDegradesWhenReadonlySurfacesFail(t *testing.T) {
	app := New("dev", "", "AxApp/GetTokens")
	previousOverride := doctorSidecarStatusOverride
	doctorSidecarStatusOverride = func(*App) (sidecar.Status, bool) {
		return sidecar.Status{Code: sidecar.StatusReady, Port: 8317, Message: "ready"}, true
	}
	t.Cleanup(func() {
		doctorSidecarStatusOverride = previousOverride
	})
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			return nil, 0, errors.New("management offline")
		})
	}

	snapshot, err := app.GetDoctorSnapshot(DoctorSnapshotInput{IncludeEvidence: true})
	if err != nil {
		t.Fatalf("GetDoctorSnapshot: %v", err)
	}
	if !snapshot.SidecarReady {
		t.Fatal("SidecarReady = false, want true")
	}
	if snapshot.Status != "degraded" {
		t.Fatalf("Status = %q, want degraded", snapshot.Status)
	}
	if snapshot.Summary.Degraded != 2 {
		t.Fatalf("Summary.Degraded = %d, want 2; checks=%#v", snapshot.Summary.Degraded, snapshot.Checks)
	}
	for _, id := range []string{"route-decisions-unavailable", "quota-facts-unavailable"} {
		check := findDoctorCheck(snapshot.Checks, id)
		if check == nil || check.Status != "degraded" || len(check.Evidence) == 0 {
			t.Fatalf("degraded check %s mismatch: %#v", id, check)
		}
	}
}

func TestDoctorSnapshotPrefersSidecarDiagnosticsWhenAvailable(t *testing.T) {
	app := New("dev", "", "AxApp/GetTokens")
	previousOverride := doctorSidecarStatusOverride
	doctorSidecarStatusOverride = func(*App) (sidecar.Status, bool) {
		return sidecar.Status{Code: sidecar.StatusReady, Port: 8317, Message: "ready"}, true
	}
	t.Cleanup(func() {
		doctorSidecarStatusOverride = previousOverride
	})
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			if method != "GET" || path != "/v0/management/gettokens/doctor-diagnostics" {
				t.Fatalf("unexpected request: %s %s", method, path)
			}
			return []byte(`{
				"authority":"sidecar",
				"source":"sidecar-diagnostics",
				"generatedAt":"2026-06-17T08:00:00Z",
				"summary":{"status":"warning","total":2,"ok":0,"notReady":0,"warning":2,"blocking":0,"evidence":2},
				"checks":[
					{
						"id":"route_guard_dropped_reasons",
						"status":"warning",
						"reason":"Active route guard dropped reason evidence is present.",
						"repairability":"read_only",
						"evidence":[
							{"kind":"route_dropped_reason","accountKey":"acct_wrong","accountId":"acct_wrong","authId":"auth_wrong","source":"wrong-source","scope":"provider","model":"wrong-model","reason":"wrong top level","routeBlocking":false,"droppedReason":{"accountKey":"acct_route_001","accountId":"acct_route_001","authId":"auth_route_001","source":"upstream-rate-limit","scope":"account","reason":"upstream 429 active cooldown","model":"gpt-5","routeBlocking":true}}
						]
					},
					{
						"id":"quota_facts",
						"status":"warning",
						"reason":"Quota runtime facts are available from sidecar runtime state.",
						"repairability":"read_only",
						"evidence":[
							{"kind":"quota_fact","accountKey":"acct_quota_001","source":"quota-curl","state":"denied","freshness":"fresh","confidence":"high","risk":"denied","explanation":"top-level quota fields should not win","evidenceRefs":["quota-status:top-level"],"quotaFact":{"state":"denied","source":"quota-curl","freshness":"fresh","confidence":"high","risk":"denied","explanation":"Provider denied quota check","observed_at":"2026-06-17T08:00:00Z","evidence_refs":["quota-status:acct_quota_001"]}}
						]
					}
				]
			}`), 200, nil
		})
	}

	snapshot, err := app.GetDoctorSnapshot(DoctorSnapshotInput{IncludeEvidence: true})
	if err != nil {
		t.Fatalf("GetDoctorSnapshot: %v", err)
	}
	if snapshot == nil {
		t.Fatal("snapshot = nil")
	}
	if snapshot.Source != "sidecar-diagnostics" || !snapshot.SidecarReady {
		t.Fatalf("snapshot source/readiness mismatch: %#v", snapshot)
	}
	if snapshot.Status != "warning" {
		t.Fatalf("snapshot status = %q, want warning", snapshot.Status)
	}
	if snapshot.Summary.Total != 2 || snapshot.Summary.Warning != 2 || snapshot.Summary.Critical != 0 {
		t.Fatalf("summary mismatch: %#v", snapshot.Summary)
	}
	route := findDoctorCheck(snapshot.Checks, "route_guard_dropped_reasons")
	if route == nil || route.Status != "warning" || route.Repairability != "read_only" || len(route.Evidence) != 1 {
		t.Fatalf("route check mismatch: %#v", route)
	}
	if route.Evidence[0].RouteEvidence == nil || route.Evidence[0].RouteEvidence.AccountKey != "acct_route_001" || route.Evidence[0].RouteEvidence.Model != "gpt-5" || route.Evidence[0].RouteEvidence.Scope != "account" || route.Evidence[0].RouteEvidence.RouteBlocking == nil || !*route.Evidence[0].RouteEvidence.RouteBlocking {
		t.Fatalf("route typed evidence mismatch: %#v", route.Evidence[0].RouteEvidence)
	}
	if route.Evidence[0].DroppedReason == nil || route.Evidence[0].DroppedReason.AccountKey != "acct_route_001" || route.Evidence[0].DroppedReason.AuthID != "auth_route_001" || route.Evidence[0].DroppedReason.Source != "upstream-rate-limit" || route.Evidence[0].DroppedReason.RouteBlocking == nil || !*route.Evidence[0].DroppedReason.RouteBlocking {
		t.Fatalf("nested droppedReason passthrough mismatch: %#v", route.Evidence[0].DroppedReason)
	}
	if route.Evidence[0].AccountKey != "acct_route_001" || route.Evidence[0].AuthID != "auth_route_001" || route.Evidence[0].Reason != "upstream 429 active cooldown" {
		t.Fatalf("route evidence top-level passthrough = %#v, want nested droppedReason to win", route.Evidence[0])
	}
	quota := findDoctorCheck(snapshot.Checks, "quota_facts")
	if quota == nil || quota.Status != "warning" || len(quota.Evidence) != 1 || quota.Evidence[0].Source != "quota-curl" {
		t.Fatalf("quota check mismatch: %#v", quota)
	}
	if quota.Evidence[0].QuotaFact == nil || quota.Evidence[0].QuotaFact.State != "denied" || quota.Evidence[0].QuotaFact.Risk != "denied" || len(quota.Evidence[0].QuotaFact.EvidenceRefs) != 1 {
		t.Fatalf("quota typed fact mismatch: %#v", quota.Evidence[0].QuotaFact)
	}
}

func TestDoctorEvidenceRefJSONPreservesDroppedReasonTypedPayload(t *testing.T) {
	payload := DoctorEvidenceRef{
		Kind:       "route_dropped_reason",
		Label:      "misleading label text",
		Summary:    "misleading summary text",
		RefID:      "misleading-ref",
		Source:     "sidecar",
		AccountKey: "top-level-account-should-not-be-authority",
		DroppedReason: &DoctorRouteEvidencePayload{
			AccountKey:    "acct_route_001",
			AccountID:     "acct_route_001",
			AuthID:        "auth_route_001",
			Model:         "gpt-5",
			Source:        "upstream-rate-limit",
			Scope:         "account",
			Reason:        "nested droppedReason survives DTO JSON",
			RouteBlocking: doctorBoolPtr(true),
		},
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal DoctorEvidenceRef: %v", err)
	}
	var decoded DoctorEvidenceRef
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		t.Fatalf("unmarshal DoctorEvidenceRef: %v", err)
	}
	if decoded.DroppedReason == nil {
		t.Fatalf("decoded droppedReason missing from %s", encoded)
	}
	if decoded.DroppedReason.AccountKey != "acct_route_001" || decoded.DroppedReason.AuthID != "auth_route_001" || decoded.DroppedReason.Model != "gpt-5" || decoded.DroppedReason.Source != "upstream-rate-limit" || decoded.DroppedReason.Scope != "account" || decoded.DroppedReason.Reason != "nested droppedReason survives DTO JSON" {
		t.Fatalf("decoded droppedReason mismatch: %#v", decoded.DroppedReason)
	}
	if decoded.DroppedReason.RouteBlocking == nil || !*decoded.DroppedReason.RouteBlocking {
		t.Fatalf("decoded routeBlocking mismatch: %#v", decoded.DroppedReason.RouteBlocking)
	}
}

func TestDoctorSnapshotFallsBackWhenSidecarDiagnosticsUnsupported(t *testing.T) {
	app := New("dev", "", "AxApp/GetTokens")
	previousOverride := doctorSidecarStatusOverride
	doctorSidecarStatusOverride = func(*App) (sidecar.Status, bool) {
		return sidecar.Status{Code: sidecar.StatusReady, Port: 8317, Message: "ready"}, true
	}
	t.Cleanup(func() {
		doctorSidecarStatusOverride = previousOverride
	})
	app.managementAPI = func() *cliproxyapi.Client {
		return cliproxyapi.New(func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error) {
			switch path {
			case "/v0/management/gettokens/doctor-diagnostics":
				return []byte(`{"error":"not found"}`), 404, nil
			case "/v0/management/gettokens/channel-routing/decisions":
				return []byte(`{"items":[{"id":"decision-1","recordedAt":"2026-06-17T08:00:00Z","channel":"codex","providers":["codex"],"model":"gpt-5","candidateCount":1,"selectedAuthID":"auth-route-1","selectedAccountID":"acct-route-1","selectedProvider":"codex","candidates":[{"authID":"auth-route-1","accountID":"acct-route-1","provider":"codex"}],"droppedReasons":[{"accountID":"acct-route-2","authID":"auth-route-2","source":"rate-limit","scope":"account","reason":"request window exhausted","model":"gpt-5","expiresAt":"2026-06-17T08:05:00Z","updatedAt":"2026-06-17T08:00:00Z","routeBlocking":true}],"trace":[]}]}`), 200, nil
			case "/v0/management/gettokens/quota-status":
				return []byte(`{"items":[{"account_key":"acct-quota-1","source":"quota-runtime","status":"success","plan_type":"pro","windows":[{"id":"weekly","label":"7D","remaining_percent":0,"reset_label":"06/20 18:00","reset_at_unix":1781959200}],"blocked":true,"sources":[],"fact":{"state":"no_quota","source":"quota-runtime","freshness":"fresh","confidence":"high","risk":"blocking","explanation":"weekly window exhausted","evidence_refs":["window:weekly"]}}]}`), 200, nil
			default:
				t.Fatalf("unexpected request path: %s", path)
			}
			return nil, 0, nil
		})
	}

	snapshot, err := app.GetDoctorSnapshot(DoctorSnapshotInput{IncludeEvidence: true})
	if err != nil {
		t.Fatalf("GetDoctorSnapshot: %v", err)
	}
	if snapshot == nil {
		t.Fatal("snapshot = nil")
	}
	if snapshot.Source != "wails-aggregate" {
		t.Fatalf("snapshot.Source = %q, want wails-aggregate fallback", snapshot.Source)
	}
	if !snapshot.SidecarReady {
		t.Fatal("snapshot.SidecarReady = false, want true")
	}
	if findDoctorCheck(snapshot.Checks, "route_guard_dropped_reasons") != nil {
		t.Fatalf("snapshot checks = %#v, want fallback aggregate ids instead of sidecar diagnostics ids", snapshot.Checks)
	}
	if findDoctorCheck(snapshot.Checks, "route-guard-stale-block") == nil {
		t.Fatalf("snapshot checks = %#v, want fallback route aggregate check", snapshot.Checks)
	}
	route := findDoctorCheck(snapshot.Checks, "route-guard-stale-block")
	if route == nil || len(route.Evidence) != 1 {
		t.Fatalf("route aggregate evidence mismatch: %#v", route)
	}
	evidence := route.Evidence[0]
	if evidence.AccountKey != "acct-route-2" || evidence.AuthID != "auth-route-2" || evidence.Model != "gpt-5" || evidence.Scope != "account" || evidence.Reason != "request window exhausted" {
		t.Fatalf("typed route evidence mismatch: %#v", evidence)
	}
	if evidence.RouteBlocking == nil || !*evidence.RouteBlocking {
		t.Fatalf("routeBlocking = %#v, want true", evidence.RouteBlocking)
	}
	if evidence.RouteEvidence == nil || evidence.RouteEvidence.AccountKey != "acct-route-2" || evidence.RouteEvidence.AuthID != "auth-route-2" || evidence.RouteEvidence.Source != "rate-limit" || evidence.RouteEvidence.Scope != "account" || evidence.RouteEvidence.Model != "gpt-5" || evidence.RouteEvidence.Reason != "request window exhausted" || evidence.RouteEvidence.RouteBlocking == nil || !*evidence.RouteEvidence.RouteBlocking {
		t.Fatalf("nested routeEvidence mismatch: %#v", evidence.RouteEvidence)
	}
	if findDoctorCheck(snapshot.Checks, "quota-runtime-facts") == nil {
		t.Fatalf("snapshot checks = %#v, want fallback quota aggregate check", snapshot.Checks)
	}
}

func findDoctorCheck(checks []DoctorCheck, id string) *DoctorCheck {
	for index := range checks {
		if checks[index].ID == id {
			return &checks[index]
		}
	}
	return nil
}
