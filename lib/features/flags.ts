// lib/features/flags.ts
/**
 * Feature Flags for gradual rollout
 */

export const FEATURE_FLAGS = {
  // Test Mode - Skip to Story Review with pre-made story
  // Set to true in code or use env var for quick testing
  test_mode: process.env.NEXT_PUBLIC_TEST_MODE === 'true' || false,

  // Add more feature flags as needed
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}
