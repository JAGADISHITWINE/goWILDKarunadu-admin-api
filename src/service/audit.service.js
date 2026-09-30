const db = require("../config/db");
const { createUuid } = require("../utils/id");

let schemaReady = false;

function safeJsonParse(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function safeJsonStringify(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function ensureAuditSchema() {
  // Schema is verified and managed by centralized migration runner
  return;
}

async function logAuditEvent(payload = {}) {
  try {
    await ensureAuditSchema();

    const entry = {
      id: createUuid(),
      actionType: String(payload.actionType || "update").trim() || "update",
      entityType: String(payload.entityType || "system").trim() || "system",
      entityId: payload.entityId ? String(payload.entityId).trim() : null,
      summary: String(payload.summary || "Admin action").trim().slice(0, 255),
      beforeData: safeJsonStringify(payload.beforeData),
      afterData: safeJsonStringify(payload.afterData),
      metadata: safeJsonStringify(payload.metadata),
      createdBy: payload.createdBy || null,
      createdByEmail: payload.createdByEmail ? String(payload.createdByEmail).trim() : null,
      createdByRole: payload.createdByRole ? String(payload.createdByRole).trim() : null,
    };

    await db.query(
      `INSERT INTO audit_logs (
        id, action_type, entity_type, entity_id, summary,
        before_data, after_data, metadata,
        created_by, created_by_email, created_by_role
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.actionType,
        entry.entityType,
        entry.entityId,
        entry.summary,
        entry.beforeData,
        entry.afterData,
        entry.metadata,
        entry.createdBy,
        entry.createdByEmail,
        entry.createdByRole,
      ]
    );

    return entry.id;
  } catch (error) {
    return null;
  }
}

async function getAuditLogs(limit = 50) {
  await ensureAuditSchema();

  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const [rows] = await db.query(
    `SELECT
      al.*,
      COALESCE(a.name, al.created_by_email, 'System') AS actor_name
     FROM audit_logs al
     LEFT JOIN admins a ON a.id COLLATE utf8mb4_unicode_ci = al.created_by
     ORDER BY al.created_at DESC
     LIMIT ?`,
    [safeLimit]
  );

  return rows.map((row) => ({
    id: row.id,
    actionType: row.action_type,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    beforeData: safeJsonParse(row.before_data),
    afterData: safeJsonParse(row.after_data),
    metadata: safeJsonParse(row.metadata),
    actor: row.actor_name,
    actorEmail: row.created_by_email,
    actorRole: row.created_by_role,
    createdAt: row.created_at,
  }));
}

module.exports = {
  ensureAuditSchema,
  logAuditEvent,
  getAuditLogs,
};
