const db = require('../config/db');
const { encrypt } = require('../service/cryptoHelper');
const { createUuid } = require('../utils/id');
const categoryService = require('../service/category.service');

const DEFAULT_DROPDOWNS = [
  {
    groupKey: 'trekDifficulty',
    label: 'Trek Difficulty',
    page: 'Treks',
    sortOrder: 1,
    options: ['Easy', 'Moderate', 'Difficult', 'Extreme', 'Challenging'],
  },
  {
    groupKey: 'trekCategory',
    label: 'Trek Category',
    page: 'Treks',
    sortOrder: 2,
    options: ['Hill Trek', 'Peak Trek', 'Mountain Trek', 'Forest Trek', 'Desert Trek', 'Snow Trek'],
  },
  {
    groupKey: 'trekFitnessLevel',
    label: 'Trek Fitness Level',
    page: 'Treks',
    sortOrder: 3,
    options: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
  },
  {
    groupKey: 'trekCollection',
    label: 'Trek Collection',
    page: 'Treks',
    sortOrder: 4,
    options: [],
  },
  {
    groupKey: 'batchStatus',
    label: 'Batch Status',
    page: 'Treks',
    sortOrder: 5,
    options: ['active', 'inactive', 'full', 'cancelled', 'completed'],
  },
  {
    groupKey: 'bookingStatus',
    label: 'Booking Status',
    page: 'Bookings',
    sortOrder: 6,
    options: ['pending', 'confirmed', 'cancelled', 'completed'],
  },
  {
    groupKey: 'reviewStatus',
    label: 'Review Status',
    page: 'Reviews',
    sortOrder: 7,
    options: ['pending', 'approved', 'rejected'],
  },
  {
    groupKey: 'userStatus',
    label: 'User Status',
    page: 'Users',
    sortOrder: 8,
    options: ['active', 'inactive', 'blocked'],
  },
  {
    groupKey: 'settingsTwoFactorMode',
    label: 'Two Factor Mode',
    page: 'Settings',
    sortOrder: 9,
    options: ['Off', 'Optional', 'Mandatory'],
  },
  {
    groupKey: 'dashboardRows',
    label: 'Dashboard Rows',
    page: 'Dashboard',
    sortOrder: 10,
    options: ['5', '10', '20', '50'],
  },
  {
    groupKey: 'blogStatus',
    label: 'Blog Status',
    page: 'Blog',
    sortOrder: 11,
    options: ['draft', 'published', 'archived'],
  },
  {
    groupKey: 'govtIdType',
    label: 'Govt ID Document Type',
    page: 'Manifest',
    sortOrder: 12,
    options: ['Aadhaar Card', 'Passport', 'Driving License', 'Voter ID Card'],
  },
  {
    groupKey: 'bloodGroup',
    label: 'Blood Group',
    page: 'Medical Roster',
    sortOrder: 13,
    options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'],
  },
  {
    groupKey: 'dietaryPreference',
    label: 'Dietary Preference',
    page: 'Operations',
    sortOrder: 14,
    options: ['Vegetarian', 'Non-Vegetarian', 'Jain (No Onion/Garlic)', 'Vegan', 'Eggitarian'],
  },
  {
    groupKey: 'trekMedicalConditions',
    label: 'Medical & Health Declarations',
    page: 'Manifest',
    sortOrder: 15,
    options: [
      'None / Fit to Trek',
      'Asthma / Respiratory issue',
      'High Blood Pressure / Hypertension',
      'Heart Condition / Cardiac history',
      'Diabetes',
      'Allergies / Dust & Pollen',
      'Recent Knee / Ankle Surgery',
      'Epilepsy / Vertigo / Acrophobia'
    ],
  },
  {
    groupKey: 'trailCondition',
    label: 'Trail Status & Passability',
    page: 'Treks',
    sortOrder: 16,
    options: [
      'Open & Clear (Optimal Trekking)',
      'Wet & Slippery (Monsoon Alert)',
      'Heavy Rain & Leech Alert',
      'High Wind & Mist Alert',
      'Stream Overflow / Restricted Crossing',
      'Forest Dept Trail Closed'
    ],
  },
  {
    groupKey: 'trailWeatherSeverity',
    label: 'Weather Alert Severity',
    page: 'Treks',
    sortOrder: 17,
    options: ['Normal (Green)', 'Advisory (Yellow)', 'Severe Warning (Orange)', 'Extreme Danger (Red)'],
  },
  {
    groupKey: 'gearCategory',
    label: 'Rental Equipment Category',
    page: 'Gear Inventory',
    sortOrder: 18,
    options: [
      'Trekking Poles & Sticks',
      'Sleeping Bags & Mats',
      'Alpine Tents (2-Person / 4-Person)',
      'Waterproof Ponchos & Rain Covers',
      'Headlamps & Torches',
      'Gaiters & Microspikes',
      'Expedition Rucksacks (50L-60L)'
    ],
  },
  {
    groupKey: 'gearCondition',
    label: 'Equipment Condition',
    page: 'Gear Inventory',
    sortOrder: 19,
    options: ['Brand New', 'Good Condition', 'Needs Maintenance', 'Retired / Damaged'],
  },
  {
    groupKey: 'expenseCategory',
    label: 'Batch Operating Expense',
    page: 'Batch Financials',
    sortOrder: 20,
    options: [
      'Forest Dept Eco-Permits & Entry Fees',
      'Guide & Lead Honorarium',
      'Homestay & Food / Camp Meals',
      'Vehicle Fuel & Transport Costs',
      'First Aid & Safety Equipment',
      'Basecamp Logistics & Waste Handling',
      'Marketing & Booking Operations'
    ],
  },
  {
    groupKey: 'paymentMethod',
    label: 'Payment Method',
    page: 'Bookings',
    sortOrder: 21,
    options: [
      'UPI (GPay / PhonePe / Paytm / BHIM)',
      'Credit / Debit Card (Visa, Mastercard, RuPay)',
      'Net Banking (All Indian Banks)',
      'Razorpay Gateway Auto-Capture',
      'Direct Bank Transfer (NEFT/RTGS/IMPS)',
      'Cash / Basecamp Offline Payment'
    ],
  },
  {
    groupKey: 'refundReason',
    label: 'Refund & Cancellation Reason',
    page: 'Bookings',
    sortOrder: 22,
    options: [
      'Customer Cancellation (Personal Reasons)',
      'Medical / Health Emergency (Fit-to-Trek Denied)',
      'Batch Cancelled / Rescheduled by Org',
      'Weather / Forest Dept Advisory Alert',
      'Duplicate / Accidental Transaction',
      'Date Change / Batch Swap Transfer'
    ],
  },
  {
    groupKey: 'refundChannel',
    label: 'Refund Destination Mode',
    page: 'Bookings',
    sortOrder: 23,
    options: [
      'Online Gateway Reversal (Razorpay)',
      'UPI Instant Transfer (GPay / PhonePe / Paytm)',
      'Direct Bank Transfer (NEFT / IMPS)',
      'Credit Shell / Future Trek Voucher (100% Value)',
      'Cash Refund / Basecamp'
    ],
  },
];

