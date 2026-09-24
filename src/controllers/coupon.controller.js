const db = require("../config/db");
const couponService = require("../service/coupon.service");
const { createUuid } = require("../utils/id");

function normalizeCode(code = "") {
  return String(code || "").trim().toUpperCase();
}

function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function getCoupons(req, res) {
  try {
    await couponService.ensureCouponSchema();
    const trekId = String(req.query?.trekId || '').trim() || null;

    let query = `
      SELECT
        c.id,
        c.trek_id AS trekId,
        COALESCE(t.name, 'All Treks (Global)') AS trekName,
        c.code,
        c.discount_type AS discountType,
        c.discount_value AS discountValue,
        c.min_booking_amount AS minBookingAmount,
        c.max_discount_amount AS maxDiscountAmount,
        c.start_date AS startDate,
        c.end_date AS endDate,
        c.usage_limit AS usageLimit,
        c.usage_count AS usageCount,
        c.is_active AS isActive,
        c.created_at AS createdAt,
        c.updated_at AS updatedAt
      FROM trek_coupons c
      LEFT JOIN treks t ON t.id = c.trek_id COLLATE utf8mb4_unicode_ci
    `;
    const params = [];

    if (trekId && trekId !== 'ALL') {
      query += " WHERE c.trek_id = ? OR c.trek_id IS NULL";
      params.push(trekId);
    }
    query += " ORDER BY c.updated_at DESC";

    const [rows] = await db.query(query, params);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Get coupons error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch coupons" });
  }
}

