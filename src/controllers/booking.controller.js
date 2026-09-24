const db = require("../config/db");
const { encrypt, decrypt } = require("../service/cryptoHelper");
const emailService = require("../service/email");
const auditService = require("../service/audit.service");
const completionService = require("../service/completion.service");

async function getParticipantsByBookingIds(connection, bookingIds = []) {
  if (!Array.isArray(bookingIds) || bookingIds.length === 0) return new Map();

  const placeholders = bookingIds.map(() => "?").join(", ");
  const [rows] = await connection.query(
    `SELECT
      booking_id,
      name,
      age,
      gender,
      phone,
      medical_info
     FROM booking_participants
     WHERE booking_id IN (${placeholders})
     ORDER BY booking_id ASC, id ASC`,
    bookingIds
  );

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.booking_id)) map.set(row.booking_id, []);
    map.get(row.booking_id).push({
      name: row.name,
      age: row.age,
      gender: row.gender,
      phone: row.phone,
      medical_info: row.medical_info,
    });
  }

  return map;
}

function queueCompletedBookingEmails(bookings = []) {
  if (!Array.isArray(bookings) || bookings.length === 0) return;

  (async () => {
    const tasks = bookings.map((booking) =>
      emailService.sendBookingCompletedEmail({
        customerEmail: booking.customerEmail,
        customerName: booking.customerName,
        bookingReference: booking.bookingReference,
        trekName: booking.trekName,
        startDate: booking.startDate,
        endDate: booking.endDate,
      })
    );

    const results = await Promise.allSettled(tasks);
    const failures = results.filter((item) => item.status === "rejected");
    if (failures.length > 0) {
      console.error(`Failed to send ${failures.length} booking completion emails`);
    }
  })().catch((error) => {
    console.error("Booking completion email queue error:", error);
  });
}

function queueBatchCompletionSummaryEmail(payload = {}) {
  (async () => {
    await emailService.sendBatchCompletionSummaryEmail(payload);
  })().catch((error) => {
    console.error("Batch completion summary email queue error:", error);
  });
}

function getAuditActor(req) {
  return {
    createdBy: req.user?.id || null,
    createdByEmail: req.user?.email || null,
    createdByRole: req.user?.roleName || req.user?.role || null,
  };
}

