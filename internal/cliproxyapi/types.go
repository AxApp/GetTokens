package cliproxyapi

import (
	"bytes"
	"encoding/json"
)

type CodexModel struct {
	Name  string `json:"name"`
	Alias string `json:"alias"`
}

type CodexAPIKey struct {
	LocalID        string            `json:"local-id,omitempty"`
	APIKey         string            `json:"api-key"`
	Label          string            `json:"label,omitempty"`
	Priority       int               `json:"priority,omitempty"`
	Disabled       bool              `json:"disabled,omitempty"`
	Prefix         string            `json:"prefix,omitempty"`
	BaseURL        string            `json:"base-url"`
	FormatBaseURLs map[string]string `json:"format-base-urls,omitempty"`
	Websockets     bool              `json:"websockets,omitempty"`
	ProxyURL       string            `json:"proxy-url,omitempty"`
	Models         []CodexModel      `json:"models,omitempty"`
	Headers        map[string]string `json:"headers,omitempty"`
	ExcludedModels []string          `json:"excluded-models,omitempty"`
	AuthIndex      string            `json:"auth-index,omitempty"`
	QuotaCurl      string            `json:"quota-curl,omitempty"`
	QuotaEnabled   bool              `json:"quota-enabled,omitempty"`
	BillingCurl    string            `json:"billing-curl,omitempty"`
	BillingEnabled bool              `json:"billing-enabled,omitempty"`
	PlatformCookie string            `json:"platform-cookie,omitempty"`
	CurlVariables  map[string]string `json:"curl-variables,omitempty"`
}

type CodexAPIKeysResponse struct {
	Items []CodexAPIKey `json:"codex-api-key"`
}

type CodexAPIKeyInput struct {
	LocalID        string            `json:"local-id,omitempty"`
	APIKey         string            `json:"api-key"`
	Label          string            `json:"label,omitempty"`
	Priority       int               `json:"priority,omitempty"`
	Disabled       bool              `json:"disabled,omitempty"`
	Prefix         string            `json:"prefix,omitempty"`
	BaseURL        string            `json:"base-url"`
	FormatBaseURLs map[string]string `json:"format-base-urls,omitempty"`
	Websockets     bool              `json:"websockets,omitempty"`
	ProxyURL       string            `json:"proxy-url,omitempty"`
	Models         []CodexModel      `json:"models,omitempty"`
	Headers        map[string]string `json:"headers,omitempty"`
	ExcludedModels []string          `json:"excluded-models,omitempty"`
	QuotaCurl      string            `json:"quota-curl,omitempty"`
	QuotaEnabled   bool              `json:"quota-enabled,omitempty"`
	BillingCurl    string            `json:"billing-curl,omitempty"`
	BillingEnabled bool              `json:"billing-enabled,omitempty"`
	PlatformCookie string            `json:"platform-cookie,omitempty"`
	CurlVariables  map[string]string `json:"curl-variables,omitempty"`
}

type CodexAPIKeyPatch struct {
	APIKey         *string            `json:"api-key,omitempty"`
	Disabled       *bool              `json:"disabled,omitempty"`
	Prefix         *string            `json:"prefix,omitempty"`
	BaseURL        *string            `json:"base-url,omitempty"`
	ProxyURL       *string            `json:"proxy-url,omitempty"`
	Models         *[]CodexModel      `json:"models,omitempty"`
	Headers        *map[string]string `json:"headers,omitempty"`
	ExcludedModels *[]string          `json:"excluded-models,omitempty"`
}

type OpenAICompatibleAPIKeyEntry struct {
	APIKey    string `json:"api-key"`
	ProxyURL  string `json:"proxy-url,omitempty"`
	AuthIndex string `json:"auth-index,omitempty"`
}

type OpenAICompatibleModel struct {
	Name  string `json:"name"`
	Alias string `json:"alias"`
}

type OAuthModelAlias struct {
	Name  string `json:"name"`
	Alias string `json:"alias"`
	Fork  bool   `json:"fork,omitempty"`
}

type OAuthModelAliasesResponse struct {
	Items map[string][]OAuthModelAlias `json:"oauth-model-alias"`
}

type OpenAICompatibleProvider struct {
	Name           string                        `json:"name"`
	Priority       int                           `json:"priority,omitempty"`
	Disabled       bool                          `json:"disabled,omitempty"`
	Prefix         string                        `json:"prefix,omitempty"`
	BaseURL        string                        `json:"base-url"`
	APIKeyEntries  []OpenAICompatibleAPIKeyEntry `json:"api-key-entries,omitempty"`
	QuotaCurl      string                        `json:"quota-curl,omitempty"`
	QuotaEnabled   bool                          `json:"quota-enabled,omitempty"`
	BillingCurl    string                        `json:"billing-curl,omitempty"`
	BillingEnabled bool                          `json:"billing-enabled,omitempty"`
	PlatformCookie string                        `json:"platform-cookie,omitempty"`
	CurlVariables  map[string]string             `json:"curl-variables,omitempty"`
	Models         []OpenAICompatibleModel       `json:"models,omitempty"`
	Headers        map[string]string             `json:"headers,omitempty"`
	FormatBaseURLs map[string]string             `json:"format-base-urls,omitempty"`
}

