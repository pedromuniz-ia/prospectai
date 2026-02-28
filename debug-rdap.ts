import "dotenv/config";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./src/db/schema";
import { leads } from "./src/db/schema/leads";
import { isNotNull } from "drizzle-orm";

const client = createClient({
    url: process.env.TURSO_CONNECTION_URL || "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
});

const db = drizzle(client, { schema });

async function checkRdapEnrichment() {
    console.log("🔍 Buscando leads enriquecidos via RDAP (WHOIS)...");

    const results = await db.query.leads.findMany({
        where: isNotNull(leads.whoisResponsible),
        columns: {
            id: true,
            name: true,
            website: true,
            whoisResponsible: true,
            whoisEmail: true,
            phone: true,
            phoneSecondary: true
        }
    });

    if (results.length === 0) {
        console.log("❌ Nenhum lead encontrado com dados de RDAP no momento.");

        const total = await db.query.leads.findMany({
            limit: 5,
            columns: { name: true, website: true, whoisResponsible: true }
        });
        console.log(`💡 Amostra de leads no banco (${total.length}):`);
        total.forEach(t => console.log(`- ${t.name} (Website: ${t.website || 'N/A'}, RDAP: ${t.whoisResponsible || 'Vazio'})`));
    } else {
        console.log(`✅ Encontrados ${results.length} leads com dados de decisor (RDAP):`);
        results.forEach(l => {
            console.log(`-------------------`);
            console.log(`Empresa: ${l.name}`);
            console.log(`Decisor (RDAP): ${l.whoisResponsible}`);
            console.log(`Email Decisor: ${l.whoisEmail || 'N/A'}`);
            console.log(`Telefone Principal: ${l.phone || 'N/A'}`);
            console.log(`Telefone Secundário: ${l.phoneSecondary || 'N/A'}`);
        });
    }
}

checkRdapEnrichment().catch(console.error);
