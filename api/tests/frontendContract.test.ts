import fs from 'node:fs';
import path from 'node:path';

// Every endpoint the web client and admin panel call must exist in the API with that
// method. Read from source: app.ts mounts, each router's paths, and the frontends' calls
// through their shared axios instance (`api.get('/...')`) or `new CrudService('/...')`.

const repo = path.join(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(repo, file), 'utf8');

type Route = { method: string; path: string };
const apiRoutes = (): Route[] => {
  const app = read('api/src/app.ts');
  const files = Object.fromEntries([...app.matchAll(/import (\w+) from '\.\/routes\/(\w+)\.js'/g)].map((m) => [m[1], m[2]]));
  const routes: Route[] = [];
  for (const [, mount, variable] of app.matchAll(/app\.use\('(\/api[^']*)',[^)]*?\b(\w+)\)/g)) {
    if (!files[variable]) continue;
    const source = read(`api/src/routes/${files[variable]}.ts`);
    for (const [, method, sub] of source.matchAll(/\b\w+\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)) {
      routes.push({ method, path: sub === '/' ? mount : `${mount}${sub}` });
    }
  }
  for (const [, method, full] of app.matchAll(/app\.(get|post|put|patch|delete)\('([^']+)'/g)) routes.push({ method, path: full });
  return routes;
};

const segments = (p: string) => p.split('/').filter(Boolean);
const PARAM = ':param';
const exists = (routes: Route[], method: string | null, called: string) => {
  const want = segments(called);
  return routes.some((route) => {
    if (method && route.method !== method) return false;
    const have = segments(route.path);
    return have.length === want.length && have.every((s, i) => s.startsWith(':') || want[i] === PARAM || s === want[i]);
  });
};

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(path.join(repo, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(rel);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : [];
  });

// `${id}` and `:id` become a wildcard segment; query strings are not part of the route.
const normalise = (literal: string) => literal.replace(/\$\{[^}]*\}|:\w+/g, PARAM).split('?')[0].replace(/\/$/, '');

type Call = { file: string; method: string | null; path: string };
const frontendCalls = (app: 'client' | 'admin'): Call[] =>
  sourceFiles(`${app}/src`).flatMap((file) => {
    const source = read(file);
    const calls: Call[] = [];
    for (const [, method, , literal] of source.matchAll(/\bapi\s*\.(get|post|put|patch|delete)(?:<[^()]*?>)?\(\s*(['"`])(.*?)\2/gs)) {
      if (literal.startsWith('/')) calls.push({ file, method, path: normalise(literal) });
    }
    for (const [, , literal] of source.matchAll(/new CrudService(?:<[^()]*?>)?\(\s*(['"`])(.*?)\1/g)) {
      calls.push({ file, method: null, path: normalise(literal) });
    }
    // Endpoint constant maps such as `ENDPOINTS = { AUTH_LOGIN: '/auth/login', ... }`.
    for (const [, block] of source.matchAll(/ENDPOINTS\s*=\s*\{([\s\S]*?)\n\s*\};?/g)) {
      for (const [, , literal] of block.matchAll(/:\s*(['"`])(\/[^'"`]*)\1/g)) calls.push({ file, method: null, path: normalise(literal) });
    }
    return calls;
  });

describe('frontend to API contract', () => {
  const routes = apiRoutes();

  it('reads the API routes', () => {
    expect(routes.length).toBeGreaterThan(300);
    expect(exists(routes, 'get', '/api/subscription/status')).toBe(true);
    expect(exists(routes, 'post', '/api/subscriptions/cancel')).toBe(false);
  });

  it.each(['client', 'admin'] as const)('every endpoint the %s calls exists in the API', (app) => {
    const calls = frontendCalls(app);
    expect(calls.length).toBeGreaterThan(10);
    const missing = calls
      .filter((call) => !exists(routes, call.method, `/api${call.path}`))
      .map((call) => `${call.file}: ${call.method?.toUpperCase() ?? 'ANY'} ${call.path}`);
    expect(missing).toEqual([]);
  });
});
