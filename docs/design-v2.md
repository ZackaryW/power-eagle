# Power Eagle v2 — Full Design Document

---

## 1. What Is Power Eagle

Power Eagle is a userscript-style plugin system for Eagle.cool — essentially
Tampermonkey for Eagle. It is a meta-plugin (an Eagle native extension) that
hosts its own lightweight plugin ecosystem inside Eagle, with bucket-based
distribution, URL-based single-plugin install, a runtime SDK, and a shared
standard library.

v2 is a complete rewrite. v1 support is intentionally dropped.

---

## 2. Core Philosophy

- **Convention over configuration** — inspired by Next.js file conventions.
  The folder structure is the contract.
- **Declarative UI, imperative logic, pure data** — three concerns, always
  separated.
- **Every file has one obvious job** — no blobs, no entanglement.
- **AI-generatable by design** — `ui.json` + the `ext` preset registry means
  simple plugins require zero handwritten JS.
- **Testable without Eagle running** — `data/` files are pure functions with
  no runtime dependencies.

---

## 3. Plugin Folder Structure

```
[button] my-plugin/
├── plugin.js              ← manifest export + entry point (replaces plugin.json)
├── ui.json                ← declarative UI tree
├── state.js               ← single source of truth for plugin state
├── migration.js           ← optional; handles localStorage schema migrations
├── data/
│   └── *.js               ← pure data-fetching functions, no Eagle/peagle deps
├── actions/
│   └── *.js               ← one exported function per file, named by action
└── render/
    └── *.json             ← card/list templates with mustache-style bindings
```

The folder name prefix (e.g. `[button]`) declares the plugin type. The runtime
resolves this at install time.

---

## 4. plugin.js

Replaces `plugin.json`. The manifest is a named static export — always pure
data, no expressions, no imports. The entry point is the default export.

```js
export const manifest = {
  id: "my-plugin",
  name: "My Plugin",
  version: "1.0.0",
  stateVersion: 1,           // increment when persisted state shape changes
  type: "button",
  keywords: ["example"],
}

export default async function(peagle) {
  // wire refs and invoke startup logic here
  await peagle.local.invokeFunc("actions/refresh", [], {})

  peagle.slot("search").onInput = peagle.ext.func("utils.debounce", [300], {
    target: peagle.local.func("actions/filter")
  })
}
```

**Rules:**
- `manifest` must be statically extractable. The runtime reads it via dynamic
  `import()` without executing the default export, so no computed values or
  imports are allowed in the manifest object.
- The default export receives `peagle` as its only argument.
- No UI construction here — that belongs in `ui.json`.
- `stateVersion` must be incremented whenever the shape of persisted state
  changes. If omitted, it defaults to `1`.

---

## 5. ui.json

Declarative UI tree. No JS. All interactivity wired via the three-namespace
tuple convention. The runtime renders this before executing `plugin.js`.

```json
{
  "layout": "container",
  "maxWidth": "5xl",
  "padding": 5,
  "children": [
    {
      "type": "header",
      "title": "My Plugin",
      "subtitle": "Subtitle here"
    },
    {
      "type": "row",
      "gap": 4,
      "align": "center",
      "children": [
        {
          "type": "input",
          "slot": "search",
          "placeholder": "Filter...",
          "flex": 1
        },
        {
          "type": "button",
          "text": "Refresh",
          "variant": "secondary",
          "onClick": ["local", "actions/refresh"]
        },
        {
          "type": "button",
          "text": "Clear Invalid",
          "variant": "warning",
          "onClick": ["local", "actions/clearInvalid"]
        }
      ]
    },
    {
      "type": "card-list",
      "slot": "results",
      "template": "render/myCard",
      "empty": "No items found"
    }
  ]
}
```

### onClick Tuple Format

```
[namespace, functionName, args?, kwargs?]
```

| Field          | Type   | Description                           |
|----------------|--------|---------------------------------------|
| `namespace`    | string | `"local"` \| `"ext"` \| `"eagle"`     |
| `functionName` | string | Dot or slash separated path           |
| `args`         | array  | Positional arguments (optional)       |
| `kwargs`       | object | Named arguments (optional)            |

Since `onClick` is always an invocation, all tuples in `ui.json` are treated
as `invokeFunc`. The `func` vs `invokeFunc` distinction only appears in JS code.

---

## 6. The peagle Runtime API

Three namespaces. Two methods each. Fully consistent pattern across all three.

