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

const TAGS = [
  { name: 'Monsoon Trek', slug: 'monsoon-trek' },
  { name: 'Packing List', slug: 'packing-list' },
  { name: 'Budget Travel', slug: 'budget-travel' },
  { name: 'Trail Safety', slug: 'trail-safety' },
  { name: 'Weekend Trek', slug: 'weekend-trek' },
  { name: 'Sunrise Trek', slug: 'sunrise-trek' },
  { name: 'Beginner Trekker', slug: 'beginner-trekker' },
  { name: 'Trek Nutrition', slug: 'trek-nutrition' },
  { name: 'Gear Guide', slug: 'gear-guide' },
  { name: 'Group Travel', slug: 'group-travel' },
];

const POSTS = [
  {
    title: 'Monsoon Trek Planning for Karnataka Trails',
    slug: 'demo-monsoon-trek-planning',
    excerpt: 'A practical guide to timing, gear, and safety for monsoon season treks.',
    categoryName: 'Adventure Guides',
    status: 'published',
    image:
      'https://images.unsplash.com/photo-1501555088652-021faa106b9b?auto=format&fit=crop&w=1200&q=80',
    tags: ['monsoon-trek', 'trail-safety', 'beginner-trekker'],
    content: `
      <p>Monsoon trekking in Karnataka is rewarding when you plan around weather windows, trail conditions, and transport delays. Start early, keep the pace steady, and avoid routes that are known to get slippery after heavy rain.</p>
      <p>Carry quick-dry clothing, an extra layer, a rain cover for your backpack, and a sealed pouch for your phone and power bank. Good footwear matters more than fancy gear.</p>
      <p>For first-timers, book a guided group and keep your expectations flexible. The trail may change, but a safe and relaxed plan usually gives you the best experience.</p>
    `.trim(),
  },
  {
    title: 'What to Pack for a 2-Day Weekend Trek',
    slug: 'demo-weekend-trek-packing-guide',
    excerpt: 'A realistic packing checklist that avoids overpacking while keeping you prepared.',
    categoryName: 'Packing & Gear',
    status: 'published',
    image:
      'https://images.unsplash.com/photo-1519904981063-b0cf448d479e?auto=format&fit=crop&w=1200&q=80',
    tags: ['packing-list', 'gear-guide', 'weekend-trek'],
    content: `
      <p>The simplest packing rule for a 2-day trek is to keep the bag light and the essentials organized. Focus on clothes you can layer, one extra dry set, and small items you can reach quickly.</p>
      <p>Good packing is less about quantity and more about placement. Put rain protection at the top, keep snacks in an outer pocket, and make sure your water bottle is easy to reach on the trail.</p>
      <p>If you're trekking with a group, label anything that can be mixed up at camp, especially chargers, bottles, and rain covers. It saves time when everyone is tired after the climb.</p>
    `.trim(),
  },
  {
    title: 'Budgeting a Trek Without Compromising Safety',
    slug: 'demo-budget-trek-guide',
    excerpt: 'Where you can save money, and where you should never cut corners.',
    categoryName: 'Budget Travel',
    status: 'published',
    image:
      'https://images.unsplash.com/photo-1522163182402-834f871fd851?auto=format&fit=crop&w=1200&q=80',
    tags: ['budget-travel', 'trail-safety', 'group-travel'],
    content: `
      <p>A budget trek works best when you plan the expensive parts first. Transport, safety gear, and a reliable guide should be fixed before you start looking at optional extras.</p>
      <p>Save on things that do not affect safety or comfort directly, such as bulk snack packs, shared transport, and off-season travel windows. Spend on footwear, hydration, and the right backpack size.</p>
      <p>When a trek feels suspiciously cheap, ask what is excluded. The real cost of a trip often shows up in overlooked items like trail support, local permissions, or return logistics.</p>
    `.trim(),
  },
  {
    title: 'How to Pace Yourself on a Sunrise Peak Trek',
    slug: 'demo-sunrise-peak-pacing',
    excerpt: 'A simple pacing strategy for early starts, steep climbs, and cold summit winds.',
    categoryName: 'Weekend Trips',
    status: 'published',
    image:
      'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
    tags: ['sunrise-trek', 'weekend-trek', 'trail-safety'],
    content: `
      <p>Sunrise treks reward steady effort more than aggressive speed. Start conservatively, keep your breathing under control, and walk at a pace that you can hold for long stretches.</p>
      <p>Take short breaks instead of long stops. The body cools quickly before dawn, and if you stay still too long the climb feels much harder when you restart.</p>
      <p>Hydrate before the final climb and keep a small snack ready for the last stretch. The summit push is easier when you are not fighting low energy and cold hands at the same time.</p>
    `.trim(),
  },
  {
    title: 'Trail Safety Rules Every First-Time Trekker Should Know',
    slug: 'demo-trail-safety-rules',
    excerpt: 'A moderation-friendly draft post covering pace, hydration, group discipline, and emergency basics.',
    categoryName: 'Safety Tips',
    status: 'pending',
    image:
      'https://images.unsplash.com/photo-1517821365201-1d3aeb2b8c0d?auto=format&fit=crop&w=1200&q=80',
    tags: ['trail-safety', 'beginner-trekker', 'group-travel'],
    content: `
      <p>First-time trekkers often make the same mistakes: starting too fast, ignoring hydration, and not telling anyone when they feel unwell. Good trail safety is mostly about discipline.</p>
      <p>Stay with the group, follow the lead guide, and avoid shortcuts unless the route is clearly marked. If the weather changes, slow down before the trail forces you to do it.</p>
      <p>Before any trek, make sure your emergency contact, ID, and medication are packed in a place that is easy to reach. Small preparation prevents big problems later.</p>
    `.trim(),
  },
];

