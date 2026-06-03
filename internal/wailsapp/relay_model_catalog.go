package wailsapp

import (
	"encoding/json"
	"log"
	"net/http"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

type relayModelFetcher func(FetchOpenAICompatibleProviderModelsInput) ([]OpenAICompatibleModel, error)

func (a *App) ListRelaySupportedModels() ([]OpenAICompatibleModel, error) {
	providers, codexKeys, err := a.loadRelayAccountStoreInventory()
	if err != nil {
		return nil, err
	}

	localCodexModels, err := loadLocalCodexModelsCache()
	if err != nil {
		localCodexModels = nil
	}

	cachedSnapshots, err := loadRelayModelAccountCache()
	if err != nil {
		cachedSnapshots = nil
	}
	cachedByAccount := indexRelayModelAccountSnapshots(cachedSnapshots)

	sidecarModels, err := a.fetchSidecarStaticModelDefinitions()
	if err != nil {
		sidecarModels = nil
	}

	models, snapshots := listRelaySupportedModelsWithAccountSnapshots(providers, codexKeys, func(input FetchOpenAICompatibleProviderModelsInput) ([]OpenAICompatibleModel, error) {
		result, err := a.FetchOpenAICompatibleProviderModels(input)
		if err != nil {
			return nil, err
		}
		return result.Models, nil
	}, localCodexModels, sidecarModels, cachedByAccount)
	if err := saveRelayModelAccountCache(snapshots); err != nil {
		log.Printf("save relay model account cache failed: %v", err)
	}
	if err := saveRelayModelCatalogTrace(models, snapshots); err != nil {
		log.Printf("save relay model catalog trace failed: %v", err)
	}
	return models, nil
}

func (a *App) loadRelayAccountStoreInventory() ([]OpenAICompatibleProvider, []cliproxyapi.CodexAPIKey, error) {
	accounts, err := a.managementClient().ListAccounts()
	if err != nil {
		return nil, nil, err
	}
	providers := make([]OpenAICompatibleProvider, 0, len(accounts))
	codexKeys := make([]cliproxyapi.CodexAPIKey, 0, len(accounts))
	for _, account := range accounts {
		switch account.Kind {
		case cliproxyapi.AccountKindOpenAICompatible:
			providers = append(providers, openAICompatibleProviderFromUnifiedAccount(account))
		case cliproxyapi.AccountKindCodexAPIKey:
			if account.CodexAPIKey == nil {
				continue
			}
			codexKeys = append(codexKeys, cliproxyapi.CodexAPIKey{
				LocalID:    strings.TrimSpace(account.AccountKey),
				APIKey:     strings.TrimSpace(account.CodexAPIKey.APIKey),
				Label:      strings.TrimSpace(account.Title),
				Priority:   account.Priority,
				Disabled:   account.Disabled,
				Prefix:     strings.TrimSpace(account.CodexAPIKey.Prefix),
				BaseURL:    strings.TrimSpace(account.CodexAPIKey.BaseURL),
				ProxyURL:   strings.TrimSpace(account.CodexAPIKey.ProxyURL),
				Models:     parseRelayCodexModelsJSON(account.CodexAPIKey.ModelsJSON),
				Headers:    parseRelayStringMapJSON(account.CodexAPIKey.HeadersJSON),
				Websockets: account.CodexAPIKey.Websockets,
			})
		}
	}
	return providers, codexKeys, nil
}

func parseRelayCodexModelsJSON(raw string) []cliproxyapi.CodexModel {
	var items []cliproxyapi.CodexModel
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &items); err != nil {
		return nil
	}
	return items
}

func parseRelayStringMapJSON(raw string) map[string]string {
	var items map[string]string
	if err := json.Unmarshal([]byte(strings.TrimSpace(raw)), &items); err != nil {
		return nil
	}
	return items
}

// fetchSidecarStaticModelDefinitions fetches the static model definitions from the
// sidecar's management API (/v0/management/model-definitions/codex) and maps them to
// OpenAICompatibleModel. These definitions represent the known models the relay can route.
// If the sidecar is unavailable or the request fails, returns nil without error (graceful degradation).
func (a *App) fetchSidecarStaticModelDefinitions() ([]OpenAICompatibleModel, error) {
	if a == nil || (a.sidecar == nil && a.sidecarRequest == nil) {
		return nil, nil
	}
	body, _, err := a.SidecarRequest(http.MethodGet, ManagementAPIPrefix+"/model-definitions/codex", nil, nil, "")
	if err != nil {
		// Sidecar not ready, request failed (network, timeout, etc), or other error
		// Gracefully degrade — just return empty without error so other sources can be used
		return nil, nil
	}

	models, parseErr := parseSidecarModelDefinitions(string(body))
	if parseErr != nil {
		// JSON parse failed — gracefully degrade
		return nil, nil
	}

	return models, nil
}

