---
id: f1dc
type: core_requirement
tags:
- plugins
- authoring
- v2
status: active
created_at: '2026-04-08T18:23:09Z'
updated_at: '2026-04-08T18:23:09Z'
metadata: {}
custom: {}
---

# Keep plugin authoring build-step free while using the v2 convention-based package contract of plugin.js, ui.json, state.js, actions, data, and render files.

## Context
- The design-v2 document keeps authoring lightweight, but it does so through conventions and native ESM rather than a single plugin.json plus main.js or main.py pair.
- The old authoring requirement prioritized low ceremony and instant sharing, which remains valid, but the concrete file contract has changed.

## Content
- A v2 plugin package is defined by its folder structure: plugin.js, ui.json, state.js, optional migration.js, data files, action files, and render templates.
- The manifest lives in a named static export inside plugin.js and must stay statically extractable.
- ui.json owns UI structure, actions own imperative behavior, data files stay pure and runtime-free, state.js owns reactive state, and render templates own list or card presentation.
- Plugin authors should not need a bundler or repository-side build pipeline to ship a working plugin zip.
- The lightweight authoring goal is preserved by native ESM and conventions, not by collapsing everything into one large script.

## Consequences / notes
- Review of plugin authoring changes should preserve the no-bundler, easy-share intent even when the file layout becomes more structured.
- Documentation and examples should teach the folder contract directly instead of falling back to plugin.json or main.js language.
- Compatibility decisions should assume v2 plugin packages, not the legacy single-entrypoint format.