type OpenAICompatibleProvidersResponse struct {
	Items []OpenAICompatibleProvider `json:"openai-compatibility"`
}

type AccountKind string

const (
	AccountKindAuthFile         AccountKind = "auth-file"
	AccountKindCodexAPIKey      AccountKind = "codex-api-key"
	AccountKindOpenAICompatible AccountKind = "openai-compatible"
)

type AccountCredentialSource string

const (
	AccountCredentialSourceSidecarManagementAPI AccountCredentialSource = "sidecar-management-api"
)

type AuthFileAccountCredential struct {
	SourceFileName string `json:"source_file_name,omitempty"`
	AuthJSON       string `json:"auth_json,omitempty"`
	AuthType       string `json:"auth_type,omitempty"`
	Email          string `json:"email,omitempty"`
	PlanType       string `json:"plan_type,omitempty"`
	ModifiedUnixMs int64  `json:"modified_unix_ms,omitempty"`
	SizeBytes      int64  `json:"size_bytes,omitempty"`
}

type CodexAPIKeyAccountCredential struct {
	APIKey             string `json:"api_key"`
	APIKeyFingerprint  string `json:"api_key_fingerprint,omitempty"`
	BaseURL            string `json:"base_url"`
	Prefix             string `json:"prefix,omitempty"`
	ProxyURL           string `json:"proxy_url,omitempty"`
	Websockets         bool   `json:"websockets"`
	QuotaCurl          string `json:"quota_curl,omitempty"`
	QuotaEnabled       bool   `json:"quota_enabled,omitempty"`
	BillingCurl        string `json:"billing_curl,omitempty"`
	BillingEnabled     bool   `json:"billing_enabled,omitempty"`
	PlatformCookie     string `json:"platform_cookie,omitempty"`
	CurlVariablesJSON  string `json:"curl_variables_json,omitempty"`
	FormatBaseURLsJSON string `json:"format_base_urls_json,omitempty"`
	HeadersJSON        string `json:"headers_json,omitempty"`
	ModelsJSON         string `json:"models_json,omitempty"`
	ExcludedModelsJSON string `json:"excluded_models_json,omitempty"`
}

type OpenAICompatibleAccountCredential struct {
	ProviderName       string `json:"provider_name"`
	RuntimeProviderKey string `json:"runtime_provider_key,omitempty"`
	BaseURL            string `json:"base_url"`
	Prefix             string `json:"prefix,omitempty"`
	APIKeyEntriesJSON  string `json:"api_key_entries_json"`
	QuotaCurl          string `json:"quota_curl,omitempty"`
	QuotaEnabled       bool   `json:"quota_enabled,omitempty"`
	BillingCurl        string `json:"billing_curl,omitempty"`
	BillingEnabled     bool   `json:"billing_enabled,omitempty"`
	PlatformCookie     string `json:"platform_cookie,omitempty"`
	CurlVariablesJSON  string `json:"curl_variables_json,omitempty"`
	HeadersJSON        string `json:"headers_json,omitempty"`
	FormatBaseURLsJSON string `json:"format_base_urls_json,omitempty"`
	ModelsJSON         string `json:"models_json,omitempty"`
	ModelFetchAPIKey   string `json:"model_fetch_api_key,omitempty"`
	ModelFetchBaseURL  string `json:"model_fetch_base_url,omitempty"`
}

