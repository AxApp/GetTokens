package codexbinary

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"sync"
	"time"

	semver "github.com/Masterminds/semver/v3"
)

const (
	defaultSourceID = "openai-codex-github"
	schemaVersion   = 1
)

type Service struct {
	rootDir          string
	now              func() time.Time
	goos             string
	goarch           string
	shellProfilePath string
	releaseClient    ReleaseClient
	httpClient       *http.Client
	mu               sync.Mutex
}

type ServiceOptions struct {
	RootDir          string
	Now              func() time.Time
	GOOS             string
	GOARCH           string
	ShellProfilePath string
	ReleaseClient    ReleaseClient
	HTTPClient       *http.Client
}

type Manifest struct {
	SchemaVersion     int               `json:"schemaVersion"`
	SelectedVersionID string            `json:"selectedVersionId,omitempty"`
	IncludePrerelease bool              `json:"includePrerelease"`
	Sources           []Source          `json:"sources"`
	Versions          []ManagedVersion  `json:"versions"`
	LastRemoteCheck   *RemoteCheckState `json:"lastRemoteCheck,omitempty"`
}

type Source struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Name      string `json:"name"`
	Enabled   bool   `json:"enabled"`
	Repo      string `json:"repo,omitempty"`
	TagPrefix string `json:"tagPrefix,omitempty"`
}

type ManagedVersion struct {
	ID                 string `json:"id"`
	DisplayName        string `json:"displayName"`
	DetectedVersion    string `json:"detectedVersion"`
	BinaryRelativePath string `json:"binaryRelativePath"`
	SHA256             string `json:"sha256"`
	SourceID           string `json:"sourceId"`
	SourceType         string `json:"sourceType"`
	SourceURL          string `json:"sourceURL,omitempty"`
	ReleaseTag         string `json:"releaseTag,omitempty"`
	InstalledAt        string `json:"installedAt"`
	LastActivatedAt    string `json:"lastActivatedAt,omitempty"`
	Notes              string `json:"notes,omitempty"`
}

type RemoteCheckState struct {
	CheckedAt   string `json:"checkedAt"`
	SourceID    string `json:"sourceId"`
	Status      string `json:"status"`
	Version     string `json:"version,omitempty"`
	Tag         string `json:"tag,omitempty"`
	AssetURL    string `json:"assetURL,omitempty"`
	HTMLURL     string `json:"htmlURL,omitempty"`
	PublishedAt string `json:"publishedAt,omitempty"`
	Error       string `json:"error,omitempty"`
}

type ReleaseCatalog struct {
	SchemaVersion int                 `json:"schemaVersion"`
	SourceID      string              `json:"sourceId"`
	Repo          string              `json:"repo"`
	FetchedAt     string              `json:"fetchedAt"`
	ExpiresAt     string              `json:"expiresAt"`
	Source        string              `json:"source"`
	Items         []RemoteVersionView `json:"items"`
	Error         string              `json:"error,omitempty"`
}

type ReleaseClient interface {
	ListReleases(ctx context.Context, source Source) ([]GitHubRelease, error)
}

type GitHubRelease struct {
	TagName     string
	Name        string
	Body        string
	HTMLURL     string
	PublishedAt time.Time
	Draft       bool
	Prerelease  bool
	Assets      []GitHubReleaseAsset
}

type GitHubReleaseAsset struct {
	Name        string
	DownloadURL string
	ContentType string
	Size        int64
}

type Snapshot struct {
	ManifestPath      string              `json:"manifestPath"`
	ManagedBinPath    string              `json:"managedBinPath"`
	ManagedConfig     ManagedConfigView   `json:"managedConfig"`
	SelectedVersionID string              `json:"selectedVersionID,omitempty"`
	CurrentVersion    *VersionView        `json:"currentVersion,omitempty"`
	Versions          []VersionView       `json:"versions"`
	RemoteVersions    []RemoteVersionView `json:"remoteVersions"`
	VersionRows       []VersionRowView    `json:"versionRows"`
	DownloadTasks     []DownloadTaskView  `json:"downloadTasks"`
	Sources           []SourceView        `json:"sources"`
	Doctor            DoctorSummary       `json:"doctor"`
}

type VersionView struct {
	ID                 string `json:"id"`
	DisplayName        string `json:"displayName"`
	DetectedVersion    string `json:"detectedVersion"`
	ReleaseTag         string `json:"releaseTag,omitempty"`
	SourceID           string `json:"sourceID"`
	SourceType         string `json:"sourceType"`
	SourceURL          string `json:"sourceURL,omitempty"`
	InstalledAt        string `json:"installedAt"`
	LastActivatedAt    string `json:"lastActivatedAt,omitempty"`
	IsSelected         bool   `json:"isSelected"`
	ExistsOnDisk       bool   `json:"existsOnDisk"`
	BinaryRelativePath string `json:"binaryRelativePath,omitempty"`
	BinaryPath         string `json:"binaryPath,omitempty"`
}

type RemoteVersionView struct {
	SourceID     string `json:"sourceID"`
	Version      string `json:"version"`
	Tag          string `json:"tag"`
	Title        string `json:"title"`
	DownloadURL  string `json:"downloadURL"`
	HTMLURL      string `json:"htmlURL,omitempty"`
	AssetName    string `json:"assetName,omitempty"`
	AssetSize    int64  `json:"assetSize,omitempty"`
	PublishedAt  string `json:"publishedAt,omitempty"`
	IsPrerelease bool   `json:"isPrerelease"`
	IsInstalled  bool   `json:"isInstalled"`
}

type VersionRowView struct {
	RowID              string            `json:"rowID"`
	Version            string            `json:"version"`
	Tag                string            `json:"tag,omitempty"`
	SourceID           string            `json:"sourceID"`
	InstalledVersionID string            `json:"installedVersionID,omitempty"`
	IsInstalled        bool              `json:"isInstalled"`
	IsSelected         bool              `json:"isSelected"`
	IsRollback         bool              `json:"isRollback"`
	HasRemote          bool              `json:"hasRemote"`
	PublishedAt        string            `json:"publishedAt,omitempty"`
	InstalledAt        string            `json:"installedAt,omitempty"`
	NotesState         string            `json:"notesState"`
	Task               *DownloadTaskView `json:"task,omitempty"`
	PrimaryAction      string            `json:"primaryAction"`
	SecondaryAction    string            `json:"secondaryAction,omitempty"`
}

type DownloadTaskView struct {
	ID                   string `json:"id"`
	SourceID             string `json:"sourceID"`
	Tag                  string `json:"tag"`
	Version              string `json:"version"`
	Status               string `json:"status"`
	Phase                string `json:"phase"`
	BytesDone            int64  `json:"bytesDone"`
	BytesTotal           int64  `json:"bytesTotal"`
	InstallAfterDownload bool   `json:"installAfterDownload"`
	ActivateAfterInstall bool   `json:"activateAfterInstall"`
	ErrorCode            string `json:"errorCode,omitempty"`
	ErrorMessage         string `json:"errorMessage,omitempty"`
	UpdatedAt            string `json:"updatedAt"`
}

type SourceView struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Name    string `json:"name"`
	Enabled bool   `json:"enabled"`
	Repo    string `json:"repo,omitempty"`
}

type ManagedConfigView struct {
	BinDir              string `json:"binDir"`
	BinPath             string `json:"binPath"`
	EnableCommand       string `json:"enableCommand"`
	ProfilePath         string `json:"profilePath,omitempty"`
	ProfileKind         string `json:"profileKind,omitempty"`
	IsPathConfigured    bool   `json:"isPathConfigured"`
	ResolvedCodexPath   string `json:"resolvedCodexPath,omitempty"`
	IsResolvedToManaged bool   `json:"isResolvedToManaged"`
}

