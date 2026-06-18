package protocolbridge

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestAuthorizeRejectsMissingScopeWithoutSidecar(t *testing.T) {
	runtime := NewRuntime(WithNow(fixedBridgeTime))
	client := bridgeTestClient("readonly-model-agent", "secret-token", []ScopeGrant{
		{Scope: ScopeModelsRead},
	}, []Transport{TransportOpenAIAdmin}, nil)

	result := runtime.Authorize(AuthorizeRequest{
		Operation: OperationRoutesDiagnostics,
		Transport: TransportOpenAIAdmin,
		Token:     "secret-token",
		Client:    client,
		RequestID: "brq_route_diag_001",
	})

	if result.Allowed {
		t.Fatalf("expected missing scope to be rejected")
	}
	if result.Error == nil || result.Error.Code != ErrorMissingScope {
		t.Fatalf("expected missing_scope error, got %#v", result.Error)
	}
	if len(result.RequiredScopes) != 1 || result.RequiredScopes[0] != ScopeRoutesDiagnosticsRead {
		t.Fatalf("unexpected required scopes: %#v", result.RequiredScopes)
	}
	if result.SidecarInvoked || result.Error.SidecarInvoked {
		t.Fatalf("missing scope must not invoke sidecar")
	}
	if result.AuditEvent == nil || result.AuditEvent.ResultStatus != StatusRejected || result.AuditEvent.ErrorCode != ErrorMissingScope {
		t.Fatalf("missing or invalid audit event: %#v", result.AuditEvent)
	}
}

func TestAuthorizeEnforcesLoopbackOnlyCallerContext(t *testing.T) {
	runtime := NewRuntime(WithNow(fixedBridgeTime))
	client := bridgeTestClient("loopback-agent", "secret-token", []ScopeGrant{
		{Scope: ScopeAccountsRead},
	}, []Transport{TransportOpenAIAdmin}, nil)
	client.LoopbackOnly = true

	tests := []struct {
		name    string
		caller  *CallerContext
		allowed bool
	}{
		{
			name: "non loopback peer rejected",
			caller: &CallerContext{
				PeerAddress: "192.0.2.10:58123",
			},
			allowed: false,
		},
		{
			name:    "missing caller rejected",
			caller:  nil,
			allowed: false,
		},
		{
			name: "loopback peer allowed",
			caller: &CallerContext{
				PeerAddress: "127.0.0.1:58123",
			},
			allowed: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := runtime.Authorize(AuthorizeRequest{
				Operation: OperationAccountsSummary,
				Transport: TransportOpenAIAdmin,
				Token:     "secret-token",
				Client:    client,
				RequestID: "brq_loopback_001",
				Caller:    tt.caller,
			})

			if result.Allowed != tt.allowed {
				t.Fatalf("allowed=%v, want %v, error=%#v", result.Allowed, tt.allowed, result.Error)
			}
			if tt.allowed {
				if result.Error != nil {
					t.Fatalf("allowed call should not include error: %#v", result.Error)
				}
				return
			}
			if result.Error == nil || result.Error.Code != ErrorInvalidRequest {
				t.Fatalf("expected canonical invalid_request, got %#v", result.Error)
			}
			if result.AuditEvent == nil || result.AuditEvent.ErrorCode != ErrorLoopbackRequired {
				t.Fatalf("expected loopback_required audit error, got %#v", result.AuditEvent)
			}
			if result.SidecarInvoked || result.Error.SidecarInvoked {
				t.Fatalf("loopback-only rejection must not invoke sidecar")
			}
		})
	}
}

func TestAuthorizeRequiresExactScopeAndDoesNotAllowWildcard(t *testing.T) {
	runtime := NewRuntime(WithNow(fixedBridgeTime))

	for _, scope := range []string{"bridge.accounts.*", "bridge.*", "bridge.accounts"} {
		client := bridgeTestClient("wildcard-agent", "secret-token", []ScopeGrant{
			{Scope: Scope(scope)},
		}, []Transport{TransportMCP}, nil)

		result := runtime.Authorize(AuthorizeRequest{
			Operation: OperationAccountsSummary,
			Transport: TransportMCP,
			Token:     "secret-token",
			Client:    client,
			RequestID: "brq_accounts_001",
		})

		if result.Allowed {
			t.Fatalf("scope %q must not authorize %s", scope, OperationAccountsSummary)
		}
		if result.Error == nil || result.Error.Code != ErrorMissingScope {
			t.Fatalf("scope %q expected missing_scope, got %#v", scope, result.Error)
		}
	}

	client := bridgeTestClient("accounts-agent", "secret-token", []ScopeGrant{
		{Scope: ScopeAccountsRead},
	}, []Transport{TransportMCP}, nil)
	result := runtime.Authorize(AuthorizeRequest{
		Operation: OperationAccountsSummary,
		Transport: TransportMCP,
		Token:     "secret-token",
		Client:    client,
		RequestID: "brq_accounts_002",
	})
	if !result.Allowed {
		t.Fatalf("exact scope should authorize, got %#v", result.Error)
	}
}

