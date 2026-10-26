# Deployment Guide

This document covers deployment to Dokku.

## Prerequisites

- Dokku server configured
- Git remote set up for Dokku
- Environment variables configured on server

## Environment Variables

Set these on your Dokku server:

```bash
# Required
dokku config:set store DATABASE_URL="postgresql://..."
dokku config:set store BETTER_AUTH_SECRET="your-secret-min-32-chars"
dokku config:set store DATABASE_AUTH_TOKEN="your-auth-token"

# Optional (with defaults)
dokku config:set store VITE_API_URL="https://your-domain.com"
dokku config:set store STRIPE_SECRET_KEY="sk_..."
dokku config:set store STRIPE_WEBHOOK_SECRET="whsec_..."
dokku config:set store SMTP_HOST="smtp.example.com"
dokku config:set store SMTP_PORT="587"
dokku config:set store SMTP_USER="user@example.com"
dokku config:set store SMTP_PASS="password"
```

## Deploy

```bash
# Push to Dokku
git push docklight main
```

## Troubleshooting

### Port 80 Already in Use (EADDRINUSE)

If you see `EADDRINUSE: address already in use 0.0.0.0:80`:

```bash
# Stop all containers
dokku ps:stop store

# Or restart the app
dokku ps:restart store
```

### View Logs

```bash
dokku logs store
dokku logs store --tail 100
```

### Run Migrations

```bash
# Run Prisma migrations in the container
dokku run store sh -c "cd /app/packages/db && npx prisma migrate deploy"
```

### Database Setup

```bash
# Push database schema
dokku run store sh -c "cd /app/packages/db && npx prisma db push"
```

## Upload Security (Issue #3)

Uploads require a ClamAV `clamd` TCP service. Set `CLAMAV_HOST` and, if needed,
`CLAMAV_PORT` (default 3310) in the API environment. Keep this endpoint on a private,
trusted network: the clamd TCP protocol has no authentication or TLS. Update its
signature database with `freshclam` and monitor signature age and scan failures.
No scanner, connection failure, timeout (30 seconds), scan error, or a malware
verdict means no file is stored. An unavailable scanner returns HTTP 503; detected
malware returns HTTP 400. There is no development or production bypass.

Configure clamd to scan archives and alert on encrypted archives and exceeded scan
limits (`ScanArchive yes`, `AlertEncrypted yes`, `AlertExceedsMax yes`). Set
`StreamMaxLength` and `MaxFileSize` at least as high as `MAX_UPLOAD_SIZE`, and set
bounded `MaxScanSize`, `MaxRecursion`, and `MaxFiles`. Verify the installed ClamAV
version supports these settings. Before rollout, use the harmless EICAR test file
and an encrypted archive to check rejection, a clean file to check acceptance, and
a stopped scanner to check HTTP 503. Do not expose TCP port 3310 publicly.

The server checks binary signatures against extensions. Text must be UTF-8 without
binary control characters; JSON must parse. Missing extensions and unknown formats
are rejected. Figma `.fig` files and non-PDF Illustrator files are not supported;
package them as a scanned ZIP instead. Signature checks identify containers, not
every structure inside them, and do not prove that a document is harmless.

Public JPEG, PNG, GIF, and WebP images are decoded and re-encoded with a 40-million
pixel limit. Metadata and appended data are removed; animated images use frame one.
Product files remain byte-for-byte unchanged after validation and scanning. The
server does not extract archives or render uploaded documents. Product files stay
outside the public image directory and downloads remain purchase-token protected.
This is not full content disarm and reconstruction for PDF or Office documents.

`MAX_UPLOAD_SIZE` defaults to 10 MiB per file. `USER_STORAGE_QUOTA_BYTES` defaults to
1 GiB per user, shared by product files, covers, and avatars. New files use a hashed
owner directory with a UUID name. Quota includes all files in that directory,
plus referenced legacy flat-directory files. Input bytes are checked against the
available quota before scanning or decoding; sanitized output is checked again
before writing. A replacement receives credit for its old file only when that file
has one reference for this user. Both versions exist briefly until the database
update succeeds. Keep enough free disk space for these temporary replacements.

Admission happens before multipart parsing: one request per user and at most two
upload requests per API process. Excess requests receive HTTP 429 instead of waiting
in a queue. The user lock covers parsing, scanning, quota checks, writes, the database
update, and cleanup. It also covers product deletion to prevent cleanup races.
The API sets a 60-second request-body timeout; the edge proxy should also enforce
bounded upload time and body size. Quota or size violations return HTTP 413.

User exclusion uses Linux `flock` kernel locks on the shared upload volume. The
containers install `util-linux`; non-container API hosts must provide `flock` too.
If locking is unavailable, mutations fail closed with HTTP 503. The lock helper
exits when its parent pipe closes, including after a server crash. Persistent files
in `uploads/locks/` are not active locks by themselves. Never unlink these files
while writers are running: doing so creates a different inode and can bypass an
active kernel lock. Old directory-based `.lock` files are no longer used.
Keep one persistent upload volume with working cross-process `flock` semantics;
separate per-instance disks cannot enforce a global quota. The two-request admission
limit is per process, not a distributed limit across all API instances.

After a successful replacement or deletion, the API checks product and avatar
references before removing old files. On request failure it removes newly written
files only if they are unreferenced. A database response can be lost after commit,
so cleanup must not delete a file that the database still references. If reference
checks or deletion fail, cleanup logs a warning and retains the file rather than
risking data loss. Reconcile those files after database and storage recovery.

Product create/update and profile update each allow 10 requests per minute per IP.
The current rate limiter is process-local; use a shared rate-limit store or an edge
limit before scaling the API to multiple instances. Multipart limits allow two
files for products and one for profiles, with bounded fields and parts.

Before rollout, back up the database and upload volume. Existing files are not
automatically rescanned or sanitized. Inventory them, rescan private files, and
re-encode public images in a separate approved migration. Inventory unreferenced
legacy files too: ownership cannot be recovered from the database, so they are not
charged to individual users. Do not delete them without an approved retention rule.
Monitor free disk space. A hard crash between file creation and database commit,
or a failed cleanup, can still leave files that count toward quota. Reclaim them
only after checking references and retention under the same owner lock. Automatic
cleanup applies to this request's files, not a broad sweep of existing uploads.

### Cloud Storage Migration Plan

1. Choose a private object-storage bucket, region, retention policy, and scanning
   service. Approve cost, privacy, and operational ownership before provisioning.
2. Add a database upload ledger with owner, object key, byte count, and scan state.
   Reserve quota in a transaction before accepting data. Upload only to quarantine.
3. Scan and validate in a worker. Publish only clean, sanitized image derivatives
   on a separate media origin. Keep product objects private; issue short-lived
   download URLs only after the current purchase-token check.
4. Copy and rescan existing files, verify hashes and byte counts, then switch reads
   to object keys. Keep local reads available during a monitored rollback window.
5. Test scanner outage, EICAR, encrypted archives, concurrent quota reservations,
   unauthorized downloads, deletion, and lifecycle cleanup before removing local
   storage. A bucket malware scanner alone does not replace validation or quotas.