// parseSidecarModelDefinitions parses the JSON response from /v0/management/model-definitions/:channel.
// Expected shape: { "channel": "codex", "models": [{ "id": "...", "display_name": "...", "thinking": { "levels": [...] } }] }
func parseSidecarModelDefinitions(body string) ([]OpenAICompatibleModel, error) {
	type thinkingBlock struct {
		Levels []string `json:"levels"`
	}
	type modelEntry struct {
		ID          string        `json:"id"`
		DisplayName string        `json:"display_name"`
		Thinking    thinkingBlock `json:"thinking"`
	}
	var payload struct {
		Models []modelEntry `json:"models"`
	}

	trimmed := strings.TrimSpace(body)
	if trimmed == "" {
		return nil, nil
	}
	if err := json.Unmarshal([]byte(trimmed), &payload); err != nil {
		return nil, err
	}

	models := make([]OpenAICompatibleModel, 0, len(payload.Models))
	for _, item := range payload.Models {
		name := strings.TrimSpace(item.ID)
		if name == "" {
			continue
		}

		alias := strings.TrimSpace(item.DisplayName)
		if alias == name {
			alias = ""
		}

		models = append(models, OpenAICompatibleModel{
			Name:                      name,
			Alias:                     alias,
			SupportedReasoningEfforts: normalizeReasoningEfforts(item.Thinking.Levels),
		})
	}

	return normalizeProviderModels(models), nil
}

func listRelaySupportedModels(
	providers []OpenAICompatibleProvider,
	codexKeys []cliproxyapi.CodexAPIKey,
	fetcher relayModelFetcher,
	localCodexModels []OpenAICompatibleModel,
	sidecarModels []OpenAICompatibleModel,
) []OpenAICompatibleModel {
	models, _ := listRelaySupportedModelsWithAccountSnapshots(providers, codexKeys, fetcher, localCodexModels, sidecarModels, nil)
	return models
}

func listRelaySupportedModelsWithAccountSnapshots(
	providers []OpenAICompatibleProvider,
	codexKeys []cliproxyapi.CodexAPIKey,
	fetcher relayModelFetcher,
	localCodexModels []OpenAICompatibleModel,
	sidecarModels []OpenAICompatibleModel,
	cachedByAccount map[string]relayModelAccountSnapshot,
) ([]OpenAICompatibleModel, []relayModelAccountSnapshot) {
	merged := make(map[string]OpenAICompatibleModel)
	snapshots := make([]relayModelAccountSnapshot, 0, len(providers)+len(codexKeys))

	for _, provider := range providers {
		if provider.Disabled {
			continue
		}

		accountModels := make([]OpenAICompatibleModel, 0, len(provider.Models))
		accountModels = append(accountModels, provider.Models...)

		if fetcher != nil && strings.TrimSpace(provider.BaseURL) != "" && strings.TrimSpace(provider.APIKey) != "" {
			remoteModels, err := fetcher(FetchOpenAICompatibleProviderModelsInput{
				BaseURL: provider.BaseURL,
				APIKey:  provider.APIKey,
				Headers: cloneHeaders(provider.Headers),
			})
			if err == nil {
				accountModels = append(accountModels, remoteModels...)
			}
		}

		accountKey := strings.TrimSpace(provider.AccountKey)
		accountModels = normalizeProviderModels(accountModels)
		if len(accountModels) == 0 && accountKey != "" && cachedByAccount != nil {
			if cached, ok := cachedByAccount[accountKey]; ok {
				accountModels = normalizeProviderModels(cached.Models)
			}
		}
		appendRelaySupportedModels(merged, accountModels)
		if accountKey != "" && len(accountModels) > 0 {
			snapshots = append(snapshots, relayModelAccountSnapshot{
				AccountKey:   accountKey,
				Kind:         "openai-compatible",
				ProviderName: strings.TrimSpace(provider.Name),
				Models:       accountModels,
			})
		}
	}

	for _, key := range codexKeys {
		if key.Disabled {
			continue
		}

		accountKey := strings.TrimSpace(key.LocalID)
		models := make([]OpenAICompatibleModel, 0, len(key.Models))
		for _, model := range key.Models {
			models = append(models, OpenAICompatibleModel{
				Name:  model.Name,
				Alias: model.Alias,
			})
		}
		models = normalizeProviderModels(models)
		if len(models) == 0 && accountKey != "" && cachedByAccount != nil {
			if cached, ok := cachedByAccount[accountKey]; ok {
				models = normalizeProviderModels(cached.Models)
			}
		}
		appendRelaySupportedModels(merged, models)
		if accountKey != "" && len(models) > 0 {
			snapshots = append(snapshots, relayModelAccountSnapshot{
				AccountKey:   accountKey,
				Kind:         "codex-api-key",
				ProviderName: strings.TrimSpace(key.Label),
				Models:       models,
			})
		}
	}

	// Codex's local models cache represents models the Codex client already knows
	// how to request. Keep it in the projected catalog alongside GetTokens local
	// account-backed models so syncing the catalog does not hide built-in choices.
	appendRelaySupportedModels(merged, localCodexModels)

	// Sidecar static definitions provide metadata for models that already have an
	// account-backed runtime auth. They must not expose sidecar-only models to the
	// local Codex catalog, because selecting such a model would route to no auth.
	mergeRelaySupportedModelMetadata(merged, sidecarModels)

	if len(merged) == 0 {
		return nil, snapshots
	}

	names := make([]string, 0, len(merged))
	for name := range merged {
		names = append(names, name)
	}
	sortModelNames(names)

	models := make([]OpenAICompatibleModel, 0, len(names))
	for _, name := range names {
		models = append(models, merged[name])
	}
	return models, snapshots
}

