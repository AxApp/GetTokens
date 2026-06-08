package menubar

import (
	"os"
	"strings"
	"testing"
)

func TestMenuBarBridgeUsesPopoverInsteadOfStatusMenu(t *testing.T) {
	body, err := os.ReadFile("menubar_bridge.m")
	if err != nil {
		t.Fatalf("read menubar bridge: %v", err)
	}
	source := string(body)

	for _, want := range []string{
		"static NSPopover *popover",
		"showRelativeToRect:statusItem.button.bounds",
		"statusItem.button.action = @selector(togglePopover:)",
		"void GetTokensMenuBarStart(const char *statusText, const char *displayName)",
		"latestDisplayName",
		"statusItem.button.title = dev ? @\"DEV\" : @\"\"",
		"[statusItem retain]",
		"[statusItem release]",
		"NSString *status = [string_from_c(statusText) copy]",
		"NSData *iconData = [[NSData alloc] initWithBytes:data length:length]",
		"paper_color",
		"Quota receipt",
		"resource_row",
		"snapshot_array",
		"snapshot_dict",
		"NSJSONSerialization",
		"void GetTokensMenuBarSetQuotaSnapshot(const char *snapshotJSON)",
		"latestQuotaSnapshot",
		"@selector(refreshSnapshot:)",
		"打开账号池",
		"刷新额度",
		"kPopoverContentWidth",
		"constrain_width",
		"receipt_header_view",
		"empty_resource_row",
		"constrain_width(view, kPopoverContentWidth)",
		"dlopen",
		"libGetTokensMenuBarSwiftUI.dylib",
		"GetTokensMenuBarCreateSwiftUIViewController",
		"swiftui_popover_controller",
		"run_swiftui_action_after_button_event",
	} {
		if !strings.Contains(source, want) {
			t.Fatalf("menubar bridge missing %q", want)
		}
	}

	if strings.Contains(source, "popover_button(@\"退出 GetTokens\"") || strings.Contains(source, "[stack addArrangedSubview:quitButton]") {
		t.Fatal("menubar popover still renders an exit app button; users should close the status item from settings, not this popover")
	}

	if strings.Contains(source, "余额                                   sources") {
		t.Fatal("menubar bridge still aligns receipt header with spaces; want structured AppKit layout")
	}
	if strings.Contains(source, "popover_label(@\"quota snapshot\"") || strings.Contains(source, "snapshot_string(resource, @\"name\", @\"quota snapshot\")") {
		t.Fatal("menubar bridge still renders quota snapshot as the empty account name; want user-facing waiting copy")
	}

	if strings.Contains(source, "[statusItem setMenu:") {
		t.Fatal("menubar bridge still attaches an NSMenu to the status item; want click-driven NSPopover")
	}
	if strings.Contains(source, "@selector(checkForUpdates:)") || strings.Contains(source, "gettokensMenuBarCheckForUpdates") {
		t.Fatal("menubar bridge still uses update-check callback; want local quota snapshot refresh")
	}
}

func TestMenuBarSwiftUIActionsAreDeferredOutsideButtonStack(t *testing.T) {
	body, err := os.ReadFile("menubar_bridge.m")
	if err != nil {
		t.Fatalf("read menubar bridge: %v", err)
	}
	source := string(body)

	for _, want := range []string{
		"static void run_swiftui_action_after_button_event(GetTokensSwiftUIActionFn action)",
		"dispatch_async(dispatch_get_main_queue(), ^{",
		"run_swiftui_action_after_button_event(gettokensMenuBarOpenWindow)",
		"run_swiftui_action_after_button_event(gettokensMenuBarRefreshSnapshot)",
	} {
		if !strings.Contains(source, want) {
			t.Fatalf("SwiftUI menu bar action should be deferred, missing %q", want)
		}
	}

	openCallback := source[strings.Index(source, "static void swiftui_open_window_callback"):strings.Index(source, "static void swiftui_refresh_snapshot_callback")]
	if strings.Contains(openCallback, "gettokensMenuBarOpenWindow();") {
		t.Fatal("SwiftUI open callback must not synchronously enter Go/Wails from the button action")
	}
}

