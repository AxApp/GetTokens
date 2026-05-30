package wailsapp

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func (a *App) ListAuthFiles() (*AuthFilesResponse, error) {
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/auth-files", nil, nil, "")
	if err != nil {
		return nil, err
	}
	var result AuthFilesResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	if result.Files == nil {
		result.Files = []AuthFileItem{}
	}

	for index := range result.Files {
		file := &result.Files[index]
		if cached, ok := a.cachedAuthFileMetadata(*file); ok {
			applyCachedAuthFileMetadata(file, cached)
			a.storeAuthFileMetadata(*file)
			continue
		}

		if !needsAuthFileMetadataInference(*file) {
			a.storeAuthFileMetadata(*file)
			continue
		}

		body, inferErr := a.downloadAuthFileBody(file.Name)
		if inferErr != nil {
			continue
		}

		if needsAuthFileKindInference(*file) {
			inferredKind := accountsdomain.InferAuthFileKind(body)
			if inferredKind != "" {
				file.Provider = inferredKind
				file.Type = inferredKind
			}
		}

		profile := accountsdomain.ExtractAuthFileProfile(body)
		if strings.TrimSpace(file.Email) == "" {
			file.Email = profile.Email
		}
		if strings.TrimSpace(file.PlanType) == "" {
			file.PlanType = profile.PlanType
		}
		file.Priority = accountsdomain.ExtractAuthFilePriority(body)
		a.storeAuthFileMetadata(*file)
	}

	return &result, nil
}

func needsAuthFileMetadataInference(file AuthFileItem) bool {
	return needsAuthFileKindInference(file) || strings.TrimSpace(file.Email) == "" || strings.TrimSpace(file.PlanType) == "" || file.Priority == 0
}

func needsAuthFileKindInference(file AuthFileItem) bool {
	return isUnknownKind(file.Provider) || isUnknownKind(file.Type)
}

func isUnknownKind(value string) bool {
	trimmed := strings.TrimSpace(strings.ToLower(value))
	return trimmed == "" || trimmed == "unknown"
}

func (a *App) downloadAuthFileBody(name string) ([]byte, error) {
	query := url.Values{}
	query.Set("name", strings.TrimSpace(name))
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/auth-files/download", query, nil, "")
	if err != nil {
		return nil, err
	}
	return body, nil
}

