import AppKit
import Darwin
import Foundation

typealias MenuBarAction = @convention(c) () -> Void
typealias CreateController = @convention(c) (
    UnsafePointer<CChar>?,
    UnsafePointer<CChar>?,
    UnsafePointer<CChar>?,
    MenuBarAction?,
    MenuBarAction?
) -> UnsafeMutableRawPointer?

@_cdecl("gettokensRenderPreviewNoop")
func gettokensRenderPreviewNoop() {}

func fail(_ message: String) -> Never {
    FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
    exit(1)
}

let args = CommandLine.arguments
guard args.count == 4 else {
    fail("Usage: render-menubar-swiftui-preview.swift <dylib> <snapshot-json> <output-png>")
}

let dylibPath = args[1]
let snapshotPath = args[2]
let outputPath = args[3]

guard let handle = dlopen(dylibPath, RTLD_NOW | RTLD_LOCAL) else {
    fail("dlopen failed: \(String(cString: dlerror()))")
}

guard let symbol = dlsym(handle, "GetTokensMenuBarCreateSwiftUIViewController") else {
    fail("missing GetTokensMenuBarCreateSwiftUIViewController")
}

let create = unsafeBitCast(symbol, to: CreateController.self)
let snapshotJSON: String
do {
    snapshotJSON = try String(contentsOfFile: snapshotPath, encoding: .utf8)
} catch {
    fail("read snapshot failed: \(error)")
}

guard let raw = create(
    "GetTokens Dev: 服务已就绪 :18317",
    "GetTokens Dev",
    snapshotJSON,
    gettokensRenderPreviewNoop,
    gettokensRenderPreviewNoop
) else {
    fail("SwiftUI controller factory returned nil")
}

let controller = Unmanaged<NSViewController>.fromOpaque(raw).takeRetainedValue()
let view = controller.view
view.frame = NSRect(x: 0, y: 0, width: 392, height: 560)
view.needsLayout = true
view.layoutSubtreeIfNeeded()

guard let bitmap = view.bitmapImageRepForCachingDisplay(in: view.bounds) else {
    fail("failed to create bitmap representation")
}
view.cacheDisplay(in: view.bounds, to: bitmap)

guard let png = bitmap.representation(using: .png, properties: [:]) else {
    fail("failed to encode PNG")
}

let outputURL = URL(fileURLWithPath: outputPath)
do {
    try FileManager.default.createDirectory(at: outputURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    try png.write(to: outputURL)
} catch {
    fail("write PNG failed: \(error)")
}

print(outputPath)
