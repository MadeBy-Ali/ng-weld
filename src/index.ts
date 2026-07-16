export { defineEmbed, EmbedConfigError } from './define.js';
export { toDescriptor, serializeDescriptor, deriveDefineExport } from './descriptor.js';
export { parseDescriptor, DescriptorParseError } from './parse.js';
export { SCHEMA_VERSION } from './types.js';
export type {
  EmbedProvider,
  WindowConfig,
  EmbedElementConfig,
  EmbedConfig,
  EmbedDescriptorElement,
  EmbedDescriptor,
} from './types.js';
