import { ClearanceTier } from '../types';

export interface TestAuthResult {
  userId: string;
  shadowTier: ClearanceTier | null;
}

/**
 * Explicit test-only authentication adapter.
 * MUST NOT be reachable in production builds or production runtime configuration.
 * Gated strictly behind NODE_ENV === 'test' and CHRONICLE_TEST_AUTH_ENABLED === 'true'.
 */
export function resolveTestBearerToken(
  authorizationHeader?: string
): TestAuthResult | null {
  // Hard gate: strictly disabled in production or when not in explicit test execution
  if (
    process.env.NODE_ENV !== 'test' ||
    process.env.CHRONICLE_TEST_AUTH_ENABLED !== 'true'
  ) {
    return null;
  }

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  if (!token.startsWith('chronicle-test-user:')) {
    return null;
  }

  const parts = token.split(':');
  const userId = parts[1];
  if (!userId) {
    return null;
  }

  let shadowTier: ClearanceTier | null = null;
  if (parts[2]) {
    const parsedShadow = Number(parts[2]);
    if (parsedShadow === 1 || parsedShadow === 2 || parsedShadow === 3) {
      shadowTier = parsedShadow as ClearanceTier;
    }
  }

  return { userId, shadowTier };
}

