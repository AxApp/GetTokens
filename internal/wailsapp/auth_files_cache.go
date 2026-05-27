package wailsapp

import (
	"strings"
)

type authFileMetadataFingerprint struct {
	Size     int64
	Modified int64
}

type authFileMetadataCacheEntry struct {
	Name        string
	Fingerprint authFileMetadataFingerprint
	Type        string
	Provider    string
	Priority    int
	Email       string
	PlanType    string
}

func authFileMetadataCacheName(name string) string {
	return strings.TrimSpace(name)
}

func authFileMetadataFingerprintFor(file AuthFileItem) authFileMetadataFingerprint {
	return authFileMetadataFingerprint{
		Size:     file.Size,
		Modified: file.Modified,
	}
}

func (a *App) cachedAuthFileMetadata(file AuthFileItem) (authFileMetadataCacheEntry, bool) {
	name := authFileMetadataCacheName(file.Name)
	if name == "" {
		return authFileMetadataCacheEntry{}, false
	}
	fingerprint := authFileMetadataFingerprintFor(file)
	a.authFileCacheMu.RLock()
	entry, ok := a.authFileMetadataCache[name]
	a.authFileCacheMu.RUnlock()
	if !ok || entry.Fingerprint != fingerprint {
		return authFileMetadataCacheEntry{}, false
	}
	return entry, true
}

func (a *App) storeAuthFileMetadata(file AuthFileItem) {
	name := authFileMetadataCacheName(file.Name)
	if name == "" {
		return
	}
	entry := authFileMetadataCacheEntry{
		Name:        name,
		Fingerprint: authFileMetadataFingerprintFor(file),
		Type:        strings.TrimSpace(file.Type),
		Provider:    strings.TrimSpace(file.Provider),
		Priority:    file.Priority,
		Email:       strings.TrimSpace(file.Email),
		PlanType:    strings.TrimSpace(file.PlanType),
	}
	a.authFileCacheMu.Lock()
	if a.authFileMetadataCache == nil {
		a.authFileMetadataCache = map[string]authFileMetadataCacheEntry{}
	}
	a.authFileMetadataCache[name] = entry
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
		if trimmed := authFileMetadataCacheName(name); trimmed != "" {
			targets[trimmed] = struct{}{}
		}
	}
	if len(targets) == 0 {
		return
	}
	for name := range targets {
		if _, ok := a.authFileMetadataCache[name]; ok {
			delete(a.authFileMetadataCache, name)
		}
	}
}
