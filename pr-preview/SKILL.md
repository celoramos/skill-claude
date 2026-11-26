---
name: pr-preview
description: Leva alterações locais até um preview no ar, de ponta a ponta e em qualquer plataforma - roda lint e testes, cria commits Conventional Commits em português, faz push numa branch, abre ou atualiza o PR/MR em português (GitHub, GitLab, Bitbucket, Azure DevOps), acompanha o deploy de preview (Vercel, Netlify, Cloudflare, Render, Railway, Fly.io, AWS Amplify, Firebase, GitHub Pages, Coolify ou CI próprio da empresa) e, se o build falhar, lê os logs e corrige. Respeita templates de PR, commitlint, tickets do Jira/Linear e regras do time. Use sempre que o usuário quiser subir, enviar, publicar, "shipar" ou fazer deploy de mudanças, abrir PR ou MR, commitar e mandar para o ar, ou disser coisas como "manda pro ar", "sobe isso", "abre o PR", "faz o deploy", "commita e envia", "quero ver isso no preview", mesmo sem citar a plataforma ou o Git.
---

# PR Preview: das alterações locais ao preview no ar

Um pedido como "sobe isso" deve terminar num preview funcionando e num PR pronto para revisão, sem o usuário lembrar de cada etapa. A produção só muda no merge, então tudo antes disso é reversível: ande sozinho até o preview e só pare antes de algo que mexa em produção.

```
1. Detectar → 2. Lint e testes → 3. Commits (PT) → 4. Push + PR/MR (PT) → 5. Acompanhar preview → 6. Relatório
                     ↑                                                             │
                     └────────────── build falhou: diagnosticar e corrigir ────────┘
```

Fale em português, com uma linha curta de progresso por etapa, sem despejar log.

## Referências

Leia só o que o caso pedir:
- `scripts/detectar.sh`: rode primeiro. Diz host Git, plataforma, stack e convenções do repo.
- `references/git-hosts.md`: comandos de PR/MR e de acompanhamento por host. Leia a seção do host detectado.
- `references/plataformas.md`: onde cada plataforma publica a URL do preview, o status e os logs, e as falhas típicas. Leia a seção da plataforma detectada.
- `references/empresas.md`: leia se houver sinais de time (template, CONTRIBUTING, commitlint, hooks, tickets, CODEOWNERS) ou host GitLab/Bitbucket/Azure. As regras do repo vencem os padrões desta skill.

## 1. Detectar e pré-checar

```bash
bash <diretório-desta-skill>/scripts/detectar.sh
```

- **Nada para enviar** (working tree limpa e nada à frente do remoto): diga isso e pare.
- **Branch:** se estiver na branch padrão, ou na branch de integração do time (`develop`, `staging`), crie uma branch nova antes de commitar. Commitar ali pula a revisão e, em várias plataformas, publica em produção. Use o padrão de nome do repo.
- **Login no host:** `gh auth status` / `glab auth status`. O push usa as credenciais do próprio Git (Credential Manager ou SSH), então siga com commit e push mesmo sem esse login. Ele só é necessário para abrir o PR/MR e ler os checks: se faltar, peça `! gh auth login` nesse ponto. Um conector do GitHub pode abrir o PR no lugar do `gh`, mas costuma não ter permissão de escrita no repo (erro 403).
- **Segredos:** confira cada arquivo que vai entrar no commit. Para um `.env`, chave ou token **ainda não versionado**: deixe-o fora do commit, adicione o padrão (`.env*.local`, `.env`) ao `.gitignore` num commit `chore` separado e avise o usuário. Assim o próximo `git add .` não o leva. Se o segredo **já está no histórico enviado**, pare e avise: a chave precisa ser trocada, e apagar o commit não resolve.
- **Sinais de time:** leia `references/empresas.md` agora, antes de commitar.

## 2. Lint, testes e o que o CI faz diferente

Rode os comandos do próprio projeto (os `scripts` que o `detectar.sh` lista): lint, typecheck e testes, com o gerenciador detectado e em modo de execução única (`CI=true`, `vitest run`). Em Python: ruff e pytest; Go: `go vet` e `go test`; estático puro: nada a rodar. O build fica para a plataforma.

**Se falhar:** não commite código quebrado. Corrija se a causa for clara e pequena e rode de novo. Se a correção mudar comportamento, pergunte antes. Se o usuário quiser subir mesmo assim, abra o PR como rascunho e registre a falha na descrição.

**Passar aqui não garante passar no CI.** O build do preview roda numa máquina limpa, quase sempre Linux, em UTC e sem os seus arquivos locais. Antes do push, olhe o diff com esses olhos:
- **Maiúsculas em caminhos:** Windows e macOS ignoram, Linux não. Confira se cada import bate letra por letra com o nome do arquivo (`git ls-files`).
- **Fuso horário e locale:** datas formatadas com `getDate()`, `toLocaleDateString()` ou `new Date('AAAA-MM-DD')` mudam de dia em UTC. Se o diff mexe com datas, rode os testes também com `TZ=UTC`.
- **Variáveis de ambiente:** o que está no seu `.env` local não existe no preview. Se o código passou a exigir uma variável nova, ela precisa estar configurada na plataforma, no escopo de preview.
- **Dependências e versão:** o CI instala do lockfile (`npm ci`, `--frozen-lockfile`) e usa a versão de Node/Python do workflow ou do `engines`.

Achar isso antes do push poupa uma rodada de CI. O que escapar é tratado na etapa 5.

## 3. Commits em português (Conventional Commits)