func sortModelNames(names []string) {
	sort.SliceStable(names, func(i, j int) bool {
		return compareModelNames(names[i], names[j]) < 0
	})
}

func compareModelNames(left string, right string) int {
	leftKey := buildModelSortKey(left)
	rightKey := buildModelSortKey(right)

	if leftKey.family != rightKey.family {
		return strings.Compare(leftKey.family, rightKey.family)
	}

	maxParts := len(leftKey.numbers)
	if len(rightKey.numbers) > maxParts {
		maxParts = len(rightKey.numbers)
	}
	for index := 0; index < maxParts; index++ {
		leftPart := 0
		if index < len(leftKey.numbers) {
			leftPart = leftKey.numbers[index]
		}
		rightPart := 0
		if index < len(rightKey.numbers) {
			rightPart = rightKey.numbers[index]
		}
		if leftPart != rightPart {
			return rightPart - leftPart
		}
	}

	if leftKey.sizeRank != rightKey.sizeRank {
		return rightKey.sizeRank - leftKey.sizeRank
	}

	return strings.Compare(leftKey.normalizedName, rightKey.normalizedName)
}

type modelSortKey struct {
	family         string
	numbers        []int
	sizeRank       int
	normalizedName string
}

func buildModelSortKey(name string) modelSortKey {
	normalizedName := strings.ToLower(strings.TrimSpace(name))
	familyEnd := len(normalizedName)
	numbers := make([]int, 0, 3)

	for index := 0; index < len(normalizedName); {
		r, size := utf8.DecodeRuneInString(normalizedName[index:])
		if unicode.IsDigit(r) {
			if familyEnd == len(normalizedName) {
				familyEnd = index
			}
			start := index
			for index < len(normalizedName) {
				r, size = utf8.DecodeRuneInString(normalizedName[index:])
				if !unicode.IsDigit(r) {
					break
				}
				index += size
			}
			if value, err := strconv.Atoi(normalizedName[start:index]); err == nil {
				numbers = append(numbers, value)
			}
			continue
		}
		index += size
	}

	family := strings.Trim(normalizedName[:familyEnd], "-_. ")
	if family == "" {
		family = normalizedName
	}

	return modelSortKey{
		family:         family,
		numbers:        numbers,
		sizeRank:       modelSizeRank(normalizedName),
		normalizedName: normalizedName,
	}
}

