#!/bin/sh
# Nightly SQLite + receipts backup to S3. Run from the host via cron:
#   0 9 * * * /home/ubuntu/brew-buddy/scripts/backup-to-s3.sh >> /var/log/brewbuddy-backup.log 2>&1
# Requires: aws cli configured (or an instance role), BACKUP_BUCKET set below or in env.
set -eu

BUCKET="${BACKUP_BUCKET:?set BACKUP_BUCKET, e.g. s3://brew-buddy-backups}"
STAMP="$(date +%Y-%m-%d)"
VOLUME="brew-buddy_app-data"

# Copy the DB out of the docker volume with a consistent snapshot (sqlite .backup).
docker run --rm -v "$VOLUME":/data -v /tmp:/out alpine:3 sh -c \
  "apk add --no-cache sqlite >/dev/null && sqlite3 /data/brewbuddy.db \".backup /out/brewbuddy-$STAMP.db\" && cp -r /data/receipts /out/receipts-$STAMP 2>/dev/null || true"

aws s3 cp "/tmp/brewbuddy-$STAMP.db" "$BUCKET/db/brewbuddy-$STAMP.db"
if [ -d "/tmp/receipts-$STAMP" ]; then
  aws s3 sync "/tmp/receipts-$STAMP" "$BUCKET/receipts/" --size-only
fi
rm -rf "/tmp/brewbuddy-$STAMP.db" "/tmp/receipts-$STAMP"
echo "backup $STAMP done"
