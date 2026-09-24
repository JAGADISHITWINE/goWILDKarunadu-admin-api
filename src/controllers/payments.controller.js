const db = require('../config/db');
const { encrypt } = require('../service/cryptoHelper');
const { createUuid } = require('../utils/id');
const auditService = require('../service/audit.service');

const SUPPORTED_PAYMENT_METHODS = [
  { id: 'upi', name: 'UPI (GPay / PhonePe / Paytm / BHIM)', icon: 'qr-code-scan' },
  { id: 'card', name: 'Credit / Debit Card (Visa, Mastercard, RuPay)', icon: 'credit-card' },
  { id: 'netbanking', name: 'Net Banking (All Indian Banks)', icon: 'bank' },
  { id: 'razorpay', name: 'Razorpay Gateway', icon: 'shield-check' },
  { id: 'bank_transfer', name: 'Direct Bank Transfer (NEFT / RTGS / IMPS)', icon: 'arrow-left-right' },
  { id: 'cash', name: 'Cash / Basecamp Offline Payment', icon: 'cash-stack' },
];

async function listPayments(req, res) {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const [rows] = await db.query(
      `SELECT p.id, p.booking_id, p.amount, p.status, p.payment_method, p.transaction_id, p.created_at,
         b.booking_reference, b.customer_name, b.customer_email
       FROM payments p
       LEFT JOIN bookings b ON b.id COLLATE utf8mb4_unicode_ci = p.booking_id COLLATE utf8mb4_unicode_ci
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return res.status(200).json({ success: true, data: encrypt(rows) });
  } catch (err) {
    console.error('List payments error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list payments' });
  }
}

async function reconcilePayments(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT 
        b.id AS booking_id, 
        b.booking_reference, 
        b.customer_name,
        b.payment_status AS booking_payment_status,
        (
          SELECT p.status 
          FROM payments p 
          WHERE p.booking_id COLLATE utf8mb4_unicode_ci = b.id COLLATE utf8mb4_unicode_ci 
          ORDER BY p.created_at DESC 
          LIMIT 1
        ) AS latest_payment_status,
        (
          SELECT p.transaction_id 
          FROM payments p 
          WHERE p.booking_id COLLATE utf8mb4_unicode_ci = b.id COLLATE utf8mb4_unicode_ci 
          ORDER BY p.created_at DESC 
          LIMIT 1
        ) AS transaction_id,
        (
          SELECT p.payment_method 
          FROM payments p 
          WHERE p.booking_id COLLATE utf8mb4_unicode_ci = b.id COLLATE utf8mb4_unicode_ci 
          ORDER BY p.created_at DESC 
          LIMIT 1
        ) AS payment_method,
        (
          SELECT p.amount 
          FROM payments p 
          WHERE p.booking_id COLLATE utf8mb4_unicode_ci = b.id COLLATE utf8mb4_unicode_ci 
          ORDER BY p.created_at DESC 
          LIMIT 1
        ) AS amount
      FROM bookings b
      ORDER BY b.created_at DESC
      LIMIT 500
    `);

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('Reconcile payments error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reconcile payments' });
  }
}

async function getPaymentMethods(req, res) {
  return res.status(200).json({
    success: true,
    data: SUPPORTED_PAYMENT_METHODS
  });
}

