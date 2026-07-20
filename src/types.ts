/**
 * The kind of thing a remote exposes for embedding.
 * Currently only Angular standalone components rendered as custom elements,
 * but modeled as a union so new providers can be added without breaking consumers.
 */
export type EmbedProvider = 'ANGULAR_COMPONENT';

/**
 * The current descriptor schema version. Bump this (and handle the old shape
 * host-side) whenever the emitted JSON changes shape. Hosts should read it
 * before trusting the rest of the payload.
 */
export const SCHEMA_VERSION = 1 as const;

/**
 * Config the host writes into `window[windowConfigKey]` before the custom
 * element boots. Deliberately open-ended (`[key: string]: unknown`) so each
 * remote can carry its own knobs — but see the trust-boundary note in the
 * README: never put secrets here, it is readable by any co-tenant of the shell.
 */
export interface WindowConfig {
  /** Base href the remote should resolve its assets/routes against. */
  basePath: string;
  /** The remote's Module Federation name (matches `remoteEntry` name). */
  mfeName: string;
  [key: string]: unknown;
}

/**
 * One embeddable element, as authored by the remote in `embed.config.ts`.
 * `component` and `appProviders` are runtime objects and are intentionally
 * typed loosely so this package carries no Angular dependency — they are
 * stripped out when producing the serializable descriptor.
 */
export interface EmbedElementConfig {
  /** Custom-element tag. Must contain a hyphen (HTML spec for custom elements). */
  elementTag: string;
  /**
   * The Angular standalone component to render. Typed loosely to avoid a peer dep.
   * Optional in v0.1 (the descriptor strips it anyway), so producers can author a
   * pure-data config with no Angular imports for build-time descriptor emit.
   * v0.2 codegen will require it to generate the registration boilerplate.
   */
  component?: unknown;
  /** Human-readable description shown in the host's connection UI. */
  description?: string;
  /** Route paths this element can deep-link into, surfaced as a dropdown host-side. */
  acceptsRoutes?: string[];
  /** Angular providers to bootstrap the element's application with. Runtime-only. */
  appProviders?: unknown[];
}

/**
 * The full embed contract for a remote. This is what `defineEmbed()` accepts.
 */
export interface EmbedConfig {
  provider: EmbedProvider;
  /**
   * Module Federation expose key the host loads the registration fns from,
   * e.g. `./WebComponent`. Maps to the host Connection's `exposedModule`.
   * Connection-level: all of this remote's elements live behind one module.
   */
  exposedModule: string;
  /** `window` key the host writes config into. Must start with `__`. */
  windowConfigKey: string;
  /** Event name the remote dispatches to ask the host to navigate. */
  navigateEventName: string;
  /** Defaults the host merges under any per-connection overrides. */
  defaultWindowConfig: WindowConfig;
  /** Optional human-readable name for the connection (host may prefill its form). */
  name?: string;
  /** Optional description for the connection. */
  description?: string;
  /** One or more embeddable elements. Must be non-empty; tags must be unique. */
  elements: EmbedElementConfig[];
}

/**
 * One element as it appears in the emitted descriptor JSON. Runtime fields
 * (`component`, `appProviders`) are gone; `defineExport` is derived from the tag.
 */
export interface EmbedDescriptorElement {
  elementTag: string;
  /** Deterministic name of the generated registration fn, e.g. `defineRemoteReportsElement`. */
  defineExport: string;
  description?: string;
  acceptsRoutes?: string[];
}

/**
 * The serializable output consumed by host shells — the "emit a json that can
 * be consumed by others" deliverable. Safe to write next to `remoteEntry.json`.
 */
export interface EmbedDescriptor {
  schemaVersion: typeof SCHEMA_VERSION;
  provider: EmbedProvider;
  /** Module Federation expose key — the host's Connection `exposedModule`. */
  exposedModule: string;
  windowConfigKey: string;
  navigateEventName: string;
  defaultWindowConfig: WindowConfig;
  name?: string;
  description?: string;
  elements: EmbedDescriptorElement[];
}
