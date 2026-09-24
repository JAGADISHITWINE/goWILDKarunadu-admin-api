const mysql = require('../node_modules/mysql2/promise');
const { execFileSync } = require('child_process');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
  user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'goWILDKarunadu',
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
};

const TABLES_TO_TRUNCATE = [
  'coupon_usages',
  'referral_reward_redemptions',
  'booking_referrals',
  'booking_addons',
  'booking_participants',
  'trek_ratings',
  'bookings',
  'trek_coupons',
  'trek_engagement',
  'trek_images',
  'trek_important_notes',
  'trek_things_to_carry',
  'trek_highlights',
  'trek_batches',
  'treks',
  'users',
  'otp_verifications',
];

async function resetDemoTables() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    await conn.beginTransaction();
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of TABLES_TO_TRUNCATE) {
      await conn.query(`TRUNCATE TABLE \`${table}\``);
      console.log(`Truncated ${table}`);
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');
    await conn.commit();
    console.log('Demo tables reset completed.');
  } catch (error) {
    await conn.rollback();
    console.error('Demo table reset failed:', error);
    throw error;
  } finally {
    await conn.end();
  }
}

function runStep(label, scriptPath) {
  console.log(`Running ${label}...`);
  execFileSync('node', [scriptPath], {
    stdio: 'inherit',
    env: process.env,
  });
}

async function main() {
  await resetDemoTables();
  runStep('trek seed', '/tmp/seed-demo-treks.js');
  runStep('commerce seed', '/tmp/seed-demo-commerce.js');
  runStep('edge-case seed', `${__dirname}/seed-demo-edge-cases.js`);
  runStep('content seed', `${__dirname}/seed-demo-content.js`);
  runStep('missing-table seed', `${__dirname}/seed-demo-missing-tables.js`);
  console.log('Full demo reset and reseed completed.');
}

main().catch((error) => {
  console.error('Reset and reseed failed:', error);
  process.exit(1);
});
