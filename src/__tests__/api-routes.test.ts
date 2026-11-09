import { describe, it, expect, beforeEach } from 'vitest';
import * as healthRoute from '../app/api/v1/health/route';
import * as authSessionRoute from '../app/api/v1/auth/session/route';
import * as projectsRoute from '../app/api/v1/projects/route';
import * as projectDetailRoute from '../app/api/v1/projects/[projectId]/route';
import * as sourcesRoute from '../app/api/v1/projects/[projectId]/sources/route';
import * as githubPrRoute from '../app/api/v1/projects/[projectId]/sources/github-pr/route';
import * as reconstructRoute from '../app/api/v1/projects/[projectId]/reconstruct/route';
import * as verifyRoute from '../app/api/v1/projects/[projectId]/verify/route';
import * as claimsRoute from '../app/api/v1/projects/[projectId]/claims/route';
import * as claimDetailRoute from '../app/api/v1/projects/[projectId]/claims/[claimId]/route';
import * as conflictsRoute from '../app/api/v1/projects/[projectId]/conflicts/route';
import * as conflictResolveRoute from '../app/api/v1/projects/[projectId]/conflicts/[conflictId]/resolve/route';
import * as interviewsRoute from '../app/api/v1/projects/[projectId]/interviews/route';
import * as interviewSubmitRoute from '../app/api/v1/projects/[projectId]/interviews/[interviewId]/submit/route';
import * as graphRoute from '../app/api/v1/projects/[projectId]/graph/route';
import * as contributorsRoute from '../app/api/v1/projects/[projectId]/contributors/route';
import * as auditLogsRoute from '../app/api/v1/projects/[projectId]/audit-logs/route';
import * as snapshotsRoute from '../app/api/v1/projects/[projectId]/snapshots/route';
import * as snapshotVerifyRoute from '../app/api/v1/projects/[projectId]/snapshots/[snapshotId]/verify/route';
import * as snapshotAcknowledgeRoute from '../app/api/v1/projects/[projectId]/snapshots/[snapshotId]/acknowledge/route';
import * as snapshotExportRoute from '../app/api/v1/projects/[projectId]/snapshots/[snapshotId]/export/route';
import * as resetRoute from '../app/api/v1/projects/[projectId]/reset/route';
import { resetRepositorySingleton } from '../infrastructure/database';
import { ClearanceTier, ConflictResolutionOption, SourceType } from '../types';

