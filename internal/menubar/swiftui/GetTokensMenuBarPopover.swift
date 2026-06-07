import AppKit
import SwiftUI

private let popoverWidth: CGFloat = 392
private let popoverHeight: CGFloat = 560

private struct Summary {
    var lowestQuota = "--%"
    var riskAccounts = "--"
    var totalBalance = "--"
    var refreshLabel = "--:--"
}

private struct Resource: Identifiable {
    let id = UUID()
    var name = "等待账号额度快照"
    var detail = "点击刷新额度后更新"
    var percentText = "--%"
    var percent: Double = 0
    var window = "--"
    var balance = "-- 余额"
    var state = "待接入"
    var tone = "muted"
}

private struct Balance: Identifiable {
    let id = UUID()
    var label = "Sidecar"
    var value = "ready"
}

private struct Snapshot {
    var summary = Summary()
    var resources: [Resource] = []
    var balances: [Balance] = []
    var hasRuntimeData: Bool { !resources.isEmpty || !balances.isEmpty }
}

private func stringValue(_ value: Any?, fallback: String) -> String {
    if let string = value as? String, !string.isEmpty {
        return string
    }
    if let number = value as? NSNumber {
        return number.stringValue
    }
    return fallback
}

private func percentValue(_ value: Any?, fallback: Double) -> Double {
    let raw: Double
    if let number = value as? NSNumber {
        raw = number.doubleValue
    } else if let string = value as? String, let parsed = Double(string) {
        raw = parsed
    } else {
        raw = fallback
    }
    return min(1, max(0, raw))
}

private func snapshotFromJSON(_ json: String) -> Snapshot {
    guard let data = json.data(using: .utf8),
          let object = try? JSONSerialization.jsonObject(with: data),
          let root = object as? [String: Any] else {
        return Snapshot()
    }

    var snapshot = Snapshot()
    if let summary = root["summary"] as? [String: Any] {
        snapshot.summary = Summary(
            lowestQuota: stringValue(summary["lowestQuota"], fallback: "--%"),
            riskAccounts: stringValue(summary["riskAccounts"], fallback: "--"),
            totalBalance: stringValue(summary["totalBalance"], fallback: "--"),
            refreshLabel: stringValue(summary["refreshLabel"], fallback: "--:--")
        )
    }

    if let resources = root["resources"] as? [[String: Any]] {
        snapshot.resources = resources.prefix(3).map { item in
            Resource(
                name: stringValue(item["name"], fallback: "等待账号额度快照"),
                detail: stringValue(item["detail"], fallback: "点击刷新额度后更新"),
                percentText: stringValue(item["percentText"], fallback: "--%"),
                percent: percentValue(item["percent"], fallback: 0),
                window: stringValue(item["window"], fallback: "--"),
                balance: stringValue(item["balance"], fallback: "-- 余额"),
                state: stringValue(item["state"], fallback: "待接入"),
                tone: stringValue(item["tone"], fallback: "muted")
            )
        }
    }

    if let balances = root["balances"] as? [[String: Any]] {
        snapshot.balances = balances.prefix(4).map { item in
            Balance(
                label: stringValue(item["label"], fallback: "Balance"),
                value: stringValue(item["value"], fallback: "--")
            )
        }
    }

    return snapshot
}

private struct MenuBarPopoverView: View {
    let displayName: String
    let statusText: String
    let snapshot: Snapshot
    let openWindow: () -> Void
    let refreshSnapshot: () -> Void

