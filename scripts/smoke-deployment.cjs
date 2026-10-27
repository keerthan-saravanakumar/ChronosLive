const fs = require('node:fs/promises');
const path = require('node:path');
const { runWorkflows } = require('./smoke-workflows.cjs');

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function validateOrigin(value, local) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Supply both --api and --app as complete origins.');
  }

  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  ensure(value === url.origin && !url.username && !url.password, 'Origins cannot contain credentials, paths, queries or trailing slashes.');
  ensure(
    local ? loopback && url.protocol === 'http:' : url.protocol === 'https:' && !loopback && !url.hostname.endsWith('.invalid'),
    local ? '--local only accepts HTTP loopback origins.' : 'Deployment checks require real HTTPS origins; use --local for local verification.'
  );

  return url.origin;
}

function createChecks(logger = () => {}) {
  const checks = [];
  const step = async (name, action) => {
    try {
      const result = await action();
      checks.push({ name, status: 'passed' });
      logger('PASS ' + name);
      return result;
    } catch (error) {
      checks.push({ name, status: 'failed', detail: error.message });
      logger('FAIL ' + name + ': ' + error.message);
      throw error;
    }
  };
  return { checks, step };
}

function createApi(apiOrigin, appOrigin, timeoutMs = 15000) {
  return async (route, { method = 'GET', account, body, status = 200, code, timeout = timeoutMs } = {}) => {
    const response = await fetch(apiOrigin + '/api' + route, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(timeout),
      headers: {
        Origin: appOrigin,
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(account && { Authorization: 'Bearer ' + account.token }),
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(method + ' ' + route + ' did not return JSON (HTTP ' + response.status + ').');
    }

    const expected = Array.isArray(status) ? status : [status];
    const safeCode = /^[A-Z_]+$/.test(result.error?.code || '') ? result.error.code : 'UNKNOWN';

    ensure(expected.includes(response.status), method + ' ' + route + ' returned HTTP ' + response.status + ' (' + safeCode + '), expected ' + expected.join('/'));
    ensure(typeof result.success === 'boolean' && result.success === response.ok, method + ' ' + route + ' returned an inconsistent response envelope.');
    if (code) {
      ensure(result.error?.code === code, method + ' ' + route + ' did not return ' + code + '.');
    }

    // Never log response bodies: authentication responses contain bearer tokens.
    return { ...result, response };
  };
}

async function verifyApi({ apiOrigin, appOrigin, api, step }) {
  await step('API readiness and security headers', async () => {
    const result = await api('/health', { timeout: 60000 });
    ensure(result.data?.status === 'ok' && result.data?.database === 'connected', 'The API is not connected to its database.');
    ensure(result.response.headers.get('cache-control') === 'no-store', 'Health responses must not be cached.');
    ensure(result.response.headers.get('x-content-type-options') === 'nosniff', 'API security headers are missing.');
  });

  await step('Exact frontend CORS origin and protected API', async () => {
    for (const origin of [appOrigin, 'https://smoke-untrusted.invalid']) {
      const response = await fetch(apiOrigin + '/api/services', {
        method: 'OPTIONS',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'authorization,content-type',
        },
      });

      ensure(response.status === 204 && response.headers.get('access-control-allow-origin') === appOrigin, 'CORS does not restrict requests to the supplied frontend origin.');
      const allowed = response.headers.get('access-control-allow-headers')?.toLowerCase() || '';
      ensure(allowed.includes('authorization') && allowed.includes('content-type'), 'CORS rejects authenticated JSON requests.');
    }

    await api('/auth/me', { status: 401 });
  });
}

