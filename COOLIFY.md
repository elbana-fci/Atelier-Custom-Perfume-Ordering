# Deploy Formula Studio with Coolify

Place `Dockerfile`, `.dockerignore` and `docker-entrypoint.sh` in the project root, beside package.json. Commit the entire source project plus these three files to your Git repository. The Dockerfile needs the source as its build context; pasting it into a standalone Dockerfile resource without repository files will not work.

## Application settings

Create a Git-based application and choose the Dockerfile build pack.

| Setting | Value |
| --- | --- |
| Base Directory | `/` if package.json is at the repository root; otherwise the project subdirectory |
| Dockerfile Location | `/Dockerfile` relative to the Base Directory |
| Ports Exposes / internal app port | `3001` |
| Domain | Your HTTPS domain, e.g. `https://formula.example.com` |
| Persistent Storage | Add a **Volume Mount** with destination `/data` and a stable name such as `atelier-data` |
| Replicas | One; use one instance for this SQLite demo |
| Health check (if configured in Coolify) | HTTP GET `/api/catalog`, port `3001`; allow 90 seconds for startup |

Use Coolify's domain proxy; a direct host port mapping is unnecessary. Keep the Dockerfile's default start command. Build and start commands are already included in the image.

## Runtime environment variables

```dotenv
NODE_ENV=production
PORT=3001
APP_URL=https://formula.example.com
STAFF_KEY=REPLACE_WITH_A_LONG_RANDOM_SECRET
```

Generate a staff key locally with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Store the generated value as a runtime secret in Coolify. Enter it on the staff login screen. APP_URL must be the same public origin customers use, without a trailing slash. QR codes and email reorder links use this address. Do not copy `.env` into Git or the image.

Leave SMTP_HOST unset to keep the demo email outbox without sending messages. To enable actual sending, add runtime variables:

```dotenv
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=Atelier <hello@your-domain.com>
```

Use your provider's required port: 587 uses STARTTLS; 465 uses TLS on connection. Use a verified sender domain and real provider credentials. Mark SMTP_PASS as a secret.

## Database persistence

The Docker build changes the image's Prisma datasource path to `file:/data/demo.db` and generates the matching Prisma Client. Your local source schema remains unchanged, so local development continues to work as before. Do not set DATABASE_URL: this version uses a path embedded in the Prisma schema.

Mount a named volume at `/data` **before the first deployment**. It preserves customers, formulas, orders, emails and catalog settings across redeployments. Do not mount `/app`, `/app/prisma` or `/app/node_modules`.

The container runs as the Node user, UID/GID 1000:1000. A fresh Docker named volume inherits the image's `/data` ownership. For an existing volume or a bind mount, ensure that UID/GID can write to it. The entrypoint reports a clear error otherwise.

At startup the container initializes the schema and seeds the catalog only if missing. Existing settings and customer records are not reset. The original fictional customer appears on a fresh demo database. The startup schema sync does not permit destructive changes automatically. For a production release, adopt reviewed migrations instead of this demo db-push workflow.

Use one running instance and avoid overlapping old and new containers during schema-changing deployments. Back up the SQLite database before upgrades; a persistent volume is not a backup. Do not share the database between servers or deploy replicas against the same writable SQLite file.

## Deploy and verify

1. Save variables, domain, internal port and storage settings; deploy.
2. Confirm the runtime log reports that the database is in sync and the API is listening on port 3001.
3. Open your HTTPS domain for the customer form, and `/staff` for the staff dashboard.
4. Enter your configured STAFF_KEY; submit and approve a test formula.
5. Scan the QR card on a phone and verify it opens the public domain.
6. Redeploy and confirm the saved formula still exists.

This packages the existing demo; it does not add production user accounts, staff roles or automated backups. Email remains simulated unless SMTP is configured.

## Optional local Docker check

```bash
docker build -t formula-studio .
docker volume create atelier-data
docker run --rm --name atelier \
  -p 3001:3001 \
  -v atelier-data:/data \
  -e APP_URL=http://localhost:3001 \
  -e STAFF_KEY=choose-a-long-private-key \
  formula-studio
```

Open http://localhost:3001. This address is for local testing only; use your HTTPS domain in Coolify.

## Validation performed

The original application's unit tests, API workflow and production build passed. The entrypoint's shell syntax was checked. Docker is unavailable in the creation environment, so the image build and actual Coolify deployment must be verified on your server.