### 6.1 peagle.local — this plugin's own files

```js
// get a reference to actions/filter.js default export (not executed)
peagle.local.func("actions/filter")

// invoke immediately, returns promise
await peagle.local.invokeFunc("actions/filter", [query], { debounce: false })
```

- Resolves against a flat registry populated at activation time (see section 9)
- Path separator is `/`, extension `.js` is implied
- Always resolves to the default export of the target file

### 6.2 peagle.ext — shared preset standard library

```js
// get a reference to a preset function
peagle.ext.func("utils.debounce", [300], { target: fn })

// invoke immediately
await peagle.ext.invokeFunc("slot.render", ["results", data], {})
await peagle.ext.invokeFunc("dialog.confirm", ["Sure?"], { title: "Confirm" })
await peagle.ext.invokeFunc("ai.generateObject", ["Tag this"], { schema: { ... } })
```

- Dot-separated paths map to the `ext` registry folder structure
- `"utils.debounce"` → `ext/utils/debounce.js`
- Global and immutable from the plugin's perspective — no per-plugin overriding

### 6.3 peagle.eagle — raw Eagle API wrappers

```js
// get a reference
peagle.eagle.func("notification.show")

// invoke immediately
await peagle.eagle.invokeFunc("notification.show", ["Title"], { description: "..." })
await peagle.eagle.invokeFunc("library.switch", [path], {})
await peagle.eagle.invokeFunc("item.addTags", [items], { tags: ["foo"] })
```

- Dot-separated paths map directly to Eagle API namespaces
- Thin pass-through — no opinionated logic here

### 6.4 peagle.slot — named UI slot access

```js
// access a named slot declared in ui.json
peagle.slot("search").onInput = peagle.local.func("actions/filter")
peagle.slot("results")        // returns slot controller
```

### 6.5 func vs invokeFunc

| Method         | Returns            | Use case                                       |
|----------------|--------------------|------------------------------------------------|
| `func()`       | Function reference | Wiring event listeners, passing as callbacks   |
| `invokeFunc()` | `Promise<r>`       | Calling inside logic, startup, async chains    |

This distinction is identical across `local`, `ext`, and `eagle`.

### 6.6 peagle.state.batch — batching reactive updates

When an action mutates multiple reactive state keys that each map to a slot,
`batch()` defers all slot renders until the callback completes, coalescing them
into a single render pass.

```js
peagle.state.batch(() => {
  state.libraries = state.libraries.filter(l => l.status === 'valid')
  state.filtered  = [...state.libraries]
})
// single render fires here, after batch completes
```

Without `batch()`, each assignment fires its mapped render immediately.
Simple actions that mutate only one mapped key do not need `batch()`.

---

## 7. Module Loading — Native ESM, No Bundler

All plugin files (`plugin.js`, `actions/*.js`, `data/*.js`, `state.js`,
`migration.js`) are loaded as native ES modules. No bundler, no transpilation,
no Vite.

**Why not Vite or any build tool:**

Vite has two modes — dev server and build. The dev server requires an HTTP
server and browser connection, which is the wrong model for an Eagle plugin
panel. The build mode is a CLI tool invoked ahead of time, not at runtime.

Power Eagle has no build step. Plugins arrive as zips from a URL, get
extracted, and run immediately. There is no moment to invoke `vite build`
without either bundling the entire Vite + Rollup dependency tree inside
Power Eagle (impractical) or requiring plugin authors to pre-build before
zipping (kills the instant-install model).

Eagle's Electron environment is also not a fully controlled Node runtime —
child process spawning is unreliable, arbitrary path writes require permission,
and a globally installed Vite cannot be assumed.

**Native ESM is sufficient** because:
- Electron 28+ supports native ESM fully via a modern Chromium
- Eagle 4.x runs on a compatible Electron version
- The flat registry loader (section 9) handles cross-file resolution without
  needing a bundler
- `require()` remains available for Node built-ins (`fs`, `path`, `process`)
  since Eagle runs on Electron and exposes Node APIs

Plugin authors who want TypeScript compile it locally before zipping. That
is their own toolchain concern, not Power Eagle's.

---

## 8. File Conventions

### 8.1 actions/*.js

Every file in `actions/` exports a single default async function.
Signature is always `(peagle, args, kwargs)`.