type DoctorSummary struct {
	Severity string `json:"severity"`
	Message  string `json:"message"`
}

type ImportLocalInput struct {
	Path                 string
	SourceID             string
	SourceType           string
	SourceURL            string
	ReleaseTag           string
	ActivateAfterInstall bool
}

type InstallResult struct {
	Version          VersionView `json:"version"`
	AlreadyInstalled bool        `json:"alreadyInstalled"`
	Activated        bool        `json:"activated"`
}

type DownloadInput struct {
	SourceID             string `json:"sourceID"`
	Tag                  string `json:"tag"`
	ActivateAfterInstall bool   `json:"activateAfterInstall"`
}

type DownloadResult struct {
	Version          VersionView `json:"version"`
	AlreadyInstalled bool        `json:"alreadyInstalled"`
	Activated        bool        `json:"activated"`
	Snapshot         Snapshot    `json:"snapshot"`
}

type EnableManagedPathResult struct {
	ProfilePath string   `json:"profilePath"`
	BackupPath  string   `json:"backupPath,omitempty"`
	Changed     bool     `json:"changed"`
	Messages    []string `json:"messages"`
	Snapshot    Snapshot `json:"snapshot"`
}

type UseInput struct {
	VersionID                string `json:"versionID"`
	ExpectedCurrentVersionID string `json:"expectedCurrentVersionID,omitempty"`
}

type UseResult struct {
	SelectedVersionID string   `json:"selectedVersionID"`
	Snapshot          Snapshot `json:"snapshot"`
}

type VersionNotesInput struct {
	SourceID string `json:"sourceID"`
	Tag      string `json:"tag"`
}

type VersionNotesView struct {
	SourceID      string `json:"sourceID"`
	Tag           string `json:"tag"`
	Version       string `json:"version"`
	Title         string `json:"title"`
	HTMLURL       string `json:"htmlURL,omitempty"`
	PublishedAt   string `json:"publishedAt,omitempty"`
	BodyMarkdown  string `json:"bodyMarkdown"`
	BodyPlainText string `json:"bodyPlainText,omitempty"`
	Source        string `json:"source"`
	Truncated     bool   `json:"truncated"`
	FetchedAt     string `json:"fetchedAt,omitempty"`
}

func NewService(options ServiceOptions) *Service {
	now := options.Now
	if now == nil {
		now = time.Now
	}
	rootDir := options.RootDir
	if rootDir == "" {
		rootDir = defaultRootDir()
	}
	goos := options.GOOS
	if goos == "" {
		goos = runtime.GOOS
	}
	goarch := options.GOARCH
	if goarch == "" {
		goarch = runtime.GOARCH
	}
	shellProfilePath := options.ShellProfilePath
	releaseClient := options.ReleaseClient
	if releaseClient == nil {
		releaseClient = NewGitHubRESTReleaseClient(nil)
	}
	httpClient := options.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 5 * time.Minute}
	}
	return &Service{rootDir: rootDir, now: now, goos: goos, goarch: goarch, shellProfilePath: shellProfilePath, releaseClient: releaseClient, httpClient: httpClient}
}

func defaultRootDir() string {
	if dir, err := os.UserConfigDir(); err == nil && dir != "" {
		return filepath.Join(dir, "gettokens", "codex")
	}
	return filepath.Join(os.Getenv("HOME"), ".config", "gettokens", "codex")
}

func (s *Service) Snapshot() (*Snapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	manifest, err := s.loadManifest()
	if err != nil {
		return nil, err
	}

	versions := make([]VersionView, 0, len(manifest.Versions))
	var current *VersionView
	for _, item := range manifest.Versions {
		view := s.versionView(item, manifest.SelectedVersionID)
		versions = append(versions, view)
		if view.IsSelected {
			copy := view
			current = &copy
		}
	}
	sortVersionViews(versions)

	remoteVersions, _ := s.cachedRemoteVersions()
	managedConfig := s.managedConfig()
	return &Snapshot{
		ManifestPath:      s.manifestPath(),
		ManagedBinPath:    filepath.Join(s.rootDir, "bin", "codex"),
		ManagedConfig:     managedConfig,
		SelectedVersionID: manifest.SelectedVersionID,
		CurrentVersion:    current,
		Versions:          versions,
		RemoteVersions:    markInstalledRemoteVersions(remoteVersions, versions),
		VersionRows:       buildRows(versions, markInstalledRemoteVersions(remoteVersions, versions), nil, manifest.SelectedVersionID),
		Sources:           sourceViews(manifest.Sources),
		Doctor:            s.doctorSummary(manifest, current, managedConfig),
	}, nil
}

func (s *Service) RefreshAvailable(ctx context.Context) (*Snapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	manifest, err := s.loadManifest()
	if err != nil {
		return nil, err
	}
	source := firstEnabledGitHubSource(manifest.Sources)
	if source == nil {
		return s.snapshotLockedWithDoctor(DoctorSummary{Severity: "warning", Message: "没有启用 GitHub Release 源"})
	}

	releases, err := s.releaseClient.ListReleases(ctx, *source)
	if err != nil {
		cached, cacheErr := s.cachedRemoteVersions()
		if cacheErr == nil && len(cached) > 0 {
			manifest.LastRemoteCheck = &RemoteCheckState{
				CheckedAt: s.now().UTC().Format(time.RFC3339),
				SourceID:  source.ID,
				Status:    "cache",
				Error:     err.Error(),
			}
			_ = s.saveManifest(manifest)
			return s.snapshotLockedWithRemoteAndDoctor(cached, DoctorSummary{
				Severity: "warning",
				Message:  "远端版本拉取失败，已显示缓存：" + err.Error(),
			})
		}
		manifest.LastRemoteCheck = &RemoteCheckState{
			CheckedAt: s.now().UTC().Format(time.RFC3339),
			SourceID:  source.ID,
			Status:    "failed",
			Error:     err.Error(),
		}
		_ = s.saveManifest(manifest)
		return s.snapshotLockedWithDoctor(DoctorSummary{Severity: "warning", Message: "远端版本拉取失败：" + err.Error()})
	}

	releases = s.enrichReleaseAssetsFromHTML(ctx, releases)
	remoteVersions := s.remoteViewsFromReleases(*source, releases, manifest.IncludePrerelease)
	catalog := ReleaseCatalog{
		SchemaVersion: schemaVersion,
		SourceID:      source.ID,
		Repo:          source.Repo,
		FetchedAt:     s.now().UTC().Format(time.RFC3339),
		ExpiresAt:     s.now().UTC().Add(15 * time.Minute).Format(time.RFC3339),
		Source:        "network",
		Items:         remoteVersions,
	}
	if err := writeJSON(s.releaseCatalogPath(), catalog); err != nil {
		return nil, err
	}
	manifest.LastRemoteCheck = &RemoteCheckState{
		CheckedAt: s.now().UTC().Format(time.RFC3339),
		SourceID:  source.ID,
		Status:    "success",
	}
	if len(remoteVersions) > 0 {
		manifest.LastRemoteCheck.Version = remoteVersions[0].Version
		manifest.LastRemoteCheck.Tag = remoteVersions[0].Tag
		manifest.LastRemoteCheck.AssetURL = remoteVersions[0].DownloadURL
		manifest.LastRemoteCheck.HTMLURL = remoteVersions[0].HTMLURL
		manifest.LastRemoteCheck.PublishedAt = remoteVersions[0].PublishedAt
	}
	if err := s.saveManifest(manifest); err != nil {
		return nil, err
	}
	return s.snapshotLockedWithRemoteAndDoctor(remoteVersions, s.doctorSummary(manifest, nil, s.managedConfig()))
}

