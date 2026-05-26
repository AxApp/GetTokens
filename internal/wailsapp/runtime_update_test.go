package wailsapp

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/linhay/gettokens/internal/updater"
)

func TestUpdateCheckIntervalIsSixHours(t *testing.T) {
	if updateCheckInterval != 6*time.Hour {
		t.Fatalf("updateCheckInterval = %s, want 6h", updateCheckInterval)
	}
}

func TestRunUpdateAvailabilityLoopChecksImmediatelyAndOnTicks(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ticks := make(chan time.Time, 1)
	emitted := make(chan string, 2)
	checks := 0

	done := make(chan struct{})
	go func() {
		defer close(done)
		runUpdateAvailabilityLoop(
			ctx,
			ticks,
			func(context.Context) (*updater.ReleaseInfo, bool, error) {
				checks++
				return &updater.ReleaseInfo{Version: fmt.Sprintf("1.0.%d", checks)}, true, nil
			},
			func(release *updater.ReleaseInfo) {
				emitted <- release.Version
			},
		)
	}()

	if got := waitForUpdateLoopEmit(t, emitted); got != "1.0.1" {
		t.Fatalf("initial emitted version = %q, want 1.0.1", got)
	}

	ticks <- time.Now()
	if got := waitForUpdateLoopEmit(t, emitted); got != "1.0.2" {
		t.Fatalf("tick emitted version = %q, want 1.0.2", got)
	}

	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("update availability loop did not stop after context cancellation")
	}
}

func TestCheckAndEmitAvailableUpdateSkipsUnavailableAndErrors(t *testing.T) {
	ctx := context.Background()
	emitCount := 0
	emit := func(*updater.ReleaseInfo) {
		emitCount++
	}

	checkAndEmitAvailableUpdate(
		ctx,
		func(context.Context) (*updater.ReleaseInfo, bool, error) {
			return nil, false, nil
		},
		emit,
	)
	checkAndEmitAvailableUpdate(
		ctx,
		func(context.Context) (*updater.ReleaseInfo, bool, error) {
			return nil, false, context.Canceled
		},
		emit,
	)

	if emitCount != 0 {
		t.Fatalf("emitCount = %d, want 0", emitCount)
	}
}

func waitForUpdateLoopEmit(t *testing.T, emitted <-chan string) string {
	t.Helper()

	select {
	case version := <-emitted:
		return version
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for update loop emit")
	}
	return ""
}