async function getAllBookingData(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT
        b.id,
        b.customer_name AS customerName,
        b.customer_email AS email,
        b.customer_phone AS phone,
        b.trek_name AS trekName,
        CONCAT(
          DATE_FORMAT(b.start_date, '%d %b %Y'),
          ' - ',
          DATE_FORMAT(b.end_date, '%d %b %Y')
        ) AS date,
        b.participants,
        b.total_amount AS amount,
        b.booking_status AS status,
        b.payment_status AS paymentStatus,
        DATE_FORMAT(b.created_at, '%d %b %Y') AS bookingDate,
        b.created_at AS createdAt,
        -- latest payment info (if any)
        (
          SELECT p.transaction_id FROM payments p WHERE p.booking_id = b.id ORDER BY p.created_at DESC LIMIT 1
        ) AS transactionId,
        (
          SELECT p.payment_method FROM payments p WHERE p.booking_id = b.id ORDER BY p.created_at DESC LIMIT 1
        ) AS paymentMethod,
        (
          SELECT p.amount FROM payments p WHERE p.booking_id = b.id ORDER BY p.created_at DESC LIMIT 1
        ) AS paymentAmount
      FROM bookings b
      ORDER BY b.created_at DESC
    `);

    const encryptedResponse = encrypt(rows);


    return res.status(200).json({
      success: true,
      data: encryptedResponse
    });

  } catch (error) {
    console.error('Error fetching bookings:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings'
    });
  }
}

// services/bookingStatusService.js
async function updateCompletedBookings(req,res) {
  const conn = await db.getConnection();
  
  try {
    // Get bookings before update
    const [beforeUpdate] = await conn.execute(`
      SELECT b.id, b.booking_reference, b.customer_name, b.customer_email, b.trek_name, tb.start_date, tb.end_date
      FROM bookings b
      INNER JOIN trek_batches tb ON b.batch_id COLLATE utf8mb4_unicode_ci = tb.id
      WHERE b.booking_status = 'confirmed'
        AND tb.end_date < NOW()
        AND b.cancelled_at IS NULL
    `);

    // Update bookings
    const [result] = await conn.execute(`
      UPDATE bookings b
      INNER JOIN trek_batches tb ON b.batch_id COLLATE utf8mb4_unicode_ci = tb.id
      SET b.booking_status = 'completed',
          b.updated_at = NOW()
      WHERE b.booking_status = 'confirmed'
        AND tb.end_date < NOW()
        AND b.cancelled_at IS NULL
    `);

    if (result.affectedRows > 0) {
      const participantsMap = await getParticipantsByBookingIds(
        conn,
        beforeUpdate.map((booking) => booking.id)
      );

      queueCompletedBookingEmails(
        beforeUpdate.map((booking) => ({
          customerEmail: booking.customer_email,
          customerName: booking.customer_name,
          bookingReference: booking.booking_reference,
          trekName: booking.trek_name,
          startDate: booking.start_date,
          endDate: booking.end_date,
          participantsDetails: participantsMap.get(booking.id) || [],
        }))
      );

      await auditService.logAuditEvent({
        actionType: 'booking.complete-sweep',
        entityType: 'booking',
        entityId: null,
        summary: `Completed ${result.affectedRows} booking(s) after batch expiry`,
        afterData: {
          updatedCount: result.affectedRows,
          processedBookingIds: beforeUpdate.map((booking) => booking.id),
        },
        metadata: {
          trigger: 'scheduled-completion-sweep',
        },
        ...getAuditActor(req),
      });

    }

    const responseData = {
      updatedCount: result.affectedRows,
      processedBookingIds: beforeUpdate.map((booking) => booking.id),
      processedAt: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    console.error('Update completed bookings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update completed bookings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (conn) conn.release();
  }
}


async function updateBatchCompleted(req, res) {
  const { batchId } = req.params;
  
  // Validate batchId
  if (!batchId || !String(batchId).trim()) {
    return res.status(400).json({
      success: false,
      message: 'Invalid batch ID'
    });
  }

  let connection;
  
  try {
    // Get a connection from pool for transaction
    connection = await db.getConnection();
    
    // Start transaction
    await connection.beginTransaction();
    
    // 1. Check if batch exists and get details
    const [batchCheck] = await connection.query(
      `SELECT 
        tb.id, 
        tb.trek_id, 
        tb.status, 
        tb.start_date, 
        tb.end_date,
        t.name as trek_name
      FROM trek_batches tb
      JOIN treks t ON tb.trek_id = t.id
      WHERE tb.id = ?`,
      [batchId]
    );

    if (batchCheck.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const batch = batchCheck[0];

    // Check if batch is already completed
    if (batch.status === 'completed') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Batch is already marked as completed'
      });
    }

    // Check if batch end date has passed
    const endDate = new Date(batch.end_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    if (endDate >= today) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot mark batch as completed before end date'
      });
    }

    // 2. Update trek_batches status to 'completed'
    const updateBatchQuery = `
      UPDATE trek_batches 
      SET status = 'completed', 
          updated_at = NOW() 
      WHERE id = ?
    `;
    await connection.query(updateBatchQuery, [batchId]);

    // 3. Update all confirmed bookings to 'completed'
    const [bookingsToComplete] = await connection.query(
      `SELECT 
        id,
        booking_reference,
        customer_name,
        customer_email
      FROM bookings
      WHERE batch_id = ?
        AND booking_status = 'confirmed'`,
      [batchId]
    );

    const updateBookingsQuery = `
      UPDATE bookings 
      SET booking_status = 'completed', 
          updated_at = NOW() 
      WHERE batch_id = ? 
        AND booking_status = 'confirmed'
    `;
    const [bookingResult] = await connection.query(updateBookingsQuery, [batchId]);
    
    // 4. Get updated statistics
    const [stats] = await connection.query(
      `SELECT 
        COUNT(*) as total_bookings,
        SUM(CASE WHEN booking_status = 'completed' THEN 1 ELSE 0 END) as completed_bookings,
        SUM(CASE WHEN booking_status = 'completed' THEN participants ELSE 0 END) as completed_participants
      FROM bookings
      WHERE batch_id = ?`,
      [batchId]
    );

    // 5. Get batch details for response
    const [updatedBatch] = await connection.query(
      `SELECT 
        tb.*,
        t.name as trek_name
      FROM trek_batches tb
      JOIN treks t ON tb.trek_id = t.id
      WHERE tb.id = ?`,
      [batchId]
    );
    
    // Commit transaction
    await connection.commit();

    const participantsMap = await getParticipantsByBookingIds(
      connection,
      bookingsToComplete.map((booking) => booking.id)
    );

    queueCompletedBookingEmails(
      bookingsToComplete.map((booking) => ({
        customerEmail: booking.customer_email,
        customerName: booking.customer_name,
        bookingReference: booking.booking_reference,
        trekName: batch.trek_name,
        startDate: batch.start_date,
        endDate: batch.end_date,
        participantsDetails: participantsMap.get(booking.id) || [],
      }))
    );
    queueBatchCompletionSummaryEmail({
      batchId: batch.id,
      trekName: batch.trek_name,
      startDate: batch.start_date,
      endDate: batch.end_date,
      completedBookings: bookingResult.affectedRows,
      completedParticipants: stats?.[0]?.completed_participants || 0,
      processedAt: new Date().toISOString(),
    });

    await auditService.logAuditEvent({
      actionType: 'batch.complete',
      entityType: 'batch',
      entityId: batchId,
      summary: `Marked batch ${batchId} as completed`,
      afterData: {
        batchId,
        trekName: batch.trek_name,
        updatedBookings: bookingResult.affectedRows,
      },
      metadata: {
        completedBookings: bookingResult.affectedRows,
        completedParticipants: stats?.[0]?.completed_participants || 0,
      },
      ...getAuditActor(req),
    });


    const data = {
      updated_bookings: bookingResult.affectedRows,
      batch: updatedBatch[0],
      stats: stats[0]
    }
    
    // Send success response
    res.json({
      success: true,
      message: 'Batch marked as completed successfully',
      ...data
    });

    
  } catch (error) {
    // Rollback on error
    if (connection) {
      await connection.rollback();
    }
    
    console.error('Mark batch completed error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark batch as completed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    // Release connection back to pool
    if (connection) {
      connection.release();
    }
  }
};

async function getBookingById(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ success: false, message: 'Invalid booking id' });

    const [rows] = await db.query(
      `SELECT
        b.id,
        b.booking_reference AS bookingReference,
        b.customer_name AS customerName,
        b.customer_email AS email,
        b.customer_phone AS phone,
        b.trek_name AS trekName,
        b.trek_id AS trekId,
        b.batch_id AS batchId,
        CONCAT(
          DATE_FORMAT(b.start_date, '%d %b %Y'),
          ' - ',
          DATE_FORMAT(b.end_date, '%d %b %Y')
        ) AS date,
        b.start_date AS startDate,
        b.end_date AS endDate,
        b.participants,
        b.total_amount AS amount,
        b.booking_status AS status,
        b.payment_status AS paymentStatus,
        DATE_FORMAT(b.created_at, '%d %b %Y') AS bookingDate,
        b.created_at AS createdAt,
        b.updated_at AS updatedAt,
        (SELECT p.transaction_id FROM payments p WHERE p.booking_id = b.id ORDER BY p.created_at DESC LIMIT 1) AS transactionId,
        (SELECT p.payment_method FROM payments p WHERE p.booking_id = b.id ORDER BY p.created_at DESC LIMIT 1) AS paymentMethod,
        (SELECT p.amount FROM payments p WHERE p.booking_id = b.id ORDER BY p.created_at DESC LIMIT 1) AS paymentAmount
      FROM bookings b
      WHERE b.id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = rows[0];
    const participantsMap = await getParticipantsByBookingIds(db, [booking.id]);
    booking.participantsList = participantsMap.get(booking.id) || [];

    return res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Get booking by id error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch booking' });
  }
}

