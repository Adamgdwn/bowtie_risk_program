# Agent Instructions — bowtie_risk_program

## CNS Role

This repository is a product circuit in the Guided AI Labs Agentic OS CNS body.

**CNS role:** Risk + control modelling circuit.

**Relationship to the 3-layer core:**
- Freedom (executive cognition) orchestrates cross-circuit decisions
- GAIL OS (autonomic management) classifies and authorizes all structured events from this circuit
- Graphify (relationship intelligence) maps this circuit's entities and signals

**Phase 5 integration (planned):** This repo will emit structured events to GAIL OS:
`risk.identified`, `control.applied`, `risk_program.updated`.

**Prerequisite:** CP-1 (GAIL OS HTTP API + event contracts) must be cleared before
Phase 5 integration begins. Do not implement event emission until CP-1 is confirmed.

For cross-repo coordination state, see
`agentic-multi-agent-agent-builder/docs/build-control/`.

## Normal Startup

1. Run `git status --short` — preserve unrelated changes from other sessions.
2. Read this file.
3. Inspect only the files or docs relevant to the task; avoid broad scans.
4. Run proportional validation after the change.

## Secret Handling

Do not print, commit, log, or screenshot secret values or environment files.
