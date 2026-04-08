---
id: a7ec
type: tech_setup
tags:
- v2
- seeds
- generation
- workflow
status: active
created_at: '2026-04-08T23:43:12Z'
updated_at: '2026-04-08T23:43:12Z'
metadata: {}
custom:
  summary: Bundled seed modules are generated dynamically from fixture packages into src/app/seeds, staged on pre-commit, and validated with build on pre-push.
---

# Bundled local plugin seeds are generated dynamically from fixture packages into src/app/seeds, and lefthook keeps generated output and validation aligned with that workflow.

## Context

Bundled local plugin seeds should not be maintained as hand-edited source files. The source of truth is the fixture package content under src/fixtures, and the host consumes generated seed modules from src/app/seeds.

## Content

The seed generator discovers fixture packages under src/fixtures by looking for nested plugin.json roots, emits one generated seed module per discovered fixture, and writes a generated barrel at src/app/seeds/index.ts.

The standard refresh command is pnpm generate:seeds. Lefthook pre-commit runs that command and stages src/app/seeds so generated artifacts stay in sync with fixture changes.

Full build validation belongs on pre-push rather than pre-commit so commits stay fast while pushes still verify that generated seeds and the host build remain compatible.

## Consequences / notes

Adding a new bundled fixture package only requires placing it under src/fixtures in the expected package layout and regenerating seeds; the generator should discover it without needing a hardcoded seed list.

Any manual edits under src/app/seeds will be overwritten by generation and should be treated as drift.
