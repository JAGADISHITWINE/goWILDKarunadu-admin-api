const mysql = require('../node_modules/mysql2/promise');
const bcrypt = require('/var/www/html/goWILDKarunadu/goWILDKarunadu-user-api/node_modules/bcryptjs');
const { randomUUID } = require('crypto');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
  user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'goWILDKarunadu',
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
};

function toDateInput(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date value: ${value}`);
  }
  return date.toISOString().slice(0, 10);
}

function addDays(baseDate, days) {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + days);
  return date;
}

function addHours(baseDate, hours) {
  const date = new Date(baseDate);
  date.setHours(date.getHours() + hours);
  return date;
}

function makeBookingReference(prefix, index) {
  return `EDGE-${prefix}-${String(index + 1).padStart(4, '0')}`;
}

async function fetchRows(conn) {
  const [users] = await conn.query(`SELECT id, full_name, email, phone_number, referral_code FROM users ORDER BY created_at ASC`);
  const [treks] = await conn.query(`SELECT id, name FROM treks ORDER BY created_at ASC`);
  const [batches] = await conn.query(`SELECT id, trek_id, start_date, end_date, price, status FROM trek_batches ORDER BY start_date ASC`);
  const [coupons] = await conn.query(`SELECT id, trek_id, code FROM trek_coupons ORDER BY created_at ASC`);
  return { users, treks, batches, coupons };
}

async function cleanupExistingEdgeData(conn) {
  const [edgeBookings] = await conn.query(
    `SELECT id FROM bookings WHERE booking_reference LIKE 'EDGE-%'`
  );

  if (!edgeBookings.length) {
    return;
  }

  const bookingIds = edgeBookings.map((row) => row.id);
  const placeholders = bookingIds.map(() => '?').join(', ');

  await conn.execute(`DELETE FROM coupon_usages WHERE booking_id IN (${placeholders})`, bookingIds);
  await conn.execute(`DELETE FROM referral_reward_redemptions WHERE booking_id IN (${placeholders})`, bookingIds);
  await conn.execute(`DELETE FROM booking_referrals WHERE booking_id IN (${placeholders})`, bookingIds);
  await conn.execute(`DELETE FROM trek_ratings WHERE booking_id IN (${placeholders})`, bookingIds);
  await conn.execute(`DELETE FROM booking_addons WHERE booking_id IN (${placeholders})`, bookingIds);
  await conn.execute(`DELETE FROM booking_participants WHERE booking_id IN (${placeholders})`, bookingIds);
  await conn.execute(`DELETE FROM bookings WHERE id IN (${placeholders})`, bookingIds);
}

async function insertBooking(conn, booking) {
  const bookingId = randomUUID();
  const bookingReference = booking.bookingReference;
  const totalAmount = booking.totalAmount;
  const amountPaid = booking.amountPaid;
  const balanceDue = booking.balanceDue;
  const bookingValues = [
    bookingId,
    bookingReference,
    booking.user.id,
    booking.trek.id,
    booking.batch.id,
    booking.user.full_name,
    booking.user.email,
    booking.user.phone_number,
    booking.emergencyContact || null,
    booking.specialRequests || null,
    booking.trek.name,
    booking.startDate,
    booking.endDate,
    booking.participants,
    booking.basePrice,
    booking.addonsTotal,
    booking.subtotal,
    booking.taxAmount,
    booking.discountAmount,
    totalAmount,
    booking.paymentStatus,
    amountPaid,
    balanceDue,
    booking.refundAmount || 0,
    booking.cancellationFee || 0,
    booking.paymentMethod || 'upi',
    booking.paymentDeadline || null,
    booking.bookingStatus,
    booking.confirmationSent ? 1 : 0,
    booking.cancellationReason || null,
    booking.confirmedAt || null,
    booking.cancelledAt || null,
    booking.createdAt || new Date(),
    booking.updatedAt || new Date(),
    booking.referralCode || null,
    booking.referralDiscount || 0,
    booking.referralRewardDiscount || 0,
    booking.referralRewardSlotsUsed || 0,
  ];

  await conn.execute(
    `
      INSERT INTO bookings (
        id, booking_reference, user_id, trek_id, batch_id, customer_name,
        customer_email, customer_phone, emergency_contact, special_requests,
        trek_name, start_date, end_date, participants, base_price, addons_total,
        subtotal, tax_amount, discount_amount, total_amount, payment_status,
        amount_paid, balance_due, refund_amount, cancellation_fee, payment_method,
        payment_deadline, booking_status, confirmation_sent, cancellation_reason,
        confirmed_at, cancelled_at, created_at, updated_at, referral_code,
        referral_discount, referral_reward_discount, referral_reward_slots_used
      ) VALUES (${bookingValues.map(() => '?').join(', ')})
    `,
    bookingValues
  );

  const participants = [];
  for (let i = 0; i < booking.participants; i += 1) {
    participants.push([
      randomUUID(),
      bookingId,
      i === 0 ? booking.user.full_name : `${booking.user.full_name.split(' ')[0]} Companion ${i + 1}`,
      booking.participantAges?.[i] || 25 + i,
      i % 2 === 0 ? 'Male' : 'Female',
      i % 2 === 0 ? 'Aadhaar' : 'Passport',
      `${9000005000 + booking.index * 10 + i}`,
      `${booking.user.phone_number}`,
      i === 0 ? 'None' : '',
      i === 0 ? 1 : 0,
    ]);
  }

  for (const row of participants) {
    await conn.execute(
      `
        INSERT INTO booking_participants (
          id, booking_id, name, age, gender, id_type, id_number, phone,
          medical_info, is_primary_contact, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `,
      row
    );
  }

  for (const addon of booking.addons || []) {
    await conn.execute(
      `
        INSERT INTO booking_addons (
          id, booking_id, addon_id, addon_name, quantity, unit_price, total_price, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        randomUUID(),
        bookingId,
        randomUUID(),
        addon.name,
        addon.quantity,
        addon.unitPrice,
        addon.quantity * addon.unitPrice,
      ]
    );
  }

  return { bookingId, bookingReference, ...booking };
}

