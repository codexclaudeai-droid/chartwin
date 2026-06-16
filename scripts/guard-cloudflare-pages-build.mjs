import process from 'node:process';
import { fileURLToPath } from 'node:url';

const BLOCKED_PAGES_HOST_SUFFIX = 'chartwin.pages.dev';
const BLOCKED_PAGES_PROJECTS = new Set(['tradingcore']);

function normalizeHostname(url) {
  if (!url) return '';

  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return String(url).trim().toLowerCase();
  }
}

export function assertCloudflarePagesBuildTarget(env = process.env) {
  if (env.CF_PAGES !== '1') {
    return;
  }

  const pagesUrl = String(env.CF_PAGES_URL || '').trim();
  const pagesHost = normalizeHostname(pagesUrl);
  const pagesProject = String(env.CF_PAGES_PROJECT_NAME || '').trim().toLowerCase();
  const blocksChartwinDomain = pagesHost === BLOCKED_PAGES_HOST_SUFFIX
    || pagesHost.endsWith(`.${BLOCKED_PAGES_HOST_SUFFIX}`);
  const blocksOldProject = BLOCKED_PAGES_PROJECTS.has(pagesProject);

  if (!blocksChartwinDomain && !blocksOldProject) {
    return;
  }

  const target = [
    pagesProject ? `project=${pagesProject}` : '',
    pagesUrl ? `url=${pagesUrl}` : '',
    env.CF_PAGES_BRANCH ? `branch=${env.CF_PAGES_BRANCH}` : '',
    env.CF_PAGES_COMMIT_SHA ? `commit=${env.CF_PAGES_COMMIT_SHA}` : '',
  ].filter(Boolean).join(' ');

  throw new Error(
    `Blocked Cloudflare Pages build for chartwin.pages.dev. ${target}\n`
    + 'This chart engine repository must not publish the old tradingcore Pages project. '
    + 'Deploy production through the full-stack chartwin Worker pipeline instead.',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    assertCloudflarePagesBuildTarget();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
