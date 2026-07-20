import { describe, it, expect } from 'vitest';
import {
  defineEmbed,
  EmbedConfigError,
  toDescriptor,
  serializeDescriptor,
  deriveDefineExport,
  parseDescriptor,
  DescriptorParseError,
  SCHEMA_VERSION,
} from './index.js';
import type { EmbedConfig } from './index.js';

// A stand-in for an Angular standalone component. The package never touches it.
class RemoteEntryComponent {}

function validConfig(overrides: Partial<EmbedConfig> = {}): EmbedConfig {
  return {
    provider: 'ANGULAR_COMPONENT',
    exposedModule: './WebComponent',
    windowConfigKey: '__remoteReportsConfig',
    navigateEventName: 'remoteReports:navigate',
    defaultWindowConfig: { basePath: '/reports-widget', mfeName: 'remoteReports' },
    elements: [
      {
        elementTag: 'remote-reports-element',
        component: RemoteEntryComponent,
        description: 'Full Reports dashboard',
        acceptsRoutes: ['/reports/latest'],
      },
    ],
    ...overrides,
  };
}

describe('defineEmbed', () => {
  it('returns the config unchanged when valid', () => {
    const config = validConfig();
    expect(defineEmbed(config)).toBe(config);
  });

  it('rejects an unknown provider', () => {
    expect(() =>
      // @ts-expect-error — testing a runtime guard against invalid input
      defineEmbed(validConfig({ provider: 'REACT_COMPONENT' })),
    ).toThrow(EmbedConfigError);
  });

  it('rejects an empty exposedModule', () => {
    expect(() => defineEmbed(validConfig({ exposedModule: '' }))).toThrow(
      /exposedModule must be a non-empty/,
    );
  });

  it('rejects a windowConfigKey without the __ prefix', () => {
    expect(() => defineEmbed(validConfig({ windowConfigKey: 'reportsConfig' }))).toThrow(
      /must start with "__"/,
    );
  });

  it('rejects an elementTag with no hyphen', () => {
    expect(() =>
      defineEmbed(
        validConfig({
          elements: [{ elementTag: 'remotereports', component: RemoteEntryComponent }],
        }),
      ),
    ).toThrow(/must contain a hyphen/);
  });

  it('rejects duplicate element tags', () => {
    expect(() =>
      defineEmbed(
        validConfig({
          elements: [
            { elementTag: 'remote-a-element', component: RemoteEntryComponent },
            { elementTag: 'remote-a-element', component: RemoteEntryComponent },
          ],
        }),
      ),
    ).toThrow(/duplicate elementTag/);
  });

  it('rejects an empty elements array', () => {
    expect(() => defineEmbed(validConfig({ elements: [] }))).toThrow(/non-empty array/);
  });

  it('allows an element without a component (v0.1 descriptor-only authoring)', () => {
    expect(() =>
      defineEmbed(validConfig({ elements: [{ elementTag: 'remote-a-element' }] })),
    ).not.toThrow();
  });
});

describe('deriveDefineExport', () => {
  it('converts a kebab tag to a define<Pascal> name', () => {
    expect(deriveDefineExport('remote-reports-element')).toBe('defineRemoteReportsElement');
  });

  it('handles a two-part tag', () => {
    expect(deriveDefineExport('foo-bar')).toBe('defineFooBar');
  });
});

describe('toDescriptor', () => {
  it('derives defineExport and stamps the schema version', () => {
    const d = toDescriptor(validConfig());
    expect(d.schemaVersion).toBe(SCHEMA_VERSION);
    expect(d.elements[0]?.defineExport).toBe('defineRemoteReportsElement');
  });

  it('carries exposedModule through (host Connection field)', () => {
    expect(toDescriptor(validConfig()).exposedModule).toBe('./WebComponent');
  });

  it('strips runtime-only fields (component, appProviders)', () => {
    const d = toDescriptor(validConfig());
    expect(d.elements[0]).not.toHaveProperty('component');
    expect(d.elements[0]).not.toHaveProperty('appProviders');
  });

  it('carries description and acceptsRoutes through', () => {
    const d = toDescriptor(validConfig());
    expect(d.elements[0]?.description).toBe('Full Reports dashboard');
    expect(d.elements[0]?.acceptsRoutes).toEqual(['/reports/latest']);
  });

  it('omits optional fields when absent rather than emitting undefined', () => {
    const d = toDescriptor(
      validConfig({
        elements: [{ elementTag: 'remote-a-element', component: RemoteEntryComponent }],
      }),
    );
    expect(d.elements[0]).not.toHaveProperty('description');
    expect(d.elements[0]).not.toHaveProperty('acceptsRoutes');
  });
});

describe('serializeDescriptor', () => {
  it('produces pretty-printed JSON with a trailing newline', () => {
    const json = serializeDescriptor(validConfig());
    expect(json.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(json);
    expect(parsed.provider).toBe('ANGULAR_COMPONENT');
    expect(parsed.elements[0].defineExport).toBe('defineRemoteReportsElement');
  });
});

describe('parseDescriptor (consumer side)', () => {
  it('round-trips a serialized descriptor back to a typed object', () => {
    const json = serializeDescriptor(validConfig());
    const d = parseDescriptor(json);
    expect(d.exposedModule).toBe('./WebComponent');
    expect(d.windowConfigKey).toBe('__remoteReportsConfig');
    expect(d.elements[0]?.defineExport).toBe('defineRemoteReportsElement');
  });

  it('accepts an already-parsed object as well as a string', () => {
    const obj = toDescriptor(validConfig());
    expect(parseDescriptor(obj).elements[0]?.elementTag).toBe('remote-reports-element');
  });

  it('rejects a mismatched schemaVersion', () => {
    const bad = { ...toDescriptor(validConfig()), schemaVersion: 999 };
    expect(() => parseDescriptor(bad)).toThrow(/unsupported schemaVersion/);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseDescriptor('{not json')).toThrow(DescriptorParseError);
  });

  it('rejects a descriptor missing exposedModule', () => {
    const bad: Record<string, unknown> = { ...toDescriptor(validConfig()) };
    delete bad['exposedModule'];
    expect(() => parseDescriptor(bad)).toThrow(/exposedModule/);
  });

  it('rejects a descriptor with an empty elements array', () => {
    const bad = { ...toDescriptor(validConfig()), elements: [] };
    expect(() => parseDescriptor(bad)).toThrow(/non-empty array/);
  });
});