func (a *App) SetAuthFileStatus(name string, disabled bool) error {
	payload := map[string]interface{}{
		"name":     name,
		"disabled": disabled,
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, _, err = a.SidecarRequest(http.MethodPatch, ManagementAPIPrefix+"/auth-files/status", nil, bytes.NewReader(b), "application/json")
	if err == nil {
		a.invalidateAuthFileMetadataCache(name)
	}
	return err
}

func (a *App) DeleteAuthFiles(names []string) error {
	payload := map[string]interface{}{
		"names": names,
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, _, err = a.SidecarRequest(http.MethodDelete, ManagementAPIPrefix+"/auth-files", nil, bytes.NewReader(b), "application/json")
	if err == nil {
		a.invalidateAuthFileMetadataCache(names...)
	}
	return err
}

func (a *App) UploadAuthFiles(files []UploadFilePayload) error {
	if len(files) == 0 {
		return errors.New("未选择文件")
	}

	existingNames, err := a.listExistingAccountStoreAuthFileNames()
	if err != nil {
		return err
	}

	client := a.managementClient()
	for _, f := range files {
		if strings.TrimSpace(f.Name) == "" || strings.TrimSpace(f.ContentBase64) == "" {
			continue
		}
		decoded, err := base64.StdEncoding.DecodeString(f.ContentBase64)
		if err != nil {
			return fmt.Errorf("文件 %s base64 解码失败: %w", f.Name, err)
		}
		if normalized, _, normalizeErr := accountsdomain.NormalizeAuthFileForSidecar(decoded); normalizeErr == nil {
			decoded = normalized
		}
		resolvedName := uniqueAuthFileUploadName(f.Name, existingNames)
		write := authFileCreateAccountWrite(resolvedName, decoded)
		if _, err := client.CreateAccount(write); err != nil {
			return err
		}
	}

	return nil
}

func (a *App) uploadLegacyAuthFiles(files []UploadFilePayload) error {
	if len(files) == 0 {
		return errors.New("未选择文件")
	}

	existingNames, err := a.listExistingLegacyAuthFileNames()
	if err != nil {
		return err
	}

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	resolvedNames := make([]string, 0, len(files))

	for _, f := range files {
		if strings.TrimSpace(f.Name) == "" || strings.TrimSpace(f.ContentBase64) == "" {
			continue
		}
		decoded, err := base64.StdEncoding.DecodeString(f.ContentBase64)
		if err != nil {
			return fmt.Errorf("文件 %s base64 解码失败: %w", f.Name, err)
		}
		if normalized, _, normalizeErr := accountsdomain.NormalizeAuthFileForSidecar(decoded); normalizeErr == nil {
			decoded = normalized
		}
		resolvedName := uniqueAuthFileUploadName(f.Name, existingNames)
		resolvedNames = append(resolvedNames, resolvedName)
		part, err := w.CreateFormFile("file", resolvedName)
		if err != nil {
			return err
		}
		if _, err := part.Write(decoded); err != nil {
			return err
		}
	}

	if err := w.Close(); err != nil {
		return err
	}

	_, _, err = a.SidecarRequest(http.MethodPost, ManagementAPIPrefix+"/auth-files", nil, &buf, w.FormDataContentType())
	if err == nil {
		a.invalidateAuthFileMetadataCache(resolvedNames...)
	}
	return err
}

func authFileCreateAccountWrite(sourceFileName string, authJSON []byte) cliproxyapi.AccountWriteRequest {
	sourceFileName = uniqueAuthFileNameFallback(sourceFileName)
	provider := accountsdomain.InferAuthFileKind(authJSON)
	if provider == "" {
		provider = "codex"
	}
	profile := accountsdomain.ExtractAuthFileProfile(authJSON)
	return cliproxyapi.AccountWriteRequest{
		Kind:     cliproxyapi.AccountKindAuthFile,
		Title:    sourceFileName,
		Provider: provider,
		Priority: accountsdomain.ExtractAuthFilePriority(authJSON),
		AuthFile: &cliproxyapi.AuthFileAccountCredential{
			SourceFileName: sourceFileName,
			AuthJSON:       string(authJSON),
			AuthType:       provider,
			Email:          strings.TrimSpace(profile.Email),
			PlanType:       strings.TrimSpace(profile.PlanType),
			SizeBytes:      int64(len(authJSON)),
		},
	}
}

func uniqueAuthFileNameFallback(name string) string {
	existing := map[string]struct{}{}
	return uniqueAuthFileUploadName(name, existing)
}

func (a *App) updateAuthFilePriority(name string, priority int) error {
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return errors.New("auth file name 不能为空")
	}

	wasDisabled, err := a.authFileDisabledStatus(trimmedName)
	if err != nil {
		return err
	}

	body, err := a.downloadAuthFileBody(trimmedName)
	if err != nil {
		return err
	}

	updated, err := accountsdomain.SetAuthFilePriority(body, priority)
	if err != nil {
		return err
	}

	if err := a.replaceAuthFile(trimmedName, updated); err != nil {
		return err
	}
	if wasDisabled {
		return a.SetAuthFileStatus(trimmedName, true)
	}
	return nil
}

func (a *App) authFileDisabledStatus(name string) (bool, error) {
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/auth-files", nil, nil, "")
	if err != nil {
		return false, err
	}

	var result struct {
		Files []struct {
			Name     string `json:"name"`
			Disabled bool   `json:"disabled"`
		} `json:"files"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return false, err
	}

	for _, file := range result.Files {
		if strings.TrimSpace(file.Name) == name {
			return file.Disabled, nil
		}
	}

	return false, fmt.Errorf("auth file 不存在: %s", name)
}

func (a *App) replaceAuthFile(name string, content []byte) error {
	if err := a.DeleteAuthFiles([]string{name}); err != nil {
		return err
	}

	return a.uploadLegacyAuthFiles([]UploadFilePayload{{
		Name:          name,
		ContentBase64: base64.StdEncoding.EncodeToString(content),
	}})
}

func (a *App) listExistingLegacyAuthFileNames() (map[string]struct{}, error) {
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/auth-files", nil, nil, "")
	if err != nil {
		return nil, err
	}

	var result struct {
		Files []struct {
			Name string `json:"name"`
		} `json:"files"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}

	names := make(map[string]struct{}, len(result.Files))
	for _, file := range result.Files {
		if trimmed := strings.TrimSpace(file.Name); trimmed != "" {
			names[strings.ToLower(trimmed)] = struct{}{}
		}
	}
	return names, nil
}

func (a *App) listExistingAccountStoreAuthFileNames() (map[string]struct{}, error) {
	accounts, err := a.managementClient().ListAccounts()
	if err != nil {
		return nil, err
	}

	names := make(map[string]struct{}, len(accounts))
	for _, account := range accounts {
		if account.Kind != cliproxyapi.AccountKindAuthFile || account.AuthFile == nil {
			continue
		}
		if trimmed := strings.TrimSpace(account.AuthFile.SourceFileName); trimmed != "" {
			names[strings.ToLower(trimmed)] = struct{}{}
		}
	}
	return names, nil
}

func uniqueAuthFileUploadName(name string, existing map[string]struct{}) string {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		trimmed = "auth.json"
	}

	ext := filepath.Ext(trimmed)
	base := strings.TrimSuffix(trimmed, ext)
	if strings.TrimSpace(ext) == "" {
		ext = ".json"
	}
	if strings.TrimSpace(base) == "" {
		base = "auth"
	}

	candidate := base + ext
	key := strings.ToLower(candidate)
	if _, ok := existing[key]; !ok {
		existing[key] = struct{}{}
		return candidate
	}

	for index := 2; ; index++ {
		candidate = fmt.Sprintf("%s-%d%s", base, index, ext)
		key = strings.ToLower(candidate)
		if _, ok := existing[key]; ok {
			continue
		}
		existing[key] = struct{}{}
		return candidate
	}
}

func (a *App) GetAuthFileModels(name string) ([]map[string]interface{}, error) {
	query := url.Values{}
	query.Set("name", name)
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/auth-files/models", query, nil, "")
	if err != nil {
		return nil, err
	}
	var result struct {
		Models []map[string]interface{} `json:"models"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	if result.Models == nil {
		return []map[string]interface{}{}, nil
	}
	return result.Models, nil
}

func (a *App) DownloadAuthFile(name string) (*DownloadFileResponse, error) {
	if strings.TrimSpace(name) == "" {
		return nil, errors.New("name 不能为空")
	}
	query := url.Values{}
	query.Set("name", name)
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/auth-files/download", query, nil, "")
	if err != nil {
		return nil, err
	}

	return &DownloadFileResponse{
		Name:          name,
		ContentBase64: base64.StdEncoding.EncodeToString(body),
	}, nil
}
