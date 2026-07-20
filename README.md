# ng-weld

> **Weld Angular Module Federation remotes to a host shell.** One typed contract for declaring embeddable components, emitted as a descriptor JSON the host consumes — so no team has to read another team's source to wire it up.

When several teams each ship an Angular Module Federation remote, every team invents its own way to expose a component or page for embedding: different `window` config keys, different custom-element tags, different bootstrap boilerplate. A host shell then has to learn each remote's quirks by hand.

`ng-weld` gives every remote **one typed way** to declare what it exposes, and produces **one predictable `embed-descriptor.json`** that any host can read — no more reading each remote's source to wire it up.

```
remote's embed.config.mjs ──defineEmbed()──▶  validated contract
                                                     │
                                            serializeDescriptor()
                                                     │
                                                     ▼
                                          embed-descriptor.json  ──▶  host shell
```

## Install

```bash
npm install ng-weld
```

## Quickstart for a remote (producer)

ng-weld doesn't create your web-component — it **describes** one you already expose and emits a
descriptor the host can read. Every remote follows the same seven steps.

**Prerequisite:** a native-federation Angular remote that exposes a web-component module (e.g.
`'./WebComponent'`) with an async register function (e.g. `defineRemoteReportsElement()`) that is
idempotent, reads `window[configKey]`, and calls `customElements.define(...)`. *(In v0.1 you keep
writing that function by hand; v0.2 codegen will generate it — see the roadmap.)*

### 1. Install (build-time dev dependency)

```bash
pnpm add -D ng-weld
```

### 2. Find your values

| Descriptor field | Where it lives in your remote |
| --- | --- |
| `exposedModule` | `federation.config.js` → `exposes` key (e.g. `./WebComponent`) |
| `elementTag` | your `*.element.ts` → `ELEMENT_NAME` (must contain a hyphen) |
| `windowConfigKey` | the `window` key your element reads (must start with `__`) |
| `navigateEventName` | the `CustomEvent` your component listens on |
| `defaultWindowConfig` | your remote's `basePath` + `mfeName` (event-bus namespace) |

`defineExport` is **derived** from `elementTag` (`remote-reports-element` → `defineRemoteReportsElement`) —
just make sure your exported function uses that name.

### 3. Declare the contract — `embed.config.mjs` (repo root)

Author it as **pure data** (no Angular imports) so the emit runs in plain `node` with no risk of a
browser-only import crashing the build:

```js
// embed.config.mjs
import { defineEmbed } from 'ng-weld';

export default defineEmbed({
  provider: 'ANGULAR_COMPONENT',
  exposedModule: './WebComponent',
  windowConfigKey: '__remoteReportsConfig',
  navigateEventName: 'remoteReports:navigate',
  name: 'Reports',
  defaultWindowConfig: { basePath: '/reports-widget', mfeName: 'remoteReports' },
  elements: [
    {
      elementTag: 'remote-reports-element',
      description: 'Full Reports remote (whole-page element).',
      acceptsRoutes: ['/overview', '/details', '/dashboard'],
    },
    // A remote exposing more web-components just adds more entries here.
  ],
});
```

`defineEmbed()` validates as you write — hyphen in `elementTag`, `__` prefix on `windowConfigKey`,
known `provider`, unique tags — throwing `EmbedConfigError` on any violation.

### 4. Emit the descriptor — `tools/emit-descriptor.mjs`

```js
// tools/emit-descriptor.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serializeDescriptor } from 'ng-weld';
import config from '../embed.config.mjs';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'embed-descriptor.json'), serializeDescriptor(config));
console.log('[emit-descriptor] wrote public/embed-descriptor.json');
```

Emitting into `public/` is what makes the descriptor available in **both** `ng serve` (dev) and
`ng build` (prod — Angular copies `public/` into the output, next to `remoteEntry.json`).

### 5. Wire it into your build — run the emit *before* `ng build`

```json
{
  "scripts": {
    "start":      "node tools/emit-descriptor.mjs && node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\" && ng serve",
    "build":      "node tools/emit-descriptor.mjs && ng build",
    "build:prod": "node tools/emit-descriptor.mjs && ng build --configuration production",
    "emit:descriptor": "node tools/emit-descriptor.mjs"
  }
}
```

