#import "menubar_bridge.h"
#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#import <QuartzCore/QuartzCore.h>
#import <dispatch/dispatch.h>
#import <dlfcn.h>
#import <stdlib.h>

extern void gettokensMenuBarOpenWindow(void);
extern void gettokensMenuBarRefreshSnapshot(void);
extern void gettokensMenuBarQuit(void);

@class GetTokensMenuBarTarget;

static NSStatusItem *statusItem = nil;
static GetTokensMenuBarTarget *target = nil;
static NSPopover *popover = nil;
static NSTextField *titleLabel = nil;
static NSTextField *statusLabel = nil;
static NSTextField *portLabel = nil;
static NSString *latestStatusText = nil;
static NSString *latestDisplayName = nil;
static NSDictionary *latestQuotaSnapshot = nil;
static void *swiftUIPopoverHandle = NULL;

typedef void (*GetTokensSwiftUIActionFn)(void);
typedef void *(*GetTokensCreateSwiftUIViewControllerFn)(
    const char *statusText,
    const char *displayName,
    const char *snapshotJSON,
    GetTokensSwiftUIActionFn openWindow,
    GetTokensSwiftUIActionFn refreshSnapshot
);

static const CGFloat kPopoverWidth = 392.0;
static const CGFloat kPopoverContentWidth = 348.0;
static const CGFloat kPopoverHorizontalInset = 22.0;
static const CGFloat kPopoverHeight = 560.0;

static void show_popover(void);
static void update_status_item_presentation(void);

static void swiftui_open_window_callback(void) {
    if (popover != nil) {
        [popover performClose:nil];
    }
    gettokensMenuBarOpenWindow();
}

static void swiftui_refresh_snapshot_callback(void) {
    if (popover != nil) {
        [popover performClose:nil];
    }
    gettokensMenuBarRefreshSnapshot();
}

@interface GetTokensMenuBarTarget : NSObject
- (void)togglePopover:(id)sender;
- (void)openWindow:(id)sender;
- (void)refreshSnapshot:(id)sender;
- (void)quit:(id)sender;
@end

@implementation GetTokensMenuBarTarget
- (void)togglePopover:(id)sender {
    if (statusItem == nil || statusItem.button == nil) {
        return;
    }
    if (popover != nil && [popover isShown]) {
        [popover performClose:sender];
        return;
    }
    show_popover();
}

- (void)openWindow:(id)sender {
    if (popover != nil) {
        [popover performClose:sender];
    }
    gettokensMenuBarOpenWindow();
}

- (void)refreshSnapshot:(id)sender {
    if (popover != nil) {
        [popover performClose:sender];
    }
    gettokensMenuBarRefreshSnapshot();
}

- (void)quit:(id)sender {
    if (popover != nil) {
        [popover performClose:sender];
    }
    gettokensMenuBarQuit();
}
@end

static void run_on_main_async(dispatch_block_t block) {
    if ([NSThread isMainThread]) {
        block();
    } else {
        dispatch_async(dispatch_get_main_queue(), block);
    }
}

static NSString *string_from_c(const char *value) {
    if (value == NULL) {
        return @"GetTokens";
    }
    return [NSString stringWithUTF8String:value] ?: @"GetTokens";
}

static NSColor *popover_color(CGFloat red, CGFloat green, CGFloat blue, CGFloat alpha) {
    return [NSColor colorWithCalibratedRed:red / 255.0 green:green / 255.0 blue:blue / 255.0 alpha:alpha];
}

static NSColor *paper_color(void) {
    return popover_color(244, 241, 233, 1.0);
}

static NSColor *paper_deep_color(void) {
    return popover_color(233, 227, 212, 1.0);
}

static NSColor *ink_color(void) {
    return popover_color(27, 26, 23, 1.0);
}

static NSColor *muted_color(void) {
    return popover_color(109, 103, 93, 1.0);
}

static NSColor *line_color(void) {
    return popover_color(36, 35, 31, 1.0);
}

static NSColor *bad_color(void) {
    return popover_color(106, 44, 49, 1.0);
}

static NSColor *warn_color(void) {
    return popover_color(118, 85, 31, 1.0);
}

static NSColor *good_color(void) {
    return popover_color(41, 75, 61, 1.0);
}

static void constrain_width(NSView *view, CGFloat width) {
    [view.widthAnchor constraintEqualToConstant:width].active = YES;
}

static NSFont *popover_mono_font_weight(CGFloat size, NSFontWeight weight);

static NSButton *popover_button(NSString *title, SEL action, BOOL primary) {
    if (target == nil) {
        target = [GetTokensMenuBarTarget new];
    }
    NSButton *button = [NSButton buttonWithTitle:title target:target action:action];
    button.bezelStyle = NSBezelStyleShadowlessSquare;
    button.bordered = NO;
    button.wantsLayer = YES;
    button.layer.backgroundColor = primary ? [ink_color() CGColor] : [[NSColor colorWithCalibratedWhite:1.0 alpha:0.24] CGColor];
    button.layer.borderColor = [line_color() CGColor];
    button.layer.borderWidth = 1.0;
    button.layer.cornerRadius = 0.0;
    NSFont *font = popover_mono_font_weight(12.0, NSFontWeightHeavy);
    NSDictionary *attrs = @{
        NSFontAttributeName: font,
        NSForegroundColorAttributeName: primary ? paper_color() : ink_color()
    };
    button.attributedTitle = [[[NSAttributedString alloc] initWithString:title attributes:attrs] autorelease];
    button.attributedAlternateTitle = button.attributedTitle;
    button.font = font;
    button.translatesAutoresizingMaskIntoConstraints = NO;
    return button;
}