describe('Next.js API v1 Route Handlers', () => {
  beforeEach(async () => {
    resetRepositorySingleton();
    process.env.CHRONICLE_PERSISTENCE_MODE = 'seed';
    (process.env as any).NODE_ENV = 'test';
    process.env.CHRONICLE_TEST_AUTH_ENABLED = 'true';
  });

  const baseUrl = 'http://localhost:3000';

  const authHeaders = (
    userId = 'usr-ujjwal-maintainer',
    extra: Record<string, string> = {}
  ) => ({
    Authorization: `Bearer chronicle-test-user:${userId}`,
    ...extra,
  });

  it('GET /api/v1/health: returns 200 with service health envelope', async () => {
    const res = await healthRoute.GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.status).toBe('healthy');
    expect(json.data.persistenceMode).toBe('seed');
  });

  it('GET & POST /api/v1/auth/session: manages personas and shadow role preview', async () => {
    // GET initial session with auth headers
    const getReq = new Request(`${baseUrl}/api/v1/auth/session`, {
      headers: authHeaders('usr-ujjwal-maintainer'),
    });
    const getRes = await authSessionRoute.GET(getReq);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.ok).toBe(true);
    expect(getJson.data.session.userId).toBe('usr-ujjwal-maintainer');

    // POST toggle shadow preview to Tier 2
    const postReq = new Request(`${baseUrl}/api/v1/auth/session`, {
      method: 'POST',
      headers: authHeaders('usr-ujjwal-maintainer', {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        projectId: 'proj-core-payments',
        shadowPreviewTier: ClearanceTier.TIER_2_INTERNAL,
      }),
    });
    const postRes = await authSessionRoute.POST(postReq);
    expect(postRes.status).toBe(200);
    const postJson = await postRes.json();
    expect(postJson.ok).toBe(true);
    expect(postJson.data.session.isShadowPreview).toBe(true);
    expect(postJson.data.session.effectiveClearanceTier).toBe(ClearanceTier.TIER_2_INTERNAL);
    expect(postRes.headers.get('Set-Cookie')).toContain('chronicle_shadow_tier');
  });

  it('GET & POST /api/v1/projects: lists authorized projects and creates new project', async () => {
    const getReq = new Request(`${baseUrl}/api/v1/projects`, {
      headers: authHeaders(),
    });
    const getRes = await projectsRoute.GET(getReq);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.ok).toBe(true);
    expect(getJson.data.projects.length).toBeGreaterThan(0);

    const postReq = new Request(`${baseUrl}/api/v1/projects`, {
      method: 'POST',
      headers: authHeaders('usr-ujjwal-maintainer', {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        slug: 'new-service',
        name: 'New Service',
        description: 'New service created via API v1',
        repositoryUrl: 'https://github.com/chronicle-fin/new-service',
        departingLeadHandle: 'ujjwal',
        incomingLeadHandle: 'marcus',
      }),
    });
    const postRes = await projectsRoute.POST(postReq);
    expect(postRes.status).toBe(201);
    const postJson = await postRes.json();
    expect(postJson.ok).toBe(true);
    expect(postJson.data.project.slug).toBe('new-service');
  });

  it('GET & PATCH /api/v1/projects/[projectId]: summary and metadata update', async () => {
    const getReq = new Request(`${baseUrl}/api/v1/projects/proj-core-payments`, {
      headers: authHeaders(),
    });
    const ctx = { params: Promise.resolve({ projectId: 'proj-core-payments' }) };
    const getRes = await projectDetailRoute.GET(getReq, ctx);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.ok).toBe(true);
    expect(getJson.data.project.id).toBe('proj-core-payments');
    expect(getJson.data.metrics.totalSources).toBe(28);

    const patchReq = new Request(`${baseUrl}/api/v1/projects/proj-core-payments`, {
      method: 'PATCH',
      headers: authHeaders('usr-ujjwal-maintainer', {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        name: 'Core Payments Engine v2',
      }),
    });
    const patchRes = await projectDetailRoute.PATCH(patchReq, ctx);
    expect(patchRes.status).toBe(200);
    const patchJson = await patchRes.json();
    expect(patchJson.ok).toBe(true);
    expect(patchJson.data.project.name).toBe('Core Payments Engine v2');
  });

  it('GET & POST /api/v1/projects/[projectId]/sources: lists sources and ingests with secret redaction', async () => {
    const ctx = { params: Promise.resolve({ projectId: 'proj-core-payments' }) };

    // GET sources
    const getReq = new Request(`${baseUrl}/api/v1/projects/proj-core-payments/sources`, {
      headers: authHeaders(),
    });
    const getRes = await sourcesRoute.GET(getReq, ctx);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.ok).toBe(true);
    expect(getJson.data.sources.length).toBe(28);

    // POST ingest source with secret
    const postReq = new Request(`${baseUrl}/api/v1/projects/proj-core-payments/sources`, {
      method: 'POST',
      headers: authHeaders('usr-ujjwal-maintainer', {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        sourceType: SourceType.CUSTOM_NOTE,
        externalRef: 'NOTE-99',
        title: 'Production Incident Postmortem',
        authorHandle: 'ujjwal',
        accessTier: ClearanceTier.TIER_2_INTERNAL,
        rawContent: 'Incident DB url was postgresql://admin:SuperSecretKey99@db.prod:5432/main during outage.',
        modulePaths: ['src/db'],
      }),
    });
    const postRes = await sourcesRoute.POST(postReq, ctx);
    expect(postRes.status).toBe(201);
    const postJson = await postRes.json();
    expect(postJson.ok).toBe(true);
    expect(postJson.data.source.redactedCount).toBe(1);
    expect(postJson.data.source.sanitizedContent).toContain('[REDACTED:CONNECTION_URI]');
  });

  it('POST /api/v1/projects/[projectId]/sources/github-pr: imports GitHub PR with synthetic fallback', async () => {
    const ctx = { params: Promise.resolve({ projectId: 'proj-core-payments' }) };
    const req = new Request(`${baseUrl}/api/v1/projects/proj-core-payments/sources/github-pr`, {
      method: 'POST',
      headers: authHeaders('usr-ujjwal-maintainer', {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        owner: 'chronicle-fin',
        repo: 'core-payments-service',
        pullNumber: 104,
        accessTier: ClearanceTier.TIER_2_INTERNAL,
        syntheticFallbackIfOffline: true,
      }),
    });
    const res = await githubPrRoute.POST(req, ctx);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.source).toBeDefined();
  });

  it('POST /api/v1/projects/[projectId]/reconstruct & verify: deterministic extraction and citation grounding', async () => {
    const ctx = { params: Promise.resolve({ projectId: 'proj-core-payments' }) };

    const recReq = new Request(`${baseUrl}/api/v1/projects/proj-core-payments/reconstruct`, {
      method: 'POST',
      headers: authHeaders('usr-ujjwal-maintainer', {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ useAiEnrichment: false }),
    });
    const recRes = await reconstructRoute.POST(recReq, ctx);
    expect(recRes.status).toBe(200);
    const recJson = await recRes.json();
    expect(recJson.ok).toBe(true);
    expect(recJson.data.mode).toBe('DETERMINISTIC');

    const verReq = new Request(`${baseUrl}/api/v1/projects/proj-core-payments/verify`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const verRes = await verifyRoute.POST(verReq, ctx);
    expect(verRes.status).toBe(200);
    const verJson = await verRes.json();
    expect(verJson.ok).toBe(true);
    expect(verJson.data.verifiedClaimsCount).toBeGreaterThan(0);
  });

  it('GET & PATCH /api/v1/projects/[projectId]/claims: lists and updates claim review status', async () => {
    const ctx = { params: Promise.resolve({ projectId: 'proj-core-payments' }) };
    const getReq = new Request(`${baseUrl}/api/v1/projects/proj-core-payments/claims`, {
      headers: authHeaders(),
    });
    const getRes = await claimsRoute.GET(getReq, ctx);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.ok).toBe(true);
    const claim = getJson.data.claims[0];

    const claimCtx = {
      params: Promise.resolve({
        projectId: 'proj-core-payments',
        claimId: claim.id,
      }),
    };
    const patchReq = new Request(
      `${baseUrl}/api/v1/projects/proj-core-payments/claims/${claim.id}`,
      {
        method: 'PATCH',
        headers: authHeaders('usr-ujjwal-maintainer', {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          verificationStatus: 'HUMAN_APPROVED',
          reason: 'Reviewed and confirmed with departing tech lead.',
        }),
      }
    );
    const patchRes = await claimDetailRoute.PATCH(patchReq, claimCtx);
    expect(patchRes.status).toBe(200);
    const patchJson = await patchRes.json();
    expect(patchJson.ok).toBe(true);
    expect(patchJson.data.claim.verificationStatus).toBe('HUMAN_APPROVED');
  });

  it('GET & POST /api/v1/projects/[projectId]/conflicts: lists and resolves conflict atomically', async () => {
    const ctx = { params: Promise.resolve({ projectId: 'proj-core-payments' }) };
    const getReq = new Request(`${baseUrl}/api/v1/projects/proj-core-payments/conflicts`, {
      headers: authHeaders(),
    });
    const getRes = await conflictsRoute.GET(getReq, ctx);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.ok).toBe(true);
    expect(getJson.data.conflicts.length).toBeGreaterThan(0);

    const openConflict = getJson.data.conflicts.find((c: any) => c.status === 'OPEN');
    expect(openConflict).toBeDefined();

    const resolveCtx = {
      params: Promise.resolve({
        projectId: 'proj-core-payments',
        conflictId: openConflict.id,
      }),
    };
    const resolveReq = new Request(
      `${baseUrl}/api/v1/projects/proj-core-payments/conflicts/${openConflict.id}/resolve`,
      {
        method: 'POST',
        headers: authHeaders('usr-ujjwal-maintainer', {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          resolutionOption: ConflictResolutionOption.CLAIM_B,
          rationale: 'PostgreSQL composite index is required for 100% duplicate charge prevention.',
        }),
      }
    );
    const resolveRes = await conflictResolveRoute.POST(resolveReq, resolveCtx);
    expect(resolveRes.status).toBe(200);
    const resolveJson = await resolveRes.json();
    expect(resolveJson.ok).toBe(true);
    expect(resolveJson.data.conflict.status).toBe('RESOLVED');
  });

  it('GET & POST /api/v1/projects/[projectId]/interviews: lists and submits interview transcript', async () => {
    const ctx = { params: Promise.resolve({ projectId: 'proj-core-payments' }) };
    const getReq = new Request(`${baseUrl}/api/v1/projects/proj-core-payments/interviews`, {
      headers: authHeaders(),
    });
    const getRes = await interviewsRoute.GET(getReq, ctx);
    expect(getRes.status).toBe(200);
    const getJson = await getRes.json();
    expect(getJson.ok).toBe(true);
    const interview = getJson.data.interviews[0];

    const submitCtx = {
      params: Promise.resolve({
        projectId: 'proj-core-payments',
        interviewId: interview.id,
      }),
    };
    const submitReq = new Request(
      `${baseUrl}/api/v1/projects/proj-core-payments/interviews/${interview.id}/submit`,
      {
        method: 'POST',
        headers: authHeaders('usr-ujjwal-maintainer', {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          answerTranscript:
            'We manually trigger reconciliation nightly via cronjob at 03:00 UTC using ledger_drift_audit.sql.',
        }),
      }
    );
    const submitRes = await interviewSubmitRoute.POST(submitReq, submitCtx);
    expect(submitRes.status).toBe(200);
    const submitJson = await submitRes.json();
    expect(submitJson.ok).toBe(true);
    expect(submitJson.data.interview.status).toBe('COMPLETED');
  });

  it('GET /api/v1/projects/[projectId]/graph, contributors, audit-logs', async () => {
    const ctx = { params: Promise.resolve({ projectId: 'proj-core-payments' }) };

    // Graph
    const graphReq = new Request(`${baseUrl}/api/v1/projects/proj-core-payments/graph`, {
      headers: authHeaders(),
    });
    const graphRes = await graphRoute.GET(graphReq, ctx);
    expect(graphRes.status).toBe(200);
    const graphJson = await graphRes.json();
    expect(graphJson.ok).toBe(true);
    expect(graphJson.data.nodes.length).toBeGreaterThan(0);
    expect(graphJson.data.edges.length).toBeGreaterThan(0);

    // Contributors
    const contribReq = new Request(`${baseUrl}/api/v1/projects/proj-core-payments/contributors`, {
      headers: authHeaders(),
    });
    const contribRes = await contributorsRoute.GET(contribReq, ctx);
    expect(contribRes.status).toBe(200);
    const contribJson = await contribRes.json();
    expect(contribJson.ok).toBe(true);
    expect(contribJson.data.contributors.length).toBe(5);

    // Audit Logs
    const auditReq = new Request(`${baseUrl}/api/v1/projects/proj-core-payments/audit-logs`, {
      headers: authHeaders(),
    });
    const auditRes = await auditLogsRoute.GET(auditReq, ctx);
    expect(auditRes.status).toBe(200);
    const auditJson = await auditRes.json();
    expect(auditJson.ok).toBe(true);
    expect(auditJson.data.auditLogs.length).toBeGreaterThan(0);
  });

  it('Snapshot lifecycle: create, verify, acknowledge, export', async () => {
    const ctx = { params: Promise.resolve({ projectId: 'proj-core-payments' }) };

    // 1. Create snapshot
    const createReq = new Request(`${baseUrl}/api/v1/projects/proj-core-payments/snapshots`, {
      method: 'POST',
      headers: authHeaders('usr-ujjwal-maintainer', {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ versionTag: 'v1.0.0-test' }),
    });
    const createRes = await snapshotsRoute.POST(createReq, ctx);
    expect(createRes.status).toBe(201);
    const createJson = await createRes.json();
    expect(createJson.ok).toBe(true);
    const snapshot = createJson.data.snapshot;
    expect(snapshot.sha256Digest).toHaveLength(64);

    const snapCtx = {
      params: Promise.resolve({
        projectId: 'proj-core-payments',
        snapshotId: snapshot.id,
      }),
    };

    // 2. Verify snapshot
    const verifyReq = new Request(
      `${baseUrl}/api/v1/projects/proj-core-payments/snapshots/${snapshot.id}/verify`,
      {
        method: 'POST',
        headers: authHeaders('usr-ujjwal-maintainer', {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({}),
      }
    );
    const verifyRes = await snapshotVerifyRoute.POST(verifyReq, snapCtx);
    expect(verifyRes.status).toBe(200);
    const verifyJson = await verifyRes.json();
    expect(verifyJson.ok).toBe(true);
    expect(verifyJson.data.verification.isIntegrityValid).toBe(true);

    // 3. Acknowledge snapshot
    const ackReq = new Request(
      `${baseUrl}/api/v1/projects/proj-core-payments/snapshots/${snapshot.id}/acknowledge`,
      {
        method: 'POST',
        headers: authHeaders('usr-ujjwal-maintainer', {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          notes: 'Engineering Authority verified all architecture decisions and SHA-256 digest.',
          verifiedDigest: snapshot.sha256Digest,
        }),
      }
    );
    const ackRes = await snapshotAcknowledgeRoute.POST(ackReq, snapCtx);
    expect(ackRes.status).toBe(201);
    const ackJson = await ackRes.json();
    expect(ackJson.ok).toBe(true);

    // 4. Export snapshot (markdown & json)
    const exportMdReq = new Request(
      `${baseUrl}/api/v1/projects/proj-core-payments/snapshots/${snapshot.id}/export?format=markdown`,
      {
        headers: authHeaders(),
      }
    );
    const exportMdRes = await snapshotExportRoute.GET(exportMdReq, snapCtx);
    expect(exportMdRes.status).toBe(200);
    const exportMdJson = await exportMdRes.json();
    expect(exportMdJson.ok).toBe(true);
    expect(exportMdJson.data.content).toContain('CHRONICLE HANDOVER PACKAGE');

    const exportJsonReq = new Request(
      `${baseUrl}/api/v1/projects/proj-core-payments/snapshots/${snapshot.id}/export?format=json`,
      {
        headers: authHeaders(),
      }
    );
    const exportJsonRes = await snapshotExportRoute.GET(exportJsonReq, snapCtx);
    expect(exportJsonRes.status).toBe(200);
    const exportJsonJson = await exportJsonRes.json();
    expect(exportJsonJson.ok).toBe(true);
    expect(exportJsonJson.data.format).toBe('json');
  });

  it('POST /api/v1/projects/[projectId]/reset: resets workspace to 28-artifact baseline', async () => {
    const ctx = { params: Promise.resolve({ projectId: 'proj-core-payments' }) };
    const req = new Request(`${baseUrl}/api/v1/projects/proj-core-payments/reset`, {
      method: 'POST',
      headers: authHeaders('usr-ujjwal-maintainer'),
    });
    const res = await resetRoute.POST(req, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.reset).toBe(true);
    expect(json.data.metrics.totalSources).toBe(28);
  });
});
