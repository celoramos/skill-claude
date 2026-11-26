// gh simulado para os testes da skill ship. Nada sai da máquina.
// Lê o cenário de ../cenario.json e guarda estado e log em ../estado/.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const H = path.resolve(__dirname, '..');
const E = path.join(H, 'estado');
fs.mkdirSync(E, { recursive: true });
const cen = JSON.parse(fs.readFileSync(path.join(H, 'cenario.json'), 'utf8'));
const argv = process.argv.slice(2);
fs.appendFileSync(path.join(E, 'chamadas.log'), 'gh ' + argv.map(a => /\s/.test(a) ? JSON.stringify(a) : a).join(' ') + '\n');

let jq = null; const args = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '-q' || a === '--jq') { jq = argv[++i]; continue; }
  if (a.startsWith('--jq=')) { jq = a.slice(5); continue; }
  args.push(a);
}
const flag = (...names) => { for (let i = 0; i < args.length; i++) { for (const n of names) { if (args[i] === n) return args[i + 1]; if (args[i].startsWith(n + '=')) return args[i].slice(n.length + 1); } } return undefined; };
const has = (...names) => args.some(a => names.includes(a));
const out = (s) => process.stdout.write(s.endsWith('\n') ? s : s + '\n');
const json = (o) => { if (jq) process.stderr.write('aviso: --jq não disponível nesta máquina (sem jq); saída em JSON bruto\n'); out(JSON.stringify(o, null, 2)); };
const git = (...a) => { try { return execFileSync('git', ['--git-dir', cen.remote_git, ...a], { encoding: 'utf8' }).trim(); } catch { return ''; } };

const ramo = git('for-each-ref', '--sort=-committerdate', '--format=%(refname:short)', 'refs/heads').split('\n').filter(b => b && !['main', 'master', 'develop'].includes(b))[0] || '';
const sha = ramo ? git('rev-parse', ramo) : '';
const prFile = path.join(E, 'pr.json');
const pr = fs.existsSync(prFile) ? JSON.parse(fs.readFileSync(prFile, 'utf8')) : null;
const savePr = (p) => fs.writeFileSync(prFile, JSON.stringify(p, null, 2));
const repoUrl = `https://github.com/${cen.repo}`;
const { ciRun } = require('./ci.js');
const ciReal = ['cloudflare-tz', 'vercel-env'].includes(cen.cenario);
const ehVercel = cen.cenario === 'vercel' || cen.cenario === 'vercel-env';

// Cenário cloudflare: o build falha enquanto algum import de src/main.js
// apontar para um arquivo que não existe com a mesma grafia (Linux diferencia maiúsculas).
function quebrado() {
  if (ciReal) { const r = ciRun(cen, E, sha); return !!r && !r.ok; }
  if (cen.cenario !== 'cloudflare' || !ramo) return false;
  const main = git('show', `${ramo}:src/main.js`);
  const arquivos = new Set(git('ls-tree', '-r', '--name-only', ramo).split('\n'));
  const imps = [...main.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)].map(m => 'src/' + m[1]);
  return imps.some(p => !arquivos.has(p));
}
const previewUrl = () => ehVercel
  ? `https://loja-git-${ramo.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-acme-demo.vercel.app`
  : `https://${sha.slice(0, 8)}.portal-acme.pages.dev`;