async function updateBookingStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, paymentStatus } = req.body;

    if (!id) return res.status(400).json({ success: false, message: 'Invalid booking id' });

    const validStatuses = ['confirmed', 'cancelled', 'completed', 'pending', 'refunded'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const fields = [];
    const params = [];

    if (status) {
      fields.push('booking_status = ?');
      params.push(status);
      if (status === 'cancelled') {
        fields.push('cancelled_at = NOW()');
      }
    }
    if (paymentStatus) {
      fields.push('payment_status = ?');
      params.push(paymentStatus);
    }
    fields.push('updated_at = NOW()');

    if (fields.length === 1) {
      return res.status(400).json({ success: false, message: 'No status fields provided for update' });
    }

    params.push(id);
    const [result] = await db.query(`UPDATE bookings SET ${fields.join(', ')} WHERE id = ?`, params);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    await auditService.logAuditEvent({
      actionType: 'booking.update-status',
      entityType: 'booking',
      entityId: id,
      summary: `Updated booking ${id} status to ${status || ''} ${paymentStatus ? `(payment: ${paymentStatus})` : ''}`,
      afterData: { status, paymentStatus },
      ...getAuditActor(req),
    });

    return res.status(200).json({
      success: true,
      message: 'Booking status updated successfully'
    });
  } catch (error) {
    console.error('Update booking status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update booking status' });
  }
}

