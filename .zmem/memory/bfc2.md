---
id: bfc2
type: core_requirement
tags:
- plugins
- authoring
status: active
created_at: '2026-04-08T03:17:08Z'
updated_at: '2026-04-08T03:17:08Z'
metadata: {}
custom: {}
---

# Keep plugin authoring lightweight: plugin.json plus a single main.js or main.py entrypoint.

## Context
- A major differentiator from Eagle's native extension flow is that plugin authors should not need a complex project structure.
- Legacy project notes repeatedly frame the author experience around a minimal manifest and a single executable script file.

## Content
- Supported plugin packages are built around plugin.json and either main.js or main.py.
- The execution contract is intentionally simple so plugins can be shared as small zip files from GitHub releases, gists, or other hosts.
- The platform should avoid introducing mandatory build steps into the plugin authoring path.

## Consequences / notes
- New capabilities should preserve the single-entrypoint mental model where possible.
- Documentation and examples should continue to emphasize lightweight packaging over framework-heavy plugin scaffolds.