async function createCoupon(req, res) {
  try {
    await couponService.ensureCouponSchema();

    let trekId = String(req.body?.trekId || '').trim() || null;
    if (trekId === 'ALL' || trekId === 'null' || !trekId) {
      trekId = null;
    }
    const code = normalizeCode(req.body?.code);
    const discountType = String(req.body?.discountType || "").trim().toLowerCase();
    const discountValue = toNumber(req.body?.discountValue, null);
    const minBookingAmount = toNumber(req.body?.minBookingAmount, 0);
    const maxDiscountAmount = toNumber(req.body?.maxDiscountAmount, null);
    const startDate = req.body?.startDate || null;
    const endDate = req.body?.endDate || null;
    const usageLimit = toNumber(req.body?.usageLimit, null);
    const isActive = req.body?.isActive === false || req.body?.isActive === 0 ? 0 : 1;

    if (!code || !discountType || discountValue === null) {
      return res.status(400).json({
        success: false,
        message: "code, discountType and discountValue are required",
      });
    }
    if (!["percentage", "flat"].includes(discountType)) {
      return res.status(400).json({ success: false, message: "discountType must be percentage or flat" });
    }
    if (discountValue <= 0) {
      return res.status(400).json({ success: false, message: "discountValue must be greater than 0" });
    }
    if (discountType === "percentage" && discountValue > 100) {
      return res.status(400).json({ success: false, message: "percentage coupon cannot exceed 100" });
    }

    if (trekId) {
      const [[trek]] = await db.query("SELECT id FROM treks WHERE id = ? LIMIT 1", [trekId]);
      if (!trek) {
        return res.status(404).json({ success: false, message: "Trek not found" });
      }
    }

    const couponId = createUuid();
    await db.query(
      `INSERT INTO trek_coupons
      (id, trek_id, code, discount_type, discount_value, min_booking_amount, max_discount_amount, start_date, end_date, usage_limit, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [couponId, trekId, code, discountType, discountValue, minBookingAmount, maxDiscountAmount, startDate, endDate, usageLimit, isActive]
    );

    return res.status(201).json({
      success: true,
      message: "Coupon created",
      data: { id: couponId },
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Coupon code already exists" });
    }
    console.error("Create coupon error:", error);
    return res.status(500).json({ success: false, message: "Failed to create coupon" });
  }
}

async function updateCoupon(req, res) {
  try {
    await couponService.ensureCouponSchema();
    const couponId = String(req.params?.id || '').trim() || null;
    if (!couponId) return res.status(400).json({ success: false, message: "Invalid coupon id" });

    const [[existing]] = await db.query("SELECT id FROM trek_coupons WHERE id = ? LIMIT 1", [couponId]);
    if (!existing) return res.status(404).json({ success: false, message: "Coupon not found" });

    let trekId = req.body?.trekId !== undefined ? (String(req.body.trekId || '').trim() || null) : undefined;
    if (trekId === 'ALL' || trekId === 'null') {
      trekId = null;
    }
    const code = req.body?.code !== undefined ? normalizeCode(req.body.code) : undefined;
    const discountType = req.body?.discountType !== undefined ? String(req.body.discountType).trim().toLowerCase() : undefined;
    const discountValue = req.body?.discountValue !== undefined ? toNumber(req.body.discountValue, null) : undefined;
    const minBookingAmount = req.body?.minBookingAmount !== undefined ? toNumber(req.body.minBookingAmount, 0) : undefined;
    const maxDiscountAmount = req.body?.maxDiscountAmount !== undefined ? toNumber(req.body.maxDiscountAmount, null) : undefined;
    const startDate = req.body?.startDate !== undefined ? req.body.startDate : undefined;
    const endDate = req.body?.endDate !== undefined ? req.body.endDate : undefined;
    const usageLimit = req.body?.usageLimit !== undefined ? toNumber(req.body.usageLimit, null) : undefined;
    const isActive = req.body?.isActive !== undefined ? (req.body.isActive ? 1 : 0) : undefined;

    if (discountType !== undefined && !["percentage", "flat"].includes(discountType)) {
      return res.status(400).json({ success: false, message: "discountType must be percentage or flat" });
    }
    if (discountValue !== undefined && discountValue !== null && discountValue <= 0) {
      return res.status(400).json({ success: false, message: "discountValue must be greater than 0" });
    }
    if (
      (discountType === "percentage" && discountValue !== undefined && discountValue > 100) ||
      (discountType === undefined && discountValue !== undefined)
    ) {
      const [[row]] = await db.query("SELECT discount_type FROM trek_coupons WHERE id = ? LIMIT 1", [couponId]);
      const effectiveType = discountType || row?.discount_type;
      if (effectiveType === "percentage" && discountValue > 100) {
        return res.status(400).json({ success: false, message: "percentage coupon cannot exceed 100" });
      }
    }

    const fields = [];
    const params = [];

    if (trekId !== undefined) {
      fields.push("trek_id = ?");
      params.push(trekId);
    }
    if (code !== undefined) {
      fields.push("code = ?");
      params.push(code);
    }
    if (discountType !== undefined) {
      fields.push("discount_type = ?");
      params.push(discountType);
    }
    if (discountValue !== undefined) {
      fields.push("discount_value = ?");
      params.push(discountValue);
    }
    if (minBookingAmount !== undefined) {
      fields.push("min_booking_amount = ?");
      params.push(minBookingAmount);
    }
    if (maxDiscountAmount !== undefined) {
      fields.push("max_discount_amount = ?");
      params.push(maxDiscountAmount);
    }
    if (startDate !== undefined) {
      fields.push("start_date = ?");
      params.push(startDate);
    }
    if (endDate !== undefined) {
      fields.push("end_date = ?");
      params.push(endDate);
    }
    if (usageLimit !== undefined) {
      fields.push("usage_limit = ?");
      params.push(usageLimit);
    }
    if (isActive !== undefined) {
      fields.push("is_active = ?");
      params.push(isActive);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: "No fields provided for update" });
    }

    params.push(couponId);
    await db.query(`UPDATE trek_coupons SET ${fields.join(", ")} WHERE id = ?`, params);
    return res.status(200).json({ success: true, message: "Coupon updated" });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "Coupon code already exists" });
    }
    console.error("Update coupon error:", error);
    return res.status(500).json({ success: false, message: "Failed to update coupon" });
  }
}

async function deleteCoupon(req, res) {
  try {
    await couponService.ensureCouponSchema();
    const couponId = String(req.params?.id || '').trim() || null;
    if (!couponId) return res.status(400).json({ success: false, message: "Invalid coupon id" });

    const [result] = await db.query("DELETE FROM trek_coupons WHERE id = ?", [couponId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Coupon not found" });
    }

    return res.status(200).json({ success: true, message: "Coupon deleted" });
  } catch (error) {
    console.error("Delete coupon error:", error);
    return res.status(500).json({ success: false, message: "Failed to delete coupon" });
  }
}

async function getCouponUsage(req, res) {
  try {
    await couponService.ensureCouponSchema();
    const couponId = String(req.params?.id || '').trim() || null;
    if (!couponId) return res.status(400).json({ success: false, message: "Invalid coupon id" });

    const [[coupon]] = await db.query(
      `SELECT c.*, COALESCE(t.name, 'All Treks (Global)') AS trekName 
       FROM trek_coupons c 
       LEFT JOIN treks t ON t.id = c.trek_id 
       WHERE c.id = ? LIMIT 1`,
      [couponId]
    );

    if (!coupon) return res.status(404).json({ success: false, message: "Coupon not found" });

    // Check bookings where coupon code was used
    let usageLogs = [];
    try {
      const [bookings] = await db.query(
        `SELECT b.id, b.booking_reference AS bookingReference, b.customer_name AS customerName,
                b.customer_email AS customerEmail, b.trek_name AS trekName, b.total_amount AS amount,
                b.created_at AS usedAt, b.booking_status AS status
         FROM bookings b
         WHERE b.coupon_code = ? OR b.applied_coupon = ?
         ORDER BY b.created_at DESC LIMIT 50`,
        [coupon.code, coupon.code]
      );
      usageLogs = bookings;
    } catch (err) {
      // Table or column might not have coupon_code column
      usageLogs = [];
    }

    return res.status(200).json({
      success: true,
      data: {
        coupon,
        usageCount: coupon.usage_count || usageLogs.length,
        usageLimit: coupon.usage_limit,
        logs: usageLogs
      }
    });
  } catch (error) {
    console.error("Get coupon usage error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch coupon usage" });
  }
}

module.exports = {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  getCouponUsage,
};