function toSlugValue(text = '') {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function normalizeGroupKey(value = '') {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '');
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active';
}

function normalizeSortOrder(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeText(value) {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

function parseOptionsPayload(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];

  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapOptionRow(row) {
  return {
    id: row.id,
    label: row.label,
    value: row.option_value,
    status: row.status,
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapGroupRow(row) {
  return {
    id: row.id,
    key: row.group_key,
    groupKey: row.group_key,
    label: row.label,
    page: row.page,
    status: row.status,
    sortOrder: Number(row.sort_order || 0),
    options: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function createSyntheticOption(groupKey, label, index) {
  const value = toSlugValue(label);
  return {
    id: `${groupKey}-${value || index + 1}`,
    label: String(label),
    value,
    status: 'active',
    sortOrder: index + 1,
    createdAt: null,
    updatedAt: null,
  };
}

async function ensureDropdownSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS dropdown_groups (
      id CHAR(36) NOT NULL PRIMARY KEY,
      group_key VARCHAR(120) NOT NULL UNIQUE,
      label VARCHAR(150) NOT NULL,
      page VARCHAR(150) NOT NULL,
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_page (page)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS dropdown_options (
      id CHAR(36) NOT NULL PRIMARY KEY,
      group_id CHAR(36) NOT NULL,
      label VARCHAR(150) NOT NULL,
      option_value VARCHAR(150) NOT NULL,
      status ENUM('active','inactive') NOT NULL DEFAULT 'active',
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_group_value (group_id, option_value),
      KEY idx_group_id (group_id),
      KEY idx_group_status (group_id, status),
      CONSTRAINT fk_dropdown_options_group FOREIGN KEY (group_id) REFERENCES dropdown_groups (id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function seedDefaultDropdowns() {
  for (const groupDef of DEFAULT_DROPDOWNS) {
    const groupKey = normalizeGroupKey(groupDef.groupKey);
    const label = normalizeText(groupDef.label);
    const page = normalizeText(groupDef.page);
    const sortOrder = normalizeSortOrder(groupDef.sortOrder, 0);

    if (!groupKey || !label || !page) continue;

    const [groupRows] = await db.query(
      'SELECT id FROM dropdown_groups WHERE group_key = ? LIMIT 1',
      [groupKey]
    );

    let groupId = groupRows[0]?.id || null;
    if (!groupId) {
      groupId = createUuid();
      await db.query(
        `INSERT INTO dropdown_groups (id, group_key, label, page, status, sort_order)
         VALUES (?, ?, ?, ?, 'active', ?)`,
        [groupId, groupKey, label, page, sortOrder]
      );
    }

    for (let index = 0; index < groupDef.options.length; index += 1) {
      const optionLabel = normalizeText(groupDef.options[index]);
      if (!optionLabel) continue;
      const optionValue = toSlugValue(optionLabel);
      const optionSortOrder = index + 1;
      const [optionRows] = await db.query(
        'SELECT id FROM dropdown_options WHERE group_id = ? AND option_value = ? LIMIT 1',
        [groupId, optionValue]
      );

      if (!optionRows.length) {
        await db.query(
          `INSERT INTO dropdown_options (id, group_id, label, option_value, status, sort_order)
           VALUES (?, ?, ?, ?, 'active', ?)`,
          [createUuid(), groupId, optionLabel, optionValue, optionSortOrder]
        );
      }
    }
  }
}

async function loadDropdownGroups({ includeInactive = false } = {}) {
  const groupWhere = includeInactive ? '' : "WHERE g.status = 'active'";
  const optionWhere = includeInactive ? '' : "AND o.status = 'active'";

  const [rows] = await db.query(
    `SELECT
      g.id AS group_id,
      g.group_key,
      g.label AS group_label,
      g.page,
      g.status AS group_status,
      g.sort_order AS group_sort_order,
      g.created_at AS group_created_at,
      g.updated_at AS group_updated_at,
      o.id AS option_id,
      o.label AS option_label,
      o.option_value,
      o.status AS option_status,
      o.sort_order AS option_sort_order,
      o.created_at AS option_created_at,
      o.updated_at AS option_updated_at
    FROM dropdown_groups g
    LEFT JOIN dropdown_options o ON o.group_id = g.id ${optionWhere}
    ${groupWhere}
    ORDER BY g.sort_order ASC, g.label ASC, o.sort_order ASC, o.label ASC`
  );

  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.group_id)) {
      grouped.set(row.group_id, {
        id: row.group_id,
        key: row.group_key,
        groupKey: row.group_key,
        label: row.group_label,
        page: row.page,
        status: row.group_status,
        sortOrder: Number(row.group_sort_order || 0),
        options: [],
        createdAt: row.group_created_at,
        updatedAt: row.group_updated_at,
      });
    }

    if (row.option_id) {
      grouped.get(row.group_id).options.push({
        id: row.option_id,
        label: row.option_label,
        value: row.option_value,
        status: row.option_status,
        sortOrder: Number(row.option_sort_order || 0),
        createdAt: row.option_created_at,
        updatedAt: row.option_updated_at,
      });
    }
  }

  return Array.from(grouped.values());
}

async function getDropdownOptions(req, res) {
  try {
    await ensureDropdownSchema();
    await seedDefaultDropdowns();
    await categoryService.seedDefaultCategories();

    const groups = await loadDropdownGroups({ includeInactive: false });
    const categoryRows = await categoryService.listActiveCategories();
    const [collectionRows] = await db.query(
      `SELECT DISTINCT collection
       FROM treks
       WHERE collection IS NOT NULL AND TRIM(collection) <> ''
       ORDER BY collection ASC`
    );

    const categoryGroup = {
      id: 'categories',
      key: 'blogCategory',
      groupKey: 'blogCategory',
      label: 'Blog Category',
      page: 'Blog',
      status: 'active',
      sortOrder: 100,
      options: categoryRows.map((row, index) => createSyntheticOption('blogCategory', row.name, index)),
      createdAt: null,
      updatedAt: null,
    };

    const collectionGroup = groups.find((group) => group.groupKey === 'trekCollection');
    if (collectionGroup) {
      const existingValues = new Set(collectionGroup.options.map((option) => option.value));
      const additionalOptions = collectionRows
        .map((row) => normalizeText(row.collection))
        .filter(Boolean)
        .filter((label) => !existingValues.has(toSlugValue(label)))
        .map((label, index) => createSyntheticOption('trekCollection', label, collectionGroup.options.length + index));

      collectionGroup.options = [...collectionGroup.options, ...additionalOptions];
    }

    const responseGroups = [...groups, categoryGroup]
      .map((group) => ({
        ...group,
        options: group.options
          .filter((option) => option.status === 'active')
          .sort((a, b) => a.sortOrder - b.sortOrder || String(a.label).localeCompare(String(b.label))),
      }))
      .filter((group) => group.status === 'active');

    return res.status(200).json({
      success: true,
      data: encrypt(responseGroups),
    });
  } catch (error) {
    console.error('Dropdown groups error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dropdown groups'
    });
  }
}

async function getDropdownManagementGroups(req, res) {
  try {
    await ensureDropdownSchema();
    await seedDefaultDropdowns();

    const groups = await loadDropdownGroups({ includeInactive: true });
    return res.status(200).json({
      success: true,
      data: encrypt(groups),
    });
  } catch (error) {
    console.error('Dropdown management list error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dropdown management groups',
    });
  }
}

async function createDropdownGroup(req, res) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const groupKey = normalizeGroupKey(req.body?.groupKey);
    const label = normalizeText(req.body?.label);
    const page = normalizeText(req.body?.page);
    const status = normalizeStatus(req.body?.status);
    const sortOrder = normalizeSortOrder(req.body?.sortOrder, 0);
    const options = parseOptionsPayload(req.body?.options);

    if (!groupKey || !label || !page) {
      await conn.rollback();
      return res.status(400).json({
        success: false,
        message: 'groupKey, label and page are required'
      });
    }

    const [[existing]] = await conn.query(
      'SELECT id FROM dropdown_groups WHERE group_key = ? LIMIT 1',
      [groupKey]
    );
    if (existing) {
      await conn.rollback();
      return res.status(409).json({
        success: false,
        message: 'Dropdown group already exists'
      });
    }

    const groupId = createUuid();
    await conn.query(
      `INSERT INTO dropdown_groups (id, group_key, label, page, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [groupId, groupKey, label, page, status, sortOrder]
    );

    const createdOptions = [];
    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      const optionLabelSource = typeof option === 'string'
        ? option
        : option?.label || option?.optionLabel || option?.value;
      const optionValueSource = typeof option === 'string'
        ? option
        : option?.optionValue || option?.value || optionLabelSource;
      const optionLabel = normalizeText(optionLabelSource);
      const optionValue = toSlugValue(optionValueSource || optionLabel);
      if (!optionLabel || !optionValue) continue;

      const optionId = createUuid();
      const optionStatus = normalizeStatus(typeof option === 'string' ? 'active' : option?.status);
      const optionSortOrder = normalizeSortOrder(typeof option === 'string' ? index + 1 : option?.sortOrder, index + 1);
      await conn.query(
        `INSERT INTO dropdown_options (id, group_id, label, option_value, status, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [optionId, groupId, optionLabel, optionValue, optionStatus, optionSortOrder]
      );
      createdOptions.push({
        id: optionId,
        label: optionLabel,
        value: optionValue,
        status: optionStatus,
        sortOrder: optionSortOrder,
      });
    }

    await conn.commit();
    return res.status(201).json({
      success: true,
      message: 'Dropdown group created',
      data: {
        id: groupId,
        groupKey,
        label,
        page,
        status,
        sortOrder,
        options: createdOptions,
      },
    });
  } catch (error) {
    await conn.rollback();
    console.error('Create dropdown group error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create dropdown group',
    });
  } finally {
    conn.release();
  }
}

async function updateDropdownGroup(req, res) {
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const groupId = String(req.params?.id || '').trim();
    if (!groupId) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Invalid group id' });
    }

    const [[existing]] = await conn.query(
      'SELECT * FROM dropdown_groups WHERE id = ? LIMIT 1',
      [groupId]
    );

    if (!existing) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Dropdown group not found' });
    }

    const nextGroupKey = req.body?.groupKey !== undefined ? normalizeGroupKey(req.body.groupKey) : undefined;
    const nextLabel = req.body?.label !== undefined ? normalizeText(req.body.label) : undefined;
    const nextPage = req.body?.page !== undefined ? normalizeText(req.body.page) : undefined;
    const nextStatus = req.body?.status !== undefined ? normalizeStatus(req.body.status) : undefined;
    const nextSortOrder = req.body?.sortOrder !== undefined ? normalizeSortOrder(req.body.sortOrder, existing.sort_order) : undefined;

    if (nextGroupKey !== undefined && !nextGroupKey) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'groupKey cannot be empty' });
    }

    const fields = [];
    const params = [];

    if (nextGroupKey !== undefined) {
      const [[duplicate]] = await conn.query(
        'SELECT id FROM dropdown_groups WHERE group_key = ? AND id <> ? LIMIT 1',
        [nextGroupKey, groupId]
      );
      if (duplicate) {
        await conn.rollback();
        return res.status(409).json({ success: false, message: 'groupKey already exists' });
      }
      fields.push('group_key = ?');
      params.push(nextGroupKey);
    }
    if (nextLabel !== undefined) {
      fields.push('label = ?');
      params.push(nextLabel);
    }
    if (nextPage !== undefined) {
      fields.push('page = ?');
      params.push(nextPage);
    }
    if (nextStatus !== undefined) {
      fields.push('status = ?');
      params.push(nextStatus);
    }
    if (nextSortOrder !== undefined) {
      fields.push('sort_order = ?');
      params.push(nextSortOrder);
    }

    if (fields.length === 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'No fields provided for update' });
    }

    params.push(groupId);
    await conn.query(`UPDATE dropdown_groups SET ${fields.join(', ')} WHERE id = ?`, params);
    await conn.commit();

    return res.status(200).json({
      success: true,
      message: 'Dropdown group updated'
    });
  } catch (error) {
    await conn.rollback();
    console.error('Update dropdown group error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update dropdown group'
    });
  } finally {
    conn.release();
  }
}

