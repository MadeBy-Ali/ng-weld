# ng-weld

> **Weld Angular Module Federation remotes to a host shell.** One typed contract for declaring embeddable components, emitted as a descriptor JSON the host consumes — so no team has to read another team's source to wire it up.

When several teams each ship an Angular Module Federation remote, every team invents its own way to expose a component or page for embedding: different `window` config keys, different custom-element tags, different bootstrap boilerplate. A host shell then has to learn each remote's quirks by hand.

`ng-weld` gives every remote **one typed way** to declare what it exposes, and produces **one predictable `embed-descriptor.json`** that any host can read — no more reading each remote's source to wire it up.

```
remote's embed.config.ts  ──defineEmbed()──▶  validated contract
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

## Usage

In your remote, declare the contract once:

```ts
// embed.config.ts
import { defineEmbed } from 'ng-weld';
import { RemoteEntryComponent } from './app/remote-entry.component';
import { appConfig } from './app/app.config';

export default defineEmbed({
  provider: 'ANGULAR_COMPONENT',
  exposedModule: './WebComponent',
  windowConfigKey: '__agDipaConfig',
  navigateEventName: 'remoteAgDipa:navigate',
  defaultWindowConfig: { basePath: '/ag-dipa-widget', mfeName: 'remoteAgDipa' },
  elements: [
    {
      elementTag: 'remote-ag-dipa-element',
      component: RemoteEntryComponent,
      description: 'Full Ag-DIPA dashboard',
      acceptsRoutes: ['/dashboard/revisi'],
      appProviders: [...appConfig.providers],
    },
  ],
});
```

`defineEmbed()` validates the contract at build time — `elementTag` must contain a
hyphen, `windowConfigKey` must start with `__`, `provider` must be a known value,
tags must be unique. Misconfiguration throws `EmbedConfigError` instead of failing
silently at runtime.

Then emit the descriptor as part of your build:

```ts
// emit-descriptor.ts (run after build, e.g. via a postbuild npm script)
import { writeFileSync } from 'node:fs';
import { serializeDescriptor } from 'ng-weld';
import config from './embed.config';

writeFileSync('dist/embed-descriptor.json', serializeDescriptor(config));
```

The result sits next to your `remoteEntry.json`:

```json
{
  "schemaVersion": 1,
  "provider": "ANGULAR_COMPONENT",
  "exposedModule": "./WebComponent",
  "windowConfigKey": "__agDipaConfig",
  "navigateEventName": "remoteAgDipa:navigate",
  "defaultWindowConfig": { "basePath": "/ag-dipa-widget", "mfeName": "remoteAgDipa" },
  "elements": [
    {
      "elementTag": "remote-ag-dipa-element",
      "defineExport": "defineRemoteAgDipaElement",
      "description": "Full Ag-DIPA dashboard",
      "acceptsRoutes": ["/dashboard/revisi"]
    }
  ]
}
```

Note that runtime-only fields (`component`, `appProviders`) are stripped — the
descriptor is pure, safe-to-serve JSON — and `defineExport` is derived
deterministically from `elementTag` (`remote-ag-dipa-element` →
`defineRemoteAgDipaElement`).

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
