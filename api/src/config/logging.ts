import 'dotenv/config';

/**
 * Logs are for development. Production keeps errors only: request details,
 * emails and one-time codes must not end up in server logs.
 * Imported first in server.ts so it applies before any other module logs.
 */
export const isDevelopment = process.env.NODE_ENV !== 'production';

if (!isDevelopment) {
  const silent = () => {};
  console.log = silent;
  console.info = silent;
  console.debug = silent;
  console.warn = silent;
}
