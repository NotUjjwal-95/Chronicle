import fs from 'fs';
import path from 'path';
import {
  AuditLog,
  Claim,
  ClaimVerificationStatus,
  ClearanceTier,
  Conflict,
  Contributor,
  DependencyEdge,
  ExitInterview,
  ExtractionOrigin,
  HandoverSnapshot,
  Organization,
  OrganizationMembership,
  Project,
  ProjectMembership,
  ProjectRole,
  SnapshotAcknowledgement,
  SourceArtifact,
  SourceType,
} from '../../types';
import { redactSecrets } from '../../domain/engines/secret-redactor';
import { extractDeterministicCandidates } from '../../domain/engines/deterministic-extractor';
import { verifyClaimCitations } from '../../domain/engines/citation-grounder';
import { detectConflicts } from '../../domain/engines/conflict-detector';
import {
  AtomicConflictResolutionMutation,
  IChronicleRepository,
} from './repository-interface';

interface RawSeedFile {
  organization: Organization;
  organizationMemberships: OrganizationMembership[];
  project: Project;
  projectMemberships: ProjectMembership[];
  contributors: Contributor[];
  rawSources: Array<{
    id: string;
    sourceType: SourceType;
    externalRef: string;
    title: string;
    authorHandle: string;
    createdAt: string;
    accessTier: ClearanceTier;
    modulePaths: string[];
    rawContent: string;
  }>;
  exitInterviews: ExitInterview[];
  dependencyEdges: DependencyEdge[];
}

function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val)) as T;
}

/**
 * DeterministicSeedRepository:
 * Development, testing, and explicitly enabled demonstration mode.
 * Loads the 28-artifact Core-Payments-Service dataset, executes secret redaction,
 * deterministic extraction, citation grounding, and conflict detection deterministically.
 */
export class DeterministicSeedRepository implements IChronicleRepository {
  public readonly mode = 'seed' as const;

  private organizations = new Map<string, Organization>();
  private orgMemberships: OrganizationMembership[] = [];
  private projects = new Map<string, Project>();
  private projectMemberships: ProjectMembership[] = [];
  private contributors = new Map<string, Contributor[]>();
  private sources = new Map<string, SourceArtifact[]>();
  private claims = new Map<string, Claim[]>();
  private conflicts = new Map<string, Conflict[]>();
  private interviews = new Map<string, ExitInterview[]>();
  private dependencyEdges = new Map<string, DependencyEdge[]>();
  private snapshots = new Map<string, HandoverSnapshot[]>();
  private auditLogs = new Map<string, AuditLog[]>();

  constructor() {
    this.initializeFromSeedFile();
  }

  private loadRawSeed(): RawSeedFile {
    const seedPath = path.resolve(
      process.cwd(),
      'supabase/seed/core_payments_seed.json'
    );
    const rawJson = fs.readFileSync(seedPath, 'utf8');
    return JSON.parse(rawJson) as RawSeedFile;
  }

