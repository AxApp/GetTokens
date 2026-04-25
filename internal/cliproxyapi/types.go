package cliproxyapi

type CodexModel struct {
	Name  string `json:"name"`
	Alias string `json:"alias"`
}

type CodexAPIKey struct {
	APIKey         string            `json:"api-key"`
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
