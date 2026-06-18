package protocolbridge

import (
	"context"
	"errors"
	"fmt"
	"strings"
)

type OperationExecutor interface {
	Execute(ctx context.Context, req OperationRequest) (OperationResult, error)
}

type OperationRequest struct {
	Version        string
	RequestID      string
	Transport      Transport
	Operation      Operation
	Query          map[string]any
	Actor          Actor
	Authority      Authority
	IdempotencyKey string
	Caller         *CallerContext
	ClientID       string
}

type operationResultKind string

const (
	operationResultKindRead           operationResultKind = "read"
	operationResultKindAcceptedAction operationResultKind = "accepted_action"
)

type SidecarReadEnvelope struct {
	Data             any
	Warnings         []BridgeWarning
	SnapshotID       string
	LedgerRef        string
	SidecarRequestID string
}

type SidecarAcceptedAction struct {
	OperationID      string
	Warnings         []BridgeWarning
	LedgerRef        string
	SidecarRequestID string
}

type OperationResult struct {
	kind           operationResultKind
	readEnvelope   SidecarReadEnvelope
	acceptedAction SidecarAcceptedAction
}

func NewReadOperationResult(envelope SidecarReadEnvelope) OperationResult {
	return OperationResult{
		kind:         operationResultKindRead,
		readEnvelope: copyReadEnvelope(envelope),
	}
}

func NewAcceptedActionResult(action SidecarAcceptedAction) OperationResult {
	return OperationResult{
		kind:           operationResultKindAcceptedAction,
		acceptedAction: copyAcceptedAction(action),
	}
}

func (r OperationResult) readResult() (SidecarReadEnvelope, bool) {
	if r.kind != operationResultKindRead {
		return SidecarReadEnvelope{}, false
	}
	return copyReadEnvelope(r.readEnvelope), true
}

func (r OperationResult) acceptedActionResult() (SidecarAcceptedAction, bool) {
	if r.kind != operationResultKindAcceptedAction {
		return SidecarAcceptedAction{}, false
	}
	return copyAcceptedAction(r.acceptedAction), true
}

type OperationRef struct {
	OperationID string `json:"operation_id"`
	Status      Status `json:"status"`
	ResultRef   string `json:"result_ref,omitempty"`
}

type AuditPersister interface {
	Persist(ctx context.Context, event AuditEvent) error
}

type noopAuditPersister struct{}

func (noopAuditPersister) Persist(_ context.Context, _ AuditEvent) error {
	return nil
}

type MCPAdapterOption func(*MCPAdapter)

func WithMCPAuditPersister(persister AuditPersister) MCPAdapterOption {
	return func(adapter *MCPAdapter) {
		if persister != nil {
			adapter.auditPersister = persister
		}
	}
}

type MCPToolRequest struct {
	ToolName        string
	Token           string
	Client          *Client
	Query           map[string]any
	RequestID       string
	IdempotencyKey  string
	Caller          *CallerContext
	PeerDescription string
}

type MCPToolResponse struct {
	Version        string          `json:"version"`
	RequestID      string          `json:"request_id"`
	Transport      Transport       `json:"transport"`
	Operation      Operation       `json:"operation"`
	Actor          Actor           `json:"actor"`
	Status         Status          `json:"status"`
	Data           any             `json:"data,omitempty"`
	OperationRef   *OperationRef   `json:"operation_ref,omitempty"`
	Authority      Authority       `json:"authority"`
	Audit          AuditProjection `json:"audit"`
	AuditEvent     *AuditEvent     `json:"audit_event,omitempty"`
	Error          *BridgeError    `json:"error,omitempty"`
	SidecarInvoked bool            `json:"sidecar_invoked"`
	Warnings       []BridgeWarning `json:"warnings"`
}

type MCPResourceRequest struct {
	URI       string
	RequestID string
}

type MCPResourceResponse struct {
	Version        string              `json:"version"`
	RequestID      string              `json:"request_id"`
	Transport      Transport           `json:"transport"`
	Status         Status              `json:"status"`
	Resource       *MCPResourceMapping `json:"resource,omitempty"`
	Data           any                 `json:"data,omitempty"`
	Authority      Authority           `json:"authority"`
	Audit          AuditProjection     `json:"audit"`
	AuditEvent     *AuditEvent         `json:"-"`
	Error          *BridgeError        `json:"error,omitempty"`
	SidecarInvoked bool                `json:"sidecar_invoked"`
	Warnings       []BridgeWarning     `json:"warnings"`
}