func modelSizeRank(name string) int {
	switch {
	case strings.Contains(name, "nano"):
		return -4
	case strings.Contains(name, "mini"), strings.Contains(name, "lite"):
		return -3
	case strings.Contains(name, "small"):
		return -2
	default:
		return 0
	}
}

func appendRelaySupportedModels(target map[string]OpenAICompatibleModel, items []OpenAICompatibleModel) {
	for _, item := range normalizeProviderModels(items) {
		current, ok := target[item.Name]
		if !ok {
			target[item.Name] = item
			continue
		}
		target[item.Name] = mergeRelaySupportedModel(current, item)
	}
}

func mergeRelaySupportedModelMetadata(target map[string]OpenAICompatibleModel, items []OpenAICompatibleModel) {
	for _, item := range normalizeProviderModels(items) {
		current, ok := target[item.Name]
		if !ok {
			continue
		}
		target[item.Name] = mergeRelaySupportedModel(current, item)
	}
}

func mergeRelaySupportedModel(current OpenAICompatibleModel, incoming OpenAICompatibleModel) OpenAICompatibleModel {
	if strings.TrimSpace(current.Alias) == "" {
		current.Alias = strings.TrimSpace(incoming.Alias)
	}
	current.SupportedReasoningEfforts = mergeReasoningEfforts(
		current.SupportedReasoningEfforts,
		incoming.SupportedReasoningEfforts,
	)
	if normalizeReasoningEffort(current.DefaultReasoningEffort) == "" {
		current.DefaultReasoningEffort = normalizeReasoningEffort(incoming.DefaultReasoningEffort)
	}
	if normalizeReasoningEffort(current.DefaultReasoningEffort) != "" &&
		!containsString(current.SupportedReasoningEfforts, current.DefaultReasoningEffort) {
		current.SupportedReasoningEfforts = append(current.SupportedReasoningEfforts, current.DefaultReasoningEffort)
		current.SupportedReasoningEfforts = normalizeReasoningEfforts(current.SupportedReasoningEfforts)
	}
	return current
}

func mergeReasoningEfforts(left []string, right []string) []string {
	return normalizeReasoningEfforts(append(append([]string(nil), left...), right...))
}

func containsString(items []string, target string) bool {
	for _, item := range items {
		if item == target {
			return true
		}
	}
	return false
}

func loadLocalCodexModelsCache() ([]OpenAICompatibleModel, error) {
	codexHome, err := resolveCodexHomePath()
	if err != nil {
		return nil, err
	}

	cacheBody, err := readOptionalTextFile(filepath.Join(codexHome, "models_cache.json"))
	if err != nil {
		return nil, err
	}

	return parseLocalCodexModelsCache(cacheBody)
}

func parseLocalCodexModelsCache(body string) ([]OpenAICompatibleModel, error) {
	type localCodexReasoningLevel struct {
		Effort string `json:"effort"`
	}
	type localCodexModel struct {
		Slug                     string                     `json:"slug"`
		DisplayName              string                     `json:"display_name"`
		DefaultReasoningLevel    string                     `json:"default_reasoning_level"`
		SupportedReasoningLevels []localCodexReasoningLevel `json:"supported_reasoning_levels"`
	}
	var payload struct {
		Models []localCodexModel `json:"models"`
	}

	trimmed := strings.TrimSpace(body)
	if trimmed == "" {
		return nil, nil
	}
	if err := json.Unmarshal([]byte(trimmed), &payload); err != nil {
		return nil, err
	}

	models := make([]OpenAICompatibleModel, 0, len(payload.Models))
	for _, item := range payload.Models {
		name := strings.TrimSpace(item.Slug)
		if name == "" {
			name = strings.TrimSpace(item.DisplayName)
		}
		if name == "" {
			continue
		}

		alias := strings.TrimSpace(item.DisplayName)
		if alias == name {
			alias = ""
		}

		reasoningEfforts := make([]string, 0, len(item.SupportedReasoningLevels))
		for _, level := range item.SupportedReasoningLevels {
			reasoningEfforts = append(reasoningEfforts, level.Effort)
		}

		models = append(models, OpenAICompatibleModel{
			Name:                      name,
			Alias:                     alias,
			SupportedReasoningEfforts: normalizeReasoningEfforts(reasoningEfforts),
			DefaultReasoningEffort:    normalizeReasoningEffort(item.DefaultReasoningLevel),
		})
	}

	return normalizeProviderModels(models), nil
}
