#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  verify-prod-routeability-readonly.sh

Read-only production routeability verification for the Company 1 Codex API key.

Environment:
  GETTOKENS_VERIFY_BASE_URL         Management base URL. Default: http://127.0.0.1:8317
  GETTOKENS_VERIFY_MANAGEMENT_KEY   Management key. Default: gettokens-local-management-key
  GETTOKENS_VERIFY_ACCOUNT_KEY      Account key to verify.
  GETTOKENS_VERIFY_MODEL_PRIMARY    Primary model for explain/models checks. Default: gpt-5.4
  GETTOKENS_VERIFY_MODEL_SECONDARY  Secondary model for models check. Default: gpt-5.5
  GETTOKENS_VERIFY_EXPECTED_COMMIT  Expected sidecar commit.
  GETTOKENS_VERIFY_BUNDLE_META      Bundle sidecar meta path.
  GETTOKENS_VERIFY_LOG_PATH         Sidecar log path. Default: ~/.config/gettokens/sidecar.log
  GETTOKENS_VERIFY_LOG_TAIL_LINES   Recent log tail size. Default: 400
  GETTOKENS_VERIFY_SKIP_LOGS        Set to 1 to skip log tail checks.
  GETTOKENS_VERIFY_READY_RETRIES    HTTP retry count for readiness windows. Default: 10
  GETTOKENS_VERIFY_RETRY_DELAY_SECONDS
                                       Delay between retries. Default: 1
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

require_tool() {
  local tool="$1"
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "ERROR: required tool not found: $tool" >&2
    exit 1
  fi
}

json_value() {
  local json="$1"
  local filter="$2"
  jq -r "$filter // \"\"" <<<"$json"
}

curl_json() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local url="${BASE_URL}${path}"
  local response
  local status
  local attempt
  local curl_exit

  for ((attempt = 1; attempt <= READY_RETRIES; attempt += 1)); do
    set +e
    if [[ -n "$body" ]]; then
      response="$(
        curl -sS -w $'\n%{http_code}' \
          -X "$method" \
          -H "Authorization: Bearer ${MANAGEMENT_KEY}" \
          -H "Content-Type: application/json" \
          --data "$body" \
          "$url" \
          2>&1
      )"
      curl_exit=$?
    else
      response="$(
        curl -sS -w $'\n%{http_code}' \
          -X "$method" \
          -H "Authorization: Bearer ${MANAGEMENT_KEY}" \
          "$url" \
          2>&1
      )"
      curl_exit=$?
    fi
    set -e

    status="$(tail -n 1 <<<"$response")"
    response="$(sed '$d' <<<"$response")"
    if [[ "$curl_exit" -eq 0 && "$status" == 2* ]]; then
      jq -e . >/dev/null <<<"$response"
      printf '%s\n' "$response"
      return 0
    fi

    if [[ "$attempt" -lt "$READY_RETRIES" && ( "$curl_exit" -ne 0 || "$status" == "000" || "$status" == 503 ) ]]; then
      sleep "$RETRY_DELAY_SECONDS"
      continue
    fi
    break
  done

  echo "ERROR: ${method} ${path} returned HTTP ${status:-unknown}" >&2
  if [[ "${curl_exit:-0}" -ne 0 ]]; then
    echo "curl_exit=${curl_exit}" >&2
  fi
  if [[ -n "${response:-}" ]]; then
    jq -c '{error: (.error // .message // .code // "non-2xx"), status: (.status // empty)}' <<<"$response" 2>/dev/null || echo "$response" >&2
  fi
  exit 1
}

