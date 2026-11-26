// Lê a saída stream-json de um claude -p e deixa no ambiente o que a avaliação e a revisão usam.
//   node resumir.js <ambiente> [<início em segundos desde 1970>]
// Grava resposta.md (a resposta final), ferramentas.txt (cada chamada de ferramenta, em ordem)
// e timing.json (tokens, duração, turnos e custo).
const fs = require('fs');
const path = require('path');
const [amb, inicio] = process.argv.slice(2);
const linhas = fs.readFileSync(path.join(amb, 'saida.jsonl'), 'utf8').split('\n').filter(Boolean);
const eventos = linhas.map((l) => { try { return JSON.parse(l); } catch { return {}; } });

const usos = [];
for (const e of eventos) {
  if (e.type !== 'assistant') continue;
  for (const c of e.message?.content ?? []) {
    if (c.type !== 'tool_use') continue;
    const i = c.input ?? {};
    const alvo = i.skill ?? i.command ?? i.file_path ?? i.pattern ?? JSON.stringify(i);
    usos.push(`${c.name}: ${String(alvo).replace(/\s+/g, ' ').slice(0, 200)}`);
  }
}
fs.writeFileSync(path.join(amb, 'ferramentas.txt'), usos.join('\n') + '\n');

const fim = eventos.filter((e) => e.type === 'result').at(-1) ?? {};
fs.writeFileSync(path.join(amb, 'resposta.md'), fim.result || '');
const u = fim.usage || {};
const tokens = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
const ms = fim.duration_ms || (inicio ? Date.now() - Number(inicio) * 1000 : 0);
fs.writeFileSync(path.join(amb, 'timing.json'), JSON.stringify({ total_tokens: tokens, duration_ms: Math.round(ms), total_duration_seconds: +(ms / 1000).toFixed(1), turnos: fim.num_turns, custo_usd: fim.total_cost_usd }, null, 2));
