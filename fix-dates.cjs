const { sql, poolPromise } = require('./server/db');

async function run() {
  const pool = await poolPromise;
  
  // Update Sales
  await pool.request().query("UPDATE Sales SET sold_at = DATEADD(minute, -330, sold_at) WHERE sold_at > '2026-07-31 18:00:00'");
  
  // Update Wastage
  await pool.request().query("UPDATE Wastage SET wasted_at = DATEADD(minute, -330, wasted_at) WHERE wasted_at > '2026-07-31 18:00:00'");
  
  // Update Inventory created_at
  await pool.request().query("UPDATE Inventory SET created_at = DATEADD(minute, -330, created_at) WHERE created_at > '2026-07-31 18:00:00'");

  console.log('Fixed timestamps.');
  process.exit(0);
}

run().catch(console.error);