func TestMenuBarCallbacksDispatchOutsideNativeEventStack(t *testing.T) {
	body, err := os.ReadFile("controller_darwin.go")
	if err != nil {
		t.Fatalf("read controller_darwin.go: %v", err)
	}
	source := string(body)

	for _, want := range []string{
		"func dispatchCallback(callback func())",
		"go callback()",
		"dispatchCallback(currentCallbacks().OpenWindow)",
		"dispatchCallback(currentCallbacks().RefreshSnapshot)",
		"dispatchCallback(currentCallbacks().Quit)",
	} {
		if !strings.Contains(source, want) {
			t.Fatalf("menu bar callbacks should dispatch outside native event stack, missing %q", want)
		}
	}
}

func TestMenuBarSwiftUIPopoverBuildScriptsAreWired(t *testing.T) {
	for _, path := range []string{
		"../../scripts/build-menubar-swiftui.sh",
		"../../scripts/install-menubar-swiftui.sh",
		"../../internal/menubar/swiftui/GetTokensMenuBarPopover.swift",
	} {
		body, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		source := string(body)
		if strings.TrimSpace(source) == "" {
			t.Fatalf("%s is empty", path)
		}
	}

	wrapper, err := os.ReadFile("../../scripts/wails-cli.sh")
	if err != nil {
		t.Fatalf("read wails wrapper: %v", err)
	}
	wrapperSource := string(wrapper)
	for _, want := range []string{
		"scripts/build-menubar-swiftui.sh",
		"GETTOKENS_MENUBAR_SWIFTUI_DYLIB",
		"scripts/install-menubar-swiftui.sh",
		"codesign --deep --force --sign -",
		"if [[ \"${status}\" -ne 0 ]]",
		"build/bin/cli-proxy-api",
		"build/bin/cli-proxy-api.meta.json",
		"${app_macos_dir}/cli-proxy-api.meta.json",
		"darwin/amd64|darwin/x86_64",
		"darwin/arm64",
	} {
		if !strings.Contains(wrapperSource, want) {
			t.Fatalf("wails wrapper missing SwiftUI popover hook %q", want)
		}
	}

	swiftBuildScript, err := os.ReadFile("../../scripts/build-menubar-swiftui.sh")
	if err != nil {
		t.Fatalf("read SwiftUI build script: %v", err)
	}
	if !strings.Contains(string(swiftBuildScript), "CLANG_MODULE_CACHE_PATH") {
		t.Fatal("SwiftUI build script should keep clang module cache under the workspace for sandboxed/local builds")
	}

	swiftPopover, err := os.ReadFile("../../internal/menubar/swiftui/GetTokensMenuBarPopover.swift")
	if err != nil {
		t.Fatalf("read SwiftUI popover: %v", err)
	}
	swiftSource := string(swiftPopover)
	if strings.Contains(swiftSource, `var name = "quota snapshot"`) || strings.Contains(swiftSource, `fallback: "quota snapshot"`) {
		t.Fatal("SwiftUI popover still renders quota snapshot as the empty account name; want user-facing waiting copy")
	}

	for _, path := range []string{
		"../../scripts/build-local-macos-package.sh",
		"../../.github/workflows/release.yml",
	} {
		body, err := os.ReadFile(path)
		if err != nil {
			t.Fatalf("read %s: %v", path, err)
		}
		source := string(body)
		for _, want := range []string{
			"build-menubar-swiftui.sh",
			"install-menubar-swiftui.sh",
		} {
			if !strings.Contains(source, want) {
				t.Fatalf("%s missing SwiftUI popover packaging hook %q", path, want)
			}
		}
	}

	for _, want := range []string{
		"import SwiftUI",
		"NSHostingController",
		"@_cdecl(\"GetTokensMenuBarCreateSwiftUIViewController\")",
		"打开账号池",
		"刷新额度",
	} {
		if !strings.Contains(swiftSource, want) {
			t.Fatalf("SwiftUI popover missing %q", want)
		}
	}
	if strings.Contains(swiftSource, "退出 GetTokens") {
		t.Fatal("SwiftUI menu bar popover should not show an exit app button")
	}
}
