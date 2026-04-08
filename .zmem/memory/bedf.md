---
id: bedf
type: design_pattern
tags:
- python
- execution
- manifest
status: active
created_at: '2026-04-08T03:21:21Z'
updated_at: '2026-04-08T03:21:21Z'
metadata: {}
custom: {}
---

# Python execution mode is manifest-driven: onStart enables automatic runs, while other scripts expose manual execute and clear controls.

## Context
- Python script plugins support multiple run modes, and the docs define those modes through manifest configuration rather than separate plugin types.
- The distinction affects both UX and runtime behavior.

## Content
- Python manifests with an onStart event run automatically when loaded.
- Python manifests without onStart rely on manual Execute and Clear controls in the UI.
- The runner can combine these execution modes with ongoing Eagle state monitoring so context stays current across selection and library changes.

## Consequences / notes
- Manifest events are part of the runtime contract for Python plugins and should remain stable.
- UI work around Python plugins should preserve the manual control path for non-auto-running scripts.
