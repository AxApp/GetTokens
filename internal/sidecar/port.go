package sidecar

import (
	"fmt"
	"net"
)

// pickPort tries defaultPort; if occupied, finds a free ephemeral port.
func (m *Manager) pickPort() (int, error) {
	if isPortFree(defaultPort) {
		return defaultPort, nil
	}
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return 0, err
	}
	port := ln.Addr().(*net.TCPAddr).Port
	_ = ln.Close()
	return port, nil
}

func isPortFree(port int) bool {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		return false
	}
	_ = ln.Close()
	return true
}
