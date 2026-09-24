const bcrypt = require("bcryptjs");
const db = require("../config/db");
const rbacService = require("../service/rbac.service");
const { createUuid } = require("../utils/id");
const auditService = require("../service/audit.service");

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

async function createAdminWithRole(req, res) {
  try {
    await rbacService.ensureRbacSchema();

    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const roleKey = String(req.body?.roleKey || "super_admin").trim();

    if (!name || !email || !password || !roleKey) {
      return res.status(400).json({
        success: false,
        message: "name, email, password and roleKey are required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const [[role]] = await db.query(
      "SELECT id, role_key, role_name FROM admin_roles WHERE role_key = ? LIMIT 1",
      [roleKey]
    );

    if (!role) {
      return res.status(400).json({
        success: false,
        message: "Invalid roleKey",
      });
    }

    const [[existing]] = await db.query(
      "SELECT id FROM admins WHERE email = ? LIMIT 1",
      [email]
    );

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Admin already exists with this email",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const adminId = createUuid();
    const [insertResult] = await db.query(
      `INSERT INTO admins (id, name, email, password, role_id, role, status)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [adminId, name, email, hashedPassword, role.id, role.role_key]
    );

    await auditService.logAuditEvent({
      actionType: 'admin.create',
      entityType: 'admin',
      entityId: adminId,
      summary: `Created admin ${name} (${email})`,
      afterData: {
        name,
        email,
        role: role.role_key,
        roleName: role.role_name,
        status: 1,
      },
      metadata: {
        insertId: insertResult?.insertId || null,
      },
      createdBy: req.user?.id || null,
      createdByEmail: req.user?.email || null,
      createdByRole: req.user?.roleName || req.user?.role || null,
    });

    return res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: {
        id: adminId,
        name,
        email,
        role: role.role_key,
        roleName: role.role_name,
      },
    });
  } catch (error) {
    console.error("Create admin with role error:", error);
    return res.status(500).json({
      success: false,
      message: error?.sqlMessage || "Failed to create admin",
    });
  }
}

module.exports = {
  createAdminWithRole,
};
