#!/usr/bin/env bash
# Roda um caso de ponta a ponta: monta o ambiente, chama o Claude sem interação e dá a nota.
#   bash testes/harness/rodar.sh <caso> <destino> [--sem-skill]
# Deixa em <destino>: resposta.md, ferramentas.txt (cada chamada de ferramenta, em ordem),
# saida.jsonl (a saída do claude -p), timing.json e grading.json.
# Os hooks do usuário ficam desligados, para o contexto pessoal (memória, notas) não entrar no teste,
# e a sessão não fica salva. MODELO e TETO_USD trocam o modelo e o gasto máximo.
set -eu
caso=$1; dest=$2; modo=${3:-}
H=$(cd "$(dirname "$0")" && pwd)
evals=$(cd "$H/../../pr-preview/evals" && pwd)
[ -f "$evals/$caso/prompt.md" ] || { echo "caso sem prompt.md: $caso"; exit 1; }
bash "$H/montar.sh" "$caso" "$dest" >/dev/null
dest=$(cd "$dest" && pwd)

# O pedido é o que vem depois do bloco de configuração, entre as duas linhas "---".
prompt=$(awk 'n >= 2; /^---$/ { n++ }' "$evals/$caso/prompt.md" | sed '/./,$!d')
ferramentas=(Read Glob Grep Write Edit Bash)
extra=()
# Com a skill, o pedido sai como /pr-preview: o caso mede o que a skill faz, e o acionamento pela
# descrição tem o seu próprio teste (testes/trigger). Com muitas skills instaladas, o Claude Code mostra
# só o nome delas, e o acionamento pela descrição deixa de funcionar.
if [ "$modo" = --sem-skill ]; then extra=(--disallowed-tools Skill); else ferramentas+=(Skill); prompt="/pr-preview $prompt"; fi

inicio=$(date +%s)
( cd "$dest/repo" && PATH="$dest/bin:$PATH" claude -p "$prompt" \
    --output-format stream-json --verbose --model "${MODELO:-claude-opus-5-5}" --max-budget-usd "${TETO_USD:-5}" \
    --allowed-tools "${ferramentas[@]}" ${extra[@]+"${extra[@]}"} \
    --settings '{"disableAllHooks":true}' --strict-mcp-config --no-session-persistence \
) > "$dest/saida.jsonl" 2> "$dest/saida.err" || echo "claude -p saiu com erro; veja $dest/saida.err"

node "$H/resumir.js" "$dest" "$inicio"
node "$H/avaliar.js" "$dest" "$caso" "$dest/grading.json"
