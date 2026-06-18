package wailsapp

import (
	"fmt"
	"strings"
	"time"

	"github.com/linhay/gettokens/internal/cliproxyapi"
	"github.com/linhay/gettokens/internal/sidecar"
)

const doctorDefaultMaxEvidence = 4
const doctorStatusHash = "#frame=status"
const doctorRouteDecisionsHash = "#frame=codex&workspace=account-list"

var doctorSidecarStatusOverride func(*App) (sidecar.Status, bool)

func (a *App) GetDoctorSnapshot(input DoctorSnapshotInput) (*DoctorSnapshot, error) {
	now := time.Now().UTC()
	maxEvidence := input.MaxEvidencePerCheck
	if maxEvidence <= 0 {
		maxEvidence = doctorDefaultMaxEvidence
	}

	status := a.doctorSidecarStatus()
	sidecarReady := status.Code == sidecar.StatusReady
	if !sidecarReady {
		checks := []DoctorCheck{doctorCheck(
			"sidecar-runtime-not-ready",
			"sidecar-readiness",
			"Sidecar runtime not ready",
			"not_ready",
			sidecarNotReadyReason(status),
			"manual",
			"wails",
			"high",
			now,
			[]DoctorEvidenceRef{{
				Kind:    "sidecar_status",
				Label:   string(status.Code),
				Summary: strings.TrimSpace(status.Message),
				RefID:   fmt.Sprintf("sidecar:%s", status.Code),
				Source:  "wails-aggregate",
			}},
			[]DoctorNavigationTarget{{Kind: "status", Label: "Open status", Hash: doctorStatusHash}},
		)}
		checks = limitDoctorEvidence(checks, input.IncludeEvidence, maxEvidence)
		summary := summarizeDoctorChecks(checks)
		return &DoctorSnapshot{
			GeneratedAtUnixMs: now.UnixMilli(),
			Source:            "wails-aggregate",
			SidecarReady:      false,
			Status:            doctorSnapshotStatus(summary),
			Checks:            checks,
			Summary:           summary,
		}, nil
	}

	if snapshot, supported, err := a.managementClient().GetDoctorDiagnostics(); err == nil && supported && snapshot != nil {
		return a.mapDoctorDiagnosticsSnapshot(snapshot, now, input.IncludeEvidence, maxEvidence), nil
	}

	checks := make([]DoctorCheck, 0, 6)
	checks = append(checks, doctorCheck(
		"sidecar-runtime-ready",
		"sidecar-readiness",
		"Sidecar runtime ready",
		"ok",
		"Sidecar reports ready; Doctor can consume read-only runtime surfaces.",
		"none",
		"wails",
		"high",
		now,
		[]DoctorEvidenceRef{{
			Kind:    "sidecar_status",
			Label:   "ready",
			Summary: strings.TrimSpace(status.Message),
			RefID:   fmt.Sprintf("sidecar:%d", status.Port),
			Source:  "wails-aggregate",
		}},
		[]DoctorNavigationTarget{{Kind: "status", Label: "Open status", Hash: doctorStatusHash}},
	))
	checks = append(checks, a.doctorRouteDecisionCheck(now)...)
	checks = append(checks, a.doctorQuotaFactCheck(now)...)
	checks = limitDoctorEvidence(checks, input.IncludeEvidence, maxEvidence)
	summary := summarizeDoctorChecks(checks)

	return &DoctorSnapshot{
		GeneratedAtUnixMs: now.UnixMilli(),
		Source:            "wails-aggregate",
		SidecarReady:      sidecarReady,
		Status:            doctorSnapshotStatus(summary),
		Checks:            checks,
		Summary:           summary,
	}, nil
}

func (a *App) doctorSidecarStatus() sidecar.Status {
	if doctorSidecarStatusOverride != nil {
		if status, ok := doctorSidecarStatusOverride(a); ok {
			return status
		}
	}
	return a.GetSidecarStatus()
}

