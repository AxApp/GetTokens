package sidecar

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type sidecarBinaryMetadata struct {
	Commit string `json:"commit"`
}

func readBinaryGitHash(binaryPath string) (string, error) {
	metaPath := binaryMetadataPath(binaryPath)
	data, err := os.ReadFile(metaPath)
	if err != nil {
		return "", err
	}

	var metadata sidecarBinaryMetadata
	if err := json.Unmarshal(data, &metadata); err != nil {
		return "", err
	}

	gitHash := strings.TrimSpace(metadata.Commit)
	if gitHash == "" {
		return "", fmt.Errorf("missing commit in %s", metaPath)
	}

	return gitHash, nil
}

func binaryMetadataPath(binaryPath string) string {
	base := filepath.Base(binaryPath)
	if ext := filepath.Ext(base); ext != "" {
		base = strings.TrimSuffix(base, ext)
	}
	return filepath.Join(filepath.Dir(binaryPath), base+".meta.json")
}
