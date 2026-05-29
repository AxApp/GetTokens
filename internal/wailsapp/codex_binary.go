package wailsapp

import (
	"context"

	"github.com/linhay/gettokens/internal/codexbinary"
)

func (a *App) GetCodexBinarySnapshot() (*codexbinary.Snapshot, error) {
	return a.codexBinary.Snapshot()
}

func (a *App) RefreshCodexBinaryAvailable() (*codexbinary.Snapshot, error) {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return a.codexBinary.RefreshAvailable(ctx)
}

func (a *App) ImportCodexBinary(input codexbinary.ImportLocalInput) (*codexbinary.InstallResult, error) {
	return a.codexBinary.ImportLocal(input)
}

func (a *App) DownloadCodexBinary(input codexbinary.DownloadInput) (*codexbinary.DownloadResult, error) {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return a.codexBinary.Download(ctx, input)
}

func (a *App) EnableCodexBinaryManagedPath() (*codexbinary.EnableManagedPathResult, error) {
	return a.codexBinary.EnableManagedPath()
}

func (a *App) UseCodexBinary(input codexbinary.UseInput) (*codexbinary.UseResult, error) {
	return a.codexBinary.Use(input)
}

func (a *App) RevealCodexBinaryVersion(input codexbinary.VersionActionInput) error {
	path, err := a.codexBinary.VersionBinaryPath(input)
	if err != nil {
		return err
	}
	return openPathInFileManager(path)
}

func (a *App) DeleteCodexBinaryVersion(input codexbinary.VersionActionInput) (*codexbinary.DeleteVersionResult, error) {
	return a.codexBinary.DeleteVersion(input)
}

func (a *App) GetCodexBinaryVersionNotes(input codexbinary.VersionNotesInput) (*codexbinary.VersionNotesView, error) {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return a.codexBinary.VersionNotes(ctx, input)
}

func (a *App) GetCodexBinaryDoctor() (*codexbinary.DoctorSummary, error) {
	snapshot, err := a.codexBinary.Snapshot()
	if err != nil {
		return nil, err
	}
	return &snapshot.Doctor, nil
}
