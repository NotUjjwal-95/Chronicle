'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  createElement,
} from 'react';
import {
  AuditLog,
  AuthenticatedSession,
  Claim,
  ClaimCategory,
  ClaimVerificationStatus,
  ClearanceTier,
  Conflict,
  ConflictResolutionOption,
  Contributor,
  DependencyGraphPayload,
  ExitInterview,
  HandoverSnapshot,
  PersistenceMode,
  Project,
  ProjectMetrics,
  SourceArtifact,
  SourceType,
} from '../types';
import { SnapshotVerificationReport } from '../domain/engines/snapshot-hasher';

export interface PersonaOption {
  userId: string;
  email: string;
  displayName: string;
  description: string;
}

export interface InspectedEvidenceState {
  claim: Claim;
  citationIndex: number;
  source?: SourceArtifact;
}

export interface ProjectWorkspaceContextValue {
  session: AuthenticatedSession | null;
  availablePersonas: PersonaOption[];
  persistenceMode: PersistenceMode;
  projects: Project[];
  project: Project | null;
  metrics: ProjectMetrics | null;
  sources: SourceArtifact[];
  claims: Claim[];
  conflicts: Conflict[];
  interviews: ExitInterview[];
  contributors: Contributor[];
  graph: DependencyGraphPayload | null;
  snapshots: HandoverSnapshot[];
  auditLogs: AuditLog[];
  isLoading: boolean;
  isMutating: boolean;
  errorBanner: string | null;
  statusBanner: string | null;
  inspectedEvidence: InspectedEvidenceState | null;
  currentPath: string;
  navigate: (path: string) => void;
  clearBanners: () => void;
  openEvidenceDrawer: (claim: Claim, citationIndex?: number) => void;
  closeEvidenceDrawer: () => void;
  refreshWorkspace: (targetProjectId?: string) => Promise<void>;
  switchSessionPersona: (
    userId: string,
    shadowPreviewTier?: ClearanceTier | null
  ) => Promise<void>;
  logout: () => Promise<void>;
  ingestSource: (input: {
    sourceType: SourceType;
    externalRef: string;
    title: string;
    authorHandle: string;
    accessTier: ClearanceTier;
    rawContent: string;
    modulePaths: string[];
  }) => Promise<SourceArtifact | null>;
  importGithubPr: (input: {
    owner: string;
    repo: string;
    pullNumber: number;
    accessTier: ClearanceTier;
  }) => Promise<SourceArtifact | null>;
  runReconstruction: (options: {
    useAiEnrichment: boolean;
    provider?: 'gemini' | 'openai';
    forceSimulateAiFailure?: boolean;
  }) => Promise<void>;
  verifyAllCitations: () => Promise<void>;
  updateClaimStatus: (
    claimId: string,
    verificationStatus: ClaimVerificationStatus,
    reason: string,
    category?: ClaimCategory
  ) => Promise<void>;
  resolveConflict: (
    conflictId: string,
    input: {
      resolutionOption: ConflictResolutionOption;
      rationale: string;
      synthesizedTitle?: string;
      synthesizedSummary?: string;
      synthesizedStanceValue?: string;
      createNotionUpdateNextAction?: boolean;
    }
  ) => Promise<void>;
  submitInterview: (
    interviewId: string,
    answerTranscript: string
  ) => Promise<void>;
  createSnapshot: (versionTag: string) => Promise<HandoverSnapshot | null>;
  verifySnapshotDigest: (
    snapshotId: string,
    expectedDigest?: string
  ) => Promise<SnapshotVerificationReport | null>;
  acknowledgeSnapshotReceipt: (
    snapshotId: string,
    notes: string,
    verifiedDigest: string
  ) => Promise<void>;
  exportSnapshotPackage: (
    snapshotId: string,
    format: 'markdown' | 'json'
  ) => Promise<{
    format: 'markdown' | 'json';
    filename: string;
    content: string;
    sha256Digest: string;
  } | null>;
  updateProjectMetadata: (patch: {
    name?: string;
    description?: string;
    departingLeadHandle?: string;
    incomingLeadHandle?: string;
  }) => Promise<void>;
  resetWorkspaceToSeed: () => Promise<void>;
}

