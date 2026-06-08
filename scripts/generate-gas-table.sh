#!/usr/bin/env bash
set -euo pipefail

input_path="${1:-gas-usage-trace.txt}"
output_path="${2:-gas-usage-table.md}"
# Optional: ETH price in USD to compute approximate USD cost (default: 2000)
eth_price_usd="${3:-2000}"
# Optional: L2 gas price in gwei to estimate L2 USD cost (default: 1 gwei)
l2_gwei="${4:-1}"
# Optional: previous gas table markdown to compare against
baseline_path="${5:-}"

tmp_rows="$(mktemp)"
grep 'emit GasTableRow' "$input_path" > "$tmp_rows"

if [ ! -s "$tmp_rows" ]; then
  echo "No GasTableRow events found in Forge trace output." >&2
  exit 1
fi

wei_to_eth() {
  local wei="$1"
  awk -v wei="$wei" 'BEGIN { printf "%.6f", wei / 1000000000000000000 }'
}

format_int() {
  local value="$1"
  awk -v value="$value" 'BEGIN {
    text = sprintf("%d", value)
    out = ""
    while (length(text) > 3) {
      out = "," substr(text, length(text) - 2) out
      text = substr(text, 1, length(text) - 3)
    }
    print text out
  }'
}

trim_cell() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  value="${value#\`}"
  value="${value%\`}"
  printf '%s' "$value"
}

lookup_previous_gas() {
  local contract_name="$1"
  local action="$2"

  if [ -z "$baseline_path" ] || [ ! -s "$baseline_path" ]; then
    return 0
  fi

  while IFS='|' read -r _ previous_contract previous_action previous_gas _; do
    previous_contract="$(trim_cell "$previous_contract")"
    previous_action="$(trim_cell "$previous_action")"
    previous_gas="$(trim_cell "$previous_gas")"
    previous_gas="${previous_gas//,/}"

    if [ "$previous_contract" = "$contract_name" ] && [ "$previous_action" = "$action" ] && [[ "$previous_gas" =~ ^[0-9]+$ ]]; then
      printf '%s' "$previous_gas"
      return 0
    fi
  done < "$baseline_path"
}

format_delta() {
  local current="$1"
  local previous="$2"

  if [ -z "$previous" ]; then
    printf 'n/a'
    return 0
  fi

  awk -v current="$current" -v previous="$previous" 'BEGIN {
    delta = current - previous
    if (delta > 0) {
      printf "+%d", delta
    } else {
      printf "%d", delta
    }
  }'
}

format_delta_percent() {
  local current="$1"
  local previous="$2"

  if [ -z "$previous" ] || [ "$previous" = "0" ]; then
    printf 'n/a'
    return 0
  fi

  awk -v current="$current" -v previous="$previous" 'BEGIN {
    pct = ((current - previous) / previous) * 100
    if (pct > 0) {
      printf "+%.2f%%", pct
    } else {
      printf "%.2f%%", pct
    }
  }'
}

has_baseline=false
if [ -n "$baseline_path" ] && [ -s "$baseline_path" ]; then
  has_baseline=true
fi

{
  echo "# Gas Usage Table"
  echo

  if [ "$has_baseline" = true ]; then
    echo "## Gas Compare"
    echo
    echo "| Contract | Action | Current Gas | Previous Gas | Delta | Delta % |"
    echo "|---|---|---:|---:|---:|---:|"

    while IFS= read -r row; do
      contract_name="$(sed -n 's/.*contractName: "\([^"]*\)".*/\1/p' <<< "$row")"
      action="$(sed -n 's/.*action: "\([^"]*\)".*/\1/p' <<< "$row")"
      gas_used="$(sed -n 's/.*gasUsed: \([0-9]*\).*/\1/p' <<< "$row")"
      previous_gas="$(lookup_previous_gas "$contract_name" "$action")"

      if [ -n "$previous_gas" ]; then
        previous_display="$(format_int "$previous_gas")"
      else
        previous_display="n/a"
      fi

      echo "| \`$contract_name\` | \`$action\` | $(format_int "$gas_used") | $previous_display | $(format_delta "$gas_used" "$previous_gas") | $(format_delta_percent "$gas_used" "$previous_gas") |"
    done < "$tmp_rows"

    echo
    echo "<details>"
    echo "<summary>Detailed gas cost table</summary>"
    echo
  else
    echo "_No previous gas table was provided, so this run only shows current gas usage._"
    echo
  fi

  echo "| Contract | Action | Gas Used | ETH at 1 gwei | ETH at 10 gwei | ETH at 30 gwei | Deploy Cost (ETH at 30 gwei) | Approx USD (30 gwei) | Approx USD (L2 ${l2_gwei} gwei) |"
  echo "|---|---|---:|---:|---:|---:|---:|---:|---:|"

  while IFS= read -r row; do
    contract_name="$(sed -n 's/.*contractName: "\([^"]*\)".*/\1/p' <<< "$row")"
    action="$(sed -n 's/.*action: "\([^"]*\)".*/\1/p' <<< "$row")"
    gas_used="$(sed -n 's/.*gasUsed: \([0-9]*\).*/\1/p' <<< "$row")"
    one_gwei="$(sed -n 's/.*costWeiAtOneGwei: \([0-9]*\).*/\1/p' <<< "$row")"
    ten_gwei="$(sed -n 's/.*costWeiAtTenGwei: \([0-9]*\).*/\1/p' <<< "$row")"
    thirty_gwei="$(sed -n 's/.*costWeiAtThirtyGwei: \([0-9]*\).*/\1/p' <<< "$row")"
    # try to extract an optional deploy cost (in wei) if present in the trace
    deploy_cost_wei="$(sed -n 's/.*deployCostWei: \([0-9]*\).*/\1/p' <<< "$row" || true)"
    if [ -n "$deploy_cost_wei" ]; then
      deploy_cost_eth="$(wei_to_eth "$deploy_cost_wei")"
    else
      deploy_cost_eth=""
    fi

    thirty_eth="$(wei_to_eth "$thirty_gwei")"
    approx_usd="$(awk -v eth="$thirty_eth" -v price="$eth_price_usd" 'BEGIN { printf "%.2f", eth * price }')"

    # L2 USD: use the one_gwei value scaled by l2_gwei
    approx_l2_usd="$(awk -v onewei="$one_gwei" -v l2="$l2_gwei" -v price="$eth_price_usd" 'BEGIN { eth = (onewei * l2) / 1000000000000000000; printf "%.2f", eth * price }')"

    echo "| \`$contract_name\` | \`$action\` | $(format_int "$gas_used") | $(wei_to_eth "$one_gwei") | $(wei_to_eth "$ten_gwei") | $(wei_to_eth "$thirty_gwei") | $deploy_cost_eth | $approx_usd | $approx_l2_usd |"
  done < "$tmp_rows"

  if [ "$has_baseline" = true ]; then
    echo
    echo "</details>"
  fi

  echo
  echo "_Generated from \`GasUsageTableTest\`. Approx USD assumes \$$eth_price_usd per ETH and uses the 30 gwei column._"
} > "$output_path"

rm "$tmp_rows"
