import {
  AuthenticatedSession,
  Claim,
  ClaimVerificationStatus,
  Conflict,
  ExtractionOrigin,
  ReconstructionMode,
  SanitizedSource,
} from '../types';
import { IChronicleRepository } from '../infrastructure/database/repository-interface';
import {
  assertPreLlmClearanceIsolation,
  filterClaimsByClearance,
  filterConflictsByClearance,
  filterSourcesForClearance,
} from '../security/clearance-policy';
import { extractDeterministicCandidates } from '../domain/engines/deterministic-extractor';
import { verifyClaimCitations } from '../domain/engines/citation-grounder';
import { detectConflicts } from '../domain/engines/conflict-detector';
import { AIAdapter, createAiAdapter } from '../infrastructure/ai';
import { AuthorizationService } from './authorization-service';

export interface ReconstructionRunResult {
  mode: ReconstructionMode;
  fallbackReason?: string;
  claimsCount: number;
  verifiedCount: number;
  conflictsCount: number;
  claims: Claim[];
  conflicts: Conflict[];
}

export class ReconstructionService {
  private readonly authService: AuthorizationService;

  constructor(
    private readonly repository: IChronicleRepository,
    private readonly customAiAdapter?: AIAdapter
  ) {
    this.authService = new AuthorizationService(repository);
  }

