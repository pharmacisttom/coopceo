#!/usr/bin/env bash
# ============================================================================
# RYCOOP Smart Finance — Database Restore & DR Test Script
# Rule 7: Disaster Recovery verification drill
# ============================================================================

set -e

if [ -z "$1" ]; then
    echo "Usage: $0 <path_to_backup_file.sql.gz>"
    exit 1
fi

BACKUP_FILE="$1"
CONTAINER_NAME="rycoop_test_postgres"
DB_NAME="${POSTGRES_DB:-rycoop_smart_finance_test}"
DB_USER="${POSTGRES_USER:-rycoop_test_user}"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "=== [RYCOOP RESTORE] Checking SHA256 integrity ==="
if [ -f "${BACKUP_FILE}.sha256" ]; then
    sha256sum -c "${BACKUP_FILE}.sha256"
else
    echo "Warning: No sha256 checksum file found. Proceeding with caution..."
fi

echo "=== [RYCOOP RESTORE] Restoring database to $CONTAINER_NAME ($DB_NAME) ==="
gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME"

echo "=== [RYCOOP RESTORE] Running Post-Restore Sanity Checks ==="
docker exec -t "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT 
    (SELECT COUNT(*) FROM users) as users_count,
    (SELECT COUNT(*) FROM notifications) as notifications_count,
    (SELECT COUNT(*) FROM investment_proposals) as investments_count,
    (SELECT COUNT(*) FROM audit_logs) as audit_logs_count;
"

echo "=== [RYCOOP RESTORE] Restore drill completed successfully at $(date) ==="