async function updateBulkBookingStatus(req, res) {
  try {
    const { bookingIds, status } = req.body;

    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ success: false, message: 'bookingIds array is required' });
    }

    const validStatuses = ['confirmed', 'cancelled', 'completed', 'pending', 'refunded'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const placeholders = bookingIds.map(() => '?').join(', ');
    const params = [status, ...bookingIds];

    const [result] = await db.query(
      `UPDATE bookings 
       SET booking_status = ?, updated_at = NOW() ${status === 'cancelled' ? ', cancelled_at = NOW()' : ''}
       WHERE id IN (${placeholders})`,
      params
    );

    await auditService.logAuditEvent({
      actionType: 'booking.bulk-update-status',
      entityType: 'booking',
      entityId: null,
      summary: `Updated ${result.affectedRows} booking(s) status to ${status}`,
      afterData: { bookingIds, status, count: result.affectedRows },
      ...getAuditActor(req),
    });

    return res.status(200).json({
      success: true,
      message: `Successfully updated ${result.affectedRows} booking(s) to ${status}`,
      updatedCount: result.affectedRows
    });
  } catch (error) {
    console.error('Bulk update booking status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update bookings status' });
  }
}

async function runAutoCompleteSweep(req, res) {
  try {
    const result = await completionService.runAutoCompletionSweep({
      manual: true,
      adminId: req.user?.id || null,
      adminName: req.user?.name || null,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error('Run auto-complete sweep error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to run auto-complete sweep',
      error: error.message,
    });
  }
}

async function getAutoCompleteStatus(req, res) {
  try {
    const status = completionService.getSchedulerStatus();
    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to get auto-complete status',
    });
  }
}

module.exports = {
  getAllBookingData,
  getBookingById,
  updateCompletedBookings,
  updateBatchCompleted,
  updateBookingStatus,
  updateBulkBookingStatus,
  runAutoCompleteSweep,
  getAutoCompleteStatus,
};
