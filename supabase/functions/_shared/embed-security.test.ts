import {
  buildEmbedContentSecurityPolicy,
  isEmbedRequestOriginAllowed,
  normalizeAllowedEmbedOrigins,
  isPostingVisibleToEmbed,
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

Deno.test('company embeds cannot expose another company or unpublished posting', () => {
  const own = { id: 'posting-1', company_id: 'company-a', status: 'published', visibility: 'company' };
  const foreign = { id: 'posting-2', company_id: 'company-b', status: 'published', visibility: 'company' };
  const draft = { id: 'posting-3', company_id: 'company-a', status: 'draft', visibility: 'company' };
  if (!isPostingVisibleToEmbed(own, 'company', 'company-a')) throw new Error('Expected own published posting to be visible');
  if (isPostingVisibleToEmbed(foreign, 'company', 'company-a')) throw new Error('Foreign company posting leaked');
  if (isPostingVisibleToEmbed(draft, 'company', 'company-a')) throw new Error('Unpublished posting leaked');
});

Deno.test('university embeds expose global postings and only that university mapped selections', () => {
  const mapped = new Set(['selected-for-a']);
  const global = { id: 'global', status: 'published', visibility: 'all_universities', company_id: 'company-x' };
  const selectedForA = { id: 'selected-for-a', status: 'published', visibility: 'selected_universities' };
  const selectedForB = { id: 'selected-for-b', status: 'published', visibility: 'selected_universities' };
  const draft = { id: 'draft', status: 'draft', visibility: 'all_universities' };
  if (!isPostingVisibleToEmbed(global, 'university', 'university-a', mapped)) throw new Error('Global posting should be visible');
  if (!isPostingVisibleToEmbed(selectedForA, 'university', 'university-a', mapped)) throw new Error('Mapped selected posting should be visible');
  if (isPostingVisibleToEmbed(selectedForB, 'university', 'university-a', mapped)) throw new Error('Posting selected for another university leaked');
  if (isPostingVisibleToEmbed(draft, 'university', 'university-a', mapped)) throw new Error('Draft posting leaked');
});
