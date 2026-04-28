package cliproxyapi

type CodexModel struct {
	Name  string `json:"name"`
	Alias string `json:"alias"`
}

type CodexAPIKey struct {
	APIKey         string            `json:"api-key"`
	Label          string            `json:"label,omitempty"`
	Priority       int               `json:"priority,omitempty"`
	Prefix         string            `json:"prefix,omitempty"`
	BaseURL        string            `json:"base-url"`
	Websockets     bool              `json:"websockets,omitempty"`
	ProxyURL       string            `json:"proxy-url,omitempty"`
	Models         []CodexModel      `json:"models,omitempty"`
	Headers        map[string]string `json:"headers,omitempty"`
	ExcludedModels []string          `json:"excluded-models,omitempty"`
	AuthIndex      string            `json:"auth-index,omitempty"`
}

type CodexAPIKeysResponse struct {
	Items []CodexAPIKey `json:"codex-api-key"`
}

type CodexAPIKeyInput struct {
	APIKey         string            `json:"api-key"`
	Label          string            `json:"label,omitempty"`
	Priority       int               `json:"priority,omitempty"`
	Prefix         string            `json:"prefix,omitempty"`
	BaseURL        string            `json:"base-url"`
	ProxyURL       string            `json:"proxy-url,omitempty"`
	Models         []CodexModel      `json:"models,omitempty"`
	Headers        map[string]string `json:"headers,omitempty"`
	ExcludedModels []string          `json:"excluded-models,omitempty"`
}

type CodexAPIKeyPatch struct {
	APIKey         *string            `json:"api-key,omitempty"`
	Prefix         *string            `json:"prefix,omitempty"`
	BaseURL        *string            `json:"base-url,omitempty"`
	ProxyURL       *string            `json:"proxy-url,omitempty"`
	Models         *[]CodexModel      `json:"models,omitempty"`
	Headers        *map[string]string `json:"headers,omitempty"`
	ExcludedModels *[]string          `json:"excluded-models,omitempty"`
}

type OpenAICompatibleAPIKeyEntry struct {
	APIKey   string `json:"api-key"`
	ProxyURL string `json:"proxy-url,omitempty"`
}

type OpenAICompatibleModel struct {
	Name  string `json:"name"`
	Alias string `json:"alias"`
}

type OpenAICompatibleProvider struct {
	Name          string                        `json:"name"`
	Priority      int                           `json:"priority,omitempty"`
	Prefix        string                        `json:"prefix,omitempty"`
	BaseURL       string                        `json:"base-url"`
	APIKeyEntries []OpenAICompatibleAPIKeyEntry `json:"api-key-entries,omitempty"`
	Models        []OpenAICompatibleModel       `json:"models,omitempty"`
	Headers       map[string]string             `json:"headers,omitempty"`
}

type OpenAICompatibleProvidersResponse struct {
	Items []OpenAICompatibleProvider `json:"openai-compatibility"`
}
