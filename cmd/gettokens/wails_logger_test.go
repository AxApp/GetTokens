package main

import "testing"

type spyWailsLogger struct {
	errors []string
}

func (l *spyWailsLogger) Print(string)   {}
func (l *spyWailsLogger) Trace(string)   {}
func (l *spyWailsLogger) Debug(string)   {}
func (l *spyWailsLogger) Info(string)    {}
func (l *spyWailsLogger) Warning(string) {}
func (l *spyWailsLogger) Fatal(string)   {}

func (l *spyWailsLogger) Error(message string) {
	l.errors = append(l.errors, message)
}

func TestWailsAppLoggerSuppressesBrowserRuntimeReadyNoiseOnlyInDev(t *testing.T) {
	base := &spyWailsLogger{}
	log := &wailsAppLogger{
		base:                        base,
		suppressBrowserRuntimeReady: true,
	}

	log.Error("process message error: runtime:ready -> Unknown message from front end: runtime:ready")
	log.Error("Unknown message from front end: runtime:ready")
	log.Error("Unknown message from front end: runtime:other")

	if len(base.errors) != 1 || base.errors[0] != "Unknown message from front end: runtime:other" {
		t.Fatalf("forwarded errors = %#v, want only non-runtime-ready error", base.errors)
	}
}

func TestWailsAppLoggerKeepsRuntimeReadyNoiseInProduction(t *testing.T) {
	base := &spyWailsLogger{}
	log := &wailsAppLogger{
		base:                        base,
		suppressBrowserRuntimeReady: false,
	}

	log.Error("Unknown message from front end: runtime:ready")

	if len(base.errors) != 1 {
		t.Fatalf("forwarded errors = %#v, want production runtime ready log forwarded", base.errors)
	}
}
