export const TEXT_SCALE_STORAGE_KEY = 'text-scale';

export const TEXT_SCALE_VALUES = ['default', 'large', 'x-large'] as const;

export type TextScale = (typeof TEXT_SCALE_VALUES)[number];

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function isTextScale(value: string | null): value is TextScale {
  return value === 'default' || value === 'large' || value === 'x-large';
}

export function resolveInitialTextScale(value: string | null): TextScale {
  return isTextScale(value) ? value : 'default';
}

export function readStoredTextScale(storage: StorageLike | null): TextScale {
  return resolveInitialTextScale(storage?.getItem(TEXT_SCALE_STORAGE_KEY) ?? null);
}

export function persistTextScale(storage: StorageLike | null, textScale: TextScale) {
  storage?.setItem(TEXT_SCALE_STORAGE_KEY, textScale);
}

export function getTextScaleAttributeValue(textScale: TextScale): string {
  return textScale;
}
