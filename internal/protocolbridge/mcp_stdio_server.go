package protocolbridge

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
)

type MCPStdioJSONRPCSession struct {
	Token           string
	Client          *Client
	Caller          *CallerContext
	PeerDescription string
}

type MCPStdioJSONRPCServer struct {
	adapter *MCPAdapter
	session MCPStdioJSONRPCSession
}

func NewMCPStdioJSONRPCServer(adapter *MCPAdapter, session MCPStdioJSONRPCSession) *MCPStdioJSONRPCServer {
	return &MCPStdioJSONRPCServer{
		adapter: adapter,
		session: session,
	}
}

func (s *MCPStdioJSONRPCServer) Serve(ctx context.Context, reader io.Reader, writer io.Writer) error {
	if ctx == nil {
		ctx = context.Background()
	}
	decoder := json.NewDecoder(reader)
	encoder := json.NewEncoder(writer)
	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		var request jsonRPCRequest
		if err := decoder.Decode(&request); err != nil {
			if ctx.Err() != nil && errors.Is(err, io.ErrClosedPipe) {
				return ctx.Err()
			}
			if err == io.EOF {
				return nil
			}
			return encoder.Encode(newJSONRPCErrorResponse(nil, jsonRPCParseError, "parse error"))
		}
		if err := encoder.Encode(s.handle(ctx, request)); err != nil {
			return err
		}
	}
}

func (s *MCPStdioJSONRPCServer) ServeOne(ctx context.Context, reader io.Reader, writer io.Writer) error {
	decoder := json.NewDecoder(reader)
	var request jsonRPCRequest
	if err := decoder.Decode(&request); err != nil {
		return json.NewEncoder(writer).Encode(newJSONRPCErrorResponse(nil, jsonRPCParseError, "parse error"))
	}
	return json.NewEncoder(writer).Encode(s.handle(ctx, request))
}

func (s *MCPStdioJSONRPCServer) handle(ctx context.Context, request jsonRPCRequest) jsonRPCResponse {
	id := cloneJSONRawMessage(request.ID)
	if s == nil || s.adapter == nil {
		return newJSONRPCErrorResponse(id, jsonRPCInternalError, "MCP stdio server is not configured")
	}
	if request.JSONRPC != "2.0" || strings.TrimSpace(request.Method) == "" {
		return newJSONRPCErrorResponse(id, jsonRPCInvalidRequest, "invalid JSON-RPC request")
	}

	switch request.Method {
	case "initialize":
		return newJSONRPCResultResponse(id, newMCPInitializeResponse())
	case "tools/list":
		params, err := decodeOptionalJSONRPCParams[mcpStdioListParams](request.Params)
		if err != nil {
			return newJSONRPCErrorResponse(id, jsonRPCInvalidParams, "invalid tools/list params")
		}
		result, err := newMCPToolsListResponse(s.adapter.mapping.Tools, params)
		if err != nil {
			return newJSONRPCErrorResponse(id, jsonRPCInvalidParams, "invalid tools/list params")
		}
		return newJSONRPCResultResponse(id, result)
	case "resources/list":
		params, err := decodeOptionalJSONRPCParams[mcpStdioListParams](request.Params)
		if err != nil {
			return newJSONRPCErrorResponse(id, jsonRPCInvalidParams, "invalid resources/list params")
		}
		result, err := newMCPResourcesListResponse(s.adapter.mapping.Resources, params)
		if err != nil {
			return newJSONRPCErrorResponse(id, jsonRPCInvalidParams, "invalid resources/list params")
		}
		return newJSONRPCResultResponse(id, result)
	case "tools/call":
		params, err := decodeJSONRPCParams[mcpStdioToolsCallParams](request.Params)
		if err != nil {
			return newJSONRPCErrorResponse(id, jsonRPCInvalidParams, "invalid tools/call params")
		}
		result := s.adapter.HandleTool(ctx, MCPToolRequest{
			ToolName:        params.Name,
			Token:           s.session.Token,
			Client:          s.session.Client,
			Query:           params.Arguments,
			RequestID:       requestIDFromJSONRPC(id, params.RequestID),
			IdempotencyKey:  params.IdempotencyKey,
			Caller:          s.session.Caller,
			PeerDescription: s.session.PeerDescription,
		})
		return newJSONRPCResultResponse(id, result)
	case "resources/read":
		params, err := decodeJSONRPCParams[mcpStdioResourcesReadParams](request.Params)
		if err != nil {
			return newJSONRPCErrorResponse(id, jsonRPCInvalidParams, "invalid resources/read params")
		}
		result := s.adapter.HandleResource(ctx, MCPResourceRequest{
			URI:       params.URI,
			RequestID: requestIDFromJSONRPC(id, params.RequestID),
		})
		return newJSONRPCResultResponse(id, result)
	default:
		return newJSONRPCErrorResponse(id, jsonRPCMethodNotFound, "method not found")
	}
}

