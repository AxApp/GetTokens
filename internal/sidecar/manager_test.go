package sidecar

import (
	"bytes"
	"context"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gopkg.in/yaml.v3"
)

func TestSetStatusPreservesStartedAtUnixUntilStopped(t *testing.T) {
	manager := NewManager()
	manager.setStatus(Status{Code: StatusStarting, StartedAtUnix: 12345}, nil)

	if got := manager.CurrentStatus().StartedAtUnix; got != 12345 {
		t.Fatalf("startedAtUnix = %d, want 12345", got)
	}

	manager.setStatus(Status{Code: StatusReady, Port: 8317}, nil)
	if got := manager.CurrentStatus().StartedAtUnix; got != 12345 {
		t.Fatalf("startedAtUnix after ready = %d, want 12345", got)
	}

	manager.setStatus(Status{Code: StatusError, Message: "boom"}, nil)
	if got := manager.CurrentStatus().StartedAtUnix; got != 12345 {
		t.Fatalf("startedAtUnix after error = %d, want 12345", got)
	}

	manager.setStatus(Status{Code: StatusStopped}, nil)
	if got := manager.CurrentStatus().StartedAtUnix; got != 0 {
		t.Fatalf("startedAtUnix after stopped = %d, want 0", got)
	}
}

func TestSetStatusPreservesGitHashAcrossTransitions(t *testing.T) {
	manager := NewManager()
	manager.status = Status{Code: StatusStopped, GitHash: "960ebd9fd83f"}

	manager.setStatus(Status{Code: StatusStarting, StartedAtUnix: 12345}, nil)
	if got := manager.CurrentStatus().GitHash; got != "960ebd9fd83f" {
		t.Fatalf("gitHash after starting = %q, want %q", got, "960ebd9fd83f")
	}

	manager.setStatus(Status{Code: StatusReady, Port: 8317}, nil)
	if got := manager.CurrentStatus().GitHash; got != "960ebd9fd83f" {
		t.Fatalf("gitHash after ready = %q, want %q", got, "960ebd9fd83f")
	}

	manager.setStatus(Status{Code: StatusError, Message: "boom"}, nil)
	if got := manager.CurrentStatus().GitHash; got != "960ebd9fd83f" {
		t.Fatalf("gitHash after error = %q, want %q", got, "960ebd9fd83f")
	}

	manager.setStatus(Status{Code: StatusStopped}, nil)
	if got := manager.CurrentStatus().GitHash; got != "960ebd9fd83f" {
		t.Fatalf("gitHash after stopped = %q, want %q", got, "960ebd9fd83f")
	}
}

func TestResolveSidecarProfileFromPrefersEnvAndDevExecutable(t *testing.T) {
	if got := resolveSidecarProfileFrom("GetTokens", "dev"); got != "dev" {
		t.Fatalf("profile from env = %q, want dev", got)
	}
	if got := resolveSidecarProfileFrom("GetTokens-dev-darwin-arm64", ""); got != "dev" {
		t.Fatalf("profile from exe = %q, want dev", got)
	}
	if got := resolveSidecarProfileFrom("GetTokens", ""); got != "prod" {
		t.Fatalf("default profile = %q, want prod", got)
	}
}

func TestResolveSidecarProfileFromExecutableDetectsWailsDevAppBundle(t *testing.T) {
	if got := resolveSidecarProfileFromExecutable(
		"/Users/linhey/Desktop/linhay-open-sources/GetTokens/build/bin/GetTokens.app/Contents/MacOS/GetTokens",
		"",
	); got != "dev" {
		t.Fatalf("profile from dev app bundle = %q, want dev", got)
	}

	if got := resolveSidecarProfileFromExecutable(
		"/Applications/GetTokens.app/Contents/MacOS/GetTokens",
		"",
	); got != "prod" {
		t.Fatalf("profile from installed app bundle = %q, want prod", got)
	}
}

