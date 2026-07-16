import type { EmbedConfig } from './types.js';

/** Thrown when an embed config violates a contract rule. */
export class EmbedConfigError extends Error {
  override name = 'EmbedConfigError';
}

const VALID_PROVIDERS = new Set(['ANGULAR_COMPONENT']);

/**
 * Validate and return a remote's embed contract.
 *
 * This is the single entry point a remote uses in its `embed.config.ts`.
 * It performs the same runtime checks the type system enforces at compile
 * time, so misconfigurations fail loudly at build time even from plain JS
 * or when types are bypassed.
 *
 * @throws {EmbedConfigError} when any field violates the contract.
 */
export function defineEmbed(config: EmbedConfig): EmbedConfig {
  if (!VALID_PROVIDERS.has(config.provider)) {
    throw new EmbedConfigError(
      `provider must be one of ${[...VALID_PROVIDERS].join(', ')}, got "${config.provider}"`,
    );
  }

  if (!config.exposedModule?.trim()) {
    throw new EmbedConfigError(
      'exposedModule must be a non-empty Module Federation expose key, e.g. "./WebComponent"',
    );
  }

  if (!config.windowConfigKey.startsWith('__')) {
    throw new EmbedConfigError(
      `windowConfigKey must start with "__" (to avoid clobbering globals), got "${config.windowConfigKey}"`,
    );
  }

  if (!config.navigateEventName.trim()) {
    throw new EmbedConfigError('navigateEventName must be a non-empty string');
  }

  if (!config.defaultWindowConfig?.basePath || !config.defaultWindowConfig?.mfeName) {
    throw new EmbedConfigError(
      'defaultWindowConfig must include both "basePath" and "mfeName"',
    );
  }

  if (!Array.isArray(config.elements) || config.elements.length === 0) {
    throw new EmbedConfigError('elements must be a non-empty array');
  }

  const seenTags = new Set<string>();
  for (const el of config.elements) {
    if (!el.elementTag.includes('-')) {
      throw new EmbedConfigError(
        `elementTag "${el.elementTag}" must contain a hyphen (custom-element naming rule)`,
      );
    }
    if (seenTags.has(el.elementTag)) {
      throw new EmbedConfigError(`duplicate elementTag "${el.elementTag}"`);
    }
    seenTags.add(el.elementTag);

    if (el.component == null) {
      throw new EmbedConfigError(`element "${el.elementTag}" is missing its component`);
    }
  }

  return config;
}
