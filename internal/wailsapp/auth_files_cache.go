package wailsapp

import (
	"fmt"
	"strings"
)

type authFileMetadataCacheEntry struct {
	Name     string
	Size     int64
	Modified int64
	Type     string
	Provider string
	Priority int
	Email    string
	PlanType string
}

func authFileMetadataCacheKey(name string, size int64, modified int64) string {
	return fmt.Sprintf("%s|%d|%d", strings.TrimSpace(name), size, modified)
}

func (a *App) cachedAuthFileMetadata(file AuthFileItem) (authFileMetadataCacheEntry, bool) {
	name := strings.TrimSpace(file.Name)
	if name == "" {
		return authFileMetadataCacheEntry{}, false
	}
	key := authFileMetadataCacheKey(name, file.Size, file.Modified)
	a.authFileCacheMu.RLock()
	entry, ok := a.authFileMetadataCache[key]
	a.authFileCacheMu.RUnlock()
	if !ok {
		return authFileMetadataCacheEntry{}, false
	}
	return entry, true
}

func (a *App) storeAuthFileMetadata(file AuthFileItem) {
	name := strings.TrimSpace(file.Name)
	if name == "" {
		return
	}
	entry := authFileMetadataCacheEntry{
		Name:     name,
		Size:     file.Size,
		Modified: file.Modified,
		Type:     strings.TrimSpace(file.Type),
		Provider: strings.TrimSpace(file.Provider),
		Priority: file.Priority,
		Email:    strings.TrimSpace(file.Email),
		PlanType: strings.TrimSpace(file.PlanType),
	}
	key := authFileMetadataCacheKey(name, file.Size, file.Modified)
	a.authFileCacheMu.Lock()
	if a.authFileMetadataCache == nil {
		a.authFileMetadataCache = map[string]authFileMetadataCacheEntry{}
	}
	a.authFileMetadataCache[key] = entry
	a.authFileCacheMu.Unlock()
}

func applyCachedAuthFileMetadata(file *AuthFileItem, entry authFileMetadataCacheEntry) {
	if file == nil {
		return
	}
	if needsAuthFileKindInference(*file) {
		if entry.Provider != "" {
			file.Provider = entry.Provider
		}
		if entry.Type != "" {
			file.Type = entry.Type
		}
	}
	if strings.TrimSpace(file.Email) == "" {
		file.Email = entry.Email
	}
	if strings.TrimSpace(file.PlanType) == "" {
		file.PlanType = entry.PlanType
	}
	if file.Priority == 0 {
		file.Priority = entry.Priority
	}
}

func (a *App) invalidateAuthFileMetadataCache(names ...string) {
	a.authFileCacheMu.Lock()
	defer a.authFileCacheMu.Unlock()
	if len(a.authFileMetadataCache) == 0 {
		return
	}
	if len(names) == 0 {
		a.authFileMetadataCache = map[string]authFileMetadataCacheEntry{}
		return
	}
	targets := map[string]struct{}{}
	for _, name := range names {
		if trimmed := strings.TrimSpace(name); trimmed != "" {
			targets[trimmed] = struct{}{}
		}
	}
	if len(targets) == 0 {
		return
	}
	for key, entry := range a.authFileMetadataCache {
		if _, ok := targets[entry.Name]; ok {
			delete(a.authFileMetadataCache, key)
		}
	}
}