static NSTextField *popover_label(NSString *text, NSFont *font, NSColor *color) {
    NSTextField *label = [NSTextField labelWithString:text];
    label.font = font;
    label.textColor = color;
    label.lineBreakMode = NSLineBreakByTruncatingTail;
    label.translatesAutoresizingMaskIntoConstraints = NO;
    return label;
}

static NSFont *popover_mono_font(CGFloat size) {
    return [NSFont userFixedPitchFontOfSize:size] ?: [NSFont systemFontOfSize:size];
}

static NSFont *popover_mono_font_weight(CGFloat size, NSFontWeight weight) {
    if (@available(macOS 10.15, *)) {
        return [NSFont monospacedSystemFontOfSize:size weight:weight];
    }
    NSFont *base = [NSFont userFixedPitchFontOfSize:size];
    if (base != nil) {
        return [[NSFontManager sharedFontManager] convertFont:base toHaveTrait:NSBoldFontMask] ?: base;
    }
    return [NSFont systemFontOfSize:size weight:weight];
}

static NSString *port_text_from_status(NSString *statusText) {
    NSRange range = [statusText rangeOfString:@":" options:NSBackwardsSearch];
    if (range.location == NSNotFound || range.location + 1 >= [statusText length]) {
        return @"sidecar port: pending";
    }
    NSString *suffix = [statusText substringFromIndex:range.location + 1];
    NSCharacterSet *digits = [NSCharacterSet decimalDigitCharacterSet];
    if ([suffix rangeOfCharacterFromSet:[digits invertedSet]].location != NSNotFound) {
        return @"sidecar port: pending";
    }
    return [NSString stringWithFormat:@"sidecar port: %@", suffix];
}

static NSString *snapshot_string(NSDictionary *dict, NSString *key, NSString *fallback) {
    id value = dict == nil ? nil : dict[key];
    if ([value isKindOfClass:[NSString class]] && [(NSString *)value length] > 0) {
        return (NSString *)value;
    }
    if ([value respondsToSelector:@selector(stringValue)]) {
        NSString *stringValue = [value stringValue];
        if ([stringValue length] > 0) {
            return stringValue;
        }
    }
    return fallback;
}

static NSArray *snapshot_array(NSDictionary *dict, NSString *key) {
    id value = dict == nil ? nil : dict[key];
    if ([value isKindOfClass:[NSArray class]]) {
        return (NSArray *)value;
    }
    return @[];
}

static NSDictionary *snapshot_dict(NSDictionary *dict, NSString *key) {
    id value = dict == nil ? nil : dict[key];
    if ([value isKindOfClass:[NSDictionary class]]) {
        return (NSDictionary *)value;
    }
    return nil;
}

static NSColor *snapshot_tone_color(NSString *tone) {
    if ([tone isEqualToString:@"bad"]) {
        return bad_color();
    }
    if ([tone isEqualToString:@"warn"]) {
        return warn_color();
    }
    if ([tone isEqualToString:@"good"]) {
        return good_color();
    }
    return muted_color();
}

static CGFloat snapshot_percent(NSDictionary *dict, NSString *key, CGFloat fallback) {
    id value = dict == nil ? nil : dict[key];
    CGFloat percent = fallback;
    if ([value respondsToSelector:@selector(doubleValue)]) {
        percent = [value doubleValue];
    }
    if (percent < 0.0) {
        return 0.0;
    }
    if (percent > 1.0) {
        return 1.0;
    }
    return percent;
}

