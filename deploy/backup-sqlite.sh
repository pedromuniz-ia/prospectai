#!/bin/bash
# SQLite backup script — run via cron on the VPS
# Suggested cron: 0 */6 * * * /opt/prospectai/backup-sqlite.sh
#
# Keeps last 7 days of backups

set -e

DB_PATH="/opt/prospectai/data/prospectai.db"
BACKUP_DIR="/opt/prospectai/backups"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RETENTION_DAYS=7

mkdir -p "$BACKUP_DIR"

# Use SQLite's .backup command for a safe online backup
sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/prospectai-$TIMESTAMP.db'"

# Compress the backup
gzip "$BACKUP_DIR/prospectai-$TIMESTAMP.db"

# Remove backups older than retention period
find "$BACKUP_DIR" -name "prospectai-*.db.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup completed: prospectai-$TIMESTAMP.db.gz"