### 6. Emit & verify

```bash
pnpm emit:descriptor        # or: pnpm build
```

Open it in a browser — it should sit right next to `remoteEntry.json`:

```
http://localhost:4204/embed-descriptor.json
```

The emitted JSON:

```json
{
  "schemaVersion": 1,
  "provider": "ANGULAR_COMPONENT",
  "exposedModule": "./WebComponent",
  "windowConfigKey": "__remoteReportsConfig",
  "navigateEventName": "remoteReports:navigate",
  "defaultWindowConfig": { "basePath": "/reports-widget", "mfeName": "remoteReports" },
  "name": "Reports",
  "elements": [
    {
      "elementTag": "remote-reports-element",
      "defineExport": "defineRemoteReportsElement",
      "description": "Full Reports remote (whole-page element).",
      "acceptsRoutes": ["/overview", "/details", "/dashboard"]
    }
  ]
}
```

`defineExport` is derived deterministically from `elementTag`, and the descriptor is pure,
safe-to-serve JSON.

### 7. Done

The host shell now fetches your descriptor from the Remote Entry URL and auto-fills its Connection +
DataSource forms. The remote team does nothing else.

> **CORS:** the descriptor is fetched cross-origin, so your remote must send CORS headers — the same
> requirement `remoteEntry.json` already meets.

## Consuming the descriptor (host side)

The **same package** validates the descriptor on the host. Instead of hand-parsing
the fetched JSON, call `parseDescriptor()` — it checks `schemaVersion`, validates the
shape, and hands back a typed `EmbedDescriptor`, so a malformed or newer-than-supported
descriptor fails loudly instead of rendering a broken widget:

```ts
import { parseDescriptor } from 'ng-weld';

const res = await fetch(`${remoteEntryUrl.replace('remoteEntry.json', 'embed-descriptor.json')}`);
const descriptor = parseDescriptor(await res.text());

// descriptor.exposedModule, .windowConfigKey, .navigateEventName, .defaultWindowConfig
//   → fill the host Connection form
// descriptor.elements[] (each .elementTag + .defineExport + .acceptsRoutes)
//   → one candidate DataSource per element
```

## API

| Export | Side | Description |
| --- | --- | --- |
| `defineEmbed(config)` | producer | Validate and return a remote's embed contract. Throws `EmbedConfigError`. |
| `toDescriptor(config)` | producer | Project a config into the plain-object descriptor. |
| `serializeDescriptor(config)` | producer | Pretty-printed JSON string, ready to write to disk. |
| `parseDescriptor(json)` | consumer | Validate + type a fetched descriptor. Throws `DescriptorParseError`. |
| `deriveDefineExport(tag)` | — | The deterministic `define<Pascal>` name for an element tag. |
| `SCHEMA_VERSION` | — | Current descriptor schema version. |

Full TypeScript types (`EmbedConfig`, `EmbedDescriptor`, …) are shipped.

## What v0.1 does and does *not* guarantee

- ✅ **Guarantees the descriptor shape** — every remote emits the same envelope, and
  `parseDescriptor` enforces it on the host.
- ✅ **Guarantees the `defineExport` *name*** — derived deterministically from the tag.
- ⚠️ **Does *not* yet guarantee the `defineExport` *behavior*.** In v0.1 the remote author
  still hand-writes the registration function (idempotency guard, `window[key]` read,
  custom-element registration). The descriptor names it, but nothing stops it from
  drifting. **v0.2's codegen** generates that function from the same config, closing the
  gap — see the roadmap.

## Security note

The `defaultWindowConfig` and any per-connection config end up on
`window[windowConfigKey]`, readable by **any co-tenant of the host shell**. Put
only configuration there — never API keys, tokens, or user identifiers.

## Roadmap

- **v0.1** _(current)_ — typed `defineEmbed()` contract + descriptor emit.
- **v0.2** — ng-schematic / builder that generates the `remote-entry.element.ts`
  registration boilerplate from the same config, so code and descriptor can
  never drift.

## License

MIT © irsyadali1
