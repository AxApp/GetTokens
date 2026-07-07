package wailsapp

import (
	"encoding/base64"
	"errors"
	"fmt"
	"path/filepath"
	"strings"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/cliproxyapi"
)

func (a *App) ListAuthFiles() (*AuthFilesResponse, error) {
	accounts, err := a.managementClient().ListAccounts()
	if err != nil {
		return nil, err
	}
	files := make([]AuthFileItem, 0, len(accounts))
	for _, account := range accounts {
		if account.Kind != cliproxyapi.AccountKindAuthFile || account.AuthFile == nil {
			continue
		}
		file := authFileItemFromUnifiedAccount(account)
		a.storeAuthFileMetadata(file)
		files = append(files, file)
	}
	return &AuthFilesResponse{Files: files, Total: len(files)}, nil
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
	account, err := a.findAuthFileAccount(name)
	if err != nil {
		return nil, err
	}
	if account.AuthFile == nil {
		return nil, fmt.Errorf("auth file 不存在: %s", name)
	}
	return []byte(account.AuthFile.AuthJSON), nil
}

func (a *App) SetAuthFileStatus(name string, disabled bool) error {
	account, err := a.findAuthFileAccount(name)
	if err != nil {
		return err
	}
	_, err = a.managementClient().PatchAccountStatus(account.AccountKey, disabled)
	if err == nil {
		a.invalidateAuthFileMetadataCache(name)
	}
	return err
}

func (a *App) DeleteAuthFiles(names []string) error {
	for _, name := range names {
		account, err := a.findAuthFileAccount(name)
		if err != nil {
			return err
		}
		if err := a.managementClient().DeleteAccount(account.AccountKey); err != nil {
			return err
		}
	}
	a.invalidateAuthFileMetadataCache(names...)
	return nil
}

func (a *App) UploadAuthFiles(files []UploadFilePayload) (*AuthFileUploadResult, error) {
	if len(files) == 0 {
		return nil, errors.New("未选择文件")
	}

	writes, err := a.buildAuthFileUploadWrites(files)
	if err != nil {
		return nil, err
	}
	if len(writes) == 0 {
		return &AuthFileUploadResult{}, nil
	}

	client := a.managementClient()
	if result, supported, err := client.CreateAccountsBatch(cliproxyapi.AccountBatchCreateInput{Accounts: writes}); err != nil {
		return nil, err
	} else if supported {
		if result != nil && result.Failed > 0 {
			return nil, authFilesBatchCreateError(result)
		}
		return authFileUploadResultFromBatch(result), nil
	}

	out := &AuthFileUploadResult{FallbackUsed: true}
	for _, write := range writes {
		if _, err := client.CreateAccount(write); err != nil {
			return nil, err
		}
		out.Succeeded++
	}

	return out, nil
}

func (a *App) PreviewAuthFileUploads(files []UploadFilePayload) (*AuthFileUploadPreviewResult, error) {
	if len(files) == 0 {
		return nil, errors.New("未选择文件")
	}
	writes, err := a.buildAuthFileUploadWrites(files)
	if err != nil {
		return nil, err
	}
	if len(writes) == 0 {
		return &AuthFileUploadPreviewResult{Supported: true}, nil
	}
	result, supported, err := a.managementClient().PreviewCreateAccountsBatch(cliproxyapi.AccountBatchCreateInput{Accounts: writes})
	if err != nil {
		return nil, err
	}
	if !supported {
		return &AuthFileUploadPreviewResult{Supported: false, WouldCreate: len(writes)}, nil
	}
	return authFileUploadPreviewResultFromBatch(result), nil
}