type MCPAdapter struct {
	runtime        *Runtime
	mapping        MCPAdapterMapping
	executor       OperationExecutor
	auditPersister AuditPersister
	preflight      *MCPStdioPreflight

	toolsByName    map[string]MCPToolMapping
	resourcesByURI map[string]MCPResourceMapping
}

func NewMCPAdapter(runtime *Runtime, mapping MCPAdapterMapping, executor OperationExecutor, options ...MCPAdapterOption) (*MCPAdapter, error) {
	if runtime == nil {
		return nil, fmt.Errorf("MCP adapter runtime is required")
	}
	if executor == nil {
		return nil, fmt.Errorf("MCP adapter executor is required")
	}
	if err := ValidateMCPAdapterMapping(mapping); err != nil {
		return nil, err
	}
	preflight, err := NewMCPStdioPreflight(mapping)
	if err != nil {
		return nil, err
	}
	adapter := &MCPAdapter{
		runtime:        runtime,
		mapping:        mapping,
		executor:       executor,
		auditPersister: noopAuditPersister{},
		preflight:      preflight,
		toolsByName:    make(map[string]MCPToolMapping, len(mapping.Tools)),
		resourcesByURI: make(map[string]MCPResourceMapping, len(mapping.Resources)),
	}
	for _, option := range options {
		if option != nil {
			option(adapter)
		}
	}
	for _, tool := range mapping.Tools {
		adapter.toolsByName[tool.Name] = tool
	}
	for _, resource := range mapping.Resources {
		adapter.resourcesByURI[resource.URI] = resource
	}
	return adapter, nil
}

func (a *MCPAdapter) HandleTool(ctx context.Context, req MCPToolRequest) MCPToolResponse {
	tool, ok := a.toolsByName[strings.TrimSpace(req.ToolName)]
	if !ok {
		response := authResultToMCPToolResponse(a.runtime.Authorize(AuthorizeRequest{
			Operation:      Operation("mcp.tool.unknown"),
			Transport:      TransportMCP,
			Token:          req.Token,
			Client:         req.Client,
			Caller:         req.Caller,
			RequestID:      req.RequestID,
			IdempotencyKey: req.IdempotencyKey,
		}))
		a.persistAudit(ctx, response.AuditEvent)
		return response
	}

	auth := a.runtime.Authorize(AuthorizeRequest{
		Operation:      tool.CanonicalOperation,
		Transport:      TransportMCP,
		Token:          req.Token,
		Client:         req.Client,
		Caller:         req.Caller,
		RequestID:      req.RequestID,
		IdempotencyKey: req.IdempotencyKey,
	})
	if !auth.Allowed {
		response := authResultToMCPToolResponse(auth)
		a.persistAudit(ctx, response.AuditEvent)
		return response
	}
	if a.preflight != nil {
		if _, err := a.preflight.Tool(req); err != nil {
			response := preflightErrorToMCPToolResponse(auth, err)
			a.persistAudit(ctx, response.AuditEvent)
			return response
		}
	}

	result, err := a.executor.Execute(ctx, OperationRequest{
		Version:        Version,
		RequestID:      auth.RequestID,
		Transport:      TransportMCP,
		Operation:      tool.CanonicalOperation,
		Query:          copyQuery(req.Query),
		Actor:          auth.Actor,
		Authority:      auth.Authority,
		IdempotencyKey: req.IdempotencyKey,
		Caller:         req.Caller,
		ClientID:       auth.Actor.ClientID,
	})
	if err != nil {
		response := executorErrorToMCPToolResponse(auth, err)
		a.persistAudit(ctx, response.AuditEvent)
		return response
	}
	response := operationResultToMCPToolResponse(auth, tool, result)
	a.persistAudit(ctx, response.AuditEvent)
	return response
}

const operationMCPResourceRead Operation = "mcp.resources.read"

func (a *MCPAdapter) HandleResource(ctx context.Context, req MCPResourceRequest) MCPResourceResponse {
	if a.preflight != nil {
		if _, err := a.preflight.Resource(req); err != nil {
			response := newMCPResourcePreflightErrorResponse(a.runtime, req.RequestID, err)
			a.persistAudit(ctx, response.AuditEvent)
			return response
		}
	}
	resource, ok := a.resourcesByURI[strings.TrimSpace(req.URI)]
	if !ok || resourceKindForbidden(resource) || exposesForbiddenMCPResourceValue(resource) {
		response := authResultToMCPResourceResponse(a.runtime.Authorize(AuthorizeRequest{
			Operation: Operation("mcp.resource.unknown"),
			Transport: TransportMCP,
			RequestID: req.RequestID,
		}))
		a.persistAudit(ctx, response.AuditEvent)
		return response
	}
	requestID := ensureRequestID(a.runtime, req.RequestID)
	response := newMCPResourceSuccessResponse(a, requestID, resource)
	a.persistAudit(ctx, response.AuditEvent)
	return response
}

