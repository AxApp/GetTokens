package wailsapp

import (
	"database/sql"
	"os"
	"path/filepath"
	"testing"

	_ "modernc.org/sqlite"
)

func TestListCachedAccountsReadsSQLiteSnapshotWithoutSecrets(t *testing.T) {
	root := t.TempDir()
	t.Setenv("HOME", root)
	configDir := filepath.Join(root, ".config", "gettokens")
	if err := os.MkdirAll(configDir, 0o700); err != nil {
		t.Fatalf("mkdir config dir: %v", err)
	}
	dbPath := filepath.Join(configDir, "accounts-v1.sqlite")
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte("account-store-db: "+dbPath+"\n"), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}
	createSnapshotTestDB(t, dbPath)

	records, err := (&App{}).ListCachedAccounts()
	if err != nil {
		t.Fatalf("ListCachedAccounts: %v", err)
	}
	if len(records) != 3 {
		t.Fatalf("records len = %d, want 3: %#v", len(records), records)
	}

	codex := records[0]
	if codex.ID != "acct_00000000-0000-4000-8000-000000000001" || codex.BaseURL != "https://api.openai.com/v1" {
		t.Fatalf("unexpected codex snapshot: %#v", codex)
	}
	if codex.APIKey != "" || len(codex.APIKeys) != 0 || codex.Headers != nil || codex.PlatformCookie != "" || codex.QuotaCurl != "" || codex.BillingCurl != "" {
		t.Fatalf("codex snapshot leaked secret fields: %#v", codex)
	}

	auth := records[1]
	if auth.ID != "acct_00000000-0000-4000-8000-000000000002" || auth.Email != "user@example.com" || auth.PlanType != "plus" {
		t.Fatalf("unexpected auth snapshot: %#v", auth)
	}

	compat := records[2]
	if compat.ID != "acct_00000000-0000-4000-8000-000000000003" || compat.Provider != "deepseek" || compat.BaseURL != "https://api.deepseek.com/v1" {
		t.Fatalf("unexpected openai-compatible snapshot: %#v", compat)
	}
	if compat.APIKey != "" || len(compat.APIKeys) != 0 || compat.ModelFetchAPIKey != "" || compat.PlatformCookie != "" {
		t.Fatalf("openai-compatible snapshot leaked secret fields: %#v", compat)
	}
}

func TestListCachedAccountsKeepsCardWhenCredentialRowIsMissing(t *testing.T) {
	root := t.TempDir()
	t.Setenv("HOME", root)
	configDir := filepath.Join(root, ".config", "gettokens")
	if err := os.MkdirAll(configDir, 0o700); err != nil {
		t.Fatalf("mkdir config dir: %v", err)
	}
	dbPath := filepath.Join(configDir, "accounts-v1.sqlite")
	if err := os.WriteFile(filepath.Join(configDir, "config.yaml"), []byte("account-store-db: "+dbPath+"\n"), 0o600); err != nil {
		t.Fatalf("write config: %v", err)
	}

	db := openSnapshotTestDB(t, dbPath)
	defer db.Close()
	ensureSnapshotTestSchema(t, db)
	insertSnapshotCard(t, db, "acct_00000000-0000-4000-8000-000000000004", "auth-file", "Broken Credential", "codex", 1, 0, 100)

	records, err := (&App{}).ListCachedAccounts()
	if err != nil {
		t.Fatalf("ListCachedAccounts: %v", err)
	}
	if len(records) != 1 {
		t.Fatalf("records len = %d, want 1: %#v", len(records), records)
	}
	if records[0].ID != "acct_00000000-0000-4000-8000-000000000004" || records[0].DisplayName != "Broken Credential" {
		t.Fatalf("card-only account missing from snapshot: %#v", records[0])
	}
}

func createSnapshotTestDB(t *testing.T, dbPath string) {
	t.Helper()
	db := openSnapshotTestDB(t, dbPath)
	defer db.Close()
	ensureSnapshotTestSchema(t, db)

	insertSnapshotCard(t, db, "acct_00000000-0000-4000-8000-000000000001", "codex-api-key", "Codex Key", "codex", 10, 0, 100)
	if _, err := db.Exec(`
INSERT INTO codex_api_key_accounts(account_key, api_key, api_key_fingerprint, base_url, prefix, proxy_url, websockets, quota_curl, quota_enabled, billing_curl, billing_enabled, platform_cookie, curl_variables_json, format_base_urls_json, headers_json, models_json, excluded_models_json, updated_at_unix_ms)
VALUES (?, 'sk-secret', 'fp-secret', 'https://api.openai.com/v1', '', 'http://proxy.local', 1, 'curl secret', 1, 'curl billing', 1, 'session=secret', '{"platformCookie":"session=secret"}', '{"openai_responses":"https://api.openai.com/v1"}', '{"Authorization":"Bearer secret"}', '[{"name":"gpt-5"}]', '[]', 100)`,
		"acct_00000000-0000-4000-8000-000000000001",
	); err != nil {
		t.Fatalf("insert codex credential: %v", err)
	}

	insertSnapshotCard(t, db, "acct_00000000-0000-4000-8000-000000000002", "auth-file", "codex-plus.json", "codex", 5, 0, 101)
	if _, err := db.Exec(`
INSERT INTO auth_file_accounts(account_key, source_file_name, auth_json, auth_type, email, plan_type, status, status_message, modified_unix_ms, size_bytes, updated_at_unix_ms)
VALUES (?, 'codex-plus.json', '{"access_token":"secret"}', 'codex', 'user@example.com', 'plus', '', '', 100, 2048, 101)`,
		"acct_00000000-0000-4000-8000-000000000002",
	); err != nil {
		t.Fatalf("insert auth credential: %v", err)
	}

	insertSnapshotCard(t, db, "acct_00000000-0000-4000-8000-000000000003", "openai-compatible", "DeepSeek", "deepseek", 1, 1, 102)
	if _, err := db.Exec(`
INSERT INTO openai_compatible_accounts(account_key, provider_name, runtime_provider_key, base_url, prefix, api_key_entries_json, quota_curl, quota_enabled, billing_curl, billing_enabled, platform_cookie, curl_variables_json, headers_json, format_base_urls_json, models_json, model_fetch_api_key, model_fetch_base_url, updated_at_unix_ms)
VALUES (?, 'deepseek', 'openai-compatible:deepseek', 'https://api.deepseek.com/v1', '', '[{"api-key":"sk-secret"}]', 'curl quota', 1, 'curl billing', 1, 'session=secret', '{"platformCookie":"session=secret"}', '{"X-Provider":"secret"}', '{"anthropic":"https://api.deepseek.com/anthropic"}', '[{"name":"deepseek-chat"}]', 'sk-model-secret', 'https://models.example.com', 102)`,
		"acct_00000000-0000-4000-8000-000000000003",
	); err != nil {
		t.Fatalf("insert openai-compatible credential: %v", err)
	}
}