func (s *Service) ImportLocal(input ImportLocalInput) (*InstallResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if input.Path == "" {
		return nil, errors.New("codex binary path is required")
	}
	info, err := os.Stat(input.Path)
	if err != nil {
		return nil, err
	}
	if info.IsDir() {
		return nil, fmt.Errorf("%s is a directory", input.Path)
	}
	if info.Mode()&0o111 == 0 {
		if err := os.Chmod(input.Path, info.Mode()|0o755); err != nil {
			return nil, err
		}
	}

	hash, err := fileSHA256(input.Path)
	if err != nil {
		return nil, err
	}

	manifest, err := s.loadManifest()
	if err != nil {
		return nil, err
	}
	for _, version := range manifest.Versions {
		if version.SHA256 == hash {
			view := s.versionView(version, manifest.SelectedVersionID)
			return &InstallResult{Version: view, AlreadyInstalled: true}, nil
		}
	}

	detectedVersion := detectVersion(input.Path)
	versionID := s.uniqueVersionID(manifest, detectedVersion, hash)
	relativePath := filepath.ToSlash(filepath.Join("versions", versionID, "codex"))
	targetPath := filepath.Join(s.rootDir, filepath.FromSlash(relativePath))
	if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
		return nil, err
	}
	tmpPath := targetPath + ".tmp"
	if err := copyFile(input.Path, tmpPath); err != nil {
		return nil, err
	}
	if err := os.Chmod(tmpPath, 0o755); err != nil {
		_ = os.Remove(tmpPath)
		return nil, err
	}
	if err := os.Rename(tmpPath, targetPath); err != nil {
		_ = os.Remove(tmpPath)
		return nil, err
	}

	sourceID := input.SourceID
	if sourceID == "" {
		sourceID = "local"
	}
	sourceType := input.SourceType
	if sourceType == "" {
		sourceType = "localImport"
	}
	now := s.now().UTC().Format(time.RFC3339)
	managed := ManagedVersion{
		ID:                 versionID,
		DisplayName:        "Codex " + detectedVersion,
		DetectedVersion:    detectedVersion,
		BinaryRelativePath: relativePath,
		SHA256:             hash,
		SourceID:           sourceID,
		SourceType:         sourceType,
		SourceURL:          input.SourceURL,
		ReleaseTag:         input.ReleaseTag,
		InstalledAt:        now,
	}
	manifest.Versions = append(manifest.Versions, managed)
	if err := s.saveVersionMetadata(managed); err != nil {
		return nil, err
	}
	if err := s.saveManifest(manifest); err != nil {
		return nil, err
	}

	view := s.versionView(managed, manifest.SelectedVersionID)
	result := &InstallResult{Version: view}
	if input.ActivateAfterInstall {
		if err := s.useLocked(manifest, managed.ID, ""); err != nil {
			return nil, err
		}
		snapshot, err := s.snapshotLocked()
		if err != nil {
			return nil, err
		}
		for _, item := range snapshot.Versions {
			if item.ID == managed.ID {
				result.Version = item
				break
			}
		}
		result.Activated = true
	}
	return result, nil
}

func (s *Service) Download(ctx context.Context, input DownloadInput) (*DownloadResult, error) {
	if input.SourceID == "" {
		input.SourceID = defaultSourceID
	}
	if input.Tag == "" {
		return nil, errors.New("release tag is required")
	}
	remote, err := s.resolveRemoteVersion(ctx, input.SourceID, input.Tag)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(remote.DownloadURL) == "" || remote.DownloadURL == remote.HTMLURL {
		return nil, fmt.Errorf("codex_binary_asset_missing: %s", input.Tag)
	}

	if installedID := s.installedVersionIDByTag(input.Tag); installedID != "" {
		result := &DownloadResult{AlreadyInstalled: true}
		if input.ActivateAfterInstall {
			useResult, err := s.Use(UseInput{VersionID: installedID})
			if err != nil {
				return nil, err
			}
			result.Activated = true
			result.Snapshot = useResult.Snapshot
		} else {
			snapshot, err := s.Snapshot()
			if err != nil {
				return nil, err
			}
			result.Snapshot = *snapshot
		}
		for _, item := range result.Snapshot.Versions {
			if item.ID == installedID {
				result.Version = item
				break
			}
		}
		return result, nil
	}

	downloadedPath, cleanup, err := s.downloadRemoteAsset(ctx, remote)
	if cleanup != nil {
		defer cleanup()
	}
	if err != nil {
		return nil, err
	}

	codexPath := downloadedPath
	if isTarGz(remote.AssetName, downloadedPath) {
		extracted, err := s.extractCodexFromTarGz(downloadedPath, input.Tag)
		if err != nil {
			return nil, err
		}
		codexPath = extracted
	}

	install, err := s.ImportLocal(ImportLocalInput{
		Path:                 codexPath,
		SourceID:             remote.SourceID,
		SourceType:           "githubRelease",
		SourceURL:            remote.DownloadURL,
		ReleaseTag:           remote.Tag,
		ActivateAfterInstall: input.ActivateAfterInstall,
	})
	if err != nil {
		return nil, err
	}
	snapshot, err := s.Snapshot()
	if err != nil {
		return nil, err
	}
	return &DownloadResult{
		Version:          install.Version,
		AlreadyInstalled: install.AlreadyInstalled,
		Activated:        install.Activated,
		Snapshot:         *snapshot,
	}, nil
}

func (s *Service) EnableManagedPath() (*EnableManagedPathResult, error) {
	profilePath, err := s.resolveShellProfilePath()
	if err != nil {
		return nil, err
	}
	managedConfig := s.managedConfig()
	block := managedPathBlock(managedConfig.BinDir, profilePath)

	existing, err := os.ReadFile(profilePath)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	nextContent, changed := upsertManagedPathBlock(string(existing), block)
	result := &EnableManagedPathResult{
		ProfilePath: profilePath,
		Changed:     changed,
		Messages: []string{
			"托管 PATH 写入后只对新开的终端生效",
			"只维护 GetTokens 标记块，不修改用户其它 shell 配置",
		},
	}
	if changed {
		if len(existing) > 0 {
			backupPath := profilePath + ".gettokens-backup-" + s.now().UTC().Format("20060102150405")
			if err := writeFileAtomic(backupPath, existing, 0o644); err != nil {
				return nil, err
			}
			result.BackupPath = backupPath
		}
		if err := writeFileAtomic(profilePath, []byte(nextContent), 0o644); err != nil {
			return nil, err
		}
	}
	s.prependManagedBinToProcessPath(managedConfig.BinDir)
	snapshot, err := s.Snapshot()
	if err != nil {
		return nil, err
	}
	result.Snapshot = *snapshot
	return result, nil
}

func (s *Service) Use(input UseInput) (*UseResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	manifest, err := s.loadManifest()
	if err != nil {
		return nil, err
	}
	if err := s.useLocked(manifest, input.VersionID, input.ExpectedCurrentVersionID); err != nil {
		return nil, err
	}
	snapshot, err := s.snapshotLocked()
	if err != nil {
		return nil, err
	}
	return &UseResult{SelectedVersionID: input.VersionID, Snapshot: *snapshot}, nil
}

func (s *Service) SaveVersionNotes(notes VersionNotesView) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.saveVersionNotesLocked(notes)
}

