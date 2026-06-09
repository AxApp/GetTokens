package wailsapp

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	accountsdomain "github.com/linhay/gettokens/internal/accounts"
	"github.com/linhay/gettokens/internal/cliproxyapi"
	"github.com/linhay/gettokens/internal/sidecar"
	"gopkg.in/yaml.v3"

	_ "modernc.org/sqlite"
)

const localAccountSnapshotTimeout = 1500 * time.Millisecond

type localAccountCardSnapshot struct {
	AccountKey         string
	Kind               cliproxyapi.AccountKind
	Title              string
	Provider           string
	CredentialSource   cliproxyapi.AccountCredentialSource
	Priority           int
	Disabled           bool
	Revision           int
	MetadataJSON       string
	CreatedAtUnixMs    int64
	UpdatedAtUnixMs    int64
	DeletedAtUnixMs    int64
	RuntimeApplyStatus string
	RuntimeApplyError  string
}

// ListCachedAccounts returns a best-effort local first-paint snapshot from the
// sidecar-owned SQLite account store. It intentionally avoids secrets and does
// not require the sidecar management API to be ready.
func (a *App) ListCachedAccounts() ([]accountsdomain.AccountRecord, error) {
	ctx, cancel := context.WithTimeout(context.Background(), localAccountSnapshotTimeout)
	defer cancel()

	accounts, err := a.listCachedAccountsFromSQLite(ctx)
	if err != nil {
		return nil, err
	}
	return sanitizeLocalAccountSnapshotRecords(accountsdomain.BuildUnifiedAccountRecords(accounts)), nil
}

