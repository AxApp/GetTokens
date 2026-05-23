import type { ApiFormat } from '../../../types';
import type { VendorPreset } from './vendorPresets';
import { getVendorPreset, getVendorPresets } from './vendorPresets.ts';

export function getVendorPresetByBaseURL(baseUrl: string): VendorPreset | undefined {
  const normalized = normalizeBaseURL(baseUrl);
  if (!normalized) return undefined;
  return getVendorPresets().find((p) => normalizeBaseURL(p.baseUrl) === normalized);
}

export function resolveVendorPresetID(name: string, baseUrl: string): string | undefined {
  const preset = getVendorPresetByBaseURL(baseUrl);
  if (preset) return preset.id;
  const lowerName = name.trim().toLowerCase();
  return getVendorPresets().find(
    (p) => p.id === lowerName || p.name.toLowerCase() === lowerName,
  )?.id;
}

export function normalizeBaseURL(raw: string): string {
  let trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed);
    url.search = '';
    url.hash = '';
    let result = url.toString();
    if (result.endsWith('/')) result = result.slice(0, -1);
    return result;
  } catch {
    while (trimmed.endsWith('/')) trimmed = trimmed.slice(0, -1);
    return trimmed.toLowerCase();
  }
}

export function formatLabel(fmt: ApiFormat): string {
  switch (fmt) {
    case 'anthropic': return 'ANTHROPIC';
    case 'openai_chat': return 'OPENAI CHAT';
    case 'openai_responses': return 'OPENAI RESPONSES';
    case 'gemini_native': return 'GEMINI';
  }
}

export function formatShortLabel(fmt: ApiFormat): string {
  switch (fmt) {
    case 'anthropic': return 'ANTH';
    case 'openai_chat': return 'OAI CHAT';
    case 'openai_responses': return 'OAI RESP';
    case 'gemini_native': return 'GEM';
  }
}

export function formatSupportedFormatsDisplay(formats: ApiFormat[]): string {
  return formats.map(formatLabel).join(' + ');
}