func (s *Service) saveVersionNotesLocked(notes VersionNotesView) error {
	if notes.SourceID == "" || notes.Tag == "" {
		return errors.New("source id and tag are required")
	}
	notes.Source = "remote"
	notes.FetchedAt = s.now().UTC().Format(time.RFC3339)
	return writeJSON(s.versionNotesPath(notes.SourceID, notes.Tag), notes)
}

func (s *Service) VersionNotes(input VersionNotesInput) (*VersionNotesView, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if input.SourceID == "" || input.Tag == "" {
		return nil, errors.New("source id and tag are required")
	}
	var notes VersionNotesView
	if err := readJSON(s.versionNotesPath(input.SourceID, input.Tag), &notes); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return &VersionNotesView{
				SourceID:      input.SourceID,
				Tag:           input.Tag,
				Title:         input.Tag,
				BodyMarkdown:  "",
				BodyPlainText: "",
				Source:        "local",
			}, nil
		}
		return nil, err
	}
	notes.Source = "cache"
	return &notes, nil
}

func (s *Service) useLocked(manifest *Manifest, versionID string, expectedCurrent string) error {
	if versionID == "" {
		return errors.New("version id is required")
	}
	if expectedCurrent != "" && manifest.SelectedVersionID != expectedCurrent {
		return fmt.Errorf("codex_binary_state_conflict: expected %s, got %s", expectedCurrent, manifest.SelectedVersionID)
	}
	var selected *ManagedVersion
	for idx := range manifest.Versions {
		if manifest.Versions[idx].ID == versionID {
			selected = &manifest.Versions[idx]
			break
		}
	}
	if selected == nil {
		return fmt.Errorf("codex_binary_version_missing: %s", versionID)
	}
	binaryPath := filepath.Join(s.rootDir, filepath.FromSlash(selected.BinaryRelativePath))
	info, err := os.Stat(binaryPath)
	if err != nil {
		return err
	}
	if info.Mode()&0o111 == 0 {
		return fmt.Errorf("codex_binary_not_executable: %s", binaryPath)
	}
	if err := os.MkdirAll(filepath.Join(s.rootDir, "bin"), 0o755); err != nil {
		return err
	}
	binLink := filepath.Join(s.rootDir, "bin", "codex")
	currentLink := filepath.Join(s.rootDir, "current")
	_ = os.Remove(binLink + ".next")
	_ = os.Remove(currentLink + ".next")
	if err := os.Symlink(filepath.ToSlash(filepath.Join("..", selected.BinaryRelativePath)), binLink+".next"); err != nil {
		return err
	}
	if err := os.Rename(binLink+".next", binLink); err != nil {
		return err
	}
	if err := os.Symlink(filepath.ToSlash(filepath.Join("versions", versionID)), currentLink+".next"); err != nil {
		return err
	}
	if err := os.Rename(currentLink+".next", currentLink); err != nil {
		return err
	}
	now := s.now().UTC().Format(time.RFC3339)
	manifest.SelectedVersionID = versionID
	selected.LastActivatedAt = now
	return s.saveManifest(manifest)
}

func (s *Service) snapshotLocked() (*Snapshot, error) {
	return s.snapshotLockedWithDoctor(DoctorSummary{})
}

func (s *Service) snapshotLockedWithDoctor(doctorOverride DoctorSummary) (*Snapshot, error) {
	manifest, err := s.loadManifest()
	if err != nil {
		return nil, err
	}
	versions := make([]VersionView, 0, len(manifest.Versions))
	var current *VersionView
	for _, item := range manifest.Versions {
		view := s.versionView(item, manifest.SelectedVersionID)
		versions = append(versions, view)
		if view.IsSelected {
			copy := view
			current = &copy
		}
	}
	sortVersionViews(versions)
	remoteVersions, _ := s.cachedRemoteVersions()
	managedConfig := s.managedConfig()
	doctor := s.doctorSummary(manifest, current, managedConfig)
	if doctorOverride.Severity != "" || doctorOverride.Message != "" {
		doctor = doctorOverride
	}
	return &Snapshot{
		ManifestPath:      s.manifestPath(),
		ManagedBinPath:    filepath.Join(s.rootDir, "bin", "codex"),
		ManagedConfig:     managedConfig,
		SelectedVersionID: manifest.SelectedVersionID,
		CurrentVersion:    current,
		Versions:          versions,
		RemoteVersions:    markInstalledRemoteVersions(remoteVersions, versions),
		VersionRows:       buildRows(versions, markInstalledRemoteVersions(remoteVersions, versions), nil, manifest.SelectedVersionID),
		Sources:           sourceViews(manifest.Sources),
		Doctor:            doctor,
	}, nil
}

func (s *Service) snapshotLockedWithRemoteAndDoctor(remoteVersions []RemoteVersionView, doctorOverride DoctorSummary) (*Snapshot, error) {
	manifest, err := s.loadManifest()
	if err != nil {
		return nil, err
	}
	versions := make([]VersionView, 0, len(manifest.Versions))
	var current *VersionView
	for _, item := range manifest.Versions {
		view := s.versionView(item, manifest.SelectedVersionID)
		versions = append(versions, view)
		if view.IsSelected {
			copy := view
			current = &copy
		}
	}
	sortVersionViews(versions)
	remoteVersions = markInstalledRemoteVersions(remoteVersions, versions)
	managedConfig := s.managedConfig()
	doctor := s.doctorSummary(manifest, current, managedConfig)
	if doctorOverride.Severity != "" || doctorOverride.Message != "" {
		doctor = doctorOverride
	}
	return &Snapshot{
		ManifestPath:      s.manifestPath(),
		ManagedBinPath:    filepath.Join(s.rootDir, "bin", "codex"),
		ManagedConfig:     managedConfig,
		SelectedVersionID: manifest.SelectedVersionID,
		CurrentVersion:    current,
		Versions:          versions,
		RemoteVersions:    remoteVersions,
		VersionRows:       buildRows(versions, remoteVersions, nil, manifest.SelectedVersionID),
		Sources:           sourceViews(manifest.Sources),
		Doctor:            doctor,
	}, nil
}

func (s *Service) loadManifest() (*Manifest, error) {
	var manifest Manifest
	if err := readJSON(s.manifestPath(), &manifest); err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			return nil, err
		}
		return defaultManifest(), nil
	}
	if manifest.SchemaVersion == 0 {
		manifest.SchemaVersion = schemaVersion
	}
	if len(manifest.Sources) == 0 {
		manifest.Sources = defaultManifest().Sources
	}
	return &manifest, nil
}

func defaultManifest() *Manifest {
	return &Manifest{
		SchemaVersion: schemaVersion,
		Sources: []Source{{
			ID:        defaultSourceID,
			Type:      "githubRelease",
			Name:      "OpenAI Codex GitHub Releases",
			Enabled:   true,
			Repo:      "openai/codex",
			TagPrefix: "rust-v",
		}},
	}
}

func (s *Service) saveManifest(manifest *Manifest) error {
	manifest.SchemaVersion = schemaVersion
	return writeJSON(s.manifestPath(), manifest)
}

func (s *Service) saveVersionMetadata(version ManagedVersion) error {
	return writeJSON(filepath.Join(s.rootDir, "versions", version.ID, "metadata.json"), version)
}

func (s *Service) manifestPath() string {
	return filepath.Join(s.rootDir, "manifest.json")
}

func (s *Service) versionNotesPath(sourceID string, tag string) string {
	return filepath.Join(s.rootDir, "cache", "release-notes", safePathPart(sourceID), safePathPart(tag)+".json")
}

func (s *Service) releaseCatalogPath() string {
	return filepath.Join(s.rootDir, "cache", "releases.json")
}

