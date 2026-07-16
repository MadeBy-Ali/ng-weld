import { SCHEMA_VERSION } from './types.js';
import type { EmbedConfig, EmbedDescriptor, EmbedDescriptorElement } from './types.js';

/**
 * Derive the deterministic registration-fn name for an element tag.
 *
 * `remote-ag-dipa-element` -> `defineRemoteAgDipaElement`
 *
 * Kept deterministic so the descriptor's `defineExport` can never drift from
 * the name the codegen (v0.2+) emits for the actual boilerplate.
 */
export function deriveDefineExport(elementTag: string): string {
  const pascal = elementTag
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return `define${pascal}`;
}

/**
 * Project a validated {@link EmbedConfig} into its serializable descriptor.
 *
 * Runtime-only fields (`component`, `appProviders`) are dropped, `defineExport`
 * is derived from each tag, and a `schemaVersion` is stamped. The result is
 * plain JSON — feed it to {@link serializeDescriptor} or `JSON.stringify`.
 */
export function toDescriptor(config: EmbedConfig): EmbedDescriptor {
  const elements: EmbedDescriptorElement[] = config.elements.map((el) => {
    const out: EmbedDescriptorElement = {
      elementTag: el.elementTag,
      defineExport: deriveDefineExport(el.elementTag),
    };
    if (el.description !== undefined) out.description = el.description;
    if (el.acceptsRoutes !== undefined) out.acceptsRoutes = el.acceptsRoutes;
    return out;
  });

  const descriptor: EmbedDescriptor = {
    schemaVersion: SCHEMA_VERSION,
    provider: config.provider,
    exposedModule: config.exposedModule,
    windowConfigKey: config.windowConfigKey,
    navigateEventName: config.navigateEventName,
    defaultWindowConfig: config.defaultWindowConfig,
    elements,
  };
  if (config.name !== undefined) descriptor.name = config.name;
  if (config.description !== undefined) descriptor.description = config.description;
  return descriptor;
}

/**
 * Convenience: produce the pretty-printed JSON string to write to
 * `embed-descriptor.json` next to `remoteEntry.json` at build output.
 */
export function serializeDescriptor(config: EmbedConfig): string {
  return JSON.stringify(toDescriptor(config), null, 2) + '\n';
}
