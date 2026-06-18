package protocolbridge

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"
)

const Version = "bridge.surface.v1"

type Operation string

const (
	OperationAccountsSummary           Operation = "bridge.accounts.summary"
	OperationModelsSupported           Operation = "bridge.models.supported"
	OperationRoutesDiagnostics         Operation = "bridge.routes.diagnostics"
	OperationQuotaSummary              Operation = "bridge.quota.summary"
	OperationActionRouteabilityRecheck Operation = "bridge.actions.routeability_recheck"
	OperationActionQuotaRefresh        Operation = "bridge.actions.quota_refresh"
	OperationActionModelCatalogRefresh Operation = "bridge.actions.model_catalog_refresh"
	OperationActionDiagnosticsProbe    Operation = "bridge.actions.diagnostics_probe"
)

type Transport string

const (
	TransportMCP         Transport = "mcp"
	TransportA2A         Transport = "a2a"
	TransportOpenAIAdmin Transport = "openai_admin"
)

type Scope string

const (
	ScopeAccountsRead           Scope = "bridge.accounts.read"
	ScopeModelsRead             Scope = "bridge.models.read"
	ScopeRoutesDiagnosticsRead  Scope = "bridge.routes.diagnostics.read"
	ScopeQuotaRead              Scope = "bridge.quota.read"
	ScopeActionRouteability     Scope = "bridge.actions.routeability_recheck"
	ScopeActionQuotaRefresh     Scope = "bridge.actions.quota_refresh"
	ScopeActionModelCatalog     Scope = "bridge.actions.model_catalog_refresh"
	ScopeActionDiagnosticsProbe Scope = "bridge.actions.diagnostics_probe"
	ScopeConfigRead             Scope = "bridge.config.read"
	ScopeConfigWrite            Scope = "bridge.config.write"
)

type Status string

const (
	StatusOK       Status = "ok"
	StatusAccepted Status = "accepted"
	StatusRejected Status = "rejected"
)

type ErrorCode string

const (
	ErrorMissingScope          ErrorCode = "missing_scope"
	ErrorInvalidRequest        ErrorCode = "invalid_request"
	ErrorClientDisabled        ErrorCode = "client_disabled"
	ErrorClientExpired         ErrorCode = "client_expired"
	ErrorTransportNotAllowed   ErrorCode = "transport_not_allowed"
	ErrorLoopbackRequired      ErrorCode = "loopback_required"
	ErrorTokenInvalid          ErrorCode = "token_invalid"
	ErrorUnknownOperation      ErrorCode = "unknown_operation"
	ErrorMissingIdempotencyKey ErrorCode = "missing_idempotency_key"
	ErrorSidecarUnavailable    ErrorCode = "sidecar_unavailable"
	ErrorOperationRejected     ErrorCode = "operation_rejected"
	ErrorRateLimited           ErrorCode = "rate_limited"
)

const (
	AuthorityOwnerSidecar             = "sidecar"
	RedactionSecretsRemoved           = "secrets-removed"
	RedactionSecretsAndHeadersRemoved = "secrets-and-headers-removed"
)

type Client struct {
	ID                 string
	DisplayName        string
	TokenHash          string
	TokenHashPrefix    string
	TransportAllowlist []Transport
	ScopeGrants        []ScopeGrant
	ExpiresAt          *time.Time
	LoopbackOnly       bool
	Disabled           bool
	CreatedAtUnixMs    int64
	UpdatedAtUnixMs    int64
}

type ScopeGrant struct {
	Scope     Scope
	Disabled  bool
	ExpiresAt *time.Time
}

type AuthorizeRequest struct {
	Operation      Operation
	Transport      Transport
	Token          string
	Client         *Client
	Caller         *CallerContext
	RequestID      string
	IdempotencyKey string
}

type CallerContext struct {
	PeerAddress      string
	PeerHost         string
	VerifiedLoopback bool
}

type AuthorizeResult struct {
	Version        string          `json:"version"`
	RequestID      string          `json:"request_id"`
	Transport      Transport       `json:"transport"`
	Operation      Operation       `json:"operation"`
	Actor          Actor           `json:"actor"`
	Status         Status          `json:"status"`
	Allowed        bool            `json:"allowed"`
	RequiredScopes []Scope         `json:"required_scopes,omitempty"`
	Error          *BridgeError    `json:"error,omitempty"`
	Authority      Authority       `json:"authority"`
	Audit          AuditProjection `json:"audit"`
	AuditEvent     *AuditEvent     `json:"audit_event,omitempty"`
	SidecarInvoked bool            `json:"sidecar_invoked"`
	Warnings       []BridgeWarning `json:"warnings"`
}

type Actor struct {
	ClientID    string  `json:"client_id"`
	AuthSubject string  `json:"auth_subject"`
	Scopes      []Scope `json:"scopes"`
}

