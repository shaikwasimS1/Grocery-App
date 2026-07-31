const sql = require('mssql/msnodesqlv8');

// Configuration for Windows Authentication connecting to SQLEXPRESS
const config = {
  connectionString: 'Driver={SQL Server};Server=DESKTOP-0AA9057\\SQLEXPRESS;Database=groceryshop;Trusted_Connection=yes;'
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then(pool => {
    console.log('Connected to SQL Server (groceryshop)');
    return pool;
  })
  .catch(err => {
    console.error('Database Connection Failed! Bad Config: ', err);
    process.exit(1);
  });

module.exports = {
  sql,
  poolPromise
};