    private let ink = Color(red: 27 / 255, green: 26 / 255, blue: 23 / 255)
    private let paper = Color(red: 244 / 255, green: 241 / 255, blue: 233 / 255)
    private let paperDeep = Color(red: 233 / 255, green: 227 / 255, blue: 212 / 255)
    private let muted = Color(red: 109 / 255, green: 103 / 255, blue: 93 / 255)
    private let bad = Color(red: 106 / 255, green: 44 / 255, blue: 49 / 255)
    private let warn = Color(red: 118 / 255, green: 85 / 255, blue: 31 / 255)
    private let good = Color(red: 41 / 255, green: 75 / 255, blue: 61 / 255)

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            topBar
            hero
            Rule()
            summaryGrid
            Rule()
            ScrollView(.vertical) {
                VStack(alignment: .leading, spacing: 9) {
                    resourcesList
                    Rule()
                    balanceRows
                    statusRows
                }
                .frame(width: popoverWidth - 44, alignment: .topLeading)
            }
            .scrollIndicators(.hidden)
            .frame(maxHeight: .infinity)
            Rule()
            actions
            footer
        }
        .padding(.init(top: 18, leading: 22, bottom: 18, trailing: 22))
        .frame(width: popoverWidth, height: popoverHeight, alignment: .topLeading)
        .background(
            LinearGradient(colors: [paper, paperDeep], startPoint: .top, endPoint: .bottom)
        )
        .font(.system(.caption, design: .monospaced))
        .foregroundStyle(ink)
    }

    private var topBar: some View {
        HStack {
            Text("GETTOKENS")
                .fontWeight(.heavy)
            Spacer()
            Text("BALANCE ::")
                .foregroundStyle(muted)
        }
        .font(.system(size: 12, weight: .heavy, design: .monospaced))
    }

    private var hero: some View {
        HStack(spacing: 14) {
            PixelKey()
            VStack(alignment: .leading, spacing: 5) {
                Text(displayName.isEmpty ? "GetTokens" : displayName)
                    .font(.system(size: 17, weight: .heavy, design: .monospaced))
                    .lineLimit(1)
                Text("Quota receipt")
                    .font(.system(size: 12, weight: .heavy, design: .monospaced))
                Text(snapshot.hasRuntimeData ? "账号额度快照已接入。" : "等待账号额度快照")
                    .font(.system(size: 11, weight: .regular, design: .monospaced))
                    .foregroundStyle(muted)
                    .lineLimit(2)
            }
            .frame(width: 278, alignment: .leading)
        }
    }

    private var summaryGrid: some View {
        HStack(spacing: 8) {
            Metric(label: "最低额度", value: snapshot.summary.lowestQuota, color: snapshot.summary.lowestQuota.hasPrefix("--") ? muted : bad)
            Metric(label: "风险账号", value: snapshot.summary.riskAccounts, color: warn)
            Metric(label: "总余额", value: snapshot.summary.totalBalance, color: ink)
            Metric(label: "刷新", value: snapshot.summary.refreshLabel, color: good)
        }
        .padding(.vertical, 2)
    }

    @ViewBuilder
    private var resourcesList: some View {
        if snapshot.resources.isEmpty {
            ResourceRow(
                resource: Resource(),
                toneColor: muted
            )
        } else {
            ForEach(snapshot.resources) { resource in
                ResourceRow(resource: resource, toneColor: toneColor(resource.tone))
            }
        }
    }

    private var balanceRows: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text("余额")
                    .fontWeight(.heavy)
                Spacer()
                Text("sources")
                    .fontWeight(.heavy)
            }
            .font(.system(size: 11, weight: .heavy, design: .monospaced))

            let rows = snapshot.balances.isEmpty ? [Balance()] : snapshot.balances
            ForEach(rows) { balance in
                HStack {
                    Text(balance.label)
                        .foregroundStyle(muted)
                        .lineLimit(1)
                    Spacer()
                    Text(balance.value)
                        .fontWeight(.heavy)
                        .lineLimit(1)
                }
                .font(.system(size: 10, weight: .regular, design: .monospaced))
            }
        }
    }

    private var statusRows: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(statusText.isEmpty ? "GetTokens" : statusText)
            Text(portText(from: statusText))
        }
        .font(.system(size: 10, weight: .regular, design: .monospaced))
        .foregroundStyle(muted)
        .lineLimit(1)
    }

    private var actions: some View {
        HStack(spacing: 8) {
            Button(action: openWindow) {
                Text("打开账号池")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(ReceiptButtonStyle(primary: true))

            Button(action: refreshSnapshot) {
                Text("刷新额度")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(ReceiptButtonStyle(primary: false))
        }
        .font(.system(size: 12, weight: .heavy, design: .monospaced))
    }

    private var footer: some View {
        Text("quota + balance only / sidecar ready")
            .frame(maxWidth: .infinity)
            .font(.system(size: 9, weight: .regular, design: .monospaced))
            .foregroundStyle(muted)
    }

    private func toneColor(_ tone: String) -> Color {
        if tone == "bad" { return bad }
        if tone == "warn" { return warn }
        if tone == "good" { return good }
        return muted
    }

    private func portText(from status: String) -> String {
        guard let suffix = status.split(separator: ":").last,
              !suffix.isEmpty,
              suffix.allSatisfy({ $0.isNumber }) else {
            return "sidecar port: pending"
        }
        return "sidecar port: \(suffix)"
    }
}

private struct Rule: View {
    var body: some View {
        Canvas { context, size in
            var path = Path()
            path.move(to: .init(x: 0, y: 0.5))
            path.addLine(to: .init(x: size.width, y: 0.5))
            context.stroke(path, with: .color(Color(red: 36 / 255, green: 35 / 255, blue: 31 / 255)), style: StrokeStyle(lineWidth: 1, dash: [4, 3]))
        }
        .frame(width: popoverWidth, height: 1)
        .offset(x: -22)
    }
}

private struct PixelKey: View {
    private let ink = Color(red: 27 / 255, green: 26 / 255, blue: 23 / 255)
    private let paperDeep = Color(red: 233 / 255, green: 227 / 255, blue: 212 / 255)

    var body: some View {
        ZStack {
            paperDeep
            Rectangle().fill(ink).frame(width: 22, height: 8).offset(x: -8, y: 4)
            Rectangle().fill(ink).frame(width: 8, height: 22).offset(x: 4, y: 1)
            Rectangle().fill(ink).frame(width: 8, height: 8).offset(x: 12, y: -10)
            Rectangle().fill(ink).frame(width: 8, height: 8).offset(x: 12, y: 12)
            Rectangle().fill(ink).frame(width: 7, height: 16).offset(x: 20, y: 2)
            Rectangle().fill(ink).frame(width: 7, height: 7).offset(x: -11, y: 13)
        }
        .frame(width: 56, height: 56)
        .border(ink, width: 2)
        .rotationEffect(.degrees(-12))
    }
}

private struct Metric: View {
    let label: String
    let value: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(label)
                .font(.system(size: 9, weight: .regular, design: .monospaced))
                .foregroundStyle(Color(red: 109 / 255, green: 103 / 255, blue: 93 / 255))
                .lineLimit(1)
            Text(value)
                .font(.system(size: 16, weight: .heavy, design: .monospaced))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.75)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct ResourceRow: View {
    let resource: Resource
    let toneColor: Color

    private let ink = Color(red: 27 / 255, green: 26 / 255, blue: 23 / 255)
    private let muted = Color(red: 109 / 255, green: 103 / 255, blue: 93 / 255)

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .bottom) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(resource.name)
                        .font(.system(size: 12, weight: .heavy, design: .monospaced))
                        .lineLimit(1)
                    Text(resource.detail)
                        .font(.system(size: 9, weight: .regular, design: .monospaced))
                        .foregroundStyle(muted)
                        .lineLimit(1)
                }
                Spacer(minLength: 10)
                VStack(alignment: .trailing, spacing: 1) {
                    Text(resource.percentText)
                        .font(.system(size: 20, weight: .heavy, design: .monospaced))
                        .foregroundStyle(toneColor)
                    Text("剩余额度")
                        .font(.system(size: 8, weight: .regular, design: .monospaced))
                        .foregroundStyle(muted)
                }
                .frame(width: 62)
            }

            HStack(spacing: 8) {
                GeometryReader { proxy in
                    ZStack(alignment: .leading) {
                        Rectangle()
                            .fill(Color.white.opacity(0.3))
                            .border(ink, width: 1)
                        Rectangle()
                            .fill(toneColor)
                            .frame(width: max(1, proxy.size.width * resource.percent))
                            .padding(1)
                    }
                }
                .frame(height: 7)

                Text(resource.window)
                    .font(.system(size: 9, weight: .heavy, design: .monospaced))
                    .foregroundStyle(muted)
                    .frame(width: 30, alignment: .trailing)
            }

            HStack(spacing: 8) {
                Text(resource.balance)
                    .font(.system(size: 9, weight: .heavy, design: .monospaced))
                    .lineLimit(1)
                Spacer()
                Text(resource.state)
                    .font(.system(size: 8, weight: .regular, design: .monospaced))
                    .padding(.horizontal, 7)
                    .frame(height: 16)
                    .background(Color.white.opacity(0.24))
                    .border(ink, width: 1)
            }
        }
    }
}