func TestProfileSpecificPortAndConfigDir(t *testing.T) {
	if got := preferredPortForProfile("dev"); got != devPort {
		t.Fatalf("dev port = %d, want %d", got, devPort)
	}
	if got := preferredPortForProfile("prod"); got != defaultPort {
		t.Fatalf("prod port = %d, want %d", got, defaultPort)
	}
	if got := configDirNameForProfile("dev"); got != "gettokens-dev" {
		t.Fatalf("dev config dir = %q, want gettokens-dev", got)
	}
	if got := configDirNameForProfile("prod"); got != "gettokens" {
		t.Fatalf("prod config dir = %q, want gettokens", got)
	}
}

func TestManagerProfileNormalizesDevAndProd(t *testing.T) {
	manager := &Manager{profile: "dev"}
	if got := manager.Profile(); got != "dev" {
		t.Fatalf("dev manager profile = %q, want dev", got)
	}

	manager.profile = "release"
	if got := manager.Profile(); got != "prod" {
		t.Fatalf("release manager profile = %q, want prod", got)
	}

	if got := (*Manager)(nil).Profile(); got != "prod" {
		t.Fatalf("nil manager profile = %q, want prod", got)
	}
}

func TestPortAvailabilityMatchesWildcardSidecarBind(t *testing.T) {
	listener, err := net.Listen("tcp6", "[::]:0")
	if err != nil {
		t.Skipf("tcp6 wildcard listener unavailable: %v", err)
	}
	defer listener.Close()

	port := listener.Addr().(*net.TCPAddr).Port
	if isPortFree(port) {
		t.Fatalf("isPortFree(%d) = true while wildcard tcp6 listener is active", port)
	}

	if second, err := net.Listen("tcp", fmt.Sprintf(":%d", port)); err == nil {
		_ = second.Close()
		t.Fatalf("test setup expected wildcard bind on port %d to fail", port)
	}
}

func TestFindOrphanedSidecarPIDsMatchesSameConfigOnly(t *testing.T) {
	configFile := "/Users/linhey/.config/gettokens/config.yaml"
	processes := []sidecarProcessInfo{
		{PID: 101, PPID: 1, Command: "/Applications/GetTokens.app/Contents/MacOS/cli-proxy-api -config /Users/linhey/.config/gettokens/config.yaml"},
		{PID: 102, PPID: 77, Command: "/Applications/GetTokens.app/Contents/MacOS/cli-proxy-api -config /Users/linhey/.config/gettokens/config.yaml"},
		{PID: 103, PPID: 1, Command: "/Applications/GetTokens.app/Contents/MacOS/cli-proxy-api -config /Users/linhey/.config/gettokens-dev/config.yaml"},
		{PID: 104, PPID: 1, Command: "/usr/bin/other -config /Users/linhey/.config/gettokens/config.yaml"},
		{PID: 105, PPID: 1, Command: "/Applications/GetTokens.app/Contents/MacOS/cli-proxy-api -config=/Users/linhey/.config/gettokens/config.yaml"},
	}

	pids := findOrphanedSidecarPIDs(processes, configFile, 999)
	if got, want := fmt.Sprint(pids), "[101 105]"; got != want {
		t.Fatalf("orphan pids = %s, want %s", got, want)
	}
}

func TestStopProcessKillsWhenInterruptIsIgnored(t *testing.T) {
	cmd := exec.Command(os.Args[0], "-test.run=TestSidecarProcessHelper")
	cmd.Env = append(os.Environ(), "GETTOKENS_SIDECAR_HELPER=ignore-interrupt")
	if err := cmd.Start(); err != nil {
		t.Fatalf("start test process: %v", err)
	}
	done := make(chan struct{})
	go func() {
		_ = cmd.Wait()
		close(done)
	}()
	t.Cleanup(func() {
		if cmd.ProcessState == nil || !cmd.ProcessState.Exited() {
			_ = cmd.Process.Kill()
		}
	})

	stopProcess(cmd.Process, done, 100*time.Millisecond)

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("process still running after stopProcess fallback")
	}
}

