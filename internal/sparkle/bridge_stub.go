//go:build !darwin

package sparkle

func Available() bool {
	return false
}

func Start() error {
	return nil
}

func CheckForUpdates() error {
	return nil
}