type UnifiedAccount struct {
	AccountKey                   string                  `json:"account_key"`
	Kind                         AccountKind             `json:"kind"`
	Title                        string                  `json:"title"`
	Provider                     string                  `json:"provider"`
	CredentialSource             AccountCredentialSource `json:"credential_source"`
	Priority                     int                     `json:"priority"`
	Disabled                     bool                    `json:"disabled"`
	Revision                     int                     `json:"revision"`
	CredentialStatus             string                  `json:"credential_status,omitempty"`
	CredentialGeneration         int64                   `json:"credential_generation,omitempty"`
	MetadataJSON                 string                  `json:"metadata_json,omitempty"`
	CreatedAtUnixMs              int64                   `json:"created_at_unix_ms,omitempty"`
	UpdatedAtUnixMs              int64                   `json:"updated_at_unix_ms,omitempty"`
	DeletedAtUnixMs              int64                   `json:"deleted_at_unix_ms,omitempty"`
	RuntimeApplyStatus           string                  `json:"runtime_apply_status,omitempty"`
	RuntimeApplyError            string                  `json:"runtime_apply_error,omitempty"`
	RuntimeRouteabilityStatus    string                  `json:"runtime_routeability_status,omitempty"`
	RuntimeRouteabilityReason    string                  `json:"runtime_routeability_reason,omitempty"`
	RuntimeRegisteredModelsCount int                     `json:"runtime_registered_models_count,omitempty"`
	LastRuntimeReconcileAtUnixMs int64                   `json:"last_runtime_reconcile_at_unix_ms,omitempty"`
	RuntimeFailureClass          string                  `json:"runtime_failure_class,omitempty"`
	RuntimeRepairOutcome         string                  `json:"runtime_repair_outcome,omitempty"`
	RuntimeRepairAction          string                  `json:"runtime_repair_action,omitempty"`
	RuntimeRepairTriggerStatus   string                  `json:"runtime_repair_trigger_status,omitempty"`
	RuntimeRepairTriggerClass    string                  `json:"runtime_repair_trigger_class,omitempty"`
	RuntimeRepairTriggerReason   string                  `json:"runtime_repair_trigger_reason,omitempty"`
	LastRuntimeRepairAtUnixMs    int64                   `json:"last_runtime_repair_at_unix_ms,omitempty"`

	AuthFile         *AuthFileAccountCredential         `json:"auth_file,omitempty"`
	CodexAPIKey      *CodexAPIKeyAccountCredential      `json:"codex_api_key,omitempty"`
	OpenAICompatible *OpenAICompatibleAccountCredential `json:"openai_compatible,omitempty"`
}

type UnifiedAccountsResponse struct {
	Items             []UnifiedAccount `json:"accounts"`
	InventoryRevision string           `json:"inventory_revision,omitempty"`
}

type UnifiedAccountInventory struct {
	Accounts          []UnifiedAccount
	InventoryRevision string
}

type AccountMigrationCandidate struct {
	AccountKey        string                  `json:"account_key"`
	Kind              AccountKind             `json:"kind"`
	Title             string                  `json:"title"`
	Provider          string                  `json:"provider"`
	CredentialSource  AccountCredentialSource `json:"credential_source"`
	Priority          int                     `json:"priority"`
	Disabled          bool                    `json:"disabled"`
	LegacyID          string                  `json:"legacy_id"`
	SourcePath        string                  `json:"source_path,omitempty"`
	SourceKey         string                  `json:"source_key,omitempty"`
	SourceFingerprint string                  `json:"source_fingerprint,omitempty"`
}

type AccountMigrationReport struct {
	GeneratedAtUnixMs int64                       `json:"generated_at_unix_ms"`
	Candidates        []AccountMigrationCandidate `json:"candidates"`
	Warnings          []string                    `json:"warnings,omitempty"`
}

type AccountMigrationCommitReport struct {
	Imported int      `json:"imported"`
	Skipped  int      `json:"skipped"`
	Errors   []string `json:"errors,omitempty"`
}

type AccountMigrationDeleteResult struct {
	Deleted   int                                `json:"deleted"`
	BackupDir string                             `json:"backup_dir,omitempty"`
	Items     []AccountMigrationDeleteResultItem `json:"items,omitempty"`
}

type AccountMigrationDeleteResultItem struct {
	ID         string `json:"id"`
	SourceKind string `json:"source_kind"`
	SourcePath string `json:"source_path,omitempty"`
	BackupPath string `json:"backup_path,omitempty"`
	Deleted    bool   `json:"deleted"`
}

type AccountWriteRequest struct {
	ExpectedRevision *int                               `json:"expected_revision,omitempty"`
	Kind             AccountKind                        `json:"kind"`
	Title            string                             `json:"title,omitempty"`
	Provider         string                             `json:"provider,omitempty"`
	Priority         int                                `json:"priority,omitempty"`
	Disabled         bool                               `json:"disabled,omitempty"`
	AuthFile         *AuthFileAccountCredential         `json:"auth_file,omitempty"`
	CodexAPIKey      *CodexAPIKeyAccountCredential      `json:"codex_api_key,omitempty"`
	OpenAICompatible *OpenAICompatibleAccountCredential `json:"openai_compatible,omitempty"`
}

type AccountStoreDiagnostics struct {
	PathBasename string                              `json:"path_basename"`
	Configured   bool                                `json:"configured"`
	Open         bool                                `json:"open"`
	ReadRecovery AccountStoreReadRecoveryDiagnostics `json:"read_recovery"`
}