  private initializeFromSeedFile(): void {
    const seed = this.loadRawSeed();

    this.organizations.clear();
    this.organizations.set(seed.organization.id, deepClone(seed.organization));

    this.orgMemberships = deepClone(seed.organizationMemberships);

    this.projects.clear();
    this.projects.set(seed.project.id, deepClone(seed.project));

    this.projectMemberships = deepClone(seed.projectMemberships);

    const projectId = seed.project.id;
    const orgId = seed.organization.id;

    this.contributors.set(projectId, deepClone(seed.contributors));
    this.interviews.set(projectId, deepClone(seed.exitInterviews));
    this.dependencyEdges.set(projectId, deepClone(seed.dependencyEdges));
    this.snapshots.set(projectId, []);

    // 1. Redact all 28 raw sources before storing or extracting
    const sanitizedSources: SourceArtifact[] = seed.rawSources.map((raw) => {
      const redaction = redactSecrets(raw.rawContent);
      return {
        id: raw.id,
        organizationId: orgId,
        projectId,
        sourceType: raw.sourceType,
        externalRef: raw.externalRef,
        title: raw.title,
        authorHandle: raw.authorHandle,
        createdAt: raw.createdAt,
        accessTier: raw.accessTier,
        sanitizedContent: redaction.sanitizedContent,
        redactionMetadata: redaction.redactionMetadata,
        redactedCount: redaction.redactedCount,
        modulePaths: raw.modulePaths,
      };
    });

    this.sources.set(projectId, sanitizedSources);

    // 2. Run DeterministicExtractor across all sanitized sources
    const sourcesById = new Map(sanitizedSources.map((s) => [s.id, s]));
    const extractedClaims: Claim[] = [];

    for (const src of sanitizedSources) {
      const candidates = extractDeterministicCandidates({
        sourceId: src.id,
        sanitizedContent: src.sanitizedContent,
      });

      candidates.forEach((cand, idx) => {
        const claimId = `claim-${src.id}-${idx + 1}`;
        const rawClaim: Claim = {
          id: claimId,
          organizationId: orgId,
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
          stateHistory: [
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
          updatedAt: src.createdAt,
        };

        // 3. Ground and verify citations
        const grounded = verifyClaimCitations(rawClaim, sourcesById);
        extractedClaims.push(grounded);
      });
    }

    // 4. Detect multi-source contradictions (produces the 3 canonical contradictions)
    const conflictDetection = detectConflicts({
      organizationId: orgId,
      projectId,
      claims: extractedClaims,
      existingConflicts: [],
    });

    this.claims.set(projectId, conflictDetection.updatedClaims);
    this.conflicts.set(projectId, conflictDetection.newConflicts);

    // 5. Seed initial audit trail
    const totalRedacted = sanitizedSources.reduce(
      (acc, s) => acc + s.redactedCount,
      0
    );
    const initialLogs: AuditLog[] = [
      {
        id: 'audit-seed-1',
        sequenceNumber: 1,
        organizationId: orgId,
        projectId,
        actorUserId: 'usr-ujjwal-maintainer',
        actorDisplayName: 'Ujjwal Tyagi',
        actorRole: ProjectRole.MAINTAINER,
        effectiveClearanceTier: ClearanceTier.TIER_3_CONFIDENTIAL,
        action: 'SOURCE_INGESTED',
        targetEntityType: 'PROJECT',
        targetEntityId: projectId,
        accessTier: ClearanceTier.TIER_1_EXTERNAL,
        metadata: {
          ingestedSourcesCount: sanitizedSources.length,
          redactedSecretsCount: totalRedacted,
        },
        createdAt: '2026-11-08T07:25:00.000Z',
      },
      {
        id: 'audit-seed-2',
        sequenceNumber: 2,
        organizationId: orgId,
        projectId,
        actorUserId: 'usr-ujjwal-maintainer',
        actorDisplayName: 'Ujjwal Tyagi',
        actorRole: ProjectRole.MAINTAINER,
        effectiveClearanceTier: ClearanceTier.TIER_3_CONFIDENTIAL,
        action: 'RECONSTRUCTION_EXECUTED',
        targetEntityType: 'PROJECT',
        targetEntityId: projectId,
        accessTier: ClearanceTier.TIER_1_EXTERNAL,
        metadata: {
          mode: 'DETERMINISTIC',
          claimsCount: conflictDetection.updatedClaims.length,
          conflictsDetected: conflictDetection.newConflicts.length,
        },
        createdAt: '2026-11-08T07:30:00.000Z',
      },
    ];
    this.auditLogs.set(projectId, initialLogs);
  }

  public async getOrganizationById(orgId: string): Promise<Organization | null> {
    return deepClone(this.organizations.get(orgId) ?? null);
  }

  public async getOrganizationMembership(
    orgId: string,
    userId: string
  ): Promise<OrganizationMembership | null> {
    const found = this.orgMemberships.find(
      (m) => m.organizationId === orgId && m.userId === userId
    );
    return deepClone(found ?? null);
  }

  public async listOrganizationMemberships(
    orgId: string
  ): Promise<OrganizationMembership[]> {
    return deepClone(
      this.orgMemberships.filter((m) => m.organizationId === orgId)
    );
  }

  public async getProjectMembership(
    projectId: string,
    userId: string
  ): Promise<ProjectMembership | null> {
    const found = this.projectMemberships.find(
      (m) => m.projectId === projectId && m.userId === userId
    );
    return deepClone(found ?? null);
  }

  public async listProjectMemberships(
    projectId: string
  ): Promise<ProjectMembership[]> {
    return deepClone(
      this.projectMemberships.filter((m) => m.projectId === projectId)
    );
  }

  public async listProjectsForUser(userId: string): Promise<Project[]> {
    const allowedProjectIds = new Set(
      this.projectMemberships
        .filter((m) => m.userId === userId)
        .map((m) => m.projectId)
    );
    const result: Project[] = [];
    for (const [id, proj] of this.projects.entries()) {
      if (allowedProjectIds.has(id)) {
        result.push(deepClone(proj));
      }
    }
    return result;
  }

  public async getProjectById(projectId: string): Promise<Project | null> {
    return deepClone(this.projects.get(projectId) ?? null);
  }

  public async createProject(
    project: Project,
    creatorMembership: ProjectMembership
  ): Promise<Project> {
    this.projects.set(project.id, deepClone(project));
    this.projectMemberships.push(deepClone(creatorMembership));
    this.contributors.set(project.id, []);
    this.sources.set(project.id, []);
    this.claims.set(project.id, []);
    this.conflicts.set(project.id, []);
    this.interviews.set(project.id, []);
    this.dependencyEdges.set(project.id, []);
    this.snapshots.set(project.id, []);
    this.auditLogs.set(project.id, []);
    return deepClone(project);
  }

  public async updateProject(project: Project): Promise<Project> {
    this.projects.set(project.id, deepClone(project));
    return deepClone(project);
  }

  public async listContributors(projectId: string): Promise<Contributor[]> {
    return deepClone(this.contributors.get(projectId) ?? []);
  }

  public async listSources(projectId: string): Promise<SourceArtifact[]> {
    return deepClone(this.sources.get(projectId) ?? []);
  }

  public async getSourceById(
    projectId: string,
    sourceId: string
  ): Promise<SourceArtifact | null> {
    const list = this.sources.get(projectId) ?? [];
    return deepClone(list.find((s) => s.id === sourceId) ?? null);
  }

  public async createSource(source: SourceArtifact): Promise<SourceArtifact> {
    const list = this.sources.get(source.projectId) ?? [];
    list.unshift(deepClone(source));
    this.sources.set(source.projectId, list);
    return deepClone(source);
  }

  public async listClaims(projectId: string): Promise<Claim[]> {
    return deepClone(this.claims.get(projectId) ?? []);
  }

  public async getClaimById(
    projectId: string,
    claimId: string
  ): Promise<Claim | null> {
    const list = this.claims.get(projectId) ?? [];
    return deepClone(list.find((c) => c.id === claimId) ?? null);
  }

  public async upsertClaims(
    projectId: string,
    incomingClaims: Claim[]
  ): Promise<Claim[]> {
    const current = this.claims.get(projectId) ?? [];
    const byId = new Map(current.map((c) => [c.id, c]));
    for (const claim of incomingClaims) {
      byId.set(claim.id, deepClone(claim));
    }
    const merged = Array.from(byId.values());
    this.claims.set(projectId, merged);
    return deepClone(merged);
  }

  public async updateClaim(projectId: string, claim: Claim): Promise<Claim> {
    const current = this.claims.get(projectId) ?? [];
    const idx = current.findIndex((c) => c.id === claim.id);
    if (idx === -1) {
      throw new Error(`Claim ${claim.id} not found in project ${projectId}`);
    }
    current[idx] = deepClone(claim);
    this.claims.set(projectId, current);
    return deepClone(claim);
  }

  public async listConflicts(projectId: string): Promise<Conflict[]> {
    return deepClone(this.conflicts.get(projectId) ?? []);
  }

  public async getConflictById(
    projectId: string,
    conflictId: string
  ): Promise<Conflict | null> {
    const list = this.conflicts.get(projectId) ?? [];
    return deepClone(list.find((c) => c.id === conflictId) ?? null);
  }

  public async upsertConflicts(
    projectId: string,
    incomingConflicts: Conflict[]
  ): Promise<Conflict[]> {
    const current = this.conflicts.get(projectId) ?? [];
    const byId = new Map(current.map((c) => [c.id, c]));
    for (const conf of incomingConflicts) {
      byId.set(conf.id, deepClone(conf));
    }
    const merged = Array.from(byId.values());
    this.conflicts.set(projectId, merged);
    return deepClone(merged);
  }

  public async resolveConflictAtomically(
    projectId: string,
    mutation: AtomicConflictResolutionMutation
  ): Promise<{
    conflict: Conflict;
    updatedClaims: Claim[];
    newClaims: Claim[];
    auditLog: AuditLog;
  }> {
    // Snapshot state prior to mutation for rollback on any invariant error
    const prevConflicts = deepClone(this.conflicts.get(projectId) ?? []);
    const prevClaims = deepClone(this.claims.get(projectId) ?? []);
    const prevLogs = deepClone(this.auditLogs.get(projectId) ?? []);

    try {
      const conflictsList = this.conflicts.get(projectId) ?? [];
      const cIdx = conflictsList.findIndex((c) => c.id === mutation.conflict.id);
      if (cIdx === -1) {
        throw new Error(`Conflict ${mutation.conflict.id} not found`);
      }
      conflictsList[cIdx] = deepClone(mutation.conflict);
      this.conflicts.set(projectId, conflictsList);

      const claimsList = this.claims.get(projectId) ?? [];
      const claimsById = new Map(claimsList.map((c) => [c.id, c]));

      for (const updated of mutation.updatedClaims) {
        if (!claimsById.has(updated.id)) {
          throw new Error(`Referenced claim ${updated.id} not found during atomic conflict resolution`);
        }
        claimsById.set(updated.id, deepClone(updated));
      }

      for (const created of mutation.newClaims) {
        claimsById.set(created.id, deepClone(created));
      }

      this.claims.set(projectId, Array.from(claimsById.values()));

      const auditLog = await this.appendAuditLog(mutation.auditLog);

      return {
        conflict: deepClone(mutation.conflict),
        updatedClaims: deepClone(mutation.updatedClaims),
        newClaims: deepClone(mutation.newClaims),
        auditLog,
      };
    } catch (err) {
      // Atomic rollback
      this.conflicts.set(projectId, prevConflicts);
      this.claims.set(projectId, prevClaims);
      this.auditLogs.set(projectId, prevLogs);
      throw err;
    }
  }

  public async listInterviews(projectId: string): Promise<ExitInterview[]> {
    return deepClone(this.interviews.get(projectId) ?? []);
  }

  public async getInterviewById(
    projectId: string,
    interviewId: string
  ): Promise<ExitInterview | null> {
    const list = this.interviews.get(projectId) ?? [];
    return deepClone(list.find((i) => i.id === interviewId) ?? null);
  }

  public async updateInterview(
    projectId: string,
    interview: ExitInterview,
    generatedClaims: Claim[]
  ): Promise<ExitInterview> {
    const list = this.interviews.get(projectId) ?? [];
    const idx = list.findIndex((i) => i.id === interview.id);
    if (idx === -1) {
      throw new Error(`Interview ${interview.id} not found`);
    }
    list[idx] = deepClone(interview);
    this.interviews.set(projectId, list);

    if (generatedClaims.length > 0) {
      await this.upsertClaims(projectId, generatedClaims);
    }

    return deepClone(interview);
  }

  public async listDependencyEdges(
    projectId: string
  ): Promise<DependencyEdge[]> {
    return deepClone(this.dependencyEdges.get(projectId) ?? []);
  }

  public async listSnapshots(projectId: string): Promise<HandoverSnapshot[]> {
    return deepClone(this.snapshots.get(projectId) ?? []);
  }

  public async getSnapshotById(
    projectId: string,
    snapshotId: string
  ): Promise<HandoverSnapshot | null> {
    const list = this.snapshots.get(projectId) ?? [];
    return deepClone(list.find((s) => s.id === snapshotId) ?? null);
  }

  public async createSnapshot(
    snapshot: HandoverSnapshot
  ): Promise<HandoverSnapshot> {
    const list = this.snapshots.get(snapshot.projectId) ?? [];
    if (list.some((s) => s.versionTag === snapshot.versionTag)) {
      throw new Error(
        `Snapshot version "${snapshot.versionTag}" already exists for project ${snapshot.projectId} and is immutable.`
      );
    }
    const frozenSnapshot = deepClone({
      ...snapshot,
      acknowledgements: snapshot.acknowledgements ?? [],
    });
    list.unshift(frozenSnapshot);
    this.snapshots.set(snapshot.projectId, list);
    return deepClone(frozenSnapshot);
  }

  public async createSnapshotAcknowledgement(
    ack: SnapshotAcknowledgement
  ): Promise<SnapshotAcknowledgement> {
    const list = this.snapshots.get(ack.projectId) ?? [];
    const idx = list.findIndex((s) => s.id === ack.snapshotId);
    if (idx === -1) {
      throw new Error(`Snapshot ${ack.snapshotId} not found`);
    }
    // Acknowledgements are stored in the separate acknowledgements collection without mutating canonicalPayload or sha256Digest
    list[idx] = {
      ...list[idx],
      acknowledgements: [...list[idx].acknowledgements, deepClone(ack)],
    };
    this.snapshots.set(ack.projectId, list);
    return deepClone(ack);
  }

  public async listAuditLogs(projectId: string): Promise<AuditLog[]> {
    const list = this.auditLogs.get(projectId) ?? [];
    return deepClone(
      [...list].sort((a, b) => b.sequenceNumber - a.sequenceNumber)
    );
  }

  public async appendAuditLog(
    log: Omit<AuditLog, 'sequenceNumber'>
  ): Promise<AuditLog> {
    const list = this.auditLogs.get(log.projectId) ?? [];
    const nextSequence =
      list.length > 0
        ? Math.max(...list.map((item) => item.sequenceNumber)) + 1
        : 1;
    const entry: AuditLog = {
      ...deepClone(log),
      sequenceNumber: nextSequence,
    };
    list.push(entry);
    this.auditLogs.set(log.projectId, list);
    return deepClone(entry);
  }

  public async resetProjectToSeed(_projectId: string): Promise<void> {
    this.initializeFromSeedFile();
  }
}
