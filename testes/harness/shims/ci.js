// "CI" simulado: tira o commit do remoto para uma pasta limpa (sem .env.local nem nada local)
// e roda os comandos como uma máquina de CI faria. Resultado em cache por SHA.
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

function ciRun(cen, estado, sha) {
  if (!sha) return null;
  const cache = path.join(estado, `ci-${sha}.json`);
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, 'utf8'));
  const dir = path.join(estado, 'ci', sha.slice(0, 8));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  execFileSync('git', ['--git-dir', cen.remote_git, '--work-tree', dir, 'checkout', sha, '--', '.'], { stdio: 'ignore' });
  const env = { ...process.env, CI: 'true', TZ: 'UTC' };
  delete env.API_URL;
  const cmd = cen.cenario === 'vercel-env' ? 'npm run build' : 'npm run lint && npm test && npm run build';
  let ok = true, log;
  try { log = execSync(cmd, { cwd: dir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { ok = false; log = String(e.stdout || '') + String(e.stderr || ''); }
  const r = { ok, log: log.replace(/\r/g, '') };
  fs.writeFileSync(cache, JSON.stringify(r));
  return r;
}
module.exports = { ciRun };