func TestAuthorizeActorScopesExcludeExpiredGrant(t *testing.T) {
	runtime := NewRuntime(WithNow(fixedBridgeTime))
	expired := fixedBridgeTime().Add(-time.Minute)
	client := bridgeTestClient("accounts-agent", "secret-token", []ScopeGrant{
		{Scope: ScopeAccountsRead},
		{Scope: ScopeModelsRead, ExpiresAt: &expired},
		{Scope: ScopeQuotaRead, Disabled: true},
	}, []Transport{TransportMCP}, nil)

	result := runtime.Authorize(AuthorizeRequest{
		Operation: OperationAccountsSummary,
		Transport: TransportMCP,
		Token:     "secret-token",
		Client:    client,
		RequestID: "brq_accounts_scopes_001",
	})

	if !result.Allowed {
		t.Fatalf("expected authorized read, got %#v", result.Error)
	}
	if got := result.Actor.Scopes; len(got) != 1 || got[0] != ScopeAccountsRead {
		t.Fatalf("actor scopes should include only active grants, got %#v", got)
	}
	if result.AuditEvent == nil {
		t.Fatalf("expected audit event")
	}
	if got := result.AuditEvent.Scopes; len(got) != 1 || got[0] != ScopeAccountsRead {
		t.Fatalf("audit scopes should include only active grants, got %#v", got)
	}
}

func TestAuthorizeRejectsDisabledExpiredAndTransportMismatch(t *testing.T) {
	runtime := NewRuntime(WithNow(fixedBridgeTime))
	expired := fixedBridgeTime().Add(-time.Minute)

	tests := []struct {
		name      string
		client    *Client
		transport Transport
		wantCode  ErrorCode
	}{
		{
			name: "disabled",
			client: bridgeTestClient("disabled-agent", "secret-token", []ScopeGrant{
				{Scope: ScopeAccountsRead},
			}, []Transport{TransportMCP}, nil),
			transport: TransportMCP,
			wantCode:  ErrorClientDisabled,
		},
		{
			name: "expired",
			client: bridgeTestClient("expired-agent", "secret-token", []ScopeGrant{
				{Scope: ScopeAccountsRead},
			}, []Transport{TransportMCP}, &expired),
			transport: TransportMCP,
			wantCode:  ErrorClientExpired,
		},
		{
			name: "transport mismatch",
			client: bridgeTestClient("mcp-only-agent", "secret-token", []ScopeGrant{
				{Scope: ScopeAccountsRead},
			}, []Transport{TransportMCP}, nil),
			transport: TransportOpenAIAdmin,
			wantCode:  ErrorTransportNotAllowed,
		},
	}
	tests[0].client.Disabled = true

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := runtime.Authorize(AuthorizeRequest{
				Operation: OperationAccountsSummary,
				Transport: tt.transport,
				Token:     "secret-token",
				Client:    tt.client,
				RequestID: "brq_reject_001",
			})
			if result.Allowed {
				t.Fatalf("expected rejection")
			}
			if result.Error == nil || result.Error.Code != ErrorInvalidRequest {
				t.Fatalf("expected canonical invalid_request, got %#v", result.Error)
			}
			if result.AuditEvent == nil || result.AuditEvent.ErrorCode != tt.wantCode {
				t.Fatalf("expected audit error %s, got %#v", tt.wantCode, result.AuditEvent)
			}
			if result.SidecarInvoked || result.Error.SidecarInvoked {
				t.Fatalf("%s must not invoke sidecar", tt.name)
			}
		})
	}
}

func TestAuthorizeRejectsSafeActionWithoutIdempotencyKey(t *testing.T) {
	runtime := NewRuntime(WithNow(fixedBridgeTime))
	client := bridgeTestClient("quota-agent", "secret-token", []ScopeGrant{
		{Scope: ScopeActionQuotaRefresh},
	}, []Transport{TransportA2A}, nil)

	result := runtime.Authorize(AuthorizeRequest{
		Operation: OperationActionQuotaRefresh,
		Transport: TransportA2A,
		Token:     "secret-token",
		Client:    client,
		RequestID: "brq_quota_refresh_001",
	})

	if result.Allowed {
		t.Fatalf("safe action without idempotency key should be rejected")
	}
	if result.Error == nil || result.Error.Code != ErrorInvalidRequest {
		t.Fatalf("expected invalid_request, got %#v", result.Error)
	}
	if result.AuditEvent == nil || result.AuditEvent.ErrorCode != ErrorMissingIdempotencyKey {
		t.Fatalf("expected missing idempotency audit error, got %#v", result.AuditEvent)
	}
	if result.SidecarInvoked || result.Error.SidecarInvoked {
		t.Fatalf("missing idempotency must not invoke sidecar")
	}
}

