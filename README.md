# Supermarket Monorepo

Production-ready NestJS monorepo for a multi-tenant supermarket microservices ecosystem.

## Services

- `checkout-service` on port `3001`
- `inventory-service` on port `3002`
- `management-service` on port `3003`

## Shared Libraries

- `@supermarket/shared-domain`
- `@supermarket/shared-infra`

## Useful Commands

```bash
npm install
npm run build
npm test
npm run test:e2e
```

## Local Infrastructure

Use `docker-compose.yml` to start:

- one PostgreSQL instance per service
- one Kafka broker in KRaft mode
- one Kafka UI instance

Each service exposes a `GET /health` endpoint.