func (a *App) buildAuthFileUploadWrites(files []UploadFilePayload) ([]cliproxyapi.AccountWriteRequest, error) {
	existingNames, err := a.listExistingAccountStoreAuthFileNames()
	if err != nil {
		return nil, err
	}

	writes := make([]cliproxyapi.AccountWriteRequest, 0, len(files))
	for _, f := range files {
		if strings.TrimSpace(f.Name) == "" || strings.TrimSpace(f.ContentBase64) == "" {
			continue
		}
		decoded, err := base64.StdEncoding.DecodeString(f.ContentBase64)
		if err != nil {
			return nil, fmt.Errorf("文件 %s base64 解码失败: %w", f.Name, err)
		}
		if normalized, _, normalizeErr := accountsdomain.NormalizeAuthFileForSidecar(decoded); normalizeErr == nil {
			decoded = normalized
		}
		resolvedName := uniqueAuthFileUploadName(f.Name, existingNames)
		writes = append(writes, authFileCreateAccountWrite(resolvedName, decoded))
	}
	return writes, nil
}

func authFileUploadResultFromBatch(result *cliproxyapi.AccountBatchCreateResult) *AuthFileUploadResult {
	out := &AuthFileUploadResult{}
	if result == nil {
		return out
	}
	out.Succeeded = result.Succeeded
	out.Skipped = result.SkippedCount
	out.Failed = result.Failed
	if out.Skipped == 0 {
		out.Skipped = len(result.Skipped)
	}
	for _, item := range result.Skipped {
		switch item.Reason {
		case "existing_account":
			out.SkippedExisting++
		case "duplicate_in_batch":
			out.SkippedInBatch++
		}
	}
	return out
}

func authFileUploadPreviewResultFromBatch(result *cliproxyapi.AccountBatchCreatePreviewResult) *AuthFileUploadPreviewResult {
	out := &AuthFileUploadPreviewResult{Supported: true}
	if result == nil {
		return out
	}
	out.WouldCreate = result.WouldCreate
	out.Skipped = result.SkippedCount
	out.Failed = result.Failed
	if out.Skipped == 0 {
		out.Skipped = len(result.Skipped)
	}
	for _, item := range result.Skipped {
		switch item.Reason {
		case "existing_account":
			out.SkippedExisting++
		case "duplicate_in_batch":
			out.SkippedInBatch++
		}
	}
	return out
}

func authFilesBatchCreateError(result *cliproxyapi.AccountBatchCreateResult) error {
	if result == nil {
		return errors.New("批量导入账号失败")
	}
	if len(result.Errors) == 0 {
		return fmt.Errorf("批量导入账号失败: %d 项失败", result.Failed)
	}
	first := result.Errors[0]
	label := strings.TrimSpace(first.Title)
	if label == "" {
		label = fmt.Sprintf("#%d", first.Index+1)
	}
	message := strings.TrimSpace(first.Error)
	if message == "" {
		message = "未知错误"
	}
	return fmt.Errorf("批量导入账号失败: %s: %s", label, message)
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

	account, err := a.findAuthFileAccount(trimmedName)
	if err != nil {
		return err
	}
	_, err = a.managementClient().PatchAccountPriority(account.AccountKey, priority)
	return err
}

func (a *App) replaceAuthFile(name string, content []byte) error {
	account, err := a.findAuthFileAccount(name)
	if err != nil {
		return err
	}
	write := accountWriteFromUnified(*account)
	if write.AuthFile == nil {
		return fmt.Errorf("auth file 不存在: %s", name)
	}
	write.AuthFile.AuthJSON = string(content)
	write.AuthFile.SizeBytes = int64(len(content))
	profile := accountsdomain.ExtractAuthFileProfile(content)
	write.AuthFile.Email = firstNonEmptyString(profile.Email, write.AuthFile.Email)
	write.AuthFile.PlanType = firstNonEmptyString(profile.PlanType, write.AuthFile.PlanType)
	write.Priority = accountsdomain.ExtractAuthFilePriority(content)
	_, err = a.managementClient().PatchAccount(account.AccountKey, write)
	return err
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
	account, err := a.findAuthFileAccount(name)
	if err != nil {
		return nil, err
	}
	return a.managementClient().GetAccountModels(account.AccountKey)
}

