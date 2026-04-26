package wailsapp

import (
	"encoding/base64"
	"errors"
	"fmt"
	"strings"
)

func (a *App) StartCodexOAuth() (*OAuthStartResult, error) {
	response, err := a.managementClient().RequestCodexAuthURL(true)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(response.URL) == "" {
		return nil, errors.New("sidecar 未返回授权地址")
	}

	return &OAuthStartResult{
		URL:   strings.TrimSpace(response.URL),
		State: strings.TrimSpace(response.State),
	}, nil
}

func (a *App) GetOAuthStatus(state string) (*OAuthStatusResult, error) {
	response, err := a.managementClient().GetAuthStatus(strings.TrimSpace(state))
	if err != nil {
		return nil, err
	}

	status := strings.TrimSpace(response.Status)
	if status == "" {
		status = "ok"
	}

	return &OAuthStatusResult{
		Status: status,
		Error:  strings.TrimSpace(response.Error),
	}, nil
}

func (a *App) FinalizeCodexOAuth(input CompleteCodexOAuthInput) error {
	existingName := strings.TrimSpace(input.ExistingName)
	if existingName == "" {
		return nil
	}

	authFiles, err := a.ListAuthFiles()
	if err != nil {
		return err
	}

	replacementName, err := resolveReplacementCodexAuthFileName(existingName, input.PreviousNames, authFiles.Files)
	if err != nil {
		return err
	}

	downloaded, err := a.DownloadAuthFile(replacementName)
	if err != nil {
		return err
	}
	if strings.TrimSpace(downloaded.ContentBase64) == "" {
		return fmt.Errorf("新登录账号 %s 内容为空", replacementName)
	}
	if _, err := base64.StdEncoding.DecodeString(downloaded.ContentBase64); err != nil {
		return fmt.Errorf("新登录账号 %s 内容不是合法 base64: %w", replacementName, err)
	}

	if err := a.DeleteAuthFiles([]string{existingName}); err != nil {
		return err
	}

	if err := a.UploadAuthFiles([]UploadFilePayload{{
		Name:          existingName,
		ContentBase64: downloaded.ContentBase64,
	}}); err != nil {
		return err
	}

	if err := a.DeleteAuthFiles([]string{replacementName}); err != nil {
		return err
	}

	return nil
}

func resolveReplacementCodexAuthFileName(existingName string, previousNames []string, files []AuthFileItem) (string, error) {
	trimmedExistingName := strings.TrimSpace(existingName)
	if trimmedExistingName == "" {
		return "", errors.New("缺少要回填的原账号文件名")
	}

	previous := make(map[string]struct{}, len(previousNames))
	for _, name := range previousNames {
		trimmed := strings.TrimSpace(name)
		if trimmed == "" {
			continue
		}
		previous[strings.ToLower(trimmed)] = struct{}{}
	}

	candidates := make([]string, 0, 2)
	for _, file := range files {
		name := strings.TrimSpace(file.Name)
		if name == "" {
			continue
		}
		if strings.EqualFold(name, trimmedExistingName) {
			continue
		}
		if _, ok := previous[strings.ToLower(name)]; ok {
			continue
		}

		provider := strings.TrimSpace(file.Provider)
		if provider == "" {
			provider = strings.TrimSpace(file.Type)
		}
		if !strings.EqualFold(provider, "codex") {
			continue
		}

		candidates = append(candidates, name)
	}

	switch len(candidates) {
	case 0:
		return "", errors.New("未找到新的 codex 登录结果，无法回填原账号")
	case 1:
		return candidates[0], nil
	default:
		return "", fmt.Errorf("检测到多个新的 codex 登录结果，无法确定回填来源: %s", strings.Join(candidates, ", "))
	}
}
