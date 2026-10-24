import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prisma } from '@openmusic/db';
import { seedDemoData } from '@openmusic/db/src/seed';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppContext } from '../src/app';
import {
  DEMO_SEED_MARKER,
  curatedMarkerKey,
  runFirstDeployTasks,
  type FirstDeployDeps,
} from '../src/modules/bootstrap/first-deploy';
import type { CuratedAlbum, CuratedImportResult } from '../src/modules/catalog/curated-import';
import { closeTestApp, createTestApp, resetTestState } from './helpers/test-app';

/** SEED_ON_START (docs/07_DEPLOY.md): first-deploy data runs once per database. */
describe('first-deploy tasks', () => {
  let ctx: AppContext;
  const dir = mkdtempSync(path.join(tmpdir(), 'om-first-deploy-'));
  const file = path.join(dir, 'curated.json');
  const contents = JSON.stringify({
    albums: [
      { artist: 'Radiohead', title: 'In Rainbows', year: 2007 },
      { artist: 'Daft Punk', title: 'Random Access Memories' },
    ],
  });
  writeFileSync(file, contents);
  const logger = { info: () => undefined, warn: () => undefined };

  function deps(overrides: Partial<FirstDeployDeps> = {}) {
    const seedDemo = vi.fn(async () => ({ users: 6 }));
    const probeCatalog = vi.fn(async () => undefined);
    const importAlbums = vi.fn(
      async (albums: readonly CuratedAlbum[]): Promise<CuratedImportResult[]> =>
        albums.map((entry) => ({ entry, status: 'imported' }))
    );
    return {
      prisma,
      logger,
      seedDemo,
      probeCatalog,
      importAlbums,
      ...overrides,
    } satisfies FirstDeployDeps;
  }

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestState(ctx);
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  it('imports the curated albums once and skips them on later starts', async () => {
    const first = deps();
    const report = await runFirstDeployTasks(first, {
      catalogExternalEnabled: true,
      curatedFile: file,
    });
    expect(report).toEqual({ demo: 'disabled', catalog: 'done' });
    expect(first.importAlbums).toHaveBeenCalledTimes(1);
    expect(vi.mocked(first.importAlbums).mock.calls[0]?.[0]).toHaveLength(2);
    expect(first.seedDemo).not.toHaveBeenCalled();

    const marker = await prisma.systemMarker.findUniqueOrThrow({
      where: { key: curatedMarkerKey(contents) },
    });
    expect(marker.completedAt).not.toBeNull();
    expect(marker.details).toMatchObject({ imported: 2, failed: 0 });

    const second = deps();
    expect(
      await runFirstDeployTasks(second, { catalogExternalEnabled: true, curatedFile: file })
    ).toEqual({ demo: 'disabled', catalog: 'skipped' });
    expect(second.importAlbums).not.toHaveBeenCalled();
  });

  it('never creates demo accounts without DEMO_PASSWORD', async () => {
    const d = deps();
    await runFirstDeployTasks(d, { catalogExternalEnabled: false, curatedFile: file });
    expect(d.seedDemo).not.toHaveBeenCalled();
    expect(await prisma.systemMarker.count()).toBe(0);
  });

  it('seeds the demo community with DEMO_PASSWORD, then re-imports the real covers', async () => {
    // The catalog was imported before the owner set DEMO_PASSWORD.
    await runFirstDeployTasks(deps(), { catalogExternalEnabled: true, curatedFile: file });

    const d = deps();
    const report = await runFirstDeployTasks(d, {
      demoPassword: 'a-private-demo-password',
      catalogExternalEnabled: true,
      curatedFile: file,
    });
    expect(report).toEqual({ demo: 'done', catalog: 'done' });
    expect(d.seedDemo).toHaveBeenCalledWith('a-private-demo-password');
    expect(d.importAlbums).toHaveBeenCalledTimes(1);

    const again = deps();
    expect(
      await runFirstDeployTasks(again, {
        demoPassword: 'a-private-demo-password',
        catalogExternalEnabled: true,
        curatedFile: file,
      })
    ).toEqual({ demo: 'skipped', catalog: 'skipped' });
    expect(again.seedDemo).not.toHaveBeenCalled();
  });

  it('retries on the next start when Deezer is unreachable or nothing was imported', async () => {
    const offline = deps({
      probeCatalog: vi.fn(async () => {
        throw new Error('fetch failed');
      }),
    });
    expect(
      await runFirstDeployTasks(offline, { catalogExternalEnabled: true, curatedFile: file })
    ).toMatchObject({ catalog: 'failed' });

    const allFailed = deps({
      importAlbums: vi.fn(async (albums: readonly CuratedAlbum[]) =>
        albums.map((entry): CuratedImportResult => ({ entry, status: 'failed', error: 'x' }))
      ),
    });
    expect(
      await runFirstDeployTasks(allFailed, { catalogExternalEnabled: true, curatedFile: file })
    ).toMatchObject({ catalog: 'failed' });

    const ok = deps();
    expect(
      await runFirstDeployTasks(ok, { catalogExternalEnabled: true, curatedFile: file })
    ).toMatchObject({ catalog: 'done' });
  });

  it('does not run a task another instance holds a lease on', async () => {
    await prisma.systemMarker.create({
      data: { key: DEMO_SEED_MARKER, leaseUntil: new Date(Date.now() + 60_000) },
    });
    const d = deps();
    const report = await runFirstDeployTasks(d, {
      demoPassword: 'a-private-demo-password',
      catalogExternalEnabled: false,
      curatedFile: file,
    });
    expect(report.demo).toBe('busy');
    expect(d.seedDemo).not.toHaveBeenCalled();

    // An expired lease (instance died midway) is taken over.
    await prisma.systemMarker.update({
      where: { key: DEMO_SEED_MARKER },
      data: { leaseUntil: new Date(Date.now() - 1_000) },
    });
    const retry = deps();
    expect(
      await runFirstDeployTasks(retry, {
        demoPassword: 'a-private-demo-password',
        catalogExternalEnabled: false,
        curatedFile: file,
      })
    ).toMatchObject({ demo: 'done' });
  });

  it('the real demo seed is idempotent and uses the given password', async () => {
    const password = 'demo-password-for-tests';
    const first = await seedDemoData(prisma, password);
    const second = await seedDemoData(prisma, password);
    expect(second).toEqual(first);
    expect(first.users).toBeGreaterThan(0);

    const login = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'francospagnati@openmusic.test', password },
    });
    expect(login.statusCode).toBe(200);
    const devPassword = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'francospagnati@openmusic.test', password: 'openmusic-dev' },
    });
    expect(devPassword.statusCode).toBe(401);
  }, 60_000);
});
