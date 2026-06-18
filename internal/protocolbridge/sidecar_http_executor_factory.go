package protocolbridge

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type SidecarHTTPEndpoint struct {
	ProfileID string
	BaseURL   string
}

type SidecarHTTPExecutorBearerTokenProvider func(context.Context, SidecarHTTPEndpoint) (string, error)

type SidecarHTTPExecutorOption func(*sidecarHTTPExecutorConfig)

type sidecarHTTPExecutorConfig struct {
	transport     sidecarHTTPTransportConfig
	tokenProvider SidecarHTTPExecutorBearerTokenProvider
}

type sidecarHTTPEndpointExecutor struct {
	endpoint      SidecarHTTPEndpoint
	parsedBaseURL *url.URL
	transport     sidecarHTTPTransportConfig
	tokenProvider SidecarHTTPExecutorBearerTokenProvider
}

func NewSidecarHTTPExecutorFromEndpoint(endpoint SidecarHTTPEndpoint, options ...SidecarHTTPExecutorOption) (OperationExecutor, error) {
	normalizedEndpoint, parsedBaseURL, err := normalizeSidecarHTTPEndpoint(endpoint)
	if err != nil {
		return nil, err
	}

	config := sidecarHTTPExecutorConfig{}
	for _, option := range options {
		if option != nil {
			option(&config)
		}
	}

	return &sidecarHTTPEndpointExecutor{
		endpoint:      normalizedEndpoint,
		parsedBaseURL: parsedBaseURL,
		transport:     config.transport,
		tokenProvider: config.tokenProvider,
	}, nil
}

func WithSidecarHTTPExecutorClient(client *http.Client) SidecarHTTPExecutorOption {
	return func(config *sidecarHTTPExecutorConfig) {
		if config == nil || client == nil {
			return
		}
		config.transport.client = client
	}
}

func WithSidecarHTTPExecutorTimeout(timeout time.Duration) SidecarHTTPExecutorOption {
	return func(config *sidecarHTTPExecutorConfig) {
		if config == nil || timeout <= 0 {
			return
		}
		config.transport.timeout = timeout
	}
}

func WithSidecarHTTPExecutorBearerToken(token string) SidecarHTTPExecutorOption {
	return func(config *sidecarHTTPExecutorConfig) {
		if config == nil {
			return
		}
		config.transport.bearerToken = strings.TrimSpace(token)
	}
}

func WithSidecarHTTPExecutorBearerTokenProvider(provider SidecarHTTPExecutorBearerTokenProvider) SidecarHTTPExecutorOption {
	return func(config *sidecarHTTPExecutorConfig) {
		if config == nil || provider == nil {
			return
		}
		config.tokenProvider = provider
	}
}

func (e *sidecarHTTPEndpointExecutor) Execute(ctx context.Context, req OperationRequest) (OperationResult, error) {
	if e == nil || e.parsedBaseURL == nil {
		return OperationResult{}, fmt.Errorf("sidecar HTTP endpoint executor is not configured")
	}
	if err := validateSidecarAuthorityForRequest(req); err != nil {
		return OperationResult{}, err
	}
	transport, err := e.transportForExecute(ctx)
	if err != nil {
		return OperationResult{}, err
	}
	return NewSidecarHTTPExecutor(transport).Execute(ctx, req)
}

func (e *sidecarHTTPEndpointExecutor) transportForExecute(ctx context.Context) (SidecarTransport, error) {
	config := sidecarHTTPTransportConfig{
		client:      e.transport.client,
		timeout:     e.transport.timeout,
		bearerToken: strings.TrimSpace(e.transport.bearerToken),
	}
	if e.tokenProvider != nil {
		token, err := e.tokenProvider(ctx, e.endpoint)
		if err != nil {
			return nil, sidecarUnavailableError("sidecar auth token unavailable", "transport_auth_unavailable", true)
		}
		if trimmed := strings.TrimSpace(token); trimmed != "" {
			config.bearerToken = trimmed
		}
	}
	return newRealSidecarHTTPTransport(e.parsedBaseURL, config)
}

func normalizeSidecarHTTPEndpoint(endpoint SidecarHTTPEndpoint) (SidecarHTTPEndpoint, *url.URL, error) {
	normalized := SidecarHTTPEndpoint{
		ProfileID: strings.TrimSpace(endpoint.ProfileID),
		BaseURL:   strings.TrimSpace(endpoint.BaseURL),
	}
	if normalized.ProfileID == "" {
		return SidecarHTTPEndpoint{}, nil, fmt.Errorf("sidecar HTTP executor: endpoint profile ID is required")
	}
	parsedBaseURL, err := parseSidecarHTTPBaseURL(normalized.BaseURL)
	if err != nil {
		return SidecarHTTPEndpoint{}, nil, err
	}
	normalized.BaseURL = parsedBaseURL.String()
	return normalized, parsedBaseURL, nil
}

func validateSidecarAuthorityForRequest(req OperationRequest) error {
	spec, ok := operationSpecs[req.Operation]
	if !ok {
		return nil
	}
	if strings.TrimSpace(req.Authority.Owner) != AuthorityOwnerSidecar {
		return &canonicalExecutorError{
			Code:             ErrorInvalidRequest,
			Message:          "sidecar authority owner is required",
			Recoverable:      false,
			SidecarErrorCode: "authority_owner_invalid",
		}
	}
	authorityEndpoint := strings.TrimSpace(req.Authority.Endpoint)
	if authorityEndpoint == "" {
		return &canonicalExecutorError{
			Code:             ErrorInvalidRequest,
			Message:          "sidecar authority endpoint is required",
			Recoverable:      false,
			SidecarErrorCode: "authority_endpoint_missing",
		}
	}
	if authorityEndpoint != spec.Endpoint {
		return &canonicalExecutorError{
			Code:             ErrorInvalidRequest,
			Message:          "sidecar authority endpoint mismatch",
			Recoverable:      false,
			SidecarErrorCode: "authority_endpoint_mismatch",
		}
	}
	return nil
}
