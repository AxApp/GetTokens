//go:build darwin

package sparkle

/*
#cgo CFLAGS: -x objective-c -fmodules
#cgo LDFLAGS: -framework Foundation -framework Cocoa
#import <Foundation/Foundation.h>
#import "sparkle_bridge.h"
*/
import "C"

import "fmt"

func Available() bool {
	return C.GetTokensSparkleAvailable() == 1
}

func Start() error {
	if C.GetTokensSparkleStart() == 1 {
		return nil
	}
	return fmt.Errorf("sparkle start failed")
}

func CheckForUpdates() error {
	if C.GetTokensSparkleCheckForUpdates() == 1 {
		return nil
	}
	return fmt.Errorf("sparkle check for updates failed")
}