func TestSidecarProcessHelper(t *testing.T) {
	if os.Getenv("GETTOKENS_SIDECAR_HELPER") != "ignore-interrupt" {
		return
	}
	signal.Ignore(os.Interrupt)
	time.Sleep(30 * time.Second)
	os.Exit(0)
}

func TestNewManagerUsesDevProfileFromEnv(t *testing.T) {
	t.Setenv("GETTOKENS_APP_PROFILE", "dev")
	manager := NewManager()
	if manager.profile != "dev" {
		t.Fatalf("manager profile = %q, want dev", manager.profile)
	}
	if manager.port != devPort {
		t.Fatalf("manager port = %d, want %d", manager.port, devPort)
	}
}

func TestPrepareSidecarLogRotatesOversizedActiveLog(t *testing.T) {
	dir := t.TempDir()
	logPath := filepath.Join(dir, "sidecar.log")
	oldActive := append([]byte("old-active:"), bytes.Repeat([]byte("a"), int(sidecarLogMaxBytes)+64)...)
	oldBackup1 := append([]byte("old-backup-1:"), bytes.Repeat([]byte("b"), 128)...)
	oldBackup2 := []byte("old-backup-2")
	oldBackup3 := []byte("old-backup-3")

	if err := os.WriteFile(logPath, oldActive, 0o600); err != nil {
		t.Fatalf("seed active log: %v", err)
	}
	if err := os.WriteFile(logPath+".1", oldBackup1, 0o600); err != nil {
		t.Fatalf("seed backup 1: %v", err)
	}
	if err := os.WriteFile(logPath+".2", oldBackup2, 0o600); err != nil {
		t.Fatalf("seed backup 2: %v", err)
	}
	if err := os.WriteFile(logPath+".3", oldBackup3, 0o600); err != nil {
		t.Fatalf("seed stale backup 3: %v", err)
	}

	f, err := openSidecarLog(dir)
	if err != nil {
		t.Fatalf("openSidecarLog returned error: %v", err)
	}
	if _, err := f.WriteString("new-entry\n"); err != nil {
		t.Fatalf("write active log: %v", err)
	}
	if err := f.Close(); err != nil {
		t.Fatalf("close active log: %v", err)
	}

	active, err := os.ReadFile(logPath)
	if err != nil {
		t.Fatalf("read active log: %v", err)
	}
	if got := string(active); got != "new-entry\n" {
		t.Fatalf("active log = %q, want new entry only", got)
	}

	rotated, err := os.ReadFile(logPath + ".1")
	if err != nil {
		t.Fatalf("read rotated backup: %v", err)
	}
	if int64(len(rotated)) > sidecarLogMaxBytes {
		t.Fatalf("rotated backup size = %d, want <= %d", len(rotated), sidecarLogMaxBytes)
	}
	if bytes.Contains(rotated, []byte("old-active:")) {
		t.Fatalf("rotated backup kept the oldest oversized log prefix")
	}
	if !bytes.HasSuffix(rotated, bytes.Repeat([]byte("a"), 64)) {
		t.Fatalf("rotated backup did not keep the newest active log tail")
	}

	moved, err := os.ReadFile(logPath + ".2")
	if err != nil {
		t.Fatalf("read shifted backup: %v", err)
	}
	if string(moved) != string(oldBackup1) {
		t.Fatalf("backup .2 = %q, want previous .1", string(moved))
	}
	if _, err := os.Stat(logPath + ".3"); !os.IsNotExist(err) {
		t.Fatalf("stale backup .3 still exists: %v", err)
	}
}

