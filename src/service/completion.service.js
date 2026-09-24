const db = require('../config/db');
const auditService = require('./audit.service');
const emailService = require('./email/email.service');

let schedulerTimer = null;
let lastRunAt = null;
let lastResult = {
  completedBatchesCount: 0,
  completedBookingsCount: 0,
  processedBatchIds: [],
  processedBookingIds: [],
  timestamp: null,
};
let isRunning = false;

/**
 * Executes a full auto-completion sweep across batches and bookings.
 * Automatically marks all expired batches and confirmed bookings as 'completed'.
 */
async function runAutoCompletionSweep(options = {}) {
  if (isRunning) {
    return {
      success: true,
      message: 'Auto-completion sweep is already running',
      inProgress: true,
      lastRunAt,
      lastResult,
    };
  }

  isRunning = true;
  const startedAt = new Date();
  const processedBatchIds = [];
  const processedBookingIds = [];
  let completedBatchesCount = 0;
  let completedBookingsCount = 0;

  let connection;
  try {
    connection = await db.getConnection();

    // 1. Identify all expired trek batches that are not yet marked as completed or cancelled
    const [expiredBatches] = await connection.query(`
      SELECT 
        tb.id, 
        tb.trek_id, 
        tb.status, 
        tb.start_date, 
        tb.end_date,
        t.name as trek_name
      FROM trek_batches tb
      JOIN treks t ON tb.trek_id = t.id
      WHERE tb.end_date < CURDATE()
        AND tb.status NOT IN ('completed', 'cancelled')
      ORDER BY tb.end_date ASC
    `);

    // 2. Process each expired batch
    for (const batch of expiredBatches) {
      try {
        await connection.beginTransaction();

        // Update batch status to completed
        const [batchUpdate] = await connection.query(`
          UPDATE trek_batches
          SET status = 'completed',
              updated_at = NOW()
          WHERE id = ? AND status NOT IN ('completed', 'cancelled')
        `, [batch.id]);

        if (batchUpdate.affectedRows > 0) {
          completedBatchesCount += 1;
          processedBatchIds.push(batch.id);

          // Find confirmed bookings for this batch (handling collation compatibility)
          const [bookingsToComplete] = await connection.query(`
            SELECT id, booking_reference, customer_name, customer_email, start_date, end_date
            FROM bookings
            WHERE batch_id COLLATE utf8mb4_unicode_ci = ?
              AND booking_status = 'confirmed'
              AND cancelled_at IS NULL
          `, [batch.id]);

          // Update bookings to completed
          if (bookingsToComplete.length > 0) {
            await connection.query(`
              UPDATE bookings
              SET booking_status = 'completed',
                  updated_at = NOW()
              WHERE batch_id COLLATE utf8mb4_unicode_ci = ?
                AND booking_status = 'confirmed'
                AND cancelled_at IS NULL
            `, [batch.id]);

            completedBookingsCount += bookingsToComplete.length;
            bookingsToComplete.forEach((b) => processedBookingIds.push(b.id));

            // Queue completion emails for participants asynchronously
            bookingsToComplete.forEach((b) => {
              try {
                if (typeof emailService.sendBookingCompletedEmail === 'function') {
                  emailService.sendBookingCompletedEmail({
                    customerEmail: b.customer_email,
                    customerName: b.customer_name,
                    bookingReference: b.booking_reference,
                    trekName: batch.trek_name,
                    startDate: batch.start_date,
                    endDate: batch.end_date,
                  }).catch((err) => console.warn(`[Auto-Complete] Email failed for booking ${b.booking_reference}:`, err.message));
                }
              } catch (mailErr) {
                // Email failure shouldn't abort completion
              }
            });
          }

          // Audit log for this batch completion
          await auditService.logAuditEvent({
            actionType: 'batch.auto-complete',
            entityType: 'batch',
            entityId: batch.id,
            summary: `Automated completion: Marked batch ${batch.id} (${batch.trek_name}) as completed after end date ${batch.end_date}`,
            afterData: {
              batchId: batch.id,
              trekName: batch.trek_name,
              completedBookings: bookingsToComplete.length,
            },
            metadata: {
              trigger: options.manual ? 'admin-manual-sweep' : 'background-auto-scheduler',
              endDate: batch.end_date,
            },
            actorType: options.manual ? 'admin' : 'system',
            actorId: options.adminId || 'system-scheduler',
            actorName: options.adminName || 'Automation Engine',
          }).catch((err) => console.warn('[Auto-Complete] Audit log error:', err.message));
        }

        await connection.commit();
      } catch (batchErr) {
        await connection.rollback();
        console.error(`[Auto-Complete] Failed to auto-complete batch ${batch.id}:`, batchErr);
      }
    }

    // 3. Catch-all sweep for orphan confirmed bookings whose end_date has passed
    try {
      const [orphanBookings] = await connection.query(`
        SELECT b.id, b.booking_reference, b.customer_name, b.customer_email, b.trek_name, b.start_date, b.end_date
        FROM bookings b
        LEFT JOIN trek_batches tb ON b.batch_id COLLATE utf8mb4_unicode_ci = tb.id
        WHERE b.booking_status = 'confirmed'
          AND b.cancelled_at IS NULL
          AND (
            (b.end_date IS NOT NULL AND b.end_date < CURDATE())
            OR (tb.end_date IS NOT NULL AND tb.end_date < CURDATE())
          )
      `);

      if (orphanBookings.length > 0) {
        await connection.query(`
          UPDATE bookings b
          LEFT JOIN trek_batches tb ON b.batch_id COLLATE utf8mb4_unicode_ci = tb.id
          SET b.booking_status = 'completed',
              b.updated_at = NOW()
          WHERE b.booking_status = 'confirmed'
            AND b.cancelled_at IS NULL
            AND (
              (b.end_date IS NOT NULL AND b.end_date < CURDATE())
              OR (tb.end_date IS NOT NULL AND tb.end_date < CURDATE())
            )
        `);

        completedBookingsCount += orphanBookings.length;
        orphanBookings.forEach((b) => {
          if (!processedBookingIds.includes(b.id)) {
            processedBookingIds.push(b.id);
          }
        });
      }
    } catch (orphanErr) {
      console.warn('[Auto-Complete] Orphan sweep warning:', orphanErr.message);
    }

  } catch (error) {
    console.error('[Auto-Complete] Sweep execution error:', error);
  } finally {
    if (connection) connection.release();
    isRunning = false;
    lastRunAt = new Date().toISOString();
    lastResult = {
      completedBatchesCount,
      completedBookingsCount,
      processedBatchIds,
      processedBookingIds,
      durationMs: Date.now() - startedAt.getTime(),
      timestamp: lastRunAt,
    };
  }

  if (completedBatchesCount > 0 || completedBookingsCount > 0) {
    console.log(`[Auto-Complete] Sweep completed: ${completedBatchesCount} batches and ${completedBookingsCount} bookings auto-completed.`);
  }

  return {
    success: true,
    data: lastResult,
  };
}

/**
 * Starts the automated recurring background scheduler.
 */
function startAutoCompletionScheduler(intervalMinutes = 30) {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
  }

  const intervalMs = Math.max(5, intervalMinutes) * 60 * 1000;

  // Run first sweep on startup (with slight delay so DB pool connects first)
  setTimeout(() => {
    runAutoCompletionSweep().catch((err) => console.warn('[Auto-Complete] Initial sweep error:', err.message));
  }, 4000);

  // Set recurring interval
  schedulerTimer = setInterval(() => {
    runAutoCompletionSweep().catch((err) => console.warn('[Auto-Complete] Recurring sweep error:', err.message));
  }, intervalMs);

  console.log(`[Auto-Complete] Automated trek completion scheduler active (runs every ${intervalMinutes}m)`);
}

function stopAutoCompletionScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

function getSchedulerStatus() {
  return {
    active: Boolean(schedulerTimer),
    intervalMinutes: 30,
    isRunning,
    lastRunAt,
    lastResult,
  };
}

module.exports = {
  runAutoCompletionSweep,
  startAutoCompletionScheduler,
  stopAutoCompletionScheduler,
  getSchedulerStatus,
};
