package wailsapp

import (
	"encoding/json"
	"testing"
)

func TestNormalizeAuthIndex(t *testing.T) {
	tests := []struct {
		name  string
		value interface{}
		want  string
	}{
		{name: "string", value: " auth-1 ", want: "auth-1"},
		{name: "json number", value: json.Number("12"), want: "12"},
		{name: "float", value: float64(7), want: "7"},
		{name: "int", value: 9, want: "9"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := normalizeAuthIndex(tt.value); got != tt.want {
				t.Fatalf("normalizeAuthIndex(%#v) = %q, want %q", tt.value, got, tt.want)
			}
		})
	}
}

func TestManagementAPICallResponseStatusCode(t *testing.T) {
	if got := (managementAPICallResponse{StatusCodeSnake: 201, StatusCodeCamel: 200}).statusCode(); got != 201 {
		t.Fatalf("unexpected snake status code: %d", got)
	}
	if got := (managementAPICallResponse{StatusCodeCamel: 204}).statusCode(); got != 204 {
		t.Fatalf("unexpected camel status code: %d", got)
	}
}