func (a *App) doctorRouteDecisionCheck(now time.Time) []DoctorCheck {
	decisions, err := a.ListChannelRouteDecisions(ChannelRouteDecisionsInput{Channel: "codex", Limit: 10})
	if err != nil {
		return []DoctorCheck{doctorCheck(
			"route-decisions-unavailable",
			"route-guard-stale-block",
			"Route decision facts unavailable",
			"degraded",
			"Doctor could not read sidecar route decisions; no routeability conclusion was inferred.",
			"manual",
			"sidecar",
			"low",
			now,
			[]DoctorEvidenceRef{{Kind: "route_decision", Label: "ListChannelRouteDecisions", Summary: err.Error(), RefID: "channel-routing:decisions", Source: "wails-aggregate"}},
			[]DoctorNavigationTarget{{Kind: "route_decisions", Label: "Open route decisions", Hash: doctorRouteDecisionsHash}},
		)}
	}
	if len(decisions) == 0 {
		return []DoctorCheck{doctorCheck(
			"route-decisions-empty",
			"route-guard-stale-block",
			"Route decision ledger empty",
			"not_ready",
			"Sidecar returned no recent route decisions; stale route guard checks need runtime traffic evidence.",
			"none",
			"sidecar",
			"medium",
			now,
			[]DoctorEvidenceRef{{Kind: "route_decision", Label: "recent decisions", Summary: "No route decisions returned by sidecar.", RefID: "channel-routing:decisions", Source: "sidecar"}},
			[]DoctorNavigationTarget{{Kind: "route_decisions", Label: "Open route decisions", Hash: doctorRouteDecisionsHash}},
		)}
	}

	evidence := make([]DoctorEvidenceRef, 0, len(decisions))
	blocking := 0
	for _, decision := range decisions {
		for _, dropped := range decision.DroppedReasons {
			if !dropped.RouteBlocking {
				continue
			}
			blocking++
			label := doctorFirstNonEmpty(dropped.AccountID, dropped.AuthID, decision.SelectedAccountID, decision.ID)
			routeEvidence := doctorRouteEvidencePayloadFromDroppedReason(dropped)
			evidence = append(evidence, DoctorEvidenceRef{
				Kind:          "route_decision",
				Label:         label,
				Summary:       strings.TrimSpace(dropped.Reason),
				RefID:         doctorFirstNonEmpty(decision.ID, label),
				Source:        "sidecar",
				AccountKey:    routeEvidence.AccountKey,
				AccountID:     routeEvidence.AccountID,
				AuthID:        routeEvidence.AuthID,
				Model:         routeEvidence.Model,
				Scope:         routeEvidence.Scope,
				Reason:        routeEvidence.Reason,
				RouteBlocking: routeEvidence.RouteBlocking,
				RouteEvidence: routeEvidence,
			})
		}
	}
	if blocking == 0 {
		evidence = append(evidence, DoctorEvidenceRef{
			Kind:    "route_decision",
			Label:   "recent decisions",
			Summary: fmt.Sprintf("%d recent decisions read; no route-blocking dropped reasons were reported.", len(decisions)),
			RefID:   doctorFirstNonEmpty(decisions[0].ID, "channel-routing:decisions"),
			Source:  "sidecar",
		})
		return []DoctorCheck{doctorCheck(
			"route-guard-stale-block",
			"route-guard-stale-block",
			"Route guard stale block",
			"ok",
			"Recent route decisions did not report route-blocking dropped reasons.",
			"none",
			"sidecar",
			"medium",
			now,
			evidence,
			[]DoctorNavigationTarget{{Kind: "route_decisions", Label: "Open route decisions", Hash: doctorRouteDecisionsHash}},
		)}
	}
	return []DoctorCheck{doctorCheck(
		"route-guard-stale-block",
		"route-guard-stale-block",
		"Route guard dropped reasons present",
		"warning",
		fmt.Sprintf("Sidecar reported %d route-blocking dropped reason(s); Doctor is surfacing sidecar facts without inferring stale recovery.", blocking),
		"guided",
		"sidecar",
		"medium",
		now,
		evidence,
		[]DoctorNavigationTarget{{Kind: "route_decisions", Label: "Open route decisions", Hash: doctorRouteDecisionsHash}},
	)}
}