static NSString *snapshot_json_string(void) {
    if (latestQuotaSnapshot == nil) {
        return @"";
    }
    NSData *data = [NSJSONSerialization dataWithJSONObject:latestQuotaSnapshot options:0 error:nil];
    if ([data length] == 0) {
        return @"";
    }
    return [[[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding] autorelease] ?: @"";
}

static NSString *swiftui_popover_library_path(void) {
    const char *envPath = getenv("GETTOKENS_MENUBAR_SWIFTUI_DYLIB");
    if (envPath != NULL && envPath[0] != '\0') {
        NSString *path = [NSString stringWithUTF8String:envPath];
        if ([[NSFileManager defaultManager] fileExistsAtPath:path]) {
            return path;
        }
    }
    NSString *frameworkPath = [[NSBundle mainBundle] privateFrameworksPath];
    if ([frameworkPath length] > 0) {
        NSString *bundled = [frameworkPath stringByAppendingPathComponent:@"libGetTokensMenuBarSwiftUI.dylib"];
        if ([[NSFileManager defaultManager] fileExistsAtPath:bundled]) {
            return bundled;
        }
    }
    NSString *resourcePath = [[NSBundle mainBundle] resourcePath];
    if ([resourcePath length] > 0) {
        NSString *bundled = [resourcePath stringByAppendingPathComponent:@"libGetTokensMenuBarSwiftUI.dylib"];
        if ([[NSFileManager defaultManager] fileExistsAtPath:bundled]) {
            return bundled;
        }
    }
    return nil;
}

static NSViewController *swiftui_popover_controller(void) {
    NSString *path = swiftui_popover_library_path();
    if ([path length] == 0) {
        return nil;
    }
    if (swiftUIPopoverHandle == NULL) {
        swiftUIPopoverHandle = dlopen([path fileSystemRepresentation], RTLD_NOW | RTLD_LOCAL);
    }
    if (swiftUIPopoverHandle == NULL) {
        return nil;
    }
    GetTokensCreateSwiftUIViewControllerFn create = (GetTokensCreateSwiftUIViewControllerFn)dlsym(swiftUIPopoverHandle, "GetTokensMenuBarCreateSwiftUIViewController");
    if (create == NULL) {
        return nil;
    }
    NSString *status = latestStatusText ?: @"GetTokens";
    NSString *displayName = latestDisplayName ?: @"GetTokens";
    NSString *snapshotJSON = snapshot_json_string();
    void *raw = create(
        [status UTF8String],
        [displayName UTF8String],
        [snapshotJSON UTF8String],
        swiftui_open_window_callback,
        swiftui_refresh_snapshot_callback
    );
    if (raw == NULL) {
        return nil;
    }
    return [(NSViewController *)raw autorelease];
}

static void reset_popover(void) {
    if (popover != nil) {
        [popover performClose:nil];
        [popover release];
        popover = nil;
    }
    if (statusLabel != nil) {
        [statusLabel release];
        statusLabel = nil;
    }
    if (titleLabel != nil) {
        [titleLabel release];
        titleLabel = nil;
    }
    if (portLabel != nil) {
        [portLabel release];
        portLabel = nil;
    }
}

static NSView *receipt_rule(void) {
    NSView *rule = [[[NSView alloc] initWithFrame:NSZeroRect] autorelease];
    rule.wantsLayer = YES;
    CAShapeLayer *dash = [CAShapeLayer layer];
    dash.strokeColor = [line_color() CGColor];
    dash.lineWidth = 1.0;
    dash.lineDashPattern = @[@4, @3];
    dash.frame = CGRectMake(-kPopoverHorizontalInset, 0.0, kPopoverWidth, 1.0);
    CGMutablePathRef path = CGPathCreateMutable();
    CGPathMoveToPoint(path, NULL, 0.0, 0.5);
    CGPathAddLineToPoint(path, NULL, kPopoverWidth, 0.5);
    dash.path = path;
    CGPathRelease(path);
    [rule.layer addSublayer:dash];
    rule.translatesAutoresizingMaskIntoConstraints = NO;
    [rule.heightAnchor constraintEqualToConstant:1.0].active = YES;
    constrain_width(rule, kPopoverContentWidth);
    return rule;
}

static NSView *pixel_block(CGFloat x, CGFloat y, CGFloat width, CGFloat height) {
    NSView *block = [[[NSView alloc] initWithFrame:NSZeroRect] autorelease];
    block.wantsLayer = YES;
    block.layer.backgroundColor = [ink_color() CGColor];
    block.translatesAutoresizingMaskIntoConstraints = NO;
    [NSLayoutConstraint activateConstraints:@[
        [block.widthAnchor constraintEqualToConstant:width],
        [block.heightAnchor constraintEqualToConstant:height]
    ]];
    return block;
}

static NSView *pixel_key_view(void) {
    NSView *box = [[[NSView alloc] initWithFrame:NSZeroRect] autorelease];
    box.wantsLayer = YES;
    box.layer.backgroundColor = [paper_deep_color() CGColor];
    box.layer.borderColor = [line_color() CGColor];
    box.layer.borderWidth = 2.0;
    box.translatesAutoresizingMaskIntoConstraints = NO;
    [NSLayoutConstraint activateConstraints:@[
        [box.widthAnchor constraintEqualToConstant:56.0],
        [box.heightAnchor constraintEqualToConstant:56.0]
    ]];

    NSArray *blocks = @[
        @{@"x": @11.0, @"y": @27.0, @"w": @22.0, @"h": @8.0},
        @{@"x": @28.0, @"y": @20.0, @"w": @8.0, @"h": @22.0},
        @{@"x": @36.0, @"y": @17.0, @"w": @8.0, @"h": @8.0},
        @{@"x": @36.0, @"y": @39.0, @"w": @8.0, @"h": @8.0},
        @{@"x": @43.0, @"y": @24.0, @"w": @7.0, @"h": @16.0},
        @{@"x": @15.0, @"y": @40.0, @"w": @7.0, @"h": @7.0}
    ];
    for (NSDictionary *blockSpec in blocks) {
        NSView *block = pixel_block(0, 0, [blockSpec[@"w"] doubleValue], [blockSpec[@"h"] doubleValue]);
        [box addSubview:block];
        [NSLayoutConstraint activateConstraints:@[
            [block.leadingAnchor constraintEqualToAnchor:box.leadingAnchor constant:[blockSpec[@"x"] doubleValue]],
            [block.topAnchor constraintEqualToAnchor:box.topAnchor constant:[blockSpec[@"y"] doubleValue]]
        ]];
    }
    return box;
}

static NSView *metric_view(NSString *label, NSString *value, NSColor *tone) {
    NSStackView *metric = [NSStackView stackViewWithViews:@[]];
    metric.orientation = NSUserInterfaceLayoutOrientationVertical;
    metric.alignment = NSLayoutAttributeLeading;
    metric.spacing = 3.0;
    metric.translatesAutoresizingMaskIntoConstraints = NO;
    NSTextField *labelView = popover_label(label, popover_mono_font(9.0), muted_color());
    NSTextField *valueView = popover_label(value, popover_mono_font(16.0), tone);
    valueView.font = popover_mono_font_weight(16.0, NSFontWeightHeavy);
    [metric addArrangedSubview:labelView];
    [metric addArrangedSubview:valueView];
    return metric;
}

static NSView *summary_view(void) {
    NSDictionary *summaryData = snapshot_dict(latestQuotaSnapshot, @"summary");
    NSStackView *summary = [NSStackView stackViewWithViews:@[]];
    summary.orientation = NSUserInterfaceLayoutOrientationHorizontal;
    summary.distribution = NSStackViewDistributionFillEqually;
    summary.alignment = NSLayoutAttributeTop;
    summary.spacing = 8.0;
    summary.translatesAutoresizingMaskIntoConstraints = NO;
    NSString *lowest = snapshot_string(summaryData, @"lowestQuota", @"--%");
    [summary addArrangedSubview:metric_view(@"最低额度", lowest, [lowest hasPrefix:@"--"] ? muted_color() : bad_color())];
    [summary addArrangedSubview:metric_view(@"风险账号", snapshot_string(summaryData, @"riskAccounts", @"--"), warn_color())];
    [summary addArrangedSubview:metric_view(@"总余额", snapshot_string(summaryData, @"totalBalance", @"--"), ink_color())];
    [summary addArrangedSubview:metric_view(@"刷新", snapshot_string(summaryData, @"refreshLabel", @"--:--"), good_color())];
    constrain_width(summary, kPopoverContentWidth);
    return summary;
}

static BOOL snapshot_has_runtime_data(void) {
    return [snapshot_array(latestQuotaSnapshot, @"resources") count] > 0 || [snapshot_array(latestQuotaSnapshot, @"balances") count] > 0;
}

static NSView *progress_track(CGFloat percent, NSColor *tone) {
    NSView *track = [[[NSView alloc] initWithFrame:NSZeroRect] autorelease];
    track.wantsLayer = YES;
    track.layer.backgroundColor = [[NSColor colorWithCalibratedWhite:1.0 alpha:0.30] CGColor];
    track.layer.borderColor = [line_color() CGColor];
    track.layer.borderWidth = 1.0;
    track.translatesAutoresizingMaskIntoConstraints = NO;
    [track.heightAnchor constraintEqualToConstant:7.0].active = YES;

    NSView *fill = [[[NSView alloc] initWithFrame:NSZeroRect] autorelease];
    fill.wantsLayer = YES;
    fill.layer.backgroundColor = [tone CGColor];
    fill.translatesAutoresizingMaskIntoConstraints = NO;
    [track addSubview:fill];
    [NSLayoutConstraint activateConstraints:@[
        [fill.leadingAnchor constraintEqualToAnchor:track.leadingAnchor constant:1.0],
        [fill.topAnchor constraintEqualToAnchor:track.topAnchor constant:1.0],
        [fill.bottomAnchor constraintEqualToAnchor:track.bottomAnchor constant:-1.0],
        [fill.widthAnchor constraintEqualToAnchor:track.widthAnchor multiplier:percent]
    ]];
    return track;
}

static NSView *status_chip(NSString *text) {
    NSTextField *chip = popover_label(text, popover_mono_font(8.0), ink_color());
    chip.alignment = NSTextAlignmentCenter;
    chip.wantsLayer = YES;
    chip.layer.backgroundColor = [[NSColor colorWithCalibratedWhite:1.0 alpha:0.24] CGColor];
    chip.layer.borderColor = [line_color() CGColor];
    chip.layer.borderWidth = 1.0;
    chip.translatesAutoresizingMaskIntoConstraints = NO;
    [chip.heightAnchor constraintEqualToConstant:16.0].active = YES;
    [chip.widthAnchor constraintGreaterThanOrEqualToConstant:46.0].active = YES;
    return chip;
}

static NSView *resource_row(NSString *name, NSString *detail, NSString *percentText, CGFloat percent, NSString *windowText, NSString *balance, NSString *state, NSColor *tone) {
    NSStackView *row = [NSStackView stackViewWithViews:@[]];
    row.orientation = NSUserInterfaceLayoutOrientationVertical;
    row.alignment = NSLayoutAttributeLeading;
    row.spacing = 6.0;
    row.translatesAutoresizingMaskIntoConstraints = NO;

    NSStackView *top = [NSStackView stackViewWithViews:@[]];
    top.orientation = NSUserInterfaceLayoutOrientationHorizontal;
    top.alignment = NSLayoutAttributeBottom;
    top.spacing = 10.0;
    top.translatesAutoresizingMaskIntoConstraints = NO;

    NSStackView *main = [NSStackView stackViewWithViews:@[]];
    main.orientation = NSUserInterfaceLayoutOrientationVertical;
    main.alignment = NSLayoutAttributeLeading;
    main.spacing = 3.0;
    main.translatesAutoresizingMaskIntoConstraints = NO;
    NSTextField *nameLabel = popover_label(name, popover_mono_font(12.0), ink_color());
    nameLabel.font = popover_mono_font_weight(12.0, NSFontWeightHeavy);
    NSTextField *detailLabel = popover_label(detail, popover_mono_font(9.0), muted_color());
    [main addArrangedSubview:nameLabel];
    [main addArrangedSubview:detailLabel];

    NSStackView *quota = [NSStackView stackViewWithViews:@[]];
    quota.orientation = NSUserInterfaceLayoutOrientationVertical;
    quota.alignment = NSLayoutAttributeTrailing;
    quota.spacing = 1.0;
    quota.translatesAutoresizingMaskIntoConstraints = NO;
    NSTextField *percentLabel = popover_label(percentText, popover_mono_font(20.0), tone);
    percentLabel.font = popover_mono_font_weight(20.0, NSFontWeightHeavy);
    NSTextField *quotaLabel = popover_label(@"剩余额度", popover_mono_font(8.0), muted_color());
    quotaLabel.alignment = NSTextAlignmentRight;
    [quota addArrangedSubview:percentLabel];
    [quota addArrangedSubview:quotaLabel];

    [top addArrangedSubview:main];
    [top addArrangedSubview:quota];
    [main.widthAnchor constraintGreaterThanOrEqualToConstant:210.0].active = YES;
    [quota.widthAnchor constraintEqualToConstant:62.0].active = YES;

    NSStackView *meter = [NSStackView stackViewWithViews:@[]];
    meter.orientation = NSUserInterfaceLayoutOrientationHorizontal;
    meter.alignment = NSLayoutAttributeCenterY;
    meter.spacing = 8.0;
    meter.translatesAutoresizingMaskIntoConstraints = NO;
    NSView *track = progress_track(percent, tone);
    NSTextField *windowLabel = popover_label(windowText, popover_mono_font(9.0), muted_color());
    windowLabel.font = popover_mono_font_weight(9.0, NSFontWeightHeavy);
    [meter addArrangedSubview:track];
    [meter addArrangedSubview:windowLabel];
    [track.widthAnchor constraintGreaterThanOrEqualToConstant:264.0].active = YES;

    NSStackView *meta = [NSStackView stackViewWithViews:@[]];
    meta.orientation = NSUserInterfaceLayoutOrientationHorizontal;
    meta.distribution = NSStackViewDistributionFill;
    meta.alignment = NSLayoutAttributeCenterY;
    meta.spacing = 8.0;
    meta.translatesAutoresizingMaskIntoConstraints = NO;
    NSTextField *balanceLabel = popover_label(balance, popover_mono_font(9.0), ink_color());
    balanceLabel.font = popover_mono_font_weight(9.0, NSFontWeightHeavy);
    [meta addArrangedSubview:balanceLabel];
    [meta addArrangedSubview:status_chip(state)];
    [balanceLabel.widthAnchor constraintGreaterThanOrEqualToConstant:230.0].active = YES;

    [row addArrangedSubview:top];
    [row addArrangedSubview:meter];
    [row addArrangedSubview:meta];
    constrain_width(top, kPopoverContentWidth);
    constrain_width(meter, kPopoverContentWidth);
    constrain_width(meta, kPopoverContentWidth);
    constrain_width(row, kPopoverContentWidth);
    return row;
}

static NSView *empty_resource_row(void) {
    NSStackView *row = [NSStackView stackViewWithViews:@[]];
    row.orientation = NSUserInterfaceLayoutOrientationVertical;
    row.alignment = NSLayoutAttributeLeading;
    row.spacing = 7.0;
    row.translatesAutoresizingMaskIntoConstraints = NO;

    NSStackView *top = [NSStackView stackViewWithViews:@[]];
    top.orientation = NSUserInterfaceLayoutOrientationHorizontal;
    top.distribution = NSStackViewDistributionFill;
    top.alignment = NSLayoutAttributeCenterY;
    top.spacing = 8.0;
    top.translatesAutoresizingMaskIntoConstraints = NO;

    NSTextField *name = popover_label(@"等待账号额度快照", popover_mono_font(12.0), ink_color());
    name.font = popover_mono_font_weight(12.0, NSFontWeightHeavy);
    NSTextField *percent = popover_label(@"--%", popover_mono_font(18.0), muted_color());
    percent.font = popover_mono_font_weight(18.0, NSFontWeightHeavy);
    percent.alignment = NSTextAlignmentRight;
    [top addArrangedSubview:name];
    [top addArrangedSubview:percent];
    [name.widthAnchor constraintGreaterThanOrEqualToConstant:244.0].active = YES;
    [percent.widthAnchor constraintEqualToConstant:72.0].active = YES;

    NSTextField *hint = popover_label(@"点击刷新额度后更新", popover_mono_font(10.0), muted_color());
    NSView *track = progress_track(0.0, muted_color());

    NSStackView *meta = [NSStackView stackViewWithViews:@[]];
    meta.orientation = NSUserInterfaceLayoutOrientationHorizontal;
    meta.distribution = NSStackViewDistributionFill;
    meta.alignment = NSLayoutAttributeCenterY;
    meta.spacing = 8.0;
    meta.translatesAutoresizingMaskIntoConstraints = NO;
    NSTextField *left = popover_label(@"-- 余额", popover_mono_font(9.0), ink_color());
    left.font = popover_mono_font_weight(9.0, NSFontWeightHeavy);
    [meta addArrangedSubview:left];
    [meta addArrangedSubview:status_chip(@"待接入")];
    [left.widthAnchor constraintGreaterThanOrEqualToConstant:258.0].active = YES;

    [row addArrangedSubview:top];
    [row addArrangedSubview:hint];
    [row addArrangedSubview:track];
    [row addArrangedSubview:meta];
    constrain_width(top, kPopoverContentWidth);
    constrain_width(hint, kPopoverContentWidth);
    constrain_width(track, kPopoverContentWidth);
    constrain_width(meta, kPopoverContentWidth);
    constrain_width(row, kPopoverContentWidth);
    return row;
}

static NSView *receipt_row(NSString *label, NSString *value) {
    NSStackView *row = [NSStackView stackViewWithViews:@[]];
    row.orientation = NSUserInterfaceLayoutOrientationHorizontal;
    row.distribution = NSStackViewDistributionFill;
    row.alignment = NSLayoutAttributeCenterY;
    row.spacing = 8.0;
    row.translatesAutoresizingMaskIntoConstraints = NO;
    NSTextField *left = popover_label(label, popover_mono_font(10.0), muted_color());
    NSTextField *right = popover_label(value, popover_mono_font(10.0), ink_color());
    right.alignment = NSTextAlignmentRight;
    right.font = popover_mono_font_weight(10.0, NSFontWeightHeavy);
    [row addArrangedSubview:left];
    [row addArrangedSubview:right];
    [left.widthAnchor constraintGreaterThanOrEqualToConstant:210.0].active = YES;
    [right.widthAnchor constraintEqualToConstant:112.0].active = YES;
    constrain_width(row, kPopoverContentWidth);
    return row;
}

static NSView *receipt_header_view(void) {
    NSStackView *header = [NSStackView stackViewWithViews:@[]];
    header.orientation = NSUserInterfaceLayoutOrientationHorizontal;
    header.distribution = NSStackViewDistributionFill;
    header.alignment = NSLayoutAttributeCenterY;
    header.spacing = 8.0;
    header.translatesAutoresizingMaskIntoConstraints = NO;
    NSTextField *left = popover_label(@"余额", popover_mono_font(11.0), ink_color());
    left.font = popover_mono_font_weight(11.0, NSFontWeightHeavy);
    NSTextField *right = popover_label(@"sources", popover_mono_font(11.0), ink_color());
    right.font = popover_mono_font_weight(11.0, NSFontWeightHeavy);
    right.alignment = NSTextAlignmentRight;
    [header addArrangedSubview:left];
    [header addArrangedSubview:right];
    [left.widthAnchor constraintGreaterThanOrEqualToConstant:210.0].active = YES;
    [right.widthAnchor constraintEqualToConstant:112.0].active = YES;
    constrain_width(header, kPopoverContentWidth);
    return header;
}

static void update_popover_labels(NSString *statusText) {
    if (latestStatusText != statusText) {
        [latestStatusText release];
        latestStatusText = [statusText copy];
    }
    update_status_item_presentation();
    if (titleLabel != nil) {
        titleLabel.stringValue = latestDisplayName ?: @"GetTokens";
    }
    if (statusLabel != nil) {
        statusLabel.stringValue = statusText ?: @"GetTokens";
    }
    if (portLabel != nil) {
        portLabel.stringValue = port_text_from_status(statusText ?: @"GetTokens");
    }
}

static void update_status_item_presentation(void) {
    if (statusItem == nil || statusItem.button == nil) {
        return;
    }
    BOOL dev = latestDisplayName != nil && [latestDisplayName rangeOfString:@"Dev" options:NSCaseInsensitiveSearch].location != NSNotFound;
    statusItem.length = dev ? 56.0 : NSSquareStatusItemLength;
    statusItem.button.toolTip = latestDisplayName ?: @"GetTokens";
    statusItem.button.title = dev ? @"DEV" : @"";
    statusItem.button.imagePosition = dev ? NSImageLeft : NSImageOnly;
}

static void ensure_popover(void) {
    if (popover != nil) {
        return;
    }
    NSViewController *swiftUIController = swiftui_popover_controller();
    if (swiftUIController != nil) {
        popover = [NSPopover new];
        popover.behavior = NSPopoverBehaviorTransient;
        popover.contentSize = NSMakeSize(kPopoverWidth, kPopoverHeight);
        popover.contentViewController = swiftUIController;
        return;
    }

    NSViewController *controller = [NSViewController new];
    NSView *root = [[NSView alloc] initWithFrame:NSMakeRect(0, 0, kPopoverWidth, kPopoverHeight)];
    root.wantsLayer = YES;
    root.layer.backgroundColor = [paper_color() CGColor];

    NSStackView *stack = [NSStackView stackViewWithViews:@[]];
    stack.orientation = NSUserInterfaceLayoutOrientationVertical;
    stack.alignment = NSLayoutAttributeLeading;
    stack.spacing = 9.0;
    stack.edgeInsets = NSEdgeInsetsMake(18, 22, 18, 22);
    stack.translatesAutoresizingMaskIntoConstraints = NO;
    [root addSubview:stack];

    NSStackView *bar = [NSStackView stackViewWithViews:@[]];
    bar.orientation = NSUserInterfaceLayoutOrientationHorizontal;
    bar.distribution = NSStackViewDistributionFill;
    bar.alignment = NSLayoutAttributeCenterY;
    bar.spacing = 10.0;
    bar.translatesAutoresizingMaskIntoConstraints = NO;
    NSTextField *brand = popover_label(@"GETTOKENS", popover_mono_font(12.0), ink_color());
    brand.font = popover_mono_font_weight(12.0, NSFontWeightHeavy);
    NSTextField *balance = popover_label(@"BALANCE ::", popover_mono_font(12.0), muted_color());
    balance.alignment = NSTextAlignmentRight;
    [bar addArrangedSubview:brand];
    [bar addArrangedSubview:balance];
    [brand.widthAnchor constraintGreaterThanOrEqualToConstant:160.0].active = YES;
    [balance.widthAnchor constraintEqualToConstant:156.0].active = YES;

    NSStackView *hero = [NSStackView stackViewWithViews:@[]];
    hero.orientation = NSUserInterfaceLayoutOrientationHorizontal;
    hero.alignment = NSLayoutAttributeCenterY;
    hero.spacing = 14.0;
    hero.translatesAutoresizingMaskIntoConstraints = NO;

    NSStackView *heroCopy = [NSStackView stackViewWithViews:@[]];
    heroCopy.orientation = NSUserInterfaceLayoutOrientationVertical;
    heroCopy.alignment = NSLayoutAttributeLeading;
    heroCopy.spacing = 5.0;
    heroCopy.translatesAutoresizingMaskIntoConstraints = NO;
    titleLabel = [popover_label(latestDisplayName ?: @"GetTokens", popover_mono_font(17.0), ink_color()) retain];
    titleLabel.font = popover_mono_font_weight(17.0, NSFontWeightHeavy);
    NSTextField *subtitle = popover_label(@"Quota receipt", popover_mono_font(12.0), ink_color());
    subtitle.font = popover_mono_font_weight(12.0, NSFontWeightHeavy);
    NSTextField *hint = popover_label(snapshot_has_runtime_data() ? @"账号额度快照已接入。" : @"等待账号额度快照", popover_mono_font(11.0), muted_color());
    hint.maximumNumberOfLines = 2;
    hint.lineBreakMode = NSLineBreakByWordWrapping;
    [heroCopy addArrangedSubview:titleLabel];
    [heroCopy addArrangedSubview:subtitle];
    [heroCopy addArrangedSubview:hint];
    [hero addArrangedSubview:pixel_key_view()];
    [hero addArrangedSubview:heroCopy];
    [heroCopy.widthAnchor constraintEqualToConstant:278.0].active = YES;

    [stack addArrangedSubview:bar];
    [stack addArrangedSubview:hero];
    [stack addArrangedSubview:receipt_rule()];
    NSView *summary = summary_view();
    [stack addArrangedSubview:summary];
    [stack addArrangedSubview:receipt_rule()];

    NSArray *resources = snapshot_array(latestQuotaSnapshot, @"resources");
    if ([resources count] == 0) {
        [stack addArrangedSubview:empty_resource_row()];
    } else {
        NSUInteger count = MIN((NSUInteger)3, [resources count]);
        for (NSUInteger index = 0; index < count; index++) {
            NSDictionary *resource = [resources[index] isKindOfClass:[NSDictionary class]] ? resources[index] : nil;
            NSString *toneName = snapshot_string(resource, @"tone", @"muted");
            [stack addArrangedSubview:resource_row(
                snapshot_string(resource, @"name", @"等待账号额度快照"),
                snapshot_string(resource, @"detail", @"点击刷新额度后更新"),
                snapshot_string(resource, @"percentText", @"--%"),
                snapshot_percent(resource, @"percent", 0.0),
                snapshot_string(resource, @"window", @"--"),
                snapshot_string(resource, @"balance", @"-- 余额"),
                snapshot_string(resource, @"state", @"待接入"),
                snapshot_tone_color(toneName)
            )];
        }
    }
    [stack addArrangedSubview:receipt_rule()];

    [stack addArrangedSubview:receipt_header_view()];
    NSArray *balances = snapshot_array(latestQuotaSnapshot, @"balances");
    if ([balances count] == 0) {
        [stack addArrangedSubview:receipt_row(@"Sidecar", @"ready")];
    } else {
        NSUInteger count = MIN((NSUInteger)4, [balances count]);
        for (NSUInteger index = 0; index < count; index++) {
            NSDictionary *balanceItem = [balances[index] isKindOfClass:[NSDictionary class]] ? balances[index] : nil;
            [stack addArrangedSubview:receipt_row(
                snapshot_string(balanceItem, @"label", @"Balance"),
                snapshot_string(balanceItem, @"value", @"--")
            )];
        }
    }
    statusLabel = [popover_label(latestStatusText ?: @"GetTokens", popover_mono_font(10.0), muted_color()) retain];
    portLabel = [popover_label(port_text_from_status(latestStatusText ?: @"GetTokens"), popover_mono_font(10.0), muted_color()) retain];
    constrain_width(statusLabel, kPopoverContentWidth);
    constrain_width(portLabel, kPopoverContentWidth);
    [stack addArrangedSubview:statusLabel];
    [stack addArrangedSubview:portLabel];
    [stack addArrangedSubview:receipt_rule()];

    NSStackView *actions = [NSStackView stackViewWithViews:@[]];
    actions.orientation = NSUserInterfaceLayoutOrientationHorizontal;
    actions.distribution = NSStackViewDistributionFillEqually;
    actions.alignment = NSLayoutAttributeCenterY;
    actions.spacing = 8.0;
    actions.translatesAutoresizingMaskIntoConstraints = NO;
    NSButton *openButton = popover_button(@"打开账号池", @selector(openWindow:), YES);
    NSButton *updateButton = popover_button(@"刷新额度", @selector(refreshSnapshot:), NO);
    [actions addArrangedSubview:openButton];
    [actions addArrangedSubview:updateButton];
    [stack addArrangedSubview:actions];

    NSTextField *footer = popover_label(@"quota + balance only / sidecar ready", popover_mono_font(9.0), muted_color());
    footer.alignment = NSTextAlignmentCenter;
    [stack addArrangedSubview:footer];

    for (NSView *view in @[bar, hero, actions, footer]) {
        constrain_width(view, kPopoverContentWidth);
    }
    [openButton.heightAnchor constraintEqualToConstant:36.0].active = YES;
    [updateButton.heightAnchor constraintEqualToConstant:36.0].active = YES;

    [NSLayoutConstraint activateConstraints:@[
        [stack.leadingAnchor constraintEqualToAnchor:root.leadingAnchor],
        [stack.trailingAnchor constraintEqualToAnchor:root.trailingAnchor],
        [stack.topAnchor constraintEqualToAnchor:root.topAnchor],
        [stack.bottomAnchor constraintLessThanOrEqualToAnchor:root.bottomAnchor]
    ]];

    controller.view = root;
    popover = [NSPopover new];
    popover.behavior = NSPopoverBehaviorTransient;
    popover.contentSize = NSMakeSize(kPopoverWidth, kPopoverHeight);
    popover.contentViewController = controller;
    [root release];
    [controller release];
}

static void show_popover(void) {
    if (statusItem == nil || statusItem.button == nil) {
        return;
    }
    ensure_popover();
    update_popover_labels(latestStatusText ?: @"GetTokens");
    [popover showRelativeToRect:statusItem.button.bounds ofView:statusItem.button preferredEdge:NSRectEdgeMinY];
}

static void install_menu_bar_icon(NSData *iconData) {
    if (statusItem == nil || iconData == nil) {
        return;
    }
    NSImage *icon = [[NSImage alloc] initWithData:iconData];
    if (icon == nil) {
        return;
    }
    [icon setTemplate:YES];
    [icon setSize:NSMakeSize(18.0, 18.0)];
    statusItem.button.image = icon;
    update_status_item_presentation();
    [icon release];
}

void GetTokensMenuBarStart(const char *statusText, const char *displayName) {
    NSString *status = [string_from_c(statusText) copy];
    NSString *name = [string_from_c(displayName) copy];
    run_on_main_async(^{
        if (latestDisplayName != name) {
            [latestDisplayName release];
            latestDisplayName = [name copy];
        }
        update_popover_labels(status);
        if (statusItem == nil) {
            statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSSquareStatusItemLength];
            [statusItem retain];
            statusItem.button.toolTip = latestDisplayName ?: @"GetTokens";
        }
        update_status_item_presentation();
        if (target == nil) {
            target = [GetTokensMenuBarTarget new];
        }
        statusItem.button.target = target;
        statusItem.button.action = @selector(togglePopover:);
        [status release];
        [name release];
    });
}

