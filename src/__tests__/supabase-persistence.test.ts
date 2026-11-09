import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getRepository, resetRepositorySingleton, SupabasePostgresRepository } from '../infrastructure/database';

describe('Supabase PostgreSQL Persistence & Fail-Closed Behavior', () => {
  const originalEnv = process.env.CHRONICLE_PERSISTENCE_MODE;
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    resetRepositorySingleton();
  });

  afterEach(() => {
    process.env.CHRONICLE_PERSISTENCE_MODE = originalEnv;
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    resetRepositorySingleton();
  });

  it('fails closed when CHRONICLE_PERSISTENCE_MODE=supabase and credentials are missing', () => {
    process.env.CHRONICLE_PERSISTENCE_MODE = 'supabase';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => getRepository()).toThrowError(
      /PERSISTENCE_UNAVAILABLE: SupabasePostgresRepository requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/
    );
  });

  it('instantiates DeterministicSeedRepository when CHRONICLE_PERSISTENCE_MODE=seed', () => {
    process.env.CHRONICLE_PERSISTENCE_MODE = 'seed';
    const repo = getRepository();
    expect(repo.mode).toBe('seed');
  });

  it('SupabasePostgresRepository constructor fails closed when invoked directly without credentials', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => new SupabasePostgresRepository('', '')).toThrowError(/PERSISTENCE_UNAVAILABLE/);
  });
});