func (a *App) doctorQuotaFactCheck(now time.Time) []DoctorCheck {
	statuses, err := a.GetAllQuotaStatuses()
	if err != nil {
		return []DoctorCheck{doctorCheck(
			"quota-facts-unavailable",
			"quota-runtime-fact",
			"Quota facts unavailable",
			"degraded",
			"Doctor could not read sidecar quota statuses; no quota authority conclusion was inferred.",
			"manual",
			"sidecar",
			"low",
			now,
			[]DoctorEvidenceRef{{Kind: "provider", Label: "GetAllQuotaStatuses", Summary: err.Error(), RefID: "quota:all", Source: "wails-aggregate"}},
			[]DoctorNavigationTarget{{Kind: "status", Label: "Open status", Hash: doctorStatusHash}},
		)}
	}
	if len(statuses) == 0 {
		return []DoctorCheck{doctorCheck(
			"quota-facts-empty",
			"quota-runtime-fact",
			"Quota facts not observed",
			"not_ready",
			"Sidecar returned no quota statuses; Doctor is waiting for quota runtime facts.",
			"none",
			"sidecar",
			"medium",
			now,
			[]DoctorEvidenceRef{{Kind: "provider", Label: "quota statuses", Summary: "No quota statuses returned by sidecar.", RefID: "quota:all", Source: "sidecar"}},
			[]DoctorNavigationTarget{{Kind: "status", Label: "Open status", Hash: doctorStatusHash}},
		)}
	}

	evidence := make([]DoctorEvidenceRef, 0, len(statuses))
	warnings := 0
	for _, status := range statuses {
		if status.Fact == nil {
			continue
		}
		state := strings.TrimSpace(status.Fact.State)
		risk := strings.TrimSpace(status.Fact.Risk)
		if risk == "blocking" || risk == "denied" || state == "no_quota" || state == "denied" || state == "stale" {
			warnings++
			evidence = append(evidence, DoctorEvidenceRef{
				Kind:    "provider",
				Label:   doctorFirstNonEmpty(status.AccountKey, "quota fact"),
				Summary: doctorFirstNonEmpty(status.Fact.Explanation, fmt.Sprintf("state=%s risk=%s", state, risk)),
				RefID:   doctorFirstNonEmpty(status.AccountKey, status.Fact.Source),
				Source:  doctorFirstNonEmpty(status.Fact.Source, "sidecar"),
			})
		}
	}
	if warnings == 0 {
		evidence = append(evidence, DoctorEvidenceRef{
			Kind:    "provider",
			Label:   "quota facts",
			Summary: fmt.Sprintf("%d quota status item(s) read; no blocking sidecar quota fact was reported.", len(statuses)),
			RefID:   "quota:all",
			Source:  "sidecar",
		})
		return []DoctorCheck{doctorCheck(
			"quota-runtime-facts",
			"quota-runtime-fact",
			"Quota runtime facts",
			"ok",
			"Sidecar quota facts are readable and do not report blocking risk.",
			"none",
			"sidecar",
			"medium",
			now,
			evidence,
			[]DoctorNavigationTarget{{Kind: "status", Label: "Open status", Hash: doctorStatusHash}},
		)}
	}
	return []DoctorCheck{doctorCheck(
		"quota-runtime-facts",
		"quota-runtime-fact",
		"Quota runtime facts need attention",
		"warning",
		fmt.Sprintf("Sidecar reported %d quota fact(s) with blocking, denied, no_quota, or stale risk.", warnings),
		"manual",
		"sidecar",
		"medium",
		now,
		evidence,
		[]DoctorNavigationTarget{{Kind: "status", Label: "Open status", Hash: doctorStatusHash}},
	)}
}

func doctorCheck(id string, kind string, title string, status string, reason string, repairability string, authority string, confidence string, checkedAt time.Time, evidence []DoctorEvidenceRef, navigation []DoctorNavigationTarget) DoctorCheck {
	return DoctorCheck{
		ID:                  id,
		Kind:                kind,
		Title:               title,
		Status:              status,
		Reason:              strings.TrimSpace(reason),
		Repairability:       repairability,
		Authority:           authority,
		Confidence:          confidence,
		LastCheckedAtUnixMs: checkedAt.UnixMilli(),
		Evidence:            evidence,
		Navigation:          navigation,
	}
}

