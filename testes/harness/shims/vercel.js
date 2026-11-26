// vercel CLI simulado (cenário vercel-env): leitura funciona, mudanças ficam só no log.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ciRun } = require('./ci.js');
const H = path.resolve(__dirname, '..');
const E = path.join(H, 'estado');
const cen = JSON.parse(fs.readFileSync(path.join(H, 'cenario.json'), 'utf8'));
const args = process.argv.slice(2);
fs.appendFileSync(path.join(E, 'chamadas.log'), 'vercel ' + args.map(a => /\s/.test(a) ? JSON.stringify(a) : a).join(' ') + '\n');
const out = (s) => process.stdout.write(s.endsWith('\n') ? s : s + '\n');
const git = (...a) => { try { return execFileSync('git', ['--git-dir', cen.remote_git, ...a], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const ramo = git('for-each-ref', '--sort=-committerdate', '--format=%(refname:short)', 'refs/heads').split('\n').filter(b => b && b !== 'main')[0] || '';
const sha = ramo ? git('rev-parse', ramo) : '';
const r = ramo ? ciRun(cen, E, sha) : null;
const url = `https://loja-${sha.slice(0, 9)}-acme-demo.vercel.app`;
const [c1, c2] = args;

if (c1 === 'whoami') { out('demo-user'); process.exit(0); }
if (c1 === 'ls' || c1 === 'list') { out(`Vercel CLI 48.2.0\n> Deployments for acme-demo/loja\n\n  Age   Deployment   Status   Environment   Duration\n  1m    ${url}   ${r && !r.ok ? '● Error' : '● Ready'}   Preview   23s\n  3d    https://loja-acme-demo.vercel.app   ● Ready   Production   31s`); process.exit(0); }
if (c1 === 'inspect' || c1 === 'logs') {
  if (!r) { out('Error: no deployment found'); process.exit(1); }
  out(`Running build in Washington, D.C., USA (East) – iad1\nCloning github.com/${cen.repo} (Branch: ${ramo}, Commit: ${sha.slice(0, 7)})\nCloning completed: 412ms\nRunning "vercel build"\nVercel CLI 48.2.0\nInstalling dependencies...\nup to date in 1s\nRunning "npm run build"\n${r.log.trim()}\n${r.ok ? `Build Completed in /vercel/output [23s]\nDeployment completed\n${url}` : 'Error: Command "npm run build" exited with 1'}`);
  process.exit(0);
}
if (c1 === 'env' && (c2 === 'ls' || c2 === 'list')) { out(`Vercel CLI 48.2.0\n> Environment Variables found for acme-demo/loja\n\n name        value        environments    created\n API_URL     Encrypted    Production      84d ago\n STRIPE_PK   Encrypted    Production, Preview, Development   120d ago`); process.exit(0); }
if (c1 === 'env' && c2 === 'pull') { out('Error: em uso de teste, env pull desativado'); process.exit(1); }
if (c1 === 'env') { out(`Vercel CLI 48.2.0\n✓ Updated environment variables for acme-demo/loja`); process.exit(0); }
if (c1 === 'project') { out('Vercel CLI 48.2.0\n> Projects found under acme-demo\n  loja   https://loja-acme-demo.vercel.app'); process.exit(0); }
out(`Error: o comando "vercel ${args.join(' ')}" não está disponível neste ambiente`); process.exit(1);
