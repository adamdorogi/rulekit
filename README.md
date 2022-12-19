# rulekit

Self-hosted JSON rules for underwriting and eligibility checks.

## local API

```sh
cp .env.example .env
docker-compose up -d
npm install
npm run db:setup
npm run start -w @rulekit/api
```

The seed adds a motor underwriting workspace and a local evaluation key.