func sidecarNotReadyReason(status sidecar.Status) string {
	message := strings.TrimSpace(status.Message)
	if message == "" {
		message = "Sidecar has not reported ready."
	}
	return fmt.Sprintf("sidecar status=%s; %s", status.Code, message)
}

func limitDoctorEvidence(checks []DoctorCheck, includeEvidence bool, maxEvidence int) []DoctorCheck {
	out := make([]DoctorCheck, 0, len(checks))
	for _, check := range checks {
		next := check
		if !includeEvidence {
			next.Evidence = nil
		} else if maxEvidence >= 0 && len(next.Evidence) > maxEvidence {
			next.Evidence = append([]DoctorEvidenceRef(nil), next.Evidence[:maxEvidence]...)
		}
		out = append(out, next)
	}
	return out
}

func summarizeDoctorChecks(checks []DoctorCheck) DoctorSummary {
	summary := DoctorSummary{Total: len(checks)}
	for _, check := range checks {
		switch check.Status {
		case "critical":
			summary.Critical++
		case "warning":
			summary.Warning++
		case "not_ready":
			summary.NotReady++
		case "ok":
			summary.OK++
		case "skipped":
			summary.Skipped++
		case "degraded":
			summary.Degraded++
		}
	}
	return summary
}

func doctorSnapshotStatus(summary DoctorSummary) string {
	switch {
	case summary.Critical > 0:
		return "critical"
	case summary.Degraded > 0:
		return "degraded"
	case summary.Warning > 0:
		return "warning"
	case summary.NotReady > 0:
		return "not_ready"
	default:
		return "ok"
	}
}

func doctorFirstNonEmpty(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func (a *App) mapDoctorDiagnosticsSnapshot(snapshot *cliproxyapi.DoctorDiagnosticsResponse, fallbackNow time.Time, includeEvidence bool, maxEvidence int) *DoctorSnapshot {
	if snapshot == nil {
		return &DoctorSnapshot{}
	}
	generatedAt := fallbackNow
	if parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(snapshot.GeneratedAt)); err == nil {
		generatedAt = parsed.UTC()
	}
	checks := make([]DoctorCheck, 0, len(snapshot.Checks))
	for _, item := range snapshot.Checks {
		meta := doctorDiagnosticsCheckMetadata(item.ID)
		checks = append(checks, doctorCheck(
			item.ID,
			meta.kind,
			meta.title,
			doctorDiagnosticsStatus(item.Status),
			item.Reason,
			doctorDiagnosticsRepairability(item.Repairability),
			"sidecar",
			doctorDiagnosticsConfidence(item.Status),
			generatedAt,
			doctorDiagnosticsEvidenceRefs(item.Evidence),
			meta.navigation,
		))
	}
	checks = limitDoctorEvidence(checks, includeEvidence, maxEvidence)
	summary := summarizeDoctorChecks(checks)
	return &DoctorSnapshot{
		GeneratedAtUnixMs: generatedAt.UnixMilli(),
		Source:            doctorFirstNonEmpty(snapshot.Source, "sidecar-diagnostics"),
		SidecarReady:      true,
		Status:            doctorSnapshotStatus(summary),
		Checks:            checks,
		Summary:           summary,
	}
}

type doctorDiagnosticsCheckMeta struct {
	kind       string
	title      string
	navigation []DoctorNavigationTarget
}

func doctorDiagnosticsCheckMetadata(id string) doctorDiagnosticsCheckMeta {
	switch strings.TrimSpace(id) {
	case "route_guard_dropped_reasons":
		return doctorDiagnosticsCheckMeta{
			kind:  "route-guard-stale-block",
			title: "Route guard dropped reasons present",
			navigation: []DoctorNavigationTarget{{
				Kind:  "route_decisions",
				Label: "Open route decisions",
				Hash:  doctorRouteDecisionsHash,
			}},
		}
	case "quota_facts":
		return doctorDiagnosticsCheckMeta{
			kind:  "quota-runtime-fact",
			title: "Quota runtime facts need attention",
			navigation: []DoctorNavigationTarget{{
				Kind:  "status",
				Label: "Open status",
				Hash:  doctorStatusHash,
			}},
		}
	default:
		title := strings.TrimSpace(strings.ReplaceAll(id, "_", " "))
		if title == "" {
			title = "Doctor diagnostic check"
		}
		return doctorDiagnosticsCheckMeta{
			kind:       doctorFirstNonEmpty(id, "doctor-diagnostic"),
			title:      title,
			navigation: []DoctorNavigationTarget{},
		}
	}
}

