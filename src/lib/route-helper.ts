import { ZodError } from 'zod';
import { AuthenticatedSession, ClearanceTier } from '../types';
import { getRepository } from '../infrastructure/database';
import { resolveAuthenticatedSession } from '../security/session-auth';
import { AuthorizationError } from '../services/authorization-service';
import {
  buildErrorEnvelope,
  buildSuccessEnvelope,
} from './api-response';

export interface RouteContext {
  params: Record<string, string>;
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests = 120, windowMs = 60_000): boolean {
  const now = Date.now();
  const current = rateLimitStore.get(key);
  if (!current || now > current.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  if (current.count > maxRequests) {
    return false;
  }
  return true;
}

export async function getRequestSession(
  req: Request,
  targetProjectId?: string
): Promise<AuthenticatedSession> {
  const repository = getRepository();
  const cookieHeader = req.headers.get('cookie') ?? undefined;
  const authorizationHeader = req.headers.get('authorization') ?? undefined;

  return resolveAuthenticatedSession({
    repository,
    cookieHeader,
    authorizationHeader,
    targetProjectId,
  });
}

export function jsonSuccess<T>(
  data: T,
  meta: {
    projectId: string;
    effectiveTier: ClearanceTier;
  },
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  const repository = getRepository();
  const body = buildSuccessEnvelope(data, {
    projectId: meta.projectId,
    effectiveTier: meta.effectiveTier,
    persistenceMode: repository.mode,
  });

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

export function handleRouteError(err: unknown): Response {
  if (err instanceof AuthorizationError) {
    return new Response(
      JSON.stringify(buildErrorEnvelope(err.code, err.message)),
      {
        status: err.statusCode,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (err instanceof ZodError) {
    const message = err.issues
      .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
      .join('; ');
    return new Response(
      JSON.stringify(buildErrorEnvelope('VALIDATION_ERROR', message)),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (err instanceof Error) {
    if (err.message.includes('PERSISTENCE_UNAVAILABLE')) {
      return new Response(
        JSON.stringify(
          buildErrorEnvelope('PERSISTENCE_UNAVAILABLE', err.message)
        ),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (
      err.message.includes('Shadow role preview') ||
      err.message.includes('Shadow preview') ||
      err.message.includes('does not belong to') ||
      err.message.includes('does not have membership')
    ) {
      return new Response(
        JSON.stringify(buildErrorEnvelope('FORBIDDEN', 'Insufficient permissions')),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (err.message.includes('Pre-LLM Clearance Isolation')) {
      return new Response(
        JSON.stringify(
          buildErrorEnvelope('CLEARANCE_VIOLATION', err.message)
        ),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (err.message.includes('Invalid claim state transition') || err.message.includes('already resolved')) {
      return new Response(
        JSON.stringify(
          buildErrorEnvelope('CONFLICT_STATE_ERROR', err.message)
        ),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (err.message.includes('not found') || err.message.includes('does not exist')) {
      return new Response(
        JSON.stringify(buildErrorEnvelope('NOT_FOUND', 'Resource not found')),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify(buildErrorEnvelope('INTERNAL_ERROR', err.message)),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify(
      buildErrorEnvelope('INTERNAL_ERROR', 'Unexpected server error')
    ),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
