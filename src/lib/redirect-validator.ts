/**
 * Secure Redirect Validation Utility
 *
 * Enforces strict relative-path-only validation for redirection targets
 * (such as the `next` parameter in login and authentication callbacks).
 *
 * Security Contract & Invariants:
 * 1. Relative-Path-Only: Candidates MUST be relative application paths starting with a single '/'.
 * 2. Absolute URL Rejection: ALL absolute URLs (including same-origin and synthetic origins) are REJECTED.
 * 3. Protocol-Relative Rejection: Rejects '//' and all protocol-relative variants (e.g. '///', '////').
 * 4. Backslash & Ambiguity Rejection: Rejects any backslash ('\'), raw or percent-encoded ('%5C').
 * 5. Control Character Rejection: Rejects ASCII control characters (0-31, 127), CRLF, tabs, and null bytes.
 * 6. Multi-Encoding Protection: Recursively decodes input (up to 3 levels) to reject nested bypass attempts.
 * 7. Trusted Origin Isolation: Independent of synthetic origins (e.g. chronicle.local). If a trusted
 *    origin is supplied, invalid configuration fails closed immediately; it is never substituted.
 * 8. Safe Fallback: Returns a safe relative fallback path (default: '/dashboard') upon any validation failure.
 *    Supplied fallback values are themselves strictly validated; invalid fallbacks revert to a fixed '/dashboard'.
 * 9. Preservation: Preserves valid internal paths, query strings (?tab=claims), and fragments (#overview).
 *
 * URL Normalization Behavior:
 * - Relative candidate paths are decoded and then parsed through WHATWG URL resolution.
 * - Path traversal dot-segments (both raw `/projects/../dashboard` and percent-encoded `/projects/%2e%2e/dashboard`)
 *   are safely collapsed and normalized to standard paths (e.g. `/dashboard`).
 * - WHATWG path normalization prevents root-boundary escaping (e.g. `/../../dashboard` collapses to `/dashboard`).
 * - Protocol-relative, backslash, external, or malformed traversal attacks are caught by pre-parsing
 *   and post-normalization invariants and forced to the verified safe fallback.
 */

const FIXED_SAFE_FALLBACK = '/dashboard';

// Matches control characters (ASCII 0-31 and 127)
const CONTROL_CHAR_REGEX = /[\x00-\x1F\x7F]/;

/**
 * Validates and normalizes candidate fallback values.
 * Strictly rejects:
 * - non-string or empty inputs
 * - missing leading slash
 * - protocol-relative prefixes ('//', '///')
 * - raw or percent-encoded backslashes ('\', '%5C')
 * - control characters (0-31, 127), CRLF, tabs, and null bytes
 * - malformed URI encodings
 *
 * If the supplied fallback fails any check, returns the fixed safe fallback ('/dashboard').
 */
function resolveSafeFallback(fallback: string | null | undefined): string {
  if (!fallback || typeof fallback !== 'string') {
    return FIXED_SAFE_FALLBACK;
  }

  const trimmed = fallback.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    CONTROL_CHAR_REGEX.test(trimmed)
  ) {
    return FIXED_SAFE_FALLBACK;
  }

  let decoded = trimmed;
  for (let i = 0; i < 3; i++) {
    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) break;
      decoded = nextDecoded;
    } catch {
      // Malformed encoding in fallback
      return FIXED_SAFE_FALLBACK;
    }
  }

  if (
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    CONTROL_CHAR_REGEX.test(decoded)
  ) {
    return FIXED_SAFE_FALLBACK;
  }

  try {
    const parsed = new URL(trimmed, 'http://127.0.0.1');
    if (parsed.origin !== 'http://127.0.0.1') {
      return FIXED_SAFE_FALLBACK;
    }
    const safePath = parsed.pathname + parsed.search + parsed.hash;
    if (
      !safePath.startsWith('/') ||
      safePath.startsWith('//') ||
      safePath.includes('\\') ||
      CONTROL_CHAR_REGEX.test(safePath)
    ) {
      return FIXED_SAFE_FALLBACK;
    }
    return safePath;
  } catch {
    return FIXED_SAFE_FALLBACK;
  }
}

