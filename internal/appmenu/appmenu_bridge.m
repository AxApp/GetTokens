#import "appmenu_bridge.h"
#import <AppKit/AppKit.h>
#import <dispatch/dispatch.h>

extern void gettokensAppMenuCheckForUpdates(void);

@interface GetTokensAppMenuTarget : NSObject
- (void)checkForUpdates:(id)sender;
@end

@implementation GetTokensAppMenuTarget
- (void)checkForUpdates:(id)sender {
    gettokensAppMenuCheckForUpdates();
}
@end

static GetTokensAppMenuTarget *target = nil;

static void run_on_main_async(dispatch_block_t block) {
    if ([NSThread isMainThread]) {
        block();
    } else {
        dispatch_async(dispatch_get_main_queue(), block);
    }
}

static NSString *string_from_c(const char *value) {
    if (value == NULL) {
        return @"检查更新...";
    }
    return [NSString stringWithUTF8String:value] ?: @"检查更新...";
}

static void install_check_for_updates_item(NSString *itemTitle, NSInteger attempt) {
    NSMenu *mainMenu = [NSApp mainMenu];
    if ((mainMenu == nil || [mainMenu numberOfItems] == 0) && attempt < 10) {
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(100 * NSEC_PER_MSEC)), dispatch_get_main_queue(), ^{
            install_check_for_updates_item(itemTitle, attempt + 1);
        });
        return;
    }
    if (mainMenu == nil || [mainMenu numberOfItems] == 0) {
        return;
    }

    NSMenuItem *appMenuItem = [mainMenu itemAtIndex:0];
    NSMenu *appMenu = [appMenuItem submenu];
    if (appMenu == nil) {
        return;
    }
    if (target == nil) {
        target = [GetTokensAppMenuTarget new];
    }

    for (NSInteger index = [appMenu numberOfItems] - 1; index >= 0; index--) {
        NSMenuItem *item = [appMenu itemAtIndex:index];
        if ([[item title] isEqualToString:itemTitle]) {
            [appMenu removeItemAtIndex:index];
        }
    }

    NSMenuItem *updateItem = [[NSMenuItem alloc] initWithTitle:itemTitle action:@selector(checkForUpdates:) keyEquivalent:@""];
    [updateItem setTarget:target];
    NSInteger insertIndex = MIN(1, [appMenu numberOfItems]);
    [appMenu insertItem:updateItem atIndex:insertIndex];
    [updateItem release];
}

void GetTokensAppMenuInstallCheckForUpdates(const char *title) {
    NSString *itemTitle = string_from_c(title);
    run_on_main_async(^{
        install_check_for_updates_item(itemTitle, 0);
    });
}
