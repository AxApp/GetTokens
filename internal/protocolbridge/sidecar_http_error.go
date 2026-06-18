package protocolbridge

import (
	"context"
	"errors"
	"net"
	"regexp"
	"strings"
)

type canonicalExecutorError struct {
	Code             ErrorCode
	Message          string
	Recoverable      bool
	SidecarErrorCode string
}

func (e *canonicalExecutorError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

func sidecarUnavailableError(message, sidecarErrorCode string, recoverable bool) error {
	return &canonicalExecutorError{
		Code:             ErrorSidecarUnavailable,
		Message:          strings.TrimSpace(message),
		Recoverable:      recoverable,
		SidecarErrorCode: sanitizeSidecarErrorCode(sidecarErrorCode),
	}
}

func sidecarRejectedError(err *BridgeError, idempotencyKey string) error {
	canonical := ErrorOperationRejected
	sidecarCode := ""
	recoverable := false
	message := "sidecar rejected operation"

	if err != nil {
		if err.Code == ErrorRateLimited {
			canonical = ErrorRateLimited
		}
		if code := sanitizeSidecarErrorCode(err.SidecarErrorCode); code != "" {
			sidecarCode = code
		} else if err.Code != "" && err.Code != ErrorOperationRejected && err.Code != ErrorRateLimited {
			sidecarCode = sanitizeSidecarErrorCode(string(err.Code))
		}
		recoverable = err.Recoverable
		if redacted := redactSidecarText(err.Message, idempotencyKey); redacted != "" {
			message = redacted
		}
	}

	return &canonicalExecutorError{
		Code:             canonical,
		Message:          message,
		Recoverable:      recoverable,
		SidecarErrorCode: sidecarCode,
	}
}

func classifyTransportError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, context.DeadlineExceeded) || transportErrorTimeout(err) || transportErrorLooksLikeTimeout(err.Error()) {
		return sidecarUnavailableError("sidecar HTTP transport timed out", "transport_timeout", true)
	}
	return sidecarUnavailableError("sidecar HTTP transport failed", "transport_error", true)
}

func transportErrorTimeout(err error) bool {
	var netErr net.Error
	return errors.As(err, &netErr) && netErr.Timeout()
}

func transportErrorLooksLikeTimeout(text string) bool {
	lower := strings.ToLower(strings.TrimSpace(text))
	return strings.Contains(lower, "timeout") || strings.Contains(lower, "timed out") || strings.Contains(lower, "deadline exceeded")
}

var sidecarSecretPatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)authorization\s*[:=]\s*(?:bearer\s+)?[^\s,;]+`),
	regexp.MustCompile(`(?i)cookie\s*[:=]\s*[^\s,;]+`),
	regexp.MustCompile(`(?i)idempotency[_ -]?key\s*[:=]\s*[^\s,;]+`),
}

func redactSidecarText(text string, secrets ...string) string {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return ""
	}
	redacted := trimmed
	for _, secret := range secrets {
		secret = strings.TrimSpace(secret)
		if secret == "" {
			continue
		}
		redacted = strings.ReplaceAll(redacted, secret, "[REDACTED]")
	}
	for _, pattern := range sidecarSecretPatterns {
		redacted = pattern.ReplaceAllString(redacted, "[REDACTED]")
	}
	redacted = strings.Join(strings.Fields(redacted), " ")
	if len(redacted) > 240 {
		redacted = redacted[:240]
	}
	return redacted
}

func sanitizeSidecarErrorCode(code string) string {
	code = strings.TrimSpace(code)
	if code == "" {
		return ""
	}
	var builder strings.Builder
	for _, r := range code {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '_', r == '-', r == '.':
			builder.WriteRune(r)
		case r == ' ', r == '/', r == ':':
			builder.WriteByte('_')
		}
		if builder.Len() >= 64 {
			break
		}
	}
	return strings.Trim(builder.String(), "._-")
}
