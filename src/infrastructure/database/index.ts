import { IChronicleRepository } from './repository-interface';
import { DeterministicSeedRepository } from './memory-seed-repository';
import { SupabasePostgresRepository } from './supabase-repository';

let singletonRepository: IChronicleRepository | null = null;

/**
 * Resolves the active repository implementation.
 * Section 9.5:
 * - If CHRONICLE_PERSISTENCE_MODE === 'supabase', instantiates SupabasePostgresRepository
 *   and fails closed if credentials/connectivity are missing (never silently falls back to memory).
 * - If CHRONICLE_PERSISTENCE_MODE === 'seed' (or default development/test mode), uses DeterministicSeedRepository.
 */
export function getRepository(): IChronicleRepository {
  const requestedMode = process.env.CHRONICLE_PERSISTENCE_MODE || 'seed';

  if (requestedMode === 'supabase') {
    if (!singletonRepository || singletonRepository.mode !== 'supabase') {
      singletonRepository = new SupabasePostgresRepository();
    }
    return singletonRepository;
  }

  if (!singletonRepository || singletonRepository.mode !== 'seed') {
    singletonRepository = new DeterministicSeedRepository();
  }
  return singletonRepository;
}

export function resetRepositorySingleton(): void {
  singletonRepository = null;
}

export * from './repository-interface';
export * from './memory-seed-repository';
export * from './supabase-repository';
