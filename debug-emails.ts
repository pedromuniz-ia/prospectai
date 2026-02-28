import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./src/db/schema";
import { leads } from "./src/db/schema/leads";
import { isNotNull, or } from "drizzle-orm";

const client = createClient({
    url: process.env.TURSO_CONNECTION_URL || "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client, { schema });

async function checkEmails() {
    console.log("🔍 Analisando e-mails extraídos...");

    const results = await db.query.leads.findMany({
        where: or(isNotNull(leads.email), isNotNull(leads.whoisEmail)),
        columns: {
            name: true,
            email: true,
            whoisEmail: true,
            website: true
        },
        limit: 20
    });

    if (results.length === 0) {
        console.log("❌ Nenhum lead com e-mail encontrado no banco.");

        // Check how many have websites but no email
        const withWebsiteNoEmail = await db.query.leads.findMany({
            where: isNotNull(leads.website),
            limit: 5
        });
        console.log(`💡 Leads com website: ${withWebsiteNoEmail.length}`);
    } else {
        console.log(`✅ Sucesso! Encontrei ${results.length} leads com e-mail.`);
        results.forEach(l => {
            console.log(`- ${l.name}: Website Email [${l.email || 'N/A'}] | WHOIS [${l.whoisEmail || 'N/A'}]`);
        });
    }
}

checkEmails().catch(console.error);