async function listRefunds(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT p.id, p.booking_id, p.amount, p.status, p.payment_method, p.transaction_id, p.created_at,
        b.booking_reference, b.customer_name, b.customer_email, b.customer_phone, b.trek_name, b.total_amount AS booking_amount
      FROM payments p
      LEFT JOIN bookings b ON b.id COLLATE utf8mb4_unicode_ci = p.booking_id COLLATE utf8mb4_unicode_ci
      WHERE p.status = 'refunded'
      ORDER BY p.created_at DESC
      LIMIT 200
    `);

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('List refunds error:', err);
    return res.status(500).json({ success: false, message: 'Failed to list refunds' });
  }
}

async function processRefund(req, res) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const bookingId = req.params.bookingId || req.body.bookingId;
    const amount = Number(req.body.amount || 0);
    const reason = String(req.body.reason || 'Customer cancellation / refund requested').trim();
    const refundMethod = String(req.body.refundMethod || 'Online Gateway Reversal').trim();
    const refundTxnId = String(req.body.refundTxnId || 'REF-' + Date.now()).trim();
    const note = String(req.body.note || '').trim();

    if (!bookingId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }

    if (isNaN(amount) || amount <= 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Refund amount must be greater than 0' });
    }

    const [bookingRows] = await conn.query(
      `SELECT id, customer_name, customer_email, user_id, total_amount, payment_status, booking_status FROM bookings WHERE id = ? LIMIT 1`,
      [bookingId]
    );

    if (bookingRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = bookingRows[0];
    const totalBookingAmount = Number(booking.total_amount || 0);

    // Determine new status
    const isFullRefund = amount >= totalBookingAmount;
    const nextPaymentStatus = isFullRefund ? 'refunded' : 'partially_refunded';
    const nextBookingStatus = isFullRefund ? 'cancelled' : booking.booking_status;

    // Update bookings table
    await conn.query(
      `UPDATE bookings SET payment_status = ?, booking_status = ? WHERE id = ?`,
      [nextPaymentStatus, nextBookingStatus, bookingId]
    );

    // Insert payment record for refund
    const refundPaymentId = createUuid();
    await conn.query(
      `INSERT INTO payments (
        id, booking_id, amount, status, payment_method, transaction_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        refundPaymentId,
        bookingId,
        amount,
        'refunded',
        refundMethod,
        refundTxnId,
      ]
    );

    await conn.commit();

    // Log audit event
    await auditService.logAuditEvent({
      actionType: 'refund',
      entityType: 'booking',
      entityId: bookingId,
      summary: `Processed ${isFullRefund ? 'full' : 'partial'} refund of ₹${amount} for booking #${bookingId} (${reason})`,
      beforeData: { paymentStatus: booking.payment_status, bookingStatus: booking.booking_status },
      afterData: { paymentStatus: nextPaymentStatus, bookingStatus: nextBookingStatus, refundAmount: amount, refundTxnId },
      metadata: { reason, refundMethod, refundTxnId, note },
      createdBy: req.user?.id || null,
      createdByEmail: req.user?.email || null,
      createdByRole: req.user?.roleName || req.user?.role || 'Admin',
    });

    return res.status(200).json({
      success: true,
      message: `Refund of ₹${amount} processed successfully.`,
      data: {
        bookingId,
        refundPaymentId,
        amount,
        paymentStatus: nextPaymentStatus,
        bookingStatus: nextBookingStatus,
        refundTxnId
      }
    });

  } catch (err) {
    await conn.rollback();
    console.error('Process refund error:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Failed to process refund' });
  } finally {
    conn.release();
  }
}

async function updateBookingPayment(req, res) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const bookingId = req.params.bookingId || req.body.bookingId;
    const paymentStatus = String(req.body.paymentStatus || 'paid').toLowerCase();
    const paymentMethod = String(req.body.paymentMethod || 'UPI').trim();
    const transactionId = String(req.body.transactionId || 'TXN-' + Date.now()).trim();
    const amount = Number(req.body.amount);

    if (!bookingId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Booking ID is required' });
    }

    const validPaymentStatuses = ['paid', 'pending', 'refunded', 'partially_refunded', 'failed'];
    if (!validPaymentStatuses.includes(paymentStatus)) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: `Invalid payment status. Valid options: ${validPaymentStatuses.join(', ')}` });
    }

    const [bookingRows] = await conn.query(
      `SELECT id, customer_name, total_amount, payment_status, user_id FROM bookings WHERE id = ? LIMIT 1`,
      [bookingId]
    );

    if (bookingRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = bookingRows[0];
    const finalAmount = isNaN(amount) || amount <= 0 ? Number(booking.total_amount || 0) : amount;

    // Update booking payment status
    await conn.query(
      `UPDATE bookings SET payment_status = ? WHERE id = ?`,
      [paymentStatus, bookingId]
    );

    // Upsert payment record
    const [existingPayments] = await conn.query(
      `SELECT id FROM payments WHERE booking_id = ? ORDER BY created_at DESC LIMIT 1`,
      [bookingId]
    );

    if (existingPayments.length > 0) {
      await conn.query(
        `UPDATE payments SET payment_method = ?, transaction_id = ?, status = ?, amount = ? WHERE id = ?`,
        [paymentMethod, transactionId, paymentStatus, finalAmount, existingPayments[0].id]
      );
    } else {
      await conn.query(
        `INSERT INTO payments (
          id, booking_id, amount, status, payment_method, transaction_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [
          createUuid(),
          bookingId,
          finalAmount,
          paymentStatus,
          paymentMethod,
          transactionId,
        ]
      );
    }

    await conn.commit();

    // Audit log
    await auditService.logAuditEvent({
      actionType: 'update_payment',
      entityType: 'booking',
      entityId: bookingId,
      summary: `Updated payment for booking #${bookingId} to ${paymentStatus} via ${paymentMethod}`,
      beforeData: { paymentStatus: booking.payment_status },
      afterData: { paymentStatus, paymentMethod, transactionId, amount: finalAmount },
      createdBy: req.user?.id || null,
      createdByEmail: req.user?.email || null,
      createdByRole: req.user?.roleName || req.user?.role || 'Admin',
    });

    return res.status(200).json({
      success: true,
      message: 'Payment details updated successfully',
      data: {
        bookingId,
        paymentStatus,
        paymentMethod,
        transactionId,
        amount: finalAmount
      }
    });

  } catch (err) {
    await conn.rollback();
    console.error('Update booking payment error:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Failed to update payment' });
  } finally {
    conn.release();
  }
}

module.exports = {
  listPayments,
  reconcilePayments,
  getPaymentMethods,
  listRefunds,
  processRefund,
  updateBookingPayment,
};
