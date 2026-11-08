import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  AuditLog,
  Claim,
  Conflict,
  Contributor,
  DependencyEdge,
  ExitInterview,
  HandoverSnapshot,
  Organization,
  OrganizationMembership,
  Project,
  ProjectMembership,
  SnapshotAcknowledgement,
  SourceArtifact,
} from '../../types';
import {
  AtomicConflictResolutionMutation,
  IChronicleRepository,
} from './repository-interface';

/**
 * SupabasePostgresRepository:
 * Production persistence backed by Supabase PostgreSQL.
 * Section 9.5: Fails closed if database configuration or connectivity is unavailable.
 * Never silently falls back from production persistence to in-memory storage.
 */
export class SupabasePostgresRepository implements IChronicleRepository {
  public readonly mode = 'supabase' as const;
  private readonly client: SupabaseClient;

  constructor(supabaseUrl?: string, serviceRoleKey?: string) {
    const url = supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    const key =
      serviceRoleKey ??
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
      '';

    if (!url || !key) {
      throw new Error(
        'PERSISTENCE_UNAVAILABLE: SupabasePostgresRepository requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Failing closed as required by Section 9.5.'
      );
    }

    this.client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }

  public async getOrganizationById(orgId: string): Promise<Organization | null> {
    const { data, error } = await this.client
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .maybeSingle();
    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      slug: data.slug,
      name: data.name,
      createdAt: data.created_at,
    };
  }

  public async getOrganizationMembership(
    orgId: string,
    userId: string
  ): Promise<OrganizationMembership | null> {
    const { data, error } = await this.client
      .from('organization_memberships')
      .select('*')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      organizationId: data.organization_id,
      userId: data.user_id,
      email: data.email,
      displayName: data.display_name,
      orgRole: data.org_role,
      maxClearanceTier: data.max_clearance_tier,
      createdAt: data.created_at,
    };
  }

  public async listOrganizationMemberships(
    orgId: string
  ): Promise<OrganizationMembership[]> {
    const { data, error } = await this.client
      .from('organization_memberships')
      .select('*')
      .eq('organization_id', orgId);
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      userId: row.user_id,
      email: row.email,
      displayName: row.display_name,
      orgRole: row.org_role,
      maxClearanceTier: row.max_clearance_tier,
      createdAt: row.created_at,
    }));
  }

  public async getProjectMembership(
    projectId: string,
    userId: string
  ): Promise<ProjectMembership | null> {
    const { data, error } = await this.client
      .from('project_memberships')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      organizationId: data.organization_id,
      projectId: data.project_id,
      userId: data.user_id,
      role: data.role,
      clearanceTier: data.clearance_tier,
      createdAt: data.created_at,
    };
  }

  public async listProjectMemberships(
    projectId: string
  ): Promise<ProjectMembership[]> {
    const { data, error } = await this.client
      .from('project_memberships')
      .select('*')
      .eq('project_id', projectId);
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      userId: row.user_id,
      role: row.role,
      clearanceTier: row.clearance_tier,
      createdAt: row.created_at,
    }));
  }

  public async listProjectsForUser(userId: string): Promise<Project[]> {
    const { data: memberships, error: memErr } = await this.client
      .from('project_memberships')
      .select('project_id')
      .eq('user_id', userId);
    if (memErr) throw new Error(`Supabase error: ${memErr.message}`);
    const ids = (memberships ?? []).map((m) => m.project_id);
    if (ids.length === 0) return [];

    const { data, error } = await this.client
      .from('projects')
      .select('*')
      .in('id', ids);
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      repositoryUrl: row.repository_url,
      departingLeadHandle: row.departing_lead_handle,
      incomingLeadHandle: row.incoming_lead_handle,
      lastReconstructionMode: row.last_reconstruction_mode,
      lastReconstructedAt: row.last_reconstructed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  public async getProjectById(projectId: string): Promise<Project | null> {
    const { data, error } = await this.client
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();
    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      organizationId: data.organization_id,
      slug: data.slug,
      name: data.name,
      description: data.description,
      repositoryUrl: data.repository_url,
      departingLeadHandle: data.departing_lead_handle,
      incomingLeadHandle: data.incoming_lead_handle,
      lastReconstructionMode: data.last_reconstruction_mode,
      lastReconstructedAt: data.last_reconstructed_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  public async createProject(
    project: Project,
    creatorMembership: ProjectMembership
  ): Promise<Project> {
    const { error } = await this.client.from('projects').insert({
      id: project.id,
      organization_id: project.organizationId,
      slug: project.slug,
      name: project.name,
      description: project.description,
      repository_url: project.repositoryUrl,
      departing_lead_handle: project.departingLeadHandle,
      incoming_lead_handle: project.incomingLeadHandle,
      last_reconstruction_mode: project.lastReconstructionMode,
      last_reconstructed_at: project.lastReconstructedAt,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    });
    if (error) throw new Error(`Supabase error: ${error.message}`);

    const { error: memErr } = await this.client
      .from('project_memberships')
      .insert({
        id: creatorMembership.id,
        organization_id: creatorMembership.organizationId,
        project_id: creatorMembership.projectId,
        user_id: creatorMembership.userId,
        role: creatorMembership.role,
        clearance_tier: creatorMembership.clearanceTier,
        created_at: creatorMembership.createdAt,
      });
    if (memErr) throw new Error(`Supabase error: ${memErr.message}`);

    return project;
  }

  public async updateProject(project: Project): Promise<Project> {
    const { error } = await this.client
      .from('projects')
      .update({
        name: project.name,
        description: project.description,
        departing_lead_handle: project.departingLeadHandle,
        incoming_lead_handle: project.incomingLeadHandle,
        last_reconstruction_mode: project.lastReconstructionMode,
        last_reconstructed_at: project.lastReconstructedAt,
        updated_at: project.updatedAt,
      })
      .eq('id', project.id);
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return project;
  }

  public async listContributors(projectId: string): Promise<Contributor[]> {
    const { data, error } = await this.client
      .from('contributors')
      .select('*')
      .eq('project_id', projectId);
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      handle: row.handle,
      displayName: row.display_name,
      email: row.email,
      roleTitle: row.role_title,
      departureStatus: row.departure_status,
      primaryDomains: row.primary_domains ?? [],
      accessTier: row.access_tier,
    }));
  }

  public async listSources(projectId: string): Promise<SourceArtifact[]> {
    const { data, error } = await this.client
      .from('source_artifacts')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      sourceType: row.source_type,
      externalRef: row.external_ref,
      title: row.title,
      authorHandle: row.author_handle,
      createdAt: row.created_at,
      accessTier: row.access_tier,
      sanitizedContent: row.sanitized_content,
      redactionMetadata: row.redaction_metadata ?? [],
      redactedCount: row.redacted_count,
      modulePaths: row.module_paths ?? [],
    }));
  }

  public async getSourceById(
    projectId: string,
    sourceId: string
  ): Promise<SourceArtifact | null> {
    const { data, error } = await this.client
      .from('source_artifacts')
      .select('*')
      .eq('project_id', projectId)
      .eq('id', sourceId)
      .maybeSingle();
    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      organizationId: data.organization_id,
      projectId: data.project_id,
      sourceType: data.source_type,
      externalRef: data.external_ref,
      title: data.title,
      authorHandle: data.author_handle,
      createdAt: data.created_at,
      accessTier: data.access_tier,
      sanitizedContent: data.sanitized_content,
      redactionMetadata: data.redaction_metadata ?? [],
      redactedCount: data.redacted_count,
      modulePaths: data.module_paths ?? [],
    };
  }

  public async createSource(source: SourceArtifact): Promise<SourceArtifact> {
    const { error } = await this.client.from('source_artifacts').insert({
      id: source.id,
      organization_id: source.organizationId,
      project_id: source.projectId,
      source_type: source.sourceType,
      external_ref: source.externalRef,
      title: source.title,
      author_handle: source.authorHandle,
      created_at: source.createdAt,
      access_tier: source.accessTier,
      sanitized_content: source.sanitizedContent,
      redaction_metadata: source.redactionMetadata,
      redacted_count: source.redactedCount,
      module_paths: source.modulePaths,
    });
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return source;
  }

  public async listClaims(projectId: string): Promise<Claim[]> {
    const { data: claimRows, error } = await this.client
      .from('claims')
      .select('*, claim_citations(*)')
      .eq('project_id', projectId);
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return (claimRows ?? []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      category: row.category,
      topicKey: row.topic_key,
      stanceValue: row.stance_value,
      title: row.title,
      summary: row.summary,
      verificationStatus: row.verification_status,
      extractionOrigin: row.extraction_origin,
      confidenceScore: Number(row.confidence_score),
      accessTier: row.access_tier,
      ownerHandle: row.owner_handle,
      modulePaths: row.module_paths ?? [],
      interviewId: row.interview_id,
      synthesizedFromClaimIds: row.synthesized_from_claim_ids ?? [],
      supersededByClaimId: row.superseded_by_claim_id,
      stateHistory: row.state_history ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      citations: (row.claim_citations ?? []).map((cit: Record<string, unknown>) => ({
        id: String(cit.id),
        projectId: String(cit.project_id),
        claimId: String(cit.claim_id),
        sourceId: String(cit.source_id),
        sourceTitle: cit.source_title ? String(cit.source_title) : undefined,
        sourceExternalRef: cit.source_external_ref
          ? String(cit.source_external_ref)
          : undefined,
        verbatimQuote: String(cit.verbatim_quote),
        charStart: Number(cit.char_start),
        charEnd: Number(cit.char_end),
        verificationStatus: cit.verification_status as 'VERIFIED' | 'MISSING_EVIDENCE',
        accessTier: Number(cit.access_tier),
      })),
    }));
  }

  public async getClaimById(
    projectId: string,
    claimId: string
  ): Promise<Claim | null> {
    const claims = await this.listClaims(projectId);
    return claims.find((c) => c.id === claimId) ?? null;
  }

  public async upsertClaims(
    projectId: string,
    claims: Claim[]
  ): Promise<Claim[]> {
    for (const claim of claims) {
      await this.updateClaim(projectId, claim);
    }
    return this.listClaims(projectId);
  }

  public async updateClaim(projectId: string, claim: Claim): Promise<Claim> {
    const { error } = await this.client.from('claims').upsert({
      id: claim.id,
      organization_id: claim.organizationId,
      project_id: projectId,
      category: claim.category,
      topic_key: claim.topicKey,
      stance_value: claim.stanceValue,
      title: claim.title,
      summary: claim.summary,
      verification_status: claim.verificationStatus,
      extraction_origin: claim.extractionOrigin,
      confidence_score: claim.confidenceScore,
      access_tier: claim.accessTier,
      owner_handle: claim.ownerHandle,
      module_paths: claim.modulePaths,
      interview_id: claim.interviewId ?? null,
      synthesized_from_claim_ids: claim.synthesizedFromClaimIds ?? [],
      superseded_by_claim_id: claim.supersededByClaimId ?? null,
      state_history: claim.stateHistory,
      created_at: claim.createdAt,
      updated_at: claim.updatedAt,
    });
    if (error) throw new Error(`Supabase error: ${error.message}`);

    for (const cit of claim.citations) {
      const { error: citErr } = await this.client.from('claim_citations').upsert({
        id: cit.id,
        project_id: projectId,
        claim_id: claim.id,
        source_id: cit.sourceId,
        source_title: cit.sourceTitle ?? null,
        source_external_ref: cit.sourceExternalRef ?? null,
        verbatim_quote: cit.verbatimQuote,
        char_start: cit.charStart,
        char_end: cit.charEnd,
        verification_status: cit.verificationStatus,
        access_tier: cit.accessTier,
      });
      if (citErr) throw new Error(`Supabase error: ${citErr.message}`);
    }

    return claim;
  }

  public async listConflicts(projectId: string): Promise<Conflict[]> {
    const { data, error } = await this.client
      .from('conflicts')
      .select('*')
      .eq('project_id', projectId);
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      topicKey: row.topic_key,
      title: row.title,
      description: row.description,
      claimAId: row.claim_a_id,
      claimBId: row.claim_b_id,
      claimAPreviousStatus: row.claim_a_previous_status,
      claimBPreviousStatus: row.claim_b_previous_status,
      status: row.status,
      accessTier: row.access_tier,
      resolutionOption: row.resolution_option,
      winningClaimId: row.winning_claim_id,
      losingClaimId: row.losing_claim_id,
      synthesizedClaimId: row.synthesized_claim_id,
      followUpNextActionClaimId: row.follow_up_next_action_claim_id,
      resolutionRationale: row.resolution_rationale,
      resolvedByUserId: row.resolved_by_user_id,
      resolvedByDisplayName: row.resolved_by_display_name,
      detectedAt: row.detected_at,
      resolvedAt: row.resolved_at,
    }));
  }

  public async getConflictById(
    projectId: string,
    conflictId: string
  ): Promise<Conflict | null> {
    const conflicts = await this.listConflicts(projectId);
    return conflicts.find((c) => c.id === conflictId) ?? null;
  }

  public async upsertConflicts(
    projectId: string,
    conflicts: Conflict[]
  ): Promise<Conflict[]> {
    for (const c of conflicts) {
      const { error } = await this.client.from('conflicts').upsert({
        id: c.id,
        organization_id: c.organizationId,
        project_id: projectId,
        topic_key: c.topicKey,
        title: c.title,
        description: c.description,
        claim_a_id: c.claimAId,
        claim_b_id: c.claimBId,
        claim_a_previous_status: c.claimAPreviousStatus,
        claim_b_previous_status: c.claimBPreviousStatus,
        status: c.status,
        access_tier: c.accessTier,
        resolution_option: c.resolutionOption ?? null,
        winning_claim_id: c.winningClaimId ?? null,
        losing_claim_id: c.losingClaimId ?? null,
        synthesized_claim_id: c.synthesizedClaimId ?? null,
        follow_up_next_action_claim_id: c.followUpNextActionClaimId ?? null,
        resolution_rationale: c.resolutionRationale ?? null,
        resolved_by_user_id: c.resolvedByUserId ?? null,
        resolved_by_display_name: c.resolvedByDisplayName ?? null,
        detected_at: c.detectedAt,
        resolved_at: c.resolvedAt ?? null,
      });
      if (error) throw new Error(`Supabase error: ${error.message}`);
    }
    return this.listConflicts(projectId);
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
    for (const c of mutation.updatedClaims) {
      await this.updateClaim(projectId, c);
    }
    for (const c of mutation.newClaims) {
      await this.updateClaim(projectId, c);
    }
    await this.upsertConflicts(projectId, [mutation.conflict]);
    const auditLog = await this.appendAuditLog(mutation.auditLog);
    return {
      conflict: mutation.conflict,
      updatedClaims: mutation.updatedClaims,
      newClaims: mutation.newClaims,
      auditLog,
    };
  }

  public async listInterviews(projectId: string): Promise<ExitInterview[]> {
    const { data, error } = await this.client
      .from('exit_interviews')
      .select('*')
      .eq('project_id', projectId);
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      contributorHandle: row.contributor_handle,
      contributorName: row.contributor_name,
      topicKey: row.topic_key,
      modulePath: row.module_path,
      question: row.question,
      contextSummary: row.context_summary,
      status: row.status,
      accessTier: row.access_tier,
      answerTranscript: row.answer_transcript,
      generatedClaimIds: row.generated_claim_ids ?? [],
      createdAt: row.created_at,
      completedAt: row.completed_at,
      completedByUserId: row.completed_by_user_id,
    }));
  }

  public async getInterviewById(
    projectId: string,
    interviewId: string
  ): Promise<ExitInterview | null> {
    const list = await this.listInterviews(projectId);
    return list.find((i) => i.id === interviewId) ?? null;
  }

  public async updateInterview(
    projectId: string,
    interview: ExitInterview,
    generatedClaims: Claim[]
  ): Promise<ExitInterview> {
    const { error } = await this.client.from('exit_interviews').upsert({
      id: interview.id,
      organization_id: interview.organizationId,
      project_id: projectId,
      contributor_handle: interview.contributorHandle,
      contributor_name: interview.contributorName,
      topic_key: interview.topicKey,
      module_path: interview.modulePath,
      question: interview.question,
      context_summary: interview.contextSummary,
      status: interview.status,
      access_tier: interview.accessTier,
      answer_transcript: interview.answerTranscript ?? null,
      generated_claim_ids: interview.generatedClaimIds,
      created_at: interview.createdAt,
      completed_at: interview.completedAt ?? null,
      completed_by_user_id: interview.completedByUserId ?? null,
    });
    if (error) throw new Error(`Supabase error: ${error.message}`);

    if (generatedClaims.length > 0) {
      await this.upsertClaims(projectId, generatedClaims);
    }

    return interview;
  }

  public async listDependencyEdges(
    projectId: string
  ): Promise<DependencyEdge[]> {
    const { data, error } = await this.client
      .from('dependency_edges')
      .select('*')
      .eq('project_id', projectId);
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      relationship: row.relationship,
      accessTier: row.access_tier,
      weight: row.weight,
    }));
  }

  public async listSnapshots(projectId: string): Promise<HandoverSnapshot[]> {
    const { data, error } = await this.client
      .from('handover_snapshots')
      .select('*, snapshot_acknowledgements(*)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      organizationId: row.organization_id,
      projectId: row.project_id,
      versionTag: row.version_tag,
      accessTier: row.access_tier,
      canonicalPayload: row.canonical_payload,
      sha256Digest: row.sha256_digest,
      createdByUserId: row.created_by_user_id,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      acknowledgements: (row.snapshot_acknowledgements ?? []).map(
        (ack: Record<string, unknown>) => ({
          id: String(ack.id),
          organizationId: String(ack.organization_id),
          projectId: String(ack.project_id),
          snapshotId: String(ack.snapshot_id),
          acknowledgedByUserId: String(ack.acknowledged_by_user_id),
          acknowledgedByName: String(ack.acknowledged_by_name),
          acknowledgedByRole: String(ack.acknowledged_by_role),
          notes: String(ack.notes),
          verifiedDigest: String(ack.verified_digest),
          acknowledgedAt: String(ack.acknowledged_at),
        })
      ),
    }));
  }

  public async getSnapshotById(
    projectId: string,
    snapshotId: string
  ): Promise<HandoverSnapshot | null> {
    const list = await this.listSnapshots(projectId);
    return list.find((s) => s.id === snapshotId) ?? null;
  }

  public async createSnapshot(
    snapshot: HandoverSnapshot
  ): Promise<HandoverSnapshot> {
    const { error } = await this.client.from('handover_snapshots').insert({
      id: snapshot.id,
      organization_id: snapshot.organizationId,
      project_id: snapshot.projectId,
      version_tag: snapshot.versionTag,
      access_tier: snapshot.accessTier,
      canonical_payload: snapshot.canonicalPayload,
      sha256_digest: snapshot.sha256Digest,
      created_by_user_id: snapshot.createdByUserId,
      created_by_name: snapshot.createdByName,
      created_at: snapshot.createdAt,
    });
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return snapshot;
  }

  public async createSnapshotAcknowledgement(
    ack: SnapshotAcknowledgement
  ): Promise<SnapshotAcknowledgement> {
    const { error } = await this.client
      .from('snapshot_acknowledgements')
      .insert({
        id: ack.id,
        organization_id: ack.organizationId,
        project_id: ack.projectId,
        snapshot_id: ack.snapshotId,
        acknowledged_by_user_id: ack.acknowledgedByUserId,
        acknowledged_by_name: ack.acknowledgedByName,
        acknowledged_by_role: ack.acknowledgedByRole,
        notes: ack.notes,
        verified_digest: ack.verifiedDigest,
        acknowledged_at: ack.acknowledgedAt,
      });
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return ack;
  }

  public async listAuditLogs(projectId: string): Promise<AuditLog[]> {
    const { data, error } = await this.client
      .from('audit_logs')
      .select('*')
      .eq('project_id', projectId)
      .order('sequence_number', { ascending: false });
    if (error) throw new Error(`Supabase error: ${error.message}`);
    return (data ?? []).map((row) => ({
      id: row.id,
      sequenceNumber: Number(row.sequence_number),
      organizationId: row.organization_id,
      projectId: row.project_id,
      actorUserId: row.actor_user_id,
      actorDisplayName: row.actor_display_name,
      actorRole: row.actor_role,
      effectiveClearanceTier: row.effective_clearance_tier,
      action: row.action,
      targetEntityType: row.target_entity_type,
      targetEntityId: row.target_entity_id,
      accessTier: row.access_tier,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    }));
  }

  public async appendAuditLog(
    log: Omit<AuditLog, 'sequenceNumber'>
  ): Promise<AuditLog> {
    const existing = await this.listAuditLogs(log.projectId);
    const nextSeq =
      existing.length > 0
        ? Math.max(...existing.map((e) => e.sequenceNumber)) + 1
        : 1;

    const { error } = await this.client.from('audit_logs').insert({
      id: log.id,
      sequence_number: nextSeq,
      organization_id: log.organizationId,
      project_id: log.projectId,
      actor_user_id: log.actorUserId,
      actor_display_name: log.actorDisplayName,
      actor_role: log.actorRole,
      effective_clearance_tier: log.effectiveClearanceTier,
      action: log.action,
      target_entity_type: log.targetEntityType,
      target_entity_id: log.targetEntityId,
      access_tier: log.accessTier,
      metadata: log.metadata,
      created_at: log.createdAt,
    });
    if (error) throw new Error(`Supabase error: ${error.message}`);

    return {
      ...log,
      sequenceNumber: nextSeq,
    };
  }

  public async resetProjectToSeed(_projectId: string): Promise<void> {
    throw new Error(
      'Demo workspace reset is only supported when CHRONICLE_PERSISTENCE_MODE="seed".'
    );
  }
}
