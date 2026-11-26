# Hosts Git: GitHub, GitLab, Bitbucket, Azure DevOps

Leia a seção do host detectado (`git_host=` no `detectar.sh`). O vocabulário muda: no GitLab é **Merge Request (MR)**, não PR. Use o termo certo com o usuário.

## GitHub (`gh`)

- Login: `gh auth status` → se falhar, peça `! gh auth login`.
- PR existente: `gh pr view --json number,url,state 2>/dev/null`
- Criar: `gh pr create --base <padrao> --title "<titulo>" --body-file <arquivo>` (escreva o corpo num arquivo temporário para preservar quebras de linha e acentos no Windows)
- Atualizar: leia antes o que está lá (`gh pr view <n> --json title,body`), mantenha o que o usuário escreveu e as caixas que ele marcou, e então `gh pr edit <n> --title ... --body-file ...`
- Rascunho: `--draft` quando o usuário disser "ainda não está pronto" ou quando os testes estiverem falhando
- Reviewers: `--reviewer user1,user2` só se o usuário pedir. Se houver CODEOWNERS, o GitHub atribui sozinho
- **Acompanhar checks e deploys (vale para qualquer plataforma integrada ao GitHub):**
  - `gh pr checks <n> --watch --fail-fast` espera todos os checks; o código de saída 8 significa pendente
  - `gh pr checks <n> --json name,state,link,bucket` para ler o resultado
  - URL do preview pela API de Deployments, que é a forma mais confiável e funciona para Vercel, Netlify, Render, Railway, Amplify, Cloudflare e Coolify, entre outras:
    ```
    gh api "repos/{owner}/{repo}/deployments?sha=$(git rev-parse HEAD)" --jq '.[] | {id, environment}'
    gh api "repos/{owner}/{repo}/deployments/<id>/statuses" --jq '.[0] | {state, environment_url, log_url}'
    ```
    `state`: `pending`/`in_progress`/`queued` → esperando; `success` → pronto (`environment_url` é o preview); `failure`/`error` → falhou (`log_url` aponta para os logs). Lista de deployments vazia ou `null` no `.[0]`: a plataforma ainda não registrou o deploy ou o primeiro status. Espere alguns segundos e consulte de novo antes de concluir que não há preview.
  - Alguns provedores comentam a URL no PR em vez de usar deployments: `gh pr view <n> --comments`
- Merge (só com confirmação): `gh pr merge <n> --squash --delete-branch`; veja quais métodos o repo permite com `gh repo view --json squashMergeAllowed,mergeCommitAllowed,rebaseMergeAllowed`

## GitLab (`glab`)

- Instalação: `winget install glab` / `brew install glab`. Login: `glab auth login` (para GitLab self-hosted: `glab auth login --hostname gitlab.empresa.com`)
- MR existente: `glab mr view <branch>` (ou `glab mr list --source-branch <branch>`)
- Criar: `glab mr create --target-branch <padrao> --title "<titulo>" --description "$(cat arquivo.md)" --remove-source-branch`
  - `--draft` para rascunho, `--assignee @me`, `--label ...`
  - Se o repo tem `.gitlab/merge_request_templates/`, use o template padrão (`Default.md`) como base
- Atualizar: leia antes a descrição atual (`glab mr view <n>`), mantenha o que o usuário escreveu e marcou, e então `glab mr update <n> --title ... --description ...`
- **Pipeline:** `glab ci status --live` (acompanha), `glab ci view`, `glab ci trace <job>` (log do job que falhou)
- **URL do preview (qualquer plataforma integrada ao GitLab):** procure em três lugares, nesta ordem:
  1. Commit statuses: `glab api "projects/:id/repository/commits/$(git rev-parse HEAD)/statuses"` → `name` e `target_url`. É aqui que Netlify, Vercel e Cloudflare publicam no GitLab.
  2. Environments: `glab api "projects/:id/environments?search=review/"` → `external_url`.
  3. Comentários de bot no MR: `glab api "projects/:id/merge_requests/<iid>/notes"`.
  O pipeline do GitLab CI (`glab ci status`) mostra só os jobs do `.gitlab-ci.yml`. Não confunda pipeline verde com preview pronto.
- **Review Apps / environments:** no GitLab, o preview costuma ser um job com `environment: review/$CI_COMMIT_REF_SLUG` no `.gitlab-ci.yml`. A URL aparece no MR ("View app") e via `glab api "projects/:id/environments?search=review/"` → campo `external_url`.
- Alternativa no push: `git push -o merge_request.create -o merge_request.target=<padrao> -o merge_request.title="<titulo>"` cria o MR sem precisar do glab.

## Bitbucket

Não existe CLI oficial da Atlassian. Em ordem de preferência:
1. Se houver MCP do Atlassian/Bitbucket conectado, use-o para criar o PR e ler o status do pipeline.
2. API REST com token (o usuário precisa fornecer um *app password* / *API token*; nunca peça a senha dele):
   `POST https://api.bitbucket.org/2.0/repositories/{workspace}/{repo}/pullrequests` com `title`, `description`, `source.branch.name`, `destination.branch.name`.
3. Sem nenhum dos dois: faça o push, monte o link `https://bitbucket.org/{workspace}/{repo}/pull-requests/new?source=<branch>&dest=<padrao>` e entregue o título e a descrição prontos para o usuário colar.
- Pipelines: `bitbucket-pipelines.yml`. Status via API `.../pipelines/?sort=-created_on`, com logs em `.../pipelines/{uuid}/steps/{step}/log`.

## Azure DevOps

- CLI: `az repos pr create --source-branch <b> --target-branch <padrao> --title ... --description ...` (requer `az extension add --name azure-devops` e `az login`)
- Pipeline: `az pipelines runs list --branch <b> --top 1`, `az pipelines runs show --id <id>`
- Muitas empresas exigem **work item** vinculado: `--work-items <id>`. Pergunte o número se a política do repo exigir.

## Sem remoto / host desconhecido

Faça só os commits locais, explique que não há para onde enviar e pergunte se o usuário quer adicionar um remoto.
