#!/usr/bin/env bash
# Detecta o host Git, a plataforma de deploy, o gerenciador de pacotes e
# convenções do repositório. Rode da raiz do repo:
#   bash <caminho-da-skill>/scripts/detectar.sh [diretorio]
# Saída: linhas "chave=valor", fáceis de ler por humanos e por máquina.
# Plataformas podem aparecer mais de uma (ex.: Cloudflare + GitHub Actions).

set -u
cd "${1:-.}" || exit 1

out() { printf '%s=%s\n' "$1" "$2"; }
# Verdadeiro se existe pelo menos um dos caminhos (globs incluídos). "ls a b" falha se faltar qualquer um.
algum() { for f in "$@"; do [ -e "$f" ] && return 0; done; return 1; }

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
branch=$(git branch --show-current 2>/dev/null)
out branch_atual "$branch"

# O que pede atenção antes de commitar: HEAD solto, conflito, merge, rebase ou cherry-pick pela metade.
estado=""
gd=$(git rev-parse --git-dir)
[ -z "$branch" ] && estado="$estado detached_head"
{ [ -d "$gd/rebase-merge" ] || [ -d "$gd/rebase-apply" ]; } && estado="$estado rebase_em_andamento"
[ -f "$gd/MERGE_HEAD" ] && estado="$estado merge_em_andamento"
[ -f "$gd/CHERRY_PICK_HEAD" ] && estado="$estado cherry_pick_em_andamento"
[ -n "$(git diff --name-only --diff-filter=U 2>/dev/null)" ] && estado="$estado conflito"
estado=$(echo "$estado" | xargs)
out estado_git "${estado:-normal}"

padrao=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's#^origin/##')
[ -z "$padrao" ] && for b in main master develop; do
  git show-ref --verify --quiet "refs/remotes/origin/$b" && { padrao=$b; break; }
done
# Repo sem fetch ainda: cai para a branch local
[ -z "$padrao" ] && for b in main master develop; do
  git show-ref --verify --quiet "refs/heads/$b" && { padrao=$b; break; }
done
out branch_padrao "${padrao:-desconhecida}"

# ---------- Plataformas de deploy ----------
plataformas=""
add() { plataformas="$plataformas $1"; }

{ [ -f vercel.json ] || [ -f .vercel/project.json ]; } && add vercel
{ [ -f netlify.toml ] || [ -f .netlify/state.json ]; } && add netlify
algum wrangler.toml wrangler.json wrangler.jsonc && add cloudflare
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
# Nomes dos scripts do package.json. Com node ou python, lê o JSON de verdade. Sem eles, o grep
# preserva "test:unit", mas para no primeiro "}" dentro de um valor (como em "src/**/*.{ts,tsx}").
scripts_do_package() {
  node -e 'const p=JSON.parse(require("fs").readFileSync("package.json","utf8"));console.log(Object.keys(p.scripts||{}).join(" "))' 2>/dev/null && return
  python3 -c 'import json;print(" ".join(json.load(open("package.json",encoding="utf-8")).get("scripts",{})))' 2>/dev/null && return
  tr -d '\n\r' < package.json \
    | grep -oE '"scripts"[[:space:]]*:[[:space:]]*\{[^}]*\}' \
    | sed -E 's/^"scripts"[[:space:]]*:[[:space:]]*\{//' \
    | grep -oE '"[^"]+"[[:space:]]*:' | sed -E 's/^"(.*)"[[:space:]]*:$/\1/' | xargs
}

# Um repo pode ter mais de uma stack (front em Node e API em Python, por exemplo).
stacks=""
if [ -f package.json ]; then
  stacks=node
  if   [ -f pnpm-lock.yaml ]; then pm=pnpm
  elif [ -f yarn.lock ]; then pm=yarn
  elif [ -f bun.lockb ] || [ -f bun.lock ]; then pm=bun
  else pm=npm; fi
  out gerenciador "$pm"
  out scripts "$(scripts_do_package)"
  [ -f tsconfig.json ] && out typescript sim
fi
if algum pyproject.toml requirements.txt setup.py; then
  stacks="$stacks python"
  [ -f uv.lock ] && out gerenciador_python uv
  [ -f poetry.lock ] && out gerenciador_python poetry
fi
[ -f go.mod ] && stacks="$stacks go"
[ -f Cargo.toml ] && stacks="$stacks rust"
[ -f composer.json ] && stacks="$stacks php"
[ -f Gemfile ] && stacks="$stacks ruby"
[ -z "$stacks" ] && algum ./*.html && stacks=estatico
stacks=$(echo "$stacks" | xargs)
out stack "${stacks:-desconhecida}"

# ---------- Convenções do repositório (importantes em empresas) ----------
for f in .github/pull_request_template.md .github/PULL_REQUEST_TEMPLATE.md docs/pull_request_template.md PULL_REQUEST_TEMPLATE.md; do
  [ -f "$f" ] && { out template_pr "$f"; break; }
done
algum .github/PULL_REQUEST_TEMPLATE/*.md && out templates_pr_multiplos .github/PULL_REQUEST_TEMPLATE/
algum .gitlab/merge_request_templates/*.md && out template_mr .gitlab/merge_request_templates/
for f in CONTRIBUTING.md .github/CONTRIBUTING.md docs/CONTRIBUTING.md; do
  [ -f "$f" ] && { out contributing "$f"; break; }
done
for f in .github/CODEOWNERS CODEOWNERS docs/CODEOWNERS .gitlab/CODEOWNERS; do
  [ -f "$f" ] && { out codeowners "$f"; break; }
done
algum commitlint.config.* .commitlintrc* && out commitlint sim
{ [ -d .husky ] || [ -f .pre-commit-config.yaml ] || [ -f lefthook.yml ]; } && out hooks_git sim
[ -f .changeset/config.json ] && out changesets sim

# Ticket do Jira/Linear (PROJ-123) no nome das branches, locais e remotas (ex.: feat/PROJ-123-algo).
ticket=$(git branch -a --format='%(refname:short)' 2>/dev/null | grep -oE '[A-Z][A-Z0-9]+-[0-9]+' | head -1)
[ -n "$ticket" ] && out exemplo_ticket_em_branch "$ticket"
# Nos commits recentes, só no começo da linha, entre parênteses ou colchetes e depois de Refs:/Closes:.
# Solto no meio do texto, UTF-8 e SHA-256 seriam confundidos com ticket.
ticket=$(git log -15 --format=%B 2>/dev/null \
  | grep -oE '^\[?[A-Z][A-Z0-9]+-[0-9]+|[([][A-Z][A-Z0-9]+-[0-9]+[])]|^(Refs|Ref|Closes|Fixes|Resolves):? *[A-Z][A-Z0-9]+-[0-9]+' \
  | grep -oE '[A-Z][A-Z0-9]+-[0-9]+' | head -1)
[ -n "$ticket" ] && out exemplo_ticket_em_commit "$ticket"

exit 0
