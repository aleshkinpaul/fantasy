// Simple runtime logger — enabled only on localhost to avoid noisy production logs
const enabled = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const logger = {
  enabled,
  debug: (...args: any[]) => { if (enabled) console.log(...args); },
  info: (...args: any[]) => { if (enabled) console.info(...args); },
  warn: (...args: any[]) => { if (enabled) console.warn(...args); },
  error: (...args: any[]) => { if (enabled) console.error(...args); }
}
