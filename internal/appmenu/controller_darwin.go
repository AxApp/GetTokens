//go:build darwin

package appmenu

/*
#cgo CFLAGS: -x objective-c -fmodules
#cgo LDFLAGS: -framework Foundation -framework AppKit
#import <stdlib.h>
#import "appmenu_bridge.h"
*/
import "C"

import (
	"sync"
	"unsafe"
)

var (
	activeCallbacks Callbacks
	activeMu        sync.Mutex
)

func InstallCheckForUpdates(title string, callbacks Callbacks) error {
	activeMu.Lock()
	activeCallbacks = callbacks
	activeMu.Unlock()

	cTitle := C.CString(title)
	defer C.free(unsafe.Pointer(cTitle))
	C.GetTokensAppMenuInstallCheckForUpdates(cTitle)
	return nil
}

func currentCallbacks() Callbacks {
	activeMu.Lock()
	defer activeMu.Unlock()
	return activeCallbacks
}

//export gettokensAppMenuCheckForUpdates
func gettokensAppMenuCheckForUpdates() {
	if callback := currentCallbacks().CheckForUpdates; callback != nil {
		callback()
	}
}
