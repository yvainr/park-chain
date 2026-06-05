#!/usr/bin/env bash
set -euo pipefail

input_path="${1:-gas-usage-trace.txt}"
output_path="${2:-gas-usage-table.md}"

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

{
  echo "# Gas Usage Table"
  echo
  echo "| Contract | Action | Gas Used | ETH at 1 gwei | ETH at 10 gwei | ETH at 30 gwei |"
  echo "|---|---|---:|---:|---:|---:|"

  while IFS= read -r row; do
    contract_name="$(sed -n 's/.*contractName: "\([^"]*\)".*/\1/p' <<< "$row")"
    action="$(sed -n 's/.*action: "\([^"]*\)".*/\1/p' <<< "$row")"
    gas_used="$(sed -n 's/.*gasUsed: \([0-9]*\).*/\1/p' <<< "$row")"
    one_gwei="$(sed -n 's/.*costWeiAtOneGwei: \([0-9]*\).*/\1/p' <<< "$row")"
    ten_gwei="$(sed -n 's/.*costWeiAtTenGwei: \([0-9]*\).*/\1/p' <<< "$row")"
    thirty_gwei="$(sed -n 's/.*costWeiAtThirtyGwei: \([0-9]*\).*/\1/p' <<< "$row")"

    echo "| \`$contract_name\` | \`$action\` | $(format_int "$gas_used") | $(wei_to_eth "$one_gwei") | $(wei_to_eth "$ten_gwei") | $(wei_to_eth "$thirty_gwei") |"
  done < "$tmp_rows"

  echo
  echo "_Generated from \`GasUsageTableTest\`._"
} > "$output_path"

rm "$tmp_rows"
