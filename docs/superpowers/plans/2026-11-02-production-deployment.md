# Production deployment repair plan

**Goal:** Make deployment repeatable, preserve business data and secrets, and report success only when the database, application, frontend and public HTTPS endpoint work.

**Scope:** Analysis and proposed implementation only. No production changes have been made. The proposed target is the existing Ubuntu/EC2, MySQL, PM2 and Nginx architecture; confirm the actual server before implementation. Docker would add a migration and operational work without addressing the current deployment defects.

## Evidence and failure candidates

| Finding | Evidence | Consequence |
| --- | --- | --- |
| Default database provider disagrees with production configuration | `prisma/schema.prisma` uses SQLite; `.env.production.example` uses MySQL. `DB_PROVIDER` does not select a Prisma provider. Only the deploy script copies the MySQL schema. | Deployments using ordinary npm/Prisma commands can generate the wrong client or reject the production URL. The existing script handles this path, so this is not proof of the live failure. |
| Database provisioning is inconsistent with existing configuration | `deploy/deploy.sh` always provisions `hilltrade`, but preserves an existing MySQL URL that may name another user/database. It also changes the local user's password on every run. | Provisioning can succeed while the application still targets an unconfigured database, or another consumer loses access. |
| Deployment can run a destructive demo seed | User-count query errors become zero; `prisma/seed.ts` deletes business records and creates demo accounts/data. | An operational error can trigger a destructive initialization attempt. Never use this seed for production. |
| No migration history | `prisma/` has no committed migrations; deploy uses `db push`. | Schema changes are not reviewed/versioned. Simply replacing the command with `migrate deploy` will not create the missing migration history. |
| Health is a false positive | `/api/health` returns a constant success response, without Prisma access. Startup does not verify DB connectivity. | A broken database can coexist with an online PM2 process and a green health response. |
| Deploy success is not verified | No HTTP probe after PM2 restart or Nginx reload. | Restart loops, database failures, redirects and missing assets can be announced as successful deployments. |
| Runtime support is inconsistent | Provisioning installs Node 20; installed Vitest 5 requires Node 22.12+, 24+, or 26+. | Production/build/test environments can differ. Standardize on a supported Node 22 release >=22.12 for the initial repair and pin the tested version. |
| Secrets/configuration handling is fragile | Script sources `.env` as Bash, parses URL passwords with a regex, deletes a second env file, and does not explicitly restrict newly created env permissions. | dotenv values can be interpreted incorrectly; configuration can be lost or exposed. |
| TLS and process persistence are incomplete | Self-signed fallback is treated as success; Nginx is hardcoded to port 3000; `pm2 save` is present but boot startup is not configured. | Browser trust failures, port mismatch and reboot outages remain possible. |
| Deployment changes the running checkout | Failed `git pull` is ignored, dependencies use `npm install`, and build runs in place. | Wrong revisions or dependency drift can ship; a failed build can leave mixed artifacts. |

Local verification on 2026-11-02: `npm run build` passed; all 61 tests across seven files passed outside the sandbox (Supertest needs local socket binding); both existing scripts passed `bash -n`. These tests do not verify a real MySQL server, PM2, Nginx, certificates, or a deployed host. README currently contains only the project name.

## 1. Establish the live failure before changing production

- [ ] Collect the failing URL, HTTP status/body and time, server OS, deployed commit, Node version, PM2 process owner/status/restart count, and redacted application/Nginx logs. Distinguish application JSON 500 from Nginx 502/504 or Nginx-generated 500.
- [ ] Check listening ports, available disk/RAM, MySQL service and connectivity using the application's credentials. Inspect actual schema/tables and generated Prisma provider. Report configuration presence and validation errors without printing connection URLs or secrets.
- [ ] Check `nginx -t`, upstream port, DNS, TLS chain and expiry. Compare direct loopback requests with the public HTTPS response. When HTTPS enforcement is on, use the trusted proxy header for a loopback diagnostic and do not follow redirects silently.
- [ ] Verify the existing encryption key remains available: replacing it makes stored encrypted bank information unreadable. Back up database and configuration before repairs.

