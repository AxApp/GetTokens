import type { CSSProperties } from 'react';
import type { VendorPreset } from '../model/vendorPresets';
import { resolveVendorLogo } from '../model/vendorIcons';

interface VendorLogoMarkProps {
  preset: VendorPreset;
  size?: 'sm' | 'md';
  className?: string;
}

export default function VendorLogoMark({ preset, size = 'md', className = '' }: VendorLogoMarkProps) {
  const logo = resolveVendorLogo(preset);
  const style = { '--vendor-logo-color': logo.color } as CSSProperties;
  const boxClass = size === 'sm' ? 'h-8 w-8' : 'h-10 w-10';
  const iconClass = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';

  return (
    <span
      aria-hidden="true"
      title={preset.name}
      data-provider-logo={logo.kind}
      data-provider-logo-slug={logo.slug || 'initials'}
      style={style}
      className={`inline-flex shrink-0 items-center justify-center border border-[color:color-mix(in_srgb,var(--vendor-logo-color)_42%,var(--border-color))] bg-[color-mix(in_srgb,var(--vendor-logo-color)_10%,var(--bg-main))] text-[var(--vendor-logo-color)] ${boxClass} ${className}`}
    >
      {logo.path ? (
        <svg
          viewBox="0 0 24 24"
          className={`${iconClass} overflow-visible`}
          focusable="false"
        >
          <path d={logo.path} fill="currentColor" />
        </svg>
      ) : (
        <span className="font-mono text-[length:var(--font-size-ui-2xs)] font-black uppercase tracking-normal">
          {logo.initials}
        </span>
      )}
    </span>
  );
}
