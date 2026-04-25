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
	"strings"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
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
		if !needsAuthFileMetadataInference(*file) {
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
	}

	return &result, nil
}

func needsAuthFileMetadataInference(file AuthFileItem) bool {
	return needsAuthFileKindInference(file) || strings.TrimSpace(file.Email) == "" || strings.TrimSpace(file.PlanType) == ""
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
	return err
}

func (a *App) UploadAuthFiles(files []UploadFilePayload) error {
	if len(files) == 0 {
		return errors.New("未选择文件")
	}

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	for _, f := range files {
		if strings.TrimSpace(f.Name) == "" || strings.TrimSpace(f.ContentBase64) == "" {
			continue
		}
		decoded, err := base64.StdEncoding.DecodeString(f.ContentBase64)
		if err != nil {
			return fmt.Errorf("文件 %s base64 解码失败: %w", f.Name, err)
		}
		part, err := w.CreateFormFile("file", f.Name)
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

	_, _, err := a.SidecarRequest(http.MethodPost, ManagementAPIPrefix+"/auth-files", nil, &buf, w.FormDataContentType())
	return err
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
