// glab simulado (GitLab + Netlify) para os testes da skill ship. Nada sai da máquina.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const H = path.resolve(__dirname, '..');
const E = path.join(H, 'estado');
fs.mkdirSync(E, { recursive: true });
const cen = JSON.parse(fs.readFileSync(path.join(H, 'cenario.json'), 'utf8'));
const args = process.argv.slice(2);
fs.appendFileSync(path.join(E, 'chamadas.log'), 'glab ' + args.map(a => /\s/.test(a) ? JSON.stringify(a) : a).join(' ') + '\n');
const flag = (...names) => { for (let i = 0; i < args.length; i++) { for (const n of names) { if (args[i] === n) return args[i + 1]; if (args[i].startsWith(n + '=')) return args[i].slice(n.length + 1); } } return undefined; };
const has = (...names) => args.some(a => names.includes(a));
const out = (s) => process.stdout.write(s.endsWith('\n') ? s : s + '\n');
const json = (o) => out(JSON.stringify(o, null, 2));
const git = (...a) => { try { return execFileSync('git', ['--git-dir', cen.remote_git, ...a], { encoding: 'utf8' }).trim(); } catch { return ''; } };
const ramo = git('for-each-ref', '--sort=-committerdate', '--format=%(refname:short)', 'refs/heads').split('\n').filter(b => b && !['main', 'master', 'develop'].includes(b))[0] || '';
const sha = ramo ? git('rev-parse', ramo) : '';
const mrFile = path.join(E, 'mr.json');
const mr = fs.existsSync(mrFile) ? JSON.parse(fs.readFileSync(mrFile, 'utf8')) : null;
const save = (m) => fs.writeFileSync(mrFile, JSON.stringify(m, null, 2));
const base = `https://gitlab.com/${cen.repo}`;
const preview = 'https://deploy-preview-31--painel-acme.netlify.app';
const [c1, c2] = args;

if (c1 === 'auth' && c2 === 'status') { out('gitlab.com\n  ✓ Logged in to gitlab.com as demo-user (keyring)\n  ✓ Git operations for gitlab.com configured to use https protocol.\n  ✓ API calls for gitlab.com are made over https protocol.'); process.exit(0); }
if (c1 === 'repo' && c2 === 'view') { has('--output', '-F') ? json({ path_with_namespace: cen.repo, default_branch: 'main', web_url: base }) : out(`${cen.repo}\n${base}\ndefault branch: main`); process.exit(0); }

if (c1 === 'mr') {
  if (c2 === 'list') { const l = mr && mr.state === 'opened' ? [mr] : []; if (has('--output', '-F')) json(l); else out(l.length ? `Showing 1 open merge request on ${cen.repo}.\n\n!31\t${cen.repo}!31\t${mr.title}\t(${mr.target_branch}) ← (${mr.source_branch})` : `No open merge requests match your search in ${cen.repo}.`); process.exit(0); }
  if (c2 === 'view') { if (!mr) { process.stderr.write(`no open merge request available for "${ramo}"\n`); process.exit(1); } has('--output', '-F') ? json(mr) : out(`title:\t${mr.title}\nstate:\topen\nsource:\t${mr.source_branch}\ntarget:\t${mr.target_branch}\nurl:\t${mr.web_url}\n--\n${mr.description}`); process.exit(0); }
  if (c2 === 'create') {
    if (mr && mr.state === 'opened') { process.stderr.write(`Failed to create merge request. Created MR already exists: ${mr.web_url}\n`); process.exit(1); }
    const m = { iid: 31, web_url: `${base}/-/merge_requests/31`, title: flag('--title', '-t') || '(sem título)', description: flag('--description', '-d') || '', target_branch: flag('--target-branch', '-b') || 'main', source_branch: flag('--source-branch', '-s') || ramo, draft: has('--draft'), state: 'opened', labels: flag('--label', '-l') || '' };
    save(m); out(`\nCreating merge request for ${m.source_branch} into ${m.target_branch} in ${cen.repo}\n\n!31 ${m.title} (${m.source_branch})\n ${m.web_url}`); process.exit(0);
  }
  if (c2 === 'update') { if (!mr) { process.stderr.write('no merge request found\n'); process.exit(1); } if (flag('--title', '-t')) mr.title = flag('--title', '-t'); if (flag('--description', '-d') !== undefined) mr.description = flag('--description', '-d'); if (flag('--target-branch')) mr.target_branch = flag('--target-branch'); if (has('--ready', '-r')) mr.draft = false; save(mr); out(`- Updating merge request !31\n✓ updated\n${mr.web_url}`); process.exit(0); }
  if (c2 === 'note') { out(`${base}/-/merge_requests/31#note_1`); process.exit(0); }
  if (c2 === 'merge') { fs.writeFileSync(path.join(E, 'MERGED'), new Date().toISOString()); if (mr) { mr.state = 'merged'; save(mr); } out('✓ Merged!'); process.exit(0); }
  out(''); process.exit(0);
}

if (c1 === 'ci') {
  if (!ramo) { out('No pipelines running or available on branch'); process.exit(0); }
  if (has('--output', '-F') || c2 === 'get') { json({ id: 812, status: 'success', ref: ramo, sha, web_url: `${base}/-/pipelines/812`, jobs: [{ name: 'lint', status: 'success' }, { name: 'test', status: 'success' }] }); process.exit(0); }
  if (c2 === 'list') { out(`Showing 1 pipelines on ${cen.repo}.\n\n(success) • #812\t(#1)\t${ramo}\t(about 1 minute ago)`); process.exit(0); }
  out(`(success) • 00m 21s\tlint\t\tlint\n(success) • 00m 38s\ttest\t\ttest\n\nhttps://gitlab.com/${cen.repo}/-/pipelines/812\nSHA: ${sha}\nPipeline state: success`); process.exit(0);
}

if (c1 === 'api') {
  const p = args.slice(1).find(a => !a.startsWith('-')) || '';
  if (/environments/.test(p)) { json(ramo ? [{ id: 1, name: `review/${ramo}`, state: 'available', external_url: preview }] : []); process.exit(0); }
  if (/statuses/.test(p)) { json(ramo ? [{ name: 'netlify/painel-acme/deploy-preview', status: 'success', description: 'Deploy Preview ready!', target_url: preview, sha }] : []); process.exit(0); }
  if (/notes/.test(p)) { json(mr ? [{ author: { username: 'netlify-bot' }, body: `### ✅ Deploy Preview for painel-acme ready!\n|  Name | Link |\n|---|---|\n| 🔨 Latest commit | ${sha.slice(0, 7)} |\n| 😎 Deploy Preview | ${preview} |` }] : []); process.exit(0); }
  if (/pipelines/.test(p)) { json(ramo ? [{ id: 812, status: 'success', ref: ramo, sha, web_url: `${base}/-/pipelines/812` }] : []); process.exit(0); }
  if (/merge_requests/.test(p)) { json(mr ? [mr] : []); process.exit(0); }
  if (/^\/?user$/.test(p)) { json({ username: 'demo-user' }); process.exit(0); }
  json([]); process.exit(0);
}
out(''); process.exit(0);