type Authority struct {
	Owner             string       `json:"owner"`
	Endpoint          string       `json:"endpoint"`
	SnapshotID        string       `json:"snapshot_id,omitempty"`
	LedgerRef         string       `json:"ledger_ref,omitempty"`
	GeneratedAtUnixMs int64        `json:"generated_at_unix_ms"`
	SourceNotes       []SourceNote `json:"source_notes,omitempty"`
}

type SourceNote struct {
	Field  string `json:"field"`
	Source string `json:"source"`
	Note   string `json:"note,omitempty"`
}

type BridgeError struct {
	Code             ErrorCode `json:"code"`
	Message          string    `json:"message"`
	RequiredScopes   []Scope   `json:"required_scopes,omitempty"`
	Recoverable      bool      `json:"recoverable"`
	SidecarErrorCode string    `json:"sidecar_error_code,omitempty"`
	SidecarInvoked   bool      `json:"sidecar_invoked"`
}

type BridgeWarning struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
}

type AuditProjection struct {
	AuditID          string `json:"audit_id"`
	Redaction        string `json:"redaction"`
	SidecarRequestID string `json:"sidecar_request_id,omitempty"`
	DurationMs       int64  `json:"duration_ms"`
}

type AuditEvent struct {
	AuditID               string    `json:"audit_id"`
	TimestampUnixMs       int64     `json:"timestamp_unix_ms"`
	RequestID             string    `json:"request_id"`
	Transport             Transport `json:"transport"`
	ClientID              string    `json:"client_id"`
	AuthSubjectHashPrefix string    `json:"auth_subject_hash_prefix"`
	Scopes                []Scope   `json:"scopes"`
	Operation             Operation `json:"operation"`
	TargetRefs            []string  `json:"target_refs,omitempty"`
	Authority             Authority `json:"authority"`
	ResultStatus          Status    `json:"result_status"`
	SidecarRequestID      string    `json:"sidecar_request_id,omitempty"`
	DurationMs            int64     `json:"duration_ms"`
	ErrorCode             ErrorCode `json:"error_code,omitempty"`
	Recoverable           *bool     `json:"recoverable,omitempty"`
	IdempotencyKeyHash    string    `json:"idempotency_key_hash,omitempty"`
	SidecarOperationID    string    `json:"sidecar_operation_id,omitempty"`
	RedactionVersion      string    `json:"redaction_version"`
}

func (e AuditEvent) Projection(redaction string) AuditProjection {
	return AuditProjection{
		AuditID:          e.AuditID,
		Redaction:        redaction,
		SidecarRequestID: e.SidecarRequestID,
		DurationMs:       e.DurationMs,
	}
}

type Runtime struct {
	now func() time.Time

	mu  sync.Mutex
	seq int64
}

type Option func(*Runtime)

func NewRuntime(options ...Option) *Runtime {
	r := &Runtime{now: time.Now}
	for _, option := range options {
		option(r)
	}
	return r
}

func WithNow(now func() time.Time) Option {
	return func(r *Runtime) {
		if now != nil {
			r.now = now
		}
	}
}

func (r *Runtime) Authorize(req AuthorizeRequest) AuthorizeResult {
	if strings.TrimSpace(req.RequestID) == "" {
		req.RequestID = r.nextID("brq")
	}
	start := r.now()
	spec, ok := operationSpecs[req.Operation]
	if !ok {
		return r.reject(req, operationSpec{}, nil, ErrorInvalidRequest, ErrorUnknownOperation, "unknown bridge operation", false, start)
	}

	if req.Client == nil {
		return r.reject(req, spec, nil, ErrorInvalidRequest, ErrorTokenInvalid, "bridge client is required", false, start)
	}
	if !tokenMatches(req.Client, req.Token) {
		return r.reject(req, spec, req.Client, ErrorInvalidRequest, ErrorTokenInvalid, "bridge token is invalid", false, start)
	}
	if req.Client.Disabled {
		return r.reject(req, spec, req.Client, ErrorInvalidRequest, ErrorClientDisabled, "bridge client is disabled", false, start)
	}
	if req.Client.ExpiresAt != nil && !req.Client.ExpiresAt.After(start) {
		return r.reject(req, spec, req.Client, ErrorInvalidRequest, ErrorClientExpired, "bridge client is expired", false, start)
	}
	if req.Client.LoopbackOnly && !callerIsLoopback(req.Caller) {
		return r.reject(req, spec, req.Client, ErrorInvalidRequest, ErrorLoopbackRequired, "bridge client requires a verified loopback caller", false, start)
	}
	if !transportAllowed(req.Client, req.Transport) {
		return r.reject(req, spec, req.Client, ErrorInvalidRequest, ErrorTransportNotAllowed, "bridge transport is not allowed for this client", false, start)
	}
	if !hasExactScope(req.Client, spec.Scope, start) {
		message := fmt.Sprintf("%s is required for %s.", spec.Scope, req.Operation)
		return r.reject(req, spec, req.Client, ErrorMissingScope, ErrorMissingScope, message, true, start)
	}
	if spec.Type == "safe_action" && strings.TrimSpace(req.IdempotencyKey) == "" {
		return r.reject(req, spec, req.Client, ErrorInvalidRequest, ErrorMissingIdempotencyKey, "safe action requires idempotency key", false, start)
	}

	actor := actorForClient(req.Client, start)
	authority := authorityForSpec(spec, start)
	event := r.auditEvent(req, req.Client, actor.Scopes, authority, StatusOK, "", false, start)
	if spec.Type == "safe_action" {
		event.IdempotencyKeyHash = HashSecret(req.IdempotencyKey)
	}
	redaction := RedactionSecretsAndHeadersRemoved
	return AuthorizeResult{
		Version:        Version,
		RequestID:      req.RequestID,
		Transport:      req.Transport,
		Operation:      req.Operation,
		Actor:          actor,
		Status:         StatusOK,
		Allowed:        true,
		Authority:      authority,
		Audit:          event.Projection(redaction),
		AuditEvent:     &event,
		SidecarInvoked: false,
		Warnings:       []BridgeWarning{},
	}
}

