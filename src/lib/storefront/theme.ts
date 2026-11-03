import type { CSSProperties } from "react";
import type { StorefrontTheme } from "@/lib/caisse212/storefront/types";

/**
 * Theme values come from public storefront data, so they are treated as
 * untrusted input: only safe color literals, logo URLs and font names are
 * applied. Everything else is preserved in `data` but ignored by the renderer.
 */

export function safeColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ? trimmed : undefined;
}

export function safeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function safeLogoSrc(value: unknown): string | undefined {
  const src = safeString(value);
  if (!src) return undefined;
  if (src.startsWith("/")) return src;
  return /^https?:\/\//.test(src) ? src : undefined;
}

export function safeFont(value: unknown): string | undefined {
  const font = safeString(value);
  return font && /^[a-zA-Z0-9 ,%-]{1,60}$/.test(font) ? font : undefined;
}

/** CSS variables consumed by the storefront design tokens. */
export function storefrontThemeStyle(theme: StorefrontTheme | undefined): CSSProperties {
  const style: Record<string, string> = {};
  const primary = safeColor(theme?.primary);
  const secondary = safeColor(theme?.secondary);
  const font = safeFont(theme?.font);
  if (primary) {
    style["--green"] = primary;
    style["--storefront-primary"] = primary;
  }
  if (secondary) style["--storefront-secondary"] = secondary;
  if (font) style["--storefront-font"] = font;
  return style as CSSProperties;
}
