import type { HelmetOptions } from 'helmet';

export function getHelmetOptions(isProduction: boolean): HelmetOptions {
  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Vite's React Refresh preamble is inline in development; production stays self-only.
        scriptSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
        formAction: ["'self'"],
      },
    },
    hsts: isProduction ? { maxAge: 31_536_000, includeSubDomains: true } : false,
  };
}
