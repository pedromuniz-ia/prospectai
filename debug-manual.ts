
import { db } from './src/db/index';
import { leads } from './src/db/schema/leads';
import { whatsappInstances } from './src/db/schema/whatsapp-instances';
import { eq, and } from 'drizzle-orm';
import { checkWhatsapp } from './src/lib/enrichment/whatsapp-check';

async function test() {
    const leadId = "uzhkrcffmzlxq60i8bd1yqwx";
    const lead = await db.query.leads.findFirst({
        where: eq(leads.id, leadId),
    });

    if (!lead || !lead.phone) {
        console.error("Lead or phone not found");
        return;
    }

    console.log("Testing Lead:", lead.name, "Phone:", lead.phone);

    const instance = await db.query.whatsappInstances.findFirst({
        where: and(
            eq(whatsappInstances.organizationId, lead.organizationId),
            eq(whatsappInstances.status, "connected")
        ),
    });

    if (!instance) {
        console.log("NO CONNECTED INSTANCE FOUND");
        return;
    }

    console.log("Found instance:", instance.instanceName);

    const result = await checkWhatsapp(lead.phone, instance.instanceName);
    console.log("Check Result:", JSON.stringify(result, null, 2));
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
