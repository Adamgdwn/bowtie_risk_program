#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -n "${GOVERNANCE_HOME:-}" && -f "${GOVERNANCE_HOME}/automation/governance_check.sh" ]]; then
  bash "${GOVERNANCE_HOME}/automation/governance_check.sh" "${repo_root}"
else
  echo "GOVERNANCE_HOME is not set to the governance repository."
  echo "Set GOVERNANCE_HOME and rerun, or copy a local governance check into this repository."
  exit 1
fi

