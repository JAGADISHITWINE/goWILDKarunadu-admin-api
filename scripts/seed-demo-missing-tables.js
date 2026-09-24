const mysql = require('../node_modules/mysql2/promise');
const { randomUUID } = require('crypto');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
  user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'goWILDKarunadu',
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT || 3306),
};

const DEMO_ROLE_IDS = {
  superAdmin: null,
  contentManager: '11111111-1111-4111-8111-111111111111',
  support: '22222222-2222-4222-8222-222222222222',
};

const DEMO_SETTING_KEYS = [
  'demo_site_name',
  'demo_support_email',
  'demo_booking_notice',
  'demo_refund_policy',
  'demo_whatsapp_number',
];

function durationToDays(value) {
  const match = String(value || '').match(/(\d+)/);
  return Math.max(1, Number(match?.[1] || 1));
}

function dayPlan(batch, dayNumber) {
  const trekName = String(batch.trek_name || 'Trek');
  if (dayNumber === 1) {
    return {
      title: `Demo Day 1: ${trekName} check-in, briefing and trail start`,
      activities: [
        ['06:00:00', 'Meet at the base point, complete check-in and collect your trek briefing.'],
        ['07:30:00', 'Start the trail with a steady pace and guided group movement.'],
        ['10:30:00', 'Short summit or waterfall break, hydration stop and photos.'],
      ],
    };
  }

  return {
    title: `Demo Day 2: ${trekName} summit push, lunch and return`,
    activities: [
      ['05:30:00', 'Wake-up call, tea, light breakfast and pack the bags.'],
      ['07:00:00', 'Final ascent or ridge walk with route marshals and photo stops.'],
      ['12:30:00', 'Lunch, descend to base and close the trek with feedback.'],
    ],
  };
}

async function cleanupDemoRows(conn) {
  await conn.execute(`DELETE ia FROM itinerary_activities ia INNER JOIN itinerary_days idy ON idy.id = ia.day_id WHERE idy.title LIKE 'Demo Day %'`);
  await conn.execute(`DELETE FROM itinerary_days WHERE title LIKE 'Demo Day %'`);
  await conn.execute(`DELETE FROM batch_inclusions WHERE inclusion LIKE 'Demo:%'`);
  await conn.execute(`DELETE FROM batch_exclusions WHERE exclusion LIKE 'Demo:%'`);
  await conn.execute(`DELETE FROM post_media WHERE post_id IN (SELECT id FROM posts WHERE slug LIKE 'demo-%' OR title LIKE 'Demo %')`);
  await conn.execute(`DELETE FROM media WHERE file_name LIKE 'demo-%' OR file_url LIKE '%demo-media%'`);
  await conn.execute(`DELETE FROM otp_verifications WHERE email LIKE 'demo.%@example.com'`);
  await conn.execute(`DELETE FROM settings WHERE setting_key IN (?, ?, ?, ?, ?)`, DEMO_SETTING_KEYS);
  await conn.execute(`DELETE FROM roles WHERE name IN ('Super Admin', 'Content Manager', 'Support')`);
}

async function fetchSeedData(conn) {
  const [adminRows] = await conn.query(
    `SELECT id, email, role_id FROM admins LIMIT 1`
  );
  const [userRows] = await conn.query(
    `SELECT id, full_name, email, avatar FROM users ORDER BY created_at ASC`
  );
  const [batchRows] = await conn.query(
    `SELECT tb.id, tb.trek_id, t.name AS trek_name, tb.duration, tb.start_date, tb.end_date
     FROM trek_batches tb
     INNER JOIN treks t ON t.id = tb.trek_id
     ORDER BY tb.start_date ASC, tb.id ASC`
  );
  const [postRows] = await conn.query(
    `SELECT id, title, featured_image FROM posts ORDER BY created_at ASC`
  );

  return {
    admin: adminRows[0] || null,
    users: userRows,
    batches: batchRows,
    posts: postRows,
  };
}

async function seedRoles(conn, admin) {
  const superAdminRoleId = admin?.role_id || randomUUID();
  DEMO_ROLE_IDS.superAdmin = superAdminRoleId;

  const roles = [
    [superAdminRoleId, 'Super Admin'],
    [DEMO_ROLE_IDS.contentManager, 'Content Manager'],
    [DEMO_ROLE_IDS.support, 'Support'],
  ];

  for (const [id, name] of roles) {
    await conn.execute(
      `INSERT INTO roles (id, name) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name)`,
      [id, name]
    );
  }
}