const mcpProtocolVersion = "2024-11-05"

type MCPInitializeResponse struct {
	ProtocolVersion string                `json:"protocolVersion"`
	Capabilities    MCPServerCapabilities `json:"capabilities"`
	ServerInfo      MCPServerInfo         `json:"serverInfo"`
}

type MCPServerCapabilities struct {
	Tools     *MCPToolsCapability     `json:"tools,omitempty"`
	Resources *MCPResourcesCapability `json:"resources,omitempty"`
}

type MCPToolsCapability struct {
	ListChanged bool `json:"listChanged"`
}

type MCPResourcesCapability struct {
	Subscribe   bool `json:"subscribe"`
	ListChanged bool `json:"listChanged"`
}

type MCPServerInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
}

type MCPToolsListResponse struct {
	Tools      []MCPListedTool `json:"tools"`
	NextCursor string          `json:"nextCursor,omitempty"`
}

type MCPListedTool struct {
	Name                   string    `json:"name"`
	CanonicalOperation     Operation `json:"canonical_operation"`
	Type                   string    `json:"type"`
	RequiredScope          Scope     `json:"required_scope"`
	QuerySchemaRef         string    `json:"query_schema_ref"`
	RequiresIdempotencyKey bool      `json:"requires_idempotency_key"`
}

type MCPResourcesListResponse struct {
	Resources  []MCPResourceMapping `json:"resources"`
	NextCursor string               `json:"nextCursor,omitempty"`
}

func newMCPInitializeResponse() MCPInitializeResponse {
	return MCPInitializeResponse{
		ProtocolVersion: mcpProtocolVersion,
		Capabilities: MCPServerCapabilities{
			Tools:     &MCPToolsCapability{ListChanged: false},
			Resources: &MCPResourcesCapability{Subscribe: false, ListChanged: false},
		},
		ServerInfo: MCPServerInfo{
			Name:    "gettokens-protocol-bridge",
			Version: Version,
		},
	}
}

func newMCPToolsListResponse(tools []MCPToolMapping, params mcpStdioListParams) (MCPToolsListResponse, error) {
	window, nextCursor, err := paginateMCPList(tools, params, "tools")
	if err != nil {
		return MCPToolsListResponse{}, err
	}
	listed := make([]MCPListedTool, 0, len(tools))
	for _, tool := range window {
		listed = append(listed, MCPListedTool{
			Name:                   tool.Name,
			CanonicalOperation:     tool.CanonicalOperation,
			Type:                   tool.Type,
			RequiredScope:          tool.RequiredScope,
			QuerySchemaRef:         tool.QuerySchemaRef,
			RequiresIdempotencyKey: tool.RequiresIdempotencyKey,
		})
	}
	return MCPToolsListResponse{Tools: listed, NextCursor: nextCursor}, nil
}

func newMCPResourcesListResponse(resources []MCPResourceMapping, params mcpStdioListParams) (MCPResourcesListResponse, error) {
	window, nextCursor, err := paginateMCPList(resources, params, "resources")
	if err != nil {
		return MCPResourcesListResponse{}, err
	}
	listed := make([]MCPResourceMapping, len(window))
	copy(listed, window)
	return MCPResourcesListResponse{Resources: listed, NextCursor: nextCursor}, nil
}

type jsonRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type jsonRPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id"`
	Result  any             `json:"result,omitempty"`
	Error   *jsonRPCError   `json:"error,omitempty"`
}

type jsonRPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

const (
	jsonRPCParseError     = -32700
	jsonRPCInvalidRequest = -32600
	jsonRPCMethodNotFound = -32601
	jsonRPCInvalidParams  = -32602
	jsonRPCInternalError  = -32603
)