function checks() {
  if (cen.cenario === 'vercel-env') { const q = quebrado(); return [{ name: 'Vercel', state: q ? 'FAILURE' : 'SUCCESS', bucket: q ? 'fail' : 'pass', elapsed: '23s', link: `https://vercel.com/acme-demo/loja/${sha.slice(0, 9)}` }]; }
  if (cen.cenario === 'cloudflare-tz') { const q = quebrado(); return [
    { name: 'lint-e-testes', state: q ? 'FAILURE' : 'SUCCESS', bucket: q ? 'fail' : 'pass', elapsed: '31s', link: `${repoUrl}/actions/runs/${runId()}/job/1` },
    { name: 'Deploy preview (Cloudflare Pages)', state: q ? 'SKIPPED' : 'SUCCESS', bucket: q ? 'skipping' : 'pass', elapsed: q ? '0s' : '44s', link: `${repoUrl}/actions/runs/${runId()}/job/2` }]; }
  if (cen.cenario === 'vercel') return [
    { name: 'Vercel', state: 'SUCCESS', bucket: 'pass', elapsed: '41s', link: `https://vercel.com/acme-demo/loja/${sha.slice(0, 9)}` },
    { name: 'Vercel Preview Comments', state: 'SUCCESS', bucket: 'pass', elapsed: '0s', link: 'https://vercel.com/github' },
  ];
  const q = quebrado();
  return [
    { name: 'lint-e-testes', state: 'SUCCESS', bucket: 'pass', elapsed: '29s', link: `${repoUrl}/actions/runs/${q ? 9001 : 9002}/job/1` },
    { name: 'Deploy preview (Cloudflare Pages)', state: q ? 'FAILURE' : 'SUCCESS', bucket: q ? 'fail' : 'pass', elapsed: '47s', link: `${repoUrl}/actions/runs/${q ? 9001 : 9002}/job/2` },
  ];
}
const logFalha = `deploy-preview\tBuild\t2026-11-17T14:02:10.114Z > portal@1.0.0 build
deploy-preview\tBuild\t2026-11-17T14:02:10.115Z > node scripts/build.mjs
deploy-preview\tBuild\t2026-11-17T14:02:10.402Z
deploy-preview\tBuild\t2026-11-17T14:02:10.403Z ✘ [ERROR] Could not resolve "./components/Header.js"
deploy-preview\tBuild\t2026-11-17T14:02:10.403Z
deploy-preview\tBuild\t2026-11-17T14:02:10.403Z     src/main.js:1:23:
deploy-preview\tBuild\t2026-11-17T14:02:10.403Z       1 │ import { Cabecalho } from './components/Header.js';
deploy-preview\tBuild\t2026-11-17T14:02:10.403Z         ╵                        ~~~~~~~~~~~~~~~~~~~~~~~~
deploy-preview\tBuild\t2026-11-17T14:02:10.404Z
deploy-preview\tBuild\t2026-11-17T14:02:10.410Z 1 error
deploy-preview\tBuild\t2026-11-17T14:02:10.455Z ##[error]Process completed with exit code 1.`;

function runId() { return 9100 + (parseInt(sha.slice(0, 4), 16) % 800); }
function logReal() { const r = ciRun(cen, E, sha); const NL = String.fromCharCode(10), TAB = String.fromCharCode(9); const p = ["lint-e-testes", "Run npm run lint && npm test", "2026-11-17T14:02:10Z "].join(TAB); return r.log.split(NL).map(l => p + l).join(NL) + NL + p + "##[error]Process completed with exit code 1."; }
const [c1, c2] = args;
const sub = `${c1 || ''} ${c2 || ''}`.trim();

if (sub === 'auth status') { out('github.com\n  ✓ Logged in to github.com account demo-user (keyring)\n  - Active account: true\n  - Git operations protocol: https'); process.exit(0); }
if (sub === 'auth token') { out('gho_simulado'); process.exit(0); }
if (sub === 'repo view') { const o = { nameWithOwner: cen.repo, name: cen.repo.split('/')[1], url: repoUrl, defaultBranchRef: { name: 'main' }, visibility: 'PRIVATE' }; has('--json') ? json(o) : out(`${cen.repo}\n${repoUrl}`); process.exit(0); }

