
import { db } from './src/db/index';
import { auditLogs } from './src/db/schema/audit-logs';
import { eq, and } from 'drizzle-orm';

async function test() {
    const entityId = "uzhkrcffmzlxq60i8bd1yqwx";
    const logs = await db.select().from(auditLogs).where(
        and(
            eq(auditLogs.entityId, entityId),
            eq(auditLogs.action, "lead_enriched")
        )
    );
    console.log('Enrichment Audit Logs:', JSON.stringify(logs, null, 2));
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