func (a *MCPAdapter) resourceAuditEvent(requestID string, authority Authority, status Status, errorCode ErrorCode, recoverable bool) AuditEvent {
	start := a.runtime.now()
	event := a.runtime.auditEvent(AuthorizeRequest{
		Operation: operationMCPResourceRead,
		Transport: TransportMCP,
		RequestID: requestID,
	}, nil, nil, authority, status, errorCode, recoverable, start)
	event.TargetRefs = []string{"mcp-resource"}
	return event
}

func newMCPResourceSuccessResponse(a *MCPAdapter, requestID string, resource MCPResourceMapping) MCPResourceResponse {
	authority := Authority{
		Owner:             AuthorityOwnerSidecar,
		Endpoint:          "/v0/management/gettokens/protocol-bridge/resources",
		GeneratedAtUnixMs: a.runtime.now().UnixMilli(),
		SourceNotes: []SourceNote{{
			Field:  "resource",
			Source: "mcp-adapter-mapping",
			Note:   "Adapter exposes only manifest, schema, and scope list metadata.",
		}},
	}
	event := a.resourceAuditEvent(requestID, authority, StatusOK, "", false)
	return MCPResourceResponse{
		Version:   Version,
		RequestID: requestID,
		Transport: TransportMCP,
		Status:    StatusOK,
		Resource:  &resource,
		Data: map[string]any{
			"kind":    resource.Kind,
			"uri":     resource.URI,
			"source":  resource.Source,
			"exposes": append([]string(nil), resource.Exposes...),
		},
		Authority:      authority,
		Audit:          event.Projection(RedactionSecretsRemoved),
		AuditEvent:     &event,
		SidecarInvoked: false,
		Warnings:       []BridgeWarning{},
	}
}

func authResultToMCPToolResponse(result AuthorizeResult) MCPToolResponse {
	return MCPToolResponse{
		Version:        result.Version,
		RequestID:      result.RequestID,
		Transport:      result.Transport,
		Operation:      result.Operation,
		Actor:          result.Actor,
		Status:         result.Status,
		Authority:      result.Authority,
		Audit:          result.Audit,
		AuditEvent:     result.AuditEvent,
		Error:          result.Error,
		SidecarInvoked: result.SidecarInvoked,
		Warnings:       result.Warnings,
	}
}

func operationResultToMCPToolResponse(auth AuthorizeResult, tool MCPToolMapping, result OperationResult) MCPToolResponse {
	authority := auth.Authority
	event := cloneAuditEvent(auth.AuditEvent)
	response := MCPToolResponse{
		Version:        auth.Version,
		RequestID:      auth.RequestID,
		Transport:      auth.Transport,
		Operation:      auth.Operation,
		Actor:          auth.Actor,
		Authority:      authority,
		AuditEvent:     event,
		SidecarInvoked: true,
		Warnings:       []BridgeWarning{},
	}
	if tool.Type == "safe_action" {
		action, ok := result.acceptedActionResult()
		if !ok {
			return executorErrorToMCPToolResponse(auth, fmt.Errorf("executor contract violation: safe action %s returned non-action result", auth.Operation))
		}
		response.Status = StatusAccepted
		response.Authority.LedgerRef = action.LedgerRef
		response.OperationRef = &OperationRef{
			OperationID: operationIDFromResult(auth.RequestID, action.OperationID),
			Status:      StatusAccepted,
			ResultRef:   action.LedgerRef,
		}
		if response.AuditEvent != nil {
			response.AuditEvent.ResultStatus = StatusAccepted
			response.AuditEvent.SidecarRequestID = action.SidecarRequestID
			response.AuditEvent.SidecarOperationID = response.OperationRef.OperationID
		}
		response.Audit = response.AuditEvent.Projection(RedactionSecretsAndHeadersRemoved)
		response.Warnings = append([]BridgeWarning(nil), action.Warnings...)
		return response
	}
	read, ok := result.readResult()
	if !ok {
		return executorErrorToMCPToolResponse(auth, fmt.Errorf("executor contract violation: read operation %s returned non-read result", auth.Operation))
	}
	response.Status = StatusOK
	response.Authority.SnapshotID = read.SnapshotID
	response.Authority.LedgerRef = read.LedgerRef
	response.Data = read.Data
	response.Warnings = append([]BridgeWarning(nil), read.Warnings...)
	if response.AuditEvent != nil {
		response.AuditEvent.ResultStatus = StatusOK
		response.AuditEvent.SidecarRequestID = read.SidecarRequestID
		response.Audit = response.AuditEvent.Projection(RedactionSecretsAndHeadersRemoved)
	} else {
		response.Audit = auth.Audit
		response.Audit.SidecarRequestID = read.SidecarRequestID
	}
	return response
}

