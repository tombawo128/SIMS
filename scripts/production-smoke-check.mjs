import process from 'node:process';

const baseUrl = process.env.SIMS_BASE_URL || 'https://sims-mocha.vercel.app';
const timeoutMs = 15_000;
const maxAttempts = 4;
class InconclusiveError extends Error {}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getWithRetry(url, label) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'user-agent': 'SIMS-production-smoke-check/1.0' },
      });
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delay = attempt * 1_500;
        console.warn(`[RETRY] ${label}: attempt ${attempt}/${maxAttempts} failed (${error.cause?.code || error.message}); retrying in ${delay}ms`);
        await sleep(delay);
      }
    }
  }
  throw new InconclusiveError(`${label}: network request could not be completed after ${maxAttempts} attempts: ${lastError?.cause?.code || lastError?.message}`);
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match ? (match[1] ?? match[2] ?? match[3] ?? '') : '';
}

function collectAssets(html, pageUrl) {
  const assets = new Map();
  const tags = html.match(/<(?:script|link)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const isScript = /^<script\b/i.test(tag);
    const src = attribute(tag, isScript ? 'src' : 'href');
    if (!src || /^(?:data|blob):/i.test(src)) continue;

    const rel = attribute(tag, 'rel').toLowerCase().split(/\s+/);
    const absoluteUrl = new URL(src, pageUrl);
    const pathname = absoluteUrl.pathname.toLowerCase();
    let kind = null;
    if (isScript || rel.includes('modulepreload') || /\.(?:m?js)$/.test(pathname)) kind = 'JavaScript';
    if (rel.includes('stylesheet') || /\.css$/.test(pathname)) kind = 'CSS';
    if (kind) assets.set(absoluteUrl.href, { url: absoluteUrl.href, kind });
  }
  return [...assets.values()];
}

async function main() {
  const parsedBase = new URL(baseUrl);
  if (!['https:', 'http:'].includes(parsedBase.protocol)) throw new Error('SIMS_BASE_URL must be an HTTP(S) URL');

  console.log(`[INFO] Checking SIMS at ${parsedBase.href}`);
  const pageResponse = await getWithRetry(parsedBase.href, 'Production page');
  if (pageResponse.status !== 200) throw new Error(`Production page returned HTTP ${pageResponse.status}; expected HTTP 200`);

  const contentType = pageResponse.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('text/html')) throw new Error(`Unexpected page content-type: ${contentType || '(missing)'}`);

  const html = await pageResponse.text();
  if (!/\bid=["']root["']/.test(html)) throw new Error('HTTP 200 response does not contain the SIMS application root element');
  if (!/<title[^>]*>[^<]*SIMS[^<]*<\/title>/i.test(html)) throw new Error('HTTP 200 response does not contain the expected SIMS page title');

  const assets = collectAssets(html, pageResponse.url || parsedBase.href);
  const jsAssets = assets.filter((asset) => asset.kind === 'JavaScript');
  const cssAssets = assets.filter((asset) => asset.kind === 'CSS');
  if (jsAssets.length === 0) throw new Error('No JavaScript application assets were referenced by the HTML');
  if (cssAssets.length === 0) throw new Error('No CSS assets were referenced by the HTML');

  console.log(`[PASS] HTML: HTTP 200, content-type ${contentType}, SIMS root and title present`);
  console.log(`[INFO] Found ${jsAssets.length} JavaScript asset(s) and ${cssAssets.length} CSS asset(s)`);

  const results = await Promise.all(assets.map(async (asset) => {
    const response = await getWithRetry(asset.url, `${asset.kind} asset`);
    if (response.status !== 200) throw new Error(`${asset.kind} asset returned HTTP ${response.status}: ${asset.url}`);
    const type = (response.headers.get('content-type') || '').toLowerCase();
    const valid = asset.kind === 'CSS'
      ? type.includes('text/css')
      : type.includes('javascript') || type.includes('ecmascript');
    if (!valid) throw new Error(`${asset.kind} asset has unexpected content-type "${type || '(missing)'}": ${asset.url}`);
    return { kind: asset.kind, status: response.status, url: asset.url, contentType: type };
  }));

  for (const result of results) console.log(`[PASS] ${result.kind}: HTTP ${result.status} (${result.contentType}) ${result.url}`);
  console.log(JSON.stringify({
    result: 'PASS',
    checkedAt: new Date().toISOString(),
    pageUrl: pageResponse.url || parsedBase.href,
    pageStatus: pageResponse.status,
    javascriptAssets: jsAssets.length,
    cssAssets: cssAssets.length,
    assets: results,
    note: 'HTTP and asset delivery checks only; application workflows and backend functionality are not covered.',
  }, null, 2));
}

main().catch((error) => {
  const inconclusive = error instanceof InconclusiveError;
  console.error(`[${inconclusive ? 'INCONCLUSIVE' : 'FAIL'}] ${error.message}`);
  console.error(JSON.stringify({
    result: inconclusive ? 'INCONCLUSIVE' : 'FAIL',
    checkedAt: new Date().toISOString(),
    pageUrl: baseUrl,
    error: error.message,
  }, null, 2));
  process.exitCode = inconclusive ? 2 : 1;
});