async function main() {
  const conn = await mysql.createConnection(dbConfig);
  console.log(`Connected to ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);

  try {
    await cleanupExistingEdgeData(conn);

    const { users, treks, batches, coupons } = await fetchRows(conn);
    if (users.length < 2 || treks.length < 1 || batches.length < 2 || coupons.length < 1) {
      throw new Error('Base demo data missing. Run the reset script first.');
    }

    const completedBookings = [];
    const cases = [];

    for (let i = 0; i < treks.length; i += 1) {
      const trek = treks[i];
      const trekBatches = batches.filter((batch) => String(batch.trek_id) === String(trek.id));
      const firstBatch = trekBatches[0];
      const secondBatch = trekBatches[1] || trekBatches[0];
      const user = users[(i + 2) % users.length];
      const coupon = coupons.find((row) => String(row.trek_id) === String(trek.id)) || null;

      const completed = await insertBooking(conn, {
        index: i * 10 + 1,
        user,
        trek,
        batch: firstBatch,
        bookingReference: makeBookingReference('CMP', i),
        startDate: toDateInput(firstBatch.start_date),
        endDate: toDateInput(firstBatch.end_date),
        participants: 2,
        basePrice: Number(firstBatch.price),
        addonsTotal: 400,
        subtotal: Number(firstBatch.price) * 2 + 400,
        taxAmount: Math.round((Number(firstBatch.price) * 2 + 400) * 0.05 * 100) / 100,
        discountAmount: 150,
        totalAmount: Math.round((Number(firstBatch.price) * 2 + 400) * 1.05 * 100) / 100 - 150,
        paymentStatus: 'paid',
        amountPaid: Math.round((Number(firstBatch.price) * 2 + 400) * 1.05 * 100) / 100 - 150,
        balanceDue: 0,
        paymentMethod: 'upi',
        bookingStatus: 'completed',
        confirmationSent: 1,
        confirmedAt: addHours(new Date(), -96),
        createdAt: addHours(new Date(), -100),
        updatedAt: addHours(new Date(), -96),
        addons: [
          { name: 'Lunch Pack', quantity: 2, unitPrice: 200 },
        ],
      });
      completedBookings.push(completed);

      if (coupon) {
        const [usageInsertResult] = await conn.execute(
          `INSERT IGNORE INTO coupon_usages (id, coupon_id, user_id, booking_id, used_at) VALUES (?, ?, ?, ?, NOW())`,
          [randomUUID(), coupon.id, user.id, completed.bookingId]
        );
        if (usageInsertResult.affectedRows > 0) {
          await conn.execute(`UPDATE trek_coupons SET usage_count = usage_count + 1 WHERE id = ?`, [coupon.id]);
        }
      }

      await conn.execute(
        `
          INSERT INTO trek_ratings (id, booking_id, trek_id, user_id, rating, review, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
        `,
        [
          randomUUID(),
          completed.bookingId,
          trek.id,
          user.id,
          i % 2 === 0 ? 5 : 4,
          i % 2 === 0
            ? 'Excellent support team and a well-paced itinerary.'
            : 'Great trek, smooth coordination, and good food on the trail.',
        ]
      );

      const partial = await insertBooking(conn, {
        index: i * 10 + 2,
        user: users[(i + 3) % users.length],
        trek,
        batch: secondBatch,
        bookingReference: makeBookingReference('PRT', i),
        startDate: toDateInput(secondBatch.start_date),
        endDate: toDateInput(secondBatch.end_date),
        participants: 3,
        basePrice: Number(secondBatch.price),
        addonsTotal: 300,
        subtotal: Number(secondBatch.price) * 3 + 300,
        taxAmount: Math.round((Number(secondBatch.price) * 3 + 300) * 0.05 * 100) / 100,
        discountAmount: 0,
        totalAmount: Math.round((Number(secondBatch.price) * 3 + 300) * 1.05 * 100) / 100,
        paymentStatus: 'partial',
        amountPaid: Math.round(((Number(secondBatch.price) * 3 + 300) * 1.05) * 0.4 * 100) / 100,
        balanceDue: Math.round(((Number(secondBatch.price) * 3 + 300) * 1.05) * 0.6 * 100) / 100,
        paymentMethod: 'upi',
        bookingStatus: 'confirmed',
        confirmationSent: 0,
        paymentDeadline: addDays(new Date(), 5),
        specialRequests: 'Partial payment demo booking.',
        createdAt: addHours(new Date(), -48),
        updatedAt: addHours(new Date(), -48),
        addons: [{ name: 'Extra Water Bottle', quantity: 3, unitPrice: 50 }],
      });
      cases.push(partial);
    }

    for (let i = 0; i < 2; i += 1) {
      const trek = treks[i];
      const batch = batches.find((b) => String(b.trek_id) === String(trek.id));
      const cancelled = await insertBooking(conn, {
        index: i * 10 + 3,
        user: users[(i + 4) % users.length],
        trek,
        batch,
        bookingReference: makeBookingReference('CNL', i),
        startDate: toDateInput(batch.start_date),
        endDate: toDateInput(batch.end_date),
        participants: 2,
        basePrice: Number(batch.price),
        addonsTotal: 0,
        subtotal: Number(batch.price) * 2,
        taxAmount: Math.round(Number(batch.price) * 2 * 0.05 * 100) / 100,
        discountAmount: 0,
        totalAmount: Math.round(Number(batch.price) * 2 * 1.05 * 100) / 100,
        paymentStatus: 'refunded',
        amountPaid: Math.round(Number(batch.price) * 2 * 1.05 * 100) / 100,
        balanceDue: 0,
        refundAmount: Math.round(Number(batch.price) * 2 * 0.85 * 100) / 100,
        cancellationFee: Math.round(Number(batch.price) * 2 * 0.2 * 100) / 100,
        paymentMethod: 'upi',
        bookingStatus: 'cancelled',
        confirmationSent: 1,
        cancellationReason: 'Cancelled before trek due to personal emergency.',
        confirmedAt: addHours(new Date(), -120),
        cancelledAt: addHours(new Date(), -24),
        createdAt: addHours(new Date(), -130),
        updatedAt: addHours(new Date(), -24),
      });
      cases.push(cancelled);
    }

    const referrer = users[0];
    const referred = users[1];
    await conn.execute(`UPDATE users SET referred_by_user_id = ? WHERE id = ?`, [referrer.id, referred.id]);
    await conn.execute(
      `
        INSERT INTO booking_referrals (
          id, booking_id, referrer_user_id, referred_user_id, referral_code, discount_amount,
          participants, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())
      `,
      [
        randomUUID(),
        completedBookings[0].bookingId,
        referrer.id,
        referred.id,
        referrer.referral_code,
        200,
        2,
      ]
    );
    await conn.execute(
      `
        INSERT INTO referral_reward_redemptions (
          id, user_id, booking_id, slots_used, value_per_slot, created_at
        ) VALUES (?, ?, ?, ?, ?, NOW())
      `,
      [randomUUID(), referrer.id, cases[0].bookingId, 1, 500]
    );

    console.log(`Added ${completedBookings.length} completed ratings, ${cases.length} edge-case bookings, and referral demo data.`);
  } catch (error) {
    console.error('Edge-case demo seeding failed:', error);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
