// Testes do pr-preview/scripts/detectar.sh em repositórios montados na hora, sem rede e sem LLM.
//   node --test testes/detectar.test.mjs
// No Windows, roda com o bash do Git para Windows.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const barra = (p) => p.replace(/\\/g, '/');
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const detector = barra(path.join(raiz, 'pr-preview', 'scripts', 'detectar.sh'));
const gitBash = 'C:/Program Files/Git/bin/bash.exe';
const bash = process.platform === 'win32' && fs.existsSync(gitBash) ? gitBash : 'bash';

const base = fs.mkdtempSync(path.join(os.tmpdir(), 'detectar-'));
after(() => fs.rmSync(base, { recursive: true, force: true }));

const quem = { GIT_AUTHOR_NAME: 'Teste', GIT_AUTHOR_EMAIL: 'teste@exemplo', GIT_COMMITTER_NAME: 'Teste', GIT_COMMITTER_EMAIL: 'teste@exemplo' };
const git = (dir, ...args) => execFileSync('git', args, { cwd: dir, env: { ...process.env, ...quem }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

function escrever(dir, arquivos) {
  for (const [nome, texto] of Object.entries(arquivos)) {
    fs.mkdirSync(path.dirname(path.join(dir, nome)), { recursive: true });
    fs.writeFileSync(path.join(dir, nome), texto);
  }
}

function commit(dir, mensagem) {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '--allow-empty', '-m', mensagem);
}

let n = 0;
/** Repositório com um commit inicial, na branch pedida e sem remoto. */
function repo(arquivos = {}, branch = 'main') {
  const dir = path.join(base, `r${++n}`);
  fs.mkdirSync(dir);
  git(dir, 'init', '-q', '-b', branch);
  git(dir, 'config', 'core.autocrlf', 'false');
  escrever(dir, arquivos);
  commit(dir, 'chore: estrutura inicial');
  return dir;
}

/** Roda o detector e devolve as linhas chave=valor como objeto, mais o código de saída. */
function detectar(dir, env = process.env) {
  const r = spawnSync(bash, [detector, barra(dir)], { encoding: 'utf8', env });
  const saida = { status: r.status };
  for (const linha of r.stdout.split(/\r?\n/)) {
    const i = linha.indexOf('=');
    if (i > 0) saida[linha.slice(0, i)] = linha.slice(i + 1);
  }
  return saida;
}

/** O PATH com uma pasta na frente onde node, python e python3 só falham: força a leitura sem eles. */
function semNodeNemPython() {
  const falsos = path.join(base, 'falsos');
  fs.mkdirSync(falsos, { recursive: true });
  for (const t of ['node', 'python', 'python3']) fs.writeFileSync(path.join(falsos, t), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const chave = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
  return { ...process.env, [chave]: `${falsos}${path.delimiter}${process.env[chave]}` };
}

const pacote = (scripts) => JSON.stringify({ name: 'x', scripts }, null, 2);

test('lista scripts com dois-pontos no nome e chaves no valor', () => {
  const dir = repo({ 'package.json': pacote({ test: 'vitest run', 'test:unit': 'vitest run unit', lint: "eslint 'src/**/*.{ts,tsx}'", typecheck: 'tsc --noEmit' }) });
  assert.equal(detectar(dir).scripts, 'test test:unit lint typecheck');
});

test('sem node nem python, ainda preserva o dois-pontos no nome do script', () => {
  const dir = repo({ 'package.json': pacote({ test: 'vitest run', 'test:unit': 'vitest run unit', lint: 'eslint .' }) });
  assert.equal(detectar(dir, semNodeNemPython()).scripts, 'test test:unit lint');
});

test('Node e Python no mesmo repo aparecem os dois, cada um com o seu gerenciador', () => {
  const dir = repo({ 'package.json': pacote({ test: 'vitest' }), 'pyproject.toml': '[project]\nname = "x"\n', 'uv.lock': '' });
  const s = detectar(dir);
  assert.equal(s.stack, 'node python');
  assert.equal(s.gerenciador, 'npm');
  assert.equal(s.gerenciador_python, 'uv');
});

test('Python só com pyproject.toml é Python', () => {
  assert.equal(detectar(repo({ 'pyproject.toml': '[project]\nname = "x"\n' })).stack, 'python');
});

test('Cloudflare só com wrangler.toml é Cloudflare', () => {
  assert.match(detectar(repo({ 'wrangler.toml': 'name = "x"\n' })).plataformas, /\bcloudflare\b/);
});

test('commitlint só com commitlint.config.js é commitlint', () => {
  assert.equal(detectar(repo({ 'commitlint.config.js': 'export default {};\n' })).commitlint, 'sim');
});

test('ticket numa branch local e no assunto de um commit, sem confundir UTF-8 com ticket', () => {
  const dir = repo({ 'a.txt': 'a\n' });
  git(dir, 'switch', '-q', '-c', 'feat/LOJA-12-cupom');
  commit(dir, 'feat(LOJA-7): adiciona o cupom');
  commit(dir, 'fix: corrige UTF-8 no CSV');
  const s = detectar(dir);
  assert.equal(s.exemplo_ticket_em_branch, 'LOJA-12');
  assert.equal(s.exemplo_ticket_em_commit, 'LOJA-7');
});

test('ticket no rodapé Refs: do commit', () => {
  const dir = repo();
  commit(dir, 'feat(relatorios): exporta CSV\n\nRefs: PAINEL-482');
  assert.equal(detectar(dir).exemplo_ticket_em_commit, 'PAINEL-482');
});

test('sem remoto, a branch padrão pode ser a develop local', () => {
  assert.equal(detectar(repo({}, 'develop')).branch_padrao, 'develop');
});

test('repositório em ordem tem estado_git=normal', () => {
  const s = detectar(repo());
  assert.equal(s.estado_git, 'normal');
  assert.equal(s.branch_atual, 'main');
});

test('HEAD solto aparece em estado_git, com branch_atual vazia', () => {
  const dir = repo();
  git(dir, 'checkout', '-q', '--detach');
  const s = detectar(dir);
  assert.equal(s.branch_atual, '');
  assert.equal(s.estado_git, 'detached_head');
});

test('merge com conflito aparece em estado_git', () => {
  const dir = repo({ 'a.txt': 'base\n' });
  git(dir, 'switch', '-q', '-c', 'outra');
  escrever(dir, { 'a.txt': 'outra\n' });
  commit(dir, 'feat: outra');
  git(dir, 'switch', '-q', 'main');
  escrever(dir, { 'a.txt': 'main\n' });
  commit(dir, 'feat: main');
  spawnSync('git', ['merge', 'outra'], { cwd: dir, env: { ...process.env, ...quem } });
  const s = detectar(dir);
  assert.match(s.estado_git, /\bmerge_em_andamento\b/);
  assert.match(s.estado_git, /\bconflito\b/);
});

test('fora de um repositório, avisa e sai com erro', () => {
  const dir = path.join(base, 'sem-git');
  fs.mkdirSync(dir);
  const s = detectar(dir);
  assert.equal(s.erro, 'nao_e_repositorio_git');
  assert.equal(s.status, 1);
});
