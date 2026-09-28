const db = require("../config/db");

const DEFAULT_SETTINGS = {
  baseDiscount: Number(process.env.REFERRAL_DISCOUNT_AMOUNT || 200),
  bonusDiscount: Number(process.env.REFERRAL_BONUS_DISCOUNT_AMOUNT || 500),
  bonusParticipantThreshold: Number(process.env.REFERRAL_BONUS_PARTICIPANT_THRESHOLD || 5),
  freeSlotThreshold: Number(process.env.REFERRAL_FREE_TREK_THRESHOLD || 5),
  freeSlotValue: Number(process.env.REFERRAL_FREE_TREK_VALUE || 1),
  isEnabled: 1,
};

let schemaReady = false;

async function ensureReferralSettingsSchema() {
  if (schemaReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS referral_settings (
      id CHAR(36) NOT NULL PRIMARY KEY,
      base_discount DECIMAL(10,2) NOT NULL DEFAULT 0,
      bonus_discount DECIMAL(10,2) NOT NULL DEFAULT 0,
      bonus_participant_threshold INT NOT NULL DEFAULT 0,
      free_slot_threshold INT NOT NULL DEFAULT 0,
      free_slot_value INT NOT NULL DEFAULT 0,
      is_enabled TINYINT(1) NOT NULL DEFAULT 1,
      updated_by CHAR(36) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  const [[row]] = await db.query("SELECT COUNT(*) AS total FROM referral_settings");
  if (!Number(row?.total)) {
    await db.query(
      `INSERT INTO referral_settings
        (id, base_discount, bonus_discount, bonus_participant_threshold, free_slot_threshold, free_slot_value, is_enabled)
       VALUES (UUID(), ?, ?, ?, ?, ?, ?)`,
      [
        DEFAULT_SETTINGS.baseDiscount,
        DEFAULT_SETTINGS.bonusDiscount,
        DEFAULT_SETTINGS.bonusParticipantThreshold,
        DEFAULT_SETTINGS.freeSlotThreshold,
        DEFAULT_SETTINGS.freeSlotValue,
        DEFAULT_SETTINGS.isEnabled,
      ]
    );
  }

  schemaReady = true;
}

function mapRowToSettings(row) {
  if (!row) return null;
  return {
    id: row.id,
    baseDiscount: Number(row.base_discount || 0),
    bonusDiscount: Number(row.bonus_discount || 0),
    bonusParticipantThreshold: Number(row.bonus_participant_threshold || 0),
    freeSlotThreshold: Number(row.free_slot_threshold || 0),
    freeSlotValue: Number(row.free_slot_value || 0),
    isEnabled: row.is_enabled === 0 ? 0 : 1,
    updatedBy: row.updated_by
      ? {
          id: row.updated_by,
          name: row.updated_by_name || null,
          email: row.updated_by_email || null,
        }
      : null,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  };
}

async function getReferralSettings() {
  await ensureReferralSettingsSchema();
  const [rows] = await db.query(
    `SELECT rs.*, a.name AS updated_by_name, a.email AS updated_by_email
     FROM referral_settings rs
     LEFT JOIN admins a ON a.id COLLATE utf8mb4_unicode_ci = rs.updated_by
     ORDER BY rs.id ASC
     LIMIT 1`
  );
  return mapRowToSettings(rows[0]);
}

async function updateReferralSettings(payload, adminId) {
  await ensureReferralSettingsSchema();
  const [[row]] = await db.query("SELECT id FROM referral_settings ORDER BY id ASC LIMIT 1");
  const values = [
    payload.baseDiscount,
    payload.bonusDiscount,
    payload.bonusParticipantThreshold,
    payload.freeSlotThreshold,
    payload.freeSlotValue,
    payload.isEnabled ? 1 : 0,
    adminId || null,
  ];

  if (!row) {
    await db.query(
      `INSERT INTO referral_settings
        (base_discount, bonus_discount, bonus_participant_threshold, free_slot_threshold, free_slot_value, is_enabled, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      values
    );
  } else {
    values.push(row.id);
    await db.query(
      `UPDATE referral_settings
        SET base_discount = ?,
            bonus_discount = ?,
            bonus_participant_threshold = ?,
            free_slot_threshold = ?,
            free_slot_value = ?,
            is_enabled = ?,
            updated_by = ?
        WHERE id = ?`,
      values
    );
  }

  return getReferralSettings();
}

module.exports = {
  ensureReferralSettingsSchema,
  getReferralSettings,
  updateReferralSettings,
};