type AccountStoreReadRecoveryDiagnostics struct {
	Count             int    `json:"count"`
	LastEndpoint      string `json:"last_endpoint"`
	LastRecovered     bool   `json:"last_recovered"`
	LastError         string `json:"last_error"`
	LastRecoveredUnix int64  `json:"last_recovered_at_unix_ms"`
}

type RateLimitStrategyMeta struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	SupportedWindows []string `json:"supported_windows"`
}

type RateLimitRule struct {
	ID         string `json:"id,omitempty"`
	AccountKey string `json:"account_key"`
	Strategy   string `json:"strategy"`
	Window     string `json:"window"`
	LimitValue int64  `json:"limit_value"`
	Action     string `json:"action"`
	Enabled    bool   `json:"enabled"`
	Label      string `json:"label,omitempty"`
	CreatedAt  int64  `json:"created_at,omitempty"`
	UpdatedAt  int64  `json:"updated_at,omitempty"`
}

type RateLimitRuleState struct {
	Rule         RateLimitRule `json:"rule"`
	Exceeded     bool          `json:"exceeded"`
	Reason       string        `json:"reason,omitempty"`
	UsagePct     float64       `json:"usage_pct"`
	CurrentUsage int64         `json:"current_usage"`
	LimitValue   int64         `json:"limit_value"`
	WindowStart  string        `json:"window_start,omitempty"`
	WindowEnd    string        `json:"window_end,omitempty"`
	NextReset    string        `json:"next_reset,omitempty"`
}

type RateLimitSourceState struct {
	Source      string `json:"source"`
	Reason      string `json:"reason,omitempty"`
	RuleID      string `json:"rule_id,omitempty"`
	Strategy    string `json:"strategy,omitempty"`
	Window      string `json:"window,omitempty"`
	UsageValue  int64  `json:"usage_value,omitempty"`
	LimitValue  int64  `json:"limit_value,omitempty"`
	WindowStart string `json:"window_start,omitempty"`
	WindowEnd   string `json:"window_end,omitempty"`
	NextReset   string `json:"next_reset,omitempty"`
}

type RateLimitState struct {
	AccountKey      string                 `json:"account_key"`
	Blocked         bool                   `json:"blocked"`
	BlockReason     string                 `json:"block_reason,omitempty"`
	Sources         []RateLimitSourceState `json:"sources"`
	Rules           []RateLimitRuleState   `json:"rules"`
	UpdatedAt       string                 `json:"updated_at,omitempty"`
	LastEvaluatedAt string                 `json:"last_evaluated_at,omitempty"`
	NextReset       string                 `json:"next_reset,omitempty"`
	Stale           bool                   `json:"stale,omitempty"`
	DegradedReason  string                 `json:"degraded_reason,omitempty"`
}

type RateLimitEvent struct {
	ID          string `json:"id"`
	AccountKey  string `json:"account_key"`
	RuleID      string `json:"rule_id"`
	Strategy    string `json:"strategy"`
	Window      string `json:"window"`
	Action      string `json:"action"`
	UsageValue  int64  `json:"usage_value"`
	LimitValue  int64  `json:"limit_value"`
	Blocked     bool   `json:"blocked"`
	Reason      string `json:"reason,omitempty"`
	TriggeredAt int64  `json:"triggered_at"`
}

type ProjectCandidatePoolRule struct {
	ID                   string   `json:"id,omitempty"`
	Channel              string   `json:"channel"`
	ProjectKey           string   `json:"projectKey"`
	ProjectName          string   `json:"projectName,omitempty"`
	ProjectKeySource     string   `json:"projectKeySource,omitempty"`
	ProjectKeyConfidence string   `json:"projectKeyConfidence,omitempty"`
	Enabled              bool     `json:"enabled"`
	AllowAccountIDs      []string `json:"allowAccountIDs"`
	CreatedAt            string   `json:"createdAt,omitempty"`
	UpdatedAt            string   `json:"updatedAt,omitempty"`
}

const (
	QuotaRuntimeStatusSuccess  = "success"
	QuotaRuntimeStatusError    = "error"
	QuotaRuntimeStatusStale    = "stale"
	QuotaRuntimeStatusDegraded = "degraded"
)

type QuotaRuntimeWindow struct {
	ID               string   `json:"id"`
	Label            string   `json:"label"`
	RemainingPercent *int     `json:"remaining_percent,omitempty"`
	UsedTokens       *float64 `json:"used_tokens,omitempty"`
	LimitTokens      *float64 `json:"limit_tokens,omitempty"`
	RemainingTokens  *float64 `json:"remaining_tokens,omitempty"`
	ResetLabel       string   `json:"reset_label,omitempty"`
	ResetAtUnix      int64    `json:"reset_at_unix,omitempty"`
}

