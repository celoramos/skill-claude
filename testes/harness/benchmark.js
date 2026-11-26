// Gera benchmark.json e benchmark.md de uma iteração (substitui aggregate_benchmark.py, sem Python na máquina).
const fs = require('fs'); const path = require('path');
const it = process.argv[2]; const notes = process.argv.slice(3);
const casos = fs.readdirSync(it).filter(d => fs.existsSync(path.join(it, d, 'eval_metadata.json')));
const cfgs = ['with_skill', 'without_skill'];
const runs = []; const agg = {};
const st = (a) => { const m = a.reduce((s, x) => s + x, 0) / a.length; const sd = Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length); return { mean: +m.toFixed(3), stddev: +sd.toFixed(3), min: Math.min(...a), max: Math.max(...a) }; };
for (const c of cfgs) {
  const pr = [], t = [], tok = [];
  for (const k of casos) {
    const d = path.join(it, k, c); const g = JSON.parse(fs.readFileSync(path.join(d, 'grading.json'), 'utf8')); const tm = JSON.parse(fs.readFileSync(path.join(d, 'timing.json'), 'utf8'));
    runs.push({ eval_id: casos.indexOf(k), eval_name: k, configuration: c, run_number: 1, result: { pass_rate: g.summary.pass_rate, passed: g.summary.passed, failed: g.summary.failed, total: g.summary.total, time_seconds: tm.total_duration_seconds, tokens: tm.total_tokens, tool_calls: 0, errors: 0 }, expectations: g.expectations, notes: [] });
    pr.push(g.summary.pass_rate); t.push(tm.total_duration_seconds); tok.push(tm.total_tokens);
  }
  agg[c] = { pass_rate: st(pr), time_seconds: st(t), tokens: st(tok) };
}
const d = (a, b, f = 2) => (a - b >= 0 ? '+' : '') + (a - b).toFixed(f);
const delta = { pass_rate: d(agg.with_skill.pass_rate.mean, agg.without_skill.pass_rate.mean), time_seconds: d(agg.with_skill.time_seconds.mean, agg.without_skill.time_seconds.mean, 1), tokens: d(agg.with_skill.tokens.mean, agg.without_skill.tokens.mean, 0) };
const bench = { metadata: { skill_name: 'pr-preview', skill_path: path.resolve(__dirname, '../../pr-preview').replace(/\\/g, '/'), executor_model: 'claude-opus-5-5', analyzer_model: 'claude-opus-5-5', timestamp: new Date().toISOString(), evals_run: casos, runs_per_configuration: 1 }, runs, run_summary: { ...agg, delta }, notes };
fs.writeFileSync(path.join(it, 'benchmark.json'), JSON.stringify(bench, null, 2));
const pc = (x) => (x * 100).toFixed(0) + '%';
let md = `# Benchmark: pr-preview (iteração ${path.basename(it).split('-')[1]})\n\n| | Com skill | Sem skill | Diferença |\n|---|---|---|---|\n`;
md += `| Critérios atendidos | ${pc(agg.with_skill.pass_rate.mean)} | ${pc(agg.without_skill.pass_rate.mean)} | ${delta.pass_rate} |\n| Tempo médio | ${agg.with_skill.time_seconds.mean.toFixed(0)} s | ${agg.without_skill.time_seconds.mean.toFixed(0)} s | ${delta.time_seconds} s |\n| Tokens médios | ${Math.round(agg.with_skill.tokens.mean)} | ${Math.round(agg.without_skill.tokens.mean)} | ${delta.tokens} |\n\n## Por caso\n\n| Caso | Com skill | Sem skill |\n|---|---|---|\n`;
for (const k of casos) { const r = (c) => runs.find(x => x.eval_name === k && x.configuration === c).result; md += `| ${k} | ${r('with_skill').passed}/${r('with_skill').total} | ${r('without_skill').passed}/${r('without_skill').total} |\n`; }
md += `\n## Observações\n\n${notes.map(n => '- ' + n).join('\n')}\n`;
fs.writeFileSync(path.join(it, 'benchmark.md'), md); console.log(md);
