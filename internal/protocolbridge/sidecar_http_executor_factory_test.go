package protocolbridge

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
)

func TestNewSidecarHTTPExecutorFromEndpointRejectsInvalidEndpoint(t *testing.T) {
	tests := []struct {
		name     string
		endpoint SidecarHTTPEndpoint
	}{
		{
			name: "missing profile id",
			endpoint: SidecarHTTPEndpoint{
				BaseURL: "http://127.0.0.1:8080",
			},
		},
		{
			name: "empty base url",
			endpoint: SidecarHTTPEndpoint{
				ProfileID: "dev-profile",
			},
		},
		{
			name: "non loopback host",
			endpoint: SidecarHTTPEndpoint{
				ProfileID: "dev-profile",
				BaseURL:   "https://example.com",
			},
		},
		{
			name: "userinfo not allowed",
			endpoint: SidecarHTTPEndpoint{
				ProfileID: "dev-profile",
				BaseURL:   "http://user:pass@127.0.0.1:8080",
			},
		},
		{
			name: "query not allowed",
			endpoint: SidecarHTTPEndpoint{
				ProfileID: "dev-profile",
				BaseURL:   "http://127.0.0.1:8080/api?token=raw-secret-token",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var providerCalls int32
			executor, err := NewSidecarHTTPExecutorFromEndpoint(tt.endpoint, WithSidecarHTTPExecutorBearerTokenProvider(func(_ context.Context, endpoint SidecarHTTPEndpoint) (string, error) {
				atomic.AddInt32(&providerCalls, 1)
				return "sidecar-bearer-secret-for-" + endpoint.ProfileID, nil
			}))
			if err == nil {
				t.Fatalf("expected invalid endpoint error, got executor=%#v", executor)
			}
			if got := atomic.LoadInt32(&providerCalls); got != 0 {
				t.Fatalf("token provider should not be called on invalid endpoint, got %d", got)
			}
		})
	}
}

func TestSidecarHTTPExecutorFromEndpointRejectsAuthorityMismatchBeforeSidecar(t *testing.T) {
	tests := []struct {
		name                 string
		authority            Authority
		wantMessage          string
		wantSidecarErrorCode string
	}{
		{
			name: "non sidecar owner",
			authority: Authority{
				Owner:             "bridge",
				Endpoint:          "/v0/management/gettokens/accounts/summary",
				GeneratedAtUnixMs: fixedBridgeTime().UnixMilli(),
			},
			wantMessage:          "sidecar authority owner is required",
			wantSidecarErrorCode: "authority_owner_invalid",
		},
		{
			name: "endpoint mismatch",
			authority: Authority{
				Owner:             AuthorityOwnerSidecar,
				Endpoint:          "/v0/management/gettokens/models/supported",
				GeneratedAtUnixMs: fixedBridgeTime().UnixMilli(),
			},
			wantMessage:          "sidecar authority endpoint mismatch",
			wantSidecarErrorCode: "authority_endpoint_mismatch",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var providerCalls int32
			executor, err := NewSidecarHTTPExecutorFromEndpoint(SidecarHTTPEndpoint{
				ProfileID: "dev-profile",
				BaseURL:   "http://127.0.0.1:8080",
			}, WithSidecarHTTPExecutorBearerTokenProvider(func(context.Context, SidecarHTTPEndpoint) (string, error) {
				atomic.AddInt32(&providerCalls, 1)
				return "sidecar-bearer-secret", nil
			}))
			if err != nil {
				t.Fatalf("create endpoint executor: %v", err)
			}

			_, err = executor.Execute(context.Background(), OperationRequest{
				Version:   Version,
				RequestID: "brq_accounts_factory_invalid_010",
				Transport: TransportMCP,
				Operation: OperationAccountsSummary,
				Query: map[string]any{
					"include_disabled": false,
				},
				Actor: Actor{
					ClientID:    "mcp-accounts-agent",
					AuthSubject: "bridge-token:abcd1234",
					Scopes:      []Scope{ScopeAccountsRead},
				},
				Authority: tt.authority,
				Caller:    &CallerContext{PeerAddress: "127.0.0.1:51515"},
			})
			if err == nil {
				t.Fatal("expected authority validation error")
			}

			var canonicalErr *canonicalExecutorError
			if !errors.As(err, &canonicalErr) {
				t.Fatalf("expected canonicalExecutorError, got %T: %v", err, err)
			}
			if canonicalErr.Code != ErrorInvalidRequest || canonicalErr.Recoverable {
				t.Fatalf("unexpected canonical error: %#v", canonicalErr)
			}
			if canonicalErr.Message != tt.wantMessage || canonicalErr.SidecarErrorCode != tt.wantSidecarErrorCode {
				t.Fatalf("unexpected canonical error detail: %#v", canonicalErr)
			}
			if got := atomic.LoadInt32(&providerCalls); got != 0 {
				t.Fatalf("token provider should not be called on authority mismatch, got %d", got)
			}
		})
	}
}
