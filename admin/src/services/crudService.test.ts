import { beforeEach, describe, expect, it, vi } from 'vitest';

// A tiny in-memory /roles API behind the mocked axios instance.
const { api, rows } = vi.hoisted(() => {
  const rows = new Map<string, { id: string; name: string; description: string | null }>();
  let next = 1;
  const ok = (data: unknown) => ({ data: { success: true, data } });
  const id = (url: string) => url.split('/').pop()!;
  const api = {
    get: vi.fn(async () => ok([...rows.values()])),
    post: vi.fn(async (_url: string, body: { name: string; description?: string }) => {
      const row = { id: `role-${next++}`, name: body.name, description: body.description ?? null };
      rows.set(row.id, row);
      return ok(row);
    }),
    put: vi.fn(async (url: string, body: object) => {
      const row = rows.get(id(url));
      if (!row) throw { response: { status: 404, data: { message: 'Role not found' } } };
      Object.assign(row, body);
      return ok(row);
    }),
    delete: vi.fn(async (url: string) => {
      rows.delete(id(url));
      return ok(undefined);
    }),
  };
  return { api, rows };
});
vi.mock('@/lib/axios', () => ({ default: api }));

import { CrudService, handleApiError } from './crudService';

const roles = new CrudService<{ id: string; name: string; description: string | null }>('/roles');

beforeEach(() => rows.clear());

describe('admin CRUD through CrudService', () => {
  it('creates, lists, updates and deletes a role', async () => {
    const created = await roles.create({ name: 'editor', description: 'Edits content' });
    expect(api.post).toHaveBeenCalledWith('/roles', { name: 'editor', description: 'Edits content' });

    expect((await roles.getAll()).data.map((r) => r.name)).toEqual(['editor']);

    const updated = await roles.update(created.data.id, { description: 'Edits blog posts' });
    expect(api.put).toHaveBeenCalledWith(`/roles/${created.data.id}`, { description: 'Edits blog posts' });
    expect(updated.data.description).toBe('Edits blog posts');

    await roles.delete(created.data.id);
    expect(api.delete).toHaveBeenCalledWith(`/roles/${created.data.id}`);
    expect((await roles.getAll()).data).toEqual([]);
  });

  it('surfaces the API message when a write fails', async () => {
    const error = await roles.update('missing', { name: 'x' }).catch((e) => e);
    expect(handleApiError(error)).toBe('Role not found');
  });
});
