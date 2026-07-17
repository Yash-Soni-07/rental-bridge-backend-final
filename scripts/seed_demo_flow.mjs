/**
 * seed_demo_flow.mjs
 * Seeds realistic bookings, payments, applications, and maintenance requests for demonstration.
 */
import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Clear existing demo tables first
        await client.query("DELETE FROM payments");
        await client.query("DELETE FROM maintenance_requests");
        await client.query("DELETE FROM bookings");
        await client.query("DELETE FROM applications");

        // Verify users exist
        const tenantRes = await client.query("SELECT id FROM users WHERE id = 4");
        if (tenantRes.rows.length === 0) {
            throw new Error("Tenant with ID 4 not found. Please seed users first.");
        }

        // Get two property IDs
        const propRes = await client.query("SELECT id, monthly_rent, security_deposit FROM properties LIMIT 2");
        if (propRes.rows.length < 2) {
            throw new Error("At least 2 properties are required. Please run seed_featured.mjs first.");
        }

        const propA = propRes.rows[0];
        const propB = propRes.rows[1];

        console.log(`Using Property A (ID: ${propA.id}) and Property B (ID: ${propB.id}) for demo flow seeding.`);

        // 1. Insert Pending Application
        const moveInDate = new Date();
        moveInDate.setDate(moveInDate.getDate() + 14); // 2 weeks from now
        
        await client.query(
            `INSERT INTO applications (property_id, applicant_id, status, monthly_income, employment_status, move_in_date, message, created_at, updated_at)
             VALUES ($1, $2, 'pending', 75000.00, 'full_time', $3, 'Looking forward to moving into this beautiful flat near my workplace.', NOW(), NOW())`,
            [propA.id, 4, moveInDate]
        );
        console.log("Seeded pending application.");

        // 2. Insert Confirmed Booking (Lease)
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1); // Started 1 month ago
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 11); // 1 year lease

        const bookingRes = await client.query(
            `INSERT INTO bookings (property_id, tenant_id, status, start_date, end_date, monthly_rent, security_deposit, total_amount, payment_status, created_at, updated_at)
             VALUES ($1, $2, 'confirmed', $3, $4, $5, $6, $7, 'partially_paid', NOW(), NOW())
             RETURNING id`,
            [propB.id, 4, startDate, endDate, propB.monthly_rent, propB.security_deposit, propB.monthly_rent]
        );
        const bookingId = bookingRes.rows[0].id;
        console.log(`Seeded confirmed booking with ID: ${bookingId}`);

        // 3. Insert Payments
        const due1 = new Date();
        due1.setDate(due1.getDate() - 25); // Due 25 days ago
        const paid1 = new Date();
        paid1.setDate(paid1.getDate() - 24); // Paid 24 days ago

        const due2 = new Date();
        due2.setDate(due2.getDate() + 5); // Due in 5 days

        // Paid rent payment
        await client.query(
            `INSERT INTO payments (booking_id, amount, payment_type, payment_method, transaction_id, status, due_date, paid_date, created_at)
             VALUES ($1, $2, 'rent', 'upi', 'TXN987654321', 'paid', $3, $4, NOW())`,
            [bookingId, propB.monthly_rent, due1, paid1]
        );

        // Pending deposit payment
        await client.query(
            `INSERT INTO payments (booking_id, amount, payment_type, payment_method, status, due_date, created_at)
             VALUES ($1, $2, 'deposit', 'net_banking', 'pending', $3, NOW())`,
            [bookingId, propB.security_deposit, due2]
        );
        console.log("Seeded payments (1 paid rent, 1 pending deposit).");

        // 4. Insert Maintenance Request
        await client.query(
            `INSERT INTO maintenance_requests (property_id, tenant_id, title, description, priority, status, created_at, updated_at)
             VALUES ($1, $2, 'Bathroom Faucet Leaking', 'The primary bathroom faucet is dripping continuously since yesterday. Needs a replacement washer.', 'medium', 'open', NOW(), NOW())`,
            [propB.id, 4]
        );
        console.log("Seeded maintenance request.");

        await client.query("COMMIT");
        console.log("Demo flow seeding completed successfully!");
    } catch (e) {
        await client.query("ROLLBACK");
        console.error("Error during seeding:", e);
    } finally {
        client.release();
    }
}

main().catch(console.error);
