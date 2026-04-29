import { TEXT_SCALE_VALUES, type TextScale } from '../../context/textScale.ts';

interface StylePropertyWriter {
  setProperty: (property: string, value: string) => void;
}

export const textScaleOptionIDs = TEXT_SCALE_VALUES;

export const textScaleVariablesById: Record<TextScale, Record<string, string>> = {
  default: {
    '--gt-text-scale-factor': '1',
    '--gt-control-segmented-font-size': '0.5625rem',
    '--gt-control-segmented-min-height': '2.125rem',
    '--gt-control-segmented-padding-inline': '0.625rem',
    '--gt-control-segmented-indicator-height': '0.1875rem',
    '--gt-settings-section-badge-size': '0.5rem',
    '--gt-settings-section-title-size': '0.75rem',
    '--gt-settings-label-size': '0.5625rem',
    '--gt-settings-meta-size': '0.5rem',
    '--gt-settings-body-size': '0.5625rem',
    '--gt-settings-value-size': '0.625rem',
  },
  large: {
    '--gt-text-scale-factor': '1.0625',
    '--gt-control-segmented-font-size': '0.625rem',
    '--gt-control-segmented-min-height': '2.375rem',
    '--gt-control-segmented-padding-inline': '0.75rem',
    '--gt-control-segmented-indicator-height': '0.25rem',
    '--gt-settings-section-badge-size': '0.5625rem',
    '--gt-settings-section-title-size': '0.8125rem',
    '--gt-settings-label-size': '0.625rem',
    '--gt-settings-meta-size': '0.5625rem',
    '--gt-settings-body-size': '0.625rem',
    '--gt-settings-value-size': '0.6875rem',
  },
  'x-large': {
    '--gt-text-scale-factor': '1.125',
    '--gt-control-segmented-font-size': '0.6875rem',
    '--gt-control-segmented-min-height': '2.625rem',
    '--gt-control-segmented-padding-inline': '0.875rem',
    '--gt-control-segmented-indicator-height': '0.25rem',
    '--gt-settings-section-badge-size': '0.625rem',
    '--gt-settings-section-title-size': '0.875rem',
    '--gt-settings-label-size': '0.6875rem',
    '--gt-settings-meta-size': '0.625rem',
    '--gt-settings-body-size': '0.6875rem',
    '--gt-settings-value-size': '0.75rem',
  },
};

export function applyTextScaleVariables(target: StylePropertyWriter, value: TextScale): void {
  const variables = textScaleVariablesById[value];
  Object.entries(variables).forEach(([name, variableValue]) => {
    target.setProperty(name, variableValue);
  });
}

export function applyDocumentTextScale(doc: Document | null, value: TextScale): void {
  if (!doc) {
    return;
  }
  applyTextScaleVariables(doc.documentElement.style, value);
}