async function deleteDropdownGroup(req, res) {
  try {
    const groupId = String(req.params?.id || '').trim();
    if (!groupId) {
      return res.status(400).json({ success: false, message: 'Invalid group id' });
    }

    const [result] = await db.query('DELETE FROM dropdown_groups WHERE id = ?', [groupId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Dropdown group not found' });
    }

    return res.status(200).json({ success: true, message: 'Dropdown group deleted' });
  } catch (error) {
    console.error('Delete dropdown group error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete dropdown group' });
  }
}

async function createDropdownOption(req, res) {
  try {
    const groupId = String(req.body?.groupId || '').trim();
    const label = normalizeText(req.body?.label);
    const value = normalizeText(req.body?.optionValue || req.body?.value || label);
    const status = normalizeStatus(req.body?.status);
    const sortOrder = normalizeSortOrder(req.body?.sortOrder, 0);

    if (!groupId || !label || !value) {
      return res.status(400).json({
        success: false,
        message: 'groupId, label and value are required'
      });
    }

    const [[group]] = await db.query(
      'SELECT id FROM dropdown_groups WHERE id = ? LIMIT 1',
      [groupId]
    );
    if (!group) {
      return res.status(404).json({ success: false, message: 'Dropdown group not found' });
    }

    const optionValue = toSlugValue(value);
    const [[existing]] = await db.query(
      'SELECT id FROM dropdown_options WHERE group_id = ? AND option_value = ? LIMIT 1',
      [groupId, optionValue]
    );
    if (existing) {
      return res.status(409).json({ success: false, message: 'Option already exists in this group' });
    }

    const optionId = createUuid();
    await db.query(
      `INSERT INTO dropdown_options (id, group_id, label, option_value, status, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [optionId, groupId, label, optionValue, status, sortOrder]
    );

    return res.status(201).json({
      success: true,
      message: 'Dropdown option created',
      data: {
        id: optionId,
        groupId,
        label,
        value: optionValue,
        status,
        sortOrder,
      }
    });
  } catch (error) {
    console.error('Create dropdown option error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create dropdown option'
    });
  }
}

async function updateDropdownOption(req, res) {
  try {
    const optionId = String(req.params?.id || '').trim();
    if (!optionId) {
      return res.status(400).json({ success: false, message: 'Invalid option id' });
    }

    const [[existing]] = await db.query(
      'SELECT * FROM dropdown_options WHERE id = ? LIMIT 1',
      [optionId]
    );
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Dropdown option not found' });
    }

    const nextLabel = req.body?.label !== undefined ? normalizeText(req.body.label) : undefined;
    const nextValue = req.body?.optionValue !== undefined || req.body?.value !== undefined
      ? toSlugValue(req.body?.optionValue || req.body?.value)
      : undefined;
    const nextStatus = req.body?.status !== undefined ? normalizeStatus(req.body.status) : undefined;
    const nextSortOrder = req.body?.sortOrder !== undefined ? normalizeSortOrder(req.body.sortOrder, existing.sort_order) : undefined;

    const fields = [];
    const params = [];

    if (nextLabel !== undefined) {
      fields.push('label = ?');
      params.push(nextLabel);
    }
    if (nextValue !== undefined) {
      const [[duplicate]] = await db.query(
        'SELECT id FROM dropdown_options WHERE group_id = ? AND option_value = ? AND id <> ? LIMIT 1',
        [existing.group_id, nextValue, optionId]
      );
      if (duplicate) {
        return res.status(409).json({ success: false, message: 'Option value already exists in this group' });
      }
      fields.push('option_value = ?');
      params.push(nextValue);
    }
    if (nextStatus !== undefined) {
      fields.push('status = ?');
      params.push(nextStatus);
    }
    if (nextSortOrder !== undefined) {
      fields.push('sort_order = ?');
      params.push(nextSortOrder);
    }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields provided for update' });
    }

    params.push(optionId);
    await db.query(`UPDATE dropdown_options SET ${fields.join(', ')} WHERE id = ?`, params);

    return res.status(200).json({
      success: true,
      message: 'Dropdown option updated'
    });
  } catch (error) {
    console.error('Update dropdown option error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update dropdown option'
    });
  }
}

async function deleteDropdownOption(req, res) {
  try {
    const optionId = String(req.params?.id || '').trim();
    if (!optionId) {
      return res.status(400).json({ success: false, message: 'Invalid option id' });
    }

    const [result] = await db.query('DELETE FROM dropdown_options WHERE id = ?', [optionId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Dropdown option not found' });
    }

    return res.status(200).json({ success: true, message: 'Dropdown option deleted' });
  } catch (error) {
    console.error('Delete dropdown option error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete dropdown option' });
  }
}

function mapBatchLabel(batch) {
  return `${batch.trek_name} (${batch.start_date} to ${batch.end_date})`;
}

async function getBatchDropdown(req, res) {
  try {
    const trekId = String(req.query.trekId || '').trim();
    if (!trekId) {
      return res.status(400).json({
        success: false,
        message: 'Valid trekId is required'
      });
    }

    const [rows] = await db.query(
      `SELECT
        b.id,
        b.trek_id,
        t.name AS trek_name,
        DATE_FORMAT(b.start_date, '%Y-%m-%d') AS start_date,
        DATE_FORMAT(b.end_date, '%Y-%m-%d') AS end_date,
        b.status
      FROM trek_batches b
      INNER JOIN treks t ON t.id = b.trek_id COLLATE utf8mb4_unicode_ci
      WHERE b.trek_id = ?
      ORDER BY b.start_date ASC`,
      [trekId]
    );

    const data = rows.map((row) => ({
      value: row.id,
      label: mapBatchLabel(row),
      status: row.status,
      startDate: row.start_date,
      endDate: row.end_date
    }));

    return res.status(200).json({
      success: true,
      data: encrypt(data)
    });
  } catch (error) {
    console.error('Batch dropdown error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch batch dropdown'
    });
  }
}

module.exports = {
  ensureDropdownSchema,
  seedDefaultDropdowns,
  getDropdownOptions,
  getDropdownManagementGroups,
  createDropdownGroup,
  updateDropdownGroup,
  deleteDropdownGroup,
  createDropdownOption,
  updateDropdownOption,
  deleteDropdownOption,
  getBatchDropdown
};