func executorErrorToMCPToolResponse(auth AuthorizeResult, err error) MCPToolResponse {
	code := ErrorSidecarUnavailable
	message := "sidecar execution failed"
	recoverable := true
	sidecarErrorCode := ""
	var canonicalErr *canonicalExecutorError
	if errors.As(err, &canonicalErr) && canonicalErr != nil {
		code = canonicalErr.Code
		message = sanitizeExecutorErrorMessage(canonicalErr.Message)
		recoverable = canonicalErr.Recoverable
		sidecarErrorCode = sanitizeExecutorSidecarErrorCode(canonicalErr.SidecarErrorCode)
	} else if trimmed := strings.TrimSpace(err.Error()); trimmed != "" {
		message = sanitizeExecutorErrorMessage(trimmed)
	}
	event := cloneAuditEvent(auth.AuditEvent)
	if event != nil {
		event.ResultStatus = StatusRejected
		event.ErrorCode = code
		event.Recoverable = &recoverable
	}
	bridgeErr := &BridgeError{
		Code:             code,
		Message:          message,
		Recoverable:      recoverable,
		SidecarErrorCode: sidecarErrorCode,
		SidecarInvoked:   true,
	}
	audit := auth.Audit
	if event != nil {
		audit = event.Projection(RedactionSecretsAndHeadersRemoved)
	}
	return MCPToolResponse{
		Version:        auth.Version,
		RequestID:      auth.RequestID,
		Transport:      auth.Transport,
		Operation:      auth.Operation,
		Actor:          auth.Actor,
		Status:         StatusRejected,
		Authority:      auth.Authority,
		Audit:          audit,
		AuditEvent:     event,
		Error:          bridgeErr,
		SidecarInvoked: true,
		Warnings:       []BridgeWarning{},
	}
}

func sanitizeExecutorErrorMessage(message string) string {
	message = redactSidecarText(message)
	if message == "" || containsCredentialBearingText(message) {
		return "sidecar execution failed"
	}
	return message
}

func sanitizeExecutorSidecarErrorCode(code string) string {
	code = sanitizeSidecarErrorCode(code)
	if code == "" {
		return ""
	}
	normalized := strings.ToLower(strings.ReplaceAll(code, "-", "_"))
	for _, forbidden := range []string{
		"authorization",
		"cookie",
		"token",
		"header",
		"secret",
		"api_key",
	} {
		if strings.Contains(normalized, forbidden) {
			return ""
		}
	}
	return code
}

func authResultToMCPResourceResponse(result AuthorizeResult) MCPResourceResponse {
	return MCPResourceResponse{
		Version:        result.Version,
		RequestID:      result.RequestID,
		Transport:      result.Transport,
		Status:         result.Status,
		Authority:      result.Authority,
		Audit:          result.Audit,
		AuditEvent:     result.AuditEvent,
		Error:          result.Error,
		SidecarInvoked: result.SidecarInvoked,
		Warnings:       result.Warnings,
	}
}

func preflightErrorToMCPToolResponse(auth AuthorizeResult, err error) MCPToolResponse {
	event := cloneAuditEvent(auth.AuditEvent)
	recoverable := false
	if event != nil {
		event.ResultStatus = StatusRejected
		event.ErrorCode = ErrorInvalidRequest
		event.Recoverable = &recoverable
	}
	audit := auth.Audit
	if event != nil {
		audit = event.Projection(RedactionSecretsRemoved)
	}
	return MCPToolResponse{
		Version:    auth.Version,
		RequestID:  auth.RequestID,
		Transport:  auth.Transport,
		Operation:  auth.Operation,
		Actor:      auth.Actor,
		Status:     StatusRejected,
		Authority:  auth.Authority,
		Audit:      audit,
		AuditEvent: event,
		Error: &BridgeError{
			Code:           ErrorInvalidRequest,
			Message:        sanitizeMCPStdioPreflightMessage(err),
			Recoverable:    false,
			SidecarInvoked: false,
		},
		SidecarInvoked: false,
		Warnings:       []BridgeWarning{},
	}
}