type QuotaRuntimeBilling struct {
	IsAvailable  bool                      `json:"is_available"`
	BalanceInfos []QuotaRuntimeBalanceInfo `json:"balance_infos"`
}

type QuotaRuntimeBalanceInfo struct {
	Currency        string `json:"currency"`
	TotalBalance    string `json:"total_balance"`
	GrantedBalance  string `json:"granted_balance"`
	ToppedUpBalance string `json:"topped_up_balance"`
}

type QuotaRuntimeSourceState struct {
	Source    string `json:"source"`
	Reason    string `json:"reason,omitempty"`
	ExpiresAt string `json:"expires_at,omitempty"`
	NextReset string `json:"next_reset,omitempty"`
}

type QuotaRuntimeFact struct {
	State        string   `json:"state,omitempty"`
	Source       string   `json:"source,omitempty"`
	Freshness    string   `json:"freshness,omitempty"`
	Confidence   string   `json:"confidence,omitempty"`
	Risk         string   `json:"risk,omitempty"`
	Explanation  string   `json:"explanation,omitempty"`
	ObservedAt   string   `json:"observed_at,omitempty"`
	ExpiresAt    string   `json:"expires_at,omitempty"`
	EvidenceRefs []string `json:"evidence_refs,omitempty"`
}

func (fact *QuotaRuntimeFact) UnmarshalJSON(data []byte) error {
	type alias QuotaRuntimeFact
	var decoded struct {
		alias
		ObservedAtCamel   string   `json:"observedAt,omitempty"`
		ExpiresAtCamel    string   `json:"expiresAt,omitempty"`
		EvidenceRefsCamel []string `json:"evidenceRefs,omitempty"`
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	next := QuotaRuntimeFact(decoded.alias)
	if decoded.ObservedAtCamel != "" {
		next.ObservedAt = decoded.ObservedAtCamel
	}
	if decoded.ExpiresAtCamel != "" {
		next.ExpiresAt = decoded.ExpiresAtCamel
	}
	if decoded.EvidenceRefsCamel != nil {
		next.EvidenceRefs = append([]string(nil), decoded.EvidenceRefsCamel...)
	} else {
		next.EvidenceRefs = append([]string(nil), next.EvidenceRefs...)
	}
	*fact = next
	return nil
}

type QuotaRuntimeState struct {
	AccountKey      string                    `json:"account_key"`
	Source          string                    `json:"source,omitempty"`
	Status          string                    `json:"status"`
	PlanType        string                    `json:"plan_type,omitempty"`
	Windows         []QuotaRuntimeWindow      `json:"windows"`
	Billing         *QuotaRuntimeBilling      `json:"billing,omitempty"`
	UpdatedAt       string                    `json:"updated_at,omitempty"`
	LastEvaluatedAt string                    `json:"last_evaluated_at,omitempty"`
	Stale           bool                      `json:"stale,omitempty"`
	DegradedReason  string                    `json:"degraded_reason,omitempty"`
	Blocked         bool                      `json:"blocked"`
	BlockReason     string                    `json:"block_reason,omitempty"`
	Sources         []QuotaRuntimeSourceState `json:"sources"`
	Fact            *QuotaRuntimeFact         `json:"fact,omitempty"`
}

type QuotaUsageCalibration struct {
	ID         string  `json:"id,omitempty"`
	AccountKey string  `json:"account_key"`
	WindowKey  string  `json:"window_key"`
	Metric     string  `json:"metric"`
	Mode       string  `json:"mode"`
	Value      float64 `json:"value"`
	CreatedAt  string  `json:"created_at,omitempty"`
	ExpiresAt  string  `json:"expires_at,omitempty"`
	RevokedAt  string  `json:"revoked_at,omitempty"`
}

type BudgetWindowDefinition struct {
	ID        string  `json:"id,omitempty"`
	Kind      string  `json:"kind"`
	Semantics string  `json:"semantics,omitempty"`
	Days      int     `json:"days,omitempty"`
	Metric    string  `json:"metric"`
	Limit     float64 `json:"limit"`
	Timezone  string  `json:"timezone,omitempty"`
	StartsAt  string  `json:"startsAt,omitempty"`
	EndsAt    string  `json:"endsAt,omitempty"`
	Enabled   bool    `json:"enabled"`
}

type BudgetWindowFactsPreviewRequest struct {
	AccountKey   string                   `json:"account_key"`
	Now          string                   `json:"now,omitempty"`
	Definitions  []BudgetWindowDefinition `json:"definitions,omitempty"`
	Calibrations []QuotaUsageCalibration  `json:"calibrations,omitempty"`
}

type QuotaThresholdRule struct {
	ID               string         `json:"id,omitempty"`
	AccountKey       string         `json:"account_key"`
	WindowKey        string         `json:"window_key"`
	Metric           string         `json:"metric"`
	Comparator       string         `json:"comparator,omitempty"`
	ThresholdPercent float64        `json:"threshold_percent"`
	Condition        map[string]any `json:"condition,omitempty"`
	Enabled          bool           `json:"enabled"`
}

type SimulateRouteGuardRuleRequest struct {
	RuleID *string             `json:"ruleId,omitempty"`
	Rule   *QuotaThresholdRule `json:"rule,omitempty"`
	Facts  SimulationFacts     `json:"facts"`
}

type SimulationFacts struct {
	AccountID          string            `json:"accountId"`
	Now                string            `json:"now"`
	QuotaWindow        *QuotaWindowFact  `json:"quotaWindow,omitempty"`
	QuotaWindows       []QuotaWindowFact `json:"quotaWindows,omitempty"`
	CalibrationEntries []CalibrationFact `json:"calibrationEntries,omitempty"`
	Metadata           map[string]any    `json:"metadata,omitempty"`
}

type QuotaWindowFact struct {
	WindowID                 string  `json:"windowId"`
	Kind                     string  `json:"kind,omitempty"`
	Metric                   string  `json:"metric,omitempty"`
	Timezone                 string  `json:"timezone,omitempty"`
	StartsAt                 string  `json:"startsAt,omitempty"`
	EndsAt                   string  `json:"endsAt,omitempty"`
	ObservedUsed             float64 `json:"observedUsed"`
	ObservedLimit            float64 `json:"observedLimit"`
	ObservedRemaining        float64 `json:"observedRemaining"`
	ObservedUsedPercent      float64 `json:"observedUsedPercent,omitempty"`
	ObservedRemainingPercent float64 `json:"observedRemainingPercent,omitempty"`
	RawUsed                  float64 `json:"rawUsed,omitempty"`
	CalibrationDelta         float64 `json:"calibrationDelta,omitempty"`
	CalibratedUsed           float64 `json:"calibratedUsed,omitempty"`
	GeneratedAt              string  `json:"generatedAt,omitempty"`
	Source                   string  `json:"source,omitempty"`
	RecoverySource           string  `json:"recoverySource,omitempty"`
	Status                   string  `json:"status"`
}

type CalibrationFact struct {
	ID        string  `json:"id,omitempty"`
	AccountID string  `json:"accountId,omitempty"`
	WindowID  string  `json:"windowId,omitempty"`
	Metric    string  `json:"metric,omitempty"`
	Mode      string  `json:"mode,omitempty"`
	Value     float64 `json:"value,omitempty"`
	CreatedAt string  `json:"createdAt,omitempty"`
	ExpiresAt string  `json:"expiresAt,omitempty"`
	RevokedAt string  `json:"revokedAt,omitempty"`
}

type SimulationResult struct {
	Decision     string               `json:"decision"`
	MatchedRule  *MatchedRuleSummary  `json:"matchedRule,omitempty"`
	AccountTrace AccountDecisionTrace `json:"accountTrace"`
	RecoveryAt   *string              `json:"recoveryAt,omitempty"`
	ExpiresAt    *string              `json:"expiresAt,omitempty"`
	Diagnostics  []ReasonTraceStep    `json:"diagnostics,omitempty"`
}

type MatchedRuleSummary struct {
	ID     string `json:"id"`
	Name   string `json:"name,omitempty"`
	Source string `json:"source,omitempty"`
}

type AccountDecisionTrace struct {
	AccountID   string            `json:"accountId"`
	Source      string            `json:"source"`
	Reason      string            `json:"reason"`
	ReasonTrace []ReasonTraceStep `json:"reasonTrace"`
}

type ReasonTraceStep struct {
	Code    string         `json:"code"`
	Message string         `json:"message,omitempty"`
	Data    map[string]any `json:"data,omitempty"`
}

func (state *QuotaRuntimeState) UnmarshalJSON(data []byte) error {
	type alias QuotaRuntimeState
	var decoded alias
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	for _, key := range []string{"quotaFact", "quota_fact", "fact"} {
		payload, ok := raw[key]
		if !ok || len(bytes.TrimSpace(payload)) == 0 || bytes.Equal(bytes.TrimSpace(payload), []byte("null")) {
			continue
		}
		var fact QuotaRuntimeFact
		if err := json.Unmarshal(payload, &fact); err != nil {
			return err
		}
		decoded.Fact = cloneQuotaRuntimeFact(&fact)
		break
	}

	*state = QuotaRuntimeState(decoded)
	return nil
}

func cloneQuotaRuntimeFact(fact *QuotaRuntimeFact) *QuotaRuntimeFact {
	if fact == nil {
		return nil
	}
	next := *fact
	next.EvidenceRefs = append([]string(nil), fact.EvidenceRefs...)
	return &next
}

type DoctorDiagnosticsResponse struct {
	Authority   string                   `json:"authority"`
	Source      string                   `json:"source"`
	GeneratedAt string                   `json:"generatedAt"`
	Summary     DoctorDiagnosticsSummary `json:"summary"`
	Checks      []DoctorDiagnosticCheck  `json:"checks"`
}

type DoctorDiagnosticsSummary struct {
	Status   string `json:"status"`
	Total    int    `json:"total"`
	OK       int    `json:"ok"`
	NotReady int    `json:"notReady"`
	Warning  int    `json:"warning"`
	Blocking int    `json:"blocking"`
	Evidence int    `json:"evidence"`
}

type DoctorDiagnosticCheck struct {
	ID            string                     `json:"id"`
	Status        string                     `json:"status"`
	Reason        string                     `json:"reason"`
	Repairability string                     `json:"repairability"`
	Evidence      []DoctorDiagnosticEvidence `json:"evidence"`
}

type DoctorDiagnosticEvidence struct {
	Kind          string                       `json:"kind"`
	AccountKey    string                       `json:"accountKey,omitempty"`
	AccountID     string                       `json:"accountId,omitempty"`
	AuthID        string                       `json:"authId,omitempty"`
	Source        string                       `json:"source,omitempty"`
	Scope         string                       `json:"scope,omitempty"`
	Reason        string                       `json:"reason,omitempty"`
	Model         string                       `json:"model,omitempty"`
	ExpiresAt     string                       `json:"expiresAt,omitempty"`
	UpdatedAt     string                       `json:"updatedAt,omitempty"`
	RouteBlocking bool                         `json:"routeBlocking,omitempty"`
	State         string                       `json:"state,omitempty"`
	Freshness     string                       `json:"freshness,omitempty"`
	Confidence    string                       `json:"confidence,omitempty"`
	Risk          string                       `json:"risk,omitempty"`
	Explanation   string                       `json:"explanation,omitempty"`
	ObservedAt    string                       `json:"observedAt,omitempty"`
	EvidenceRefs  []string                     `json:"evidenceRefs,omitempty"`
	DroppedReason *ChannelRoutingDroppedReason `json:"droppedReason,omitempty"`
	QuotaFact     *QuotaRuntimeFact            `json:"quotaFact,omitempty"`
}

type QuotaRefreshBatchInput struct {
	AccountKeys    []string `json:"account_keys"`
	IncludeBilling bool     `json:"include_billing"`
	Force          bool     `json:"force"`
	Concurrency    int      `json:"concurrency,omitempty"`
}

type QuotaRefreshBatchError struct {
	AccountKey string `json:"account_key"`
	Error      string `json:"error"`
}

type QuotaRefreshBatchResult struct {
	Items     []QuotaRuntimeState      `json:"items"`
	Errors    []QuotaRefreshBatchError `json:"errors"`
	Succeeded int                      `json:"succeeded"`
	Failed    int                      `json:"failed"`
}

type OpenAIQuotaResetUsage struct {
	UserID                string                         `json:"user_id,omitempty"`
	AccountID             string                         `json:"account_id,omitempty"`
	Email                 string                         `json:"email,omitempty"`
	PlanType              string                         `json:"plan_type,omitempty"`
	RateLimitResetCredits *OpenAIQuotaResetCreditBalance `json:"rate_limit_reset_credits,omitempty"`
}

type OpenAIQuotaResetCreditBalance struct {
	AvailableCount int `json:"available_count"`
}

type OpenAIQuotaResetCredit struct {
	ID              string `json:"id,omitempty"`
	ResetType       string `json:"reset_type,omitempty"`
	Status          string `json:"status,omitempty"`
	GrantedAt       string `json:"granted_at,omitempty"`
	ExpiresAt       string `json:"expires_at,omitempty"`
	RedeemStartedAt string `json:"redeem_started_at,omitempty"`
	RedeemedAt      string `json:"redeemed_at,omitempty"`
}

type OpenAIQuotaResetCreditInfo struct {
	AccountKey     string                 `json:"account_key"`
	Status         string                 `json:"status"`
	AvailableCount int                    `json:"available_count"`
	PlanType       string                 `json:"plan_type,omitempty"`
	FetchedAt      int64                  `json:"fetched_at"`
	QuotaState     *QuotaRuntimeState     `json:"quota_state,omitempty"`
	Usage          *OpenAIQuotaResetUsage `json:"usage,omitempty"`
}

type OpenAIQuotaResetConsumeResult struct {
	AccountKey             string                  `json:"account_key"`
	Status                 string                  `json:"status"`
	Code                   string                  `json:"code,omitempty"`
	Credit                 *OpenAIQuotaResetCredit `json:"credit,omitempty"`
	WindowsReset           int                     `json:"windows_reset"`
	AvailableCount         int                     `json:"available_count"`
	PlanType               string                  `json:"plan_type,omitempty"`
	FetchedAt              int64                   `json:"fetched_at"`
	QuotaState             *QuotaRuntimeState      `json:"quota_state,omitempty"`
	PostResetRefreshStatus string                  `json:"post_reset_refresh_status,omitempty"`
	PostResetRefreshError  string                  `json:"post_reset_refresh_error,omitempty"`
}

type QuotaRefreshBatchJob struct {
	JobID       string                   `json:"job_id"`
	Status      string                   `json:"status"`
	Total       int                      `json:"total"`
	Pending     int                      `json:"pending"`
	Running     int                      `json:"running"`
	Succeeded   int                      `json:"succeeded"`
	Failed      int                      `json:"failed"`
	Items       []QuotaRuntimeState      `json:"items"`
	Errors      []QuotaRefreshBatchError `json:"errors"`
	CreatedAt   string                   `json:"created_at"`
	UpdatedAt   string                   `json:"updated_at"`
	CompletedAt string                   `json:"completed_at,omitempty"`
}

type AccountBatchDeleteInput struct {
	AccountKeys []string `json:"account_keys"`
}

type AccountBatchStatusInput struct {
	AccountKeys []string `json:"account_keys"`
	Disabled    bool     `json:"disabled"`
}

type AccountBatchCreateInput struct {
	Accounts []AccountWriteRequest `json:"accounts"`
}

type AccountBatchCreateError struct {
	Index int    `json:"index"`
	Title string `json:"title,omitempty"`
	Error string `json:"error"`
}

type AccountBatchCreateSkipped struct {
	Index              int    `json:"index"`
	Title              string `json:"title,omitempty"`
	Reason             string `json:"reason"`
	ExistingAccountKey string `json:"existing_account_key,omitempty"`
	DedupeKeyKind      string `json:"dedupe_key_kind,omitempty"`
}

type AccountBatchCreatePreviewItem struct {
	Index              int    `json:"index"`
	Title              string `json:"title,omitempty"`
	Action             string `json:"action"`
	Reason             string `json:"reason,omitempty"`
	ExistingAccountKey string `json:"existing_account_key,omitempty"`
	DedupeKeyKind      string `json:"dedupe_key_kind,omitempty"`
}

type AccountBatchCreatePreviewResult struct {
	Items        []AccountBatchCreatePreviewItem `json:"items"`
	Skipped      []AccountBatchCreateSkipped     `json:"skipped"`
	Errors       []AccountBatchCreateError       `json:"errors"`
	WouldCreate  int                             `json:"would_create"`
	SkippedCount int                             `json:"skipped_count"`
	Failed       int                             `json:"failed"`
}

type AccountBatchCreateResult struct {
	Accounts     []UnifiedAccount            `json:"accounts"`
	Skipped      []AccountBatchCreateSkipped `json:"skipped"`
	Errors       []AccountBatchCreateError   `json:"errors"`
	Succeeded    int                         `json:"succeeded"`
	SkippedCount int                         `json:"skipped_count"`
	Failed       int                         `json:"failed"`
}

type AccountBatchDeleteError struct {
	AccountKey string `json:"account_key"`
	Error      string `json:"error"`
}

type AccountBatchDeleteResult struct {
	DeletedAccountKeys []string                  `json:"deleted_account_keys"`
	Errors             []AccountBatchDeleteError `json:"errors"`
	Succeeded          int                       `json:"succeeded"`
	Failed             int                       `json:"failed"`
}

type AccountBatchStatusError struct {
	AccountKey string `json:"account_key"`
	Error      string `json:"error"`
}

type AccountBatchStatusResult struct {
	UpdatedAccountKeys []string                  `json:"updated_account_keys"`
	Errors             []AccountBatchStatusError `json:"errors"`
	Succeeded          int                       `json:"succeeded"`
	Failed             int                       `json:"failed"`
}

type QuotaCurlTestInput struct {
	APIKey         string            `json:"api_key"`
	BaseURL        string            `json:"base_url"`
	Prefix         string            `json:"prefix,omitempty"`
	QuotaCurl      string            `json:"quota_curl,omitempty"`
	BillingCurl    string            `json:"billing_curl,omitempty"`
	PlatformCookie string            `json:"platform_cookie,omitempty"`
	CurlVariables  map[string]string `json:"curl_variables,omitempty"`
	AccountKey     string            `json:"account_key,omitempty"`
}
