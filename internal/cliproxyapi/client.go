package cliproxyapi

import (
	"bytes"
	"encoding/json"
	"io"
	"net/url"
)

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