```js
// actions/open.js
import state from '../state.js'

export default async function open(peagle, [library], {}) {
  await peagle.eagle.invokeFunc("library.switch", [library.path], {})
  await peagle.eagle.invokeFunc("notification.show", ["Library Opened"], {
    description: `Switched to ${library.name}`
  })
}
```

**Rules:**
- One file = one action = one default export
- Always receives `(peagle, args, kwargs)`
- Imports `state.js` directly for reading/writing plugin state
- Never touches the DOM directly — use reactive state mutation to trigger renders
- `peagle.local.func()` calls inside action files are registry lookups, not
  module loads, so there is no circular import risk

### 8.2 data/*.js

Pure functions. No `peagle`, no `eagle`, no DOM. Fully testable without Eagle
running.

```js
// data/getLibraries.js
const fs   = require('fs')
const path = require('path')

export default async function getLibraries() {
  const base = process.env.APPDATA || (
    process.platform === 'darwin'
      ? process.env.HOME + '/Library/Application Support'
      : process.env.HOME + '/.local/share'
  )
  const raw = fs.readFileSync(path.join(base, 'eagle', 'Settings'), 'utf8')
  return JSON.parse(raw).libraryHistory || []
}
```

```js
// data/checkValid.js
const fs = require('fs')

export default async function checkValid(libPath) {
  try {
    await fs.promises.access(libPath)
    return true
  } catch {
    return false
  }
}
```

**Rules:**
- No side effects
- No `peagle` or `eagle` imports
- Return plain data only
- Called from `actions/` via normal ES module import, not via `peagle.local`

### 8.3 state.js

Reactive plain object. Imported directly by action files. Mutations to mapped
keys automatically trigger the corresponding slot render. Use
`peagle.state.batch()` when mutating multiple mapped keys in one action.

```js
// state.js
import { reactive } from 'peagle/state'

export default reactive({
  libraries: [],
  filtered: [],
}, {
  filtered: "results",    // when filtered is assigned, auto-render the "results" slot
})
```

The second argument to `reactive()` is the slot mapping — a plain object where
keys are state property names and values are slot names declared in `ui.json`.
Unmapped properties can be mutated freely without triggering any render.

### 8.4 render/*.json — Templates and Caching

Mustache-style bindings evaluated against each data item at render time.
`{{self}}` refers to the full data object, used when passing an item back to
an action.

```json
{
  "type": "card",
  "title": "{{name}}",
  "subtitle": "Last accessed: {{lastAccessed}}",
  "content": {
    "type": "row",
    "justify": "between",
    "children": [
      { "type": "text",  "value": "{{path}}",   "class": "text-sm break-all" },
      { "type": "badge", "text": "{{status}}", "variant": "{{statusVariant}}" }
    ]
  },
  "actions": [
    {
      "text": "Open",
      "variant": "primary",
      "onClick": ["local", "actions/open",   ["{{self}}"], {}]
    },
    {
      "text": "Remove",
      "variant": "error",
      "onClick": ["local", "actions/remove", ["{{self}}"], {}]
    }
  ]
}
```

**Parsing vs binding:**

There are two distinct operations on a template:

- **Parsing** — reading the JSON file and building an internal template
  representation. Happens once per activation, result is cached to disk.
- **Binding** — substituting `{{variables}}` with actual data values per item.
  Happens on every reactive render, once per item in the list. Cannot be cached.

**Cache strategy:**

The cache key is a composite SHA256 hash of the template JSON content and the
Power Eagle renderer version string:

```
SHA256(render/libraryCard.json contents + rendererVersion)
```

The renderer version is a constant baked into the Power Eagle core, bumped
whenever template compilation logic changes. This ensures:

- Plugin updates a template → hash changes → cache miss → recompile
- Power Eagle ships a new renderer → hash changes for all cached templates →
  full recompile on next activation for all plugins
- Neither changes → hash hit → skip disk read and parsing entirely

Cache location:

```
~/.powereagle/cache/
  └── {pluginId}/
      └── {sha256hash}.template.bin
```

Stale entries (hash no longer referenced by any active plugin) are swept on
Eagle startup.

---

## 9. Flat Registry Loader

Power Eagle loads all plugin files into a flat registry at activation time,
before any action runs. This is what enables `peagle.local.func()` to be a
dictionary lookup rather than a live module load, eliminating any possibility
of circular imports between action files.

**Activation sequence:**