func doctorDiagnosticsStatus(status string) string {
	switch strings.TrimSpace(status) {
	case "blocking":
		return "critical"
	case "warning":
		return "warning"
	case "not_ready":
		return "not_ready"
	case "ok":
		return "ok"
	case "skipped":
		return "skipped"
	default:
		return "degraded"
	}
}

func doctorDiagnosticsRepairability(value string) string {
	if trimmed := strings.TrimSpace(value); trimmed != "" {
		return trimmed
	}
	return "none"
}

func doctorDiagnosticsConfidence(status string) string {
	switch doctorDiagnosticsStatus(status) {
	case "critical", "warning":
		return "high"
	case "not_ready":
		return "medium"
	default:
		return "medium"
	}
}

func doctorDiagnosticsEvidenceRefs(items []cliproxyapi.DoctorDiagnosticEvidence) []DoctorEvidenceRef {
	if len(items) == 0 {
		return []DoctorEvidenceRef{}
	}
	out := make([]DoctorEvidenceRef, 0, len(items))
	for _, item := range items {
		routeEvidence := doctorRouteEvidencePayloadFromDiagnosticEvidence(item)
		droppedReason := doctorRouteEvidencePayloadFromDiagnosticDroppedReason(item.DroppedReason)
		label := doctorFirstNonEmpty(item.AccountKey, item.AuthID, item.Model, item.State, item.Kind)
		if routeEvidence != nil {
			label = doctorFirstNonEmpty(routeEvidence.AccountKey, routeEvidence.AuthID, routeEvidence.Model, label)
		}
		summary := doctorFirstNonEmpty(
			item.Explanation,
			item.Reason,
			doctorDiagnosticsQuotaFactExplanation(item.QuotaFact),
			doctorDiagnosticsDroppedReasonExplanation(item.DroppedReason),
			doctorDiagnosticsFallbackSummary(item),
		)
		refID := doctorFirstNonEmpty(item.AccountKey, item.AuthID, item.Model, firstEvidenceRef(item.EvidenceRefs), label)
		if routeEvidence != nil {
			refID = doctorFirstNonEmpty(routeEvidence.AccountKey, routeEvidence.AuthID, routeEvidence.Model, refID)
		}
		source := doctorFirstNonEmpty(item.Source, doctorDiagnosticsQuotaFactSource(item.QuotaFact), doctorDiagnosticsDroppedReasonSource(item.DroppedReason), "sidecar")
		next := DoctorEvidenceRef{
			Kind:    doctorFirstNonEmpty(item.Kind, "doctor_diagnostic"),
			Label:   label,
			Summary: summary,
			RefID:   refID,
			Source:  source,
		}
		if quotaFact := doctorQuotaFactFromDiagnosticEvidence(item); quotaFact != nil {
			next.QuotaFact = quotaFact
		}
		if routeEvidence != nil {
			next.AccountKey = routeEvidence.AccountKey
			next.AccountID = routeEvidence.AccountID
			next.AuthID = routeEvidence.AuthID
			next.Model = routeEvidence.Model
			next.Scope = routeEvidence.Scope
			next.Reason = routeEvidence.Reason
			next.RouteBlocking = routeEvidence.RouteBlocking
			next.RouteEvidence = routeEvidence
		}
		if droppedReason != nil {
			next.DroppedReason = droppedReason
		}
		out = append(out, next)
	}
	return out
}