Exit condition: identify the failing boundary and correlate its error with a request; do not attribute the production outage to a local source finding alone.

## 2. Fix configuration and database deployment

**Files:** `src/config.ts`, `.env.example`, `.env.production.example`, `package.json`, `prisma/schema*.prisma`, new committed MySQL migrations, `prisma/seed.ts`, a separate production initialization command, configuration tests.

- [ ] Add tests for invalid ports/URLs, missing or placeholder production secrets, and provider/URL mismatch; verify failures before implementing validation. Preserve compatibility with existing valid encryption keys and encrypted records.
- [ ] Select the MySQL schema explicitly for production generation/migrations rather than overwriting tracked files. Keep SQLite development support only where needed. Check model parity so future schema changes reach production.
- [ ] Generate and review a Prisma 6 initial MySQL migration on a disposable database. For an existing database, compare its schema and reconcile drift before marking a baseline as applied. Test fresh install and existing-data upgrade separately. Never reset the live database or use `--accept-data-loss` automatically.
- [ ] Remove automatic demo seeding from deploy; make the demo seed refuse production. Add an explicit, idempotent initialization command that creates a supplied administrator and required reference data without deleting records or resetting existing passwords. Supply the initial password through protected input, not command-line arguments or logs.
- [ ] Validate env through dotenv/Zod rather than executing it as shell code. Preserve existing secrets and database credentials, including URL-encoded special characters. Create configuration with restrictive permissions and only when missing; never silently replace it.
- [ ] Standardize the tested Node runtime and lockfile install (`npm ci --include=dev`). Do not upgrade Prisma major versions as part of this repair.

Acceptance: valid production config works with MySQL; invalid config fails before deployment; repeated initialization preserves all records and credentials; migration tests retain representative lots, payments and encrypted account data.

## 3. Add real application health and shutdown behavior

**Files:** `src/index.ts`, `src/db.ts`, `src/middleware/integrity.ts`, a focused health route module and `tests/health.test.ts` if needed to test without starting the main listener.

- [ ] Keep `/api/health` as liveness. Add `/api/ready` returning JSON 200 only after a bounded Prisma database query and a lightweight expected-schema query succeed; return generic JSON 503 on failure. A `SELECT 1` alone cannot detect missing application tables.
- [ ] Give probes bounded timeouts and avoid unlimited overlapping queries. Configure database connection/query limits as well as the HTTP deadline. Do not expose errors, credentials or schema details publicly.
- [ ] Register probes outside authentication, request integrity and API rate limits; make local probes work without an HTTPS redirect. Preserve all normal route protections. Restrict the app listener to loopback for this Nginx deployment.
- [ ] Refuse production startup when the client build is absent. Add SIGTERM/SIGINT handling: stop accepting requests, drain with a deadline, disconnect Prisma, exit. Match PM2 kill timeout to the drain deadline.
- [ ] Test healthy DB, unavailable DB, missing schema, timeout, frontend absence and health behavior with `FORCE_HTTPS=true`; verify ordinary HTTPS enforcement is preserved.

Acceptance: DB failure yields readiness 503 while liveness stays 200; probes do not hang or redirect; recovery restores readiness; startup and shutdown failures are visible.

## 4. Replace the deploy script with a gated release workflow

**Files:** `deploy/deploy.sh`, `deploy/setup-ec2.sh`, `ecosystem.config.cjs`, `deploy/nginx.conf`, `.env.production.example`, new `deploy/healthcheck.sh`, shell smoke tests.

Proposed commands (interfaces to implement, not available yet):

```bash
bash deploy/setup-ec2.sh               # one-time host setup
bash deploy/deploy.sh --check          # read-only preflight
bash deploy/deploy.sh --ref <commit>   # deploy an explicit revision
bash deploy/healthcheck.sh --local     # loopback readiness + frontend/assets
bash deploy/healthcheck.sh --public    # configured public HTTPS checks
```

