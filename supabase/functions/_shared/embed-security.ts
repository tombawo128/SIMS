// Embed origins are public framing policy, not authentication.
// Requests without an Origin header remain fetchable by the public embed token;
// browser framing is constrained by the response's frame-ancestors CSP.
export function normalizeAllowedEmbedOrigins(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const origins = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== 'string') continue;
    try {
      const parsed = new URL(candidate);
      if (parsed.protocol !== 'https:' || parsed.origin !== candidate
        || parsed.username !== '' || parsed.password !== '') continue;
      origins.add(parsed.origin);
    } catch {
      // Ignore malformed persisted values rather than reflecting them into CSP.
    }
  }
  return [...origins];
}

export function isEmbedRequestOriginAllowed(origin: string | null, allowedOrigins: unknown): boolean {
  // Origin is not an authentication factor and is not sent by every valid client.
  // A missing Origin is therefore allowed; the public token and CSP remain the controls.
  if (origin === null) return true;
  return normalizeAllowedEmbedOrigins(allowedOrigins).includes(origin);
}

export function buildEmbedContentSecurityPolicy(allowedOrigins: unknown): string {
  const ancestors = ["'self'", ...normalizeAllowedEmbedOrigins(allowedOrigins)].join(' ');
  return `default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; frame-ancestors ${ancestors}`;
}
