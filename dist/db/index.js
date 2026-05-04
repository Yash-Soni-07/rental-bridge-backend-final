import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined');
}
// Configure SSL based on environment
const isProduction = process.env.NODE_ENV === 'production';
const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isProduction
        ? { rejectUnauthorized: true } // Production: validate certificate
        : { rejectUnauthorized: false }, // Development: accept self-signed certs
});
export const db = drizzle(pool);
//# sourceMappingURL=index.js.map