- [ ] Separate privileged host provisioning from routine deploy as the application user. Configure MySQL only explicitly, against the selected database/user; never rotate a password on redeploy. Require a real domain for public TLS. Do not silently fall back to a self-signed certificate.
- [ ] Preflight required binaries, pinned runtime, env, writable release paths, available disk, database connection, migration state and configuration consistency. Use a deploy lock (`flock`) to reject concurrent runs. Fail rather than continuing after a failed fetch or revision checkout.
- [ ] Create a separate release directory from the selected commit. Install locked dependencies, generate the production client, run tests and build, then verify both server and frontend artifacts. Keep live assets untouched during build.
- [ ] Create and verify a database backup before schema changes, using protected client configuration rather than a password argument. Abort on backup failure. Run reviewed Prisma migrations only after the release build passes.
- [ ] Switch a `current` symlink to the prepared release and restart the single PM2 application under the existing application user, with deterministic env precedence. Retain the previous release and commit metadata. Document the brief restart window.
- [ ] Poll loopback readiness with bounded retries; check frontend HTML and at least one referenced JS/CSS asset with expected content types. Validate Nginx configuration before reload, then check public HTTPS with certificate verification, explicit HTTP codes and expected JSON. Do not treat redirects, HTML errors, or insecure TLS as success.
- [ ] Print success and persist PM2 state only after all gates pass. On failure, exit nonzero with the failed stage and safe diagnostic commands. Restore the previous application release where schema compatibility permits; never automatically reverse migrations or restore a live DB backup.
- [ ] Configure PM2 boot startup for the application user, restart limits/delay, log rotation, and Certbot renewal with an Nginx reload hook. Test that the configured Nginx upstream matches the chosen app port; either enforce 3000 consistently or render both from the same validated value.
- [ ] Test scripts with mocked commands: invalid config, failed install/build/backup/migration, PM2 restart failure, readiness timeout, public TLS failure, concurrent deploy and successful redeploy. Assert no destructive seed, secret rotation, or success message occurs on failure. Run `bash -n` and ShellCheck when available.

## 5. Automate monitoring and document recovery

**Files:** `deploy/healthcheck.sh`, new systemd healthcheck service/timer templates under `deploy/`, `README.md`.

- [ ] Run the same read-only healthcheck from a systemd timer every minute under an unprivileged account. Apply an overall execution deadline and prevent overlapping runs. Check local readiness and public HTTPS separately so logs identify the failed layer.
- [ ] Log timestamp, release identifier, stage and status to journald; exit nonzero on failure. PM2 handles crashed processes; avoid blind restarts when the database or TLS is broken. Alert delivery requires a separately configured destination; local journald alone is not an alert.
- [ ] Document fresh setup, existing-database baseline, protected env creation, explicit initialization, deploy, manual healthcheck, timer installation, TLS renewal, backups and release rollback. Include a reboot check and a safe redacted diagnostic collection procedure.
- [ ] Validate in staging with real MySQL/Nginx/PM2: fresh deploy, repeated deploy with unchanged records/secrets, database outage/recovery, failed build, failed migration, missing assets, invalid cert, reboot and application rollback. Verify database restore in an isolated database, never as an automatic deploy step.

## Completion criteria and boundaries

Deployment is complete only when the selected commit is serving, expected migrations are applied, local and public checks pass, and monitoring and reboot persistence have been exercised. Build/test success alone does not establish production health.

Pending input: actual hosting/OS/domain and redacted production errors. No production access or logs were supplied. Preserve the current production database and encryption key during all work. Database schema changes may prevent application rollback, so compatibility and recovery must be reviewed per migration.

References: [Prisma baselining](https://www.prisma.io/docs/orm/prisma-migrate/workflows/baselining), [Prisma production migration guidance](https://docs.prisma.io/docs/orm/prisma-client/deployment/deploy-migrations-from-a-local-environment), [Node release support](https://github.com/nodejs/Release). Use the installed Prisma 6 CLI semantics rather than adopting newer major-version commands from current docs.