export function validateRedirectPath(
  candidate: string | null | undefined,
  fallback: string = FIXED_SAFE_FALLBACK,
  trustedOrigin?: string
): string {
  // Validate fallback itself: must be a safe relative path
  const safeFallback = resolveSafeFallback(fallback);

  // 1. If trustedOrigin is provided, validate it strictly; invalid trusted-origin must fail closed
  let baseOrigin: string | null = null;
  if (trustedOrigin !== undefined) {
    if (typeof trustedOrigin !== 'string' || trustedOrigin.trim().length === 0) {
      return safeFallback;
    }
    try {
      const parsedOrigin = new URL(trustedOrigin.trim());
      if (parsedOrigin.protocol !== 'http:' && parsedOrigin.protocol !== 'https:') {
        return safeFallback;
      }
      if (!parsedOrigin.origin || parsedOrigin.origin === 'null') {
        return safeFallback;
      }
      baseOrigin = parsedOrigin.origin;
    } catch {
      // Invalid trusted-origin configuration must fail closed
      return safeFallback;
    }
  }

  // 2. Reject missing, empty, or non-string candidate
  if (!candidate || typeof candidate !== 'string') {
    return safeFallback;
  }

  const trimmed = candidate.trim();
  if (trimmed.length === 0) {
    return safeFallback;
  }

  // 3. Candidate MUST start with a single '/'
  // Rejects relative paths without a leading slash (e.g. 'dashboard')
  // Rejects absolute URLs (e.g. 'http://...', 'https://...', 'ftp://...', 'javascript:...')
  // Rejects same-origin absolute URLs (e.g. 'http://localhost:3000/dashboard', 'http://chronicle.local/dashboard')
  if (!trimmed.startsWith('/')) {
    return safeFallback;
  }

  // 4. Reject protocol-relative URLs (starting with '//' or '///')
  if (trimmed.startsWith('//')) {
    return safeFallback;
  }

  // 5. Reject raw backslashes and control characters
  if (CONTROL_CHAR_REGEX.test(trimmed) || trimmed.includes('\\')) {
    return safeFallback;
  }

  // 6. Inspect decoded representation to catch encoded bypass attempts
  // (e.g. %5C, %2F%2F, %00, double-encoded bypasses)
  let decoded = trimmed;
  for (let i = 0; i < 3; i++) {
    try {
      const nextDecoded = decodeURIComponent(decoded);
      if (nextDecoded === decoded) break;
      decoded = nextDecoded;
    } catch {
      // Malformed URI encoding
      return safeFallback;
    }
  }

  // Decoded string must also satisfy all security invariants
  if (
    !decoded.startsWith('/') ||
    decoded.startsWith('//') ||
    decoded.includes('\\') ||
    CONTROL_CHAR_REGEX.test(decoded)
  ) {
    return safeFallback;
  }

  // 7. Parse with WHATWG URL parser to ensure grammatical validity and path normalization
  // Use trustedOrigin if explicitly provided, or dummy anchor http://127.0.0.1
  const dummyBase = baseOrigin ?? 'http://127.0.0.1';
  let parsed: URL;
  try {
    parsed = new URL(trimmed, dummyBase);
  } catch {
    return safeFallback;
  }

  // 8. Strict origin check: candidate must NOT have altered the origin
  if (parsed.origin !== dummyBase) {
    return safeFallback;
  }

  // 9. Reconstruct the relative path: pathname + search + hash
  const safePath = parsed.pathname + parsed.search + parsed.hash;

  // 10. Final defense-in-depth verification on safePath
  if (
    !safePath.startsWith('/') ||
    safePath.startsWith('//') ||
    safePath.includes('\\') ||
    CONTROL_CHAR_REGEX.test(safePath)
  ) {
    return safeFallback;
  }

  return safePath;
}

/**
 * Resolves the safe navigation target for the login redirect flow.
 * Enforces relative-path-only targets and defaults to '/dashboard'.
 */
export function resolveLoginRedirect(rawNext: string | null | undefined): string {
  return validateRedirectPath(rawNext, FIXED_SAFE_FALLBACK);
}

/**
 * Resolves and validates the canonical deployment application origin.
 *
 * Security Contract:
 * - `APP_URL` is the sole authoritative server-side canonical-origin setting.
 * - `NEXT_PUBLIC_SITE_URL` is NOT used for server-side security decisions.
 * - Rejects missing, empty, or whitespace-only configuration.
 * - Accepts only absolute HTTP or HTTPS URLs.
 * - Rejects URLs containing credentials (username or password).
 * - Rejects non-root paths (path must be empty or exactly '/').
 * - Rejects query strings and URL fragments.
 * - Returns the normalized origin string (e.g. "http://localhost:3000") only after all checks pass.
 * - Returns `null` if any validation check fails (triggering fail-closed behavior).
 */
export function getCanonicalAppOrigin(): string | null {
  const configured = process.env.APP_URL;
  if (!configured || typeof configured !== 'string') {
    return null;
  }

  const trimmed = configured.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    // 1. Accept only http: and https: protocols
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    // 2. Reject credentials (username / password)
    if (url.username || url.password) {
      return null;
    }

    // 3. Reject non-root paths (must be '/' or empty)
    if (url.pathname !== '/' && url.pathname !== '') {
      return null;
    }

    // 4. Reject query strings
    if (url.search) {
      return null;
    }

    // 5. Reject URL fragments / hashes
    if (url.hash) {
      return null;
    }

    // 6. Ensure valid hostname and origin
    if (!url.hostname || !url.origin || url.origin === 'null') {
      return null;
    }

    return url.origin;
  } catch {
    // Malformed URL input fails closed
    return null;
  }
}