func TestWriteConfigCreatesMinimalConfig(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")

	apiKey, err := writeConfig(path, 9317, dir)
	if err != nil {
		t.Fatalf("writeConfig returned error: %v", err)
	}
	if !strings.HasPrefix(apiKey, "sk-gettokens-") {
		t.Fatalf("expected generated api key to have gettokens prefix, got %q", apiKey)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	content := string(data)

	assertContains(t, content, "host: \"\"")
	assertContains(t, content, "port: 9317")
	assertContains(t, content, "auth-dir: "+dir)
	assertContains(t, content, "account-store-db: "+filepath.Join(dir, "accounts-v1.sqlite"))
	assertContains(t, content, "use-system-proxy: false")
	assertContains(t, content, "usage-statistics-enabled: true")
	assertContains(t, content, "request-retry: 3")
	assertContains(t, content, "max-retry-credentials: 0")
	assertContains(t, content, "max-retry-interval: 30")
	assertContains(t, content, "remote-management:")
	assertContains(t, content, "allow-remote: false")
	assertContains(t, content, "disable-control-panel: true")
	assertContains(t, content, "disable-auto-update-panel: true")
	assertManagementSecretKeyHash(t, path)
	assertContains(t, content, "api-keys:")
	assertContains(t, content, "- "+apiKey)
}

func TestWriteConfigRepairsLegacyZeroRetryDefaultsOnce(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	original := `host: ""
port: 8317
request-retry: 0
max-retry-credentials: 0
max-retry-interval: 0
api-keys:
  - relay-key
`
	if err := os.WriteFile(path, []byte(original), 0o600); err != nil {
		t.Fatalf("seed config: %v", err)
	}

	if _, err := writeConfig(path, 8317, dir); err != nil {
		t.Fatalf("writeConfig returned error: %v", err)
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	content := string(data)
	assertContains(t, content, "request-retry: 3")
	assertContains(t, content, "max-retry-credentials: 0")
	assertContains(t, content, "max-retry-interval: 30")

	if err := os.WriteFile(path, []byte(original), 0o600); err != nil {
		t.Fatalf("reset config: %v", err)
	}
	if _, err := writeConfig(path, 8317, dir); err != nil {
		t.Fatalf("second writeConfig returned error: %v", err)
	}
	data, err = os.ReadFile(path)
	if err != nil {
		t.Fatalf("read second config: %v", err)
	}
	content = string(data)
	assertContains(t, content, "request-retry: 0")
	assertContains(t, content, "max-retry-credentials: 0")
	assertContains(t, content, "max-retry-interval: 0")
}

func TestWriteConfigMigratesLegacyChannelRoutingForProdProfile(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	configDir := filepath.Join(home, ".config", "gettokens")
	if err := os.MkdirAll(configDir, 0o700); err != nil {
		t.Fatalf("create config dir: %v", err)
	}
	legacyDir := filepath.Join(home, ".config", "gettokens-data", "channel-routing")
	if err := os.MkdirAll(legacyDir, 0o700); err != nil {
		t.Fatalf("create legacy dir: %v", err)
	}
	legacyPath := filepath.Join(legacyDir, "config.json")
	legacyBody := []byte(`{"channels":{"codex":{"channel":"codex","routeMode":"balanced"}}}`)
	if err := os.WriteFile(legacyPath, legacyBody, 0o600); err != nil {
		t.Fatalf("seed legacy routing config: %v", err)
	}

	if _, err := writeConfig(filepath.Join(configDir, "config.yaml"), 8317, configDir); err != nil {
		t.Fatalf("writeConfig returned error: %v", err)
	}

	migratedPath := filepath.Join(configDir, "channel-routing", "config.json")
	migrated, err := os.ReadFile(migratedPath)
	if err != nil {
		t.Fatalf("read migrated routing config: %v", err)
	}
	if string(migrated) != string(legacyBody) {
		t.Fatalf("migrated routing config = %q, want %q", string(migrated), string(legacyBody))
	}
}

func TestWriteConfigDoesNotMigrateLegacyChannelRoutingForDevProfile(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	configDir := filepath.Join(home, ".config", "gettokens-dev")
	if err := os.MkdirAll(configDir, 0o700); err != nil {
		t.Fatalf("create config dir: %v", err)
	}
	legacyDir := filepath.Join(home, ".config", "gettokens-data", "channel-routing")
	if err := os.MkdirAll(legacyDir, 0o700); err != nil {
		t.Fatalf("create legacy dir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(legacyDir, "config.json"), []byte(`{"channels":{}}`), 0o600); err != nil {
		t.Fatalf("seed legacy routing config: %v", err)
	}

	if _, err := writeConfig(filepath.Join(configDir, "config.yaml"), 18317, configDir); err != nil {
		t.Fatalf("writeConfig returned error: %v", err)
	}

	migratedPath := filepath.Join(configDir, "channel-routing", "config.json")
	if _, err := os.Stat(migratedPath); !os.IsNotExist(err) {
		t.Fatalf("dev routing config migrated unexpectedly: %v", err)
	}
}

func TestUseSystemProxyConfigRoundTrip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	original := "host: \"\"\nport: 8317\napi-keys:\n  - relay-key\n"
	if err := os.WriteFile(path, []byte(original), 0600); err != nil {
		t.Fatalf("seed config: %v", err)
	}

	if err := writeUseSystemProxy(path, true); err != nil {
		t.Fatalf("writeUseSystemProxy(true): %v", err)
	}
	enabled, err := readUseSystemProxy(path)
	if err != nil {
		t.Fatalf("readUseSystemProxy: %v", err)
	}
	if !enabled {
		t.Fatal("enabled = false, want true")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	content := string(data)
	assertContains(t, content, "api-keys:")
	assertContains(t, content, "- relay-key")
	assertContains(t, content, "use-system-proxy: true")

	if err := writeUseSystemProxy(path, false); err != nil {
		t.Fatalf("writeUseSystemProxy(false): %v", err)
	}
	enabled, err = readUseSystemProxy(path)
	if err != nil {
		t.Fatalf("readUseSystemProxy after false: %v", err)
	}
	if enabled {
		t.Fatal("enabled = true, want false")
	}
}

func TestWriteConfigPreservesCodexAPIKeys(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	original := `host: 127.0.0.1
port: 8317
auth-dir: /tmp/old-auth
codex-api-key:
  - api-key: sk-test
    base-url: https://api.openai.com/v1
    prefix: team-a
remote-management:
  allow-remote: true
  disable-control-panel: false
  disable-auto-update-panel: false
  secret-key: old-key
api-keys:
  - relay-key-1
  - relay-key-2
`

	if err := os.WriteFile(path, []byte(original), 0600); err != nil {
		t.Fatalf("seed config: %v", err)
	}

	apiKey, err := writeConfig(path, 9417, dir)
	if err != nil {
		t.Fatalf("writeConfig returned error: %v", err)
	}
	if apiKey != "relay-key-1" {
		t.Fatalf("expected preserved first relay api key, got %q", apiKey)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	content := string(data)

	assertContains(t, content, "codex-api-key:")
	assertContains(t, content, "host: \"\"")
	assertContains(t, content, "api-key: sk-test")
	assertContains(t, content, "base-url: https://api.openai.com/v1")
	assertContains(t, content, "prefix: team-a")
	assertContains(t, content, "port: 9417")
	assertContains(t, content, "auth-dir: "+dir)
	assertContains(t, content, "account-store-db: "+filepath.Join(dir, "accounts-v1.sqlite"))
	assertContains(t, content, "usage-statistics-enabled: true")
	assertContains(t, content, "allow-remote: false")
	assertContains(t, content, "disable-control-panel: true")
	assertContains(t, content, "disable-auto-update-panel: true")
	assertManagementSecretKeyHash(t, path)
	assertContains(t, content, "api-keys:")
	assertContains(t, content, "- relay-key-1")
	assertContains(t, content, "- relay-key-2")
}

func TestWriteConfigRewritesAccountStoreDBToCurrentAuthDir(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "config.yaml")
	original := `host: ""
port: 8317
auth-dir: /Users/example/.config/gettokens
account-store-db: ~/.config/gettokens/accounts-v1.sqlite
api-keys:
  - relay-key
`
	if err := os.WriteFile(path, []byte(original), 0600); err != nil {
		t.Fatalf("seed config: %v", err)
	}

	if _, err := writeConfig(path, 18317, dir); err != nil {
		t.Fatalf("writeConfig returned error: %v", err)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read config: %v", err)
	}
	content := string(data)
	assertContains(t, content, "auth-dir: "+dir)
	assertContains(t, content, "account-store-db: "+filepath.Join(dir, "accounts-v1.sqlite"))
	if strings.Contains(content, "~/.config/gettokens/accounts-v1.sqlite") {
		t.Fatalf("config still points at production account store: %s", content)
	}
}

func TestNormalizeLegacyAuthFilesAddsCodexCompatibilityFields(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "auth.json")
	legacy := `{
  "auth_mode": "chatgpt",
  "nolon": {
    "account": {
      "kind": "chatgptAccount",
      "email": "tester@example.com"
    }
  },
  "tokens": {
    "access_token": "access-token",
    "id_token": "eyJhbGciOiJub25lIn0.eyJodHRwczovL2FwaS5vcGVuYWkuY29tL2F1dGgiOnsiY2hhdGdwdF9hY2NvdW50X2lkIjoiYWNjdF8xMjMiLCJjaGF0Z3B0X3BsYW5fdHlwZSI6InBsdXMifX0.",
    "refresh_token": "refresh-token",
    "account_id": "acct_123"
  }
}`
	if err := os.WriteFile(path, []byte(legacy), 0600); err != nil {
		t.Fatalf("seed auth file: %v", err)
	}

	changed, err := normalizeLegacyAuthFiles(dir)
	if err != nil {
		t.Fatalf("normalizeLegacyAuthFiles returned error: %v", err)
	}
	if changed != 1 {
		t.Fatalf("changed = %d, want 1", changed)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read auth file: %v", err)
	}
	content := string(data)
	assertContains(t, content, `"type": "codex"`)
	assertContains(t, content, `"access_token": "access-token"`)
	assertContains(t, content, `"refresh_token": "refresh-token"`)
	assertContains(t, content, `"account_id": "acct_123"`)
	assertContains(t, content, `"plan_type": "plus"`)
}

func TestEnsureConfigDirUsesProfileSpecificDirectory(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	dir, err := ensureConfigDir("dev")
	if err != nil {
		t.Fatalf("ensureConfigDir returned error: %v", err)
	}
	expected := filepath.Join(home, ".config", "gettokens-dev")
	if dir != expected {
		t.Fatalf("config dir = %q, want %q", dir, expected)
	}
}

func TestResolveBinaryCandidatesPrefersFreshBuildBinInDev(t *testing.T) {
	candidates := resolveBinaryCandidates(
		"/repo/build/bin/GetTokens.app/Contents/MacOS",
		"cli-proxy-api",
		"dev",
	)
	if got, want := candidates[0], "/repo/build/bin/cli-proxy-api"; got != want {
		t.Fatalf("first dev candidate = %q, want %q", got, want)
	}
	if got, want := candidates[1], "/repo/build/bin/GetTokens.app/Contents/MacOS/cli-proxy-api"; got != want {
		t.Fatalf("second dev candidate = %q, want %q", got, want)
	}
}

func TestReadBinaryGitHashReadsAdjacentMetadata(t *testing.T) {
	dir := t.TempDir()
	binaryPath := filepath.Join(dir, "cli-proxy-api.exe")
	metaPath := filepath.Join(dir, "cli-proxy-api.meta.json")

	if err := os.WriteFile(binaryPath, []byte("binary"), 0600); err != nil {
		t.Fatalf("seed binary: %v", err)
	}
	if err := os.WriteFile(metaPath, []byte(`{"commit":"960ebd9fd83f"}`), 0600); err != nil {
		t.Fatalf("seed metadata: %v", err)
	}

	got, err := readBinaryGitHash(binaryPath)
	if err != nil {
		t.Fatalf("readBinaryGitHash returned error: %v", err)
	}
	if got != "960ebd9fd83f" {
		t.Fatalf("gitHash = %q, want %q", got, "960ebd9fd83f")
	}
}

func assertContains(t *testing.T, content string, expected string) {
	t.Helper()
	if !strings.Contains(content, expected) {
		t.Fatalf("expected config to contain %q, got:\n%s", expected, content)
	}
}

func assertManagementSecretKeyHash(t *testing.T, path string) {
	t.Helper()
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read config for management key: %v", err)
	}
	var cfg struct {
		RemoteManagement struct {
			SecretKey string `yaml:"secret-key"`
		} `yaml:"remote-management"`
	}
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		t.Fatalf("parse config for management key: %v", err)
	}
	if cfg.RemoteManagement.SecretKey == "" {
		t.Fatal("remote-management.secret-key is empty")
	}
	if cfg.RemoteManagement.SecretKey == ManagementKey {
		t.Fatal("remote-management.secret-key stores plaintext management key")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(cfg.RemoteManagement.SecretKey), []byte(ManagementKey)); err != nil {
		t.Fatalf("remote-management.secret-key does not verify ManagementKey: %v", err)
	}
}

