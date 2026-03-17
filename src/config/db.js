// const mysql = require('mysql2');
// require('dotenv').config();

// // Detect if running on Railway
// const isRailway = process.env.MYSQLHOST;

// // Create connection pool
// const db = mysql.createPool({
//     host: isRailway ? process.env.MYSQLHOST : process.env.DB_HOST || '127.0.0.1',
//     user: isRailway ? process.env.MYSQLUSER : process.env.DB_USER || 'root',
//     password: isRailway ? process.env.MYSQLPASSWORD : process.env.DB_PASSWORD || '',
//     database: isRailway ? process.env.MYSQLDATABASE : process.env.DB_NAME || 'goWILDKarunadu',
//     port: isRailway ? Number(process.env.MYSQLPORT) : (process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306),
//     connectTimeout: process.env.DB_CONNECT_TIMEOUT
//         ? Number(process.env.DB_CONNECT_TIMEOUT)
//         : 10000,
//     waitForConnections: true,
//     connectionLimit: 10,
//     queueLimit: 0,
// }).promise();
// console.log("ENV CHECK:", {
//   host: process.env.DB_HOST || process.env.MYSQLHOST,
//   user: process.env.DB_USER || process.env.MYSQLUSER,
//   db: process.env.DB_NAME || process.env.MYSQLDATABASE,
// });
// // Test DB connection on startup
// (async () => {
//     try {
//         const connection = await db.getConnection();
//         console.log("✅ MySQL Connected Successfully 🚀");
//         console.log(`📡 Host: ${connection.config.host}`);
//         console.log(`📂 Database: ${connection.config.database}`);
//         connection.release();
//     } catch (err) {
//         console.error("❌ Database connection failed");
//         console.error(`Code: ${err.code}`);
//         console.error(`Message: ${err.message}`);

//         // Helpful hints
//         if (err.code === 'ETIMEDOUT') {
//             console.error("👉 Check DB_HOST / MYSQLHOST (network issue)");
//         }
//         if (err.code === 'ECONNREFUSED') {
//             console.error("👉 MySQL server not running / wrong host");
//         }
//         if (err.code === 'ER_ACCESS_DENIED_ERROR') {
//             console.error("👉 Wrong username/password");
//         }
//         if (err.code === 'ER_BAD_DB_ERROR') {
//             console.error("👉 Database does not exist");
//         }
//     }
// })();

// module.exports = db;

const mysql = require('mysql2');
require('dotenv').config();

const db = mysql.createPool({
  uri: process.env.MYSQL_URL,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}).promise();

// Test connection
(async () => {
  try {
    const conn = await db.getConnection();
    console.log("✅ DB Connected");
    conn.release();
  } catch (err) {
    console.error("❌ DB Error:", err.message);
  }
})();

module.exports = db;