function addHours(baseDate, hours) {
  const date = new Date(baseDate);
  date.setHours(date.getHours() + hours);
  return date;
}

function addMinutes(baseDate, minutes) {
  const date = new Date(baseDate);
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

function articleExcerpt(text, maxLength = 80) {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

function pick(arr, index) {
  return arr[index % arr.length];
}

async function cleanupExistingDemoContent(conn) {
  await conn.query(`DELETE FROM admin_notification_reads WHERE notification_id LIKE 'booking-%' OR notification_id LIKE 'payment-%' OR notification_id LIKE 'comment-%'`);
  await conn.query(`DELETE FROM admin_notification_state`);
  await conn.query(`DELETE FROM payments WHERE transaction_id LIKE 'DEMO-PAY-%'`);
  await conn.query(`DELETE FROM posts WHERE slug LIKE 'demo-%'`);
}

async function fetchSeedData(conn) {
  const [users] = await conn.query(
    `SELECT id, full_name, email, avatar FROM users ORDER BY created_at ASC`
  );
  const [categories] = await conn.query(
    `SELECT id, name, slug FROM categories ORDER BY name ASC`
  );
  const [bookings] = await conn.query(
    `SELECT id, booking_reference, customer_name, payment_status, booking_status, total_amount, amount_paid, refund_amount, payment_method, created_at, updated_at
     FROM bookings
     ORDER BY created_at ASC`
  );
  const [admins] = await conn.query(`SELECT id, name FROM admins LIMIT 1`);
  return { users, categories, bookings, adminId: admins[0]?.id || null };
}

async function seedTags(conn) {
  for (const tag of TAGS) {
    await conn.execute(
      `INSERT IGNORE INTO tags (id, name, slug) VALUES (?, ?, ?)`,
      [randomUUID(), tag.name, tag.slug]
    );
  }
}

async function insertPost(conn, post, author, categoryId, tagMap, offsetIndex) {
  const postId = randomUUID();
  const now = new Date();
  const publishedAt = post.status === 'published' ? addMinutes(now, -180 - offsetIndex * 20) : null;

  await conn.execute(
    `
      INSERT INTO posts (
        id, title, slug, excerpt, content, category_id, author_id, author_type,
        featured_image, status, views, likes, published_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `,
    [
      postId,
      post.title,
      post.slug,
      post.excerpt,
      post.content,
      categoryId,
      author.id,
      'user',
      post.image,
      post.status,
      120 + offsetIndex * 17,
      0,
      publishedAt,
    ]
  );

  for (const tagSlug of post.tags) {
    const tagId = tagMap.get(tagSlug);
    if (!tagId) continue;
    await conn.execute(
      `INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)`,
      [postId, tagId]
    );
  }

  return postId;
}

async function insertLikes(conn, postId, users, count, startIndex = 0) {
  const selectedUsers = users.slice(startIndex, startIndex + count);
  for (const user of selectedUsers) {
    await conn.execute(
      `INSERT INTO post_likes (id, post_id, user_id, user_type, ip_address, created_at) VALUES (?, ?, ?, 'user', ?, NOW())`,
      [randomUUID(), postId, user.id, `10.10.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`]
    );
  }
  await conn.execute(`UPDATE posts SET likes = ? WHERE id = ?`, [selectedUsers.length, postId]);
}

async function insertComment(conn, comment, postId, user, parentId = null, createdAt = new Date()) {
  const commentId = randomUUID();
  await conn.execute(
    `
      INSERT INTO comments (
        id, post_id, user_id, author_name, author_avatar, content, likes, parent_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `,
    [
      commentId,
      postId,
      user.id,
      user.full_name,
      user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.full_name)}&size=100`,
      comment,
      parentId,
      createdAt,
      createdAt,
    ]
  );
  return commentId;
}

async function insertCommentLikes(conn, commentId, users, count, startIndex = 0) {
  const selectedUsers = users.slice(startIndex, startIndex + count);
  for (const user of selectedUsers) {
    await conn.execute(
      `INSERT INTO comment_likes (id, comment_id, user_id, user_type, ip_address, created_at) VALUES (?, ?, ?, 'user', ?, NOW())`,
      [randomUUID(), commentId, user.id, `172.16.${Math.floor(Math.random() * 100)}.${Math.floor(Math.random() * 100)}`]
    );
  }
  await conn.execute(`UPDATE comments SET likes = ? WHERE id = ?`, [selectedUsers.length, commentId]);
}

async function seedBlogContent(conn, users, categories) {
  const tagRows = await conn.query(`SELECT id, slug FROM tags`);
  const tagMap = new Map(tagRows[0].map((row) => [row.slug, row.id]));
  const categoryMap = new Map(categories.map((row) => [row.name, row.id]));

  const postsWithMeta = [];
  for (let i = 0; i < POSTS.length; i += 1) {
    const post = POSTS[i];
    const author = pick(users, i);
    const categoryId = categoryMap.get(post.categoryName) || categories[i % categories.length]?.id;
    if (!categoryId) {
      throw new Error(`Missing category for ${post.categoryName}`);
    }
    const postId = await insertPost(conn, post, author, categoryId, tagMap, i);
    postsWithMeta.push({ postId, post, author });
  }

  const commentsToSeed = [];
  for (let i = 0; i < postsWithMeta.length; i += 1) {
    const { postId, post } = postsWithMeta[i];
    const authorA = pick(users, i + 1);
    const authorB = pick(users, i + 2);
    const authorC = pick(users, i + 3);

    const comment1 = await insertComment(
      conn,
      [
        `This is the kind of practical guide I needed for ${post.title.toLowerCase()}.`,
        'The safety section feels realistic and easy to follow.',
      ][i % 2],
      postId,
      authorA,
      null,
      addHours(new Date(), -5 - i)
    );
    commentsToSeed.push({ commentId: comment1, postId, kind: 'comment' });

    const comment2 = await insertComment(
      conn,
      [
        'We used a similar checklist on our last weekend trek and it saved us a lot of hassle.',
        'Budget advice is often vague, but this breaks it down clearly.',
      ][i % 2],
      postId,
      authorB,
      null,
      addHours(new Date(), -4 - i)
    );
    commentsToSeed.push({ commentId: comment2, postId, kind: 'comment' });

    const reply = await insertComment(
      conn,
      'Agreed. The pacing advice is exactly what beginners need before their first summit push.',
      postId,
      authorC,
      comment1,
      addHours(new Date(), -3 - i)
    );
    commentsToSeed.push({ commentId: reply, postId, kind: 'reply' });

    await insertCommentLikes(conn, comment1, users, 2, i);
    await insertCommentLikes(conn, comment2, users, 1, i + 1);

    const postLikeCount = i === POSTS.length - 1 ? 1 : 2;
    await insertLikes(conn, postId, users, postLikeCount, i);
  }

  return { posts: postsWithMeta, comments: commentsToSeed };
}

async function seedPaymentsAndNotifications(conn, bookings, adminId, demoPosts, demoComments) {
  const paymentRows = [];
  const sortedBookings = bookings.filter((row) => String(row.booking_reference || '').startsWith('EDGE-') || String(row.booking_reference || '').startsWith('GWK-'));

  const completedBookings = sortedBookings.filter((row) => row.booking_status === 'completed' || row.payment_status === 'paid');
  const partialBookings = sortedBookings.filter((row) => row.payment_status === 'partial');
  const cancelledBookings = sortedBookings.filter((row) => row.booking_status === 'cancelled' || row.payment_status === 'refunded');
  const pendingBookings = sortedBookings.filter((row) => row.payment_status === 'pending' || row.booking_status === 'pending');

  function paymentTimeForBooking(booking, offsetHours) {
    return addHours(new Date(booking.created_at || new Date()), offsetHours);
  }

  for (let i = 0; i < completedBookings.length; i += 1) {
    const booking = completedBookings[i];
    const paymentId = randomUUID();
    const createdAt = paymentTimeForBooking(booking, 1 + i);
    await conn.execute(
      `INSERT INTO payments (id, booking_id, payment_method, transaction_id, amount, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'success', ?)`,
      [
        paymentId,
        booking.id,
        booking.payment_method || 'upi',
        `DEMO-PAY-SUC-${String(i + 1).padStart(3, '0')}`,
        Number(booking.total_amount || booking.amount_paid || 0),
        createdAt,
      ]
    );
    paymentRows.push({ id: paymentId, bookingId: booking.id, createdAt });
  }

  for (let i = 0; i < partialBookings.length; i += 1) {
    const booking = partialBookings[i];
    const paymentId = randomUUID();
    const createdAt = paymentTimeForBooking(booking, 2 + i);
    await conn.execute(
      `INSERT INTO payments (id, booking_id, payment_method, transaction_id, amount, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'success', ?)`,
      [
        paymentId,
        booking.id,
        booking.payment_method || 'upi',
        `DEMO-PAY-PART-${String(i + 1).padStart(3, '0')}`,
        Number(booking.amount_paid || booking.total_amount || 0),
        createdAt,
      ]
    );
    paymentRows.push({ id: paymentId, bookingId: booking.id, createdAt });
  }

  for (let i = 0; i < cancelledBookings.length; i += 1) {
    const booking = cancelledBookings[i];
    const successId = randomUUID();
    const refundId = randomUUID();
    const successAt = paymentTimeForBooking(booking, 1 + i);
    const refundAt = paymentTimeForBooking(booking, 3 + i);
    const paidAmount = Number(booking.total_amount || booking.amount_paid || 0);
    const refundAmount = Number(booking.refund_amount || Math.round(paidAmount * 0.75 * 100) / 100);

    await conn.execute(
      `INSERT INTO payments (id, booking_id, payment_method, transaction_id, amount, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'success', ?)`,
      [
        successId,
        booking.id,
        booking.payment_method || 'upi',
        `DEMO-PAY-REF-SUC-${String(i + 1).padStart(3, '0')}`,
        paidAmount,
        successAt,
      ]
    );

    await conn.execute(
      `INSERT INTO payments (id, booking_id, payment_method, transaction_id, amount, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'refunded', ?)`,
      [
        refundId,
        booking.id,
        booking.payment_method || 'upi',
        `DEMO-PAY-REF-UND-${String(i + 1).padStart(3, '0')}`,
        refundAmount,
        refundAt,
      ]
    );
    paymentRows.push({ id: successId, bookingId: booking.id, createdAt: successAt });
    paymentRows.push({ id: refundId, bookingId: booking.id, createdAt: refundAt });
  }

  for (let i = 0; i < pendingBookings.length; i += 1) {
    const booking = pendingBookings[i];
    const paymentId = randomUUID();
    const createdAt = paymentTimeForBooking(booking, 1 + i);
    await conn.execute(
      `INSERT INTO payments (id, booking_id, payment_method, transaction_id, amount, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'failed', ?)`,
      [
        paymentId,
        booking.id,
        booking.payment_method || 'upi',
        `DEMO-PAY-FAIL-${String(i + 1).padStart(3, '0')}`,
        Number(booking.total_amount || booking.amount_paid || 0),
        createdAt,
      ]
    );
    paymentRows.push({ id: paymentId, bookingId: booking.id, createdAt });
  }

  if (adminId) {
    await conn.execute(
      `INSERT INTO admin_notification_state (admin_id, last_read_all_at)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE last_read_all_at = VALUES(last_read_all_at)`,
      [adminId, addHours(new Date(), -24)]
    );

    const firstPayment = paymentRows[0];
    const firstComment = demoComments[0];
    const extraComment = demoComments[1];
    const readIds = [
      firstPayment ? `payment-${firstPayment.id}` : null,
      firstComment ? `comment-${firstComment.commentId}` : null,
      extraComment ? `comment-${extraComment.commentId}` : null,
    ].filter(Boolean);

    for (const notificationId of readIds) {
      await conn.execute(
        `INSERT IGNORE INTO admin_notification_reads (id, admin_id, notification_id, read_at)
         VALUES (?, ?, ?, NOW())`,
        [randomUUID(), adminId, notificationId]
      );
    }
  }

  return paymentRows;
}

async function main() {
  const conn = await mysql.createConnection(dbConfig);
  console.log(`Connected to ${dbConfig.database} on ${dbConfig.host}:${dbConfig.port}`);

  try {
    await conn.beginTransaction();
    await cleanupExistingDemoContent(conn);
    await seedTags(conn);

    const { users, categories, bookings, adminId } = await fetchSeedData(conn);
    if (users.length < 3) {
      throw new Error('Seed users are missing. Run the commerce seed first.');
    }
    if (categories.length === 0) {
      throw new Error('Seed categories are missing. Run the category seed first.');
    }
    if (bookings.length === 0) {
      throw new Error('Seed bookings are missing. Run the commerce seed first.');
    }

    const { posts, comments } = await seedBlogContent(conn, users, categories);
    await seedPaymentsAndNotifications(conn, bookings, adminId, posts, comments);

    await conn.commit();

    console.log(
      `Added ${posts.length} demo blog posts, ${comments.length} comments/replies, payment history, and notification state.`
    );
  } catch (error) {
    await conn.rollback();
    console.error('Demo content seeding failed:', error);
    throw error;
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error('Seed demo content script failed:', error);
  process.exit(1);
});
