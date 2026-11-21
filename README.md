# rulekit

Self-hosted JSON decision engine and approval queue for pulling underwriting /
eligibility rules out of spreadsheets. Evaluates versioned rulesets over HTTP
with an audit trail, signed webhook outbox, and a Bootstrap console.

![playground](assets/playground.gif)

## Architecture / request flow

```mermaid
flowchart LR
    Client -->|"POST /v1/evaluate/:slug"| API["Fastify + local LRU"]
    Redis -->|"rulekit:invalidate"| API
    API --> Engine["AST evaluator"]
    Engine --> Tx["Postgres tx: log + review + outbox"]
    Tx --> Queue["BullMQ worker"]
    Queue --> Hook["HMAC-signed webhook"]
```

- The LRU holds compiled active rulesets, scoped by workspace, slug and version.
  Publish and rollback evict peers through Redis. The TTL bounds missed messages.
- Warm entries skip the ruleset read and compilation. Live evaluations still
  write to Postgres. Measure latency under load using `/metrics`.
- Audit rows, review tasks and outbox events share one transaction.
- The worker polls Postgres for pending events and schedules delivery in Redis.
  A Redis restart can delay delivery while the outbox stays in Postgres.
- Delivery is at least once. Deduplicate on the event ID at the receiver.

## Quick start (local dev)

Node 22.12+ and Docker Compose v2. Use the sample credentials on local instances.

```sh
cp .env.example .env
docker compose up -d
npm install
npm run db:setup
npm run dev
```

Open [localhost:3000](http://localhost:3000). Sign in as `admin@rulekit.test`
with `rulekit-local`. The seed creates Motor Underwriting AU and Merchant KYC
Screening in the sample workspace.

```sh
curl -sS http://localhost:4000/v1/evaluate/motor-au \
  -H 'Authorization: Bearer rk_live_rulekit_demo_motor_au' \
  -H 'Idempotency-Key: motor-case-001' \
  -H 'Content-Type: application/json' \
  --data '{"applicant":{"age":22},"vehicle":{"value_aud":92000},"history":{"at_fault_claims":1}}'
```

Use Playground to inspect the active version and see the inputs checked by each
rule. Live requests write to the audit log and open review tasks for review
outcomes. Supply a unique idempotency key per request you might retry.

## Rules, versions and imports

- A rule has a condition, an outcome and optional JSON outputs. Conditions use
  dot-path fields and can be nested inside `all`, `any` and `not`.
- `first_match` stops at the first hit. `all_matches` merges outputs in order
  and returns the highest-severity matching outcome.
- Edit and save the draft, then publish from Rules. Versions are immutable.
  A rollback changes the active pointer and keeps the draft.
- Import a policy PDF or text table from Rules. Check the extracted clauses,
  source snippets and analyzer findings before publishing. The offline parser
  handles simple threshold rows such as `applicant.age < 25 -> review`.
- Set `OPENAI_API_KEY` and optionally `OPENAI_BASE_URL` to enable extraction via
  an OpenAI-compatible endpoint. Set `OPENAI_MODEL` to select its model. Imported
  policy text is sent to that endpoint.

## Webhook delivery

Subscribe a public HTTPS endpoint to `evaluation.completed`, `review.created` or
`review.resolved`. The console shows the signing secret when the endpoint is
created. Compute HMAC-SHA256 over the exact request bytes and compare it with
the `sha256=<hex>` value in `X-Rulekit-Signature`. Check the signature before
parsing or acting on the body.

Delivery attempts are listed under Webhooks. Failed sends back off up to five
attempts. Retry a dead delivery from its log entry.

## Production deploy

- Set `POSTGRES_PASSWORD`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`,
  `COOKIE_SECRET`, `WEBHOOK_SIGNING_KEY` and `WEB_ORIGIN`.
- Use `postgres` and `redis` as Compose service hostnames unless you supply
  external services. Set `WEB_ORIGIN` to the public HTTPS console origin.
- Serve the console (3000) and the evaluation API (4000) behind Nginx or Caddy
  with TLS. Compose publishes both ports on loopback.
- Export `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` and `SEED_API_KEY` for the initial
  seed. Use a deployment-specific email, password and key.

```sh
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml exec \
  -e SEED_ADMIN_EMAIL -e SEED_ADMIN_PASSWORD -e SEED_API_KEY api \
  node apps/api/dist/seed.js
```

The `migrate` service runs `prisma migrate deploy` before API and worker startup.
`/healthz` checks Postgres and Redis. `/metrics` emits Prometheus text. Keep
metrics off the public proxy and back up the Postgres volume.

## Checks

```sh
npm ci
npm run build
npm test
```

Start the local services and run `npm run db:migrate` before running tests that
use Postgres and Redis.
