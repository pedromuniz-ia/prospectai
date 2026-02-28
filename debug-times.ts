
import { db } from './src/db/index';
import { leads } from './src/db/schema/leads';
import { isNotNull, isNull, eq, and } from 'drizzle-orm';

async function test() {
    const orgId = "tm4PixfsK54b8ug1r5sDIy0KdMjFT1L3";

    const succeeded = await db.select({ min: leads.enrichedAt, max: leads.enrichedAt }).from(leads).where(
        and(
            eq(leads.organizationId, orgId),
            isNotNull(leads.hasWhatsapp)
        )
    );

    const failed = await db.select({ min: leads.enrichedAt, max: leads.enrichedAt }).from(leads).where(
        and(
            eq(leads.organizationId, orgId),
            isNull(leads.hasWhatsapp),
            isNotNull(leads.enrichedAt)
        )
    );

    const succMin = succeeded.length ? new Date(Math.min(...succeeded.map(l => l.min!.getTime()))) : null;
    const succMax = succeeded.length ? new Date(Math.max(...succeeded.map(l => l.max!.getTime()))) : null;
    const failMin = failed.length ? new Date(Math.min(...failed.map(l => l.min!.getTime()))) : null;
    const failMax = failed.length ? new Date(Math.max(...failed.map(l => l.max!.getTime()))) : null;

    console.log('Succeeded Range:', succMin, 'to', succMax);
    console.log('Failed Range:', failMin, 'to', failMax);
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