```
plugin activated
  → scan all .js files in plugin folder recursively
  → load each as a native ES module
  → register default export by path key:
      "actions/remove"    → remove function
      "actions/filter"    → filter function
      "data/getLibraries" → getLibraries function
      "state"             → reactive state object
  → parse and cache render/*.json templates (SHA256 check)
  → run state migration if needed (see section 10)
  → render ui.json
  → execute plugin.js default export
```

`peagle.local.func("actions/remove")` is then:

```js
return registry["actions/remove"]
```

No module loading at call time. No circular dependency risk. The registry is
fully populated before `plugin.js` runs.

---

## 10. State Persistence and Migration

### Persistence

State that needs to survive Eagle restarts is persisted to localStorage under
a namespaced key:

```
powereagle:{pluginId}:state
```

In-memory state (the reactive object from `state.js`) is always initialized
fresh from defaults on activation. Persisted state is loaded on top of that
if it exists and passes the version check.

### Migration Flow

```
activation
  → load persisted state from localStorage
  → no stored state: initialize from state.js defaults, continue
  → stored state found:
      → compare stored.__version to manifest.stateVersion
      → match:    hydrate state from stored data, continue
      → mismatch:
          → migration.js present:
              → run migrate(stored, fromVersion, toVersion)
              → success: save migrated state, hydrate, continue
              → throws:  clear localStorage key, use defaults, continue
          → migration.js absent:
              → clear localStorage key, use defaults, continue
```

A cleared state is not a crash. The plugin always continues loading with
either migrated or fresh default state.

### migration.js

Optional file in the plugin root. Only needed when `stateVersion` is bumped.
Receives the stored object and both version numbers, must return the migrated
object. Any thrown error triggers a full clear — no partial state is saved.

```js
// migration.js
export default async function migrate(stored, fromVersion, toVersion) {

  if (fromVersion < 2) {
    // v1 stored a boolean "valid" field
    // v2 replaced it with "status" string and "statusVariant" string
    stored.libraries = (stored.libraries ?? []).map(l => ({
      ...l,
      status:        l.valid ? 'valid'   : 'invalid',
      statusVariant: l.valid ? 'success' : 'error',
    }))
    delete stored.valid
  }

  if (fromVersion < 3) {
    // future migrations stacked here in sequence
  }

  return stored   // must return the migrated object
}
```

**Rules:**
- Must return the migrated state object
- Any thrown error triggers a full localStorage clear
- `stored.__version` is managed by Power Eagle — do not set it manually
- Migration runs before `ui.json` renders and before `plugin.js` executes
- Migrations must be cumulative — each `fromVersion < N` block handles one
  version step, all blocks run in sequence on a large version jump

---

## 11. Plugin Distribution — Buckets and URL Install

Power Eagle uses two parallel distribution channels. Both produce host-managed
plugin folders under `~/.powereagle/buckets/` and go through the same
activation sequence. They differ only in source tracking and update behavior.

### 11.1 Buckets

A bucket is a git-managed repository that publishes a plugin index. The model
is directly inspired by Scoop buckets. Power Eagle ships with no built-in
plugins — all plugins come from user-added buckets or direct URL installs.

**Bucket repository structure:**

```
my-bucket/
├── bucket.json            ← bucket metadata (name, description, maintainer)
└── plugins/
    ├── recent-libraries.json   ← one manifest stub per plugin
    ├── file-creator.json
    └── ai-tagger.json
```

Each plugin stub in `plugins/` contains enough metadata to display the index
and resolve the download URL:

```json
{
  "id": "recent-libraries",
  "name": "Recent Libraries",
  "version": "2.1.0",
  "type": "button",
  "keywords": ["library", "management"],
  "description": "Browse and manage Eagle library history",
  "url": "https://github.com/user/recent-libraries/releases/latest/download/plugin.zip"
}
```

**Bucket management operations:**

| Operation     | Description                                                  |
|---------------|--------------------------------------------------------------|
| Add bucket    | Paste a git repo URL — Power Eagle clones or fetches the index |
| Sync bucket   | Re-fetch the remote index, update version info               |
| Remove bucket | Removes the bucket and its index; installed plugins are unaffected |
| Install plugin| Downloads zip from stub URL, runs activation sequence        |
| Remove plugin | Deletes the host-managed plugin folder and localStorage key |

**Git resolution:**

Bucket index fetching uses `git clone --depth 1` where a portable git binary
is available. If no git is present, Power Eagle falls back to fetching the
repository zip archive directly from the host (GitHub/Gitea etc.). The
portable git download is offered as an optional one-time setup step on first
bucket add.

