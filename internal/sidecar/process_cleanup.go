package sidecar

import (
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"
)

type sidecarProcessInfo struct {
	PID     int
	PPID    int
	Command string
}

func cleanupOrphanedSidecars(configFile string) error {
	processes, err := listSidecarProcesses()
	if err != nil {
		return nil
	}
	for _, pid := range findOrphanedSidecarPIDs(processes, configFile, os.Getpid()) {
		process, err := os.FindProcess(pid)
		if err != nil {
			continue
		}
		stopProcess(process, nil, orphanShutdownGrace)
	}
	return nil
}

func findOrphanedSidecarPIDs(processes []sidecarProcessInfo, configFile string, currentPID int) []int {
	configFile = filepath.Clean(strings.TrimSpace(configFile))
	if configFile == "" {
		return nil
	}

	pids := []int{}
	for _, process := range processes {
		if process.PID <= 0 || process.PID == currentPID || process.PPID != 1 {
			continue
		}
		if !isCLIProxyAPICommand(process.Command) {
			continue
		}
		if !commandUsesConfig(process.Command, configFile) {
			continue
		}
		pids = append(pids, process.PID)
	}
	return pids
}

func listSidecarProcesses() ([]sidecarProcessInfo, error) {
	output, err := exec.Command("ps", "-axo", "pid=,ppid=,command=").Output()
	if err != nil {
		return nil, err
	}
	lines := strings.Split(string(output), "\n")
	processes := make([]sidecarProcessInfo, 0, len(lines))
	for _, line := range lines {
		fields := strings.Fields(strings.TrimSpace(line))
		if len(fields) < 3 {
			continue
		}
		pid, err := strconv.Atoi(fields[0])
		if err != nil {
			continue
		}
		ppid, err := strconv.Atoi(fields[1])
		if err != nil {
			continue
		}
		processes = append(processes, sidecarProcessInfo{
			PID:     pid,
			PPID:    ppid,
			Command: strings.Join(fields[2:], " "),
		})
	}
	return processes, nil
}

func isCLIProxyAPICommand(command string) bool {
	fields := strings.Fields(strings.TrimSpace(command))
	if len(fields) == 0 {
		return false
	}
	return filepath.Base(fields[0]) == "cli-proxy-api"
}

func commandUsesConfig(command string, configFile string) bool {
	fields := strings.Fields(strings.TrimSpace(command))
	for index, field := range fields {
		if field == "-config" && index+1 < len(fields) && filepath.Clean(fields[index+1]) == configFile {
			return true
		}
		if strings.HasPrefix(field, "-config=") && filepath.Clean(strings.TrimPrefix(field, "-config=")) == configFile {
			return true
		}
	}
	return false
}

func stopProcess(process *os.Process, done <-chan struct{}, grace time.Duration) {
	if process == nil {
		return
	}
	_ = process.Signal(os.Interrupt)
	if waitForDoneOrProcessExit(done, process, grace) {
		return
	}
	_ = process.Kill()
	waitForDoneOrProcessExit(done, process, grace)
}

func waitForDone(done <-chan struct{}, timeout time.Duration) bool {
	if done == nil {
		return false
	}
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case <-done:
		return true
	case <-timer.C:
		return false
	}
}

func waitForDoneOrProcessExit(done <-chan struct{}, process *os.Process, timeout time.Duration) bool {
	if process == nil {
		return false
	}
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()
	for {
		if !processExists(process) {
			return true
		}
		select {
		case <-done:
			return true
		case <-timer.C:
			return !processExists(process)
		case <-ticker.C:
		}
	}
}

func processExists(process *os.Process) bool {
	if process == nil {
		return false
	}
	err := process.Signal(syscall.Signal(0))
	return err == nil
}