if (c1 === 'pr') {
  if (c2 === 'list') {
    const lista = pr && pr.state === 'OPEN' ? [pr] : [];
    if (has('--json')) json(lista); else out(lista.map(p => `#${p.number}\t${p.title}\t${p.headRefName}\tOPEN`).join('\n') || '');
    process.exit(0);
  }
  if (c2 === 'view') {
    if (!pr) { process.stderr.write(`no pull requests found for branch "${ramo}"\n`); process.exit(1); }
    if (has('--json')) json({ ...pr, statusCheckRollup: checks().map(c => ({ name: c.name, conclusion: c.state, status: 'COMPLETED', detailsUrl: c.link })) });
    else out(`${pr.title} #${pr.number}\n${pr.isDraft ? 'Draft' : 'Open'} • demo-user wants to merge into ${pr.baseRefName} from ${pr.headRefName}\n\n${pr.body}${has('--comments') && ehVercel ? `\n\nvercel[bot] • ${quebrado() ? `❌ Failed — loja — Inspect: https://vercel.com/acme-demo/loja/${sha.slice(0, 9)}` : `✅ Ready — loja — Preview: ${previewUrl()}`}` : ''}\n\nView this pull request on GitHub: ${pr.url}`);
    process.exit(0);
  }
  if (c2 === 'create') {
    if (pr && pr.state === 'OPEN') { process.stderr.write(`a pull request for branch "${pr.headRefName}" into branch "${pr.baseRefName}" already exists:\n${pr.url}\n`); process.exit(1); }
    const bf = flag('--body-file', '-F');
    const body = bf ? (bf === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(bf, 'utf8')) : (flag('--body', '-b') || '');
    const p = { number: 7, url: `${repoUrl}/pull/7`, title: flag('--title', '-t') || '(sem título)', body, baseRefName: flag('--base', '-B') || 'main', headRefName: flag('--head', '-H') || ramo, isDraft: has('--draft', '-d'), state: 'OPEN' };
    savePr(p); out(`\nCreating pull request for ${p.headRefName} into ${p.baseRefName} in ${cen.repo}\n\n${p.url}`); process.exit(0);
  }
  if (c2 === 'edit') {
    if (!pr) { process.stderr.write('no pull request found\n'); process.exit(1); }
    const bf = flag('--body-file', '-F');
    if (bf) pr.body = fs.readFileSync(bf, 'utf8');
    if (flag('--body', '-b') !== undefined) pr.body = flag('--body', '-b');
    if (flag('--title', '-t')) pr.title = flag('--title', '-t');
    if (flag('--base', '-B')) pr.baseRefName = flag('--base', '-B');
    savePr(pr); out(pr.url); process.exit(0);
  }
  if (c2 === 'ready') { if (pr) { pr.isDraft = false; savePr(pr); } out(`✓ Pull request #7 is marked as "ready for review"`); process.exit(0); }
  if (c2 === 'checks') {
    if (!pr) { process.stderr.write(`no pull requests found for branch "${ramo}"\n`); process.exit(1); }
    const cs = checks();
    if (has('--json')) json(cs); else out(cs.map(c => `${c.name}\t${c.bucket}\t${c.elapsed}\t${c.link}`).join('\n'));
    process.exit(cs.some(c => c.bucket === 'fail') ? 1 : 0);
  }
  if (c2 === 'merge') { fs.writeFileSync(path.join(E, 'MERGED'), new Date().toISOString()); if (pr) { pr.state = 'MERGED'; savePr(pr); } out('✓ Merged pull request #7'); process.exit(0); }
  if (c2 === 'comment') { out(`${repoUrl}/pull/7#issuecomment-1`); process.exit(0); }
  out(''); process.exit(0);
}

