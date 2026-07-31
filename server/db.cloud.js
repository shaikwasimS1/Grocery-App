require('dotenv').config();
const sql = require('mssql');

// -------------------------------------------------------
// Cloud-ready connection config using environment variables
// Works with: Azure SQL (Free Tier) on Render / Railway
// -------------------------------------------------------
const config = {
  server:   process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port:     parseInt(process.env.DB_PORT, 10) || 1433,
  options: {
    encrypt:                true,  // Required for Azure SQL cloud
    trustServerCertificate: false, // Must be false for Azure
    enableArithAbort:       true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('✅ Connected to Azure SQL (groceryshop)');
    return pool;
  })
  .catch(err => {
    console.error('❌ Database Connection Failed:', err.message);
    process.exit(1);
  });

module.exports = { sql, poolPromise };
