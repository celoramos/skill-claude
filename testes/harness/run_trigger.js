#!/usr/bin/env node
// Testa se a descrição da skill faz o Claude acioná-la.
// Versão em Node do run_eval.py do skill-creator (que não roda no Windows: usa select() em pipe).
//
// Diferença do original: em vez de criar um comando falso, troca a descrição da própria skill
// instalada durante o teste e a restaura no fim (há cópia de segurança em SKILL.md.bak).
// Assim o teste vê a skill com o nome real, competindo com todas as outras skills instaladas.
//
// Uso: node run_trigger.js --eval-set <json> --skill-dir <pasta> [--description-file <txt>]
//        [--runs 3] [--workers 5] [--timeout 150] [--model claude-opus-5-5] [--out <json>] [--cwd <pasta vazia>]

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, execSync } = require('child_process');

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const evalSet = JSON.parse(fs.readFileSync(args['eval-set'], 'utf8'));
const skillDir = args['skill-dir'];
const runs = +(args.runs || 3);
const workers = +(args.workers || 5);
const timeoutMs = +(args.timeout || 150) * 1000;
const model = args.model || 'claude-opus-5-5';
const only = args.only ? args.only.split(',').map(Number) : null;

const skillMd = path.join(skillDir, 'SKILL.md');
const skillName = fs.readFileSync(skillMd, 'utf8').match(/^name:\s*(\S+)/m)[1];
const original = fs.readFileSync(skillMd, 'utf8');
const backup = skillMd + '.bak';

const cwd = args.cwd || fs.mkdtempSync(path.join(os.tmpdir(), 'trigger-'));
fs.mkdirSync(cwd, { recursive: true });

function yamlScalar(s) {
  s = s.replace(/\s*\n\s*/g, ' ').trim();
  return /: |^['"#&*!|>%@`]| #/.test(s) ? `'${s.replace(/'/g, "''")}'` : s;
}

let description = original.match(/^description:\s*(.*)$/m)[1];
function restore() {
  if (fs.existsSync(backup)) {
    fs.writeFileSync(skillMd, fs.readFileSync(backup));
    fs.unlinkSync(backup);
  }
}
if (args['description-file']) {
  description = fs.readFileSync(args['description-file'], 'utf8').trim();
  fs.writeFileSync(backup, original);
  const swapped = original.replace(/^description:.*$/m, () => 'description: ' + yamlScalar(description));
  fs.writeFileSync(skillMd, swapped);
  for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { restore(); process.exit(130); });
  process.on('exit', restore);
}

function killTree(child) {
  try { execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' }); } catch { try { child.kill(); } catch {} }
}

// Acionou = chamou Skill(<nome>) ou leu o SKILL.md dela antes de usar qualquer outra ferramenta.
// Chamadas a outras skills e ao ToolSearch não decidem: o Claude pode carregar várias antes de agir.
// A primeira ferramenta "de trabalho" (Bash, Read de outro arquivo, Edit...) encerra como "não acionou",
// e o processo morre antes de ela executar.
function runOne(query) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.CLAUDECODE;
    const child = spawn('claude', [
      '-p', query, '--output-format', 'stream-json', '--verbose', '--include-partial-messages',
      '--model', model, '--strict-mcp-config', '--no-session-persistence',
    ], { cwd, env, stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });

    let buf = '', done = false, pending = null, json = '';
    const tools = [];
    const finish = (triggered, why) => {
      if (done) return;
      done = true; clearTimeout(timer); killTree(child);
      resolve({ triggered, why, tools });
    };
    const timer = setTimeout(() => finish(false, 'timeout'), timeoutMs);

    const decide = (name, input) => {
      tools.push(name);
      const hit = input.includes(skillName);
      if (name === 'Skill') { if (hit) finish(true, 'Skill'); return; }
      if (name === 'ToolSearch') return;
      if (name === 'Read' && hit) return finish(true, 'Read');
      finish(false, 'primeira ferramenta: ' + name);
    };

    child.stdout.on('data', (chunk) => {
      buf += chunk.toString('utf8');
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line || done) continue;
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.type === 'stream_event') {
          const se = ev.event || {};
          if (se.type === 'content_block_start' && se.content_block?.type === 'tool_use') {
            pending = se.content_block.name; json = '';
            if (!['Skill', 'ToolSearch', 'Read'].includes(pending)) { decide(pending, ''); pending = null; }
          } else if (se.type === 'content_block_delta' && pending && se.delta?.type === 'input_json_delta') {
            json += se.delta.partial_json || '';
            if (pending !== 'ToolSearch' && json.includes(skillName)) { decide(pending, json); pending = null; }
          } else if (se.type === 'content_block_stop' && pending) {
            decide(pending, json); pending = null;
          }
        } else if (ev.type === 'result') {
          finish(false, 'respondeu sem acionar');
        }
      }
    });
    child.on('close', () => finish(false, 'processo terminou'));
  });
}

(async () => {
  const jobs = [];
  evalSet.forEach((item, idx) => {
    if (only && !only.includes(idx)) return;
    for (let r = 0; r < runs; r++) jobs.push({ idx, item });
  });
  const per = new Map();
  let next = 0, finished = 0;
  const t0 = Date.now();
  async function worker() {
    while (next < jobs.length) {
      const job = jobs[next++];
      const res = await runOne(job.item.query);
      if (!per.has(job.idx)) per.set(job.idx, []);
      per.get(job.idx).push(res);
      finished++;
      process.stderr.write(`[${finished}/${jobs.length}] q${job.idx} ${res.triggered ? 'ACIONOU' : 'não'} (${res.why})\n`);
    }
  }
  await Promise.all(Array.from({ length: workers }, worker));

  const results = [...per.keys()].sort((a, b) => a - b).map((idx) => {
    const item = evalSet[idx], rs = per.get(idx);
    const rate = rs.filter((r) => r.triggered).length / rs.length;
    return { idx, query: item.query, should_trigger: item.should_trigger, trigger_rate: rate,
      pass: (rate >= 0.5) === item.should_trigger, runs: rs };
  });
  const pos = results.filter((r) => r.should_trigger), neg = results.filter((r) => !r.should_trigger);
  const summary = {
    description, model, runs_per_query: runs, seconds: Math.round((Date.now() - t0) / 1000),
    passed: results.filter((r) => r.pass).length, total: results.length,
    should_trigger_passed: `${pos.filter((r) => r.pass).length}/${pos.length}`,
    should_not_trigger_passed: `${neg.filter((r) => r.pass).length}/${neg.length}`,
  };
  const out = { summary, results };
  if (args.out) fs.writeFileSync(args.out, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  for (const r of results) console.log(`${r.pass ? 'ok  ' : 'FALHA'} ${r.should_trigger ? '[deve]    ' : '[não deve]'} ${(r.trigger_rate * 100).toFixed(0).padStart(3)}%  ${r.query.slice(0, 90)}`);
})();
