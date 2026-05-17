package sidecar

import (
	"os"
	"path/filepath"
	"strings"
)

const (
	defaultPort = 8317
	devPort     = 18317
)

func resolveSidecarProfile() string {
	envValue := strings.TrimSpace(os.Getenv("GETTOKENS_APP_PROFILE"))
	exePath := ""
	if exe, err := os.Executable(); err == nil {
		exePath = exe
	}
	return resolveSidecarProfileFromExecutable(exePath, envValue)
}

func resolveSidecarProfileFromExecutable(exePath string, envValue string) string {
	exeName := ""
	if trimmed := strings.TrimSpace(exePath); trimmed != "" {
		exeName = filepath.Base(trimmed)
	}
	if profile := resolveSidecarProfileFrom(exeName, envValue); profile != "prod" {
		return profile
	}

	normalizedPath := filepath.ToSlash(strings.ToLower(strings.TrimSpace(exePath)))
	if strings.Contains(normalizedPath, "/build/bin/gettokens.app/contents/macos/gettokens") {
		return "dev"
	}
	return "prod"
}

func resolveSidecarProfileFrom(exeName string, envValue string) string {
	switch strings.ToLower(strings.TrimSpace(envValue)) {
	case "dev":
		return "dev"
	case "prod", "release":
		return "prod"
	}

	name := strings.ToLower(strings.TrimSpace(exeName))
	if strings.Contains(name, "gettokens-dev") {
		return "dev"
	}
	return "prod"
}

func preferredPortForProfile(profile string) int {
	if strings.EqualFold(strings.TrimSpace(profile), "dev") {
		return devPort
	}
	return defaultPort
}

func configDirNameForProfile(profile string) string {
	if strings.EqualFold(strings.TrimSpace(profile), "dev") {
		return "gettokens-dev"
	}
	return "gettokens"
}
