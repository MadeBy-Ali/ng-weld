import { SCHEMA_VERSION } from './types.js';
import type { EmbedDescriptor, EmbedDescriptorElement } from './types.js';

/** Thrown when a fetched descriptor is malformed or an unsupported schema version. */
export class DescriptorParseError extends Error {
  override name = 'DescriptorParseError';
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DescriptorParseError(`${where} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, where: string): string {
  if (typeof value !== 'string' || !value) {
    throw new DescriptorParseError(`${where} must be a non-empty string`);
  }
  return value;
}

/**
 * Validate and type an `embed-descriptor.json` on the **host/consumer** side.
 *
 * This is the counterpart to the producer's `serializeDescriptor`. dashboard.mfe
 * (or any shell) passes the fetched JSON — parsed or raw string — and gets back a
 * typed {@link EmbedDescriptor}, or a {@link DescriptorParseError} it can surface
 * to the admin instead of silently rendering a broken widget.
 *
 * The `schemaVersion` is checked first: a descriptor from a newer producer than
 * the host understands fails loudly here rather than misbehaving downstream.
 *
 * @param input The descriptor as a JSON string or already-parsed object.
 */
export function parseDescriptor(input: unknown): EmbedDescriptor {
  let raw: unknown = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      throw new DescriptorParseError('descriptor is not valid JSON');
    }
  }

  const obj = asRecord(raw, 'descriptor');

  if (obj['schemaVersion'] !== SCHEMA_VERSION) {
    throw new DescriptorParseError(
      `unsupported schemaVersion ${String(obj['schemaVersion'])}; this host understands ${SCHEMA_VERSION}`,
    );
  }

  if (obj['provider'] !== 'ANGULAR_COMPONENT') {
    throw new DescriptorParseError(`unsupported provider "${String(obj['provider'])}"`);
  }

  const dwc = asRecord(obj['defaultWindowConfig'], 'defaultWindowConfig');
  asString(dwc['basePath'], 'defaultWindowConfig.basePath');
  asString(dwc['mfeName'], 'defaultWindowConfig.mfeName');

  const rawElements = obj['elements'];
  if (!Array.isArray(rawElements) || rawElements.length === 0) {
    throw new DescriptorParseError('elements must be a non-empty array');
  }

  const elements: EmbedDescriptorElement[] = rawElements.map((el, i) => {
    const e = asRecord(el, `elements[${i}]`);
    const out: EmbedDescriptorElement = {
      elementTag: asString(e['elementTag'], `elements[${i}].elementTag`),
      defineExport: asString(e['defineExport'], `elements[${i}].defineExport`),
    };
    if (typeof e['description'] === 'string') out.description = e['description'];
    if (Array.isArray(e['acceptsRoutes'])) {
      out.acceptsRoutes = e['acceptsRoutes'].filter((r): r is string => typeof r === 'string');
    }
    return out;
  });

  const descriptor: EmbedDescriptor = {
    schemaVersion: SCHEMA_VERSION,
    provider: 'ANGULAR_COMPONENT',
    exposedModule: asString(obj['exposedModule'], 'exposedModule'),
    windowConfigKey: asString(obj['windowConfigKey'], 'windowConfigKey'),
    navigateEventName: asString(obj['navigateEventName'], 'navigateEventName'),
    defaultWindowConfig: {
      basePath: dwc['basePath'] as string,
      mfeName: dwc['mfeName'] as string,
      ...dwc,
    },
    elements,
  };
  if (typeof obj['name'] === 'string') descriptor.name = obj['name'];
  if (typeof obj['description'] === 'string') descriptor.description = obj['description'];
  return descriptor;
}