func (a *App) DownloadAuthFile(name string) (*DownloadFileResponse, error) {
	if strings.TrimSpace(name) == "" {
		return nil, errors.New("name 不能为空")
	}
	body, err := a.downloadAuthFileBody(name)
	if err != nil {
		return nil, err
	}

	return &DownloadFileResponse{
		Name:          name,
		ContentBase64: base64.StdEncoding.EncodeToString(body),
	}, nil
}

func (a *App) ApplyAuthFileConfig(name string, content string) error {
	if strings.TrimSpace(content) == "" {
		return errors.New("auth file content 不能为空")
	}
	normalized, _, err := accountsdomain.NormalizeAuthFileForSidecar([]byte(content))
	if err != nil {
		return err
	}
	if err := a.replaceAuthFile(name, normalized); err != nil {
		return err
	}
	a.invalidateAuthFileMetadataCache(name)
	return nil
}

func (a *App) findAuthFileAccount(name string) (*cliproxyapi.UnifiedAccount, error) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return nil, errors.New("auth file name 不能为空")
	}
	accounts, err := a.managementClient().ListAccounts()
	if err != nil {
		return nil, err
	}
	for index := range accounts {
		account := &accounts[index]
		if account.Kind != cliproxyapi.AccountKindAuthFile || account.AuthFile == nil {
			continue
		}
		if strings.EqualFold(strings.TrimSpace(account.AccountKey), trimmed) ||
			strings.EqualFold(strings.TrimSpace(account.AuthFile.SourceFileName), trimmed) ||
			strings.EqualFold(strings.TrimSpace(account.Title), trimmed) {
			return account, nil
		}
	}
	return nil, fmt.Errorf("auth file 不存在: %s", name)
}

func authFileItemFromUnifiedAccount(account cliproxyapi.UnifiedAccount) AuthFileItem {
	credential := account.AuthFile
	name := strings.TrimSpace(account.Title)
	provider := strings.TrimSpace(account.Provider)
	email := ""
	planType := ""
	size := int64(0)
	modified := int64(0)
	if credential != nil {
		if sourceName := strings.TrimSpace(credential.SourceFileName); sourceName != "" {
			name = sourceName
		}
		if authType := strings.TrimSpace(credential.AuthType); authType != "" {
			provider = authType
		}
		email = strings.TrimSpace(credential.Email)
		planType = strings.TrimSpace(credential.PlanType)
		size = credential.SizeBytes
		modified = credential.ModifiedUnixMs
		if strings.TrimSpace(credential.AuthJSON) != "" {
			body := []byte(credential.AuthJSON)
			if provider == "" || isUnknownKind(provider) {
				if inferred := accountsdomain.InferAuthFileKind(body); inferred != "" {
					provider = inferred
				}
			}
			profile := accountsdomain.ExtractAuthFileProfile(body)
			email = firstNonEmptyString(email, profile.Email)
			planType = firstNonEmptyString(planType, profile.PlanType)
			if size == 0 {
				size = int64(len(body))
			}
		}
	}
	if provider == "" {
		provider = "unknown"
	}
	status := "active"
	if account.Disabled {
		status = "disabled"
	}
	if strings.TrimSpace(account.RuntimeApplyStatus) == "failed" {
		status = "unavailable"
	}
	return AuthFileItem{
		Name:          name,
		Type:          provider,
		Provider:      provider,
		Priority:      account.Priority,
		Email:         email,
		PlanType:      planType,
		Size:          size,
		AuthIndex:     strings.TrimSpace(account.AccountKey),
		RuntimeOnly:   false,
		Disabled:      account.Disabled,
		Unavailable:   status == "unavailable",
		Status:        status,
		StatusMessage: strings.TrimSpace(account.RuntimeApplyError),
		Modified:      modified,
	}
}
