#!/usr/bin/env bash
# Lists class selectors defined in frontend/src/styles that have no literal
# match in frontend/src TS/TSX (tests excluded). Run from the repository root.
# Class names built dynamically (template strings, maps) show up as false
# positives, as do third-party classes styled from our CSS (e.g. recharts-*) —
# confirm each candidate manually before deleting.
set -euo pipefail

src="${1:-frontend/src}"

rg -o --no-filename -g '*.css' '\.[a-zA-Z_][a-zA-Z0-9_-]*' "$src/styles" \
  | sed 's/^\.//' \
  | sort -u \
  | while read -r cls; do
      if ! rg -q --fixed-strings -g '*.ts' -g '*.tsx' -g '!*.test.*' -- "$cls" "$src"; then
        echo "$cls"
      fi
    done