func openSnapshotTestDB(t *testing.T, dbPath string) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	return db
}

func ensureSnapshotTestSchema(t *testing.T, db *sql.DB) {
	t.Helper()
	_, err := db.Exec(`
CREATE TABLE account_cards (
  account_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  credential_source TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 0,
  disabled INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at_unix_ms INTEGER NOT NULL,
  updated_at_unix_ms INTEGER NOT NULL,
  deleted_at_unix_ms INTEGER
);
CREATE TABLE account_runtime_apply_state (
  account_key TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  status TEXT NOT NULL,
  last_error TEXT NOT NULL DEFAULT '',
  applied_at_unix_ms INTEGER NOT NULL DEFAULT 0,
  updated_at_unix_ms INTEGER NOT NULL
);
CREATE TABLE codex_api_key_accounts (
  account_key TEXT PRIMARY KEY,
  api_key TEXT NOT NULL,
  api_key_fingerprint TEXT NOT NULL DEFAULT '',
  base_url TEXT NOT NULL,
  prefix TEXT NOT NULL DEFAULT '',
  proxy_url TEXT NOT NULL DEFAULT '',
  websockets INTEGER NOT NULL DEFAULT 1,
  quota_curl TEXT NOT NULL DEFAULT '',
  quota_enabled INTEGER NOT NULL DEFAULT 0,
  billing_curl TEXT NOT NULL DEFAULT '',
  billing_enabled INTEGER NOT NULL DEFAULT 0,
  platform_cookie TEXT NOT NULL DEFAULT '',
  curl_variables_json TEXT NOT NULL DEFAULT '{}',
  format_base_urls_json TEXT NOT NULL DEFAULT '{}',
  headers_json TEXT NOT NULL DEFAULT '{}',
  models_json TEXT NOT NULL DEFAULT '[]',
  excluded_models_json TEXT NOT NULL DEFAULT '[]',
  updated_at_unix_ms INTEGER NOT NULL
);
CREATE TABLE auth_file_accounts (
  account_key TEXT PRIMARY KEY,
  source_file_name TEXT NOT NULL DEFAULT '',
  auth_json TEXT NOT NULL,
  auth_fingerprint TEXT NOT NULL DEFAULT '',
  auth_type TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  plan_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  status_message TEXT NOT NULL DEFAULT '',
  modified_unix_ms INTEGER NOT NULL DEFAULT 0,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  updated_at_unix_ms INTEGER NOT NULL
);
CREATE TABLE openai_compatible_accounts (
  account_key TEXT PRIMARY KEY,
  provider_name TEXT NOT NULL DEFAULT '',
  runtime_provider_key TEXT NOT NULL,
  base_url TEXT NOT NULL,
  prefix TEXT NOT NULL DEFAULT '',
  api_key_entries_json TEXT NOT NULL DEFAULT '[]',
  quota_curl TEXT NOT NULL DEFAULT '',
  quota_enabled INTEGER NOT NULL DEFAULT 0,
  billing_curl TEXT NOT NULL DEFAULT '',
  billing_enabled INTEGER NOT NULL DEFAULT 0,
  platform_cookie TEXT NOT NULL DEFAULT '',
  curl_variables_json TEXT NOT NULL DEFAULT '{}',
  headers_json TEXT NOT NULL DEFAULT '{}',
  format_base_urls_json TEXT NOT NULL DEFAULT '{}',
  models_json TEXT NOT NULL DEFAULT '[]',
  model_fetch_api_key TEXT NOT NULL DEFAULT '',
  model_fetch_base_url TEXT NOT NULL DEFAULT '',
  updated_at_unix_ms INTEGER NOT NULL
);`)
	if err != nil {
		t.Fatalf("create snapshot schema: %v", err)
	}
}

func insertSnapshotCard(t *testing.T, db *sql.DB, accountKey string, kind string, title string, provider string, priority int, disabled int, createdAt int64) {
	t.Helper()
	_, err := db.Exec(`
INSERT INTO account_cards(account_key, kind, title, provider, credential_source, priority, disabled, revision, metadata_json, created_at_unix_ms, updated_at_unix_ms)
VALUES (?, ?, ?, ?, 'sidecar-management-api', ?, ?, 1, '{}', ?, ?)`,
		accountKey,
		kind,
		title,
		provider,
		priority,
		disabled,
		createdAt,
		createdAt,
	)
	if err != nil {
		t.Fatalf("insert card %s: %v", accountKey, err)
	}
}
