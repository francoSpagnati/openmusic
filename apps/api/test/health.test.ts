import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AppContext } from '../src/app';
import { closeTestApp, createTestApp } from './helpers/test-app';

describe('GET /health', () => {
  let ctx: AppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  it('reports the service as healthy', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json<{ status: string; timestamp: string; uptime: number }>();
    expect(body.status).toBe('ok');
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('returns 404 for unknown routes', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/does-not-exist' });
    expect(res.statusCode).toBe(404);
  });
});
