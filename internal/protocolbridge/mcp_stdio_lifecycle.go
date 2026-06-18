package protocolbridge

import (
	"context"
	"errors"
	"fmt"
	"io"
	"sync"
)

type MCPStdioLifecycleWrapper struct {
	server *MCPStdioJSONRPCServer

	mu           sync.Mutex
	running      bool
	cancel       context.CancelFunc
	readerCloser io.Closer
	writerCloser io.Closer
	done         chan error
}

func NewMCPStdioLifecycleWrapper(server *MCPStdioJSONRPCServer) *MCPStdioLifecycleWrapper {
	return &MCPStdioLifecycleWrapper{server: server}
}

func (w *MCPStdioLifecycleWrapper) Serve(ctx context.Context, reader io.Reader, writer io.Writer) (err error) {
	if w == nil || w.server == nil {
		return fmt.Errorf("MCP stdio lifecycle wrapper is not configured")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	serveCtx, cancel := context.WithCancel(ctx)
	done := make(chan error, 1)
	readerCloser, _ := reader.(io.Closer)
	writerCloser, _ := writer.(io.Closer)

	w.mu.Lock()
	if w.running {
		w.mu.Unlock()
		cancel()
		return fmt.Errorf("MCP stdio lifecycle wrapper is already running")
	}
	w.running = true
	w.cancel = cancel
	w.readerCloser = readerCloser
	w.writerCloser = writerCloser
	w.done = done
	w.mu.Unlock()

	defer func() {
		cancel()
		w.closeIO()
		w.mu.Lock()
		if w.done == done {
			w.running = false
			w.cancel = nil
			w.readerCloser = nil
			w.writerCloser = nil
			w.done = nil
		}
		w.mu.Unlock()
		done <- err
		close(done)
	}()

	go func() {
		<-serveCtx.Done()
		w.closeIO()
	}()

	err = w.server.Serve(serveCtx, reader, writer)
	if serveCtx.Err() != nil && (err == nil || errors.Is(err, io.ErrClosedPipe) || errors.Is(err, context.Canceled)) {
		return serveCtx.Err()
	}
	return err
}

func (w *MCPStdioLifecycleWrapper) Shutdown(ctx context.Context) error {
	if w == nil {
		return nil
	}
	if ctx == nil {
		ctx = context.Background()
	}
	w.mu.Lock()
	cancel := w.cancel
	done := w.done
	w.mu.Unlock()
	if cancel == nil || done == nil {
		return nil
	}
	cancel()
	w.closeIO()

	select {
	case err := <-done:
		if err != nil && !errors.Is(err, context.Canceled) && !errors.Is(err, io.ErrClosedPipe) {
			return err
		}
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (w *MCPStdioLifecycleWrapper) Running() bool {
	if w == nil {
		return false
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.running
}

func (w *MCPStdioLifecycleWrapper) closeIO() {
	w.mu.Lock()
	readerCloser := w.readerCloser
	writerCloser := w.writerCloser
	w.mu.Unlock()
	if readerCloser != nil {
		_ = readerCloser.Close()
	}
	if writerCloser != nil {
		_ = writerCloser.Close()
	}
}