func doctorRouteEvidencePayloadFromDroppedReason(reason ChannelRouteDroppedReason) *DoctorRouteEvidencePayload {
	routeBlocking := reason.RouteBlocking
	return &DoctorRouteEvidencePayload{
		AccountKey:    strings.TrimSpace(reason.AccountID),
		AccountID:     strings.TrimSpace(reason.AccountID),
		AuthID:        strings.TrimSpace(reason.AuthID),
		Model:         strings.TrimSpace(reason.Model),
		Source:        strings.TrimSpace(reason.Source),
		Scope:         strings.TrimSpace(reason.Scope),
		Reason:        strings.TrimSpace(reason.Reason),
		RouteBlocking: &routeBlocking,
	}
}

func doctorRouteEvidencePayloadFromDiagnosticEvidence(item cliproxyapi.DoctorDiagnosticEvidence) *DoctorRouteEvidencePayload {
	if item.DroppedReason == nil {
		return nil
	}
	return doctorRouteEvidencePayloadFromDiagnosticDroppedReason(item.DroppedReason)
}

func doctorRouteEvidencePayloadFromDiagnosticDroppedReason(reason *cliproxyapi.ChannelRoutingDroppedReason) *DoctorRouteEvidencePayload {
	if reason == nil {
		return nil
	}
	routeBlocking := reason.RouteBlocking
	return &DoctorRouteEvidencePayload{
		AccountKey:    doctorFirstNonEmpty(reason.AccountKey, reason.AccountID),
		AccountID:     doctorFirstNonEmpty(reason.AccountID, reason.AccountKey),
		AuthID:        strings.TrimSpace(reason.AuthID),
		Model:         strings.TrimSpace(reason.Model),
		Source:        strings.TrimSpace(reason.Source),
		Scope:         strings.TrimSpace(reason.Scope),
		Reason:        strings.TrimSpace(reason.Reason),
		RouteBlocking: &routeBlocking,
	}
}

func doctorQuotaFactFromDiagnosticEvidence(item cliproxyapi.DoctorDiagnosticEvidence) *CodexQuotaFact {
	if item.QuotaFact != nil {
		return mapQuotaRuntimeFactToCodexQuotaResponse(item.QuotaFact)
	}
	return nil
}

func doctorDiagnosticsFallbackSummary(item cliproxyapi.DoctorDiagnosticEvidence) string {
	if state := doctorFirstNonEmpty(item.State, doctorDiagnosticsQuotaFactState(item.QuotaFact)); state != "" {
		risk := doctorFirstNonEmpty(item.Risk, doctorDiagnosticsQuotaFactRisk(item.QuotaFact))
		if risk != "" {
			return fmt.Sprintf("state=%s risk=%s", state, risk)
		}
		return fmt.Sprintf("state=%s", state)
	}
	if item.RouteBlocking {
		return "route blocking evidence present"
	}
	return "sidecar evidence available"
}

func doctorDiagnosticsDroppedReasonExplanation(reason *cliproxyapi.ChannelRoutingDroppedReason) string {
	if reason == nil {
		return ""
	}
	return strings.TrimSpace(reason.Reason)
}

func doctorDiagnosticsDroppedReasonSource(reason *cliproxyapi.ChannelRoutingDroppedReason) string {
	if reason == nil {
		return ""
	}
	return strings.TrimSpace(reason.Source)
}

func doctorDiagnosticsQuotaFactExplanation(fact *cliproxyapi.QuotaRuntimeFact) string {
	if fact == nil {
		return ""
	}
	return strings.TrimSpace(fact.Explanation)
}

func doctorDiagnosticsQuotaFactSource(fact *cliproxyapi.QuotaRuntimeFact) string {
	if fact == nil {
		return ""
	}
	return strings.TrimSpace(fact.Source)
}

func doctorDiagnosticsQuotaFactState(fact *cliproxyapi.QuotaRuntimeFact) string {
	if fact == nil {
		return ""
	}
	return strings.TrimSpace(fact.State)
}

func doctorDiagnosticsQuotaFactRisk(fact *cliproxyapi.QuotaRuntimeFact) string {
	if fact == nil {
		return ""
	}
	return strings.TrimSpace(fact.Risk)
}

func firstEvidenceRef(items []string) string {
	if len(items) == 0 {
		return ""
	}
	return strings.TrimSpace(items[0])
}