type mcpStdioToolsCallParams struct {
	Name           string         `json:"name"`
	Arguments      map[string]any `json:"arguments"`
	RequestID      string         `json:"request_id"`
	IdempotencyKey string         `json:"idempotency_key"`
}

type mcpStdioResourcesReadParams struct {
	URI       string `json:"uri"`
	RequestID string `json:"request_id"`
}

type mcpStdioListParams struct {
	Cursor string `json:"cursor"`
	Limit  int    `json:"limit"`
}

func decodeJSONRPCParams[T any](raw json.RawMessage) (T, error) {
	var params T
	if len(raw) == 0 || string(raw) == "null" {
		return params, fmt.Errorf("params are required")
	}
	if err := json.Unmarshal(raw, &params); err != nil {
		return params, err
	}
	return params, nil
}

func decodeOptionalJSONRPCParams[T any](raw json.RawMessage) (T, error) {
	var params T
	if len(raw) == 0 || string(raw) == "null" {
		return params, nil
	}
	if err := json.Unmarshal(raw, &params); err != nil {
		return params, err
	}
	return params, nil
}

const mcpListCursorPrefix = "pb-list-v1:"

func paginateMCPList[T any](items []T, params mcpStdioListParams, kind string) ([]T, string, error) {
	if params.Limit < 0 {
		return nil, "", fmt.Errorf("list limit must be non-negative")
	}
	offset, err := mcpListCursorOffset(params.Cursor, kind)
	if err != nil {
		return nil, "", err
	}
	if offset >= len(items) {
		return []T{}, "", nil
	}
	end := len(items)
	if params.Limit > 0 && offset+params.Limit < end {
		end = offset + params.Limit
	}
	var nextCursor string
	if params.Limit > 0 && end < len(items) {
		nextCursor = mcpListCursor(kind, end)
	}
	return items[offset:end], nextCursor, nil
}

func mcpListCursor(kind string, offset int) string {
	return mcpListCursorPrefix + kind + ":" + strconv.Itoa(offset)
}

func mcpListCursorOffset(cursor string, expectedKind string) (int, error) {
	cursor = strings.TrimSpace(cursor)
	if cursor == "" {
		return 0, nil
	}
	if !strings.HasPrefix(cursor, mcpListCursorPrefix) {
		return 0, fmt.Errorf("list cursor is invalid")
	}
	rest := strings.TrimPrefix(cursor, mcpListCursorPrefix)
	kind, rawOffset, ok := strings.Cut(rest, ":")
	if !ok || kind != expectedKind || rawOffset == "" {
		return 0, fmt.Errorf("list cursor is invalid")
	}
	offset, err := strconv.Atoi(rawOffset)
	if err != nil || offset < 0 {
		return 0, fmt.Errorf("list cursor is invalid")
	}
	return offset, nil
}

func newJSONRPCResultResponse(id json.RawMessage, result any) jsonRPCResponse {
	return jsonRPCResponse{
		JSONRPC: "2.0",
		ID:      cloneJSONRawMessage(id),
		Result:  result,
	}
}

func newJSONRPCErrorResponse(id json.RawMessage, code int, message string) jsonRPCResponse {
	message = strings.TrimSpace(message)
	if message == "" {
		message = "JSON-RPC request failed"
	}
	return jsonRPCResponse{
		JSONRPC: "2.0",
		ID:      cloneJSONRawMessage(id),
		Error: &jsonRPCError{
			Code:    code,
			Message: sanitizeJSONRPCErrorMessage(message),
		},
	}
}

func requestIDFromJSONRPC(id json.RawMessage, explicit string) string {
	explicit = strings.TrimSpace(explicit)
	if explicit != "" {
		return explicit
	}
	id = cloneJSONRawMessage(id)
	if len(id) == 0 || string(id) == "null" {
		return ""
	}
	var text string
	if err := json.Unmarshal(id, &text); err == nil {
		return strings.TrimSpace(text)
	}
	return safeIDSegment(string(id))
}

func cloneJSONRawMessage(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return nil
	}
	cloned := make(json.RawMessage, len(raw))
	copy(cloned, raw)
	return cloned
}

func sanitizeJSONRPCErrorMessage(message string) string {
	if containsCredentialBearingText(message) {
		return "JSON-RPC request failed"
	}
	return message
}