**Installed plugins track their bucket:**

```js
// stored in ~/.powereagle/installed.json
{
  "recent-libraries": {
    "bucket": "pe-community",
    "installedVersion": "2.0.0",
    "source": "bucket"
  }
}
```

This enables the index UI to show installed/outdated states per entry and
allows `sync` to surface available updates without re-downloading anything.

### 11.2 URL Install (Local Plugins)

Any plugin zip can be installed directly by pasting its URL. This bypasses
buckets entirely and marks the plugin as `local`.

**Behavior:**
- Marked with a `local` badge in the installed list
- Never compared against any bucket index — no update checks
- Upgrading requires re-pasting the URL manually
- If the same plugin ID exists in a bucket, the local install always wins
  and bucket operations (update, remove from bucket) have no effect on it
- Uninstalling a local plugin is identical to uninstalling a bucket plugin

**Install sequence (same for both channels):**

```
URL resolved
  → download .zip
  → materialize under the host-managed bucket/plugin folder layout
  → read manifest via static import() (no execution)
  → SHA256 cache render/*.json templates
  → check stateVersion vs localStorage
  → run migration.js if version mismatch
  → load all .js files into flat registry
  → render ui.json → execute plugin.js
```

---

## 12. Plugin Index UI

The Power Eagle index UI is a panel with four tabs:

| Tab         | Description                                               |
|-------------|-----------------------------------------------------------|
| `installed` | List of installed plugins, inspect and launch from here   |
| `buckets`   | Manage buckets, browse plugin index per bucket            |
| `url install` | Paste a zip URL to install a local plugin               |
| `ai` [soon] | AI-assisted plugin generation via Eagle AI SDK            |

### 12.1 Installed tab — single-click vs double-click

The installed tab uses a two-gesture model to separate inspection from
execution:

| Gesture      | Action                                                          |
|--------------|-----------------------------------------------------------------|
| Single-click | Select plugin — shows inspect panel (manifest, source, version) |
| Double-click | Launch plugin — replaces main panel with the plugin's own UI    |

When a plugin is running, its sidebar entry shows a green `running` badge
and the detail panel is replaced by the plugin window with a thin chrome bar
showing the plugin name, source badge, and a close button.

A plugin must be enabled to be launched. Attempting to double-click a
disabled plugin has no effect. The close button returns to the inspect panel
without unloading the plugin state.

**Plugin window chrome:**

```
┌─ Recent Libraries · recent-libraries · pe-community ──────── [close] ─┐
│                                                                         │
│  [plugin ui.json rendered here]                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

The chrome bar is Power Eagle's own UI — the plugin itself only controls the
content area below it. This ensures the close button is always reachable
regardless of what the plugin renders.

### 12.2 Buckets tab

Left column lists all added buckets. Right column shows the full plugin index
for the selected bucket, with per-entry install/remove buttons and
installed/outdated badges resolved against `installed.json`.

### 12.3 URL install tab

Single input for a zip URL. Running install plays the animated step log.
On success the plugin is added to the installed list and the UI navigates
to its inspect panel.

The tab also documents the local plugin contract inline:
- source: `local` — not tied to any bucket
- updates: manual only — re-paste url to upgrade
- conflicts: ignored — local always wins over bucket
- format: must be a .zip containing `plugin.js`

### 12.4 AI tab (future)

Planned. Will connect to Eagle AI SDK (`eagle.extraModule.ai`) and provide a
prompt interface for generating complete plugin scaffolds — `plugin.js`,
`ui.json`, `state.js`, and stubbed `actions/` files — from a natural language
description. Not implemented in v2.0.

---

## 13. ext Preset Registry

Shared across all plugins, maintained by Power Eagle core. Global and
immutable from the plugin's perspective — plugins cannot override or shadow
ext presets. All presets follow the signature: `(peagle, args = [], kwargs = {})`.

### Directory Structure

```
ext/
├── utils/
│   ├── debounce.js         args: [delayMs]          kwargs: { target: fn }
│   ├── throttle.js         args: [limitMs]          kwargs: { target: fn }
│   ├── generateId.js       args: []                 kwargs: { prefix? }
│   └── formatBytes.js      args: [bytes]            kwargs: { decimals? }
├── slot/
│   ├── render.js           args: [slotName, data]   kwargs: { template? }
│   ├── clear.js            args: [slotName]         kwargs: {}
│   └── loading.js          args: [slotName]         kwargs: { text? }
├── state/
│   ├── get.js              args: [key]              kwargs: { default? }
│   ├── set.js              args: [key, value]       kwargs: {}
│   └── reset.js            args: [key]              kwargs: {}
├── dialog/
│   ├── confirm.js          args: [message]          kwargs: { title?, confirmText?, cancelText? }
│   ├── prompt.js           args: [message]          kwargs: { title?, placeholder?, default? }
│   └── form.js             args: [fields]           kwargs: { title?, submitText? }
├── library/
│   ├── load.js             args: []                 kwargs: { validate? }
│   └── clearInvalid.js     args: []                 kwargs: { notify? }
└── ai/
    ├── generate.js         args: [prompt]           kwargs: { model?, system?, maxTokens? }
    ├── generateObject.js   args: [prompt]           kwargs: { schema, model?, system? }
    └── stream.js           args: [prompt]           kwargs: { model?, onChunk?, system? }
