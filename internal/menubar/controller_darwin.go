//go:build darwin

package menubar

/*
#cgo CFLAGS: -x objective-c -fmodules
#cgo LDFLAGS: -framework Foundation -framework AppKit -framework QuartzCore
#import <stdlib.h>
#import "menubar_bridge.h"
*/
import "C"

import (
	"sync"
	"unsafe"
)

type Controller struct {
	mu        sync.Mutex
	callbacks Callbacks
	started   bool
}

var activeController *Controller
var activeMu sync.Mutex

func NewController() *Controller {
	return &Controller{}
}

func (c *Controller) Start(callbacks Callbacks) error {
	c.mu.Lock()
	c.callbacks = callbacks
	c.started = true
	c.mu.Unlock()

	activeMu.Lock()
	activeController = c
	activeMu.Unlock()

	displayName := callbacks.DisplayName
	if displayName == "" {
		displayName = "GetTokens"
	}
	status := C.CString(displayName)
	name := C.CString(displayName)
	defer C.free(unsafe.Pointer(status))
	defer C.free(unsafe.Pointer(name))
	C.GetTokensMenuBarStart(status, name)
	if len(menuBarIconPNG) > 0 {
		icon := C.CBytes(menuBarIconPNG)
		defer C.free(icon)
		C.GetTokensMenuBarSetIcon((*C.uchar)(icon), C.size_t(len(menuBarIconPNG)))
	}
	return nil
}

func (c *Controller) Stop() {
	c.mu.Lock()
	c.started = false
	c.mu.Unlock()
	C.GetTokensMenuBarStop()
}

func (c *Controller) SetStatus(status string) {
	c.mu.Lock()
	started := c.started
	c.mu.Unlock()
	if !started {
		return
	}
	value := C.CString(status)
	defer C.free(unsafe.Pointer(value))
	C.GetTokensMenuBarSetStatus(value)
}

func (c *Controller) SetQuotaSnapshot(snapshotJSON string) {
	c.mu.Lock()
	started := c.started
	c.mu.Unlock()
	if !started {
		return
	}
	value := C.CString(snapshotJSON)
	defer C.free(unsafe.Pointer(value))
	C.GetTokensMenuBarSetQuotaSnapshot(value)
}

func currentCallbacks() Callbacks {
	activeMu.Lock()
	controller := activeController
	activeMu.Unlock()
	if controller == nil {
		return Callbacks{}
	}
	controller.mu.Lock()
	defer controller.mu.Unlock()
	return controller.callbacks
}

//export gettokensMenuBarOpenWindow
func gettokensMenuBarOpenWindow() {
	if callback := currentCallbacks().OpenWindow; callback != nil {
		callback()
	}
}

//export gettokensMenuBarRefreshSnapshot
func gettokensMenuBarRefreshSnapshot() {
	if callback := currentCallbacks().RefreshSnapshot; callback != nil {
		callback()
	}
}

//export gettokensMenuBarQuit
func gettokensMenuBarQuit() {
	if callback := currentCallbacks().Quit; callback != nil {
		callback()
	}
}
