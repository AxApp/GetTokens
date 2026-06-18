package protocolbridge

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"strings"
	"sync"
)

var ErrExternalStdioProcessExited = errors.New("external stdio process exited")

type MCPExternalStdioCommand struct {
	Path string
	Args []string
	Env  []string
}

type MCPExternalStdioProcess struct {
	command MCPExternalStdioCommand

	mu      sync.Mutex
	cmd     *exec.Cmd
	cancel  context.CancelFunc
	stdin   io.WriteCloser
	stdout  io.ReadCloser
	encoder *json.Encoder
	decoder *json.Decoder
	stderr  limitedTextBuffer
	done    chan error
	running bool
}

func NewMCPExternalStdioProcess(command MCPExternalStdioCommand) *MCPExternalStdioProcess {
	return &MCPExternalStdioProcess{command: command}
}

func (p *MCPExternalStdioProcess) Start(ctx context.Context) error {
	if p == nil {
		return fmt.Errorf("MCP external stdio process is not configured")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if strings.TrimSpace(p.command.Path) == "" {
		return fmt.Errorf("MCP external stdio command path is required")
	}

	p.mu.Lock()
	if p.running {
		p.mu.Unlock()
		return fmt.Errorf("MCP external stdio process is already running")
	}
	processCtx, cancel := context.WithCancel(ctx)
	cmd := exec.CommandContext(processCtx, p.command.Path, p.command.Args...)
	if len(p.command.Env) > 0 {
		cmd.Env = append(cmd.Environ(), p.command.Env...)
	}
	stdin, err := cmd.StdinPipe()
	if err != nil {
		p.mu.Unlock()
		cancel()
		return fmt.Errorf("open external stdio stdin: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		p.mu.Unlock()
		cancel()
		return fmt.Errorf("open external stdio stdout: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		p.mu.Unlock()
		cancel()
		return fmt.Errorf("open external stdio stderr: %w", err)
	}
	done := make(chan error, 1)
	p.cmd = cmd
	p.cancel = cancel
	p.stdin = stdin
	p.stdout = stdout
	p.encoder = json.NewEncoder(stdin)
	p.decoder = json.NewDecoder(stdout)
	p.stderr = limitedTextBuffer{limit: 8192}
	p.done = done
	p.running = true
	p.mu.Unlock()

	if err := cmd.Start(); err != nil {
		p.mu.Lock()
		p.running = false
		p.cmd = nil
		p.cancel = nil
		p.stdin = nil
		p.stdout = nil
		p.encoder = nil
		p.decoder = nil
		p.done = nil
		p.mu.Unlock()
		cancel()
		return fmt.Errorf("start external stdio process: %w", err)
	}

	go func() {
		_, _ = io.Copy(&p.stderr, stderr)
	}()
	go func() {
		waitErr := cmd.Wait()
		p.mu.Lock()
		p.running = false
		p.mu.Unlock()
		done <- waitErr
		close(done)
	}()
	return nil
}

func (p *MCPExternalStdioProcess) CallJSONRPC(ctx context.Context, request any, response any) error {
	if ctx == nil {
		ctx = context.Background()
	}
	p.mu.Lock()
	encoder := p.encoder
	decoder := p.decoder
	done := p.done
	p.mu.Unlock()
	if encoder == nil || decoder == nil || done == nil {
		return fmt.Errorf("MCP external stdio process is not running")
	}

	if err := encoder.Encode(request); err != nil {
		return p.externalProcessError(err, done)
	}

	result := make(chan error, 1)
	go func() {
		result <- decoder.Decode(response)
	}()
	select {
	case err := <-result:
		if err != nil {
			return p.externalProcessError(err, done)
		}
		return nil
	case err := <-done:
		return p.externalProcessError(err, nil)
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (p *MCPExternalStdioProcess) Shutdown(ctx context.Context) error {
	if p == nil {
		return nil
	}
	if ctx == nil {
		ctx = context.Background()
	}
	p.mu.Lock()
	cancel := p.cancel
	stdin := p.stdin
	done := p.done
	p.mu.Unlock()
	if cancel == nil || done == nil {
		return nil
	}
	if stdin != nil {
		_ = stdin.Close()
	}
	cancel()
	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (p *MCPExternalStdioProcess) Running() bool {
	if p == nil {
		return false
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.running
}

func (p *MCPExternalStdioProcess) Stderr() string {
	if p == nil {
		return ""
	}
	return sanitizeExternalStdioText(p.stderr.String())
}

func (p *MCPExternalStdioProcess) externalProcessError(err error, done chan error) error {
	if done != nil {
		select {
		case waitErr := <-done:
			if waitErr != nil {
				err = waitErr
			}
		default:
		}
	}
	message := strings.TrimSpace(err.Error())
	if message == "" {
		message = "external stdio process failed"
	}
	stderr := p.Stderr()
	if stderr != "" {
		message = message + ": stderr: " + stderr
	}
	return fmt.Errorf("%w: %s", ErrExternalStdioProcessExited, sanitizeExternalStdioText(message))
}

func sanitizeExternalStdioText(text string) string {
	text = redactSidecarText(text)
	if text == "" {
		return ""
	}
	if containsCredentialBearingText(text) {
		return "external stdio process failed"
	}
	return text
}

type limitedTextBuffer struct {
	mu    sync.Mutex
	limit int
	buf   strings.Builder
}

func (b *limitedTextBuffer) Write(p []byte) (int, error) {
	written := len(p)
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.limit <= 0 {
		return written, nil
	}
	remaining := b.limit - b.buf.Len()
	if remaining > 0 {
		if len(p) > remaining {
			p = p[:remaining]
		}
		_, _ = b.buf.Write(p)
	}
	return written, nil
}

func (b *limitedTextBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}