extract_port() {
  local url="$1"
  if [[ "$url" =~ ^https?://[^/:]+:([0-9]+)($|/) ]]; then
    printf '%s\n' "${BASH_REMATCH[1]}"
  fi
}

require_tool curl
require_tool jq

BASE_URL="${GETTOKENS_VERIFY_BASE_URL:-http://127.0.0.1:8317}"
BASE_URL="${BASE_URL%/}"
MANAGEMENT_KEY="${GETTOKENS_VERIFY_MANAGEMENT_KEY:-gettokens-local-management-key}"
ACCOUNT_KEY="${GETTOKENS_VERIFY_ACCOUNT_KEY:-acct_dd2172ea-9dd9-458a-88bd-590cc55a468c}"
MODEL_PRIMARY="${GETTOKENS_VERIFY_MODEL_PRIMARY:-gpt-5.4}"
MODEL_SECONDARY="${GETTOKENS_VERIFY_MODEL_SECONDARY:-gpt-5.5}"
EXPECTED_COMMIT="${GETTOKENS_VERIFY_EXPECTED_COMMIT:-688f29726719e01e1206d23db47017dea8028253}"
BUNDLE_META="${GETTOKENS_VERIFY_BUNDLE_META:-/Applications/GetTokens.app/Contents/MacOS/cli-proxy-api.meta.json}"
LOG_PATH="${GETTOKENS_VERIFY_LOG_PATH:-$HOME/.config/gettokens/sidecar.log}"
LOG_TAIL_LINES="${GETTOKENS_VERIFY_LOG_TAIL_LINES:-400}"
SKIP_LOGS="${GETTOKENS_VERIFY_SKIP_LOGS:-0}"
READY_RETRIES="${GETTOKENS_VERIFY_READY_RETRIES:-10}"
RETRY_DELAY_SECONDS="${GETTOKENS_VERIFY_RETRY_DELAY_SECONDS:-1}"

echo "== GetTokens routeability readonly verification =="
echo "base_url=${BASE_URL}"
echo "account_key=${ACCOUNT_KEY}"
echo "model_primary=${MODEL_PRIMARY}"
echo "model_secondary=${MODEL_SECONDARY}"

if [[ -f "$BUNDLE_META" ]]; then
  meta_json="$(jq -c . "$BUNDLE_META")"
  meta_commit="$(json_value "$meta_json" '.commit')"
  meta_dirty="$(json_value "$meta_json" '.dirty')"
  meta_fingerprint="$(json_value "$meta_json" '.fingerprint')"
  echo "bundle_meta=${BUNDLE_META}"
  echo "bundle_commit=${meta_commit:-unknown}"
  echo "bundle_dirty=${meta_dirty:-unknown}"
  echo "bundle_fingerprint=${meta_fingerprint:-unknown}"
  if [[ "$meta_commit" != "$EXPECTED_COMMIT" ]]; then
    echo "ERROR: production bundle sidecar commit does not match expected fixed commit." >&2
    echo "expected=${EXPECTED_COMMIT}" >&2
    echo "actual=${meta_commit:-unknown}" >&2
    echo "classification=old-or-unverified-build" >&2
    exit 20
  fi
else
  echo "ERROR: bundle sidecar meta not found: ${BUNDLE_META}" >&2
  echo "classification=unverified-build" >&2
  exit 20
fi

health_json="$(curl_json GET /healthz)"
health_status="$(json_value "$health_json" '.status')"
if [[ "$health_status" != "ok" ]]; then
  echo "ERROR: healthz status is not ok: ${health_status:-empty}" >&2
  exit 1
fi
echo "healthz=ok"

port="$(extract_port "$BASE_URL" || true)"
if [[ -n "$port" ]] && command -v lsof >/dev/null 2>&1; then
  echo "listen_processes:"
  lsof -nP -iTCP:"$port" -sTCP:LISTEN || true
fi

accounts_json="$(curl_json GET /v0/management/accounts)"
account_json="$(
  jq -c --arg key "$ACCOUNT_KEY" '
    def account_list:
      if type == "array" then .
      elif (.accounts? | type) == "array" then .accounts
      elif (.items? | type) == "array" then .items
      elif (.data?.accounts? | type) == "array" then .data.accounts
      else [] end;
    first(account_list[] | select((.account_key // .accountKey // .id // "") == $key)) // empty
  ' <<<"$accounts_json"
)"

if [[ -z "$account_json" ]]; then
  echo "ERROR: target account not found in management accounts." >&2
  exit 1
fi

account_title="$(json_value "$account_json" '.title // .displayName // .name')"
apply_status="$(json_value "$account_json" '.runtime_apply_status // .runtimeApplyStatus')"
routeability_status="$(json_value "$account_json" '.runtime_routeability_status // .runtimeRouteabilityStatus')"
registered_count="$(json_value "$account_json" '.runtime_registered_models_count // .runtimeRegisteredModelsCount')"
failure_class="$(json_value "$account_json" '.runtime_failure_class // .runtimeFailureClass')"
repair_outcome="$(json_value "$account_json" '.runtime_repair_outcome // .runtimeRepairOutcome')"

echo "account_title=${account_title:-unknown}"
echo "runtime_apply_status=${apply_status:-empty}"
echo "runtime_routeability_status=${routeability_status:-empty}"
echo "runtime_registered_models_count=${registered_count:-0}"
echo "runtime_failure_class=${failure_class:-empty}"
echo "runtime_repair_outcome=${repair_outcome:-empty}"

if [[ "$apply_status" != "applied" ]]; then
  echo "ERROR: runtime_apply_status is not applied." >&2
  exit 1
fi
if [[ "$routeability_status" != "registered_routeable" ]]; then
  echo "ERROR: runtime_routeability_status is not registered_routeable." >&2
  echo "classification=runtime-routeability-not-registered" >&2
  exit 1
fi
if [[ "${registered_count:-0}" -le 0 ]]; then
  echo "ERROR: runtime_registered_models_count is not positive." >&2
  exit 1
fi

explain_body="$(jq -cn --arg model "$MODEL_PRIMARY" '{channel:"codex", requestedModel:$model}')"
explain_json="$(curl_json POST /v0/management/gettokens/channel-routing/explain "$explain_body")"
candidate_json="$(
  jq -c --arg key "$ACCOUNT_KEY" '
    first((.candidates // [])[] | select((.id // .accountID // .account_key // "") == $key)) // empty
  ' <<<"$explain_json"
)"
filtered_json="$(
  jq -c --arg key "$ACCOUNT_KEY" '
    first((.filtered // [])[] | select((.id // .accountID // .account_key // "") == $key)) // empty
  ' <<<"$explain_json"
)"

selected_id="$(json_value "$explain_json" '.selectedAccountID // .selected_account_id')"
candidate_count="$(jq -r '(.candidates // []) | length' <<<"$explain_json")"
filtered_count="$(jq -r '(.filtered // []) | length' <<<"$explain_json")"
echo "explain_selected_account_id=${selected_id:-empty}"
echo "explain_candidates=${candidate_count}"
echo "explain_filtered=${filtered_count}"

if [[ -z "$candidate_json" ]]; then
  reason="$(json_value "${filtered_json:-{}}" '.reason')"
  echo "ERROR: target account is not present in explain candidates." >&2
  echo "filtered_reason=${reason:-not-present}" >&2
  echo "classification=explain-account-not-candidate" >&2
  exit 1
fi
route_ids="$(jq -r '(.routeIDs // .route_ids // []) | join(",")' <<<"$candidate_json")"
echo "explain_target_candidate=present"
echo "explain_target_route_ids=${route_ids:-empty}"

models_json="$(curl_json GET "/v0/management/accounts/${ACCOUNT_KEY}/models")"
missing_models="$(
  jq -r --arg primary "$MODEL_PRIMARY" --arg secondary "$MODEL_SECONDARY" '
    def model_list:
      if type == "array" then .
      elif (.models? | type) == "array" then .models
      elif (.items? | type) == "array" then .items
      elif (.data?.models? | type) == "array" then .data.models
      else [] end;
    def model_id: if type == "string" then . else (.id // .model // .name // "") end;
    [ $primary, $secondary ] as $expected
    | (model_list | map(model_id)) as $actual
    | $expected - $actual
    | join(",")
  ' <<<"$models_json"
)"
model_count="$(jq -r 'if type == "array" then length elif (.models? | type) == "array" then .models | length elif (.items? | type) == "array" then .items | length elif (.data?.models? | type) == "array" then .data.models | length else 0 end' <<<"$models_json")"
echo "models_count=${model_count}"

if [[ -n "$missing_models" ]]; then
  echo "ERROR: target account models missing expected entries: ${missing_models}" >&2
  echo "classification=models-missing" >&2
  exit 1
fi
echo "models_expected=present"

if [[ "$SKIP_LOGS" != "1" ]]; then
  if [[ -f "$LOG_PATH" ]]; then
    log_hits="$(
      tail -n "$LOG_TAIL_LINES" "$LOG_PATH" \
        | grep -E 'assignment to entry in nil map|ListAccounts.*no such column|routeability_status|failure_class' \
        || true
    )"
    if [[ -n "$log_hits" ]]; then
      echo "ERROR: recent sidecar log tail contains known routeability regression signatures." >&2
      echo "log_path=${LOG_PATH}" >&2
      echo "log_tail_lines=${LOG_TAIL_LINES}" >&2
      echo "$log_hits" >&2
      echo "classification=recent-log-regression-signature" >&2
      exit 1
    fi
    echo "recent_log_regression_signatures=absent"
  else
    echo "recent_log_regression_signatures=skipped-log-not-found"
  fi
else
  echo "recent_log_regression_signatures=skipped-by-env"
fi

echo "RESULT=verified-routeable"
