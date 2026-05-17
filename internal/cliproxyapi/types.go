package cliproxyapi

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
	ProxyURL       string            `json:"proxy-url,omitempty"`
	Models         []CodexModel      `json:"models,omitempty"`
	Headers        map[string]string `json:"headers,omitempty"`
	ExcludedModels []string          `json:"excluded-models,omitempty"`
	QuotaCurl      string            `json:"quota-curl,omitempty"`
	QuotaEnabled   bool              `json:"quota-enabled,omitempty"`
	BillingCurl    string            `json:"billing-curl,omitempty"`
	BillingEnabled bool              `json:"billing-enabled,omitempty"`
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
	Name          string                        `json:"name"`
	Priority      int                           `json:"priority,omitempty"`
	Disabled      bool                          `json:"disabled,omitempty"`
	Prefix        string                        `json:"prefix,omitempty"`
	BaseURL       string                        `json:"base-url"`
	APIKeyEntries []OpenAICompatibleAPIKeyEntry `json:"api-key-entries,omitempty"`
	Models        []OpenAICompatibleModel       `json:"models,omitempty"`
	Headers       map[string]string             `json:"headers,omitempty"`
}

type OpenAICompatibleProvidersResponse struct {
	Items []OpenAICompatibleProvider `json:"openai-compatibility"`
}

type RateLimitStrategyMeta struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	SupportedWindows []string `json:"supported_windows"`
}

type RateLimitRule struct {
	ID         string `json:"id,omitempty"`
	AccountKey string `json:"account_key"`
	MatchKey   string `json:"match_key,omitempty"`
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
}

type RateLimitState struct {
	AccountKey  string               `json:"account_key"`
	MatchKey    string               `json:"match_key,omitempty"`
	Blocked     bool                 `json:"blocked"`
	BlockReason string               `json:"block_reason,omitempty"`
	Rules       []RateLimitRuleState `json:"rules"`
	UpdatedAt   string               `json:"updated_at,omitempty"`
}

type RateLimitEvent struct {
	ID          string `json:"id"`
	AccountKey  string `json:"account_key"`
	MatchKey    string `json:"match_key,omitempty"`
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