async function seedSettings(conn) {
  const rows = [
    ['demo_site_name', 'goWILDKarunadu Demo'],
    ['demo_support_email', 'support@gowildkarunadu.com'],
    ['demo_booking_notice', 'Bookings close 24 hours before trek start.'],
    ['demo_refund_policy', 'Refunds follow the trek cancellation window shown on the booking page.'],
    ['demo_whatsapp_number', '+91 90000 00000'],
  ];

  for (const [key, value] of rows) {
    await conn.execute(
      `INSERT INTO settings (id, setting_key, setting_value)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [randomUUID(), key, value]
    );
  }
}

async function seedMediaAndPostLinks(conn, users, posts) {
  if (!users.length || !posts.length) {
    return;
  }

  const mediaSeeds = posts.map((post, index) => ({
    id: randomUUID(),
    file_name: `demo-post-${String(index + 1).padStart(2, '0')}.jpg`,
    file_url: post.featured_image || `https://images.unsplash.com/photo-${1500000000000 + index * 777}?auto=format&fit=crop&w=1200&q=80`,
    file_type: 'image/jpeg',
    uploaded_by: users[index % users.length].id,
    post_id: post.id,
  }));

  for (const media of mediaSeeds) {
    await conn.execute(
      `INSERT INTO media (id, file_name, file_url, file_type, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [media.id, media.file_name, media.file_url, media.file_type, media.uploaded_by]
    );

    await conn.execute(
      `INSERT INTO post_media (post_id, media_id) VALUES (?, ?)`,
      [media.post_id, media.id]
    );
  }
}

async function seedBatchContent(conn, batches) {
  const inclusionTemplates = [
    'Demo: Trek leader briefing and guided route support',
    'Demo: Breakfast, packed lunch and evening tea',
    'Demo: First-aid support and permit coordination',
  ];
  const exclusionTemplates = [
    'Demo: Travel to the base point',
    'Demo: Personal expenses and tips',
    'Demo: Optional gear rentals and insurance',
  ];

  for (const batch of batches) {
    const days = durationToDays(batch.duration);
    const dayCount = Math.min(days, 2);

    for (const inclusion of inclusionTemplates) {
      await conn.execute(
        `INSERT INTO batch_inclusions (id, batch_id, inclusion) VALUES (?, ?, ?)`,
        [randomUUID(), batch.id, inclusion]
      );
    }

    for (const exclusion of exclusionTemplates) {
      await conn.execute(
        `INSERT INTO batch_exclusions (id, batch_id, exclusion) VALUES (?, ?, ?)`,
        [randomUUID(), batch.id, exclusion]
      );
    }

    for (let dayNumber = 1; dayNumber <= dayCount; dayNumber += 1) {
      const plan = dayPlan(batch, dayNumber);
      const dayId = randomUUID();
      await conn.execute(
        `INSERT INTO itinerary_days (id, batch_id, day_number, title, created_at)
         VALUES (?, ?, ?, ?, NOW())`,
        [dayId, batch.id, dayNumber, plan.title]
      );

      for (const [time, text] of plan.activities) {
        await conn.execute(
          `INSERT INTO itinerary_activities (id, day_id, activity_time, activity_text, created_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [randomUUID(), dayId, time, text]
        );
      }
    }
  }
}

async function seedOtpRows(conn) {
  const otpRows = [
    ['demo.otp1@example.com', '246810', new Date(Date.now() + 10 * 60 * 1000)],
    ['demo.otp2@example.com', '135790', new Date(Date.now() - 60 * 60 * 1000)],
  ];

  for (const [email, otp, expiresAt] of otpRows) {
    await conn.execute(
      `INSERT INTO otp_verifications (id, email, otp_code, expires_at, created_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE otp_code = VALUES(otp_code), expires_at = VALUES(expires_at)`,
      [randomUUID(), email, otp, expiresAt]
    );
  }
}

async function main() {
  const conn = await mysql.createConnection(dbConfig);
  console.log(`Connected to ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);

  try {
    await conn.beginTransaction();
    await cleanupDemoRows(conn);

    const { admin, users, batches, posts } = await fetchSeedData(conn);
    if (!admin) {
      throw new Error('Admin row is missing. Seed the admin account first.');
    }
    if (!users.length) {
      throw new Error('Users are missing. Run the commerce seed first.');
    }
    if (!batches.length) {
      throw new Error('Batches are missing. Run the trek seed first.');
    }
    if (!posts.length) {
      throw new Error('Posts are missing. Run the content seed first.');
    }

    await seedRoles(conn, admin);
    await seedSettings(conn);
    await seedMediaAndPostLinks(conn, users, posts);
    await seedBatchContent(conn, batches);
    await seedOtpRows(conn);

    await conn.commit();

    console.log('Seeded roles, settings, media links, batch content, and OTP rows.');
  } catch (error) {
    await conn.rollback();
    console.error('Seed missing tables failed:', error);
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error('Seed missing tables script failed:', error);
  process.exit(1);
});