func (r *Runtime) reject(req AuthorizeRequest, spec operationSpec, client *Client, canonical ErrorCode, auditCode ErrorCode, message string, recoverable bool, start time.Time) AuthorizeResult {
	if spec.Endpoint == "" {
		spec.Endpoint = "/v0/management/gettokens/protocol-bridge"
	}
	if spec.Scope == "" {
		spec.Scope = Scope(canonical)
	}
	actor := Actor{}
	var scopes []Scope
	if client != nil {
		actor = actorForClient(client, start)
		scopes = actor.Scopes
	}
	authority := authorityForSpec(spec, start)
	authority.SourceNotes = append(authority.SourceNotes, SourceNote{
		Field:  "error.code",
		Source: "wails-local-config",
		Note:   "Bridge auth denied the call before invoking sidecar.",
	})
	event := r.auditEvent(req, client, scopes, authority, StatusRejected, auditCode, recoverable, start)
	redaction := RedactionSecretsRemoved
	err := &BridgeError{
		Code:           canonical,
		Message:        message,
		Recoverable:    recoverable,
		SidecarInvoked: false,
	}
	if canonical == ErrorMissingScope {
		err.RequiredScopes = []Scope{spec.Scope}
	}
	return AuthorizeResult{
		Version:        Version,
		RequestID:      req.RequestID,
		Transport:      req.Transport,
		Operation:      req.Operation,
		Actor:          actor,
		Status:         StatusRejected,
		Allowed:        false,
		RequiredScopes: err.RequiredScopes,
		Error:          err,
		Authority:      authority,
		Audit:          event.Projection(redaction),
		AuditEvent:     &event,
		SidecarInvoked: false,
		Warnings:       []BridgeWarning{},
	}
}

func (r *Runtime) auditEvent(req AuthorizeRequest, client *Client, scopes []Scope, authority Authority, status Status, errorCode ErrorCode, recoverable bool, start time.Time) AuditEvent {
	recoverableValue := recoverable
	event := AuditEvent{
		AuditID:          r.nextID("bra"),
		TimestampUnixMs:  start.UnixMilli(),
		RequestID:        req.RequestID,
		Transport:        req.Transport,
		Scopes:           append([]Scope(nil), scopes...),
		Operation:        req.Operation,
		Authority:        authority,
		ResultStatus:     status,
		DurationMs:       maxInt64(0, r.now().Sub(start).Milliseconds()),
		ErrorCode:        errorCode,
		Recoverable:      nil,
		RedactionVersion: "bridge-redaction-v1",
	}
	if errorCode != "" {
		event.Recoverable = &recoverableValue
	}
	if client != nil {
		event.ClientID = client.ID
		event.AuthSubjectHashPrefix = clientHashPrefix(client)
	}
	return event
}

func (r *Runtime) nextID(prefix string) string {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.seq++
	return fmt.Sprintf("%s_%012d", prefix, r.seq)
}

type operationSpec struct {
	Operation Operation
	Type      string
	Scope     Scope
	Endpoint  string
}