private struct ReceiptButtonStyle: ButtonStyle {
    let primary: Bool
    private let ink = Color(red: 27 / 255, green: 26 / 255, blue: 23 / 255)
    private let paper = Color(red: 244 / 255, green: 241 / 255, blue: 233 / 255)

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .frame(height: 36)
            .foregroundStyle(primary ? paper : ink)
            .background(primary ? ink : Color.white.opacity(0.24))
            .border(ink, width: 1)
            .opacity(configuration.isPressed ? 0.72 : 1)
    }
}

public typealias GetTokensMenuBarAction = @convention(c) () -> Void

@_cdecl("GetTokensMenuBarCreateSwiftUIViewController")
public func GetTokensMenuBarCreateSwiftUIViewController(
    _ statusCString: UnsafePointer<CChar>?,
    _ displayNameCString: UnsafePointer<CChar>?,
    _ snapshotCString: UnsafePointer<CChar>?,
    _ openWindow: GetTokensMenuBarAction?,
    _ refreshSnapshot: GetTokensMenuBarAction?
) -> UnsafeMutableRawPointer? {
    let status = statusCString.map { String(cString: $0) } ?? "GetTokens"
    let displayName = displayNameCString.map { String(cString: $0) } ?? "GetTokens"
    let snapshotJSON = snapshotCString.map { String(cString: $0) } ?? ""
    let view = MenuBarPopoverView(
        displayName: displayName,
        statusText: status,
        snapshot: snapshotFromJSON(snapshotJSON),
        openWindow: { openWindow?() },
        refreshSnapshot: { refreshSnapshot?() }
    )
    let controller = NSHostingController(rootView: view)
    controller.view.frame = NSRect(x: 0, y: 0, width: popoverWidth, height: popoverHeight)
    return Unmanaged.passRetained(controller).toOpaque()
}