const WorkspaceContext = createContext<ProjectWorkspaceContextValue | null>(
  null
);

export function ProjectWorkspaceProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<AuthenticatedSession | null>(null);
  const [availablePersonas, setAvailablePersonas] = useState<PersonaOption[]>(
    []
  );
  const [persistenceMode, setPersistenceMode] =
    useState<PersistenceMode>('seed');
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [metrics, setMetrics] = useState<ProjectMetrics | null>(null);
  const [sources, setSources] = useState<SourceArtifact[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [interviews, setInterviews] = useState<ExitInterview[]>([]);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [graph, setGraph] = useState<DependencyGraphPayload | null>(null);
  const [snapshots, setSnapshots] = useState<HandoverSnapshot[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isMutating, setIsMutating] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [inspectedEvidence, setInspectedEvidence] =
    useState<InspectedEvidenceState | null>(null);

  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      return p === '/' ? '/projects/proj-core-payments' : p;
    }
    return '/projects/proj-core-payments';
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/projects/proj-core-payments');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((path: string) => {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
  }, []);

  const clearBanners = useCallback(() => {
    setErrorBanner(null);
    setStatusBanner(null);
  }, []);

  const refreshWorkspace = useCallback(async (targetProjectId?: string) => {
    const pid = targetProjectId || 'proj-core-payments';
    try {
      const sessionRes = await fetch('/api/v1/auth/session');
      const sessionEnv = await sessionRes.json();
      if (sessionEnv.ok) {
        setSession(sessionEnv.data.session);
        setAvailablePersonas(sessionEnv.data.availablePersonas || []);
        setPersistenceMode(sessionEnv.meta.persistenceMode || 'seed');
      } else if (sessionRes.status === 401) {
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
          window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
          return;
        }
      }

      const [
        projectsRes,
        summaryRes,
        sourcesRes,
        claimsRes,
        conflictsRes,
        interviewsRes,
        contributorsRes,
        graphRes,
        snapshotsRes,
        auditRes,
      ] = await Promise.all([
        fetch('/api/v1/projects'),
        fetch(`/api/v1/projects/${pid}`),
        fetch(`/api/v1/projects/${pid}/sources`),
        fetch(`/api/v1/projects/${pid}/claims`),
        fetch(`/api/v1/projects/${pid}/conflicts`),
        fetch(`/api/v1/projects/${pid}/interviews`),
        fetch(`/api/v1/projects/${pid}/contributors`),
        fetch(`/api/v1/projects/${pid}/graph`),
        fetch(`/api/v1/projects/${pid}/snapshots`),
        fetch(`/api/v1/projects/${pid}/audit-logs`),
      ]);

      const [
        projectsJson,
        summaryJson,
        sourcesJson,
        claimsJson,
        conflictsJson,
        interviewsJson,
        contributorsJson,
        graphJson,
        snapshotsJson,
        auditJson,
      ] = await Promise.all([
        projectsRes.json(),
        summaryRes.json(),
        sourcesRes.json(),
        claimsRes.json(),
        conflictsRes.json(),
        interviewsRes.json(),
        contributorsRes.json(),
        graphRes.json(),
        snapshotsRes.json(),
        auditRes.json(),
      ]);

      if (projectsJson.ok) setProjects(projectsJson.data.projects);
      if (summaryJson.ok) {
        setProject(summaryJson.data.project);
        setMetrics(summaryJson.data.metrics);
      }
      if (sourcesJson.ok) setSources(sourcesJson.data.sources);
      if (claimsJson.ok) setClaims(claimsJson.data.claims);
      if (conflictsJson.ok) setConflicts(conflictsJson.data.conflicts);
      if (interviewsJson.ok) setInterviews(interviewsJson.data.interviews);
      if (contributorsJson.ok) setContributors(contributorsJson.data.contributors);
      if (graphJson.ok) setGraph(graphJson.data);
      if (snapshotsJson.ok) setSnapshots(snapshotsJson.data.snapshots);
      if (auditJson.ok) {
        setAuditLogs(auditJson.data.auditLogs);
      } else {
        setAuditLogs([]);
      }
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Failed to load workspace data'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshWorkspace('proj-core-payments');
  }, [refreshWorkspace]);

  const openEvidenceDrawer = useCallback(
    (claim: Claim, citationIndex = 0) => {
      const citation = claim.citations[citationIndex];
      const matchedSource = citation
        ? sources.find((s) => s.id === citation.sourceId)
        : undefined;
      setInspectedEvidence({
        claim,
        citationIndex,
        source: matchedSource,
      });
    },
    [sources]
  );

  const closeEvidenceDrawer = useCallback(() => {
    setInspectedEvidence(null);
  }, []);

  const switchSessionPersona = useCallback(
    async (_userId: string, shadowPreviewTier?: ClearanceTier | null) => {
      setIsMutating(true);
      clearBanners();
      try {
        const res = await fetch('/api/v1/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project?.id || 'proj-core-payments',
            shadowPreviewTier: shadowPreviewTier ?? null,
          }),
        });
        const env = await res.json();
        if (!env.ok) {
          throw new Error(env.error?.message || 'Failed to toggle shadow preview');
        }
        setSession(env.data.session);
        setInspectedEvidence(null);
        await refreshWorkspace(project?.id || 'proj-core-payments');
        setStatusBanner(
          env.data.session.isShadowPreview
            ? `Shadow Role Preview active: viewing strictly read-only Tier ${env.data.session.effectiveClearanceTier} scope.`
            : `Shadow Role Preview deactivated. Restored full Tier ${env.data.session.effectiveClearanceTier} view.`
        );
      } catch (err) {
        setErrorBanner(
          err instanceof Error ? err.message : 'Shadow preview update failed'
        );
      } finally {
        setIsMutating(false);
      }
    },
    [project?.id, refreshWorkspace, clearBanners]
  );

  const logout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } finally {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  }, []);

  const ingestSource = useCallback(
    async (input: {
      sourceType: SourceType;
      externalRef: string;
      title: string;
      authorHandle: string;
      accessTier: ClearanceTier;
      rawContent: string;
      modulePaths: string[];
    }): Promise<SourceArtifact | null> => {
      const pid = project?.id || 'proj-core-payments';
      setIsMutating(true);
      clearBanners();
      try {
        const res = await fetch(`/api/v1/projects/${pid}/sources`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const env = await res.json();
        if (!env.ok) {
          throw new Error(env.error?.message || 'Source ingestion failed');
        }
        await refreshWorkspace(pid);
        const created: SourceArtifact = env.data.source;
        setStatusBanner(
          `Ingested artifact ${created.externalRef}. SecretRedactor sanitized ${created.redactedCount} secret pattern(s).`
        );
        return created;
      } catch (err) {
        setErrorBanner(
          err instanceof Error ? err.message : 'Source ingestion failed'
        );
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [project?.id, refreshWorkspace, clearBanners]
  );

  const importGithubPr = useCallback(
    async (input: {
      owner: string;
      repo: string;
      pullNumber: number;
      accessTier: ClearanceTier;
    }): Promise<SourceArtifact | null> => {
      const pid = project?.id || 'proj-core-payments';
      setIsMutating(true);
      clearBanners();
      try {
        const res = await fetch(`/api/v1/projects/${pid}/sources/github-pr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const env = await res.json();
        if (!env.ok) {
          throw new Error(env.error?.message || 'GitHub PR import failed');
        }
        await refreshWorkspace(pid);
        const created: SourceArtifact = env.data.source;
        setStatusBanner(
          `Imported GitHub PR ${created.externalRef} (${env.data.importedVia}) with ${created.redactedCount} secret(s) redacted.`
        );
        return created;
      } catch (err) {
        setErrorBanner(
          err instanceof Error ? err.message : 'GitHub PR import failed'
        );
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [project?.id, refreshWorkspace, clearBanners]
  );

  const runReconstruction = useCallback(
    async (options: {
      useAiEnrichment: boolean;
      provider?: 'gemini' | 'openai';
      forceSimulateAiFailure?: boolean;
    }) => {
      const pid = project?.id || 'proj-core-payments';
      setIsMutating(true);
      clearBanners();
      try {
        const res = await fetch(`/api/v1/projects/${pid}/reconstruct`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options),
        });
        const env = await res.json();
        if (!env.ok) {
          throw new Error(env.error?.message || 'Reconstruction failed');
        }
        await refreshWorkspace(pid);
        const result = env.data;
        setStatusBanner(
          result.mode === 'AI_FALLBACK'
            ? `Reconstruction completed in AI_FALLBACK mode (Reason: ${result.fallbackReason}). Deterministic engine grounded ${result.claimsCount} claims.`
            : `Reconstruction completed in ${result.mode} mode: ${result.claimsCount} claims (${result.verifiedCount} verified, ${result.conflictsCount} conflicts).`
        );
      } catch (err) {
        setErrorBanner(
          err instanceof Error ? err.message : 'Reconstruction failed'
        );
      } finally {
        setIsMutating(false);
      }
    },
    [project?.id, refreshWorkspace, clearBanners]
  );

  const verifyAllCitations = useCallback(async () => {
    const pid = project?.id || 'proj-core-payments';
    setIsMutating(true);
    clearBanners();
    try {
      const res = await fetch(`/api/v1/projects/${pid}/verify`, {
        method: 'POST',
      });
      const env = await res.json();
      if (!env.ok) {
        throw new Error(env.error?.message || 'Citation verification failed');
      }
      await refreshWorkspace(pid);
      setStatusBanner(
        `CitationGrounder verified ${env.data.verifiedClaimsCount} claims against exact sanitized character offsets (${env.data.missingEvidenceCount} missing evidence).`
      );
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Citation verification failed'
      );
    } finally {
      setIsMutating(false);
    }
  }, [project?.id, refreshWorkspace, clearBanners]);

  const updateClaimStatus = useCallback(
    async (
      claimId: string,
      verificationStatus: ClaimVerificationStatus,
      reason: string,
      category?: ClaimCategory
    ) => {
      const pid = project?.id || 'proj-core-payments';
      setIsMutating(true);
      clearBanners();
      try {
        const res = await fetch(`/api/v1/projects/${pid}/claims/${claimId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verificationStatus, reason, category }),
        });
        const env = await res.json();
        if (!env.ok) {
          throw new Error(env.error?.message || 'Claim status update failed');
        }
        await refreshWorkspace(pid);
        setStatusBanner(
          `Updated claim ${claimId} state to ${verificationStatus}.`
        );
      } catch (err) {
        setErrorBanner(
          err instanceof Error ? err.message : 'Claim status update failed'
        );
      } finally {
        setIsMutating(false);
      }
    },
    [project?.id, refreshWorkspace, clearBanners]
  );

  const resolveConflict = useCallback(
    async (
      conflictId: string,
      input: {
        resolutionOption: ConflictResolutionOption;
        rationale: string;
        synthesizedTitle?: string;
        synthesizedSummary?: string;
        synthesizedStanceValue?: string;
        createNotionUpdateNextAction?: boolean;
      }
    ) => {
      const pid = project?.id || 'proj-core-payments';
      setIsMutating(true);
      clearBanners();
      try {
        const res = await fetch(
          `/api/v1/projects/${pid}/conflicts/${conflictId}/resolve`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
          }
        );
        const env = await res.json();
        if (!env.ok) {
          throw new Error(env.error?.message || 'Conflict resolution failed');
        }
        await refreshWorkspace(pid);
        setStatusBanner(
          `Atomically resolved conflict ${conflictId} via ${input.resolutionOption}. Winning claim approved and losing claim preserved as SUPERSEDED.`
        );
      } catch (err) {
        setErrorBanner(
          err instanceof Error ? err.message : 'Conflict resolution failed'
        );
      } finally {
        setIsMutating(false);
      }
    },
    [project?.id, refreshWorkspace, clearBanners]
  );

  const submitInterview = useCallback(
    async (interviewId: string, answerTranscript: string) => {
      const pid = project?.id || 'proj-core-payments';
      setIsMutating(true);
      clearBanners();
      try {
        const res = await fetch(
          `/api/v1/projects/${pid}/interviews/${interviewId}/submit`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answerTranscript }),
          }
        );
        const env = await res.json();
        if (!env.ok) {
          throw new Error(env.error?.message || 'Interview submission failed');
        }
        await refreshWorkspace(pid);
        setStatusBanner(
          `Completed exit interview ${interviewId} and grounded ${env.data.generatedClaims.length} human-approved handover claim(s).`
        );
      } catch (err) {
        setErrorBanner(
          err instanceof Error ? err.message : 'Interview submission failed'
        );
      } finally {
        setIsMutating(false);
      }
    },
    [project?.id, refreshWorkspace, clearBanners]
  );

  const createSnapshot = useCallback(
    async (versionTag: string): Promise<HandoverSnapshot | null> => {
      const pid = project?.id || 'proj-core-payments';
      setIsMutating(true);
      clearBanners();
      try {
        const res = await fetch(`/api/v1/projects/${pid}/snapshots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ versionTag }),
        });
        const env = await res.json();
        if (!env.ok) {
          throw new Error(env.error?.message || 'Snapshot creation failed');
        }
        await refreshWorkspace(pid);
        const snap: HandoverSnapshot = env.data.snapshot;
        setStatusBanner(
          `Locked immutable handover snapshot ${snap.versionTag} with SHA-256 digest ${snap.sha256Digest.slice(0, 16)}...`
        );
        return snap;
      } catch (err) {
        setErrorBanner(
          err instanceof Error ? err.message : 'Snapshot creation failed'
        );
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [project?.id, refreshWorkspace, clearBanners]
  );

  const verifySnapshotDigest = useCallback(
    async (
      snapshotId: string,
      expectedDigest?: string
    ): Promise<SnapshotVerificationReport | null> => {
      const pid = project?.id || 'proj-core-payments';
      setIsMutating(true);
      clearBanners();
      try {
        const res = await fetch(
          `/api/v1/projects/${pid}/snapshots/${snapshotId}/verify`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expectedDigest ? { expectedDigest } : {}),
          }
        );
        const env = await res.json();
        if (!env.ok) {
          throw new Error(env.error?.message || 'Snapshot verification failed');
        }
        await refreshWorkspace(pid);
        const report: SnapshotVerificationReport = env.data.verification;
        setStatusBanner(
          report.isIntegrityValid
            ? `SHA-256 Integrity Verified (${report.recomputedDigest.slice(0, 20)}... matches canonical payload).`
            : `SHA-256 Digest Mismatch detected for snapshot ${report.versionTag}!`
        );
        return report;
      } catch (err) {
        setErrorBanner(
          err instanceof Error ? err.message : 'Snapshot verification failed'
        );
        return null;
      } finally {
        setIsMutating(false);
      }
    },
    [project?.id, refreshWorkspace, clearBanners]
  );

  const acknowledgeSnapshotReceipt = useCallback(
    async (snapshotId: string, notes: string, verifiedDigest: string) => {
      const pid = project?.id || 'proj-core-payments';
      setIsMutating(true);
      clearBanners();
      try {
        const res = await fetch(
          `/api/v1/projects/${pid}/snapshots/${snapshotId}/acknowledge`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes, verifiedDigest }),
          }
        );
        const env = await res.json();
        if (!env.ok) {
          throw new Error(
            env.error?.message || 'Snapshot acknowledgement failed'
          );
        }
        await refreshWorkspace(pid);
        setStatusBanner(
          `Recorded cryptographic receipt acknowledgement by ${env.data.acknowledgement.acknowledgedByName}.`
        );
      } catch (err) {
        setErrorBanner(
          err instanceof Error
            ? err.message
            : 'Snapshot acknowledgement failed'
        );
      } finally {
        setIsMutating(false);
      }
    },
    [project?.id, refreshWorkspace, clearBanners]
  );

  const exportSnapshotPackage = useCallback(
    async (snapshotId: string, format: 'markdown' | 'json') => {
      const pid = project?.id || 'proj-core-payments';
      clearBanners();
      try {
        const res = await fetch(
          `/api/v1/projects/${pid}/snapshots/${snapshotId}/export?format=${format}`
        );
        const env = await res.json();
        if (!env.ok) {
          throw new Error(env.error?.message || 'Snapshot export failed');
        }
        await refreshWorkspace(pid);
        setStatusBanner(
          `Exported ${env.data.filename} filtered for effective clearance Tier ${session?.effectiveClearanceTier}.`
        );
        return env.data;
      } catch (err) {
        setErrorBanner(
          err instanceof Error ? err.message : 'Snapshot export failed'
        );
        return null;
      }
    },
    [project?.id, refreshWorkspace, clearBanners, session?.effectiveClearanceTier]
  );

  const updateProjectMetadata = useCallback(
    async (patch: {
      name?: string;
      description?: string;
      departingLeadHandle?: string;
      incomingLeadHandle?: string;
    }) => {
      const pid = project?.id || 'proj-core-payments';
      setIsMutating(true);
      clearBanners();
      try {
        const res = await fetch(`/api/v1/projects/${pid}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        const env = await res.json();
        if (!env.ok) {
          throw new Error(env.error?.message || 'Project update failed');
        }
        await refreshWorkspace(pid);
        setStatusBanner('Updated project governance settings.');
      } catch (err) {
        setErrorBanner(
          err instanceof Error ? err.message : 'Project update failed'
        );
      } finally {
        setIsMutating(false);
      }
    },
    [project?.id, refreshWorkspace, clearBanners]
  );

  const resetWorkspaceToSeed = useCallback(async () => {
    const pid = project?.id || 'proj-core-payments';
    setIsMutating(true);
    clearBanners();
    try {
      const res = await fetch(`/api/v1/projects/${pid}/reset`, {
        method: 'POST',
      });
      const env = await res.json();
      if (!env.ok) {
        throw new Error(env.error?.message || 'Workspace reset failed');
      }
      setInspectedEvidence(null);
      await refreshWorkspace(pid);
      setStatusBanner(
        'Reset demonstration workspace to deterministic 28-artifact Core-Payments-Service baseline.'
      );
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Workspace reset failed'
      );
    } finally {
      setIsMutating(false);
    }
  }, [project?.id, refreshWorkspace, clearBanners]);

  return createElement(
    WorkspaceContext.Provider,
    {
      value: {
        session,
        availablePersonas,
        persistenceMode,
        projects,
        project,
        metrics,
        sources,
        claims,
        conflicts,
        interviews,
        contributors,
        graph,
        snapshots,
        auditLogs,
        isLoading,
        isMutating,
        errorBanner,
        statusBanner,
        inspectedEvidence,
        currentPath,
        navigate,
        clearBanners,
        openEvidenceDrawer,
        closeEvidenceDrawer,
        refreshWorkspace,
        switchSessionPersona,
        logout,
        ingestSource,
        importGithubPr,
        runReconstruction,
        verifyAllCitations,
        updateClaimStatus,
        resolveConflict,
        submitInterview,
        createSnapshot,
        verifySnapshotDigest,
        acknowledgeSnapshotReceipt,
        exportSnapshotPackage,
        updateProjectMetadata,
        resetWorkspaceToSeed,
      },
    },
    children
  );
}

export function useProjectWorkspace(): ProjectWorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error(
      'useProjectWorkspace must be used inside ProjectWorkspaceProvider'
    );
  }
  return ctx;
}
