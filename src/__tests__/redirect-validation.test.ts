 import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  validateRedirectPath,
  resolveLoginRedirect,
  getCanonicalAppOrigin,
} from '../lib/redirect-validator';
import * as callbackRoute from '../app/auth/callback/route';

// Mock Supabase SSR for callback tests
const mockExchangeCodeForSession = vi.fn();
vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
    },
  })),
}));

describe('Redirect Validation & Origin Security Matrix (Milestone A Hardening)', () => {
  const originalEnv = { ...process.env };
  const canonicalOrigin = 'http://localhost:3000';

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.APP_URL = canonicalOrigin;
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake-supabase-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key';
    mockExchangeCodeForSession.mockReset();
    mockExchangeCodeForSession.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  describe('1. Shared Utility: validateRedirectPath()', () => {
    describe('Valid Relative Destinations', () => {
      it('accepts /dashboard', () => {
        expect(validateRedirectPath('/dashboard')).toBe('/dashboard');
      });

      it('accepts /projects/example', () => {
        expect(validateRedirectPath('/projects/example')).toBe('/projects/example');
      });

      it('accepts /projects/example?tab=claims', () => {
        expect(validateRedirectPath('/projects/example?tab=claims')).toBe(
          '/projects/example?tab=claims'
        );
      });

      it('preserves query parameters and URL fragments', () => {
        expect(
          validateRedirectPath('/projects/proj-123/reconstruct?step=2&view=graph#node-45')
        ).toBe('/projects/proj-123/reconstruct?step=2&view=graph#node-45');
      });

      it('accepts nested internal paths', () => {
        expect(validateRedirectPath('/settings/security/mfa')).toBe('/settings/security/mfa');
      });
    });

    describe('URL Normalization & Dot-Segment Traversal Handling', () => {
      it('normalizes raw dot-segments safely: /projects/../dashboard', () => {
        expect(validateRedirectPath('/projects/../dashboard')).toBe('/dashboard');
      });

      it('normalizes percent-encoded dot-segments safely: /projects/%2e%2e/dashboard', () => {
        expect(validateRedirectPath('/projects/%2e%2e/dashboard')).toBe('/dashboard');
      });

      it('normalizes uppercase percent-encoded dot-segments: /projects/%2E%2E/dashboard', () => {
        expect(validateRedirectPath('/projects/%2E%2E/dashboard')).toBe('/dashboard');
      });

      it('normalizes multi-level dot-segment traversal: /projects/sub/../../dashboard', () => {
        expect(validateRedirectPath('/projects/sub/../../dashboard')).toBe('/dashboard');
      });

      it('binds traversal at root and normalizes: /../dashboard', () => {
        expect(validateRedirectPath('/../dashboard')).toBe('/dashboard');
      });
    });

    describe('Fallback Validation & Unsafe Fallback Rejection', () => {
      it('reverts to fixed safe fallback /dashboard when supplied fallback is an external URL', () => {
        expect(
          validateRedirectPath('https://attacker.example', 'https://attacker.fallback')
        ).toBe('/dashboard');
      });

      it('reverts to fixed safe fallback /dashboard when supplied fallback is protocol-relative', () => {
        expect(
          validateRedirectPath('https://attacker.example', '//attacker.fallback')
        ).toBe('/dashboard');
        expect(
          validateRedirectPath('https://attacker.example', '///attacker.fallback')
        ).toBe('/dashboard');
      });

      it('reverts to fixed safe fallback /dashboard when supplied fallback contains backslashes', () => {
        expect(
          validateRedirectPath('https://attacker.example', '\\attacker.fallback')
        ).toBe('/dashboard');
        expect(
          validateRedirectPath('https://attacker.example', '/\\attacker.fallback')
        ).toBe('/dashboard');
        expect(
          validateRedirectPath('https://attacker.example', '/path\\to\\page')
        ).toBe('/dashboard');
      });

      it('reverts to fixed safe fallback /dashboard when supplied fallback has control characters or CRLF', () => {
        expect(
          validateRedirectPath('https://attacker.example', '/dashboard\r\nSet-Cookie:bad=1')
        ).toBe('/dashboard');
        expect(
          validateRedirectPath('https://attacker.example', '/dashboard\0evil')
        ).toBe('/dashboard');
        expect(
          validateRedirectPath('https://attacker.example', '/dashboard\tevil')
        ).toBe('/dashboard');
      });

      it('reverts to fixed safe fallback /dashboard when supplied fallback has encoded/malformed characters', () => {
        expect(
          validateRedirectPath('https://attacker.example', '/fallback%E0%A4%A')
        ).toBe('/dashboard');
        expect(
          validateRedirectPath('https://attacker.example', '/%2F%2Fattacker.fallback')
        ).toBe('/dashboard');
        expect(
          validateRedirectPath('https://attacker.example', '/%5Cattacker.fallback')
        ).toBe('/dashboard');
      });

      it('reverts to fixed safe fallback /dashboard when supplied fallback lacks a leading slash', () => {
        expect(validateRedirectPath('https://attacker.example', 'dashboard')).toBe(
          '/dashboard'
        );
      });

      it('preserves a valid custom fallback when supplied', () => {
        expect(
          validateRedirectPath('https://attacker.example', '/safe-custom-fallback')
        ).toBe('/safe-custom-fallback');
        expect(
          validateRedirectPath('https://attacker.example', '/auth/login?reason=timeout')
        ).toBe('/auth/login?reason=timeout');
      });
    });

    describe('Relative-Path-Only Enforcement & Rejections', () => {
      it('rejects same-origin absolute URLs even when trusted origin matches', () => {
        expect(
          validateRedirectPath(
            'http://localhost:3000/dashboard',
            '/dashboard',
            'http://localhost:3000'
          )
        ).toBe('/dashboard');

        expect(
          validateRedirectPath(
            'https://chronicle.example.com/projects/example',
            '/dashboard',
            'https://chronicle.example.com'
          )
        ).toBe('/dashboard');
      });

      it('rejects absolute URLs using the synthetic chronicle.local origin', () => {
        expect(validateRedirectPath('http://chronicle.local/dashboard')).toBe('/dashboard');
        expect(validateRedirectPath('http://chronicle.local/projects/example')).toBe(
          '/dashboard'
        );
      });

      it('rejects relative paths without a leading slash', () => {
        expect(validateRedirectPath('dashboard')).toBe('/dashboard');
        expect(validateRedirectPath('projects/example')).toBe('/dashboard');
        expect(validateRedirectPath('projects/example?tab=claims')).toBe('/dashboard');
      });

      it('fails closed when trusted-origin configuration is invalid or malformed', () => {
        expect(
          validateRedirectPath('/projects/example', '/dashboard', 'not-a-valid-origin')
        ).toBe('/dashboard');
        expect(
          validateRedirectPath('/projects/example', '/dashboard', 'ftp://invalid-scheme.com')
        ).toBe('/dashboard');
        expect(
          validateRedirectPath('/projects/example', '/dashboard', 'javascript:alert(1)')
        ).toBe('/dashboard');
        expect(validateRedirectPath('/projects/example', '/dashboard', '')).toBe(
          '/dashboard'
        );
      });

      it('rejects absolute external URL: https://attacker.example', () => {
        expect(validateRedirectPath('https://attacker.example')).toBe('/dashboard');
      });

      it('rejects protocol-relative URL: //attacker.example', () => {
        expect(validateRedirectPath('//attacker.example')).toBe('/dashboard');
      });

      it('rejects triple-slash protocol-relative URL: ///attacker.example', () => {
        expect(validateRedirectPath('///attacker.example')).toBe('/dashboard');
      });

      it('rejects quadruple-slash URL: ////attacker.example', () => {
        expect(validateRedirectPath('////attacker.example')).toBe('/dashboard');
      });

      it('rejects leading backslashes: \\\\attacker.example', () => {
        expect(validateRedirectPath('\\\\attacker.example')).toBe('/dashboard');
      });

      it('rejects slash followed by backslash: /\\\\attacker.example', () => {
        expect(validateRedirectPath('/\\\\attacker.example')).toBe('/dashboard');
      });

      it('rejects slash backslash single: /\\attacker.example', () => {
        expect(validateRedirectPath('/\\attacker.example')).toBe('/dashboard');
      });

      it('rejects embedded backslashes within paths: /path\\to\\page', () => {
        expect(validateRedirectPath('/path\\to\\page')).toBe('/dashboard');
      });

      it('rejects non-http(s) schemes: javascript:alert(1)', () => {
        expect(validateRedirectPath('javascript:alert(1)')).toBe('/dashboard');
      });

      it('rejects non-http(s) schemes: data:text/html,<script>alert(1)</script>', () => {
        expect(validateRedirectPath('data:text/html,<script>alert(1)</script>')).toBe(
          '/dashboard'
        );
      });
    });

    describe('Control Characters & Line Break Injections', () => {
      it('rejects null byte in path: /dashboard\\0/attacker', () => {
        expect(validateRedirectPath('/dashboard\0/attacker')).toBe('/dashboard');
      });

      it('rejects CRLF injection: /dashboard\\r\\nSet-Cookie:admin=1', () => {
        expect(validateRedirectPath('/dashboard\r\nSet-Cookie:admin=1')).toBe('/dashboard');
      });

      it('rejects tabs and ASCII control characters: /dashboard\\t/attacker', () => {
        expect(validateRedirectPath('/dashboard\t/attacker')).toBe('/dashboard');
      });

      it('rejects delete character (0x7F)', () => {
        expect(validateRedirectPath('/dashboard\x7F')).toBe('/dashboard');
      });
    });

    describe('Malformed & Normalized / Encoded URL Inputs', () => {
      it('handles null, undefined, and empty string by returning fallback', () => {
        expect(validateRedirectPath(null)).toBe('/dashboard');
        expect(validateRedirectPath(undefined)).toBe('/dashboard');
        expect(validateRedirectPath('')).toBe('/dashboard');
        expect(validateRedirectPath('   ')).toBe('/dashboard');
      });

      it('rejects URL-encoded slashes attempting protocol-relative escape: %2F%2Fattacker.example', () => {
        expect(validateRedirectPath('%2F%2Fattacker.example')).toBe('/dashboard');
      });

      it('rejects URL-encoded backslashes: %5C%5Cattacker.example', () => {
        expect(validateRedirectPath('%5C%5Cattacker.example')).toBe('/dashboard');
      });

      it('rejects slash followed by encoded backslash: /%5Cattacker.example', () => {
        expect(validateRedirectPath('/%5Cattacker.example')).toBe('/dashboard');
      });

      it('rejects double-encoded protocol-relative bypass: %252F%252Fattacker.example', () => {
        expect(validateRedirectPath('%252F%252Fattacker.example')).toBe('/dashboard');
      });

      it('rejects encoded control characters: /dashboard%00attacker', () => {
        expect(validateRedirectPath('/dashboard%00attacker')).toBe('/dashboard');
      });

      it('rejects malformed percent encodings: /path%E0%A4%A', () => {
        expect(validateRedirectPath('/path%E0%A4%A')).toBe('/dashboard');
      });
    });
  });

  describe('2. Authoritative Canonical Origin Configuration (getCanonicalAppOrigin)', () => {
    it('uses APP_URL as the sole authoritative setting and returns normalized origin', () => {
      process.env.APP_URL = 'http://localhost:3000';
      delete process.env.NEXT_PUBLIC_SITE_URL;
      expect(getCanonicalAppOrigin()).toBe('http://localhost:3000');

      process.env.APP_URL = 'https://chronicle.example.com';
      expect(getCanonicalAppOrigin()).toBe('https://chronicle.example.com');

      process.env.APP_URL = 'https://chronicle.example.com/';
      expect(getCanonicalAppOrigin()).toBe('https://chronicle.example.com');
    });

    it('does NOT use NEXT_PUBLIC_SITE_URL for security decisions', () => {
      delete process.env.APP_URL;
      process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
      expect(getCanonicalAppOrigin()).toBeNull();
    });

    it('rejects missing or empty APP_URL', () => {
      delete process.env.APP_URL;
      expect(getCanonicalAppOrigin()).toBeNull();

      process.env.APP_URL = '';
      expect(getCanonicalAppOrigin()).toBeNull();

      process.env.APP_URL = '   ';
      expect(getCanonicalAppOrigin()).toBeNull();
    });

    it('rejects malformed APP_URL configuration', () => {
      process.env.APP_URL = 'not-a-valid-url';
      expect(getCanonicalAppOrigin()).toBeNull();

      process.env.APP_URL = 'ftp://chronicle.example.com';
      expect(getCanonicalAppOrigin()).toBeNull();

      process.env.APP_URL = 'javascript:alert(1)';
      expect(getCanonicalAppOrigin()).toBeNull();
    });

    it('rejects canonical URLs containing credentials (username or password)', () => {
      process.env.APP_URL = 'http://admin:secret@localhost:3000';
      expect(getCanonicalAppOrigin()).toBeNull();

      process.env.APP_URL = 'https://user:password@chronicle.example.com';
      expect(getCanonicalAppOrigin()).toBeNull();

      process.env.APP_URL = 'https://user@chronicle.example.com';
      expect(getCanonicalAppOrigin()).toBeNull();
    });

    it('rejects canonical URLs containing non-root paths', () => {
      process.env.APP_URL = 'http://localhost:3000/some/path';
      expect(getCanonicalAppOrigin()).toBeNull();

      process.env.APP_URL = 'https://chronicle.example.com/api';
      expect(getCanonicalAppOrigin()).toBeNull();
    });

    it('rejects canonical URLs containing query strings', () => {
      process.env.APP_URL = 'http://localhost:3000?query=param';
      expect(getCanonicalAppOrigin()).toBeNull();

      process.env.APP_URL = 'https://chronicle.example.com/?ref=1';
      expect(getCanonicalAppOrigin()).toBeNull();
    });

    it('rejects canonical URLs containing fragments', () => {
      process.env.APP_URL = 'http://localhost:3000#section';
      expect(getCanonicalAppOrigin()).toBeNull();

      process.env.APP_URL = 'https://chronicle.example.com/#overview';
      expect(getCanonicalAppOrigin()).toBeNull();
    });
  });

  describe('3. Secure Callback Origin Handling & Redirection (/auth/callback)', () => {
    it('fails closed with HTTP 500 when APP_URL is missing', async () => {
      delete process.env.APP_URL;

      const request = new NextRequest(
        'http://localhost:3000/auth/callback?code=valid-code-123&next=/dashboard'
      );
      const response = await callbackRoute.GET(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('CONFIGURATION_ERROR');
    });

    it('fails closed with HTTP 500 when APP_URL is malformed or invalid', async () => {
      process.env.APP_URL = 'malformed-origin-without-scheme';

      const request = new NextRequest(
        'http://localhost:3000/auth/callback?code=valid-code-123&next=/dashboard'
      );
      const response = await callbackRoute.GET(request);

      expect(response.status).toBe(500);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('CONFIGURATION_ERROR');
    });

    it('fails closed with HTTP 400 when incoming request origin mismatches canonical origin', async () => {
      // Request arrives targeting an attacker domain
      const request = new NextRequest(
        'http://attacker.example/auth/callback?code=valid-code-123&next=/dashboard'
      );
      const response = await callbackRoute.GET(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('ORIGIN_MISMATCH');
    });

    it('fails closed with HTTP 400 when incoming Host header mismatches canonical origin', async () => {
      const request = new NextRequest(
        'http://localhost:3000/auth/callback?code=valid-code-123&next=/dashboard',
        {
          headers: {
            host: 'attacker.example',
          },
        }
      );
      const response = await callbackRoute.GET(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('ORIGIN_MISMATCH');
    });

    it('fails closed with HTTP 400 when malicious X-Forwarded-Host header is provided', async () => {
      const request = new NextRequest(
        'http://localhost:3000/auth/callback?code=valid-code-123&next=/dashboard',
        {
          headers: {
            host: 'localhost:3000',
            'x-forwarded-host': 'attacker.example',
          },
        }
      );
      const response = await callbackRoute.GET(request);

      expect(response.status).toBe(400);
      const json = await response.json();
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('ORIGIN_MISMATCH');
    });

    it('redirects to safe destination /projects/example?tab=claims upon successful code exchange', async () => {
      const request = new NextRequest(
        `${canonicalOrigin}/auth/callback?code=valid-code-123&next=${encodeURIComponent('/projects/example?tab=claims')}`,
        {
          headers: { host: 'localhost:3000' },
        }
      );

      const response = await callbackRoute.GET(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/projects/example?tab=claims'
      );
    });

    it('redirects to fallback /dashboard when next is a same-origin absolute URL', async () => {
      const request = new NextRequest(
        `${canonicalOrigin}/auth/callback?code=valid-code-123&next=${encodeURIComponent('http://localhost:3000/projects/example')}`,
        {
          headers: { host: 'localhost:3000' },
        }
      );

      const response = await callbackRoute.GET(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
    });

    it('redirects to fallback /dashboard when next=https://attacker.example', async () => {
      const request = new NextRequest(
        `${canonicalOrigin}/auth/callback?code=valid-code-123&next=https://attacker.example`,
        {
          headers: { host: 'localhost:3000' },
        }
      );

      const response = await callbackRoute.GET(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
    });

    it('redirects to fallback /dashboard when next=//attacker.example', async () => {
      const request = new NextRequest(
        `${canonicalOrigin}/auth/callback?code=valid-code-123&next=${encodeURIComponent('//attacker.example')}`,
        {
          headers: { host: 'localhost:3000' },
        }
      );

      const response = await callbackRoute.GET(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
    });

    it('redirects to fallback /dashboard when next=///attacker.example', async () => {
      const request = new NextRequest(
        `${canonicalOrigin}/auth/callback?code=valid-code-123&next=${encodeURIComponent('///attacker.example')}`,
        {
          headers: { host: 'localhost:3000' },
        }
      );

      const response = await callbackRoute.GET(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
    });

    it('redirects to fallback /dashboard when next=\\\\attacker.example', async () => {
      const request = new NextRequest(
        `${canonicalOrigin}/auth/callback?code=valid-code-123&next=${encodeURIComponent('\\\\attacker.example')}`,
        {
          headers: { host: 'localhost:3000' },
        }
      );

      const response = await callbackRoute.GET(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
    });

    it('redirects to fallback /dashboard when next=/\\\\attacker.example', async () => {
      const request = new NextRequest(
        `${canonicalOrigin}/auth/callback?code=valid-code-123&next=${encodeURIComponent('/\\\\attacker.example')}`,
        {
          headers: { host: 'localhost:3000' },
        }
      );

      const response = await callbackRoute.GET(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
    });

    it('redirects to fallback /dashboard when next contains control characters', async () => {
      const request = new NextRequest(
        `${canonicalOrigin}/auth/callback?code=valid-code-123&next=${encodeURIComponent('/dashboard\r\nSet-Cookie:admin=1')}`,
        {
          headers: { host: 'localhost:3000' },
        }
      );

      const response = await callbackRoute.GET(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard');
    });

    it('redirects to login error page anchored to canonicalOrigin if code exchange fails', async () => {
      mockExchangeCodeForSession.mockResolvedValueOnce({
        error: { message: 'Invalid or expired auth code' },
      });

      const request = new NextRequest(
        `${canonicalOrigin}/auth/callback?code=bad-code&next=/dashboard`,
        {
          headers: { host: 'localhost:3000' },
        }
      );

      const response = await callbackRoute.GET(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?error=email_verification_failed'
      );
    });

    it('redirects to login error page anchored to canonicalOrigin if code is missing entirely', async () => {
      const request = new NextRequest(`${canonicalOrigin}/auth/callback?next=/dashboard`, {
        headers: { host: 'localhost:3000' },
      });

      const response = await callbackRoute.GET(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe(
        'http://localhost:3000/login?error=email_verification_failed'
      );
    });
  });

  describe('4. Login Navigation-Target Resolution (resolveLoginRedirect)', () => {
    it('resolves valid relative paths correctly', () => {
      expect(resolveLoginRedirect('/dashboard')).toBe('/dashboard');
      expect(resolveLoginRedirect('/projects/example')).toBe('/projects/example');
      expect(resolveLoginRedirect('/projects/example?tab=claims')).toBe(
        '/projects/example?tab=claims'
      );
      expect(resolveLoginRedirect('/projects/p1/graph#node-10')).toBe(
        '/projects/p1/graph#node-10'
      );
    });

    it('rejects same-origin absolute URLs and falls back to /dashboard', () => {
      expect(resolveLoginRedirect('http://localhost:3000/dashboard')).toBe('/dashboard');
      expect(resolveLoginRedirect('http://localhost:3000/projects/example')).toBe(
        '/dashboard'
      );
    });

    it('rejects synthetic chronicle.local origin absolute URLs', () => {
      expect(resolveLoginRedirect('http://chronicle.local/dashboard')).toBe('/dashboard');
    });

    it('rejects relative paths without a leading slash and falls back to /dashboard', () => {
      expect(resolveLoginRedirect('dashboard')).toBe('/dashboard');
      expect(resolveLoginRedirect('projects/example')).toBe('/dashboard');
    });

    it('forces attacker payloads to /dashboard', () => {
      const maliciousCases = [
        'https://attacker.example',
        'http://attacker.example/path',
        '//attacker.example',
        '///attacker.example',
        '\\\\attacker.example',
        '/\\\\attacker.example',
        '/\\attacker.example',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '/dashboard\r\nSet-Cookie:bad=1',
        '/dashboard\0attacker',
        '%2F%2Fattacker.example',
        '%5C%5Cattacker.example',
        '/%5Cattacker.example',
      ];

      for (const input of maliciousCases) {
        expect(resolveLoginRedirect(input)).toBe('/dashboard');
      }
    });

    it('handles empty or missing parameters by returning /dashboard', () => {
      expect(resolveLoginRedirect(null)).toBe('/dashboard');
      expect(resolveLoginRedirect(undefined)).toBe('/dashboard');
      expect(resolveLoginRedirect('')).toBe('/dashboard');
      expect(resolveLoginRedirect('   ')).toBe('/dashboard');
    });
  });
});