void GetTokensMenuBarStop(void) {
    run_on_main_async(^{
        if (statusItem != nil) {
            [[NSStatusBar systemStatusBar] removeStatusItem:statusItem];
            [statusItem release];
            statusItem = nil;
        }
        reset_popover();
        if (latestStatusText != nil) {
            [latestStatusText release];
            latestStatusText = nil;
        }
        if (latestDisplayName != nil) {
            [latestDisplayName release];
            latestDisplayName = nil;
        }
        if (latestQuotaSnapshot != nil) {
            [latestQuotaSnapshot release];
            latestQuotaSnapshot = nil;
        }
    });
}

void GetTokensMenuBarSetStatus(const char *statusText) {
    NSString *status = [string_from_c(statusText) copy];
    run_on_main_async(^{
        update_popover_labels(status);
        [status release];
    });
}

void GetTokensMenuBarSetQuotaSnapshot(const char *snapshotJSON) {
    NSString *json = snapshotJSON == NULL ? @"" : ([NSString stringWithUTF8String:snapshotJSON] ?: @"");
    json = [json copy];
    run_on_main_async(^{
        NSDictionary *snapshot = nil;
        NSData *data = [json dataUsingEncoding:NSUTF8StringEncoding];
        if ([data length] > 0) {
            id parsed = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
            if ([parsed isKindOfClass:[NSDictionary class]]) {
                snapshot = (NSDictionary *)parsed;
            }
        }
        [latestQuotaSnapshot release];
        latestQuotaSnapshot = [snapshot copy];
        reset_popover();
        [json release];
    });
}

void GetTokensMenuBarSetIcon(const unsigned char *data, size_t length) {
    if (data == NULL || length == 0) {
        return;
    }
    NSData *iconData = [[NSData alloc] initWithBytes:data length:length];
    run_on_main_async(^{
        install_menu_bar_icon(iconData);
        [iconData release];
    });
}
