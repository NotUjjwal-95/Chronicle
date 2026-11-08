import {
  AuthenticatedSession,
  CanonicalSnapshotPayload,
  ClaimCategory,
  ClaimVerificationStatus,
  ConflictStatus,
  FirstSevenDaysAction,
  HandoverSnapshot,
  InterviewStatus,
  ReconstructionMode,
  SnapshotAcknowledgement,
} from '../types';
import { IChronicleRepository } from '../infrastructure/database/repository-interface';
import {
  filterClaimsByClearance,
  filterConflictsByClearance,
  filterContributorsByClearance,
  filterInterviewsByClearance,
} from '../security/clearance-policy';
import {
  computeSnapshotSha256,
  SnapshotVerificationReport,
  verifySnapshotIntegrity,
} from '../domain/engines/snapshot-hasher';
import {
  exportSnapshotToJson,
  exportSnapshotToMarkdown,
  filterSnapshotForClearance,
} from '../domain/engines/handover-exporter';
import { AuthorizationService } from './authorization-service';

export class HandoverService {
  private readonly authService: AuthorizationService;

  constructor(private readonly repository: IChronicleRepository) {
    this.authService = new AuthorizationService(repository);
  }

  public async listSnapshots(
    session: AuthenticatedSession,
    projectId: string
  ): Promise<HandoverSnapshot[]> {
    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'snapshot:read',
    });

    const snapshots = await this.repository.listSnapshots(projectId);
    return snapshots
      .filter((s) => s.accessTier <= session.effectiveClearanceTier)
      .map((s) => filterSnapshotForClearance(s, session.effectiveClearanceTier));
  }

  public async createHandoverSnapshot(
    session: AuthenticatedSession,
    projectId: string,
    versionTag: string
  ): Promise<HandoverSnapshot> {
    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'snapshot:create',
    });

    const project = await this.repository.getProjectById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const tier = session.effectiveClearanceTier;
    const [allClaims, allConflicts, allContributors, allInterviews] =
      await Promise.all([
        this.repository.listClaims(projectId),
        this.repository.listConflicts(projectId),
        this.repository.listContributors(projectId),
        this.repository.listInterviews(projectId),
      ]);

    const visibleClaims = filterClaimsByClearance(allClaims, tier);
    const visibleClaimIds = new Set(visibleClaims.map((c) => c.id));
    const visibleConflicts = filterConflictsByClearance(
      allConflicts,
      visibleClaimIds,
      tier
    );
    const visibleContributors = filterContributorsByClearance(
      allContributors,
      tier
    );
    const visibleInterviews = filterInterviewsByClearance(allInterviews, tier);

    const activeClaims = visibleClaims.filter(
      (c) =>
        c.verificationStatus === ClaimVerificationStatus.VERIFIED ||
        c.verificationStatus === ClaimVerificationStatus.HUMAN_APPROVED ||
        c.verificationStatus === ClaimVerificationStatus.EXTRACTED
    );

    const firstSevenDaysPlan: FirstSevenDaysAction[] = [
      {
        dayRange: 'DAY_1_2',
        title: 'Verify Ed25519 session signing & rotate HSM quorum shares',
        rationale:
          'Confirm production session token verification in src/middleware/session.ts and complete YubiHSM custodian transfer from @arjun-mehta.',
        priority: 'CRITICAL',
        modulePath: 'src/middleware/session.ts',
        ownerHandle: project.incomingLeadHandle,
      },
      {
        dayRange: 'DAY_3_5',
        title: 'Validate PostgreSQL transactional outbox & dead-letter drain',
        rationale:
          'Ensure src/workers/retry.ts SKIP LOCKED polling and 72-hour dead-letter reconciliation run without lock contention on src/ledger/outbox.ts.',
        priority: 'HIGH',
        modulePath: 'src/workers/retry.ts',
        ownerHandle: project.incomingLeadHandle,
      },
      {
        dayRange: 'DAY_6_7',
        title: 'Complete SIGHUP CIDR reload validation & decommission legacy Redis',
        rationale:
          'Finish zero-downtime CIDR reload validation in config/whitelist.json and decommission the legacy Redis retry cluster.',
        priority: 'STANDARD',
        modulePath: 'config/whitelist.json',
        ownerHandle: project.incomingLeadHandle,
      },
    ];

    const canonicalPayload: CanonicalSnapshotPayload = {
      schemaVersion: 'chronicle.handover.v1',
      projectId: project.id,
      organizationId: project.organizationId,
      projectName: project.name,
      repositoryUrl: project.repositoryUrl,
      versionTag,
      effectiveClearanceTier: tier,
      reconstructionMode:
        project.lastReconstructionMode ?? ReconstructionMode.DETERMINISTIC,
      activeDecisions: activeClaims.filter(
        (c) => c.category === ClaimCategory.DECISION
      ),
      unfinishedWork: activeClaims.filter(
        (c) => c.category === ClaimCategory.UNFINISHED_WORK
      ),
      risksAndBlockers: activeClaims.filter(
        (c) => c.category === ClaimCategory.RISK_BLOCKER
      ),
      dependencies: activeClaims.filter(
        (c) => c.category === ClaimCategory.DEPENDENCY
      ),
      ownershipContacts: activeClaims.filter(
        (c) => c.category === ClaimCategory.OWNERSHIP_CONTACT
      ),
      nextActions: activeClaims.filter(
        (c) => c.category === ClaimCategory.NEXT_ACTION
      ),
      contributors: visibleContributors,
      resolvedConflicts: visibleConflicts.filter(
        (c) => c.status === ConflictStatus.RESOLVED
      ),
      supersededClaimsHistory: visibleClaims.filter(
        (c) => c.verificationStatus === ClaimVerificationStatus.SUPERSEDED
      ),
      openKnowledgeGaps: visibleInterviews.filter(
        (i) => i.status === InterviewStatus.PENDING
      ),
      completedInterviews: visibleInterviews.filter(
        (i) => i.status === InterviewStatus.COMPLETED
      ),
      firstSevenDaysPlan,
    };

    const sha256Digest = computeSnapshotSha256(canonicalPayload);
    const now = new Date().toISOString();
    const snapshotId = `snap-${versionTag.replace(/[^a-zA-Z0-9_-]/g, '')}-${Date.now().toString().slice(-4)}`;

    const snapshot: HandoverSnapshot = {
      id: snapshotId,
      organizationId: project.organizationId,
      projectId: project.id,
      versionTag,
      accessTier: tier,
      canonicalPayload,
      sha256Digest,
      createdByUserId: session.userId,
      createdByName: session.displayName,
      createdAt: now,
      acknowledgements: [],
    };

    const saved = await this.repository.createSnapshot(snapshot);

    await this.repository.appendAuditLog({
      id: `audit-snap-create-${Date.now()}`,
      organizationId: session.organizationId,
      projectId,
      actorUserId: session.userId,
      actorDisplayName: session.displayName,
      actorRole: session.role,
      effectiveClearanceTier: session.effectiveClearanceTier,
      action: 'SNAPSHOT_CREATED',
      targetEntityType: 'HANDOVER_SNAPSHOT',
      targetEntityId: saved.id,
      accessTier: saved.accessTier,
      metadata: {
        versionTag: saved.versionTag,
        sha256Digest: saved.sha256Digest,
      },
      createdAt: now,
    });

    return saved;
  }

  public async verifySnapshot(
    session: AuthenticatedSession,
    projectId: string,
    snapshotId: string,
    expectedDigest?: string
  ): Promise<SnapshotVerificationReport> {
    const snapshot = await this.repository.getSnapshotById(
      projectId,
      snapshotId
    );
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'snapshot:verify',
      requiredClearanceTier: snapshot.accessTier,
    });

    const report = verifySnapshotIntegrity(snapshot, expectedDigest);

    if (!session.isShadowPreview) {
      await this.repository.appendAuditLog({
        id: `audit-snap-verify-${Date.now()}`,
        organizationId: session.organizationId,
        projectId,
        actorUserId: session.userId,
        actorDisplayName: session.displayName,
        actorRole: session.role,
        effectiveClearanceTier: session.effectiveClearanceTier,
        action: 'SNAPSHOT_VERIFIED',
        targetEntityType: 'HANDOVER_SNAPSHOT',
        targetEntityId: snapshot.id,
        accessTier: snapshot.accessTier,
        metadata: {
          versionTag: snapshot.versionTag,
          isIntegrityValid: report.isIntegrityValid,
          recomputedDigest: report.recomputedDigest,
        },
        createdAt: report.verifiedAt,
      });
    }

    return report;
  }

  public async acknowledgeSnapshot(
    session: AuthenticatedSession,
    projectId: string,
    snapshotId: string,
    input: {
      notes: string;
      verifiedDigest: string;
    }
  ): Promise<SnapshotAcknowledgement> {
    const snapshot = await this.repository.getSnapshotById(
      projectId,
      snapshotId
    );
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'snapshot:acknowledge',
      requiredClearanceTier: snapshot.accessTier,
    });

    const integrity = verifySnapshotIntegrity(snapshot, input.verifiedDigest);
    if (!integrity.isIntegrityValid) {
      throw new Error(
        'Cannot acknowledge snapshot: provided digest does not match canonical SHA-256 payload digest.'
      );
    }

    const now = new Date().toISOString();
    const ack: SnapshotAcknowledgement = {
      id: `ack-${snapshot.id}-${Date.now().toString().slice(-4)}`,
      organizationId: session.organizationId,
      projectId,
      snapshotId: snapshot.id,
      acknowledgedByUserId: session.userId,
      acknowledgedByName: session.displayName,
      acknowledgedByRole: session.role,
      notes: input.notes,
      verifiedDigest: snapshot.sha256Digest,
      acknowledgedAt: now,
    };

    const saved = await this.repository.createSnapshotAcknowledgement(ack);

    await this.repository.appendAuditLog({
      id: `audit-snap-ack-${Date.now()}`,
      organizationId: session.organizationId,
      projectId,
      actorUserId: session.userId,
      actorDisplayName: session.displayName,
      actorRole: session.role,
      effectiveClearanceTier: session.effectiveClearanceTier,
      action: 'SNAPSHOT_ACKNOWLEDGED',
      targetEntityType: 'HANDOVER_SNAPSHOT',
      targetEntityId: snapshot.id,
      accessTier: snapshot.accessTier,
      metadata: {
        versionTag: snapshot.versionTag,
        verifiedDigest: saved.verifiedDigest,
        notes: saved.notes,
      },
      createdAt: now,
    });

    return saved;
  }

  public async exportSnapshot(
    session: AuthenticatedSession,
    projectId: string,
    snapshotId: string,
    format: 'markdown' | 'json'
  ): Promise<{
    format: 'markdown' | 'json';
    filename: string;
    content: string;
    sha256Digest: string;
  }> {
    const snapshot = await this.repository.getSnapshotById(
      projectId,
      snapshotId
    );
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'snapshot:export',
    });

    const content =
      format === 'markdown'
        ? exportSnapshotToMarkdown(snapshot, session.effectiveClearanceTier)
        : exportSnapshotToJson(snapshot, session.effectiveClearanceTier);

    const ext = format === 'markdown' ? 'md' : 'json';
    const filename = `chronicle-handover-${snapshot.versionTag}-tier${session.effectiveClearanceTier}.${ext}`;

    if (!session.isShadowPreview) {
      await this.repository.appendAuditLog({
        id: `audit-snap-export-${Date.now()}`,
        organizationId: session.organizationId,
        projectId,
        actorUserId: session.userId,
        actorDisplayName: session.displayName,
        actorRole: session.role,
        effectiveClearanceTier: session.effectiveClearanceTier,
        action: 'SNAPSHOT_EXPORTED',
        targetEntityType: 'HANDOVER_SNAPSHOT',
        targetEntityId: snapshot.id,
        accessTier: session.effectiveClearanceTier,
        metadata: {
          format,
          filename,
          effectiveClearanceTier: session.effectiveClearanceTier,
        },
        createdAt: new Date().toISOString(),
      });
    }

    return {
      format,
      filename,
      content,
      sha256Digest: snapshot.sha256Digest,
    };
  }
}
