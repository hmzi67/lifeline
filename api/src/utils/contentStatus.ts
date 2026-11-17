/** Any Express request (typed routes included); only the detectAdmin flag is read. */
type Viewer = object;

/**
 * Diet plans, exercise plans and exercises are either drafts (made by the AI generator,
 * seen only by admins until one publishes them) or published (visible in the app).
 */
export const CONTENT_STATUS = {
  draft: 'draft',
  published: 'published',
} as const;

export type ContentStatus = (typeof CONTENT_STATUS)[keyof typeof CONTENT_STATUS];

/** Prisma `where` fragment for rows the app may show. */
export const PUBLISHED_ONLY = { status: CONTENT_STATUS.published };

/** Set by the detectAdmin middleware when the request carries a valid admin token. */
export const isAdminViewer = (req: Viewer): boolean => (req as { viewerIsAdmin?: boolean }).viewerIsAdmin === true;

/** Prisma `where` fragment for a list endpoint: admins see drafts too, everyone else only published rows. */
export const visibleTo = (req: Viewer) => (isAdminViewer(req) ? {} : PUBLISHED_ONLY);

/** Whether this requester may see one row (for get-by-id endpoints). */
export const canSee = (req: Viewer, row: { status?: string | null }) =>
  isAdminViewer(req) || row.status === CONTENT_STATUS.published;

/** Whether a row can be used by an app user (started, favourited, added to a challenge). */
export const isPublished = (row: { status?: string | null } | null | undefined): boolean =>
  row?.status === CONTENT_STATUS.published;
