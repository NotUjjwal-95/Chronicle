import { describe, it, expect } from 'vitest';
import { redactSecrets } from '../domain/engines/secret-redactor';
import { extractDeterministicCandidates } from '../domain/engines/deterministic-extractor';
import { verifyClaimCitations } from '../domain/engines/citation-grounder';
import { detectConflicts } from '../domain/engines/conflict-detector';
import { canonicalizeJson } from '../lib/canonical-json';
import {
  computeSnapshotSha256,
  verifySnapshotIntegrity,
} from '../domain/engines/snapshot-hasher';
import {
  exportSnapshotToMarkdown,
  exportSnapshotToJson,
} from '../domain/engines/handover-exporter';
import {
  Claim,
  ClaimVerificationStatus,
  ClearanceTier,
  ExtractionOrigin,
  HandoverSnapshot,
  SourceArtifact,
  SourceType,
} from '../types';

describe('Domain Engines', () => {
  describe('SecretRedactor', () => {
    it('redacts postgres connection URIs and records coordinates', () => {
      const raw = 'Connect to postgresql://postgres:SuperSecretPassword123!@db.internal:5432/chronicle for DB';
      const result = redactSecrets(raw);

      expect(result.sanitizedContent).not.toContain('SuperSecretPassword123!');
      expect(result.sanitizedContent).toContain('[REDACTED:CONNECTION_URI]');
      expect(result.redactedCount).toBe(1);
      expect(result.redactionMetadata[0].patternType).toBe('POSTGRES_OR_REDIS_URI');
    });

    it('redacts GitHub PATs and Stripe/OpenAI API keys', () => {
      const raw = 'Using ghp_123456789012345678901234567890 and sk_live_abcdef123456789012 in prod';
      const result = redactSecrets(raw);

      expect(result.sanitizedContent).not.toContain('ghp_');
      expect(result.sanitizedContent).not.toContain('sk_live_');
      expect(result.sanitizedContent).toContain('[REDACTED:GITHUB_PAT]');
      expect(result.sanitizedContent).toContain('[REDACTED:API_SECRET_KEY]');
      expect(result.redactedCount).toBe(2);
    });

    it('redacts sensitive password and secret assignments', () => {
      const raw = 'Config: webhook_secret = "whsec_ABCDEF1234567890" and password="MyPlaintextPassword1"';
      const result = redactSecrets(raw);

      expect(result.sanitizedContent).not.toContain('whsec_');
      expect(result.sanitizedContent).not.toContain('MyPlaintextPassword1');
      expect(result.redactedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DeterministicExtractor', () => {
    it('extracts candidate claims from structured decision markers', () => {
      const content =
        'We decided to adopt asymmetric Ed25519 session token signing across all payment routes. Standardized on Ed25519 for secure verification.';
      const candidates = extractDeterministicCandidates({
        sourceId: 'src-test-01',
        sanitizedContent: content,
      });

      expect(candidates.length).toBeGreaterThan(0);
      const dec = candidates.find((c) => c.topicKey.includes('session-signing'));
      expect(dec).toBeDefined();
    });
  });

  describe('CitationGrounder', () => {
    it('verifies exact character coordinates matching verbatim quotes', () => {
      const text = 'Ledger entries are strictly append-only and cannot be updated.';
      const quote = 'Ledger entries are strictly append-only';
      const start = text.indexOf(quote);
      const end = start + quote.length;

      const mockSource: SourceArtifact = {
        id: 'src-1',
        organizationId: 'org-1',
        projectId: 'proj-1',
        sourceType: SourceType.GITHUB_PR,
        externalRef: 'PR #12',
        title: 'Ledger Engine',
        authorHandle: 'ujjwal',
        createdAt: '2026-11-08T00:00:00.000Z',
        accessTier: ClearanceTier.TIER_2_INTERNAL,
        sanitizedContent: text,
        redactionMetadata: [],
        redactedCount: 0,
        modulePaths: ['src/ledger'],
      };

      const claim: Claim = {
        id: 'claim-1',
        organizationId: 'org-1',
        projectId: 'proj-1',
        category: 'DECISION' as any,
        topicKey: 'DEC-LEDGER',
        stanceValue: 'ASSERTED',
        title: 'Append-only ledger',
        summary: 'Ledger cannot be updated',
        verificationStatus: ClaimVerificationStatus.EXTRACTED,
        extractionOrigin: ExtractionOrigin.DETERMINISTIC,
        confidenceScore: 0.95,
        accessTier: ClearanceTier.TIER_2_INTERNAL,
        ownerHandle: 'ujjwal',
        modulePaths: ['src/ledger'],
        citations: [
          {
            id: 'cit-1',
            projectId: 'proj-1',
            claimId: 'claim-1',
            sourceId: 'src-1',
            verbatimQuote: quote,
            charStart: start,
            charEnd: end,
            verificationStatus: 'VERIFIED',
            accessTier: ClearanceTier.TIER_2_INTERNAL,
          },
        ],
        stateHistory: [],
        createdAt: '2026-11-08T00:00:00.000Z',
        updatedAt: '2026-11-08T00:00:00.000Z',
      };

      const sourcesMap = new Map([['src-1', mockSource]]);
      const grounded = verifyClaimCitations(claim, sourcesMap);

      expect(grounded.verificationStatus).toBe(ClaimVerificationStatus.VERIFIED);
      expect(grounded.citations[0].verificationStatus).toBe('VERIFIED');
    });

    it('marks citation as MISSING_EVIDENCE when offset text does not match verbatim quote', () => {
      const text = 'Different content completely.';
      const quote = 'Ledger entries are strictly append-only';

      const mockSource: SourceArtifact = {
        id: 'src-1',
        organizationId: 'org-1',
        projectId: 'proj-1',
        sourceType: SourceType.GITHUB_PR,
        externalRef: 'PR #12',
        title: 'Ledger Engine',
        authorHandle: 'ujjwal',
        createdAt: '2026-11-08T00:00:00.000Z',
        accessTier: ClearanceTier.TIER_2_INTERNAL,
        sanitizedContent: text,
        redactionMetadata: [],
        redactedCount: 0,
        modulePaths: ['src/ledger'],
      };

      const claim: Claim = {
        id: 'claim-1',
        organizationId: 'org-1',
        projectId: 'proj-1',
        category: 'DECISION' as any,
        topicKey: 'DEC-LEDGER',
        stanceValue: 'ASSERTED',
        title: 'Append-only ledger',
        summary: 'Ledger cannot be updated',
        verificationStatus: ClaimVerificationStatus.EXTRACTED,
        extractionOrigin: ExtractionOrigin.DETERMINISTIC,
        confidenceScore: 0.95,
        accessTier: ClearanceTier.TIER_2_INTERNAL,
        ownerHandle: 'ujjwal',
        modulePaths: ['src/ledger'],
        citations: [
          {
            id: 'cit-1',
            projectId: 'proj-1',
            claimId: 'claim-1',
            sourceId: 'src-1',
            verbatimQuote: quote,
            charStart: 0,
            charEnd: 30,
            verificationStatus: 'VERIFIED',
            accessTier: ClearanceTier.TIER_2_INTERNAL,
          },
        ],
        stateHistory: [],
        createdAt: '2026-11-08T00:00:00.000Z',
        updatedAt: '2026-11-08T00:00:00.000Z',
      };

      const sourcesMap = new Map([['src-1', mockSource]]);
      const grounded = verifyClaimCitations(claim, sourcesMap);

      expect(grounded.verificationStatus).toBe(ClaimVerificationStatus.MISSING_EVIDENCE);
      expect(grounded.citations[0].verificationStatus).toBe('MISSING_EVIDENCE');
    });
  });

  describe('ConflictDetector', () => {
    it('detects contradiction when two claims on the same topic have conflicting stances', () => {
      const claimA: Claim = {
        id: 'claim-a',
        organizationId: 'org-1',
        projectId: 'proj-1',
        category: 'DECISION' as any,
        topicKey: 'DEC-002-IDEMPOTENCY',
        stanceValue: 'REDIS_CACHE_ONLY',
        title: 'Store idempotency in Redis only',
        summary: 'Redis is fast and sufficient',
        verificationStatus: ClaimVerificationStatus.VERIFIED,
        extractionOrigin: ExtractionOrigin.DETERMINISTIC,
        confidenceScore: 0.9,
        accessTier: ClearanceTier.TIER_2_INTERNAL,
        ownerHandle: 'ujjwal',
        modulePaths: [],
        citations: [],
        stateHistory: [],
        createdAt: '2026-11-08T00:00:00.000Z',
        updatedAt: '2026-11-08T00:00:00.000Z',
      };

      const claimB: Claim = {
        id: 'claim-b',
        organizationId: 'org-1',
        projectId: 'proj-1',
        category: 'DECISION' as any,
        topicKey: 'DEC-002-IDEMPOTENCY',
        stanceValue: 'POSTGRES_COMPOSITE_INDEX',
        title: 'Store idempotency in PostgreSQL table',
        summary: 'Redis evictions lead to double charges',
        verificationStatus: ClaimVerificationStatus.VERIFIED,
        extractionOrigin: ExtractionOrigin.DETERMINISTIC,
        confidenceScore: 0.95,
        accessTier: ClearanceTier.TIER_2_INTERNAL,
        ownerHandle: 'elena',
        modulePaths: [],
        citations: [],
        stateHistory: [],
        createdAt: '2026-11-08T01:00:00.000Z',
        updatedAt: '2026-11-08T01:00:00.000Z',
      };

      const result = detectConflicts({
        organizationId: 'org-1',
        projectId: 'proj-1',
        claims: [claimA, claimB],
        existingConflicts: [],
      });

      expect(result.newConflicts.length).toBe(1);
      expect(result.newConflicts[0].topicKey).toBe('DEC-002-IDEMPOTENCY');
      expect(result.updatedClaims.every((c) => c.verificationStatus === ClaimVerificationStatus.CONFLICTED)).toBe(true);
    });
  });

  describe('SnapshotHasher', () => {
    it('canonicalizes JSON with lexicographical key ordering deterministically', () => {
      const obj1 = { z: 1, a: 2, m: { y: 3, b: 4 } };
      const obj2 = { a: 2, m: { b: 4, y: 3 }, z: 1 };

      expect(canonicalizeJson(obj1)).toBe(canonicalizeJson(obj2));
      expect(canonicalizeJson(obj1)).toBe('{"a":2,"m":{"b":4,"y":3},"z":1}');
    });

    it('computes and verifies SHA-256 digest accurately', () => {
      const payload: any = {
        schemaVersion: 'chronicle.handover.v1',
        projectId: 'proj-core-payments',
        versionTag: 'v1.0.0',
        activeDecisions: [],
      };

      const digest = computeSnapshotSha256(payload);
      expect(digest).toHaveLength(64);

      const snapshot: HandoverSnapshot = {
        id: 'snap-1',
        organizationId: 'org-1',
        projectId: 'proj-core-payments',
        versionTag: 'v1.0.0',
        accessTier: ClearanceTier.TIER_2_INTERNAL,
        canonicalPayload: payload,
        sha256Digest: digest,
        createdByUserId: 'usr-ujjwal',
        createdByName: 'Ujjwal',
        createdAt: new Date().toISOString(),
        acknowledgements: [],
      };

      const report = verifySnapshotIntegrity(snapshot);
      expect(report.isIntegrityValid).toBe(true);
      expect(report.recomputedDigest).toBe(digest);
    });
  });

  describe('HandoverExporter', () => {
    it('exports Markdown with active decisions, risks, and SHA-256 digest', () => {
      const payload: any = {
        schemaVersion: 'chronicle.handover.v1',
        projectId: 'proj-core-payments',
        organizationId: 'org-1',
        projectName: 'Core Payments Service',
        repositoryUrl: 'https://github.com/chronicle-fin/core-payments-service',
        versionTag: 'v1.0.0',
        effectiveClearanceTier: ClearanceTier.TIER_2_INTERNAL,
        reconstructionMode: 'DETERMINISTIC',
        activeDecisions: [
          {
            id: 'c1',
            title: 'Use PostgreSQL idempotency table',
            category: 'DECISION',
            summary: 'Guarantees 24h duplicate prevention',
            accessTier: ClearanceTier.TIER_2_INTERNAL,
            citations: [],
          },
        ],
        unfinishedWork: [],
        risksAndBlockers: [],
        dependencies: [],
        ownershipContacts: [],
        nextActions: [],
        contributors: [],
        resolvedConflicts: [],
        supersededClaimsHistory: [],
        openKnowledgeGaps: [],
        completedInterviews: [],
        firstSevenDaysPlan: [],
      };

      const snapshot: HandoverSnapshot = {
        id: 'snap-1',
        organizationId: 'org-1',
        projectId: 'proj-core-payments',
        versionTag: 'v1.0.0',
        accessTier: ClearanceTier.TIER_2_INTERNAL,
        canonicalPayload: payload,
        sha256Digest: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        createdByUserId: 'usr-ujjwal',
        createdByName: 'Ujjwal',
        createdAt: '2026-11-08T00:00:00.000Z',
        acknowledgements: [],
      };

      const md = exportSnapshotToMarkdown(snapshot, ClearanceTier.TIER_2_INTERNAL);
      expect(md).toContain('# CHRONICLE HANDOVER PACKAGE: Core Payments Service');
      expect(md).toContain('Core Payments Service');
      expect(md).toContain('Use PostgreSQL idempotency table');
      expect(md).toContain('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('exports structured JSON respecting requesting user clearance', () => {
      const payload: any = {
        schemaVersion: 'chronicle.handover.v1',
        projectId: 'proj-core-payments',
        organizationId: 'org-1',
        projectName: 'Core Payments Service',
        repositoryUrl: 'https://github.com/chronicle-fin/core-payments-service',
        versionTag: 'v1.0.0',
        effectiveClearanceTier: ClearanceTier.TIER_3_CONFIDENTIAL,
        reconstructionMode: 'DETERMINISTIC',
        activeDecisions: [
          {
            id: 'c1',
            title: 'Public Tier 1 decision',
            accessTier: ClearanceTier.TIER_1_EXTERNAL,
            citations: [],
          },
          {
            id: 'c2',
            title: 'Confidential Tier 3 decision',
            accessTier: ClearanceTier.TIER_3_CONFIDENTIAL,
            citations: [],
          },
        ],
        unfinishedWork: [],
        risksAndBlockers: [],
        dependencies: [],
        ownershipContacts: [],
        nextActions: [],
        contributors: [],
        resolvedConflicts: [],
        supersededClaimsHistory: [],
        openKnowledgeGaps: [],
        completedInterviews: [],
        firstSevenDaysPlan: [],
      };

      const snapshot: HandoverSnapshot = {
        id: 'snap-1',
        organizationId: 'org-1',
        projectId: 'proj-core-payments',
        versionTag: 'v1.0.0',
        accessTier: ClearanceTier.TIER_3_CONFIDENTIAL,
        canonicalPayload: payload,
        sha256Digest: 'dummy-sha',
        createdByUserId: 'usr-ujjwal',
        createdByName: 'Ujjwal',
        createdAt: '2026-11-08T00:00:00.000Z',
        acknowledgements: [],
      };

      // Request as Tier 1 External:
      const jsonStr = exportSnapshotToJson(snapshot, ClearanceTier.TIER_1_EXTERNAL);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.canonicalPayload.activeDecisions).toHaveLength(1);
      expect(parsed.canonicalPayload.activeDecisions[0].id).toBe('c1');
    });
  });
});
