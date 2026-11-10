/** No list endpoint returns more rows than this in one response, whatever the client asks. */
export const MAX_PAGE_SIZE = 100;

type PageQuery = { limit?: unknown; cursor?: unknown };

/** The client's `limit`, clamped to 1..MAX_PAGE_SIZE; `fallback` when absent or invalid. */
export const pageSize = (value: unknown, fallback = MAX_PAGE_SIZE) =>
  Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(String(value ?? ''), 10) || fallback));

/**
 * findMany arguments for cursor paging with `?limit=&cursor=`. One extra row is fetched to
 * tell whether another page exists. The query's orderBy must end with a unique column (id).
 */
export const cursorArgs = (query: object) => {
  const { limit, cursor: rawCursor } = query as PageQuery;
  const take = pageSize(limit);
  const cursor = typeof rawCursor === 'string' && rawCursor ? rawCursor : undefined;
  return { take: take + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) };
};

/** Splits the extra row off a cursorArgs result: the page, and the cursor for the next one. */
export const cursorPage = <Row extends { id: string }>(rows: Row[], query: object) => {
  const take = pageSize((query as PageQuery).limit);
  return { items: rows.slice(0, take), nextCursor: rows.length > take ? rows[take - 1].id : null };
};
