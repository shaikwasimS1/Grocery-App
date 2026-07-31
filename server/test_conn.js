const sql = require('msnodesqlv8');
const connectionString = "server=DESKTOP-0AA9057\\SQLEXPRESS;Database=groceryshop;Trusted_Connection=Yes;Driver={SQL Server}";

sql.query(connectionString, "SELECT 1 as num", (err, rows) => {
    if (err) {
        console.log("Error:", err);
    } else {
        console.log("Success:", rows);
    }
});
