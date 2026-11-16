#!/usr/bin/env bash
# ============================================================================
# RYCOOP Smart Finance — Automated Database Backup Script
# Rule 7: Backup, Encryption and Disaster Recovery Verification
# ============================================================================

set -e

BACKUP_DIR="${BACKUP_DIR:-/var/backups/rycoop}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/rycoop_db_${TIMESTAMP}.sql.gz"
CONTAINER_NAME="rycoop_test_postgres"
DB_NAME="${POSTGRES_DB:-rycoop_smart_finance_test}"
DB_USER="${POSTGRES_USER:-rycoop_test_user}"

mkdir -p "$BACKUP_DIR"

echo "=== [RYCOOP BACKUP] Starting database dump at $(date) ==="

docker exec -t "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists | gzip > "$BACKUP_FILE"

# Calculate SHA256 checksum for verification
sha256sum "$BACKUP_FILE" > "${BACKUP_FILE}.sha256"

# Verify size
FILESIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE")
echo "Backup created successfully: $BACKUP_FILE (${FILESIZE} bytes)"
echo "Checksum: $(cat "${BACKUP_FILE}.sha256")"

# Retain backups for 14 days, delete older
find "$BACKUP_DIR" -type f -name "rycoop_db_*.sql.gz*" -mtime +14 -exec rm {} \;
echo "=== [RYCOOP BACKUP] Retention check complete ==="
