/** Theme preferences stored in the Host user-settings document. */

import z from '@deepseek-ai/schemastery'

/** Built-in preferences accepted at the registry and settings boundaries. */
export const THEME_PREFERENCES = ['light', 'dark', 'system'] as const

/** Settings namespace owned by the theme plugin. */
export const THEME_SETTINGS_NAMESPACE = 'ui-theme'

/** Field carrying the selected built-in theme preference. */
export const THEME_PREFERENCE_FIELD = 'preference'

/** Field carrying the persisted sidebar transparency percentage. */
export const SIDEBAR_TRANSPARENCY_FIELD = 'sidebarTransparency'

/** Sidebar transparency range exposed by the Appearance settings row. */
export const SIDEBAR_TRANSPARENCY_MIN = 0
export const SIDEBAR_TRANSPARENCY_MAX = 100
export const DEFAULT_SIDEBAR_TRANSPARENCY = 40

/** Theme preference persisted by the product Appearance row. */
export type ThemePreference = typeof THEME_PREFERENCES[number]

/** Default preference when the user-settings document has no override. */
export const DEFAULT_PREFERENCE: ThemePreference = 'system'

/** Durable theme section shared by the Host schema and the browser scope. */
export interface ThemeSettings {
  /** Selected built-in preference. */
  preference: ThemePreference
  /** Percentage of the native/background surface visible through the sidebar tint. */
  sidebarTransparency: number
}

/** Durable theme schema; also the wire envelope the browser scope validates against. */
export const ThemeSettingsSchema: z<ThemeSettings> = z.object({
  [THEME_PREFERENCE_FIELD]: z.union([...THEME_PREFERENCES]).default(DEFAULT_PREFERENCE),
  [SIDEBAR_TRANSPARENCY_FIELD]: z.number()
    .step(1)
    .min(SIDEBAR_TRANSPARENCY_MIN)
    .max(SIDEBAR_TRANSPARENCY_MAX)
    .default(DEFAULT_SIDEBAR_TRANSPARENCY),
})

/** Keep settings writes safe when an untyped caller crosses the client boundary. */
export function normalizeSidebarTransparency(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_SIDEBAR_TRANSPARENCY
  return Math.min(
    SIDEBAR_TRANSPARENCY_MAX,
    Math.max(SIDEBAR_TRANSPARENCY_MIN, Math.round(value)),
  )
}

/**
 * Narrow one wire or registry value to a persistable preference.
 * @param value - value crossing the settings or registry boundary.
 * @returns whether the value is a built-in preference.
 */
export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.some(preference => preference === value)
}
