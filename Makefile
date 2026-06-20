# Anvilry Portfolio — Beast-Mode Ops Runbook
# ─────────────────────────────────────────────────────────────────────────────
# Usage: make <target>   or   make help
# Every target has a ## comment — `make help` renders them automatically.
# ─────────────────────────────────────────────────────────────────────────────

SHELL := /bin/bash
.SHELLFLAGS := -euo pipefail -c
.DEFAULT_GOAL := help

# ANSI colors
CYAN  := \033[36m
YELLOW := \033[33m
WHITE := \033[97m
RESET := \033[0m
BOLD  := \033[1m

# Production URL
PROD_URL := https://anvilry.vercel.app

# ─────────────────────────────────────────────────────────────────────────────
# HELP
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: help
help: ## Show this help
	@printf "\n\033[1m\033[36mAnvilry Portfolio — Beast-Mode Ops\033[0m\n\n"
	@awk 'BEGIN {FS = ":.*##"} \
		/^[a-zA-Z_-]+:.*##/ { \
			printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 \
		} \
		/^## / { \
			printf "\n\033[33m%s\033[0m\n", substr($$0, 4) \
		}' $(MAKEFILE_LIST)
	@printf "\n\033[97mScaffold usage:\033[0m\n"
	@printf "  make new-article SLUG=how-tcp-works SOURCE=medium URL=https://...\n"
	@printf "  make new-note    SLUG=tcp-internals\n"
	@printf "  make new-project SLUG=my-tool\n"
	@printf "  make new-work    SLUG=acme-platform\n"
	@printf "  make trace       TRACE_ID=abc123\n\n"

## Development

.PHONY: dev
dev: ## Start dev server (Velite watches content/, hot-reload)
	pnpm dev

.PHONY: test
test: ## Run full vitest suite once
	pnpm test

.PHONY: test-watch
test-watch: ## Vitest in watch/HMR mode
	pnpm test:watch

.PHONY: lint
lint: ## ESLint across entire project
	pnpm lint

.PHONY: build
build: ## Full production build: velite --clean + vitest + next build
	pnpm build

.PHONY: search-index
search-index: ## Generate Pagefind search index from production build (run after make build)
	pnpm pagefind --site .next/server/app --output-path public/pagefind

.PHONY: start
start: ## Serve the production build locally (run `make build` first)
	pnpm start

.PHONY: clean
clean: ## Wipe all caches: .next .velite .turbo node_modules/.cache
	pnpm clean

.PHONY: install
install: ## Install / sync dependencies
	pnpm install

## Content

.PHONY: content
content: ## Force-regenerate all Velite collections (MDX → .velite/)
	pnpm content

.PHONY: new-article
new-article: ## Scaffold a new article stub. Usage: make new-article SLUG=... SOURCE=medium|substack|linkedin|native [URL=...]
ifndef SLUG
	$(error SLUG is required. Usage: make new-article SLUG=my-post SOURCE=medium URL=https://...)
endif
	$(eval SOURCE ?= native)
	$(eval URL ?= )
	$(eval TODAY := $(shell date +%Y-%m-%d))
	@mkdir -p content/articles
	@if [ -f "content/articles/$(SLUG).mdx" ]; then \
		echo "⚠️  content/articles/$(SLUG).mdx already exists — skipping."; \
	else \
		printf -- '---\nslug: %s\ntitle: "%s"\ndate: %s\nsummary: ""\nsource: %s\nexternalUrl: "%s"\ntags: []\ndraft: true\nreadingTime: 0\n---\n' \
			"$(SLUG)" "$(SLUG)" "$(TODAY)" "$(SOURCE)" "$(URL)" \
			> content/articles/$(SLUG).mdx; \
		echo "✅  Created content/articles/$(SLUG).mdx (draft: true)"; \
		echo "    Edit the file, set draft: false, then run: make content"; \
	fi

.PHONY: new-note
new-note: ## Scaffold a new native note (Inkforge-compatible). Usage: make new-note SLUG=...
ifndef SLUG
	$(error SLUG is required. Usage: make new-note SLUG=my-note)
endif
	$(eval TODAY := $(shell date +%Y-%m-%d))
	@mkdir -p content/notes
	@if [ -f "content/notes/$(SLUG).mdx" ]; then \
		echo "⚠️  content/notes/$(SLUG).mdx already exists — skipping."; \
	else \
		printf -- '---\nslug: %s\ntitle: "%s"\ndate: %s\nsummary: ""\ntags: []\ndraft: true\ntone: senior\nformat: explainer\nlength: comprehensive\nwordCount: 0\nreadingTime: 0\n---\n\n## Introduction\n\nWrite your note here.\n' \
			"$(SLUG)" "$(SLUG)" "$(TODAY)" \
			> content/notes/$(SLUG).mdx; \
		echo "✅  Created content/notes/$(SLUG).mdx (draft: true)"; \
		echo "    Set NEXT_PUBLIC_NOTES_ENABLED=true to enable the /notes section."; \
	fi

.PHONY: new-project
new-project: ## Scaffold a new project entry. Usage: make new-project SLUG=...
ifndef SLUG
	$(error SLUG is required. Usage: make new-project SLUG=my-project)
endif
	@mkdir -p content/projects
	@if [ -f "content/projects/$(SLUG).mdx" ]; then \
		echo "⚠️  content/projects/$(SLUG).mdx already exists — skipping."; \
	else \
		printf -- '---\nslug: %s\nname: "%s"\ntagline: "One-line tagline"\ngroup: "Tooling & Lab"\nrepo: "https://github.com/sairam0424/%s"\ntech: []\npinned: false\nfeatured: false\norder: 100\nexcerpt: "Brief excerpt shown in the project card."\n---\n\n## Overview\n\nDescribe your project here.\n' \
			"$(SLUG)" "$(SLUG)" "$(SLUG)" \
			> content/projects/$(SLUG).mdx; \
		echo "✅  Created content/projects/$(SLUG).mdx"; \
	fi

.PHONY: new-work
new-work: ## Scaffold a new work case study. Usage: make new-work SLUG=...
ifndef SLUG
	$(error SLUG is required. Usage: make new-work SLUG=my-case)
endif
	@mkdir -p content/work
	@if [ -f "content/work/$(SLUG).mdx" ]; then \
		echo "⚠️  content/work/$(SLUG).mdx already exists — skipping."; \
	else \
		printf -- '---\nslug: %s\nname: "%s"\nrole: "Engineer"\nregister: "Co-built · owned the backend"\nsummary: "One-paragraph summary of the system and your contribution."\nmetrics:\n  - { value: "0", label: "metric label" }\ntech: []\norder: 100\n---\n\n## What I Built\n\nDescribe what you architected and why.\n' \
			"$(SLUG)" "$(SLUG)" \
			> content/work/$(SLUG).mdx; \
		echo "✅  Created content/work/$(SLUG).mdx"; \
	fi

## Feature Flags

.PHONY: flags-show
flags-show: ## Print all NEXT_PUBLIC_* feature flags and their current values
	@echo ""
	@printf "$(BOLD)$(CYAN)Feature Flags — Current Build Values$(RESET)\n"
	@echo ""
	@printf "$(YELLOW)Writing Sections$(RESET)\n"
	@printf "  NEXT_PUBLIC_ARTICLES_ENABLED  = %s\n" "$${NEXT_PUBLIC_ARTICLES_ENABLED:-true (default)}"
	@printf "  NEXT_PUBLIC_NOTES_ENABLED     = %s\n" "$${NEXT_PUBLIC_NOTES_ENABLED:-false (default)}"
	@echo ""
	@printf "$(YELLOW)Views$(RESET)\n"
	@printf "  NEXT_PUBLIC_ENABLED_VIEWS     = %s\n" "$${NEXT_PUBLIC_ENABLED_VIEWS:-all (default)}"
	@printf "  NEXT_PUBLIC_ANVIL_ORB_MODE    = %s\n" "$${NEXT_PUBLIC_ANVIL_ORB_MODE:-inplace (default)}"
	@printf "  NEXT_PUBLIC_ANVIL_ORB_EXPERIENCE = %s\n" "$${NEXT_PUBLIC_ANVIL_ORB_EXPERIENCE:-classic (default)}"
	@echo ""
	@printf "$(YELLOW)Beast-Mode (all default OFF)$(RESET)\n"
	@printf "  NEXT_PUBLIC_ORB_POSTPROCESSING = %s\n" "$${NEXT_PUBLIC_ORB_POSTPROCESSING:-false}"
	@printf "  NEXT_PUBLIC_INK_TRANSITION     = %s\n" "$${NEXT_PUBLIC_INK_TRANSITION:-false}"
	@printf "  NEXT_PUBLIC_SKILL_TREE         = %s\n" "$${NEXT_PUBLIC_SKILL_TREE:-false}"
	@printf "  NEXT_PUBLIC_404_ORB            = %s\n" "$${NEXT_PUBLIC_404_ORB:-false}"
	@printf "  NEXT_PUBLIC_VISITOR_COUNTER    = %s\n" "$${NEXT_PUBLIC_VISITOR_COUNTER:-false}"
	@printf "  NEXT_PUBLIC_DISCOVERY_BADGES   = %s\n" "$${NEXT_PUBLIC_DISCOVERY_BADGES:-false}"
	@echo ""
	@printf "$(YELLOW)Flags SDK$(RESET)\n"
	@printf "  FLAG_DRIVER                    = %s\n" "$${FLAG_DRIVER:-local (default)}"
	@echo ""
	@printf "$(WHITE)All NEXT_PUBLIC_* flags require a redeploy to take effect.$(RESET)\n"
	@echo ""

.PHONY: flags-notes-on
flags-notes-on: ## Print the command to enable the /notes section in production
	@echo ""
	@printf "$(CYAN)Enable /notes section on Vercel:$(RESET)\n"
	@echo ""
	@printf "  vercel env add NEXT_PUBLIC_NOTES_ENABLED production\n"
	@printf "  # Enter value: true\n"
	@echo ""
	@printf "  Then redeploy:\n"
	@printf "  vercel deploy --prod\n"
	@echo ""
	@printf "$(WHITE)Or set NEXT_PUBLIC_NOTES_ENABLED=true in .env.local for local dev.$(RESET)\n"
	@echo ""

.PHONY: flags-notes-off
flags-notes-off: ## Print the command to disable the /notes section in production
	@echo ""
	@printf "$(CYAN)Disable /notes section on Vercel:$(RESET)\n"
	@echo ""
	@printf "  vercel env rm NEXT_PUBLIC_NOTES_ENABLED production\n"
	@printf "  # (or set it to 'false')\n"
	@echo ""
	@printf "  Then redeploy:\n"
	@printf "  vercel deploy --prod\n"
	@echo ""

.PHONY: flags-beast
flags-beast: ## Print all beast-mode flag commands to unlock every visual effect
	@echo ""
	@printf "$(BOLD)$(CYAN)Beast-Mode Flag Unlock Commands$(RESET)\n"
	@printf "$(WHITE)Run these in Vercel Project → Settings → Env Vars, then redeploy:$(RESET)\n"
	@echo ""
	@printf "  NEXT_PUBLIC_ORB_POSTPROCESSING=true   # Bloom+Vignette+Fluid on 3D orb\n"
	@printf "  NEXT_PUBLIC_INK_TRANSITION=true       # WebGL2 ink-bleed between views\n"
	@printf "  NEXT_PUBLIC_SKILL_TREE=true           # RPG skill tree in Play view\n"
	@printf "  NEXT_PUBLIC_404_ORB=true              # Distressed orb on 404 page\n"
	@printf "  NEXT_PUBLIC_VISITOR_COUNTER=true      # Footer visitor count badge\n"
	@printf "  NEXT_PUBLIC_DISCOVERY_BADGES=true     # ★ N/5 discovered badge\n"
	@echo ""
	@printf "$(WHITE)Or add to .env.local to test locally before deploying.$(RESET)\n"
	@echo ""

## Git & Deploy

.PHONY: push
push: ## Push current branch to origin
	git push origin HEAD

.PHONY: pr
pr: ## Open a PR from current branch → develop
	gh pr create --base develop

.PHONY: pr-prod
pr-prod: ## Open a PR from develop → main (production)
	gh pr create --base main --head develop

.PHONY: deploy-preview
deploy-preview: ## Trigger a manual Vercel preview deployment
	vercel deploy

.PHONY: deploy-prod
deploy-prod: ## Trigger a manual Vercel production deployment
	vercel deploy --prod

.PHONY: rollback
rollback: ## Rollback to the previous Vercel production deployment
	vercel rollback

## Observability

.PHONY: logs
logs: ## Stream live Vercel runtime logs (all)
	vercel logs --tail

.PHONY: logs-flags
logs-flags: ## Stream Vercel logs filtered to flag resolution events
	vercel logs --tail 2>&1 | grep '\[flags\]'

.PHONY: logs-llm
logs-llm: ## Stream Vercel logs filtered to LLM/AI events
	vercel logs --tail 2>&1 | grep '\[llm\]'

.PHONY: trace
trace: ## Replay a full request trace from Redis. Usage: make trace TRACE_ID=abc123
ifndef TRACE_ID
	$(error TRACE_ID is required. Get it from the x-anvilry-trace-id response header. Usage: make trace TRACE_ID=abc123)
endif
	node scripts/replay-trace.mjs $(TRACE_ID)

.PHONY: health
health: ## Smoke-test /api/chat with a live POST request
	@echo "Testing $(PROD_URL)/api/chat ..."
	@curl -s -o /dev/null -w "HTTP Status: %{http_code}\nTime: %{time_total}s\n" \
		$(PROD_URL)/api/chat \
		-X POST \
		-H "Content-Type: application/json" \
		-d '{"messages":[{"role":"user","content":"What stack does Sairam use?"}]}'
	@echo ""
	@echo "Tip: run in verbose mode with: curl -v $(PROD_URL)/api/chat -X POST ..."

.PHONY: admin
admin: ## Open the telemetry admin dashboard in the browser
	@open $(PROD_URL)/admin/telemetry

## Environment

.PHONY: env-check
env-check: ## Show which environment variables are set vs unset (secrets masked)
	@echo ""
	@printf "$(BOLD)$(CYAN)Environment Check$(RESET)\n"
	@echo ""
	@printf "$(YELLOW)LLM Provider$(RESET)\n"
	@printf "  LLM_PROVIDER                = %s\n" "$${LLM_PROVIDER:-bedrock (default)}"
	@printf "  BEDROCK_ACCESS_KEY_ID       = %s\n" "$(if $(BEDROCK_ACCESS_KEY_ID),SET (masked),⚠️  UNSET — chatbot will fail)"
	@printf "  BEDROCK_SECRET_ACCESS_KEY   = %s\n" "$(if $(BEDROCK_SECRET_ACCESS_KEY),SET (masked),⚠️  UNSET — chatbot will fail)"
	@printf "  BEDROCK_REGION              = %s\n" "$${BEDROCK_REGION:-us-east-1 (default)}"
	@printf "  ANTHROPIC_API_KEY           = %s\n" "$(if $(ANTHROPIC_API_KEY),SET (masked),unset)"
	@echo ""
	@printf "$(YELLOW)Rate Limiting$(RESET)\n"
	@printf "  UPSTASH_REDIS_REST_URL      = %s\n" "$(if $(UPSTASH_REDIS_REST_URL),SET,unset — rate limiter disabled)"
	@printf "  UPSTASH_REDIS_REST_TOKEN    = %s\n" "$(if $(UPSTASH_REDIS_REST_TOKEN),SET (masked),unset)"
	@echo ""
	@printf "$(YELLOW)Voice$(RESET)\n"
	@printf "  GOOGLE_TTS_API_KEY          = %s\n" "$(if $(GOOGLE_TTS_API_KEY),SET (masked),unset — Google voices hidden)"
	@echo ""
	@printf "$(YELLOW)Telemetry$(RESET)\n"
	@printf "  ADMIN_PASSWORD              = %s\n" "$(if $(ADMIN_PASSWORD),SET (masked),unset — /admin/telemetry shows setup instructions)"
	@printf "  TELEMETRY_IP_SALT           = %s\n" "$(if $(TELEMETRY_IP_SALT),SET (masked),unset — IPs stored as 'anonymous')"
	@echo ""
	@printf "$(YELLOW)Flags SDK$(RESET)\n"
	@printf "  FLAG_DRIVER                 = %s\n" "$${FLAG_DRIVER:-local (default)}"
	@printf "  FLAGS_SECRET                = %s\n" "$(if $(FLAGS_SECRET),SET (masked),unset — required if FLAG_DRIVER=vercel)"
	@echo ""

.PHONY: env-setup
env-setup: ## Print step-by-step guide to set up .env.local from scratch
	@echo ""
	@printf "$(BOLD)$(CYAN)Local Environment Setup Guide$(RESET)\n"
	@echo ""
	@printf "1. Copy the template:\n"
	@printf "   cp .env.example .env.local\n"
	@echo ""
	@printf "2. Fill in the required values in .env.local:\n"
	@printf "   $(YELLOW)Required (chatbot):$(RESET)\n"
	@printf "     BEDROCK_ACCESS_KEY_ID=<your-aws-key>\n"
	@printf "     BEDROCK_SECRET_ACCESS_KEY=<your-aws-secret>\n"
	@echo ""
	@printf "   $(YELLOW)Optional (rate limiting):$(RESET)\n"
	@printf "     UPSTASH_REDIS_REST_URL=https://<your-db>.upstash.io\n"
	@printf "     UPSTASH_REDIS_REST_TOKEN=<your-token>\n"
	@echo ""
	@printf "   $(YELLOW)Optional (Google voice):$(RESET)\n"
	@printf "     GOOGLE_TTS_API_KEY=AIzaSy...\n"
	@echo ""
	@printf "   $(YELLOW)Optional (telemetry dashboard):$(RESET)\n"
	@printf "     ADMIN_PASSWORD=<strong-password>\n"
	@printf "     TELEMETRY_IP_SALT=\$$(openssl rand -base64 16)\n"
	@echo ""
	@printf "3. Start the dev server:\n"
	@printf "   make dev\n"
	@echo ""
	@printf "$(WHITE).env.local is git-ignored — never commit it.$(RESET)\n"
	@echo ""

.PHONY: env-vercel
env-vercel: ## Pull Vercel environment variables into .env.local
	vercel env pull .env.local
	@echo ""
	@printf "$(WHITE)Pulled env vars from Vercel into .env.local$(RESET)\n"

## Resume

.PHONY: resume-list
resume-list: ## List all resume PDFs with file sizes
	@echo ""
	@printf "$(BOLD)$(CYAN)Resume PDFs$(RESET)\n"
	@echo ""
	@ls -lh public/resume/*.pdf | awk '{printf "  %-45s %s\n", $$9, $$5}'
	@echo ""
	@printf "$(WHITE)To add a new resume: copy a PDF to public/resume/ and update src/lib/profile.ts resumeVariants.$(RESET)\n"
	@echo ""

.PHONY: resume-open
resume-open: ## Open the resume directory in Finder
	open public/resume/