func (a *App) listCachedAccountsFromSQLite(ctx context.Context) ([]cliproxyapi.UnifiedAccount, error) {
	dbPath, err := a.resolveAccountStoreDBPath()
	if err != nil {
		return nil, err
	}
	if _, err := os.Stat(dbPath); err != nil {
		if os.IsNotExist(err) {
			return []cliproxyapi.UnifiedAccount{}, nil
		}
		return nil, err
	}

	db, err := sql.Open("sqlite", accountStoreReadOnlyDSN(dbPath))
	if err != nil {
		return nil, fmt.Errorf("open local account sqlite snapshot: %w", err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("ping local account sqlite snapshot: %w", err)
	}

	cards, err := readLocalAccountCards(ctx, db)
	if err != nil {
		return nil, err
	}
	if len(cards) == 0 {
		return []cliproxyapi.UnifiedAccount{}, nil
	}

	authFiles, _ := readLocalAuthFileCredentials(ctx, db)
	codexKeys, _ := readLocalCodexAPIKeyCredentials(ctx, db)
	openAICompatible, _ := readLocalOpenAICompatibleCredentials(ctx, db)

	sort.SliceStable(cards, func(i, j int) bool {
		if cards[i].Priority != cards[j].Priority {
			return cards[i].Priority > cards[j].Priority
		}
		if cards[i].CreatedAtUnixMs != cards[j].CreatedAtUnixMs {
			return cards[i].CreatedAtUnixMs < cards[j].CreatedAtUnixMs
		}
		return cards[i].AccountKey < cards[j].AccountKey
	})

	accounts := make([]cliproxyapi.UnifiedAccount, 0, len(cards))
	for _, card := range cards {
		account := cliproxyapi.UnifiedAccount{
			AccountKey:         strings.TrimSpace(card.AccountKey),
			Kind:               card.Kind,
			Title:              strings.TrimSpace(card.Title),
			Provider:           strings.TrimSpace(card.Provider),
			CredentialSource:   card.CredentialSource,
			Priority:           card.Priority,
			Disabled:           card.Disabled,
			Revision:           card.Revision,
			MetadataJSON:       strings.TrimSpace(card.MetadataJSON),
			CreatedAtUnixMs:    card.CreatedAtUnixMs,
			UpdatedAtUnixMs:    card.UpdatedAtUnixMs,
			DeletedAtUnixMs:    card.DeletedAtUnixMs,
			RuntimeApplyStatus: strings.TrimSpace(card.RuntimeApplyStatus),
			RuntimeApplyError:  strings.TrimSpace(card.RuntimeApplyError),
		}
		if account.CredentialSource == "" {
			account.CredentialSource = cliproxyapi.AccountCredentialSourceSidecarManagementAPI
		}
		switch card.Kind {
		case cliproxyapi.AccountKindAuthFile:
			if credential, ok := authFiles[card.AccountKey]; ok {
				account.AuthFile = &credential
			}
		case cliproxyapi.AccountKindCodexAPIKey:
			if credential, ok := codexKeys[card.AccountKey]; ok {
				account.CodexAPIKey = &credential
			}
		case cliproxyapi.AccountKindOpenAICompatible:
			if credential, ok := openAICompatible[card.AccountKey]; ok {
				account.OpenAICompatible = &credential
			}
		}
		accounts = append(accounts, account)
	}
	return accounts, nil
}

func (a *App) resolveAccountStoreDBPath() (string, error) {
	configPath, err := a.resolveSidecarConfigPath()
	if err != nil {
		return "", err
	}
	configDir := filepath.Dir(configPath)
	if configured, ok := readAccountStoreDBPathFromConfig(configPath); ok {
		return expandAccountStoreDBPath(configured, configDir)
	}
	return filepath.Join(configDir, "accounts-v1.sqlite"), nil
}

func (a *App) resolveSidecarConfigPath() (string, error) {
	if a != nil && a.sidecar != nil {
		return a.sidecar.ConfigFilePath()
	}
	configDir, err := sidecar.CurrentProfileConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(configDir, "config.yaml"), nil
}

func readAccountStoreDBPathFromConfig(configPath string) (string, bool) {
	body, err := os.ReadFile(configPath)
	if err != nil {
		return "", false
	}
	var document yaml.Node
	if err := yaml.Unmarshal(body, &document); err != nil {
		return "", false
	}
	root := yamlDocumentMappingRoot(&document)
	if root == nil {
		return "", false
	}
	return readYAMLMappingString(root, "account-store-db")
}

func yamlDocumentMappingRoot(document *yaml.Node) *yaml.Node {
	if document == nil || document.Kind != yaml.DocumentNode || len(document.Content) == 0 || document.Content[0] == nil {
		return nil
	}
	if document.Content[0].Kind != yaml.MappingNode {
		return nil
	}
	return document.Content[0]
}

func readYAMLMappingString(parent *yaml.Node, key string) (string, bool) {
	if parent == nil || parent.Kind != yaml.MappingNode {
		return "", false
	}
	for index := 0; index+1 < len(parent.Content); index += 2 {
		keyNode := parent.Content[index]
		valueNode := parent.Content[index+1]
		if keyNode == nil || valueNode == nil || keyNode.Value != key {
			continue
		}
		return strings.TrimSpace(valueNode.Value), true
	}
	return "", false
}

func expandAccountStoreDBPath(rawPath string, configDir string) (string, error) {
	path := strings.TrimSpace(os.ExpandEnv(rawPath))
	if path == "" {
		return filepath.Join(configDir, "accounts-v1.sqlite"), nil
	}
	if path == "~" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return home, nil
	}
	if strings.HasPrefix(path, "~/") || strings.HasPrefix(path, `~\`) {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		return filepath.Join(home, path[2:]), nil
	}
	if filepath.IsAbs(path) {
		return filepath.Clean(path), nil
	}
	if strings.TrimSpace(configDir) == "" {
		return filepath.Abs(path)
	}
	return filepath.Join(configDir, path), nil
}

func accountStoreReadOnlyDSN(path string) string {
	openPath := path
	if abs, err := filepath.Abs(path); err == nil {
		openPath = abs
	}
	dsn := url.URL{Scheme: "file", Path: filepath.ToSlash(openPath)}
	query := dsn.Query()
	query.Add("mode", "ro")
	query.Add("_pragma", "busy_timeout(1000)")
	query.Add("_pragma", "query_only(1)")
	dsn.RawQuery = query.Encode()
	return dsn.String()
}

func readLocalAccountCards(ctx context.Context, db *sql.DB) ([]localAccountCardSnapshot, error) {
	rows, err := db.QueryContext(ctx, `
SELECT
  c.account_key,
  c.kind,
  c.title,
  c.provider,
  c.credential_source,
  c.priority,
  c.disabled,
  c.revision,
  c.metadata_json,
  c.created_at_unix_ms,
  c.updated_at_unix_ms,
  COALESCE(c.deleted_at_unix_ms, 0),
  COALESCE(a.status, ''),
  COALESCE(a.last_error, '')
FROM account_cards c
LEFT JOIN account_runtime_apply_state a ON a.account_key = c.account_key
WHERE c.deleted_at_unix_ms IS NULL`)
	if err != nil {
		return nil, fmt.Errorf("query local account cards: %w", err)
	}
	defer rows.Close()

	cards := make([]localAccountCardSnapshot, 0)
	for rows.Next() {
		var card localAccountCardSnapshot
		var disabled int
		if err := rows.Scan(
			&card.AccountKey,
			&card.Kind,
			&card.Title,
			&card.Provider,
			&card.CredentialSource,
			&card.Priority,
			&disabled,
			&card.Revision,
			&card.MetadataJSON,
			&card.CreatedAtUnixMs,
			&card.UpdatedAtUnixMs,
			&card.DeletedAtUnixMs,
			&card.RuntimeApplyStatus,
			&card.RuntimeApplyError,
		); err != nil {
			return cards, fmt.Errorf("scan local account card: %w", err)
		}
		card.Disabled = disabled != 0
		if strings.TrimSpace(card.AccountKey) == "" {
			continue
		}
		cards = append(cards, card)
	}
	if err := rows.Err(); err != nil && len(cards) == 0 {
		return nil, fmt.Errorf("iterate local account cards: %w", err)
	}
	return cards, nil
}

func readLocalAuthFileCredentials(ctx context.Context, db *sql.DB) (map[string]cliproxyapi.AuthFileAccountCredential, error) {
	rows, err := db.QueryContext(ctx, `
SELECT account_key, source_file_name, auth_type, email, plan_type, modified_unix_ms, size_bytes
FROM auth_file_accounts`)
	if err != nil {
		return map[string]cliproxyapi.AuthFileAccountCredential{}, err
	}
	defer rows.Close()

	items := map[string]cliproxyapi.AuthFileAccountCredential{}
	for rows.Next() {
		var accountKey string
		var credential cliproxyapi.AuthFileAccountCredential
		if err := rows.Scan(
			&accountKey,
			&credential.SourceFileName,
			&credential.AuthType,
			&credential.Email,
			&credential.PlanType,
			&credential.ModifiedUnixMs,
			&credential.SizeBytes,
		); err != nil {
			return items, err
		}
		if key := strings.TrimSpace(accountKey); key != "" {
			items[key] = credential
		}
	}
	return items, rows.Err()
}

func readLocalCodexAPIKeyCredentials(ctx context.Context, db *sql.DB) (map[string]cliproxyapi.CodexAPIKeyAccountCredential, error) {
	rows, err := db.QueryContext(ctx, `
SELECT account_key, api_key_fingerprint, base_url, prefix, proxy_url, websockets, format_base_urls_json, models_json
FROM codex_api_key_accounts`)
	if err != nil {
		return map[string]cliproxyapi.CodexAPIKeyAccountCredential{}, err
	}
	defer rows.Close()

	items := map[string]cliproxyapi.CodexAPIKeyAccountCredential{}
	for rows.Next() {
		var accountKey string
		var websockets int
		var credential cliproxyapi.CodexAPIKeyAccountCredential
		if err := rows.Scan(
			&accountKey,
			&credential.APIKeyFingerprint,
			&credential.BaseURL,
			&credential.Prefix,
			&credential.ProxyURL,
			&websockets,
			&credential.FormatBaseURLsJSON,
			&credential.ModelsJSON,
		); err != nil {
			return items, err
		}
		credential.Websockets = websockets != 0
		if key := strings.TrimSpace(accountKey); key != "" {
			items[key] = credential
		}
	}
	return items, rows.Err()
}

func readLocalOpenAICompatibleCredentials(ctx context.Context, db *sql.DB) (map[string]cliproxyapi.OpenAICompatibleAccountCredential, error) {
	rows, err := db.QueryContext(ctx, `
SELECT account_key, provider_name, runtime_provider_key, base_url, prefix, format_base_urls_json, models_json
FROM openai_compatible_accounts`)
	if err != nil {
		return map[string]cliproxyapi.OpenAICompatibleAccountCredential{}, err
	}
	defer rows.Close()

	items := map[string]cliproxyapi.OpenAICompatibleAccountCredential{}
	for rows.Next() {
		var accountKey string
		var credential cliproxyapi.OpenAICompatibleAccountCredential
		if err := rows.Scan(
			&accountKey,
			&credential.ProviderName,
			&credential.RuntimeProviderKey,
			&credential.BaseURL,
			&credential.Prefix,
			&credential.FormatBaseURLsJSON,
			&credential.ModelsJSON,
		); err != nil {
			return items, err
		}
		credential.APIKeyEntriesJSON = "[]"
		if key := strings.TrimSpace(accountKey); key != "" {
			items[key] = credential
		}
	}
	return items, rows.Err()
}

func sanitizeLocalAccountSnapshotRecords(records []accountsdomain.AccountRecord) []accountsdomain.AccountRecord {
	out := make([]accountsdomain.AccountRecord, 0, len(records))
	for _, record := range records {
		if strings.TrimSpace(record.ID) == "" {
			continue
		}
		record.APIKey = ""
		record.APIKeys = nil
		record.Headers = nil
		record.QuotaCurl = ""
		record.BillingCurl = ""
		record.PlatformCookie = ""
		record.CurlVariables = nil
		record.ModelFetchAPIKey = ""
		record.ModelFetchBaseURL = ""
		out = append(out, record)
	}
	return out
}
