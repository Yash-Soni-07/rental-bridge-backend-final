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
    // Set rejectUnauthorized to false to allow Supabase's certificate
    ssl: {
        rejectUnauthorized: false,
    },
});

export const db = drizzle(pool);