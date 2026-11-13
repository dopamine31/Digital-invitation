.PHONY: up down logs setup test lint typecheck build migrate seed shell
up: ## docker compose up -d --build
	docker compose up -d --build
down: ## stop semua layanan
	docker compose down
logs: ## log aplikasi + worker
	docker compose logs -f app worker
setup: ## setup Linux satu perintah
	bash scripts/setup.sh
migrate: ## jalankan migrasi di container app
	docker compose exec app npm run db:migrate
seed: ## jalankan ulang seed (idempoten)
	docker compose exec app npm run db:seed
shell: ## shell container app
	docker compose exec app bash
test: ## unit + integrasi
	npm test
typecheck: ## tsc strict
	npm run typecheck
lint: ## eslint
	npm run lint
build: ## next build
	npm run build
