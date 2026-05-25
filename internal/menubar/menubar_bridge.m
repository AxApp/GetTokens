#import "menubar_bridge.h"
#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#import <dispatch/dispatch.h>

extern void gettokensMenuBarOpenWindow(void);
extern void gettokensMenuBarCheckForUpdates(void);
extern void gettokensMenuBarQuit(void);

@interface GetTokensMenuBarTarget : NSObject
- (void)openWindow:(id)sender;
- (void)checkForUpdates:(id)sender;
- (void)quit:(id)sender;
@end

@implementation GetTokensMenuBarTarget
- (void)openWindow:(id)sender {
    gettokensMenuBarOpenWindow();
}

- (void)checkForUpdates:(id)sender {
    gettokensMenuBarCheckForUpdates();
}

- (void)quit:(id)sender {
    gettokensMenuBarQuit();
}
@end

static NSStatusItem *statusItem = nil;
static GetTokensMenuBarTarget *target = nil;
static NSMenuItem *statusMenuItem = nil;

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

static void rebuild_menu(NSString *statusText) {
    if (target == nil) {
        target = [GetTokensMenuBarTarget new];
    }
    NSMenu *menu = [NSMenu new];

    statusMenuItem = [[NSMenuItem alloc] initWithTitle:statusText action:nil keyEquivalent:@""];
    [statusMenuItem setEnabled:NO];
    [menu addItem:statusMenuItem];
    [menu addItem:[NSMenuItem separatorItem]];

    NSMenuItem *openItem = [[NSMenuItem alloc] initWithTitle:@"打开 GetTokens" action:@selector(openWindow:) keyEquivalent:@""];
    [openItem setTarget:target];
    [menu addItem:openItem];

    NSMenuItem *updateItem = [[NSMenuItem alloc] initWithTitle:@"检查更新..." action:@selector(checkForUpdates:) keyEquivalent:@""];
    [updateItem setTarget:target];
    [menu addItem:updateItem];

    [menu addItem:[NSMenuItem separatorItem]];
    NSMenuItem *quitItem = [[NSMenuItem alloc] initWithTitle:@"退出 GetTokens" action:@selector(quit:) keyEquivalent:@""];
    [quitItem setTarget:target];
    [menu addItem:quitItem];

    [statusItem setMenu:menu];
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
    statusItem.button.imagePosition = NSImageOnly;
    statusItem.button.title = @"";
    [icon release];
}

void GetTokensMenuBarStart(const char *statusText) {
    NSString *status = string_from_c(statusText);
    run_on_main_async(^{
        if (statusItem == nil) {
            statusItem = [[NSStatusBar systemStatusBar] statusItemWithLength:NSSquareStatusItemLength];
            statusItem.button.toolTip = @"GetTokens";
        }
        rebuild_menu(status);
    });
}

void GetTokensMenuBarStop(void) {
    run_on_main_async(^{
        if (statusItem != nil) {
            [[NSStatusBar systemStatusBar] removeStatusItem:statusItem];
            statusItem = nil;
            statusMenuItem = nil;
        }
    });
}

void GetTokensMenuBarSetStatus(const char *statusText) {
    NSString *status = string_from_c(statusText);
    run_on_main_async(^{
        if (statusMenuItem != nil) {
            [statusMenuItem setTitle:status];
        }
    });
}

void GetTokensMenuBarSetIcon(const unsigned char *data, size_t length) {
    if (data == NULL || length == 0) {
        return;
    }
    NSData *iconData = [NSData dataWithBytes:data length:length];
    run_on_main_async(^{
        install_menu_bar_icon(iconData);
    });
}