var operationSpecs = map[Operation]operationSpec{
	OperationAccountsSummary: {
		Operation: OperationAccountsSummary,
		Type:      "read",
		Scope:     ScopeAccountsRead,
		Endpoint:  "/v0/management/gettokens/accounts/summary",
	},
	OperationModelsSupported: {
		Operation: OperationModelsSupported,
		Type:      "read",
		Scope:     ScopeModelsRead,
		Endpoint:  "/v0/management/gettokens/models/supported",
	},
	OperationRoutesDiagnostics: {
		Operation: OperationRoutesDiagnostics,
		Type:      "read",
		Scope:     ScopeRoutesDiagnosticsRead,
		Endpoint:  "/v0/management/gettokens/routes/diagnostics",
	},
	OperationQuotaSummary: {
		Operation: OperationQuotaSummary,
		Type:      "read",
		Scope:     ScopeQuotaRead,
		Endpoint:  "/v0/management/gettokens/quota/summary",
	},
	OperationActionRouteabilityRecheck: {
		Operation: OperationActionRouteabilityRecheck,
		Type:      "safe_action",
		Scope:     ScopeActionRouteability,
		Endpoint:  "/v0/management/gettokens/routeability-recheck",
	},
	OperationActionQuotaRefresh: {
		Operation: OperationActionQuotaRefresh,
		Type:      "safe_action",
		Scope:     ScopeActionQuotaRefresh,
		Endpoint:  "/v0/management/gettokens/quota-refresh",
	},
	OperationActionModelCatalogRefresh: {
		Operation: OperationActionModelCatalogRefresh,
		Type:      "safe_action",
		Scope:     ScopeActionModelCatalog,
		Endpoint:  "/v0/management/gettokens/model-catalog-refresh",
	},
	OperationActionDiagnosticsProbe: {
		Operation: OperationActionDiagnosticsProbe,
		Type:      "safe_action",
		Scope:     ScopeActionDiagnosticsProbe,
		Endpoint:  "/v0/management/gettokens/diagnostics-probe",
	},
}

func tokenMatches(client *Client, rawToken string) bool {
	rawToken = strings.TrimSpace(rawToken)
	if client == nil || rawToken == "" || client.TokenHash == "" {
		return false
	}
	candidate := HashSecret(rawToken)
	if len(candidate) != len(client.TokenHash) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(candidate), []byte(client.TokenHash)) == 1
}

func transportAllowed(client *Client, transport Transport) bool {
	if client == nil || transport == "" {
		return false
	}
	for _, allowed := range client.TransportAllowlist {
		if allowed == transport {
			return true
		}
	}
	return false
}

func hasExactScope(client *Client, required Scope, now time.Time) bool {
	if client == nil || required == "" {
		return false
	}
	for _, grant := range client.ScopeGrants {
		if grant.Disabled {
			continue
		}
		if grant.ExpiresAt != nil && !grant.ExpiresAt.After(now) {
			continue
		}
		if grant.Scope == required {
			return true
		}
	}
	return false
}

func actorForClient(client *Client, now time.Time) Actor {
	if client == nil {
		return Actor{}
	}
	scopes := activeScopesForClient(client, now)
	return Actor{
		ClientID:    client.ID,
		AuthSubject: "bridge-token:" + clientHashPrefix(client),
		Scopes:      scopes,
	}
}

func activeScopesForClient(client *Client, now time.Time) []Scope {
	if client == nil {
		return nil
	}
	scopes := make([]Scope, 0, len(client.ScopeGrants))
	for _, grant := range client.ScopeGrants {
		if grant.Disabled {
			continue
		}
		if grant.ExpiresAt != nil && !grant.ExpiresAt.After(now) {
			continue
		}
		scopes = append(scopes, grant.Scope)
	}
	return scopes
}

func callerIsLoopback(caller *CallerContext) bool {
	if caller == nil {
		return false
	}
	if caller.VerifiedLoopback {
		return true
	}
	host := strings.TrimSpace(caller.PeerHost)
	if host == "" {
		host = peerHostFromAddress(caller.PeerAddress)
	}
	ip := net.ParseIP(strings.Trim(host, "[]"))
	return ip != nil && ip.IsLoopback()
}

func peerHostFromAddress(address string) string {
	address = strings.TrimSpace(address)
	if address == "" {
		return ""
	}
	host, _, err := net.SplitHostPort(address)
	if err == nil {
		return host
	}
	return address
}

func authorityForSpec(spec operationSpec, now time.Time) Authority {
	return Authority{
		Owner:             AuthorityOwnerSidecar,
		Endpoint:          spec.Endpoint,
		GeneratedAtUnixMs: now.UnixMilli(),
	}
}

func clientHashPrefix(client *Client) string {
	if client == nil {
		return ""
	}
	if client.TokenHashPrefix != "" {
		return client.TokenHashPrefix
	}
	return HashPrefix(client.TokenHash)
}

func HashSecret(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func HashPrefix(hash string) string {
	hash = strings.TrimSpace(hash)
	if len(hash) <= 8 {
		return hash
	}
	return hash[:8]
}

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
