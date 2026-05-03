package wailsapp

import (
	"strings"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
)

func (a *App) NormalizeAuthFileContent(content string) (string, error) {
	normalized, _, err := accountsdomain.NormalizeAuthFileForSidecar([]byte(strings.TrimSpace(content)))
	if err != nil {
		return "", err
	}
	return string(normalized), nil
}
