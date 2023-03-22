.PHONY: infra setup dev test prod stop

infra:
	docker compose up -d --wait

setup: infra
	npm ci
	npm run db:setup

dev:
	npm run dev

test:
	npm test

prod:
	docker compose -f docker-compose.prod.yml up -d --build --wait

stop:
	docker compose -f docker-compose.prod.yml down
