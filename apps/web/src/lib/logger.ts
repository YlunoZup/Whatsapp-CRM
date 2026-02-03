/**
 * Environment-aware logger utility
 * Only logs in development mode to avoid polluting production console
 */

const isDev = import.meta.env.DEV;

export const logger = {
  log: (...args: unknown[]) => {
    if (isDev) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (isDev) {
      console.warn(...args);
    }
  },
  error: (...args: unknown[]) => {
    // Always log errors, even in production
    console.error(...args);
  },
  debug: (...args: unknown[]) => {
    if (isDev) {
      console.debug(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (isDev) {
      console.info(...args);
    }
  },
};
