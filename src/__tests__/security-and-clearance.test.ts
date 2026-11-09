import { describe, it, expect, beforeEach } from 'vitest';
import { ClearanceTier, ProjectRole } from '../types';
import { getRepository, resetRepositorySingleton } from '../infrastructure/database';
import {
  resolveEffectiveClearanceTier,
  canAccessClearance,
  filterClaimsByClearance,
  filterConflictsByClearance,
  assertPreLlmClearanceIsolation,
} from '../security/clearance-policy';
import { hasRolePermission } from '../security/rbac-policy';
import { AuthorizationService, AuthorizationError } from '../services/authorization-service';
import { resolveAuthenticatedSession } from '../security/session-auth';

describe('Security & Multi-Tenant Clearance Architecture', () => {
  beforeEach(() => {
    resetRepositorySingleton();
    process.env.CHRONICLE_PERSISTENCE_MODE = 'seed';
  });

  describe('Clearance Policy (Section 6.3)', () => {
    it('grants access when resource tier <= user effective tier', () => {
      expect(canAccessClearance(ClearanceTier.TIER_3_CONFIDENTIAL, ClearanceTier.TIER_1_EXTERNAL)).toBe(true);
      expect(canAccessClearance(ClearanceTier.TIER_3_CONFIDENTIAL, ClearanceTier.TIER_2_INTERNAL)).toBe(true);
      expect(canAccessClearance(ClearanceTier.TIER_3_CONFIDENTIAL, ClearanceTier.TIER_3_CONFIDENTIAL)).toBe(true);

      expect(canAccessClearance(ClearanceTier.TIER_1_EXTERNAL, ClearanceTier.TIER_2_INTERNAL)).toBe(false);
      expect(canAccessClearance(ClearanceTier.TIER_1_EXTERNAL, ClearanceTier.TIER_3_CONFIDENTIAL)).toBe(false);
      expect(canAccessClearance(ClearanceTier.TIER_2_INTERNAL, ClearanceTier.TIER_3_CONFIDENTIAL)).toBe(false);
    });

    it('allows Tier 3 Maintainer to enter shadow role preview for lower tiers', () => {
      const result = resolveEffectiveClearanceTier({
        role: ProjectRole.MAINTAINER,
        actualClearanceTier: ClearanceTier.TIER_3_CONFIDENTIAL,
        requestedShadowTier: ClearanceTier.TIER_1_EXTERNAL,
      });

      expect(result.effectiveClearanceTier).toBe(ClearanceTier.TIER_1_EXTERNAL);
      expect(result.isShadowPreview).toBe(true);
    });

    it('prohibits non-maintainers or non-Tier-3 users from entering shadow preview', () => {
      expect(() =>
        resolveEffectiveClearanceTier({
          role: ProjectRole.REVIEWER,
          actualClearanceTier: ClearanceTier.TIER_3_CONFIDENTIAL,
          requestedShadowTier: ClearanceTier.TIER_2_INTERNAL,
        })
      ).toThrowError(/Shadow role preview is restricted to Tier 3 Maintainers/);

      expect(() =>
        resolveEffectiveClearanceTier({
          role: ProjectRole.INCOMING_OWNER,
          actualClearanceTier: ClearanceTier.TIER_2_INTERNAL,
          requestedShadowTier: ClearanceTier.TIER_1_EXTERNAL,
        })
      ).toThrowError(/Shadow role preview is restricted to Tier 3 Maintainers/);
    });

    it('strictly forbids shadow preview from escalating privileges above actual clearance', () => {
      expect(() =>
        resolveEffectiveClearanceTier({
          role: ProjectRole.MAINTAINER,
          actualClearanceTier: ClearanceTier.TIER_2_INTERNAL,
          requestedShadowTier: ClearanceTier.TIER_3_CONFIDENTIAL,
        })
      ).toThrow();
    });

    it('asserts Pre-LLM Clearance Isolation (Section 6.4) and throws on tier leak', () => {
      const allowedSources = [
        { id: 's1', accessTier: ClearanceTier.TIER_1_EXTERNAL },
        { id: 's2', accessTier: ClearanceTier.TIER_2_INTERNAL },
      ];
      // Target Tier 2: allowed
      expect(() =>
        assertPreLlmClearanceIsolation(allowedSources, ClearanceTier.TIER_2_INTERNAL)
      ).not.toThrow();

      // Target Tier 1: s2 exceeds tier 1, must throw!
      expect(() =>
        assertPreLlmClearanceIsolation(allowedSources, ClearanceTier.TIER_1_EXTERNAL)
      ).toThrowError(/Pre-LLM Clearance Isolation Violation/);
    });
  });

  describe('RBAC & Shadow Preview Read-Only Enforcement', () => {
    it('restricts shadow preview to strictly read-only actions', () => {
      // In normal mode, Maintainer has mutating permissions
      expect(hasRolePermission(ProjectRole.MAINTAINER, 'reconstruct:run', false)).toBe(true);
      expect(hasRolePermission(ProjectRole.MAINTAINER, 'snapshot:create', false)).toBe(true);
      expect(hasRolePermission(ProjectRole.MAINTAINER, 'conflict:resolve', false)).toBe(true);

      // In shadow preview, all mutating actions are denied
      expect(hasRolePermission(ProjectRole.MAINTAINER, 'reconstruct:run', true)).toBe(false);
      expect(hasRolePermission(ProjectRole.MAINTAINER, 'snapshot:create', true)).toBe(false);
      expect(hasRolePermission(ProjectRole.MAINTAINER, 'conflict:resolve', true)).toBe(false);

      // But read-only operations remain permitted
      expect(hasRolePermission(ProjectRole.MAINTAINER, 'project:read', true)).toBe(true);
      expect(hasRolePermission(ProjectRole.MAINTAINER, 'claim:read', true)).toBe(true);
      expect(hasRolePermission(ProjectRole.MAINTAINER, 'conflict:read', true)).toBe(true);
      expect(hasRolePermission(ProjectRole.MAINTAINER, 'graph:read', true)).toBe(true);
    });

    it('denies external auditors mutating permissions in all modes', () => {
      expect(hasRolePermission(ProjectRole.EXTERNAL_AUDITOR, 'reconstruct:run')).toBe(false);
      expect(hasRolePermission(ProjectRole.EXTERNAL_AUDITOR, 'conflict:resolve')).toBe(false);
      expect(hasRolePermission(ProjectRole.EXTERNAL_AUDITOR, 'project:read')).toBe(true);
      expect(hasRolePermission(ProjectRole.EXTERNAL_AUDITOR, 'snapshot:export')).toBe(true);
    });
  });

  describe('Multi-Tenant Isolation (Section 6.2)', () => {
    it('blocks access when user does not have membership in the project', async () => {
      const repo = getRepository();
      const authService = new AuthorizationService(repo);

      const fakeSession: any = {
        userId: 'usr-unauthorized-random',
        email: 'attacker@evil.com',
        displayName: 'Attacker',
        organizationId: 'org-chronicle-demo',
        projectId: 'proj-core-payments',
        role: ProjectRole.EXTERNAL_AUDITOR,
        actualClearanceTier: ClearanceTier.TIER_1_EXTERNAL,
        effectiveClearanceTier: ClearanceTier.TIER_1_EXTERNAL,
        isShadowPreview: false,
      };

      await expect(
        authService.authorizeProjectOperation({
          session: fakeSession,
          projectId: 'proj-core-payments',
          requiredPermission: 'project:read',
        })
      ).rejects.toThrowError(AuthorizationError);
    });
  });
});

