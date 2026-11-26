#!/usr/bin/env bash
# Detecta o host Git, a plataforma de deploy, o gerenciador de pacotes e
# convenções do repositório. Rode da raiz do repo:
#   bash <caminho-da-skill>/scripts/detectar.sh [diretorio]
# Saída: linhas "chave=valor", fáceis de ler por humanos e por máquina.
# Plataformas podem aparecer mais de uma (ex.: Cloudflare + GitHub Actions).

set -u
cd "${1:-.}" || exit 1

out() { printf '%s=%s\n' "$1" "$2"; }

# ---------- Repositório ----------
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  out erro "nao_e_repositorio_git"
  exit 1
fi

remote=$(git remote get-url origin 2>/dev/null || echo "")
case "$remote" in
  *github.com*)              host=github ;;
  *gitlab*)                  host=gitlab ;;   # gitlab.com e GitLab self-hosted costumam ter "gitlab" no domínio
  *bitbucket.org*)           host=bitbucket ;;
  *dev.azure.com*|*visualstudio.com*) host=azure-devops ;;
  "")                        host=sem-remoto ;;
  *)                         host=desconhecido ;;
esac
out git_host "$host"
out remote "$remote"
out branch_atual "$(git branch --show-current 2>/dev/null)"

padrao=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
[ -z "$padrao" ] && for b in main master develop; do
  git show-ref --verify --quiet "refs/remotes/origin/$b" && { padrao=$b; break; }
done
# Repo sem fetch ainda: cai para a branch local
[ -z "$padrao" ] && for b in main master; do
  git show-ref --verify --quiet "refs/heads/$b" && { padrao=$b; break; }
done
out branch_padrao "${padrao:-desconhecida}"

# ---------- Plataformas de deploy ----------
plataformas=""
add() { plataformas="$plataformas $1"; }

{ [ -f vercel.json ] || [ -f .vercel/project.json ]; } && add vercel
{ [ -f netlify.toml ] || [ -f .netlify/state.json ]; } && add netlify
ls wrangler.toml wrangler.json wrangler.jsonc >/dev/null 2>&1 && add cloudflare
{ [ -f render.yaml ] || [ -f render.yml ]; } && add render
{ [ -f railway.json ] || [ -f railway.toml ]; } && add railway
[ -f fly.toml ] && add fly
{ [ -f amplify.yml ] || [ -d amplify ]; } && add amplify
{ [ -f firebase.json ] || [ -f .firebaserc ]; } && add firebase
[ -f .do/app.yaml ] && add digitalocean
{ [ -f app.json ] && [ -f Procfile ]; } && add heroku
[ -f staticwebapp.config.json ] && add azure-static-web-apps

wf_dir=.github/workflows
if [ -d "$wf_dir" ]; then
  wf=$(cat "$wf_dir"/*.yml "$wf_dir"/*.yaml 2>/dev/null)
  echo "$wf" | grep -qE 'actions/deploy-pages|peaceiris/actions-gh-pages|JamesIves/github-pages-deploy' && add github-pages
  echo "$wf" | grep -q 'Azure/static-web-apps-deploy' && case "$plataformas" in *azure-static*) ;; *) add azure-static-web-apps ;; esac
  echo "$wf" | grep -q 'superfly/' && case "$plataformas" in *fly*) ;; *) add fly ;; esac
  echo "$wf" | grep -q 'cloudflare/wrangler-action' && case "$plataformas" in *cloudflare*) ;; *) add cloudflare ;; esac
  echo "$wf" | grep -qiE 'deploy|kubectl|helm|aws-actions|google-github-actions|azure/' && add github-actions-ci
fi
[ -f .gitlab-ci.yml ] && add gitlab-ci
[ -f bitbucket-pipelines.yml ] && add bitbucket-pipelines
[ -f azure-pipelines.yml ] && add azure-pipelines
{ [ -f cloudbuild.yaml ] || [ -f cloudbuild.yml ]; } && add google-cloud-build
{ [ -d k8s ] || [ -d kubernetes ] || [ -d helm ] || [ -f Chart.yaml ] || [ -d charts ]; } && add kubernetes
[ -f Dockerfile ] && out tem_dockerfile sim

plataformas=$(echo "$plataformas" | xargs)
out plataformas "${plataformas:-nenhuma_detectada}"

# ---------- Stack / comandos ----------
if [ -f package.json ]; then
  if   [ -f pnpm-lock.yaml ]; then pm=pnpm
  elif [ -f yarn.lock ]; then pm=yarn
  elif [ -f bun.lockb ] || [ -f bun.lock ]; then pm=bun
  else pm=npm; fi
  out stack node
  out gerenciador "$pm"
  scripts=$(tr -d '\n\r' < package.json \
    | grep -oE '"scripts"[[:space:]]*:[[:space:]]*\{[^}]*\}' \
    | sed -E 's/^"scripts"[[:space:]]*:[[:space:]]*\{//' \
    | grep -oE '"[^"]+"[[:space:]]*:' | tr -d '":' | xargs)
  out scripts "$scripts"
  [ -f tsconfig.json ] && out typescript sim
elif ls pyproject.toml requirements.txt setup.py >/dev/null 2>&1; then
  out stack python
  [ -f uv.lock ] && out gerenciador uv
  [ -f poetry.lock ] && out gerenciador poetry
elif [ -f go.mod ]; then out stack go
elif [ -f Cargo.toml ]; then out stack rust
elif [ -f composer.json ]; then out stack php
elif [ -f Gemfile ]; then out stack ruby
elif ls ./*.html >/dev/null 2>&1; then out stack estatico
else out stack desconhecida; fi

# ---------- Convenções do repositório (importantes em empresas) ----------
for f in .github/pull_request_template.md .github/PULL_REQUEST_TEMPLATE.md docs/pull_request_template.md PULL_REQUEST_TEMPLATE.md; do
  [ -f "$f" ] && { out template_pr "$f"; break; }
done
ls .github/PULL_REQUEST_TEMPLATE/*.md >/dev/null 2>&1 && out templates_pr_multiplos .github/PULL_REQUEST_TEMPLATE/
ls .gitlab/merge_request_templates/*.md >/dev/null 2>&1 && out template_mr .gitlab/merge_request_templates/
for f in CONTRIBUTING.md .github/CONTRIBUTING.md docs/CONTRIBUTING.md; do
  [ -f "$f" ] && { out contributing "$f"; break; }
done
for f in .github/CODEOWNERS CODEOWNERS docs/CODEOWNERS .gitlab/CODEOWNERS; do
  [ -f "$f" ] && { out codeowners "$f"; break; }
done
ls commitlint.config.* .commitlintrc* >/dev/null 2>&1 && out commitlint sim
{ [ -d .husky ] || [ -f .pre-commit-config.yaml ] || [ -f lefthook.yml ]; } && out hooks_git sim
[ -f .changeset/config.json ] && out changesets sim

# Ticket no nome das branches recentes (ex.: feat/PROJ-123-algo) -> Jira/Linear
ticket=$(git branch -r 2>/dev/null | grep -oE '[A-Z][A-Z0-9]+-[0-9]+' | head -1)
[ -n "$ticket" ] && out exemplo_ticket_em_branch "$ticket"

exit 0