```

### Preset Signature Convention

```js
// every ext preset follows this exact shape
export default async function presetName(peagle, args = [], kwargs = {}) {
  // args   — positional, ordered, required inputs
  // kwargs — named, optional, with sensible defaults
}
```

### ext/ai/ — Eagle AI SDK Integration

Built on `eagle.extraModule.ai`. Always uses `getDefaultModel()` unless
overridden in kwargs. Opens the model settings panel if no model is configured.

```js
// ext/ai/generateObject.js
export default async function generateObject(peagle, [prompt], { schema, model, system }) {
  const ai = eagle.extraModule.ai
  const { generateObject } = ai

  const resolvedModel = model
    ? ai.getModel(model)
    : ai.getModel(ai.getDefaultModel("chat"))

  if (!resolvedModel) {
    ai.open()
    throw new Error("No default model configured. Please set one in AI SDK settings.")
  }

  const messages = []
  if (system) messages.push({ role: "system", content: system })
  messages.push({ role: "user", content: prompt })

  const result = await generateObject({ model: resolvedModel, schema, messages })
  return result.object
}
```

```js
// ext/ai/stream.js
export default async function stream(peagle, [prompt], { model, onChunk, system }) {
  const ai = eagle.extraModule.ai
  const { streamText } = ai

  const resolvedModel = model
    ? ai.getModel(model)
    : ai.getModel(ai.getDefaultModel("chat"))

  const messages = []
  if (system) messages.push({ role: "system", content: system })
  messages.push({ role: "user", content: prompt })

  const { textStream } = streamText({ model: resolvedModel, messages })

  let fullText = ""
  for await (const chunk of textStream) {
    fullText += chunk
    if (onChunk) onChunk(chunk, fullText)
  }
  return fullText
}
```

---

## 14. Eagle AI SDK Reference (4.0 Build20+)

Eagle exposes `eagle.extraModule.ai` with the following API.

### Getting Models

```js
const ai = eagle.extraModule.ai

// synchronous — no await needed
ai.getDefaultModel("chat")               // → "provider::model" string or undefined
ai.getDefaultModel("image")             // → vision model string or undefined
ai.getModel("openai::gpt-5")            // → model instance
ai.getModel(ai.getDefaultModel("chat"))
ai.getProvider("lmstudio")
ai.getAvailableProviders()              // only configured providers
```

### Generating

```js
// async
await ai.generateText({ model, prompt })
await ai.generateObject({ model, schema, prompt })

// streaming
const { textStream }          = ai.streamText({ model, prompt })
const { partialObjectStream } = ai.streamObject({ model, schema, prompt })
```

### Settings

```js
ai.open()    // opens model settings panel in Eagle Preferences
ai.reload()  // reloads configuration after user makes changes
```

### Provider::Model Format

Provider and model are separated by `::`, not a slash or single colon.

```js
// ✅ correct
"lmstudio::qwen3-vl-8b"
"anthropic::claude-sonnet-4-6"
"openai::gpt-5"