func TestAuthorizeSuccessReadAuthorityOwnerRemainsSidecar(t *testing.T) {
	runtime := NewRuntime(WithNow(fixedBridgeTime))
	client := bridgeTestClient("accounts-agent", "secret-token", []ScopeGrant{
		{Scope: ScopeAccountsRead},
	}, []Transport{TransportMCP}, nil)

	result := runtime.Authorize(AuthorizeRequest{
		Operation: OperationAccountsSummary,
		Transport: TransportMCP,
		Token:     "secret-token",
		Client:    client,
		RequestID: "brq_accounts_001",
	})

	if !result.Allowed {
		t.Fatalf("expected authorized read, got %#v", result.Error)
	}
	if result.Status != StatusOK {
		t.Fatalf("expected ok status, got %s", result.Status)
	}
	if result.Authority.Owner != AuthorityOwnerSidecar {
		t.Fatalf("bridge must not own read authority: %#v", result.Authority)
	}
	if result.Actor.ClientID != "accounts-agent" || result.Actor.AuthSubject != "bridge-token:"+client.TokenHashPrefix {
		t.Fatalf("unexpected actor: %#v", result.Actor)
	}
	if result.Audit.Redaction != RedactionSecretsAndHeadersRemoved {
		t.Fatalf("unexpected audit projection: %#v", result.Audit)
	}
}

func TestAuthorizeAuditDoesNotExposeRawTokenOrIdempotencyKey(t *testing.T) {
	runtime := NewRuntime(WithNow(fixedBridgeTime))
	rawToken := "secret-token"
	rawIdempotency := "idem-secret-key"
	client := bridgeTestClient("quota-agent", rawToken, []ScopeGrant{
		{Scope: ScopeActionQuotaRefresh},
	}, []Transport{TransportA2A}, nil)

	result := runtime.Authorize(AuthorizeRequest{
		Operation:      OperationActionQuotaRefresh,
		Transport:      TransportA2A,
		Token:          rawToken,
		Client:         client,
		RequestID:      "brq_quota_refresh_001",
		IdempotencyKey: rawIdempotency,
	})

	if !result.Allowed {
		t.Fatalf("expected authorized action, got %#v", result.Error)
	}
	if result.AuditEvent == nil || result.AuditEvent.IdempotencyKeyHash == "" {
		t.Fatalf("expected idempotency key hash in audit event: %#v", result.AuditEvent)
	}
	payload, err := json.Marshal(struct {
		Event      *AuditEvent     `json:"event"`
		Projection AuditProjection `json:"projection"`
		Result     AuthorizeResult `json:"result"`
	}{Event: result.AuditEvent, Projection: result.Audit, Result: result})
	if err != nil {
		t.Fatalf("marshal audit payload: %v", err)
	}
	text := string(payload)
	for _, forbidden := range []string{rawToken, rawIdempotency} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("audit/result payload leaked raw secret %q: %s", forbidden, text)
		}
	}
	if !strings.Contains(text, HashSecret(rawIdempotency)) {
		t.Fatalf("audit payload should contain idempotency hash, got %s", text)
	}
}

func TestMCPAdapterMappingFixtureAlignsWithOperationSpecs(t *testing.T) {
	fixturePath := filepath.Join("..", "..", "docs-linhay", "spaces", "20260616-protocol-bridge-surfaces", "schemas", "mcp-adapter-mapping-v01.json")
	raw, err := os.ReadFile(fixturePath)
	if err != nil {
		t.Fatalf("read MCP mapping fixture: %v", err)
	}

	mapping, err := LoadMCPAdapterMapping(raw)
	if err != nil {
		t.Fatalf("load MCP mapping fixture: %v", err)
	}
	if err := ValidateMCPAdapterMapping(mapping); err != nil {
		t.Fatalf("validate MCP mapping fixture: %v", err)
	}
}

func bridgeTestClient(id string, rawToken string, scopes []ScopeGrant, transports []Transport, expiresAt *time.Time) *Client {
	tokenHash := HashSecret(rawToken)
	return &Client{
		ID:                 id,
		DisplayName:        id,
		TokenHash:          tokenHash,
		TokenHashPrefix:    HashPrefix(tokenHash),
		TransportAllowlist: transports,
		ScopeGrants:        scopes,
		ExpiresAt:          expiresAt,
	}
}

func fixedBridgeTime() time.Time {
	return time.UnixMilli(1781587320000).UTC()
}
