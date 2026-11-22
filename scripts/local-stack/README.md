# Local stack (one command)

Run from `backend-services/`:

- `npm run local:up` boots infra (Postgres x3, Kafka, Kafka UI), builds, starts the 3 services, starts the web apps (via `frontend-apps/scripts/local-web-apps.js`, override the dir with `FRONTEND_APPS_DIR`), seeds data and prints `.local-run/test-data.md`.
- `npm run local:down [-- --purge]` stops everything (`--purge` also removes volumes and seed state).
- `npm run local:status`, `npm run local:seed` (idempotent), `npm run test:scripts`.

`up` flags: `--reset` (down -v, fresh seed), `--skip-build`, `--with-mobile`, `--no-frontend`, `--no-seed`, `--no-start-docker`.

Prerequisites: Node >= 20.19, `npm install` in both repos, Docker (Colima is started automatically unless `--no-start-docker`), `docker compose` or `docker-compose`, free ports 5433-5435, 19092, 8080, 3001-3003, 4100-4102 (8081 with mobile).

Runtime files (git-ignored) live in `.local-run/`: `logs/`, `pids/`, `seed-state.json`, `test-data.md` (generated ids and PINs).

## Seed data (`seed-data.json`)

Tenant `8f6d7df2-0d8a-4c81-9ad3-6f9c3c5198b1`. Employees: CASHIER-01 (Ana Souza), MANAGER-01 (Bruno Lima), ADMIN-01 (Carla Mendes); PINs are in the generated report. Six products (barcodes 7891234567890, 7891000100013, 7891000100020, 7891000100037, 7891000100044, 7891000100051), a supplier invoice `SEED-INV-0001`, register `register-01`, float `150.00`, manager approval code `MANAGER-01`.

Products are registered with `registrationPrice` and then updated to `price`: checkout's catalog is fed only by `management.product-price.updated`, and an unchanged price is rejected.

## Troubleshooting

- A failing step prints its log path and the last 30 lines; logs are in `.local-run/logs/`.
- "product ... exists in management but its id is unknown": run `npm run local:up -- --reset`.
- Catalog does not converge: check checkout/management logs and Kafka UI topic `management.product-price.updated` (http://localhost:8080).
- "Refusing to rebuild": run `npm run local:down` or pass `--skip-build`.
