import {
  buildEmbedContentSecurityPolicy,
  isEmbedRequestOriginAllowed,
  normalizeAllowedEmbedOrigins,
} from './embed-security.ts';

Deno.test('embed origin normalization accepts only exact HTTPS origins', () => {
  const origins = normalizeAllowedEmbedOrigins([
    'https://portal.example',
    'https://portal.example',
    'http://insecure.example',
    'https://portal.example/path',
    'https://user:pass@portal.example',
    'https://*.example',
    'https://evil.example; frame-ancestors *',
    null,
    42,
  ]);
  if (JSON.stringify(origins) !== JSON.stringify(['https://portal.example'])) {
    throw new Error(`Unexpected normalized origins: ${JSON.stringify(origins)}`);
  }
});

Deno.test('embed request Origin must exactly match the configured HTTPS origin', () => {
  const allowed = ['https://portal.example'];
  if (!isEmbedRequestOriginAllowed('https://portal.example', allowed)) {
    throw new Error('Expected configured origin to be allowed');
  }
  for (const origin of ['https://sub.portal.example', 'http://portal.example', 'https://attacker.example', '']) {
    if (isEmbedRequestOriginAllowed(origin, allowed)) {
      throw new Error(`Expected origin to be denied: ${origin}`);
    }
  }
});

Deno.test('missing Origin is not treated as authentication and CSP remains restrictive', () => {
  const allowed = ['https://portal.example'];
  if (!isEmbedRequestOriginAllowed(null, allowed)) {
    throw new Error('Public token requests without Origin should remain fetchable');
  }
  const csp = buildEmbedContentSecurityPolicy([
    ...allowed,
    'https://attacker.example; frame-ancestors *',
    'http://insecure.example',
  ]);
  if (csp !== "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; frame-ancestors 'self' https://portal.example") {
    throw new Error(`Unexpected or unsafe embed CSP: ${csp}`);
  }
  if (csp.includes('*') || csp.includes('attacker.example') || csp.includes('insecure.example')) {
    throw new Error('CSP contains an unapproved frame ancestor');
  }
});
