#!/usr/bin/env bash
# ──────────────────────────────────────────────
# PostgreSQL Backup Script for SI YBY NET
# Usage: ./scripts/db-backup.sh
# Cron:  0 2 * * * /var/www/si-ybynet/scripts/db-backup.sh
# ──────────────────────────────────────────────
set -euo pipefail

# ── Configuration ─────────────────────────────
CONTAINER="${DB_CONTAINER:-siybynet-postgres}"
DB_NAME="${DB_NAME:-si_ybynet}"
DB_USER="${DB_USER:-si_ybynet}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# ── Setup ─────────────────────────────────────
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

# ── Dump & Compress ──────────────────────────
echo "[$(date)] Starting backup of ${DB_NAME}..."

docker exec "$CONTAINER" pg_dump \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists | gzip > "$BACKUP_FILE"

FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup complete: ${BACKUP_FILE} (${FILESIZE})"

# ── Cleanup old backups ──────────────────────
DELETED=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +"$RETENTION_DAYS" -print -delete | wc -l)
if [ "$DELETED" -gt 0 ]; then
  echo "[$(date)] Cleaned up ${DELETED} backup(s) older than ${RETENTION_DAYS} days"
fi

echo "[$(date)] Done. Active backups:"
ls -lh "$BACKUP_DIR"/${DB_NAME}_*.sql.gz 2>/dev/null | tail -5
