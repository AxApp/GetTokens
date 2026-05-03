#import "sparkle_bridge.h"
#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#import <dispatch/dispatch.h>
#import <objc/message.h>
#import <objc/runtime.h>

static id updaterController = nil;

static void run_on_main_sync(dispatch_block_t block) {
    if ([NSThread isMainThread]) {
        block();
    } else {
        dispatch_sync(dispatch_get_main_queue(), block);
    }
}

static BOOL bundle_has_nonempty_string(NSString *key) {
    id value = [[NSBundle mainBundle] objectForInfoDictionaryKey:key];
    return [value isKindOfClass:[NSString class]] && [(NSString *)value length] > 0;
}

static NSBundle *sparkle_bundle(void) {
    NSURL *frameworkURL = [[NSBundle mainBundle].privateFrameworksURL URLByAppendingPathComponent:@"Sparkle.framework"];
    if (frameworkURL == nil) {
        return nil;
    }
    return [NSBundle bundleWithURL:frameworkURL];
}

static BOOL load_sparkle_framework(void) {
    if (NSClassFromString(@"SPUStandardUpdaterController") != nil) {
        return YES;
    }

    NSBundle *bundle = sparkle_bundle();
    if (bundle == nil) {
        return NO;
    }

    NSError *error = nil;
    BOOL loaded = [bundle loadAndReturnError:&error];
    if (!loaded) {
        NSLog(@"GetTokens Sparkle load failed: %@", error);
        return NO;
    }

    return NSClassFromString(@"SPUStandardUpdaterController") != nil;
}

static id ensure_updater_controller(void) {
    if (updaterController != nil) {
        return updaterController;
    }

    if (!bundle_has_nonempty_string(@"SUFeedURL") || !bundle_has_nonempty_string(@"SUPublicEDKey")) {
        return nil;
    }

    if (!load_sparkle_framework()) {
        return nil;
    }

    Class controllerClass = NSClassFromString(@"SPUStandardUpdaterController");
    SEL initSelector = NSSelectorFromString(@"initWithStartingUpdater:updaterDelegate:userDriverDelegate:");
    if (controllerClass == Nil || ![controllerClass instancesRespondToSelector:initSelector]) {
        return nil;
    }

    __block id controller = nil;
    run_on_main_sync(^{
        controller = ((id (*)(id, SEL, BOOL, id, id))objc_msgSend)([controllerClass alloc], initSelector, YES, nil, nil);
    });
    updaterController = controller;
    return updaterController;
}

int GetTokensSparkleAvailable(void) {
    return ensure_updater_controller() != nil ? 1 : 0;
}

int GetTokensSparkleStart(void) {
    return ensure_updater_controller() != nil ? 1 : 0;
}

int GetTokensSparkleCheckForUpdates(void) {
    id controller = ensure_updater_controller();
    if (controller == nil) {
        return 0;
    }

    SEL checkSelector = NSSelectorFromString(@"checkForUpdates:");
    if (![controller respondsToSelector:checkSelector]) {
        return 0;
    }

    run_on_main_sync(^{
        ((void (*)(id, SEL, id))objc_msgSend)(controller, checkSelector, nil);
    });
    return 1;
}
