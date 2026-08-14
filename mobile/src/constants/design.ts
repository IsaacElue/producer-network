// Producer Network design system — shared tokens.
//
// Direction: confident, high-contrast, editorial, with digital/retro monospace
// accents (early-2000s handset-UI plainness meeting modern editorial type).
// Flat and legible — NOT soft, glassy, or generically "AI". Two weights only
// (400 / 500). Colour lives in a set of gradient "moods" chosen per screen,
// never one static wash reused everywhere.

import { Fonts } from '@/constants/theme';

const mono = Fonts.mono;

// ── Type scale ───────────────────────────────────────────────────────
// `display`/`title`/`heading` are the confident editorial voice (sans).
// `label`/`mono`/`meta` are the monospace accents (uppercase, tracked).
export const Type = {
  display: { fontSize: 46, lineHeight: 48, fontWeight: '500' as const },
  title: { fontSize: 30, lineHeight: 34, fontWeight: '500' as const },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '500' as const },
  bodyLg: { fontSize: 19, lineHeight: 30, fontWeight: '400' as const },
  body: { fontSize: 16, lineHeight: 25, fontWeight: '400' as const },
  // Monospace accents
  label: { fontFamily: mono, fontSize: 11, letterSpacing: 2, fontWeight: '400' as const },
  meta: { fontFamily: mono, fontSize: 13, letterSpacing: 0.5, fontWeight: '400' as const },
  caption: { fontFamily: mono, fontSize: 12, letterSpacing: 1.5, fontWeight: '400' as const },
  input: { fontSize: 22, lineHeight: 28, fontWeight: '400' as const },
} as const;

export const Mono = mono;

// ── Spacing ──────────────────────────────────────────────────────────
export const Space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 40,
  xxl: 64,
} as const;

export const Radius = {
  none: 0,
  sm: 4,
  md: 10,
  pill: 999,
} as const;

// ── Moods ────────────────────────────────────────────────────────────
// Each mood is a full token set so a screen picks one and gets a coherent
// palette. `dark` marks whether ink is light-on-dark (for status bar etc).
export type Mood = {
  key: string;
  gradient: readonly [string, string];
  ink: string; // primary text
  inkSoft: string; // secondary text
  label: string; // monospace labels
  faint: string; // faintest text / captions
  hairline: string; // dividers
  accent: string; // interactive / emphasis
  ascii: string; // backdrop character colour
  dark: boolean;
};

export const MOODS = {
  // Warm terracotta → taupe. The spotlight/editorial default.
  ember: {
    key: 'ember',
    gradient: ['#B96E4C', '#7E736A'],
    ink: '#F6F0E6',
    inkSoft: '#EBE2D5',
    label: '#E3D3C2',
    faint: 'rgba(246,240,230,0.55)',
    hairline: 'rgba(246,240,230,0.22)',
    accent: '#F2A175',
    ascii: '#F3E7D8',
    dark: true,
  },
  // Cool indigo/violet → deep slate. Replaces the old purple/blue onboarding
  // wash, but as a defined, controlled cool mood.
  dusk: {
    key: 'dusk',
    gradient: ['#463C79', '#1B1A2B'],
    ink: '#EEEBFA',
    inkSoft: '#D6D0EE',
    label: '#B7AEDC',
    faint: 'rgba(238,235,250,0.52)',
    hairline: 'rgba(238,235,250,0.18)',
    accent: '#9E8CFF',
    ascii: '#CBC2EE',
    dark: true,
  },
  // Warm near-black. High-contrast editorial dark, the "handset" default.
  carbon: {
    key: 'carbon',
    gradient: ['#221E19', '#0B0A09'],
    ink: '#F1EADD',
    inkSoft: '#CBC3B5',
    label: '#9A9082',
    faint: 'rgba(241,234,221,0.5)',
    hairline: 'rgba(241,234,221,0.16)',
    accent: '#EA7B3C',
    ascii: '#7A7060',
    dark: true,
  },
  // Warm light. Cream ground, dark ink — the light mood.
  sand: {
    key: 'sand',
    gradient: ['#EAE2D3', '#D3C8B4'],
    ink: '#292019',
    inkSoft: '#584B3D',
    label: '#8A7A66',
    faint: 'rgba(41,32,25,0.55)',
    hairline: 'rgba(41,32,25,0.16)',
    accent: '#B0512C',
    ascii: 'rgba(41,32,25,0.5)',
    dark: false,
  },
} as const;

export type MoodKey = keyof typeof MOODS;