// newManagerWithDone builds a minimal Manager whose done channel and exitErr
// are pre-seeded so that waitHealthy tests do not need a real subprocess.
func newManagerWithDone(done chan struct{}, exitErr error) *Manager {
	m := &Manager{}
	m.done = done
	m.exitErr = exitErr
	return m
}

// TestWaitHealthyReturnsImmediatelyOnNonZeroProcessExit verifies that
// waitHealthy stops waiting as soon as the subprocess done channel is closed
// with a non-nil exitErr, without needing to reach the 30-second deadline.
func TestWaitHealthyReturnsImmediatelyOnNonZeroProcessExit(t *testing.T) {
	done := make(chan struct{})
	exitErr := fmt.Errorf("exit status 1")
	m := newManagerWithDone(done, exitErr)

	// Close done immediately to simulate instant subprocess crash.
	close(done)

	// Point at an address that will never respond (port 1 is reserved).
	start := time.Now()
	err := m.waitHealthy(t.Context(), "http://127.0.0.1:1/healthz")
	elapsed := time.Since(start)

	if err == nil {
		t.Fatal("waitHealthy returned nil, want early-exit error")
	}
	if !strings.Contains(err.Error(), "进程提前退出") {
		t.Fatalf("error = %q, want to contain '进程提前退出'", err.Error())
	}
	if !strings.Contains(err.Error(), exitErr.Error()) {
		t.Fatalf("error = %q, want to contain wrapped exitErr %q", err.Error(), exitErr.Error())
	}
	// Must return well within the 30-second timeout.
	if elapsed > 3*time.Second {
		t.Fatalf("waitHealthy took %s, want < 3s on immediate process exit", elapsed)
	}
}

