const db = require('../config/db');
const auditService = require('../service/audit.service');

// Ensure schema columns for reviews moderation
let schemaEnsured = false;

async function ensureColumn(table, column, def) {
  try {
    const [rows] = await db.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [column]);
    if (rows.length === 0) {
      await db.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${def}`);
    }
  } catch (e) {
    // Ignore if table doesn't exist or column exists
  }
}

async function ensureReviewColumns() {
  if (schemaEnsured) return;
  try {
    // Ensure comments table has status & admin_reply
    await ensureColumn('comments', 'status', "VARCHAR(20) NOT NULL DEFAULT 'approved'");
    await ensureColumn('comments', 'admin_reply', "TEXT NULL");
    await ensureColumn('comments', 'replied_at', "DATETIME NULL");

    // Ensure trek_ratings table has status & admin_reply
    await ensureColumn('trek_ratings', 'status', "VARCHAR(20) NOT NULL DEFAULT 'approved'");
    await ensureColumn('trek_ratings', 'admin_reply', "TEXT NULL");
    await ensureColumn('trek_ratings', 'replied_at', "DATETIME NULL");

    schemaEnsured = true;
  } catch (err) {
    console.warn('[Reviews] Schema check warning:', err?.message);
  }
}

/**
 * GET /api/auth/reviews
 * Fetches all reviews across trek ratings and blog comments
 */
async function getAllReviews(req, res) {
  try {
    await ensureReviewColumns();

    const [trekReviews] = await db.query(`
      SELECT 
        tr.id,
        tr.id AS comment_id,
        COALESCE(u.full_name, b.customer_name, 'Trekker') AS author_name,
        COALESCE(t.name, 'Trek Experience') AS trek_name,
        COALESCE(tr.rating, 5) AS likes,
        COALESCE(tr.review, '') AS comment,
        DATE(tr.created_at) AS comment_date,
        tr.created_at,
        COALESCE(tr.status, 'approved') AS status,
        tr.admin_reply AS adminReply,
        tr.replied_at AS repliedAt,
        'trek_review' AS review_type
      FROM trek_ratings tr
      LEFT JOIN treks t ON t.id COLLATE utf8mb4_unicode_ci = tr.trek_id COLLATE utf8mb4_unicode_ci
      LEFT JOIN users u ON u.id COLLATE utf8mb4_unicode_ci = tr.user_id COLLATE utf8mb4_unicode_ci
      LEFT JOIN bookings b ON b.id COLLATE utf8mb4_unicode_ci = tr.booking_id COLLATE utf8mb4_unicode_ci
      ORDER BY tr.created_at DESC
      LIMIT 200
    `).catch(err => {
      console.warn('Trek ratings query fallback:', err?.message);
      return [[]];
    });

    const [blogComments] = await db.query(`
      SELECT 
        c.id,
        c.id AS comment_id,
        COALESCE(c.author_name, u.full_name, 'Explorer') AS author_name,
        COALESCE(p.title, 'Blog Story') AS trek_name,
        COALESCE(c.likes, 5) AS likes,
        COALESCE(c.content, '') AS comment,
        DATE(c.created_at) AS comment_date,
        c.created_at,
        COALESCE(c.status, 'approved') AS status,
        c.admin_reply AS adminReply,
        c.replied_at AS repliedAt,
        'blog_comment' AS review_type
      FROM comments c
      LEFT JOIN posts p ON c.post_id COLLATE utf8mb4_unicode_ci = p.id COLLATE utf8mb4_unicode_ci
      LEFT JOIN users u ON u.id COLLATE utf8mb4_unicode_ci = c.user_id COLLATE utf8mb4_unicode_ci
      ORDER BY c.created_at DESC
      LIMIT 200
    `).catch(err => {
      console.warn('Blog comments query fallback:', err?.message);
      return [[]];
    });

    // Merge and sort newest first
    const allReviews = [...trekReviews, ...blogComments].sort(
      (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    );

    return res.status(200).json({
      success: true,
      data: allReviews
    });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
}

/**
 * PATCH /api/auth/reviews/:id/status
 * Updates the approval status of a review or comment ('pending' | 'approved' | 'rejected')
 */
async function updateReviewStatus(req, res) {
  try {
    await ensureReviewColumns();
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Allowed values: pending, approved, rejected'
      });
    }

    // Try updating trek_ratings first
    const [ratingResult] = await db.query(
      `UPDATE trek_ratings SET status = ?, updated_at = NOW() WHERE id = ?`,
      [status, id]
    ).catch(() => [{ affectedRows: 0 }]);

    let updated = ratingResult.affectedRows > 0;

    // If not found in trek_ratings, try comments
    if (!updated) {
      const [commentResult] = await db.query(
        `UPDATE comments SET status = ?, updated_at = NOW() WHERE id = ?`,
        [status, id]
      ).catch(() => [{ affectedRows: 0 }]);
      updated = commentResult.affectedRows > 0;
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Review or comment not found'
      });
    }

    await auditService.logAuditEvent({
      actionType: 'update_review_status',
      entityType: 'review',
      entityId: id,
      summary: `Updated review #${id} moderation status to '${status}'`,
      afterData: { status },
      createdBy: req.user?.id || null,
      createdByEmail: req.user?.email || null,
      createdByRole: req.user?.roleName || req.user?.role || 'Admin',
    });

    return res.status(200).json({
      success: true,
      message: `Review status updated to ${status}`
    });
  } catch (error) {
    console.error('Error updating review status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update review status'
    });
  }
}

/**
 * POST /api/auth/reviews/:id/reply
 * Saves or updates an admin reply to a review/comment
 */
async function replyToReview(req, res) {
  try {
    await ensureReviewColumns();
    const { id } = req.params;
    const { reply } = req.body;

    const trimmedReply = String(reply || '').trim();

    // Try updating trek_ratings
    const [ratingResult] = await db.query(
      `UPDATE trek_ratings SET admin_reply = ?, replied_at = NOW(), updated_at = NOW() WHERE id = ?`,
      [trimmedReply || null, id]
    ).catch(() => [{ affectedRows: 0 }]);

    let updated = ratingResult.affectedRows > 0;

    if (!updated) {
      const [commentResult] = await db.query(
        `UPDATE comments SET admin_reply = ?, replied_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [trimmedReply || null, id]
      ).catch(() => [{ affectedRows: 0 }]);
      updated = commentResult.affectedRows > 0;
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Review or comment not found'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Admin reply saved successfully',
      data: { id, adminReply: trimmedReply }
    });
  } catch (error) {
    console.error('Error replying to review:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save reply'
    });
  }
}

module.exports = {
  getAllReviews,
  updateReviewStatus,
  replyToReview,
};
