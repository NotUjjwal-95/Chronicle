import {
  AuthenticatedSession,
  Claim,
  ClaimCategory,
  ClaimVerificationStatus,
  ClearanceTier,
  Conflict,
  ConflictResolutionOption,
  ConflictStatus,
  ExitInterview,
  ExtractionOrigin,
  InterviewStatus,
  transitionClaimStatus,
} from '../types';
import { IChronicleRepository } from '../infrastructure/database/repository-interface';
import {
  filterClaimsByClearance,
  filterConflictsByClearance,
  filterInterviewsByClearance,
} from '../security/clearance-policy';
import { redactSecrets } from '../domain/engines/secret-redactor';
import { AuthorizationService } from './authorization-service';

export class ReviewService {
  private readonly authService: AuthorizationService;

  constructor(private readonly repository: IChronicleRepository) {
    this.authService = new AuthorizationService(repository);
  }

  public async listClaims(
    session: AuthenticatedSession,
    projectId: string
  ): Promise<Claim[]> {
    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'claim:read',
    });

    const allClaims = await this.repository.listClaims(projectId);
    return filterClaimsByClearance(allClaims, session.effectiveClearanceTier);
  }

  public async updateClaimReviewStatus(
    session: AuthenticatedSession,
    projectId: string,
    claimId: string,
    input: {
      verificationStatus: ClaimVerificationStatus;
      reason: string;
      category?: ClaimCategory;
    }
  ): Promise<Claim> {
    const existing = await this.repository.getClaimById(projectId, claimId);
    if (!existing) {
      throw new Error('Claim not found');
    }

    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'claim:review',
      requiredClearanceTier: existing.accessTier,
    });

    const transitioned = transitionClaimStatus(
      existing,
      input.verificationStatus,
      session.userId,
      'HUMAN',
      input.reason
    );

    const updated: Claim = {
      ...transitioned,
      category: input.category ?? transitioned.category,
    };

    const saved = await this.repository.updateClaim(projectId, updated);

    await this.repository.appendAuditLog({
      id: `audit-claim-${Date.now()}`,
      organizationId: session.organizationId,
      projectId,
      actorUserId: session.userId,
      actorDisplayName: session.displayName,
      actorRole: session.role,
      effectiveClearanceTier: session.effectiveClearanceTier,
      action: 'CLAIM_STATUS_UPDATED',
      targetEntityType: 'CLAIM',
      targetEntityId: claimId,
      accessTier: existing.accessTier,
      metadata: {
        fromStatus: existing.verificationStatus,
        toStatus: saved.verificationStatus,
        reason: input.reason,
      },
      createdAt: new Date().toISOString(),
    });

    return saved;
  }

  public async listConflicts(
    session: AuthenticatedSession,
    projectId: string
  ): Promise<Conflict[]> {
    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'conflict:read',
    });

    const [allClaims, allConflicts] = await Promise.all([
      this.repository.listClaims(projectId),
      this.repository.listConflicts(projectId),
    ]);

    const visibleClaims = filterClaimsByClearance(
      allClaims,
      session.effectiveClearanceTier
    );
    const visibleClaimIds = new Set(visibleClaims.map((c) => c.id));

    return filterConflictsByClearance(
      allConflicts,
      visibleClaimIds,
      session.effectiveClearanceTier
    );
  }

  /**
   * Section 8: Atomic Conflict Resolution
   * - CLAIM_A: Claim A -> HUMAN_APPROVED, Claim B -> SUPERSEDED
   * - CLAIM_B: Claim B -> HUMAN_APPROVED, Claim A -> SUPERSEDED
   * - SYNTHESIZE: New human-authored claim created (HUMAN_APPROVED) referencing both original claims,
   *   and both Claim A & Claim B -> SUPERSEDED.
   * - If an outdated Notion document needs updating, creates a NEXT_ACTION claim.
   */
  public async resolveConflict(
    session: AuthenticatedSession,
    projectId: string,
    conflictId: string,
    input: {
      resolutionOption: ConflictResolutionOption;
      rationale: string;
      synthesizedTitle?: string;
      synthesizedSummary?: string;
      synthesizedStanceValue?: string;
      createNotionUpdateNextAction?: boolean;
    }
  ): Promise<{
    conflict: Conflict;
    updatedClaims: Claim[];
    newClaims: Claim[];
  }> {
    const conflict = await this.repository.getConflictById(
      projectId,
      conflictId
    );
    if (!conflict) {
      throw new Error('Conflict not found');
    }

    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'conflict:resolve',
      requiredClearanceTier: conflict.accessTier,
    });

    if (conflict.status === ConflictStatus.RESOLVED) {
      throw new Error('Conflict is already resolved');
    }

    const claimA = await this.repository.getClaimById(
      projectId,
      conflict.claimAId
    );
    const claimB = await this.repository.getClaimById(
      projectId,
      conflict.claimBId
    );

    if (!claimA || !claimB) {
      throw new Error('Associated conflict claims not found');
    }

    const now = new Date().toISOString();
    const updatedClaims: Claim[] = [];
    const newClaims: Claim[] = [];

    let winningClaimId: string | null = null;
    let losingClaimId: string | null = null;
    let synthesizedClaimId: string | null = null;
    let followUpNextActionClaimId: string | null = null;

    if (input.resolutionOption === ConflictResolutionOption.CLAIM_A) {
      const winA = transitionClaimStatus(
        claimA,
        ClaimVerificationStatus.HUMAN_APPROVED,
        session.userId,
        'HUMAN',
        `Selected as winning claim in conflict ${conflict.id}: ${input.rationale}`
      );
      const loseB = {
        ...transitionClaimStatus(
          claimB,
          ClaimVerificationStatus.SUPERSEDED,
          session.userId,
          'HUMAN',
          `Superseded by ${claimA.id} in conflict ${conflict.id}: ${input.rationale}`
        ),
        supersededByClaimId: claimA.id,
      };
      updatedClaims.push(winA, loseB);
      winningClaimId = winA.id;
      losingClaimId = loseB.id;
    } else if (input.resolutionOption === ConflictResolutionOption.CLAIM_B) {
      const winB = transitionClaimStatus(
        claimB,
        ClaimVerificationStatus.HUMAN_APPROVED,
        session.userId,
        'HUMAN',
        `Selected as winning claim in conflict ${conflict.id}: ${input.rationale}`
      );
      const loseA = {
        ...transitionClaimStatus(
          claimA,
          ClaimVerificationStatus.SUPERSEDED,
          session.userId,
          'HUMAN',
          `Superseded by ${claimB.id} in conflict ${conflict.id}: ${input.rationale}`
        ),
        supersededByClaimId: claimB.id,
      };
      updatedClaims.push(winB, loseA);
      winningClaimId = winB.id;
      losingClaimId = loseA.id;
    } else if (input.resolutionOption === ConflictResolutionOption.SYNTHESIZE) {
      if (!input.synthesizedTitle || !input.synthesizedSummary) {
        throw new Error(
          'Synthesized conflict resolution requires synthesizedTitle and synthesizedSummary.'
        );
      }

      synthesizedClaimId = `claim-synth-${conflict.topicKey}-${Date.now().toString().slice(-4)}`;
      const combinedCitations = [...claimA.citations, ...claimB.citations].map(
        (cit, idx) => ({
          ...cit,
          id: `cit-${synthesizedClaimId}-${idx + 1}`,
          claimId: synthesizedClaimId!,
        })
      );

      const synthClaim: Claim = {
        id: synthesizedClaimId,
        organizationId: session.organizationId,
        projectId,
        category: claimA.category,
        topicKey: conflict.topicKey,
        stanceValue: input.synthesizedStanceValue || 'SYNTHESIZED_CONSENSUS',
        title: input.synthesizedTitle,
        summary: input.synthesizedSummary,
        verificationStatus: ClaimVerificationStatus.HUMAN_APPROVED,
        extractionOrigin: ExtractionOrigin.HUMAN_AUTHORED,
        confidenceScore: 1.0,
        accessTier: Math.max(claimA.accessTier, claimB.accessTier) as ClearanceTier,
        ownerHandle: session.displayName,
        modulePaths: Array.from(
          new Set([...claimA.modulePaths, ...claimB.modulePaths])
        ),
        synthesizedFromClaimIds: [claimA.id, claimB.id],
        citations: combinedCitations,
        stateHistory: [
          {
            from: ClaimVerificationStatus.EXTRACTED,
            to: ClaimVerificationStatus.HUMAN_APPROVED,
            actorId: session.userId,
            actorType: 'HUMAN',
            reason: `Synthesized from ${claimA.id} and ${claimB.id}: ${input.rationale}`,
            timestamp: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      const loseA: Claim = {
        ...transitionClaimStatus(
          claimA,
          ClaimVerificationStatus.SUPERSEDED,
          session.userId,
          'HUMAN',
          `Superseded by synthesized claim ${synthesizedClaimId}`
        ),
        supersededByClaimId: synthesizedClaimId,
      };

      const loseB: Claim = {
        ...transitionClaimStatus(
          claimB,
          ClaimVerificationStatus.SUPERSEDED,
          session.userId,
          'HUMAN',
          `Superseded by synthesized claim ${synthesizedClaimId}`
        ),
        supersededByClaimId: synthesizedClaimId,
      };

      updatedClaims.push(loseA, loseB);
      newClaims.push(synthClaim);
      winningClaimId = synthesizedClaimId;
    }

    // Section 8: If an outdated Notion document needs updating, create a NEXT_ACTION claim
    const involvesNotionDoc = [...claimA.citations, ...claimB.citations].some(
      (c) => (c.sourceExternalRef || '').toUpperCase().includes('NOTION')
    );

    if (input.createNotionUpdateNextAction || involvesNotionDoc) {
      followUpNextActionClaimId = `claim-next-action-${conflict.topicKey}-${Date.now().toString().slice(-4)}`;
      const referenceCitations = [...claimA.citations, ...claimB.citations].slice(
        0,
        1
      );
      const nextActionClaim: Claim = {
        id: followUpNextActionClaimId,
        organizationId: session.organizationId,
        projectId,
        category: ClaimCategory.NEXT_ACTION,
        topicKey: `${conflict.topicKey}-doc-remediation`,
        stanceValue: 'UPDATE_STALE_DOCUMENTATION',
        title: `Update outdated documentation for ${conflict.topicKey}`,
        summary: `Following resolution of "${conflict.title}", update the superseded Notion runbook/handbook so incoming engineers do not follow stale ${conflict.topicKey} guidance.`,
        verificationStatus: ClaimVerificationStatus.HUMAN_APPROVED,
        extractionOrigin: ExtractionOrigin.HUMAN_AUTHORED,
        confidenceScore: 1.0,
        accessTier: conflict.accessTier,
        ownerHandle: session.displayName,
        modulePaths: Array.from(
          new Set([...claimA.modulePaths, ...claimB.modulePaths])
        ),
        citations: referenceCitations.map((c) => ({
          ...c,
          id: `cit-${followUpNextActionClaimId}-1`,
          claimId: followUpNextActionClaimId!,
        })),
        stateHistory: [
          {
            from: ClaimVerificationStatus.EXTRACTED,
            to: ClaimVerificationStatus.HUMAN_APPROVED,
            actorId: session.userId,
            actorType: 'HUMAN',
            reason: `Created automatically during conflict resolution ${conflict.id} to remediate outdated Notion documentation.`,
            timestamp: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };
      newClaims.push(nextActionClaim);
    }

    const resolvedConflict: Conflict = {
      ...conflict,
      status: ConflictStatus.RESOLVED,
      resolutionOption: input.resolutionOption,
      winningClaimId,
      losingClaimId,
      synthesizedClaimId,
      followUpNextActionClaimId,
      resolutionRationale: input.rationale,
      resolvedByUserId: session.userId,
      resolvedByDisplayName: session.displayName,
      resolvedAt: now,
    };

    const result = await this.repository.resolveConflictAtomically(projectId, {
      conflict: resolvedConflict,
      updatedClaims,
      newClaims,
      auditLog: {
        id: `audit-conflict-${Date.now()}`,
        organizationId: session.organizationId,
        projectId,
        actorUserId: session.userId,
        actorDisplayName: session.displayName,
        actorRole: session.role,
        effectiveClearanceTier: session.effectiveClearanceTier,
        action: 'CONFLICT_RESOLVED',
        targetEntityType: 'CONFLICT',
        targetEntityId: conflict.id,
        accessTier: conflict.accessTier,
        metadata: {
          topicKey: conflict.topicKey,
          resolutionOption: input.resolutionOption,
          winningClaimId,
          losingClaimId,
          synthesizedClaimId,
          followUpNextActionClaimId,
        },
        createdAt: now,
      },
    });

    return {
      conflict: result.conflict,
      updatedClaims: result.updatedClaims,
      newClaims: result.newClaims,
    };
  }

  public async listInterviews(
    session: AuthenticatedSession,
    projectId: string
  ): Promise<ExitInterview[]> {
    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'interview:read',
    });

    const list = await this.repository.listInterviews(projectId);
    return filterInterviewsByClearance(list, session.effectiveClearanceTier);
  }

  public async submitInterviewResponse(
    session: AuthenticatedSession,
    projectId: string,
    interviewId: string,
    answerTranscript: string
  ): Promise<{
    interview: ExitInterview;
    generatedClaims: Claim[];
  }> {
    const existing = await this.repository.getInterviewById(
      projectId,
      interviewId
    );
    if (!existing) {
      throw new Error('Exit interview not found');
    }

    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'interview:submit',
      requiredClearanceTier: existing.accessTier,
    });

    // Redact any secrets in the interview transcript
    const redaction = redactSecrets(answerTranscript);
    const now = new Date().toISOString();

    // Create a source artifact for the exit interview transcript so citations are 100% grounded
    const interviewSourceId = `src-interview-${existing.id}`;
    await this.repository.createSource({
      id: interviewSourceId,
      organizationId: session.organizationId,
      projectId,
      sourceType: 'CUSTOM_NOTE' as any,
      externalRef: `INTERVIEW-${existing.id.toUpperCase()}`,
      title: `Exit Interview Transcript: ${existing.topicKey}`,
      authorHandle: existing.contributorHandle,
      createdAt: now,
      accessTier: existing.accessTier,
      sanitizedContent: redaction.sanitizedContent,
      redactionMetadata: redaction.redactionMetadata,
      redactedCount: redaction.redactedCount,
      modulePaths: [existing.modulePath],
    });

    const newClaimId = `claim-int-${existing.id}`;
    const generatedClaim: Claim = {
      id: newClaimId,
      organizationId: session.organizationId,
      projectId,
      category: ClaimCategory.DECISION,
      topicKey: existing.topicKey,
      stanceValue: 'INTERVIEW_VERIFIED_PROTOCOL',
      title: `Exit Interview Resolution: ${existing.topicKey.replace(/-/g, ' ')}`,
      summary: redaction.sanitizedContent,
      verificationStatus: ClaimVerificationStatus.HUMAN_APPROVED,
      extractionOrigin: ExtractionOrigin.HUMAN_AUTHORED,
      confidenceScore: 1.0,
      accessTier: existing.accessTier,
      ownerHandle: existing.contributorHandle,
      modulePaths: [existing.modulePath],
      interviewId: existing.id,
      citations: [
        {
          id: `cit-${newClaimId}-1`,
          projectId,
          claimId: newClaimId,
          sourceId: interviewSourceId,
          sourceTitle: `Exit Interview Transcript: ${existing.topicKey}`,
          sourceExternalRef: `INTERVIEW-${existing.id.toUpperCase()}`,
          verbatimQuote: redaction.sanitizedContent,
          charStart: 0,
          charEnd: redaction.sanitizedContent.length,
          verificationStatus: 'VERIFIED',
          accessTier: existing.accessTier,
        },
      ],
      stateHistory: [
        {
          from: ClaimVerificationStatus.EXTRACTED,
          to: ClaimVerificationStatus.HUMAN_APPROVED,
          actorId: session.userId,
          actorType: 'HUMAN',
          reason: `Captured and approved via structured exit interview ${existing.id}.`,
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    const updatedInterview: ExitInterview = {
      ...existing,
      status: InterviewStatus.COMPLETED,
      answerTranscript: redaction.sanitizedContent,
      generatedClaimIds: [newClaimId],
      completedAt: now,
      completedByUserId: session.userId,
    };

    await this.repository.updateInterview(projectId, updatedInterview, [
      generatedClaim,
    ]);

    await this.repository.appendAuditLog({
      id: `audit-interview-${Date.now()}`,
      organizationId: session.organizationId,
      projectId,
      actorUserId: session.userId,
      actorDisplayName: session.displayName,
      actorRole: session.role,
      effectiveClearanceTier: session.effectiveClearanceTier,
      action: 'INTERVIEW_SUBMITTED',
      targetEntityType: 'EXIT_INTERVIEW',
      targetEntityId: existing.id,
      accessTier: existing.accessTier,
      metadata: {
        topicKey: existing.topicKey,
        generatedClaimId: newClaimId,
        redactedCount: redaction.redactedCount,
      },
      createdAt: now,
    });

    return {
      interview: updatedInterview,
      generatedClaims: [generatedClaim],
    };
  }
}
