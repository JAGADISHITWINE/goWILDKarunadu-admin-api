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

// // Test DB connection on startup
// (async () => {
//     try {
//         const connection = await db.getConnection();
//         connection.release();
//     } catch (err) {
//         
//         
//         

//         // Helpful hints
//         if (err.code === 'ETIMEDOUT') {
//             
//         }
//         if (err.code === 'ECONNREFUSED') {
//             
//         }
//         if (err.code === 'ER_ACCESS_DENIED_ERROR') {
//             
//         }
//         if (err.code === 'ER_BAD_DB_ERROR') {
//             
//         }
//     }
// })();

// module.exports = db;

const mysql = require('mysql2');
require('dotenv').config();

const hasUri = Boolean(process.env.MYSQL_URL);
const dbTimeZone = process.env.DB_TIMEZONE_OFFSET || '+05:30';
const dbConfig = hasUri
  ? { uri: process.env.MYSQL_URL }
  : {
    host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'goWILDKarunadu',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
    connectTimeout: process.env.DB_CONNECT_TIMEOUT ? Number(process.env.DB_CONNECT_TIMEOUT) : 10000,
  };

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: dbTimeZone,
  dateStrings: true,
});

pool.on('connection', (connection) => {
  connection.query('SET time_zone = ?', [dbTimeZone]);
});

const db = pool.promise();

// Test connection and auto-migrate missing schema
(async () => {
  try {
    const conn = await db.getConnection();
    // Auto-migrate captain columns on trek_batches
    try {
      const [captainCols] = await conn.query("SHOW COLUMNS FROM trek_batches LIKE 'captain_name'");
      if (!Array.isArray(captainCols) || captainCols.length === 0) {
        await conn.query(`
          ALTER TABLE trek_batches
          ADD COLUMN captain_name VARCHAR(150) NULL,
          ADD COLUMN captain_phone VARCHAR(50) NULL,
          ADD COLUMN captain_email VARCHAR(150) NULL
        `);
      }
    } catch (e) {
    }

    // Auto-migrate collection column on treks
    try {
      const [colCols] = await conn.query("SHOW COLUMNS FROM treks LIKE 'collection'");
      if (!Array.isArray(colCols) || colCols.length === 0) {
        await conn.query(`
          ALTER TABLE treks
          ADD COLUMN collection VARCHAR(100) NULL AFTER category
        `);
      }
    } catch (e) {
    }

    conn.release();
  } catch (err) {
  }
})();

module.exports = db;