func (s *Service) versionView(version ManagedVersion, selectedID string) VersionView {
	binaryPath := filepath.Join(s.rootDir, filepath.FromSlash(version.BinaryRelativePath))
	_, statErr := os.Stat(binaryPath)
	return VersionView{
		ID:                 version.ID,
		DisplayName:        version.DisplayName,
		DetectedVersion:    version.DetectedVersion,
		ReleaseTag:         version.ReleaseTag,
		SourceID:           version.SourceID,
		SourceType:         version.SourceType,
		SourceURL:          version.SourceURL,
		InstalledAt:        version.InstalledAt,
		LastActivatedAt:    version.LastActivatedAt,
		IsSelected:         version.ID == selectedID,
		ExistsOnDisk:       statErr == nil,
		BinaryRelativePath: version.BinaryRelativePath,
		BinaryPath:         binaryPath,
	}
}

func (s *Service) managedConfig() ManagedConfigView {
	binDir := filepath.Join(s.rootDir, "bin")
	binPath := filepath.Join(binDir, "codex")
	resolved, _ := exec.LookPath("codex")
	profilePath, profileKind, _ := s.resolveShellProfile()
	return ManagedConfigView{
		BinDir:              binDir,
		BinPath:             binPath,
		EnableCommand:       managedPathCommand(binDir, profilePath),
		ProfilePath:         profilePath,
		ProfileKind:         profileKind,
		IsPathConfigured:    pathContainsDir(os.Getenv("PATH"), binDir),
		ResolvedCodexPath:   resolved,
		IsResolvedToManaged: samePath(resolved, binPath),
	}
}

func (s *Service) resolveShellProfilePath() (string, error) {
	path, _, err := s.resolveShellProfile()
	return path, err
}

func (s *Service) resolveShellProfile() (string, string, error) {
	if s.shellProfilePath != "" {
		return s.shellProfilePath, "custom", nil
	}
	homeDir, err := os.UserHomeDir()
	if err != nil || homeDir == "" {
		return "", "", errors.New("codex_binary_home_missing")
	}
	shellName := filepath.Base(os.Getenv("SHELL"))
	switch shellName {
	case "bash":
		return firstExistingProfile(homeDir, "bash", []string{".bashrc", ".bash_profile", ".profile"})
	case "fish":
		configRoot := os.Getenv("XDG_CONFIG_HOME")
		if configRoot == "" {
			configRoot = filepath.Join(homeDir, ".config")
		}
		return filepath.Join(configRoot, "fish", "config.fish"), "fish", nil
	case "zsh":
		return firstExistingProfile(zshConfigDir(homeDir), "zsh", []string{".zshrc", ".zprofile"})
	default:
		if runtime.GOOS == "darwin" {
			return firstExistingProfile(zshConfigDir(homeDir), "zsh", []string{".zshrc", ".zprofile"})
		}
		return firstExistingProfile(homeDir, "profile", []string{".profile", ".bashrc", ".bash_profile"})
	}
}

func (s *Service) prependManagedBinToProcessPath(binDir string) {
	if pathContainsDir(os.Getenv("PATH"), binDir) {
		return
	}
	current := os.Getenv("PATH")
	if current == "" {
		_ = os.Setenv("PATH", binDir)
		return
	}
	_ = os.Setenv("PATH", binDir+string(os.PathListSeparator)+current)
}

func firstExistingProfile(homeDir string, kind string, names []string) (string, string, error) {
	for _, name := range names {
		path := filepath.Join(homeDir, name)
		info, err := os.Stat(path)
		if err == nil && !info.IsDir() {
			return path, kind, nil
		}
	}
	if len(names) == 0 {
		return "", "", errors.New("codex_binary_profile_missing")
	}
	return filepath.Join(homeDir, names[0]), kind, nil
}

func zshConfigDir(homeDir string) string {
	if zdotdir := os.Getenv("ZDOTDIR"); zdotdir != "" {
		return zdotdir
	}
	return homeDir
}

func (s *Service) doctorSummary(_ *Manifest, current *VersionView, managedConfig ManagedConfigView) DoctorSummary {
	if current == nil {
		return DoctorSummary{Severity: "info", Message: "尚未托管 Codex 二进制"}
	}
	if !current.ExistsOnDisk {
		return DoctorSummary{Severity: "error", Message: "当前启用版本文件缺失"}
	}
	if !managedConfig.IsPathConfigured {
		return DoctorSummary{Severity: "warning", Message: "托管版本已激活，但尚未启用托管 PATH"}
	}
	if managedConfig.ResolvedCodexPath != "" && !managedConfig.IsResolvedToManaged {
		return DoctorSummary{Severity: "warning", Message: "托管 PATH 已配置，但当前 codex 仍解析到其他位置"}
	}
	return DoctorSummary{Severity: "ok", Message: "托管版本可用"}
}

func sourceViews(sources []Source) []SourceView {
	views := make([]SourceView, 0, len(sources))
	for _, source := range sources {
		views = append(views, SourceView{
			ID:      source.ID,
			Type:    source.Type,
			Name:    source.Name,
			Enabled: source.Enabled,
			Repo:    source.Repo,
		})
	}
	return views
}

func firstEnabledGitHubSource(sources []Source) *Source {
	for idx := range sources {
		if sources[idx].Enabled && sources[idx].Type == "githubRelease" {
			return &sources[idx]
		}
	}
	return nil
}

func (s *Service) cachedRemoteVersions() ([]RemoteVersionView, error) {
	var catalog ReleaseCatalog
	if err := readJSON(s.releaseCatalogPath(), &catalog); err != nil {
		return nil, err
	}
	items := append([]RemoteVersionView(nil), catalog.Items...)
	sortRemoteVersionViews(items)
	return items, nil
}

func (s *Service) resolveRemoteVersion(ctx context.Context, sourceID string, tag string) (RemoteVersionView, error) {
	if cached, err := s.cachedRemoteVersions(); err == nil {
		for _, item := range cached {
			if item.SourceID == sourceID && item.Tag == tag {
				if item.DownloadURL != "" && item.DownloadURL != item.HTMLURL {
					return item, nil
				}
				break
			}
		}
	}

	s.mu.Lock()
	manifest, err := s.loadManifest()
	if err != nil {
		s.mu.Unlock()
		return RemoteVersionView{}, err
	}
	var source *Source
	for idx := range manifest.Sources {
		if manifest.Sources[idx].ID == sourceID {
			copy := manifest.Sources[idx]
			source = &copy
			break
		}
	}
	s.mu.Unlock()
	if source == nil {
		return RemoteVersionView{}, fmt.Errorf("codex_binary_source_missing: %s", sourceID)
	}

	releases, err := s.releaseClient.ListReleases(ctx, *source)
	if err != nil {
		return RemoteVersionView{}, err
	}
	releases = s.enrichReleaseAssetsFromHTML(ctx, releases)
	remotes := s.remoteViewsFromReleases(*source, releases, true)
	for _, item := range remotes {
		if item.SourceID == sourceID && item.Tag == tag {
			return item, nil
		}
	}
	return RemoteVersionView{}, fmt.Errorf("codex_binary_release_missing: %s", tag)
}

func (s *Service) installedVersionIDByTag(tag string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	manifest, err := s.loadManifest()
	if err != nil {
		return ""
	}
	for _, version := range manifest.Versions {
		if version.ReleaseTag == tag {
			return version.ID
		}
	}
	return ""
}

