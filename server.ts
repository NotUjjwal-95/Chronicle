import 'dotenv/config';
import express, { Request as ExpressRequest, Response as ExpressResponse } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import * as authSessionRoute from './src/app/api/v1/auth/session/route';
import * as healthRoute from './src/app/api/v1/health/route';
import * as projectsRoute from './src/app/api/v1/projects/route';
import * as projectDetailRoute from './src/app/api/v1/projects/[projectId]/route';
import * as sourcesRoute from './src/app/api/v1/projects/[projectId]/sources/route';
import * as githubPrRoute from './src/app/api/v1/projects/[projectId]/sources/github-pr/route';
import * as reconstructRoute from './src/app/api/v1/projects/[projectId]/reconstruct/route';
import * as verifyRoute from './src/app/api/v1/projects/[projectId]/verify/route';
import * as claimsRoute from './src/app/api/v1/projects/[projectId]/claims/route';
import * as claimDetailRoute from './src/app/api/v1/projects/[projectId]/claims/[claimId]/route';
import * as conflictsRoute from './src/app/api/v1/projects/[projectId]/conflicts/route';
import * as conflictResolveRoute from './src/app/api/v1/projects/[projectId]/conflicts/[conflictId]/resolve/route';
import * as interviewsRoute from './src/app/api/v1/projects/[projectId]/interviews/route';
import * as interviewSubmitRoute from './src/app/api/v1/projects/[projectId]/interviews/[interviewId]/submit/route';
import * as graphRoute from './src/app/api/v1/projects/[projectId]/graph/route';
import * as contributorsRoute from './src/app/api/v1/projects/[projectId]/contributors/route';
import * as auditLogsRoute from './src/app/api/v1/projects/[projectId]/audit-logs/route';
import * as snapshotsRoute from './src/app/api/v1/projects/[projectId]/snapshots/route';
import * as snapshotVerifyRoute from './src/app/api/v1/projects/[projectId]/snapshots/[snapshotId]/verify/route';
import * as snapshotAcknowledgeRoute from './src/app/api/v1/projects/[projectId]/snapshots/[snapshotId]/acknowledge/route';
import * as snapshotExportRoute from './src/app/api/v1/projects/[projectId]/snapshots/[snapshotId]/export/route';
import * as resetRoute from './src/app/api/v1/projects/[projectId]/reset/route';
import { checkRateLimit, RouteContext } from './src/lib/route-helper';
import { buildErrorEnvelope } from './src/lib/api-response';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type WebRouteHandler = (req: Request, ctx: RouteContext) => Promise<Response>;

function adaptRoute(handler: WebRouteHandler) {
  return async (req: ExpressRequest, res: ExpressResponse) => {
    try {
      const clientIp = req.ip || '127.0.0.1';
      if (!checkRateLimit(`${clientIp}:${req.method}`)) {
        res
          .status(429)
          .json(buildErrorEnvelope('RATE_LIMITED', 'Rate limit exceeded'));
        return;
      }

      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      const fullUrl = `${protocol}://${host}${req.originalUrl}`;

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (typeof v === 'string') {
          headers.set(k, v);
        } else if (Array.isArray(v)) {
          headers.set(k, v.join(', '));
        }
      }

      const hasBody =
        req.method !== 'GET' &&
        req.method !== 'HEAD' &&
        req.body !== undefined &&
        Object.keys(req.body).length > 0;

      const webReq = new Request(fullUrl, {
        method: req.method,
        headers,
        body: hasBody ? JSON.stringify(req.body) : undefined,
      });

      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(req.params)) {
        params[k] = String(v);
      }

      const webRes = await handler(webReq, { params });
      res.status(webRes.status);

      webRes.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      const text = await webRes.text();
      res.send(text);
    } catch (err) {
      res
        .status(500)
        .json(
          buildErrorEnvelope(
            'INTERNAL_ERROR',
            err instanceof Error ? err.message : 'Internal server error'
          )
        );
    }
  };
}

export function createApiServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // API v1 Endpoint Inventory (Section 10)
  app.get('/api/v1/auth/session', adaptRoute((req) => authSessionRoute.GET(req)));
  app.post('/api/v1/auth/session', adaptRoute((req) => authSessionRoute.POST(req)));
  app.get('/api/v1/health', adaptRoute(() => healthRoute.GET()));

  app.get('/api/v1/projects', adaptRoute((req) => projectsRoute.GET(req)));
  app.post('/api/v1/projects', adaptRoute((req) => projectsRoute.POST(req)));

  app.get('/api/v1/projects/:projectId', adaptRoute(projectDetailRoute.GET));
  app.patch('/api/v1/projects/:projectId', adaptRoute(projectDetailRoute.PATCH));

  app.get('/api/v1/projects/:projectId/sources', adaptRoute(sourcesRoute.GET));
  app.post('/api/v1/projects/:projectId/sources', adaptRoute(sourcesRoute.POST));
  app.post(
    '/api/v1/projects/:projectId/sources/github-pr',
    adaptRoute(githubPrRoute.POST)
  );

  app.post(
    '/api/v1/projects/:projectId/reconstruct',
    adaptRoute(reconstructRoute.POST)
  );
  app.post('/api/v1/projects/:projectId/verify', adaptRoute(verifyRoute.POST));

  app.get('/api/v1/projects/:projectId/claims', adaptRoute(claimsRoute.GET));
  app.patch(
    '/api/v1/projects/:projectId/claims/:claimId',
    adaptRoute(claimDetailRoute.PATCH)
  );

  app.get(
    '/api/v1/projects/:projectId/conflicts',
    adaptRoute(conflictsRoute.GET)
  );
  app.post(
    '/api/v1/projects/:projectId/conflicts/:conflictId/resolve',
    adaptRoute(conflictResolveRoute.POST)
  );

  app.get(
    '/api/v1/projects/:projectId/interviews',
    adaptRoute(interviewsRoute.GET)
  );
  app.post(
    '/api/v1/projects/:projectId/interviews/:interviewId/submit',
    adaptRoute(interviewSubmitRoute.POST)
  );

  app.get('/api/v1/projects/:projectId/graph', adaptRoute(graphRoute.GET));
  app.get(
    '/api/v1/projects/:projectId/contributors',
    adaptRoute(contributorsRoute.GET)
  );
  app.get(
    '/api/v1/projects/:projectId/audit-logs',
    adaptRoute(auditLogsRoute.GET)
  );

  app.get(
    '/api/v1/projects/:projectId/snapshots',
    adaptRoute(snapshotsRoute.GET)
  );
  app.post(
    '/api/v1/projects/:projectId/snapshots',
    adaptRoute(snapshotsRoute.POST)
  );
  app.post(
    '/api/v1/projects/:projectId/snapshots/:snapshotId/verify',
    adaptRoute(snapshotVerifyRoute.POST)
  );
  app.post(
    '/api/v1/projects/:projectId/snapshots/:snapshotId/acknowledge',
    adaptRoute(snapshotAcknowledgeRoute.POST)
  );
  app.get(
    '/api/v1/projects/:projectId/snapshots/:snapshotId/export',
    adaptRoute(snapshotExportRoute.GET)
  );

  app.post('/api/v1/projects/:projectId/reset', adaptRoute(resetRoute.POST));

  return app;
}

async function startServer() {
  const app = createApiServer();
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Chronicle v1.0 server listening on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.VITEST !== 'true') {
  startServer();
}
