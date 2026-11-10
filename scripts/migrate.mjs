import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';

// Match Next's environment precedence without printing any credentials.
for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('Usage: pnpm db:migrate [--dry-run] [--yes]\nSet SUPABASE_DB_URL in .env.local to the session pooler URI from Supabase → Connect (port 5432), with your database password URL-encoded.');
  process.exit(0);
}
if (args.some((arg) => !['--dry-run', '--yes', '--include-all'].includes(arg))) {
  console.error('Supported options: --dry-run, --yes, --include-all');
  process.exit(1);
}
const connection = process.env.SUPABASE_DB_URL;
if (!connection) {
  console.error('Missing SUPABASE_DB_URL. In Supabase → Connect, copy the Session pooler URI (IPv4, port 5432), replace the password placeholder, and save it as SUPABASE_DB_URL in .env.local. Then run pnpm db:migrate --dry-run.');
  process.exit(1);
}
let url;
try { url = new URL(connection); } catch {
  console.error('SUPABASE_DB_URL must be a valid PostgreSQL connection URI.');
  process.exit(1);
}
if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname.endsWith('.pooler.supabase.com') || url.port !== '5432' || url.username !== 'postgres.ngjfafpsljnfpbptkahy' || !url.password || /\[.*\]/.test(decodeURIComponent(url.password))) {
  console.error('Use this project’s Session pooler URI: postgres.ngjfafpsljnfpbptkahy on a *.pooler.supabase.com host, port 5432, with your database password filled in.');
  process.exit(1);
}
if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require');
// Invoke the cached CLI through pnpm's JS entry point, avoiding shell interpolation.
const pnpm = process.env.npm_execpath;
if (!pnpm) {
  console.error('Run this script using pnpm db:migrate.');
  process.exit(1);
}
const child = spawn(process.execPath, [pnpm, 'dlx', 'supabase', 'db', 'push', `--remote=${url.href}`, ...args], { stdio: ['inherit', 'pipe', 'pipe'] });
const redact = (chunk) => String(chunk).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[database connection redacted]').split(url.password).join('[redacted]').split(decodeURIComponent(url.password)).join('[redacted]');
child.stdout.on('data', (chunk) => process.stdout.write(redact(chunk)));
child.stderr.on('data', (chunk) => process.stderr.write(redact(chunk)));
child.on('error', () => { console.error('Could not start the Supabase CLI. Check that pnpm is installed.'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