// TestWaitHealthyReturnsImmediatelyOnCleanProcessExit verifies that even a
// zero-exit subprocess is treated as a failure when health has not been
// confirmed yet.
func TestWaitHealthyReturnsImmediatelyOnCleanProcessExit(t *testing.T) {
	done := make(chan struct{})
	m := newManagerWithDone(done, nil) // exitErr == nil → exit 0

	close(done)

	start := time.Now()
	err := m.waitHealthy(t.Context(), "http://127.0.0.1:1/healthz")
	elapsed := time.Since(start)

	if err == nil {
		t.Fatal("waitHealthy returned nil, want early-exit error")
	}
	if !strings.Contains(err.Error(), "进程提前退出 (exit 0)") {
		t.Fatalf("error = %q, want '进程提前退出 (exit 0)'", err.Error())
	}
	if elapsed > 3*time.Second {
		t.Fatalf("waitHealthy took %s, want < 3s on immediate clean exit", elapsed)
	}
}

// TestWaitHealthySucceedsWhenEndpointResponds verifies the happy path:
// when /healthz returns 200 the function returns nil without error.
func TestWaitHealthySucceedsWhenEndpointResponds(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	done := make(chan struct{}) // never closed – subprocess "still running"
	m := newManagerWithDone(done, nil)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := m.waitHealthy(ctx, srv.URL); err != nil {
		t.Fatalf("waitHealthy returned unexpected error: %v", err)
	}
}
