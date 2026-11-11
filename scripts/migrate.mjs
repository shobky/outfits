import { existsSync, mkdtempSync, mkdirSync, copyFileSync, readdirSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

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
if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname.endsWith('.pooler.supabase.com') || url.username !== 'postgres.ngjfafpsljnfpbptkahy' || !url.password || /\[.*\]/.test(decodeURIComponent(url.password))) {
  console.error('Use this project’s Session pooler URI: postgres.ngjfafpsljnfpbptkahy on a *.pooler.supabase.com host, port 5432, with your database password filled in.');
  process.exit(1);
}
if (!url.searchParams.has('sslmode')) url.searchParams.set('sslmode', 'require');
// Session pooling uses IPv4 without the paid direct-connection IPv4 add-on.
// Dashboard transaction-pooler URLs use 6543; migrations need session mode.
url.port = '5432';
// Invoke the cached CLI through pnpm's JS entry point, avoiding shell interpolation.
const pnpm = process.env.npm_execpath;
if (!pnpm) {
  console.error('Run this script using pnpm db:migrate.');
  process.exit(1);
}
const executable = /\.exe$/i.test(pnpm);
// The original eight files were applied with timestamp versions. Their SQL was
// compared with the hosted history before recording this mapping. Stage copies
// so the checkout keeps its existing paths without replaying applied migrations.
const versions = {
  '0001': '20261104122321', '0002': '20261104122324',
  '0003': '20261104122351', '0004': '20261104170138',
  '0005': '20261105001422', '0006': '20261105085354',
  '0007': '20261105135927', '0008': '20261105162738',
  '0009': '20261110000900', '0010': '20261110001000',
};
const staging = mkdtempSync(path.join(tmpdir(), 'outfits-db-push-'));
mkdirSync(path.join(staging, 'supabase', 'migrations'), { recursive: true });
copyFileSync('supabase/config.toml', path.join(staging, 'supabase', 'config.toml'));
for (const file of readdirSync('supabase/migrations').filter((name) => name.endsWith('.sql'))) {
  const [version, ...name] = file.split('_');
  const mapped = versions[version] ?? version;
  if (!/^\d{14}$/.test(mapped)) throw new Error('New migrations must use timestamp filenames from supabase migration new.');
  copyFileSync(path.join('supabase/migrations', file), path.join(staging, 'supabase', 'migrations', `${mapped}_${name.join('_')}`));
}
const command = ['db', 'push', '--workdir', staging, ...args];
const child = spawn(executable ? pnpm : process.execPath, [...(executable ? [] : [pnpm]), 'dlx', 'supabase@2.75.0', ...command, `--db-url=${url.href}`], { stdio: ['inherit', 'pipe', 'pipe'] });
const redact = (chunk) => String(chunk).replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, '[database connection redacted]').split(url.password).join('[redacted]').split(decodeURIComponent(url.password)).join('[redacted]');
child.stdout.on('data', (chunk) => process.stdout.write(redact(chunk)));
child.stderr.on('data', (chunk) => process.stderr.write(redact(chunk)));
child.on('error', () => { console.error('Could not start the Supabase CLI. Check that pnpm is installed.'); process.exitCode = 1; });
child.on('exit', (code) => {
  if (path.dirname(staging) === path.resolve(tmpdir()) && path.basename(staging).startsWith('outfits-db-push-')) rmSync(staging, { recursive: true, force: true });
  process.exitCode = code ?? 1;
});