async function verifyFrontend({ apiOrigin, appOrigin, local, step }) {
  await step(local ? 'Local frontend and SPA deep links (hosting headers excluded)' : 'Frontend CSP, assets and SPA deep links', async () => {
    let entry;

    for (const route of ['/', '/bookings', '/organizer']) {
      const response = await fetch(appOrigin + route, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      ensure(response.status === 200 && response.headers.get('content-type')?.includes('text/html'), 'Frontend route ' + route + ' did not return HTML.');

      const html = await response.text();
      const script = html.match(/<script\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
      ensure(/id=["']root["']/.test(html) && script, 'Frontend route ' + route + ' is missing the React entry point.');

      if (entry) {
        ensure(script === entry, 'SPA deep links do not serve the same application.');
      } else {
        entry = script;
      }

      if (!local) {
        const csp = response.headers.get('content-security-policy') || '';
        const directives = new Map(csp.split(';').map((part) => part.trim().split(/\s+/)).filter((parts) => parts[0]).map(([name, ...sources]) => [name, sources]));
        const connect = directives.get('connect-src') || [];

        ensure(connect.includes(apiOrigin) && connect.includes(apiOrigin.replace('https:', 'wss:')), 'Frontend CSP does not allow this API and its secure WebSocket origin.');
        ensure(connect.every((source) => ["'self'", apiOrigin, apiOrigin.replace('https:', 'wss:')].includes(source)), 'Frontend CSP allows unexpected connection destinations.');

        for (const [directive, required] of [['script-src', "'self'"], ['object-src', "'none'"], ['frame-ancestors', "'none'"]]) {
          ensure(directives.get(directive)?.join(' ') === required, 'Frontend CSP has an unsafe or missing ' + directive + '.');
        }

        ensure(response.headers.get('x-content-type-options') === 'nosniff' && response.headers.get('x-frame-options') === 'DENY', 'Frontend security headers are missing.');
        ensure(/max-age=[1-9]\d*/.test(response.headers.get('strict-transport-security') || ''), 'Frontend HSTS is missing.');
      }
    }

    const asset = new URL(entry, appOrigin);
    ensure(asset.origin === appOrigin, 'The frontend entry script is unexpectedly hosted elsewhere.');

    const response = await fetch(asset, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    ensure(response.status === 200 && /javascript/.test(response.headers.get('content-type') || ''), 'The frontend entry asset is missing or rewritten to HTML.');
    await response.arrayBuffer();
  });
}

async function verifyDeployment(options) {
  const apiOrigin = validateOrigin(options.apiOrigin, options.local);
  const appOrigin = validateOrigin(options.appOrigin, options.local);
  const { checks, step } = createChecks(options.logger);
  const report = {
    startedAt: new Date().toISOString(),
    scope: options.local ? 'local' : 'deployment',
    apiOrigin,
    appOrigin,
    workflows: Boolean(options.workflows),
    checks,
    resources: {},
    success: false,
  };
  const api = createApi(apiOrigin, appOrigin);

  try {
    await verifyApi({ apiOrigin, appOrigin, api, step });
    await verifyFrontend({ apiOrigin, appOrigin, local: options.local, step });
    if (options.workflows) {
      await runWorkflows({ apiOrigin, appOrigin, api, step, resources: report.resources, ensure });
    }
    report.success = true;
  } catch {
    // Failed steps already have safe diagnostics. Partial fixture IDs remain in the report.
  }

  report.finishedAt = new Date().toISOString();
  return report;
}

const usage =
  'npm run smoke:deployment -- --api https://ACTUAL-API.onrender.com --app https://ACTUAL-APP.vercel.app [--workflows] [--report .local/deployment-smoke.json]\n' +
  'Use --local only with http://localhost or http://127.0.0.1 origins. Checks are read-only unless --workflows is supplied.\n' +
  '--workflows creates five isolated test accounts, a service and four slots; it cancels its slots, archives its service and revokes its sessions afterward. Test audit records remain. No existing accounts or schedules are modified.';

async function main() {
  const options = { logger: console.log };
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--help') {
      console.log(usage);
      return;
    }
    if (flag === '--local' || flag === '--workflows') {
      options[flag.slice(2)] = true;
    } else {
      const key = { '--api': 'apiOrigin', '--app': 'appOrigin', '--report': 'report' }[flag];
      ensure(key && args[index + 1] && !args[index + 1].startsWith('--'), 'Unknown or incomplete option.\n' + usage);
      options[key] = args[++index];
    }
  }

  let reportFile;
  if (options.report) {
    const directory = path.resolve(__dirname, '../.local');
    reportFile = path.resolve(options.report);
    ensure(reportFile.startsWith(directory + path.sep) && path.extname(reportFile) === '.json', 'Reports must be JSON files inside the ignored .local directory.');
  }

  const report = await verifyDeployment(options);

  if (reportFile) {
    await fs.mkdir(path.dirname(reportFile), { recursive: true });
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
  }

  console.log((report.success ? 'Passed' : 'Failed') + ': ' + report.scope + ' smoke check. ' + report.checks.filter((check) => check.status === 'passed').length + '/' + report.checks.length + ' checks passed.');
  if (!report.success) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { createApi, createChecks, ensure, verifyApi, verifyFrontend, verifyDeployment };