func (s *Service) downloadRemoteAsset(ctx context.Context, remote RemoteVersionView) (string, func(), error) {
	assetName := remote.AssetName
	if assetName == "" {
		if parsed, err := url.Parse(remote.DownloadURL); err == nil {
			assetName = pathBase(parsed.Path)
		}
	}
	if assetName == "" {
		assetName = "codex"
	}
	downloadsDir := filepath.Join(s.rootDir, "downloads")
	if err := os.MkdirAll(downloadsDir, 0o755); err != nil {
		return "", nil, err
	}
	tempDir, err := os.MkdirTemp(downloadsDir, safePathPart(remote.Tag)+"-")
	if err != nil {
		return "", nil, err
	}
	cleanup := func() { _ = os.RemoveAll(tempDir) }
	target := filepath.Join(tempDir, safePathPart(assetName))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, remote.DownloadURL, nil)
	if err != nil {
		cleanup()
		return "", nil, err
	}
	req.Header.Set("User-Agent", "GetTokens Codex Binary Manager")
	resp, err := s.httpClient.Do(req)
	if err != nil {
		cleanup()
		return "", nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		cleanup()
		return "", nil, fmt.Errorf("codex_binary_download_failed: %d %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}
	file, err := os.Create(target)
	if err != nil {
		cleanup()
		return "", nil, err
	}
	if _, err := io.Copy(file, resp.Body); err != nil {
		_ = file.Close()
		cleanup()
		return "", nil, err
	}
	if err := file.Close(); err != nil {
		cleanup()
		return "", nil, err
	}
	if !isTarGz(remote.AssetName, target) {
		if err := os.Chmod(target, 0o755); err != nil {
			cleanup()
			return "", nil, err
		}
	}
	return target, cleanup, nil
}

func (s *Service) extractCodexFromTarGz(path string, tag string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return "", err
	}
	defer gzipReader.Close()
	targetDir := filepath.Join(filepath.Dir(path), "extracted")
	if err := os.MkdirAll(targetDir, 0o755); err != nil {
		return "", err
	}
	tarReader := tar.NewReader(gzipReader)
	for {
		header, err := tarReader.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return "", err
		}
		if header == nil || header.FileInfo().IsDir() || filepath.Base(header.Name) != "codex" {
			continue
		}
		target := filepath.Join(targetDir, "codex")
		output, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o755)
		if err != nil {
			return "", err
		}
		if _, err := io.Copy(output, tarReader); err != nil {
			_ = output.Close()
			return "", err
		}
		if err := output.Close(); err != nil {
			return "", err
		}
		return target, nil
	}
	return "", fmt.Errorf("codex_binary_archive_missing_binary: %s", tag)
}

func (s *Service) remoteViewsFromReleases(source Source, releases []GitHubRelease, includePrerelease bool) []RemoteVersionView {
	items := s.remoteViewsFromReleasesFiltered(source, releases, includePrerelease)
	if len(items) == 0 && !includePrerelease {
		items = s.remoteViewsFromReleasesFiltered(source, releases, true)
	}
	return items
}

func (s *Service) remoteViewsFromReleasesFiltered(source Source, releases []GitHubRelease, includePrerelease bool) []RemoteVersionView {
	items := make([]RemoteVersionView, 0, len(releases))
	for _, release := range releases {
		if release.Draft {
			continue
		}
		if release.Prerelease && !includePrerelease {
			continue
		}
		if source.TagPrefix != "" && !strings.HasPrefix(release.TagName, source.TagPrefix) {
			continue
		}
		version := strings.TrimPrefix(release.TagName, source.TagPrefix)
		if _, err := semver.NewVersion(version); err != nil {
			continue
		}
		asset, ok := s.matchAsset(release.Assets)
		if !ok {
			if len(release.Assets) > 0 {
				continue
			}
			asset = GitHubReleaseAsset{
				Name:        "",
				DownloadURL: release.HTMLURL,
			}
		}
		title := release.Name
		if strings.TrimSpace(title) == "" {
			title = release.TagName
		}
		items = append(items, RemoteVersionView{
			SourceID:     source.ID,
			Version:      version,
			Tag:          release.TagName,
			Title:        title,
			DownloadURL:  asset.DownloadURL,
			HTMLURL:      release.HTMLURL,
			AssetName:    asset.Name,
			AssetSize:    asset.Size,
			PublishedAt:  formatOptionalTime(release.PublishedAt),
			IsPrerelease: release.Prerelease,
		})
		if release.Body != "" {
			_ = s.saveVersionNotesLocked(VersionNotesView{
				SourceID:      source.ID,
				Tag:           release.TagName,
				Version:       version,
				Title:         title,
				HTMLURL:       release.HTMLURL,
				PublishedAt:   formatOptionalTime(release.PublishedAt),
				BodyMarkdown:  release.Body,
				BodyPlainText: plainTextFromMarkdown(release.Body),
				Source:        "remote",
			})
		}
	}
	sortRemoteVersionViews(items)
	return items
}

func (s *Service) matchAsset(assets []GitHubReleaseAsset) (GitHubReleaseAsset, bool) {
	tokens := platformAssetTokens(s.goos, s.goarch)
	var fallback *GitHubReleaseAsset
	for _, asset := range assets {
		name := strings.ToLower(asset.Name)
		if !strings.HasPrefix(name, "codex-") {
			continue
		}
		matched := true
		for _, token := range tokens {
			if !strings.Contains(name, token) {
				matched = false
				break
			}
		}
		if matched {
			if strings.HasSuffix(name, ".tar.gz") || strings.HasSuffix(name, ".tgz") {
				return asset, true
			}
			if fallback == nil {
				copy := asset
				fallback = &copy
			}
		}
	}
	if fallback != nil {
		return *fallback, true
	}
	return GitHubReleaseAsset{}, false
}

func (s *Service) matchAssetDownloadURL(urls []string) (GitHubReleaseAsset, bool) {
	assets := make([]GitHubReleaseAsset, 0, len(urls))
	for _, rawURL := range urls {
		parsed, err := url.Parse(rawURL)
		if err != nil {
			continue
		}
		name := pathBase(parsed.Path)
		if name == "" {
			continue
		}
		assets = append(assets, GitHubReleaseAsset{
			Name:        name,
			DownloadURL: rawURL,
		})
	}
	return s.matchAsset(assets)
}

func (s *Service) releaseAssetsFromExpandedHTML(ctx context.Context, releaseHTMLURL string) []GitHubReleaseAsset {
	parsed, err := url.Parse(releaseHTMLURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil
	}
	parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	if len(parts) < 5 || parts[len(parts)-2] != "tag" {
		return nil
	}
	tag := parts[len(parts)-1]
	expandedPath := "/" + strings.Join(parts[:len(parts)-2], "/") + "/expanded_assets/" + url.PathEscape(tag)
	expandedURL := parsed.Scheme + "://" + parsed.Host + expandedPath
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, expandedURL, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("Accept", "text/html, */*;q=0.5")
	req.Header.Set("User-Agent", "GetTokens Codex Binary Manager")
	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
	if err != nil {
		return nil
	}
	re := regexp.MustCompile(`href="([^"]+/releases/download/[^"]+)"`)
	matches := re.FindAllStringSubmatch(string(body), -1)
	urls := make([]string, 0, len(matches))
	seen := map[string]bool{}
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		rawURL := html.UnescapeString(match[1])
		if strings.HasPrefix(rawURL, "/") {
			rawURL = parsed.Scheme + "://" + parsed.Host + rawURL
		}
		if !seen[rawURL] {
			seen[rawURL] = true
			urls = append(urls, rawURL)
		}
	}
	asset, ok := s.matchAssetDownloadURL(urls)
	if !ok {
		return nil
	}
	return []GitHubReleaseAsset{asset}
}

