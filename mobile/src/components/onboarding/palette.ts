// Shared visual tokens for the redesigned onboarding flow. Kept separate from
// the app-wide theme so the fluid/glass treatment can evolve without touching
// the rest of the UI.

export const ACCENT = '#6E7BF2';
export const ACCENT_2 = '#8A5CF6';
export const GLOW = '#6E7BF2';

// Liquid background blob colours (light / dark). Soft, saturated, low-count.
export const BLOBS_DARK = ['#6E7BF2', '#8A5CF6', '#3AA6C9'] as const;
export const BLOBS_LIGHT = ['#AEB8FF', '#D2B8FF', '#B8E4F5'] as const;

export const ACCENT_GRADIENT = [ACCENT, ACCENT_2] as const;
