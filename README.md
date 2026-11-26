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

No Windows, a pasta fica em `%USERPROFILE%\.claude\skills\` e os scripts rodam no Git Bash.

A skill precisa de `git` e `bash`. O push usa as credenciais do próprio Git. Para abrir o PR/MR e ler os checks, ela usa o `gh` (GitHub) ou o `glab` (GitLab), com login feito.

### Uso

Peça em linguagem natural, sem citar a plataforma:

- "terminei o filtro de busca, sobe isso pra eu ver no preview"
- "commita tudo e abre o PR"
- "manda pro ar"

## Estrutura

```
pr-preview/
├── SKILL.md              fluxo em 6 etapas
├── scripts/detectar.sh   detecta host, plataforma, stack e regras do time
├── references/           plataformas.md, git-hosts.md, empresas.md
└── evals/                4 casos de teste no formato do `claude plugin eval`
testes/
├── harness/              monta ambientes falsos, dá a nota e testa o acionamento
└── trigger/              frases para testar o acionamento da descrição
```

## Testes

### Casos (`pr-preview/evals/`)

Os casos rodam em repositórios falsos. O `gh`, o `glab` e o `vercel` são simulados, e um "CI" roda lint, testes e build em UTC numa pasta limpa. Nada sai da máquina.

| Caso | O que testa |
|---|---|
| `vercel-github-cupom-e-rodape` | um `.env.local` com chave fora do `.gitignore`, duas mudanças sem relação e um "faz tudo" que não pode chegar à produção |
| `gitlab-netlify-regras-do-time` | um MR no GitLab com template, commitlint, ticket e label do time |
| `cloudflare-falha-so-no-ci` | um teste que passa na máquina local e quebra no CI por causa do fuso horário |
| `vercel-variavel-faltando-no-preview` | uma variável ausente no escopo Preview da Vercel, que se resolve na configuração e não no código |

```bash
bash testes/harness/montar.sh <caso> <destino>   # cria o repo, o remoto e as ferramentas simuladas
# rode o Claude em <destino>/repo com <destino>/bin no começo do PATH
# e salve a resposta final em <destino>/resposta.md
node testes/harness/avaliar.js <destino> <caso> grading.json
```

Na última rodada, a skill atendeu 33 de 33 critérios, contra 32 de 33 sem ela. O Claude sem a skill já faz quase tudo bem. O que a skill acrescenta é o conhecimento de cada plataforma (onde fica a URL do preview, como ler os logs) e o relatório num formato fixo.

### Acionamento (`testes/trigger/`)

O `eval_set.json` traz 20 frases: 10 devem acionar a skill e 10, parecidas, não devem. O `holdout.json` traz 6 frases novas, que servem para não ajustar a descrição só às 20.

O `run_trigger.js` troca a descrição da skill instalada, roda `claude -p` com cada frase e restaura o `SKILL.md` no fim:

```bash
node testes/harness/run_trigger.js --eval-set testes/trigger/eval_set.json --skill-dir ~/.claude/skills/pr-preview
```

A descrição atual acionou certo em 24 das 26 frases. Duas reescritas foram testadas e ficaram em 23.

## Licença

[MIT](LICENSE).
