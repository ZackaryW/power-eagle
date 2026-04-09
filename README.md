> for gitops workflows, refer to [template](https://github.com/eagle-cooler/template)

# Power Eagle

Power Eagle is a parser-first plugin host for Eagle built around a canonical `plugin.json` package format.

The current system is not the older userscript-style `main.js` model. A plugin package is now defined by `plugin.json`, optional local action modules, and optional render templates. The host loads packages from disk-backed buckets, activates them through the v2 runtime, and exposes a small declarative grammar for UI, state, lifecycle hooks, and invocation tuples.

## Current Model

- Canonical package contract: `plugin.json`
- Canonical local storage model: `~/.powereagle/buckets/...`
- Canonical file-creation helper: `file.createWithContent`
- Supported invocation namespaces: `local`, `ext`, `eagle`
- No legacy fallbacks for `plugin.js`, `ui.json`, `state.js`, or metadata-only package formats

If you are reading older docs or examples that mention `main.js`, userscript bootstrapping, or the previous SDK container model, they do not describe the current runtime.

## Package Grammar

The runtime expects a package with a `plugin.json` manifest shaped like the v2 contract in [src/core/types/plugin.ts](src/core/types/plugin.ts).

Required top-level fields:

- `id`
- `name`
- `version`
- `stateVersion`
- `type`
- `ui`

Optional top-level fields used by the runtime:

- `description`
- `keywords`
- `state.initial`
- `state.slots`
- `lifecycle.onMount`

### UI Nodes

The `ui` payload is a declarative tree. Common node shapes in the current runtime include:

- `container`
- `header`
- `row`
- `input`
- `button`
- `card-list`
- `card`
- `text`
- `badge`

### Invocation Tuples

Buttons, inputs, and lifecycle hooks call into the runtime with tuples of the form:

```json
["namespace", "key", ["optional", "args"], { "optional": "kwargs" }]
```

Namespaces:

- `local`: package-owned modules such as `actions/createFile`
- `ext`: shared built-in helpers such as `file.createWithContent`
- `eagle`: host Eagle surfaces exposed through the runtime bridge

Tuple strings support interpolation such as `{{state.fileName}}`, `{{input}}`, and `{{args.0}}`.

## Example Packages

### Minimal Declarative Example

[examples/simple-create-md/plugin.json](examples/simple-create-md/plugin.json) is the smallest current example of the grammar. It uses one input, one button, and a direct call to the shared file creation preset:

```json
{
  "id": "simple-create-md",
  "name": "Simple Create Markdown",
  "version": "1.0.0",
  "stateVersion": 1,
  "type": "button",
  "state": {
    "initial": {
      "fileName": ""
    }
  },
  "ui": {
    "layout": "container",
    "children": [
      {
        "type": "row",
        "children": [
          {
            "type": "input",
            "slot": "fileName",
            "placeholder": "File name",
            "flex": 1
          },
          {
            "type": "button",
            "text": "Create File",
            "variant": "primary",
            "onClick": ["ext", "file.createWithContent", [], {
              "fileName": "{{state.fileName}}",
              "extension": "md",
              "content": "# {{state.fileName}}\n\n"
            }]
          }
        ]
      }
    ]
  }
}
```

This example is intentionally JSON-only:

- one name input
- fixed `md` extension
- fixed markdown content
- no extension cache
- no local action modules

### Richer Package With Local Actions

[src/fixtures/file-creator/file-creator/plugin.json](src/fixtures/file-creator/file-creator/plugin.json) shows the richer pattern:

- local actions under `actions/`
- render templates under `render/`
- lifecycle hooks such as `onMount`
- stateful behavior such as saved extension lists

Use that shape when the plugin has real package-owned logic above the shared helpers.

### Fixture Packages Included In The Repo

- [examples/simple-create-md/plugin.json](examples/simple-create-md/plugin.json)
- [src/fixtures/file-creator/file-creator/plugin.json](src/fixtures/file-creator/file-creator/plugin.json)
- [src/fixtures/recent-libraries/recent-libraries/plugin.json](src/fixtures/recent-libraries/recent-libraries/plugin.json)

## File Creation Flow

The current shared file-creation helper is `file.createWithContent`.

Its job is not to show a save dialog and write directly to an arbitrary path. The canonical Eagle-side flow is:

1. Resolve the effective file name and extension.
2. Determine the default content.
3. Write the file to a temporary path.
4. Call Eagle `item.addFromPath(...)` to import it into the active library.
5. Show a notification.

That shared helper is implemented in [src/core/ext/presets.ts](src/core/ext/presets.ts).

Use plugin-owned local actions only when the plugin needs to decide additional behavior before delegating to the shared helper. `file-creator` does that because it owns extension normalization and extension-list persistence. `simple-create-md` does not, so it stays declarative.

## Storage And Install Layout

The current host uses a filesystem-backed store under `~/.powereagle`.

Relevant paths:

- local bundled bucket: `~/.powereagle/buckets/local/plugins/<plugin-id>`
- cloned bucket packages: `~/.powereagle/buckets/<bucket-id>/plugins/<plugin-id>`
- persisted installed state: `~/.powereagle/...` host state files managed by the install store

Bundled fixture packages are converted into generated seed modules under [src/app/seeds](src/app/seeds). Those generated files come from the fixture packages under [src/fixtures](src/fixtures) through [scripts/generate-seeds.mjs](scripts/generate-seeds.mjs).

## Development

Install dependencies:

```bash
pnpm install
```

Run the dev shell:

```bash
pnpm dev
```

Run the build:

```bash
pnpm build
```

Run tests:

```bash
pnpm test
```

Run typechecking only:

```bash
pnpm typecheck
```

Regenerate bundled seed modules from fixture packages:

```bash
pnpm generate:seeds
```

## Hook Workflow

The repository uses a generated-seed workflow:

- `pre-commit`: regenerate and stage [src/app/seeds](src/app/seeds)
- `pre-push`: run the full build

See [lefthook.yaml](lefthook.yaml) for the current hook configuration.

## Contributing

When adding or updating packages:

- keep the package contract in `plugin.json`
- do not add legacy `plugin.js` or `ui.json` fallbacks
- prefer declarative UI and tuples first
- use local actions only when the package owns real behavior
- keep shared host integration inside the ext and eagle runtime layers
- regenerate seeds after changing bundled fixtures

The best current references are the checked-in packages and runtime code, not the older userscript documentation.
