package main

import (
	"path/filepath"
	"runtime"
	"testing"
)

func repoRoot(t *testing.T) string {
	t.Helper()
	_, filename, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("resolve test file path")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(filename), "..", ".."))
}

func repoPath(t *testing.T, elems ...string) string {
	t.Helper()
	return filepath.Join(append([]string{repoRoot(t)}, elems...)...)
}