func newMCPResourcePreflightErrorResponse(runtime *Runtime, requestID string, err error) MCPResourceResponse {
	requestID = ensureRequestID(runtime, requestID)
	authority := Authority{
		Owner:             AuthorityOwnerSidecar,
		Endpoint:          "/v0/management/gettokens/protocol-bridge/resources",
		GeneratedAtUnixMs: runtime.now().UnixMilli(),
	}
	recoverable := false
	event := runtime.auditEvent(AuthorizeRequest{
		Operation: operationMCPResourceRead,
		Transport: TransportMCP,
		RequestID: requestID,
	}, nil, nil, authority, StatusRejected, ErrorInvalidRequest, recoverable, runtime.now())
	event.TargetRefs = []string{"mcp-resource"}
	return MCPResourceResponse{
		Version:    Version,
		RequestID:  requestID,
		Transport:  TransportMCP,
		Status:     StatusRejected,
		Authority:  authority,
		Audit:      event.Projection(RedactionSecretsRemoved),
		AuditEvent: &event,
		Error: &BridgeError{
			Code:           ErrorInvalidRequest,
			Message:        sanitizeMCPStdioPreflightMessage(err),
			Recoverable:    false,
			SidecarInvoked: false,
		},
		SidecarInvoked: false,
		Warnings:       []BridgeWarning{},
	}
}

func sanitizeMCPStdioPreflightMessage(err error) string {
	if err == nil {
		return "MCP stdio request is invalid"
	}
	message := strings.TrimSpace(err.Error())
	if message == "" {
		return "MCP stdio request is invalid"
	}
	if containsCredentialBearingText(message) {
		return mcpStdioCredentialInputMessage
	}
	return message
}

func (a *MCPAdapter) persistAudit(ctx context.Context, event *AuditEvent) {
	if a == nil || event == nil || a.auditPersister == nil {
		return
	}
	_ = a.auditPersister.Persist(ctx, *cloneAuditEvent(event))
}

func copyReadEnvelope(envelope SidecarReadEnvelope) SidecarReadEnvelope {
	envelope.Warnings = append([]BridgeWarning(nil), envelope.Warnings...)
	return envelope
}

func copyAcceptedAction(action SidecarAcceptedAction) SidecarAcceptedAction {
	action.Warnings = append([]BridgeWarning(nil), action.Warnings...)
	return action
}

func copyQuery(query map[string]any) map[string]any {
	if len(query) == 0 {
		return map[string]any{}
	}
	copied := make(map[string]any, len(query))
	for key, value := range query {
		copied[key] = value
	}
	return copied
}

func cloneAuditEvent(event *AuditEvent) *AuditEvent {
	if event == nil {
		return nil
	}
	copied := *event
	copied.Scopes = append([]Scope(nil), event.Scopes...)
	copied.TargetRefs = append([]string(nil), event.TargetRefs...)
	copied.Authority.SourceNotes = append([]SourceNote(nil), event.Authority.SourceNotes...)
	return &copied
}

func operationIDFromResult(requestID string, operationID string) string {
	operationID = strings.TrimSpace(operationID)
	if operationID != "" {
		return operationID
	}
	return "bro_" + safeIDSegment(requestID)
}

func ensureRequestID(runtime *Runtime, requestID string) string {
	requestID = strings.TrimSpace(requestID)
	if requestID != "" {
		return requestID
	}
	return runtime.nextID("mcp")
}

func resourceKindForbidden(resource MCPResourceMapping) bool {
	switch resource.Kind {
	case "manifest", "schema", "scope_list":
		return false
	default:
		return true
	}
}

func safeIDSegment(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return "unknown"
	}
	var builder strings.Builder
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z':
			builder.WriteRune(r)
		case r >= 'A' && r <= 'Z':
			builder.WriteRune(r)
		case r >= '0' && r <= '9':
			builder.WriteRune(r)
		default:
			builder.WriteByte('_')
		}
	}
	return strings.Trim(builder.String(), "_")
}
