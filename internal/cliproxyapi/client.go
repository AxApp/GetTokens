package cliproxyapi

import (
	"bytes"
	"encoding/json"
	"io"
	"net/url"
)

type OAuthStartResponse struct {
	Status string `json:"status,omitempty"`
	URL    string `json:"url"`
	State  string `json:"state,omitempty"`
}

type OAuthStatusResponse struct {
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

type RequestFunc func(method string, path string, query url.Values, body io.Reader, contentType string) ([]byte, int, error)

type Client struct {
	request RequestFunc
}

func New(request RequestFunc) *Client {
	return &Client{request: request}
}

func (c *Client) ListCodexAPIKeys() ([]CodexAPIKey, error) {
	body, _, err := c.request("GET", "/v0/management/codex-api-key", nil, nil, "")
	if err != nil {
		return nil, err
	}

	var response CodexAPIKeysResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []CodexAPIKey{}, nil
	}
	return response.Items, nil
}

func (c *Client) ListAPIKeys() ([]string, error) {
	body, _, err := c.request("GET", "/v0/management/api-keys", nil, nil, "")
	if err != nil {
		return nil, err
	}

	var response struct {
		Items []string `json:"api-keys"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []string{}, nil
	}
	return response.Items, nil
}

func (c *Client) PutAPIKeys(items []string) error {
	if items == nil {
		items = []string{}
	}

	payload, err := json.Marshal(items)
	if err != nil {
		return err
	}

	_, _, err = c.request("PUT", "/v0/management/api-keys", nil, bytes.NewReader(payload), "application/json")
	return err
}

func (c *Client) PutCodexAPIKeys(items []CodexAPIKeyInput) error {
	if items == nil {
		items = []CodexAPIKeyInput{}
	}

	payload, err := json.Marshal(items)
	if err != nil {
		return err
	}

	_, _, err = c.request("PUT", "/v0/management/codex-api-key", nil, bytes.NewReader(payload), "application/json")
	return err
}

func (c *Client) ListOpenAICompatibleProviders() ([]OpenAICompatibleProvider, error) {
	body, _, err := c.request("GET", "/v0/management/openai-compatibility", nil, nil, "")
	if err != nil {
		return nil, err
	}

	var response OpenAICompatibleProvidersResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	if response.Items == nil {
		return []OpenAICompatibleProvider{}, nil
	}
	return response.Items, nil
}

func (c *Client) PutOpenAICompatibleProviders(items []OpenAICompatibleProvider) error {
	if items == nil {
		items = []OpenAICompatibleProvider{}
	}

	payload, err := json.Marshal(items)
	if err != nil {
		return err
	}

	_, _, err = c.request("PUT", "/v0/management/openai-compatibility", nil, bytes.NewReader(payload), "application/json")
	return err
}

func (c *Client) PatchCodexAPIKey(index int, value CodexAPIKeyPatch) error {
	payload, err := json.Marshal(struct {
		Index int              `json:"index"`
		Value CodexAPIKeyPatch `json:"value"`
	}{
		Index: index,
		Value: value,
	})
	if err != nil {
		return err
	}

	_, _, err = c.request("PATCH", "/v0/management/codex-api-key", nil, bytes.NewReader(payload), "application/json")
	return err
}

func (c *Client) DeleteCodexAPIKey(apiKey string, baseURL string) error {
	query := url.Values{}
	query.Set("api-key", apiKey)
	if baseURL != "" {
		query.Set("base-url", baseURL)
	}

	_, _, err := c.request("DELETE", "/v0/management/codex-api-key", query, nil, "")
	return err
}

func (c *Client) DeleteOpenAICompatibleProvider(name string) error {
	query := url.Values{}
	query.Set("name", name)

	_, _, err := c.request("DELETE", "/v0/management/openai-compatibility", query, nil, "")
	return err
}

func (c *Client) RequestCodexAuthURL(isWebUI bool) (*OAuthStartResponse, error) {
	query := url.Values{}
	if isWebUI {
		query.Set("is_webui", "true")
	}

	body, _, err := c.request("GET", "/v0/management/codex-auth-url", query, nil, "")
	if err != nil {
		return nil, err
	}

	var response OAuthStartResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	return &response, nil
}

func (c *Client) GetAuthStatus(state string) (*OAuthStatusResponse, error) {
	query := url.Values{}
	query.Set("state", state)

	body, _, err := c.request("GET", "/v0/management/get-auth-status", query, nil, "")
	if err != nil {
		return nil, err
	}

	var response OAuthStatusResponse
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, err
	}
	return &response, nil
}