// ❌ incorrect
"lmstudio/qwen3-vl-8b"
"lmstudio:qwen3-vl-8b"
```

### Supported Providers

| Provider          | Name                  | Type            |
|-------------------|-----------------------|-----------------|
| OpenAI            | `"openai"`            | Cloud           |
| Anthropic         | `"anthropic"`         | Cloud           |
| Google Gemini     | `"google"`            | Cloud           |
| DeepSeek          | `"deepseek"`          | Cloud           |
| Tongyi Qwen       | `"tongyi"`            | Cloud           |
| Ollama            | `"ollama"`            | Local           |
| LM Studio         | `"lmstudio"`          | Local           |
| OpenAI Compatible | `"openai-compatible"` | Custom endpoint |

---

## 15. Full Example — recent-libraries in v2

### Folder Structure

```
[button] recent-libraries/
├── plugin.js
├── ui.json
├── state.js
├── migration.js
├── data/
│   ├── getLibraries.js
│   └── checkValid.js
├── actions/
│   ├── refresh.js
│   ├── filter.js
│   ├── open.js
│   ├── remove.js
│   └── clearInvalid.js
└── render/
    └── libraryCard.json
```

### plugin.js

```js
export const manifest = {
  id: "recent-libraries",
  name: "Recent Libraries",
  version: "2.0.0",
  stateVersion: 2,
  type: "button",
  keywords: ["library", "management"],
}

export default async function(peagle) {
  await peagle.local.invokeFunc("actions/refresh", [], {})

  peagle.slot("search").onInput = peagle.ext.func("utils.debounce", [300], {
    target: peagle.local.func("actions/filter")
  })
}
```

### ui.json

```json
{
  "layout": "container",
  "maxWidth": "5xl",
  "padding": 5,
  "children": [
    {
      "type": "header",
      "title": "Recent Libraries",
      "subtitle": "View and manage your recent Eagle libraries"
    },
    {
      "type": "row",
      "gap": 4,
      "align": "center",
      "children": [
        {
          "type": "input",
          "slot": "search",
          "placeholder": "Filter libraries...",
          "flex": 1
        },
        {
          "type": "button",
          "text": "Refresh",
          "variant": "secondary",
          "onClick": ["local", "actions/refresh"]
        },
        {
          "type": "button",
          "text": "Clear Invalid",
          "variant": "warning",
          "onClick": ["local", "actions/clearInvalid"]
        }
      ]
    },
    {
      "type": "card-list",
      "slot": "results",
      "template": "render/libraryCard",
      "empty": "No libraries found"
    }
  ]
}
```

### state.js

```js
import { reactive } from 'peagle/state'

export default reactive({
  libraries: [],
  filtered: [],
}, {
  filtered: "results",
})
```

### migration.js

```js
export default async function migrate(stored, fromVersion, toVersion) {

  if (fromVersion < 2) {
    stored.libraries = (stored.libraries ?? []).map(l => ({
      ...l,
      status:        l.valid ? 'valid'   : 'invalid',
      statusVariant: l.valid ? 'success' : 'error',
    }))
    delete stored.valid
  }

  return stored
}
```

### data/getLibraries.js

```js
const fs   = require('fs')
const path = require('path')

export default async function getLibraries() {
  const base = process.env.APPDATA || (
    process.platform === 'darwin'
      ? process.env.HOME + '/Library/Application Support'
      : process.env.HOME + '/.local/share'
  )
  const raw = fs.readFileSync(path.join(base, 'eagle', 'Settings'), 'utf8')
  return JSON.parse(raw).libraryHistory || []
}
```

### data/checkValid.js

```js
const fs = require('fs')

export default async function checkValid(libPath) {
  try {
    await fs.promises.access(libPath)
    return true
  } catch {
    return false
  }
}
```

### actions/refresh.js

```js
import state        from '../state.js'
import getLibraries from '../data/getLibraries.js'
import checkValid   from '../data/checkValid.js'

export default async function refresh(peagle, [], {}) {
  await peagle.ext.invokeFunc("slot.loading", ["results"], { text: "Loading..." })

  const paths = await getLibraries()

  const validated = await Promise.all(paths.map(async (libPath, i) => {
    const valid = await checkValid(libPath)
    return {
      id:            `lib_${i}`,
      name:          libPath.split('/').pop().replace('.library', ''),
      path:          libPath,
      lastAccessed:  new Date().toLocaleDateString(),
      status:        valid ? 'valid'   : 'invalid',
      statusVariant: valid ? 'success' : 'error',
    }
  }))

  peagle.state.batch(() => {
    state.libraries = validated
    state.filtered  = [...validated]
  })
}
```

### actions/filter.js

```js
import state from '../state.js'

