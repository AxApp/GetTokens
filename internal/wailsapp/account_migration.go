package wailsapp

import (
	"errors"

	"github.com/linhay/gettokens/internal/cliproxyapi"
)

const accountMigrationBackupHint = "~/.config/gettokens/migration-backups/accounts-v1-<timestamp>/"

type AccountMigrationPreview struct {
	Status            string                        `json:"status"`
	AccountCount      int                           `json:"accountCount"`
	CandidateCount    int                           `json:"candidateCount"`
	KindSummary       []AccountMigrationKindSummary `json:"kindSummary"`
	Warnings          []string                      `json:"warnings,omitempty"`
	GeneratedAtUnixMs int64                         `json:"generatedAtUnixMs,omitempty"`
	BackupHint        string                        `json:"backupHint"`
}

type AccountMigrationKindSummary struct {
	Kind  string `json:"kind"`
	Count int    `json:"count"`
}

type AccountMigrationCommitResult struct {
	Imported int                      `json:"imported"`
	Skipped  int                      `json:"skipped"`
	Errors   []string                 `json:"errors,omitempty"`
	Preview  *AccountMigrationPreview `json:"preview,omitempty"`
}

type AccountMigrationDeleteResult struct {
	Deleted   int                      `json:"deleted"`
	BackupDir string                   `json:"backupDir,omitempty"`
	Preview   *AccountMigrationPreview `json:"preview,omitempty"`
}

func (a *App) GetAccountMigrationPreview() (*AccountMigrationPreview, error) {
	client := a.managementClient()
	accounts, accountsErr := client.ListAccounts()
	accountCount := 0
	if accountsErr == nil {
		accountCount = len(accounts)
	}
	report, reportErr := client.DryRunAccountMigration()
	if reportErr != nil {
		if accountCount > 0 {
			warnings := []string{reportErr.Error()}
			if accountsErr != nil {
				warnings = append(warnings, accountsErr.Error())
			}
			return buildAccountMigrationPreview(accountCount, nil, warnings), nil
		}
		if accountsErr != nil {
			return nil, accountsErr
		}
		return nil, reportErr
	}
	if accountsErr != nil {
		return buildAccountMigrationPreview(0, report, []string{accountsErr.Error()}), nil
	}
	return buildAccountMigrationPreview(accountCount, report, nil), nil
}

func (a *App) CommitAccountMigration() (*AccountMigrationCommitResult, error) {
	report, err := a.managementClient().CommitAccountMigration()
	if err != nil {
		return nil, err
	}
	preview, previewErr := a.GetAccountMigrationPreview()
	if previewErr != nil {
		return nil, previewErr
	}
	return &AccountMigrationCommitResult{
		Imported: report.Imported,
		Skipped:  report.Skipped,
		Errors:   append([]string(nil), report.Errors...),
		Preview:  preview,
	}, nil
}

func (a *App) DeleteLegacyAccountSources() (*AccountMigrationDeleteResult, error) {
	accounts, err := a.managementClient().ListAccounts()
	if err != nil {
		return nil, err
	}
	if len(accounts) == 0 {
		return nil, errors.New("迁移后账号为空，禁止删除旧账号事实源")
	}
	result, err := a.managementClient().DeleteLegacyAccountSources()
	if err != nil {
		return nil, err
	}
	preview, previewErr := a.GetAccountMigrationPreview()
	if previewErr != nil {
		return nil, previewErr
	}
	return &AccountMigrationDeleteResult{
		Deleted:   result.Deleted,
		BackupDir: result.BackupDir,
		Preview:   preview,
	}, nil
}

func buildAccountMigrationPreview(accountCount int, report *cliproxyapi.AccountMigrationReport, warnings []string) *AccountMigrationPreview {
	candidateCount := 0
	generatedAt := int64(0)
	var candidates []cliproxyapi.AccountMigrationCandidate
	if report != nil {
		candidates = report.Candidates
		candidateCount = len(report.Candidates)
		generatedAt = report.GeneratedAtUnixMs
		warnings = append(warnings, report.Warnings...)
	}
	status := "empty"
	switch {
	case accountCount == 0 && candidateCount > 0:
		status = "needs-migration"
	case accountCount > 0 && candidateCount > 0:
		status = "ready-to-delete-legacy"
	case accountCount > 0:
		status = "ready"
	}
	return &AccountMigrationPreview{
		Status:            status,
		AccountCount:      accountCount,
		CandidateCount:    candidateCount,
		KindSummary:       summarizeAccountMigrationKinds(candidates),
		Warnings:          append([]string(nil), warnings...),
		GeneratedAtUnixMs: generatedAt,
		BackupHint:        accountMigrationBackupHint,
	}
}

func summarizeAccountMigrationKinds(candidates []cliproxyapi.AccountMigrationCandidate) []AccountMigrationKindSummary {
	if len(candidates) == 0 {
		return nil
	}
	order := []string{}
	counts := map[string]int{}
	for _, candidate := range candidates {
		kind := string(candidate.Kind)
		if kind == "" {
			kind = "unknown"
		}
		if _, ok := counts[kind]; !ok {
			order = append(order, kind)
		}
		counts[kind]++
	}
	summary := make([]AccountMigrationKindSummary, 0, len(order))
	for _, kind := range order {
		summary = append(summary, AccountMigrationKindSummary{
			Kind:  kind,
			Count: counts[kind],
		})
	}
	return summary
}
