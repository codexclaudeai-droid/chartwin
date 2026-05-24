import type { NextRequest } from 'next/server';
import {
  assertAdminActor,
  assertSuperAdminActor,
  type Actor,
} from '../../domain/chart-service/index.ts';
import { getActorFromSession, parseSessionCookieClaims } from './auth.ts';
import type { ChartServiceRepository } from './repository.ts';

export function getActorFromRequest(
  repository: ChartServiceRepository,
  request: Pick<NextRequest, 'headers'>,
  nowIso: string,
): Actor {
  const claims = parseSessionCookieClaims(request.headers.get('cookie'));
  if (!claims) throw new Error('Session required');
  return getActorFromSession(repository, claims, nowIso);
}

export function requireAdminFromRequest(
  repository: ChartServiceRepository,
  request: Pick<NextRequest, 'headers'>,
  nowIso: string,
): Actor {
  const actor = getActorFromRequest(repository, request, nowIso);
  assertAdminActor(actor);
  return actor;
}

export function requireSuperAdminFromRequest(
  repository: ChartServiceRepository,
  request: Pick<NextRequest, 'headers'>,
  nowIso: string,
): Actor {
  const actor = getActorFromRequest(repository, request, nowIso);
  assertSuperAdminActor(actor);
  return actor;
}