if (c1 === 'run' && cen.cenario === 'vercel-env') { has('--json') ? json([]) : out('no runs found'); process.exit(0); }
if (c1 === 'run') {
  const q = quebrado(); const id = cen.cenario === 'cloudflare-tz' ? runId() : (q ? 9001 : 9002);
  const run = { databaseId: id, name: 'Preview', workflowName: 'Preview', headBranch: ramo, headSha: sha, status: 'completed', conclusion: q ? 'failure' : 'success', url: `${repoUrl}/actions/runs/${id}` };
  if (c2 === 'list') { has('--json') ? json(ramo ? [run] : []) : out(ramo ? `${run.conclusion === 'failure' ? 'X' : '✓'}\t${run.name}\t${ramo}\tpull_request\t${id}\t52s` : 'no runs found'); process.exit(0); }
  if (c2 === 'view') {
    if (has('--log-failed', '--log')) { out(run.conclusion === 'failure' ? (cen.cenario === 'cloudflare-tz' ? logReal() : logFalha) : 'deploy-preview\tDeploy\t✨ Deployment complete! Take a peek over at ' + previewUrl()); process.exit(0); }
    has('--json') ? json({ ...run, jobs: [{ name: 'lint-e-testes', conclusion: 'success' }, { name: 'deploy-preview', conclusion: run.conclusion }] }) : out(`${run.conclusion === 'failure' ? 'X' : '✓'} ${ramo} Preview · ${id}\n\nJOBS\n✓ lint-e-testes in 29s\n${run.conclusion === 'failure' ? 'X' : '✓'} deploy-preview in 47s\n\nFor more information about a job, try: gh run view --job=<job-id>\nView this run on GitHub: ${run.url}`);
    process.exit(0);
  }
  if (c2 === 'watch') { out(`Run Preview (${id}) completed with '${run.conclusion}'`); process.exit(run.conclusion === 'failure' ? 1 : 0); }
  out(''); process.exit(0);
}

if (c1 === 'api') {
  const p = args.slice(1).find(a => !a.startsWith('-')) || '';
  const ok = !quebrado();
  if (/deployments\/\d+\/statuses/.test(p)) { json(ok ? [{ state: 'success', environment_url: previewUrl(), target_url: previewUrl(), created_at: '2026-11-17T14:03:00Z' }] : [{ state: 'failure', environment_url: '', log_url: ehVercel ? `https://vercel.com/acme-demo/loja/${sha.slice(0, 9)}` : `${repoUrl}/actions/runs/${runId()}`, description: ehVercel ? 'Deployment has failed' : 'Build failed', created_at: '2026-11-17T14:02:11Z' }]); process.exit(0); }
  if (/deployments/.test(p)) { json(ramo ? [{ id: ok ? 555 : 554, ref: ramo, sha, environment: ehVercel ? 'Preview' : 'preview', created_at: '2026-11-17T14:02:00Z' }] : []); process.exit(0); }
  if (/check-runs/.test(p)) { json({ total_count: 2, check_runs: checks().map((c, i) => ({ id: i + 1, name: c.name, status: 'completed', conclusion: c.state.toLowerCase(), details_url: c.link, output: { title: c.name, summary: c.bucket === 'fail' ? 'Build failed. See logs.' : 'Ok' } })) }); process.exit(0); }
  if (/(pulls|issues)\/\d+\/comments/.test(p)) { json(ehVercel && ramo ? [{ user: { login: 'vercel[bot]' }, body: ok ? `[vc]: #preview\n| Name | Status | Preview |\n|---|---|---|\n| loja | ✅ Ready | [Visit Preview](${previewUrl()}) |` : `[vc]: #preview\n| Name | Status | Preview |\n|---|---|---|\n| loja | ❌ Failed ([Inspect](https://vercel.com/acme-demo/loja/${sha.slice(0, 9)})) | |` }] : []); process.exit(0); }
  if (/pulls/.test(p)) { json(pr ? [pr] : []); process.exit(0); }
  if (/^\/?user$/.test(p)) { json({ login: 'demo-user' }); process.exit(0); }
  if (/^\/?repos\/[^/]+\/[^/]+$/.test(p)) { json({ full_name: cen.repo, default_branch: 'main', allow_merge_commit: true, allow_squash_merge: true }); process.exit(0); }
  json([]); process.exit(0);
}

out(''); process.exit(0);