func (s *Service) enrichReleaseAssetsFromHTML(ctx context.Context, releases []GitHubRelease) []GitHubRelease {
	result := append([]GitHubRelease(nil), releases...)
	for idx := range result {
		if len(result[idx].Assets) > 0 || result[idx].HTMLURL == "" {
			continue
		}
		result[idx].Assets = s.releaseAssetsFromExpandedHTML(ctx, result[idx].HTMLURL)
	}
	return result
}

func platformAssetTokens(goos string, goarch string) []string {
	if goos == "darwin" {
		if goarch == "arm64" {
			return []string{"aarch64", "apple", "darwin"}
		}
		if goarch == "amd64" {
			return []string{"x86_64", "apple", "darwin"}
		}
	}
	return []string{goos, goarch}
}

func markInstalledRemoteVersions(remotes []RemoteVersionView, versions []VersionView) []RemoteVersionView {
	installedTags := map[string]bool{}
	installedVersions := map[string]bool{}
	for _, version := range versions {
		if version.ReleaseTag != "" {
			installedTags[version.ReleaseTag] = true
		}
		installedVersions[version.DetectedVersion] = true
	}
	result := make([]RemoteVersionView, 0, len(remotes))
	for _, remote := range remotes {
		remote.IsInstalled = installedTags[remote.Tag] || installedVersions[remote.Version]
		result = append(result, remote)
	}
	return result
}

func sortRemoteVersionViews(items []RemoteVersionView) {
	sort.SliceStable(items, func(i, j int) bool {
		left, leftErr := semver.NewVersion(items[i].Version)
		right, rightErr := semver.NewVersion(items[j].Version)
		if leftErr == nil && rightErr == nil {
			return left.GreaterThan(right)
		}
		return items[i].PublishedAt > items[j].PublishedAt
	})
}

func sortVersionRows(items []VersionRowView) {
	sort.SliceStable(items, func(i, j int) bool {
		left, leftErr := semver.NewVersion(items[i].Version)
		right, rightErr := semver.NewVersion(items[j].Version)
		if leftErr == nil && rightErr == nil {
			return left.GreaterThan(right)
		}
		return items[i].PublishedAt > items[j].PublishedAt
	})
}

func buildRows(versions []VersionView, remotes []RemoteVersionView, tasks []DownloadTaskView, selectedID string) []VersionRowView {
	rows := make([]VersionRowView, 0, len(versions)+len(remotes))
	rowsByTag := map[string]int{}
	for _, version := range versions {
		action := "activate"
		secondary := "reveal"
		if version.IsSelected {
			action = "none"
		}
		row := VersionRowView{
			RowID:              "installed:" + version.ID,
			Version:            version.DetectedVersion,
			Tag:                version.ReleaseTag,
			SourceID:           version.SourceID,
			InstalledVersionID: version.ID,
			IsInstalled:        true,
			IsSelected:         version.IsSelected,
			IsRollback:         selectedID != "" && version.ID != selectedID,
			InstalledAt:        version.InstalledAt,
			NotesState:         notesState(version),
			PrimaryAction:      action,
			SecondaryAction:    secondary,
		}
		rows = append(rows, row)
		if version.ReleaseTag != "" {
			rowsByTag[version.ReleaseTag] = len(rows) - 1
		}
	}
	for _, remote := range remotes {
		if idx, ok := rowsByTag[remote.Tag]; ok {
			rows[idx].HasRemote = true
			rows[idx].PublishedAt = remote.PublishedAt
			continue
		}
		rows = append(rows, VersionRowView{
			RowID:         "remote:" + remote.Tag,
			Version:       remote.Version,
			Tag:           remote.Tag,
			SourceID:      remote.SourceID,
			IsInstalled:   remote.IsInstalled,
			HasRemote:     true,
			PublishedAt:   remote.PublishedAt,
			NotesState:    "none",
			PrimaryAction: "download_activate",
		})
	}
	sortVersionRows(rows)
	return rows
}

func notesState(version VersionView) string {
	if version.ReleaseTag == "" {
		return "local"
	}
	return "none"
}

func sortVersionViews(items []VersionView) {
	sort.SliceStable(items, func(i, j int) bool {
		left, leftErr := semver.NewVersion(items[i].DetectedVersion)
		right, rightErr := semver.NewVersion(items[j].DetectedVersion)
		if leftErr == nil && rightErr == nil {
			return left.GreaterThan(right)
		}
		return items[i].InstalledAt > items[j].InstalledAt
	})
}

func (s *Service) uniqueVersionID(manifest *Manifest, version string, hash string) string {
	prefixLength := 8
	for {
		if len(hash) < prefixLength {
			prefixLength = len(hash)
		}
		candidate := version + "-" + hash[:prefixLength]
		found := false
		for _, item := range manifest.Versions {
			if item.ID == candidate {
				found = true
				break
			}
		}
		if !found {
			return candidate
		}
		if prefixLength >= len(hash) {
			return version + "-" + hash
		}
		prefixLength += 4
	}
}

func detectVersion(path string) string {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	output, err := exec.CommandContext(ctx, path, "--version").CombinedOutput()
	if err != nil {
		return "unknown"
	}
	return parseVersion(string(output))
}

type GitHubRESTReleaseClient struct {
	httpClient *http.Client
}

func NewGitHubRESTReleaseClient(client *http.Client) *GitHubRESTReleaseClient {
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	return &GitHubRESTReleaseClient{httpClient: client}
}

func (c *GitHubRESTReleaseClient) ListReleases(ctx context.Context, source Source) ([]GitHubRelease, error) {
	repoParts := strings.Split(source.Repo, "/")
	if len(repoParts) != 2 || repoParts[0] == "" || repoParts[1] == "" {
		return nil, fmt.Errorf("invalid github repo: %s", source.Repo)
	}
	endpoint := "https://api.github.com/repos/" + url.PathEscape(repoParts[0]) + "/" + url.PathEscape(repoParts[1]) + "/releases?per_page=50"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "GetTokens Codex Binary Manager")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return c.listReleasesAtom(ctx, source, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return c.listReleasesAtom(ctx, source, fmt.Errorf("github releases returned %d: %s", resp.StatusCode, strings.TrimSpace(string(body))))
	}
	var payload []githubReleasePayload
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	releases := make([]GitHubRelease, 0, len(payload))
	for _, item := range payload {
		publishedAt, _ := time.Parse(time.RFC3339, item.PublishedAt)
		assets := make([]GitHubReleaseAsset, 0, len(item.Assets))
		for _, asset := range item.Assets {
			assets = append(assets, GitHubReleaseAsset{
				Name:        asset.Name,
				DownloadURL: asset.BrowserDownloadURL,
				ContentType: asset.ContentType,
				Size:        asset.Size,
			})
		}
		releases = append(releases, GitHubRelease{
			TagName:     item.TagName,
			Name:        item.Name,
			Body:        item.Body,
			HTMLURL:     item.HTMLURL,
			PublishedAt: publishedAt,
			Draft:       item.Draft,
			Prerelease:  item.Prerelease,
			Assets:      assets,
		})
	}
	return releases, nil
}

