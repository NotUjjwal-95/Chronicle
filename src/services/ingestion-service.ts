import {
  AuthenticatedSession,
  ClearanceTier,
  SourceArtifact,
  SourceType,
} from '../types';
import { IChronicleRepository } from '../infrastructure/database/repository-interface';
import { redactSecrets } from '../domain/engines/secret-redactor';
import { filterSourcesForClearance } from '../security/clearance-policy';
import { fetchGithubPullRequestArtifact } from '../infrastructure/github/github-client';
import { AuthorizationService } from './authorization-service';

export class IngestionService {
  private readonly authService: AuthorizationService;

  constructor(private readonly repository: IChronicleRepository) {
    this.authService = new AuthorizationService(repository);
  }

  public async listAuthorizedSources(
    session: AuthenticatedSession,
    projectId: string
  ): Promise<SourceArtifact[]> {
    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'source:read',
    });

    const allSources = await this.repository.listSources(projectId);
    return filterSourcesForClearance(
      allSources,
      session.effectiveClearanceTier
    );
  }

  public async ingestSourceArtifact(
    session: AuthenticatedSession,
    projectId: string,
    input: {
      sourceType: SourceType;
      externalRef: string;
      title: string;
      authorHandle: string;
      accessTier: ClearanceTier;
      rawContent: string;
      modulePaths: string[];
    }
  ): Promise<SourceArtifact> {
    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'source:ingest',
      requiredClearanceTier: input.accessTier,
    });

    // Execute mandatory SecretRedactor before persisting any artifact
    const redaction = redactSecrets(input.rawContent);
    const now = new Date().toISOString();
    const sourceId = `src-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const artifact: SourceArtifact = {
      id: sourceId,
      organizationId: session.organizationId,
      projectId,
      sourceType: input.sourceType,
      externalRef: input.externalRef,
      title: input.title,
      authorHandle: input.authorHandle,
      createdAt: now,
      accessTier: input.accessTier,
      sanitizedContent: redaction.sanitizedContent,
      redactionMetadata: redaction.redactionMetadata,
      redactedCount: redaction.redactedCount,
      modulePaths: input.modulePaths,
    };

    const saved = await this.repository.createSource(artifact);

    await this.repository.appendAuditLog({
      id: `audit-ingest-${Date.now()}`,
      organizationId: session.organizationId,
      projectId,
      actorUserId: session.userId,
      actorDisplayName: session.displayName,
      actorRole: session.role,
      effectiveClearanceTier: session.effectiveClearanceTier,
      action: 'SOURCE_INGESTED',
      targetEntityType: 'SOURCE_ARTIFACT',
      targetEntityId: saved.id,
      accessTier: saved.accessTier,
      metadata: {
        externalRef: saved.externalRef,
        sourceType: saved.sourceType,
        redactedCount: saved.redactedCount,
      },
      createdAt: now,
    });

    return saved;
  }

  public async importGithubPrArtifact(
    session: AuthenticatedSession,
    projectId: string,
    input: {
      owner: string;
      repo: string;
      pullNumber: number;
      accessTier: ClearanceTier;
      syntheticFallbackIfOffline?: boolean;
    }
  ): Promise<{
    source: SourceArtifact;
    importedVia: 'GITHUB_REST_API' | 'DETERMINISTIC_SYNTHETIC_PR';
  }> {
    await this.authService.authorizeProjectOperation({
      session,
      projectId,
      requiredPermission: 'source:ingest',
      requiredClearanceTier: input.accessTier,
    });

    const prResult = await fetchGithubPullRequestArtifact(input);
    const redaction = redactSecrets(prResult.rawContent);
    const now = new Date().toISOString();
    const sourceId = `src-ghpr-${input.pullNumber}-${Date.now().toString().slice(-4)}`;

    const artifact: SourceArtifact = {
      id: sourceId,
      organizationId: session.organizationId,
      projectId,
      sourceType: SourceType.GITHUB_PR,
      externalRef: prResult.externalRef,
      title: prResult.title,
      authorHandle: prResult.authorHandle,
      createdAt: now,
      accessTier: input.accessTier,
      sanitizedContent: redaction.sanitizedContent,
      redactionMetadata: redaction.redactionMetadata,
      redactedCount: redaction.redactedCount,
      modulePaths: prResult.modulePaths,
    };

    const saved = await this.repository.createSource(artifact);

    await this.repository.appendAuditLog({
      id: `audit-ghpr-${Date.now()}`,
      organizationId: session.organizationId,
      projectId,
      actorUserId: session.userId,
      actorDisplayName: session.displayName,
      actorRole: session.role,
      effectiveClearanceTier: session.effectiveClearanceTier,
      action: 'GITHUB_PR_IMPORTED',
      targetEntityType: 'SOURCE_ARTIFACT',
      targetEntityId: saved.id,
      accessTier: saved.accessTier,
      metadata: {
        externalRef: saved.externalRef,
        importedVia: prResult.importedVia,
        redactedCount: saved.redactedCount,
      },
      createdAt: now,
    });

    return {
      source: saved,
      importedVia: prResult.importedVia,
    };
  }
}
