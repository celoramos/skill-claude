# Plataformas de deploy

Leia só a seção da plataforma detectada (`plataformas=` no `detectar.sh`). Se aparecerem várias (ex.: `cloudflare github-actions-ci`), a que deploya o preview é a que publica status no PR. Confira com `gh pr checks` depois do push.

**Regra geral para todas:** quando o repo está conectado à plataforma pelo Git, o push já dispara o preview. Não rode o comando de deploy manual (`vercel deploy`, `netlify deploy`, `wrangler deploy`...), porque isso gera um deploy duplicado e, em algumas plataformas, vai direto para produção. O comando manual só entra se a plataforma **não** estiver conectada ao Git e o usuário pedir.

**Caminho universal (GitHub):** quase todas as plataformas abaixo publicam um *deployment* ou um *check* no GitHub. Use primeiro o método genérico de `git-hosts.md` (Deployments API + `gh pr checks`) para descobrir o status e a URL. Use a CLI/MCP da plataforma só para **ler os logs** quando falhar, ou quando o genérico não trouxer nada.

## Índice
- [Vercel](#vercel) · [Netlify](#netlify) · [Cloudflare](#cloudflare-workers--pages) · [Render](#render) · [Railway](#railway) · [Fly.io](#flyio)
- [AWS Amplify](#aws-amplify) · [Firebase Hosting](#firebase-hosting) · [GitHub Pages](#github-pages) · [Azure Static Web Apps](#azure-static-web-apps)
- [Heroku](#heroku) · [DigitalOcean App Platform](#digitalocean-app-platform) · [Coolify / self-hosted](#coolify-e-outros-self-hosted)
- [CI próprio (GitHub Actions / GitLab CI → Kubernetes, ECS, Cloud Run...)](#ci-próprio)

---

## Vercel
- **Preview:** automático por push/PR; o bot comenta a URL no PR.
- **Status:** Vercel MCP `list_deployments` (filtrar por SHA/branch) → `get_deployment`. CLI: `vercel ls`, `vercel inspect <url>`.
- **Logs:** MCP `list_deployment_events`; CLI `vercel inspect --logs <url>`. Erros em runtime: MCP `get_runtime_errors`/`get_runtime_logs`.
- **Falhas comuns:** variável de ambiente ausente no escopo *Preview*; maiúsculas em imports (Linux diferencia); versão do Node (`engines.node` / Settings); `outputDirectory` errado em projetos não-Next.
- **Variáveis:** `vercel env add NOME preview` ou MCP `create_project_env`, mas só com autorização do usuário.
- **Produção:** merge na branch de produção; ou `vercel promote <url>`.

## Netlify
- **Detecção:** `netlify.toml`, `.netlify/state.json` (tem o `siteId`).
- **Preview:** *Deploy Previews* automáticos por PR/MR (URL `deploy-preview-<n>--<site>.netlify.app`); o bot comenta no PR e publica um check.
- **Achar a URL:** no GitHub, pelo check/deployment do PR. No **GitLab**, o Netlify não cria environment: publica um *commit status* (`netlify/<site>/deploy-preview`, com a URL em `target_url`) e comenta no MR. Use `glab api "projects/:id/repository/commits/<sha>/statuses"` ou `glab api "projects/:id/merge_requests/<iid>/notes"`. O pipeline do GitLab CI ficar verde não significa que o preview saiu: são coisas separadas.
- **Status:** `netlify api listSiteDeploys --data '{"site_id":"<id>"}'` e filtre pelo `commit_ref`/`branch`; estados: `building`, `ready`, `error`. Ou `netlify api getDeploy --data '{"deploy_id":"<id>"}'`.
- **Logs:** o campo `error_message` do deploy já resume a falha; log completo pela URL `https://app.netlify.com/sites/<site>/deploys/<id>`. CLIs recentes têm `netlify logs` (functions/deploys; `--json`).
- **Falhas comuns:** `publish`/`base` errados no `netlify.toml`; Node: defina `NODE_VERSION` ou `.nvmrc`; variáveis com escopo de contexto (production vs deploy-preview); plugin de build falhando.
- **Produção:** merge na branch de produção. Manual: `netlify deploy --prod` (pede confirmação).

## Cloudflare (Workers / Pages)
- **Detecção:** `wrangler.toml`/`wrangler.json(c)`; workflow com `cloudflare/wrangler-action`.
- **Preview:** com *Workers Builds* conectado ao Git, cada PR gera uma Preview/Version URL e o bot comenta no PR. *Worker Previews* (Wrangler ≥ 4.135) criam ambientes isolados por branch: `npx wrangler preview --name <nome> --json`; apague ao fechar o PR com `wrangler preview delete --name <nome>`. Pages: preview por branch em `<hash>.<projeto>.pages.dev`.
- **Status:** check/comentário no PR; `npx wrangler deployments list`, `npx wrangler versions list`; Pages: `npx wrangler pages deployment list --project-name <p>`.
- **Logs:** os logs de build ficam no dashboard (Deployments → View build history) ou, se o build roda em GitHub Actions, em `gh run view --log-failed`. Atenção: Preview/Version URLs comuns **não** têm logs de runtime (`wrangler tail` não funciona nelas); Worker Previews têm a aba Observability.
- **Falhas comuns:** falta `compatibility_flags = ["nodejs_compat"]` para libs que usam APIs do Node; `compatibility_date` antiga; bundle acima do limite; secrets não definidos (`wrangler secret put`); bindings (KV/D1/R2) que não existem no ambiente de preview.
- **Produção:** merge na branch de produção; manual `wrangler deploy` vai **direto para produção**, então confirme antes.

## Render
- **Detecção:** `render.yaml` (Blueprint).
- **Preview:** *Preview Environments* precisam de `previews.generation: automatic` (ou `manual`, ativado com `[render preview]` no **título** do PR) no `render.yaml`; também há *Service Previews* por serviço. Padrão: desligado. Para pular um PR: `[skip render]` no título.
- **Status:** `render deploys list <serviceId> -o json` (estado `live`, `build_failed`, `update_failed`...); check no PR.
- **Logs:** `render logs -r <serviceId>` (runtime; `--tail` para acompanhar). O log de build fica ligado ao deploy, então veja pelo `render deploys list` ou pelo dashboard.
- **Falhas comuns:** o app não escuta em `0.0.0.0:$PORT` (o health check falha e o deploy fica `update_failed`); `buildCommand`/`startCommand` errados; variáveis que estão no serviço de produção mas não no grupo usado pelo preview.
- **Produção:** merge, com auto-deploy da branch.

## Railway
- **Detecção:** `railway.json`/`railway.toml`.
- **Preview:** *PR Environments* (ativar em Project Settings → Environments); cada PR vira um ambiente temporário que some no merge/fechamento. Só funciona com o serviço conectado ao GitHub, não via `railway up`.
- **Status:** check/comentário no PR; `railway status`; `railway environment` para trocar para o ambiente do PR.
- **Logs:** `railway logs --build` (build) e `railway logs --deployment` (runtime), com `-e <ambiente>` para o ambiente do PR.
- **Falhas comuns:** porta (use `$PORT`); detecção errada do builder (Railpack/Nixpacks), então defina `startCommand`; banco do PR vazio (precisa de seed); variáveis que não foram copiadas para o ambiente do PR.
- **Produção:** merge, com o ambiente `production` seguindo a branch padrão.

## Fly.io
- **Detecção:** `fly.toml`; workflows com `superfly/`.
- **Preview:** **não há preview nativo**. O padrão é um workflow de GitHub Actions com `superfly/fly-pr-review-apps`, que cria um app `pr-<n>-<app>` por PR. Se o repo não tiver isso, avise que não haverá preview e ofereça criar o workflow (precisa do secret `FLY_API_TOKEN` via `fly tokens create deploy`).
- **Status:** `gh run watch` no workflow; `fly status -a <app>`; `fly releases -a <app>`.
- **Logs:** `fly logs -a <app> --no-tail`; build no Actions: `gh run view --log-failed`.
- **Falhas comuns:** `internal_port` no `fly.toml` diferente da porta real; health check falhando; falta de memória (OOM), então aumente `memory` no `[[vm]]`; secrets ausentes (`fly secrets set`).
- **Produção:** `fly deploy` (direto em produção) ou workflow de deploy no merge, sempre com confirmação.

## AWS Amplify
- **Detecção:** `amplify.yml`, pasta `amplify/`.
- **Preview:** *Previews* precisam ser ativadas no console (Hosting → Previews); cada PR vira uma branch `pr-<n>`. Só funciona em repositório privado.
- **Status:** `aws amplify list-jobs --app-id <id> --branch-name pr-<n> --max-items 1` → `aws amplify get-job --app-id <id> --branch-name pr-<n> --job-id <job>` (status `PENDING/RUNNING/SUCCEED/FAILED`).
- **Logs:** `get-job` devolve `steps[].logUrl` (link temporário para o log de cada etapa); baixe com `curl` e leia a etapa que falhou.
- **Falhas comuns:** spec do `amplify.yml` (comandos/`baseDirectory`); versão do Node (`nvm use` no `preBuild`); variáveis definidas só na branch principal; limites do SSR compute.
- **Produção:** merge, com auto-build da branch principal.

## Firebase Hosting
- **Detecção:** `firebase.json`, `.firebaserc`.
- **Preview:** *preview channels*. Com o workflow `FirebaseExtended/action-hosting-deploy`, cada PR ganha um canal e a URL é comentada. Manual: `firebase hosting:channel:deploy pr-<n> --expires 7d` (seguro, não toca produção).
- **Status/Logs:** `gh run watch` / `gh run view --log-failed`; `firebase hosting:channel:list`.
- **Falhas comuns:** `public` errado no `firebase.json`; rewrites de SPA ausentes; service account do Actions sem permissão.
- **Produção:** `firebase deploy --only hosting` ou workflow no merge, com confirmação.

## GitHub Pages
- **Detecção:** workflow com `actions/deploy-pages` ou `peaceiris/actions-gh-pages`.
- **Preview:** **não tem preview por PR** nativo. No PR rodam só os checks; o deploy acontece no merge. Diga isso ao usuário.
- **Status/Logs:** `gh run list --branch <b>`, `gh run watch`, `gh run view --log-failed`.
- **Falhas comuns:** `base` do Vite / `basePath` do Next diferente do nome do repo (assets dão 404); SPA sem `404.html`; Pages não habilitado em Settings.

## Azure Static Web Apps
- **Detecção:** `staticwebapp.config.json`; workflow com `Azure/static-web-apps-deploy`.
- **Preview:** o workflow cria um *staging environment* por PR e comenta a URL. O PR fechado precisa do job `close_pull_request` para limpar.
- **Status/Logs:** `gh run watch` / `gh run view --log-failed`.
- **Falhas comuns:** `app_location`/`output_location` errados; limite de ambientes de staging atingido (apague os antigos).

## Heroku
- **Detecção:** `Procfile` + `app.json`.
- **Preview:** *Review Apps* (precisa de pipeline + `app.json`); URL no PR/dashboard.
- **Status/Logs:** `heroku builds -a <app>`, `heroku builds:output -a <app>`, `heroku logs -a <app> --tail`.
- **Falhas comuns:** buildpack errado; `web` ausente no Procfile; app não usa `$PORT`.

## DigitalOcean App Platform
- **Detecção:** `.do/app.yaml`.
- **Status/Logs:** `doctl apps list-deployments <app-id>`, `doctl apps logs <app-id> --type build` (ou `--type run`).
- **Preview:** sem preview por PR nativo amplamente usado. Trate como CI próprio se houver workflow.

## Coolify e outros self-hosted
(Coolify, Dokploy, CapRover, Kamal...) Nada disso costuma deixar arquivo no repo. Identifique pelos checks/comentários no PR.
- **Preview (Coolify):** *Preview Deployments* via GitHub App; a URL segue um template com o número do PR e aparece em comentário/deployment no PR. As variáveis de preview são **separadas** das de produção, que não são repassadas.
- **Status/Logs:** comentário/deployment no PR; logs no painel ou pela API do Coolify (`/api/v1/deployments`, com token). Se houver um MCP do Coolify conectado, use-o.
- **Segurança:** previews de PRs de forks executam código de terceiros no servidor da empresa. Não habilite isso por conta própria.

## CI próprio
Empresas maiores costumam ter pipeline próprio: GitHub Actions / GitLab CI / Bitbucket Pipelines / Azure Pipelines / Cloud Build deployando em Kubernetes, ECS, Cloud Run, App Service etc.
- **Entenda o pipeline antes de agir:** leia os workflows (`.github/workflows/`, `.gitlab-ci.yml`) para saber o que roda no PR (geralmente testes + ambiente de review/staging) e o que roda no merge/tag (produção).
- **Status:** GitHub `gh run list --branch <b> --limit 5`, `gh run watch <id>`; GitLab `glab ci status --live`.
- **Logs:** `gh run view <id> --log-failed`; GitLab `glab ci trace <job>`.
- **URL do ambiente:** Deployments API (GitHub) ou environments (GitLab). Se o pipeline não publica URL, diga isso. Não invente uma.
- **Nunca** dispare manualmente um workflow de deploy (`gh workflow run`, jobs `when: manual` do GitLab) que aponte para produção sem confirmação explícita. Em empresas, isso costuma exigir aprovação de outras pessoas e mexe com clientes reais.
- **Falhas comuns:** credenciais/OIDC do CI expiradas (não é problema do código, então avise quem cuida da infra); imagem Docker que não builda; migração de banco falhando; testes de integração que dependem de serviços externos.
