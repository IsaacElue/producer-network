import { createContext, useContext } from 'react';

import type { Mood } from '@/constants/design';

// The active screen mood, provided by MoodBackground. Shared primitives
// (ThemedText, Button, TextField, Chip, …) read it so they recolour to match
// the screen without per-call styling. Null when a screen isn't on a mood
// ground, in which case components fall back to the legacy app theme.
const MoodContext = createContext<Mood | null>(null);

export const MoodProvider = MoodContext.Provider;

export function useMood(): Mood | null {
  return useContext(MoodContext);
}

// Translucent surface colour for cards/inputs sitting on a mood ground. Given
// enough presence to lift content (and its text) off the ASCII backdrop.
export function moodSurface(mood: Mood, level: 1 | 2 = 1): string {
  if (mood.dark) return level === 1 ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.17)';
  return level === 1 ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.62)';
}