  public async runReconstruction(
    session: AuthenticatedSession,
    projectId: string,
    options: {
      useAiEnrichment?: boolean;
      provider?: 'gemini' | 'openai';
      forceSimulateAiFailure?: boolean;
    } = {}
  ): Promise<ReconstructionRunResult> {
    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'reconstruct:run',
    });

    const project = await this.repository.getProjectById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const allSources = await this.repository.listSources(projectId);
    const visibleSources = filterSourcesForClearance(
      allSources,
      session.effectiveClearanceTier
    );

    // Mandatory Pre-LLM Clearance Isolation check (Section 6.4)
    assertPreLlmClearanceIsolation(
      visibleSources,
      session.effectiveClearanceTier
    );

    const sourcesById = new Map(allSources.map((s) => [s.id, s]));
    const existingClaims = await this.repository.listClaims(projectId);
    const existingById = new Map(existingClaims.map((c) => [c.id, c]));

    // Preserve HUMAN_APPROVED, SUPERSEDED, REJECTED, and HUMAN_AUTHORED claims (Section 5.2)
    const preservedClaims = new Map<string, Claim>();
    for (const c of existingClaims) {
      if (
        c.verificationStatus === ClaimVerificationStatus.HUMAN_APPROVED ||
        c.verificationStatus === ClaimVerificationStatus.SUPERSEDED ||
        c.verificationStatus === ClaimVerificationStatus.REJECTED ||
        c.extractionOrigin === ExtractionOrigin.HUMAN_AUTHORED
      ) {
        preservedClaims.set(c.id, c);
      }
    }

    let mode: ReconstructionMode = ReconstructionMode.DETERMINISTIC;
    let fallbackReason: string | undefined;
    const candidateClaims: Claim[] = [];

    if (options.useAiEnrichment) {
      try {
        if (options.forceSimulateAiFailure) {
          throw new Error('Simulated AI provider timeout / failure for fallback verification');
        }

        const sanitizedInputs: SanitizedSource[] = visibleSources.map((s) => ({
          id: s.id,
          sourceType: s.sourceType,
          externalRef: s.externalRef,
          title: s.title,
          authorHandle: s.authorHandle,
          createdAt: s.createdAt,
          accessTier: s.accessTier,
          sanitizedContent: s.sanitizedContent,
          modulePaths: s.modulePaths,
        }));

        const adapter =
          this.customAiAdapter ?? createAiAdapter(options.provider);
        const aiOutput = await adapter.reconstruct(
          sanitizedInputs,
          session.effectiveClearanceTier
        );

        aiOutput.claims.forEach((aiClaim, idx) => {
          const refSource = sourcesById.get(aiClaim.sourceId);
          if (!refSource) {
            return;
          }
          // Ensure source clearance does not exceed session effective tier
          if (refSource.accessTier > session.effectiveClearanceTier) {
            return;
          }

          const claimId = `claim-ai-${refSource.id}-${idx + 1}`;
          const quoteIdx = refSource.sanitizedContent.indexOf(
            aiClaim.verbatimQuote
          );
          const charStart = quoteIdx >= 0 ? quoteIdx : 0;
          const charEnd =
            quoteIdx >= 0
              ? quoteIdx + aiClaim.verbatimQuote.length
              : Math.min(aiClaim.verbatimQuote.length, refSource.sanitizedContent.length);

          const rawClaim: Claim = {
            id: claimId,
            organizationId: session.organizationId,
            projectId,
            category: aiClaim.category,
            topicKey: aiClaim.topicKey,
            stanceValue: aiClaim.stanceValue,
            title: aiClaim.title,
            summary: aiClaim.summary,
            verificationStatus: ClaimVerificationStatus.EXTRACTED,
            extractionOrigin: ExtractionOrigin.AI_ENRICHED,
            confidenceScore: aiClaim.confidenceScore,
            accessTier: refSource.accessTier,
            ownerHandle: aiClaim.ownerHandle || refSource.authorHandle,
            modulePaths:
              aiClaim.modulePaths.length > 0
                ? aiClaim.modulePaths
                : refSource.modulePaths,
            citations: [
              {
                id: `cit-${claimId}-1`,
                projectId,
                claimId,
                sourceId: refSource.id,
                sourceTitle: refSource.title,
                sourceExternalRef: refSource.externalRef,
                verbatimQuote: aiClaim.verbatimQuote,
                charStart,
                charEnd,
                verificationStatus: 'VERIFIED',
                accessTier: refSource.accessTier,
              },
            ],
            stateHistory: [
              {
                from: ClaimVerificationStatus.EXTRACTED,
                to: ClaimVerificationStatus.EXTRACTED,
                actorId: `ai-adapter-${adapter.providerName}`,
                actorType: 'AUTOMATED',
                reason: `Extracted via AI-enriched reconstruction (${adapter.providerName}).`,
                timestamp: new Date().toISOString(),
              },
            ],
            createdAt: refSource.createdAt,
            updatedAt: new Date().toISOString(),
          };

          candidateClaims.push(verifyClaimCitations(rawClaim, sourcesById));
        });

        mode = ReconstructionMode.AI_ENRICHED;
      } catch (err) {
        // Section 11.4 Failure Handling:
        // 1. Log a structured warning without sensitive content.
        // 2. Record the failure mode.
        // 3. Run deterministic reconstruction.
        // 4. Return a valid result.
        // 5. Mark the reconstruction mode as AI_FALLBACK.
        fallbackReason =
          err instanceof Error ? err.message : 'AI provider error';
        console.warn(
          JSON.stringify({
            level: 'WARN',
            event: 'AI_RECONSTRUCTION_FALLBACK',
            projectId,
            reason: fallbackReason,
            timestamp: new Date().toISOString(),
          })
        );
        mode = ReconstructionMode.AI_FALLBACK;
      }
    }

    // Always run DeterministicExtractor for all sources (either primary or fallback or baseline)
    for (const src of allSources) {
      const facts = extractDeterministicCandidates({
        sourceId: src.id,
        sanitizedContent: src.sanitizedContent,
      });

      facts.forEach((cand, idx) => {
        const claimId = `claim-${src.id}-${idx + 1}`;
        // Never overwrite a preserved human-approved or resolved claim!
        if (preservedClaims.has(claimId)) {
          return;
        }
        const existing = existingById.get(claimId);
        if (
          existing &&
          (existing.verificationStatus ===
            ClaimVerificationStatus.HUMAN_APPROVED ||
            existing.verificationStatus ===
              ClaimVerificationStatus.SUPERSEDED ||
            existing.verificationStatus === ClaimVerificationStatus.REJECTED)
        ) {
          preservedClaims.set(claimId, existing);
          return;
        }

        const rawClaim: Claim = {
          id: claimId,
          organizationId: session.organizationId,
          projectId,
          category: cand.category,
          topicKey: cand.topicKey,
          stanceValue: cand.stanceValue || 'ASSERTED',
          title: cand.title,
          summary: cand.summary,
          verificationStatus: ClaimVerificationStatus.EXTRACTED,
          extractionOrigin: ExtractionOrigin.DETERMINISTIC,
          confidenceScore: cand.confidenceScore,
          accessTier: src.accessTier,
          ownerHandle: src.authorHandle,
          modulePaths: src.modulePaths,
          citations: [
            {
              id: `cit-${claimId}-1`,
              projectId,
              claimId,
              sourceId: src.id,
              sourceTitle: src.title,
              sourceExternalRef: src.externalRef,
              verbatimQuote: src.sanitizedContent.slice(
                cand.charStart,
                cand.charEnd
              ),
              charStart: cand.charStart,
              charEnd: cand.charEnd,
              verificationStatus: 'VERIFIED',
              accessTier: src.accessTier,
            },
          ],
          stateHistory: existing?.stateHistory ?? [
            {
              from: ClaimVerificationStatus.EXTRACTED,
              to: ClaimVerificationStatus.EXTRACTED,
              actorId: 'system-deterministic-extractor',
              actorType: 'AUTOMATED',
              reason: `Extracted deterministically from ${src.externalRef}.`,
              timestamp: src.createdAt,
            },
          ],
          createdAt: src.createdAt,
          updatedAt: new Date().toISOString(),
        };

        candidateClaims.push(verifyClaimCitations(rawClaim, sourcesById));
      });
    }

    const combinedMap = new Map<string, Claim>();
    for (const c of candidateClaims) {
      combinedMap.set(c.id, c);
    }
    for (const [id, preserved] of preservedClaims.entries()) {
      combinedMap.set(id, preserved);
    }

    const existingConflicts = await this.repository.listConflicts(projectId);
    const conflictDetection = detectConflicts({
      organizationId: session.organizationId,
      projectId,
      claims: Array.from(combinedMap.values()),
      existingConflicts,
    });

    await this.repository.upsertClaims(
      projectId,
      conflictDetection.updatedClaims
    );
    if (conflictDetection.newConflicts.length > 0) {
      await this.repository.upsertConflicts(
        projectId,
        conflictDetection.newConflicts
      );
    }

    const now = new Date().toISOString();
    await this.repository.updateProject({
      ...project,
      lastReconstructionMode: mode,
      lastReconstructedAt: now,
      updatedAt: now,
    });

    await this.repository.appendAuditLog({
      id: `audit-reconstruct-${Date.now()}`,
      organizationId: session.organizationId,
      projectId,
      actorUserId: session.userId,
      actorDisplayName: session.displayName,
      actorRole: session.role,
      effectiveClearanceTier: session.effectiveClearanceTier,
      action: 'RECONSTRUCTION_EXECUTED',
      targetEntityType: 'PROJECT',
      targetEntityId: projectId,
      accessTier: session.effectiveClearanceTier,
      metadata: {
        mode,
        fallbackReason: fallbackReason ?? null,
        claimsCount: conflictDetection.updatedClaims.length,
        newConflictsDetected: conflictDetection.newConflicts.length,
      },
      createdAt: now,
    });

    const allStoredConflicts = await this.repository.listConflicts(projectId);
    const visibleClaims = filterClaimsByClearance(
      conflictDetection.updatedClaims,
      session.effectiveClearanceTier
    );
    const visibleClaimIds = new Set(visibleClaims.map((c) => c.id));
    const visibleConflicts = filterConflictsByClearance(
      allStoredConflicts,
      visibleClaimIds,
      session.effectiveClearanceTier
    );

    return {
      mode,
      fallbackReason,
      claimsCount: visibleClaims.length,
      verifiedCount: visibleClaims.filter(
        (c) =>
          c.verificationStatus === ClaimVerificationStatus.VERIFIED ||
          c.verificationStatus === ClaimVerificationStatus.HUMAN_APPROVED
      ).length,
      conflictsCount: visibleConflicts.length,
      claims: visibleClaims,
      conflicts: visibleConflicts,
    };
  }

  public async verifyAllProjectCitations(
    session: AuthenticatedSession,
    projectId: string
  ): Promise<{
    verifiedClaimsCount: number;
    missingEvidenceCount: number;
    claims: Claim[];
  }> {
    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'verify:run',
    });

    const [sources, claims] = await Promise.all([
      this.repository.listSources(projectId),
      this.repository.listClaims(projectId),
    ]);

    const sourcesById = new Map(sources.map((s) => [s.id, s]));
    const updatedClaims = claims.map((claim) =>
      verifyClaimCitations(claim, sourcesById, session.userId)
    );

    await this.repository.upsertClaims(projectId, updatedClaims);

    await this.repository.appendAuditLog({
      id: `audit-verify-${Date.now()}`,
      organizationId: session.organizationId,
      projectId,
      actorUserId: session.userId,
      actorDisplayName: session.displayName,
      actorRole: session.role,
      effectiveClearanceTier: session.effectiveClearanceTier,
      action: 'CITATIONS_VERIFIED',
      targetEntityType: 'PROJECT',
      targetEntityId: projectId,
      accessTier: session.effectiveClearanceTier,
      metadata: {
        totalChecked: updatedClaims.length,
      },
      createdAt: new Date().toISOString(),
    });

    const visibleClaims = filterClaimsByClearance(
      updatedClaims,
      session.effectiveClearanceTier
    );

    return {
      verifiedClaimsCount: visibleClaims.filter(
        (c) =>
          c.verificationStatus === ClaimVerificationStatus.VERIFIED ||
          c.verificationStatus === ClaimVerificationStatus.HUMAN_APPROVED
      ).length,
      missingEvidenceCount: visibleClaims.filter(
        (c) => c.verificationStatus === ClaimVerificationStatus.MISSING_EVIDENCE
      ).length,
      claims: visibleClaims,
    };
  }
}