export default async function filter(peagle, [query], {}) {
  const q = query.toLowerCase().trim()
  state.filtered = !q
    ? [...state.libraries]
    : state.libraries.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.path.toLowerCase().includes(q)
      )
}
```

### actions/open.js

```js
export default async function open(peagle, [library], {}) {
  await peagle.eagle.invokeFunc("library.switch", [library.path], {})
  await peagle.eagle.invokeFunc("notification.show", ["Library Opened"], {
    description: `Switched to ${library.name}`
  })
}
```

### actions/remove.js

```js
import state from '../state.js'

export default async function remove(peagle, [library], {}) {
  peagle.state.batch(() => {
    state.libraries = state.libraries.filter(l => l.id !== library.id)
    state.filtered  = state.filtered.filter(l => l.id !== library.id)
  })
}
```

### actions/clearInvalid.js

```js
import state from '../state.js'

export default async function clearInvalid(peagle, [], {}) {
  const invalid = state.libraries.filter(l => l.status === 'invalid')

  if (!invalid.length) {
    await peagle.eagle.invokeFunc("notification.show", ["Nothing to clear"], {
      description: "All libraries are valid"
    })
    return
  }

  const ok = await peagle.ext.invokeFunc("dialog.confirm",
    [`Remove ${invalid.length} invalid libraries?`],
    { title: "Clear Invalid", confirmText: "Remove" }
  )
  if (!ok) return

  peagle.state.batch(() => {
    state.libraries = state.libraries.filter(l => l.status === 'valid')
    state.filtered  = [...state.libraries]
  })

  await peagle.eagle.invokeFunc("notification.show", ["Done"], {
    description: `Removed ${invalid.length} invalid libraries`
  })
}
```

### render/libraryCard.json

```json
{
  "type": "card",
  "title": "{{name}}",
  "subtitle": "Last accessed: {{lastAccessed}}",
  "content": {
    "type": "row",
    "justify": "between",
    "children": [
      { "type": "text",  "value": "{{path}}",   "class": "text-sm break-all" },
      { "type": "badge", "text": "{{status}}", "variant": "{{statusVariant}}" }
    ]
  },
  "actions": [
    {
      "text": "Open",
      "variant": "primary",
      "onClick": ["local", "actions/open",   ["{{self}}"], {}]
    },
    {
      "text": "Remove",
      "variant": "error",
      "onClick": ["local", "actions/remove", ["{{self}}"], {}]
    }
  ]
}
```

---

## 16. v1 vs v2 Comparison

| Concern              | v1                                   | v2                                        |
|----------------------|--------------------------------------|-------------------------------------------|
| Entry point          | `plugin.json` + one giant `.tsx`     | `plugin.js` — manifest + entry together  |
| UI definition        | `innerHTML` string blobs             | `ui.json` declarative tree                |
| Event wiring         | `querySelector` + `addEventListener` | `slot()` + `func()` references            |
| Business logic       | Inline anonymous functions           | `actions/*.js` — one function per file    |
| Data fetching        | Buried inside business logic         | `data/*.js` — pure functions              |
| Plugin state         | Closure variables                    | `state.js` — reactive, slot-mapped        |
| Dynamic rendering    | `cardManager.clearCards()` + loop    | Reactive state mutation auto-renders slot |
| Dialogs              | Inline `elements` array, repeated    | `ext.dialog.confirm/prompt/form`          |
| Eagle API calls      | Direct, no abstraction layer         | `peagle.eagle.invokeFunc()`               |
| Testability          | Impossible without Eagle running     | `data/` and `actions/` fully unit-testable|
| AI integration       | Impossible — code too entangled      | `ext/ai/` presets drop in anywhere        |
| State persistence    | Ad-hoc `powersdk.storage` calls      | Managed by runtime with version checking  |
| Schema migration     | Not supported                        | `migration.js` with clear-on-fail         |
| Template caching     | Not applicable                       | SHA256(json + rendererVersion) cache      |
| Bundler required     | Vite (full build step)               | None — native ESM                         |
| Distribution         | Single URL paste only                | Buckets (git-managed index) + URL install |
| Plugin discovery     | None                                 | Bucket index with install/update/remove   |
| Plugin launch        | Not applicable (v1 was the host)     | Double-click from installed list          |
| Lines per plugin     | 150–230 in one file                  | 20–40 per file across 8–12 files          |
| Code duplication     | Dialog definitions copied verbatim   | Declared once in `ext`, called by name    |