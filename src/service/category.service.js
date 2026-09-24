const db = require('../config/db');
const { createUuid } = require('../utils/id');

const DEFAULT_CATEGORIES = [
  { name: 'Adventure Guides', sortOrder: 1 },
  { name: 'Weekend Trips', sortOrder: 2 },
  { name: 'Safety Tips', sortOrder: 3 },
  { name: 'Packing & Gear', sortOrder: 4 },
  { name: 'Budget Travel', sortOrder: 5 },
  { name: 'Solo Travel', sortOrder: 6 },
  { name: 'Family Treks', sortOrder: 7 },
  { name: 'Travel Stories', sortOrder: 8 },
];

let schemaReady = false;

function toSlug(text = '') {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function normalizeText(value) {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active';
}

function normalizeSortOrder(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function columnExists(tableName, columnName) {
  const [rows] = await db.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
  return rows.length > 0;
}

async function ensureCategorySchema() {
  if (schemaReady) return;

  await db.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id CHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      slug VARCHAR(120) NOT NULL,
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY slug (slug),
      KEY idx_status_sort (status, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  if (!(await columnExists('categories', 'status'))) {
    await db.query(`ALTER TABLE categories ADD COLUMN status ENUM('active','inactive') NOT NULL DEFAULT 'active' AFTER slug`);
  }

  if (!(await columnExists('categories', 'sort_order'))) {
    await db.query(`ALTER TABLE categories ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER status`);
  }

  if (!(await columnExists('categories', 'updated_at'))) {
    await db.query(`ALTER TABLE categories ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`);
  }

  schemaReady = true;
}

async function seedDefaultCategories() {
  await ensureCategorySchema();

  const [countRows] = await db.query('SELECT COUNT(*) AS total FROM categories');
  if (Number(countRows?.[0]?.total || 0) > 0) return;

  for (const category of DEFAULT_CATEGORIES) {
    const name = normalizeText(category.name);
    if (!name) continue;
    const slug = toSlug(name);
    const sortOrder = normalizeSortOrder(category.sortOrder, 0);
    await db.query(
      `INSERT INTO categories (id, name, slug, status, sort_order)
       VALUES (?, ?, ?, 'active', ?)`,
      [createUuid(), name, slug, sortOrder]
    );
  }
}

async function listActiveCategories() {
  await seedDefaultCategories();

  const [rows] = await db.query(
    `SELECT id, name, slug, status, sort_order AS sortOrder, created_at AS createdAt, updated_at AS updatedAt
     FROM categories
     WHERE status = 'active'
     ORDER BY sort_order ASC, name ASC`
  );

  return rows;
}

async function listAllCategories() {
  await seedDefaultCategories();

  const [rows] = await db.query(
    `SELECT id, name, slug, status, sort_order AS sortOrder, created_at AS createdAt, updated_at AS updatedAt
     FROM categories
     ORDER BY sort_order ASC, name ASC`
  );

  return rows;
}

async function createCategory(payload = {}) {
  await ensureCategorySchema();

  const name = normalizeText(payload.name);
  const status = normalizeStatus(payload.status);
  const sortOrder = normalizeSortOrder(payload.sortOrder, 0);

  if (!name) {
    throw new Error('CATEGORY_NAME_REQUIRED');
  }

  const slug = toSlug(name);
  const [[duplicate]] = await db.query('SELECT id FROM categories WHERE slug = ? LIMIT 1', [slug]);
  if (duplicate) {
    throw new Error('CATEGORY_ALREADY_EXISTS');
  }

  const categoryId = createUuid();
  await db.query(
    `INSERT INTO categories (id, name, slug, status, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [categoryId, name, slug, status, sortOrder]
  );

  return {
    id: categoryId,
    name,
    slug,
    status,
    sortOrder,
  };
}

async function updateCategory(id, payload = {}) {
  await ensureCategorySchema();

  const categoryId = String(id || '').trim();
  if (!categoryId) {
    throw new Error('INVALID_CATEGORY_ID');
  }

  const [[existing]] = await db.query('SELECT * FROM categories WHERE id = ? LIMIT 1', [categoryId]);
  if (!existing) {
    throw new Error('CATEGORY_NOT_FOUND');
  }

  const fields = [];
  const params = [];

  if (payload.name !== undefined) {
    const name = normalizeText(payload.name);
    if (!name) {
      throw new Error('CATEGORY_NAME_REQUIRED');
    }
    const slug = toSlug(name);
    const [[duplicate]] = await db.query('SELECT id FROM categories WHERE slug = ? AND id <> ? LIMIT 1', [slug, categoryId]);
    if (duplicate) {
      throw new Error('CATEGORY_ALREADY_EXISTS');
    }
    fields.push('name = ?, slug = ?');
    params.push(name, slug);
  }

  if (payload.status !== undefined) {
    fields.push('status = ?');
    params.push(normalizeStatus(payload.status));
  }

  if (payload.sortOrder !== undefined) {
    fields.push('sort_order = ?');
    params.push(normalizeSortOrder(payload.sortOrder, existing.sort_order));
  }

  if (fields.length === 0) {
    throw new Error('NO_CATEGORY_FIELDS');
  }

  params.push(categoryId);
  await db.query(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, params);

  const [rows] = await db.query(
    `SELECT id, name, slug, status, sort_order AS sortOrder, created_at AS createdAt, updated_at AS updatedAt
     FROM categories WHERE id = ? LIMIT 1`,
    [categoryId]
  );

  return rows[0] || null;
}

async function deactivateCategory(id) {
  return updateCategory(id, { status: 'inactive' });
}

async function deleteCategoryPermanently(id) {
  await ensureCategorySchema();

  const categoryId = String(id || '').trim();
  if (!categoryId) {
    throw new Error('INVALID_CATEGORY_ID');
  }

  const [result] = await db.query('DELETE FROM categories WHERE id = ?', [categoryId]);
  if (result.affectedRows === 0) {
    throw new Error('CATEGORY_NOT_FOUND');
  }

  return true;
}

module.exports = {
  ensureCategorySchema,
  seedDefaultCategories,
  listActiveCategories,
  listAllCategories,
  createCategory,
  updateCategory,
  deactivateCategory,
  deleteCategoryPermanently,
};
