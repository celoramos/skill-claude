# Repositórios de empresa e times

Em projeto pessoal, o padrão da skill basta. Em repositório de time, **as regras do repo vencem as da skill**: um PR que ignora o template ou o padrão de commit da empresa vai ser devolvido na revisão. Leia esta referência quando o `detectar.sh` indicar qualquer um destes sinais: `template_pr`, `contributing`, `codeowners`, `commitlint`, `hooks_git`, `changesets`, `exemplo_ticket_em_branch`, ou host `gitlab`/`bitbucket`/`azure-devops`.

## O que ler antes de commitar
- **CONTRIBUTING.md:** regras de branch, commit, PR, quem revisa. Siga à risca.
- **Template de PR/MR:** preencha *todas* as seções do template, em português (ou no idioma que o template usa; se o template está em inglês e o time escreve PRs em inglês no histórico, pergunte ao usuário qual prefere). Não apague seções nem checkboxes. Marque só o que é verdade.
- **Histórico:** `git log --oneline -20` e `gh pr list --state merged --limit 5` mostram o padrão real do time (idioma, escopos usados, tamanho das descrições).

## Padrão de commit
- **commitlint:** se existir, leia o config (`commitlint.config.*`). Ele pode restringir tipos, escopos permitidos (`scope-enum`) e tamanho. Valide a mensagem antes: `npx commitlint --edit` ou `echo "<msg>" | npx commitlint`.
- **Hooks (husky, lefthook, pre-commit):** rodam lint/testes no commit. Se um hook falhar, **corrija o problema**. Nunca use `--no-verify`, porque isso fura a regra do time e o CI vai barrar de qualquer jeito.
- **Changesets:** se `.changeset/` existe e a mudança afeta um pacote publicado, crie o changeset (`npx changeset`, escolhendo patch/minor/major de acordo com o tipo do commit).
- **Assinatura de commit (GPG/SSH):** se o repo exige commits assinados e o commit falhar por isso, avise o usuário; não desative a assinatura.

## Tickets (Jira, Linear, Azure Boards...)
- Se as branches do repo carregam ID de ticket (`feat/PROJ-123-...`), **pergunte o número do ticket** antes de criar a branch, a menos que já esteja na conversa ou no nome da branch atual.
- Coloque o ID onde o time coloca: no nome da branch, no rodapé do commit (`Refs: PROJ-123`) e/ou no título do PR (`[PROJ-123] feat(auth): ...`). Siga o histórico.
- Linear/Jira fecham o ticket sozinhos com palavras-chave (`Closes PROJ-123`, `Fixes ENG-42`) na descrição do PR. Use apenas se o usuário disser que o PR resolve o ticket.

## Branches e revisão
- **Nome da branch:** siga o padrão do repo (`feature/` vs `feat/`, com ou sem ticket, com ou sem usuário: `marcelo/fix-header`).
- **Branch protegida:** nunca tente push direto na branch padrão; se o push for rejeitado por proteção, isso é o esperado. Abra o PR.
- **CODEOWNERS:** o GitHub/GitLab atribui revisores sozinho. Não adicione revisores extras sem pedido.
- **PR grande:** se o diff passar de ~400 linhas ou misturar assuntos sem relação, sugira dividir em PRs menores. Revisores de empresa aprovam mais rápido PRs pequenos.
- **Draft:** abra como rascunho quando o trabalho estiver incompleto ou quando o usuário quiser feedback cedo.

## Ambientes e produção
- Em empresa, "produção" pode ser um merge na `main`, uma tag (`v1.4.0`), um release no GitHub, ou uma aprovação manual num ambiente protegido. Leia o pipeline para saber qual é. A regra da skill continua: **nada que leve à produção sem um "sim" explícito do usuário**, e se o pipeline exige aprovação de outra pessoa, apenas avise o usuário. Não tente contornar.
- Staging/homologação: muitos times têm um ambiente intermediário (`develop` → staging). Se o fluxo do repo é PR para `develop`, use `develop` como base do PR, mesmo que a branch padrão seja `main`. O CONTRIBUTING ou o histórico de PRs mergeados indicam isso.

## Segurança extra
- Não cole logs de build com segredos, IPs internos ou dados de cliente no PR ou em comentários públicos. Resuma o erro.
- Não altere configurações de CI, secrets ou variáveis de ambiente compartilhadas sem pedir. Elas afetam o time todo.
