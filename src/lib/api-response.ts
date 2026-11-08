import { ClearanceTier, PersistenceMode } from '../types';

export interface ApiSuccessEnvelope<T> {
  ok: true;
  meta: {
    projectId: string;
    effectiveTier: ClearanceTier;
    persistenceMode: PersistenceMode;
    timestamp: string;
  };
  data: T;
}

export interface ApiErrorEnvelope {
  ok: false;
  error: {
    code:
      | 'UNAUTHORIZED'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'VALIDATION_ERROR'
      | 'CONFLICT_STATE_ERROR'
      | 'CLEARANCE_VIOLATION'
      | 'PERSISTENCE_UNAVAILABLE'
      | 'RATE_LIMITED'
      | 'INTERNAL_ERROR';
    message: string;
  };
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export function buildSuccessEnvelope<T>(
  data: T,
  meta: {
    projectId: string;
    effectiveTier: ClearanceTier;
    persistenceMode: PersistenceMode;
  }
): ApiSuccessEnvelope<T> {
  return {
    ok: true,
    meta: {
      projectId: meta.projectId,
      effectiveTier: meta.effectiveTier,
      persistenceMode: meta.persistenceMode,
      timestamp: new Date().toISOString(),
    },
    data,
  };
}

export function buildErrorEnvelope(
  code: ApiErrorEnvelope['error']['code'],
  message: string
): ApiErrorEnvelope {
  return {
    ok: false,
    error: {
      code,
      message,
    },
  };
}
