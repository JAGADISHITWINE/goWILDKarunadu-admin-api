const db = require("../config/db");

let schemaReady = false;

async function ensureCouponSchema() {
  if (schemaReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS trek_coupons (
      id CHAR(36) NOT NULL PRIMARY KEY,
      trek_id CHAR(36) NULL,
      code VARCHAR(60) NOT NULL,
      discount_type ENUM('percentage', 'flat') NOT NULL DEFAULT 'percentage',
      discount_value DECIMAL(10,2) NOT NULL,
      min_booking_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      max_discount_amount DECIMAL(10,2) NULL,
      start_date DATETIME NULL,
      end_date DATETIME NULL,
      usage_limit INT NULL,
      usage_count INT NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_trek_coupons_trek_id (trek_id),
      KEY idx_trek_coupons_active (is_active)
    )
  `);

  try {
    await db.query(`ALTER TABLE trek_coupons MODIFY COLUMN trek_id CHAR(36) NULL`);
  } catch (err) {
    // Ignore error if column is already nullable
  }

  schemaReady = true;
}

module.exports = {
  ensureCouponSchema,
};