func (c *GitHubRESTReleaseClient) listReleasesAtom(ctx context.Context, source Source, originalErr error) ([]GitHubRelease, error) {
	repoParts := strings.Split(source.Repo, "/")
	if len(repoParts) != 2 || repoParts[0] == "" || repoParts[1] == "" {
		return nil, originalErr
	}
	endpoint := "https://github.com/" + url.PathEscape(repoParts[0]) + "/" + url.PathEscape(repoParts[1]) + "/releases.atom"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, originalErr
	}
	req.Header.Set("Accept", "application/atom+xml, application/xml;q=0.9, */*;q=0.5")
	req.Header.Set("User-Agent", "GetTokens Codex Binary Manager")
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, originalErr
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, originalErr
	}
	var feed atomFeed
	if err := xml.NewDecoder(resp.Body).Decode(&feed); err != nil {
		return nil, originalErr
	}
	releases := make([]GitHubRelease, 0, len(feed.Entries))
	for _, entry := range feed.Entries {
		tag := tagFromAtomEntry(entry)
		if tag == "" {
			continue
		}
		updated, _ := time.Parse(time.RFC3339, entry.Updated)
		body := html.UnescapeString(entry.Content.Body)
		body = strings.ReplaceAll(body, "<p>", "")
		body = strings.ReplaceAll(body, "</p>", "\n")
		body = strings.TrimSpace(body)
		releases = append(releases, GitHubRelease{
			TagName:     tag,
			Name:        entry.Title,
			Body:        body,
			HTMLURL:     atomEntryHTMLURL(entry),
			PublishedAt: updated,
			Prerelease:  strings.Contains(tag, "-"),
		})
	}
	if len(releases) == 0 {
		return nil, originalErr
	}
	return releases, nil
}

type githubReleasePayload struct {
	TagName     string                      `json:"tag_name"`
	Name        string                      `json:"name"`
	Body        string                      `json:"body"`
	HTMLURL     string                      `json:"html_url"`
	PublishedAt string                      `json:"published_at"`
	Draft       bool                        `json:"draft"`
	Prerelease  bool                        `json:"prerelease"`
	Assets      []githubReleaseAssetPayload `json:"assets"`
}

type githubReleaseAssetPayload struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
	ContentType        string `json:"content_type"`
	Size               int64  `json:"size"`
}

type atomFeed struct {
	Entries []atomEntry `xml:"entry"`
}

type atomEntry struct {
	ID      string           `xml:"id"`
	Updated string           `xml:"updated"`
	Title   string           `xml:"title"`
	Links   []atomLink       `xml:"link"`
	Content atomEntryContent `xml:"content"`
}

type atomLink struct {
	Rel  string `xml:"rel,attr"`
	Type string `xml:"type,attr"`
	Href string `xml:"href,attr"`
}

type atomEntryContent struct {
	Type string `xml:"type,attr"`
	Body string `xml:",innerxml"`
}

func tagFromAtomEntry(entry atomEntry) string {
	if href := atomEntryHTMLURL(entry); href != "" {
		parts := strings.Split(strings.TrimRight(href, "/"), "/")
		if len(parts) > 0 {
			return parts[len(parts)-1]
		}
	}
	if idx := strings.LastIndex(entry.ID, "/"); idx >= 0 && idx+1 < len(entry.ID) {
		return entry.ID[idx+1:]
	}
	return ""
}

func atomEntryHTMLURL(entry atomEntry) string {
	for _, link := range entry.Links {
		if (link.Rel == "alternate" || link.Rel == "") && link.Href != "" {
			return link.Href
		}
	}
	return ""
}

func parseVersion(output string) string {
	re := regexp.MustCompile(`\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?`)
	match := re.FindString(output)
	if match == "" {
		return "unknown"
	}
	return match
}

func formatOptionalTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.UTC().Format(time.RFC3339)
}

func plainTextFromMarkdown(value string) string {
	replacer := strings.NewReplacer("#", "", "*", "", "`", "", "[", "", "]", "", "(", " ", ")", "")
	lines := strings.Split(value, "\n")
	out := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(replacer.Replace(line))
		line = strings.TrimPrefix(line, "- ")
		line = strings.TrimPrefix(line, "* ")
		if line != "" {
			out = append(out, line)
		}
	}
	return strings.Join(out, "\n")
}

func fileSHA256(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}
	return hex.EncodeToString(hash.Sum(nil)), nil
}

func copyFile(source string, target string) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	output, err := os.Create(target)
	if err != nil {
		return err
	}
	if _, err := io.Copy(output, input); err != nil {
		_ = output.Close()
		return err
	}
	return output.Close()
}

func readJSON(path string, target interface{}) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()
	return json.NewDecoder(file).Decode(target)
}

func writeJSON(path string, value interface{}) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmpPath := path + ".tmp"
	file, err := os.Create(tmpPath)
	if err != nil {
		return err
	}
	encoder := json.NewEncoder(file)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(value); err != nil {
		_ = file.Close()
		_ = os.Remove(tmpPath)
		return err
	}
	if err := file.Close(); err != nil {
		_ = os.Remove(tmpPath)
		return err
	}
	return os.Rename(tmpPath, path)
}

func writeFileAtomic(path string, content []byte, perm os.FileMode) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	tmpPath := path + ".tmp"
	if err := os.WriteFile(tmpPath, content, perm); err != nil {
		return err
	}
	return os.Rename(tmpPath, path)
}

func safePathPart(value string) string {
	replacer := strings.NewReplacer("/", "_", "\\", "_", ":", "_", "..", "_")
	return replacer.Replace(value)
}

func pathBase(value string) string {
	value = strings.TrimRight(value, "/")
	if value == "" {
		return ""
	}
	if idx := strings.LastIndex(value, "/"); idx >= 0 {
		return value[idx+1:]
	}
	return value
}

func isTarGz(assetName string, filePath string) bool {
	value := strings.ToLower(assetName)
	if value == "" {
		value = strings.ToLower(filePath)
	}
	return strings.HasSuffix(value, ".tar.gz") || strings.HasSuffix(value, ".tgz")
}

func pathContainsDir(pathValue string, dir string) bool {
	if pathValue == "" || dir == "" {
		return false
	}
	target := filepath.Clean(dir)
	for _, item := range filepath.SplitList(pathValue) {
		if samePath(item, target) {
			return true
		}
	}
	return false
}

func samePath(left string, right string) bool {
	if left == "" || right == "" {
		return false
	}
	leftClean := filepath.Clean(left)
	rightClean := filepath.Clean(right)
	if leftClean == rightClean {
		return true
	}
	leftEval, leftErr := filepath.EvalSymlinks(leftClean)
	rightEval, rightErr := filepath.EvalSymlinks(rightClean)
	return leftErr == nil && rightErr == nil && leftEval == rightEval
}

const (
	managedPathBlockStart = "# >>> gettokens codex binary managed path >>>"
	managedPathBlockEnd   = "# <<< gettokens codex binary managed path <<<"
)

func managedPathBlock(binDir string, profilePath string) string {
	return managedPathBlockStart + "\n" +
		managedPathCommand(binDir, profilePath) + "\n" +
		managedPathBlockEnd + "\n"
}

func managedPathCommand(binDir string, profilePath string) string {
	if strings.HasSuffix(profilePath, "config.fish") {
		return "fish_add_path -g -- " + shellQuote(binDir)
	}
	return "export PATH=" + shellQuote(binDir) + `:"$PATH"`
}

func upsertManagedPathBlock(content string, block string) (string, bool) {
	start := strings.Index(content, managedPathBlockStart)
	end := strings.Index(content, managedPathBlockEnd)
	if start >= 0 && end >= start {
		end += len(managedPathBlockEnd)
		for end < len(content) && (content[end] == '\n' || content[end] == '\r') {
			end++
		}
		next := content[:start] + block + content[end:]
		return next, next != content
	}
	if strings.TrimSpace(content) == "" {
		return block, content != block
	}
	separator := "\n\n"
	if strings.HasSuffix(content, "\n") {
		separator = "\n"
	}
	return content + separator + block, true
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'"
}
