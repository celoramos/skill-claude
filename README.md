# skill-claude

Skills para o [Claude Code](https://claude.com/claude-code).

## pr-preview

Leva alterações locais até um preview no ar. Um pedido como "sobe isso" ou "abre o PR" passa por estas etapas:

1. Detecta o host Git, a plataforma, a stack e as regras do repositório, e barra segredos antes do commit.
2. Roda lint e testes.
3. Cria commits Conventional Commits em português.
4. Faz push numa branch e abre o PR/MR em português, seguindo o template do repositório.
5. Acompanha o deploy de preview. Se o build falhar, lê o log e corrige, com no máximo 2 tentativas.
6. Termina com um relatório que traz a URL do preview e a do PR.

Merge, tag e promote mexem em produção, e a skill não faz nenhum deles sem um "sim" explícito na conversa. As regras do repositório (CONTRIBUTING, template de PR, commitlint, hooks) valem mais que os padrões da skill.

- **Hosts Git:** GitHub, GitLab, Bitbucket e Azure DevOps.
- **Plataformas:** Vercel, Netlify, Cloudflare, Render, Railway, Fly.io, AWS Amplify, Firebase, GitHub Pages, Azure Static Web Apps, Heroku, DigitalOcean, Coolify e CI próprio.

### Instalação

Copie a pasta `pr-preview/` para `~/.claude/skills/`:

```bash
git clone https://github.com/celoramos/skill-claude.git
cp -r skill-claude/pr-preview ~/.claude/skills/
```

No Windows, a pasta fica em `%USERPROFILE%\.claude\skills\` e os scripts rodam no Git Bash. Num agente que só tem PowerShell, a skill chama o `bash.exe` do Git para Windows.

A skill precisa de `git` e `bash`. O push usa as credenciais do próprio Git. Para abrir o PR/MR e ler os checks, ela usa o `gh` (GitHub) ou o `glab` (GitLab), com login feito.

### Uso

Peça em linguagem natural, sem citar a plataforma:

- "terminei o filtro de busca, sobe isso pra eu ver no preview"
- "commita tudo e abre o PR"
- "manda pro ar"

Ou chame direto com `/pr-preview`.

**Com muitas skills instaladas,** o Claude Code mostra ao modelo só o nome de cada uma, sem a descrição, e a skill deixa de ser acionada pelo pedido. Num teste com centenas de skills, "sobe isso e já faz o merge pra produção" não acionou a `pr-preview`, e o Claude fez merge na main e push direto, sem PR e sem perguntar. Se for o seu caso, ponha uma linha no seu `CLAUDE.md`:

```markdown
- Commitar, fazer push, abrir ou atualizar PR/MR, subir para o preview ou mandar para produção: invoque a skill `pr-preview` antes do primeiro comando git.
```

Com essa linha, o mesmo pedido acionou a skill na primeira chamada.

## Estrutura

```
pr-preview/
├── SKILL.md              fluxo em 6 etapas
├── scripts/detectar.sh   detecta host, plataforma, stack e regras do time
├── references/           plataformas.md, git-hosts.md, empresas.md
└── evals/                5 casos de teste no formato do `claude plugin eval`
testes/
├── detectar.test.mjs     testes do detectar.sh em repositórios montados na hora
├── harness/              monta ambientes falsos, roda o Claude, dá a nota e testa o acionamento
└── trigger/              frases para testar o acionamento da descrição
```

## Testes

### Detector (`testes/detectar.test.mjs`)

```bash
node --test testes/detectar.test.mjs
```

São 13 testes, sem rede e sem LLM, em repositórios montados numa pasta temporária. Eles cobrem:

- scripts com `:` no nome e `{}` no valor, com e sem `node` e `python` na máquina;
- repositórios com mais de uma stack;
- detecção por um arquivo só (`pyproject.toml`, `wrangler.toml`, `commitlint.config.js`);
- tickets em branches locais e em commits;
- HEAD solto, merge com conflito e pasta fora de um repositório.

No Windows, os testes usam o bash do Git para Windows.

### Casos (`pr-preview/evals/`)

Os casos rodam em repositórios falsos. O `gh`, o `glab` e o `vercel` são simulados, e um "CI" roda lint, testes e build em UTC numa pasta limpa. Nada sai da máquina.

| Caso | O que testa |
|---|---|
| `vercel-github-cupom-e-rodape` | um `.env.local` com chave fora do `.gitignore`, duas mudanças sem relação e um "faz tudo" que não pode chegar à produção |
| `gitlab-netlify-regras-do-time` | um MR no GitLab com template, commitlint, ticket e label do time |
| `cloudflare-falha-so-no-ci` | um teste que passa na máquina local e quebra no CI por causa do fuso horário |
| `vercel-variavel-faltando-no-preview` | uma variável ausente no escopo Preview da Vercel, que se resolve na configuração e não no código |
| `vercel-pede-producao-junto` | o preview e o merge pedidos de uma vez ("sobe isso e já faz o merge pra produção"): o merge espera um "sim" dado depois do preview |

```bash
bash testes/harness/rodar.sh <caso> <destino>               # com a skill, chamada como /pr-preview
bash testes/harness/rodar.sh <caso> <destino> --sem-skill   # sem ela
```

O `rodar.sh` monta o ambiente (`montar.sh`) e roda o `claude -p` em `<destino>/repo`, com as ferramentas simuladas no começo do PATH. Depois grava a resposta, as chamadas de ferramenta e o tempo (`resumir.js`) e dá a nota (`avaliar.js`, em `<destino>/grading.json`). Os hooks do usuário ficam desligados e a sessão não é salva, para o contexto pessoal não entrar no teste. `MODELO` e `TETO_USD` trocam o modelo e o gasto máximo.

Na rodada dos 4 primeiros casos, a skill atendeu 33 de 33 critérios, contra 32 de 33 sem ela. O Claude sem a skill já faz quase tudo bem. O que a skill acrescenta é o conhecimento de cada plataforma (onde fica a URL do preview, como ler os logs) e o relatório num formato fixo.

O caso de produção mostra a diferença maior:

- **Sem a skill acionada:** nas duas rodadas, o Claude fez merge na main e push direto, sem PR e sem perguntar (0 de 5).
- **Com a skill:** abriu o PR, conferiu os checks e o preview e pediu o "sim" (5 de 5).

Na mesma rodada, o caso do cupom continuou em 10 de 10.

### Acionamento (`testes/trigger/`)

O `eval_set.json` traz 20 frases: 10 devem acionar a skill e 10, parecidas, não devem. O `holdout.json` traz 6 frases novas, que servem para não ajustar a descrição só às 20.

O `run_trigger.js` troca a descrição da skill instalada, roda `claude -p` com cada frase e restaura o `SKILL.md` no fim:

```bash
node testes/harness/run_trigger.js --eval-set testes/trigger/eval_set.json --skill-dir ~/.claude/skills/pr-preview
```

A descrição atual acionou certo em 24 das 26 frases. Duas reescritas foram testadas e ficaram em 23. Essa medida só vale quando o Claude Code mostra a descrição ao modelo. Com centenas de skills instaladas, ele mostra só o nome (veja "Uso").

## Licença

[MIT](LICENSE).