Leia o diff para entender o que mudou e por quê. Mudanças sem relação entre si (feature, correção em outro lugar, dependências) vão em commits separados, com `git add <arquivos>` específicos. Uma mudança só pede um commit só.

Formato: `<tipo>(<escopo>): <descrição>`. O tipo fica em inglês (`feat`, `fix`, `refactor`, `perf`, `style`, `test`, `docs`, `build`, `ci`, `chore`, `revert`). A descrição vai no imperativo, em minúscula, sem ponto final e com até ~72 caracteres, como em `fix(header): corrige menu sobrepondo conteúdo no mobile`. Corpo só quando o porquê não é óbvio. Quebra de compatibilidade: `!` e rodapé `BREAKING CHANGE:`.

Se o histórico (`git log --oneline -15`) ou o commitlint usa outro padrão, siga o repo. Se um hook falhar, corrija a causa e não use `--no-verify`.

## 4. Push e PR/MR em português

`git push -u origin <branch>`. Antes de criar, veja se já existe PR/MR para a branch; se existir, **atualize** em vez de abrir outro (comandos em `git-hosts.md`).

- **Base:** a branch padrão, ou `develop`/`staging` se o time faz PR para ela.
- **Título:** formato de commit, ou o formato do CONTRIBUTING.
- **Descrição:** se o repo tem template, preencha todas as seções. Senão: `## Resumo` (o que e por quê, para quem não viu o código), `## Mudanças`, `## Como testar` (passos concretos no preview) e `## Checklist` com o que realmente rodou. Termine com `🤖 Gerado com [Claude Code](https://claude.com/claude-code)`.
- Escreva o corpo num arquivo temporário e passe com `--body-file` (ou `"$(cat arquivo)"`), para preservar quebras de linha e acentos no Windows.

## 5. Acompanhar o preview

Com o repo conectado à plataforma, **o push já disparou o preview**. Não rode deploy manual (`vercel deploy`, `netlify deploy`, `wrangler deploy`, `fly deploy`): duplicaria o deploy e, em algumas plataformas, iria direto para produção.

1. **Status e URL pelo host Git primeiro.** Quase toda plataforma publica o resultado no PR/MR. No GitHub: `gh pr checks` e a Deployments API (`environment_url`). No GitLab: `glab ci status`, os commit statuses (`target_url`), os environments (`external_url`) e o comentário do bot no MR. Os comandos estão em `git-hosts.md`. Não pare no pipeline verde: a URL do preview costuma estar num desses lugares, e é ela que o usuário quer.
2. **CLI ou MCP da plataforma** (seção dela em `plataformas.md`) para o que o host não mostrar, principalmente os logs de build.
3. **Sem preview por PR** (GitHub Pages, Fly.io sem review apps, CI sem ambiente de review): diga isso, acompanhe só os checks e não invente URL.

Espere com `--watch` ou com checagens espaçadas. Acima de ~10 min, avise e pergunte se continua esperando.

### Quando o build ou um check falha

1. Leia o log do job que falhou (`gh run view <id> --log-failed`, `glab ci trace <job>` ou a seção da plataforma) e vá ao **primeiro** erro real.
2. Explique ao usuário em uma ou duas frases o que quebrou e por quê.
3. Classifique:
   - **Código** (caminho com maiúscula errada, data dependente de fuso, tipo, dependência ou lockfile, versão do Node): reproduza localmente se der (por exemplo `TZ=UTC npm test`), corrija, rode a etapa 2, commite `fix(<escopo>): <o que corrigiu>` na mesma branch, faça push e volte a acompanhar.
   - **Configuração da plataforma** (variável ausente no escopo de preview, secret, porta, flag de compatibilidade): não se corrige no código. Diga exatamente o que falta, onde configurar e em qual escopo. Só mude a configuração da conta (CLI ou MCP) com autorização explícita do usuário.
   - **Infra fora do controle** (credencial do CI expirada, runner fora do ar): avise e pare.
4. No máximo **2 tentativas** automáticas. Se ainda falhar, pare e mostre o que tentou. Insistir no escuro só gera commits de lixo.

Ao citar logs, não cole segredos, IPs internos nem dados de cliente.

## 6. Relatório final

```
✅ Preview no ar: <url>          (ou: ℹ️ Esta plataforma não gera preview por PR / ❌ Preview falhou: <motivo>)
🔀 PR #<n>: <url>
📝 Commits:
   - feat(auth): adiciona login com Google
🧪 Lint ok · 42 testes passaram · build em 1m12s (<plataforma>)
```

Liste com clareza o que ficou pendente para o usuário: variável a configurar, teste falhando aceito, aprovação de revisor.

## Produção: só com confirmação

Produção pode ser um merge na branch principal, uma tag, um release, um `promote` ou uma aprovação num ambiente protegido; o pipeline diz qual. Isso afeta usuários reais, então **não faça merge, tag, promote nem dispare workflow de produção sem um "sim" explícito do usuário nesta conversa**, mesmo que ele tenha dito "faz tudo" no começo. "Subir" significa preview.

Quando o usuário pedir produção: confirme que o preview está pronto e os checks passaram, mostre o que vai entrar e pergunte "Posso fazer o merge do PR #<n> e mandar para produção?". Com o "sim", faça o merge pelo método que o repo permite. Se o pipeline exige aprovação de outra pessoa, apenas avise. Depois, acompanhe o deploy como na etapa 5. Se o deploy de produção falhar, não corrija em loop: a versão anterior costuma seguir no ar. Mostre o erro e ofereça a correção numa branch nova.
