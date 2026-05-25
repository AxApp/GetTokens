//go:build !darwin

package appmenu

func InstallCheckForUpdates(_ string, _ Callbacks) error {
	return nil
}
