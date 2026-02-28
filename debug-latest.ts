
import { db } from './src/db/index';
import { leads } from './src/db/schema/leads';
import { desc, eq } from 'drizzle-orm';

async function test() {
    const latest = await db.select().from(leads).where(
        eq(leads.organizationId, "tm4PixfsK54b8ug1r5sDIy0KdMjFT1L3")
    ).orderBy(desc(leads.createdAt)).limit(10);

    console.log('Latest Leads:', latest.map(l => ({ id: l.id, name: l.name, wa: l.hasWhatsapp, created: l.createdAt, enriched: l.enrichedAt })));
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
