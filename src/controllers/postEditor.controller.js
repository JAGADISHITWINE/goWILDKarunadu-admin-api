const pool = require('../config/db');
const { generateSlug, formatDateForMySQL } = require('../utils/helpers');
const { encrypt, decrypt } = require('../service/cryptoHelper');
const { createUuid } = require('../utils/id');
const categoryService = require('../service/category.service');
const { resolvePostUploadPath } = require('../utils/uploadPaths');

// Create new post
exports.createPost = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    const permissions = Array.isArray(req.user?.permissions) ? req.user.permissions : [];
    if (!req.user || (req.user.role !== 'super_admin' && !permissions.includes('blog.manage'))) {
      return res.status(403).json({
        success: false,
        message: 'Admin access only'
      });
    }

    await connection.beginTransaction();

    const { title, excerpt, content, category, status, publishDate } = req.body;
    const tags = JSON.parse(req.body.tags || '[]');

    if (!title || !excerpt || !content || !category) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    const slug = generateSlug(title);

    const [categories] = await connection.query(
      "SELECT id FROM categories WHERE name = ? AND status = 'active' LIMIT 1",
      [category]
    );

    if (!categories.length) {
      throw new Error('Invalid category');
    }

    const category_id = categories[0].id;
    const published_at =
      status === 'published' ? formatDateForMySQL(publishDate) : null;

    const adminId = req.user.id;

    let featuredImage = null;

    if (req.file) {
      featuredImage = resolvePostUploadPath(req.file);
      const mediaId = createUuid();

      await connection.query(
        `INSERT INTO media (id, file_name, file_url, file_type, uploaded_by, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        [
          mediaId,
          req.file.filename,
          featuredImage,
          req.file.mimetype,
          adminId
        ]
      );

      console.log('[Upload] Post create stored media', {
        url: featuredImage,
        publicId: req.file.filename
      });
    }

    // ✅ IMPORTANT PART HERE
    const postId = createUuid();
    await connection.query(
      `INSERT INTO posts 
       (id, title, slug, excerpt, content, category_id, author_id, author_type, featured_image, status, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        postId,
        title,
        slug,
        excerpt,
        content,
        category_id,
        adminId,
        'admin',        // ✅ THIS FIXES YOUR ISSUE
        featuredImage,
        status,
        published_at
      ]
    );

    if (tags && Array.isArray(tags)) {
      await saveTags(connection, postId, tags);
    }

    await connection.commit();

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      postId
    });

  } catch (error) {
    await connection.rollback();
    console.error(error);

    res.status(500).json({
      success: false,
      message: 'Failed to create post',
      error: error.message
    });

  } finally {
    connection.release();
  }
};

// Update post
exports.updatePost = async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;

    // Check if post exists
    const [existingRows] = await connection.query(
      'SELECT * FROM posts WHERE id = ?',
      [id]
    );

    if (existingRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Post not found' });
    }

    const existing = existingRows[0];

    const {
      title,
      excerpt,
      content,
      category,
      status,
      publishDate
    } = req.body;

    const tags = JSON.parse(req.body.tags || '[]');

    // Use existing values if not provided
    const finalTitle = title || existing.title;
    const finalExcerpt = excerpt || existing.excerpt;
    const finalContent = content || existing.content;
    const finalStatus = status || existing.status;

    // Generate slug if title changed
    const slug = title ? generateSlug(finalTitle) : existing.slug;

    // Handle category
    let category_id = existing.category_id;

    if (category) {
      const [categories] = await connection.query(
        "SELECT id FROM categories WHERE name = ? AND status = 'active' LIMIT 1",
        [category]
      );

      if (categories.length === 0) {
        throw new Error('Invalid category');
      }

      category_id = categories[0].id;
    }

    // Handle publish date
    const published_at =
      finalStatus === 'published'
        ? formatDateForMySQL(publishDate || new Date())
        : null;

    // Handle image upload (same logic as createPost)
    let featuredImage = existing.featured_image;

    if (req.file) {
      featuredImage = resolvePostUploadPath(req.file);

      const uploaderId = req.user?.id || existing.author_id;
      const mediaId = createUuid();

      await connection.query(`
        INSERT INTO media (id, file_name, file_url, file_type, uploaded_by, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
      `, [
        mediaId,
        req.file.filename,
        featuredImage,
        req.file.mimetype,
        uploaderId
      ]);

      console.log('[Upload] Post update stored media', {
        url: featuredImage,
        publicId: req.file.filename,
        uploaderId
      });
    }

    // Update post
    await connection.query(`
      UPDATE posts
      SET title = ?, slug = ?, excerpt = ?, content = ?, category_id = ?,
          featured_image = ?, status = ?, published_at = ?, updated_at = NOW()
      WHERE id = ?
    `, [
      finalTitle,
      slug,
      finalExcerpt,
      finalContent,
      category_id,
      featuredImage,
      finalStatus,
      published_at,
      id
    ]);

    // Update tags
    if (Array.isArray(tags)) {
      await connection.query('DELETE FROM post_tags WHERE post_id = ?', [id]);
      await saveTags(connection, id, tags);
    }

    await connection.commit();

    res.json({
      message: 'Post updated successfully',
      postId: id
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error updating post:', error);
    res.status(500).json({
      error: 'Failed to update post',
      details: error.message
    });
  } finally {
    connection.release();
  }
};

// Helper function to save tags
async function saveTags(connection, postId, tags) {
  for (const tagName of tags) {
    if (!tagName || tagName.trim() === '') continue;

    const slug = generateSlug(tagName);

    // Insert or get tag
    let tagId;
    const [existingTag] = await connection.query(
      'SELECT id FROM tags WHERE slug = ?',
      [slug]
    );

    if (existingTag.length > 0) {
      tagId = existingTag[0].id;
    } else {
      tagId = createUuid();
      const [newTag] = await connection.query(
        'INSERT INTO tags (id, name, slug) VALUES (?, ?, ?)',
        [tagId, tagName.trim(), slug]
      );
    }

    // Link tag to post
    await connection.query(
      'INSERT IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)',
      [postId, tagId]
    );
  }
}

// Keep other controller methods the same...
exports.getAllPosts = async (req, res) => {
  try {
    const [posts] = await pool.query(`
      SELECT 
        p.*,
        c.name AS category_name,
        COALESCE(a.name, u.full_name, 'Unknown') AS author_name,
        tg.tags
      FROM posts p
      LEFT JOIN categories c ON p.category_id COLLATE utf8mb4_unicode_ci = c.id COLLATE utf8mb4_unicode_ci
      LEFT JOIN admins a ON p.author_type COLLATE utf8mb4_unicode_ci = 'admin' AND p.author_id COLLATE utf8mb4_unicode_ci = a.id COLLATE utf8mb4_unicode_ci
      LEFT JOIN users u ON p.author_type COLLATE utf8mb4_unicode_ci = 'user' AND p.author_id COLLATE utf8mb4_unicode_ci = u.id COLLATE utf8mb4_unicode_ci
      LEFT JOIN (
        SELECT pt.post_id, GROUP_CONCAT(t.name) AS tags
        FROM post_tags pt
        LEFT JOIN tags t ON pt.tag_id COLLATE utf8mb4_unicode_ci = t.id COLLATE utf8mb4_unicode_ci
        GROUP BY pt.post_id
      ) tg ON p.id COLLATE utf8mb4_unicode_ci = tg.post_id COLLATE utf8mb4_unicode_ci
      ORDER BY p.created_at DESC
    `);

    const postsWithTags = posts.map(post => ({
      ...post,
      tags: post.tags ? post.tags.split(',') : []
    }));

    const encryptedResponse = encrypt(postsWithTags);

    // Send response
    res.status(200).json({
      success: true,
      data: encryptedResponse
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
};

exports.getPostById = async (req, res) => {
  try {
    const { id } = req.params;

    const [posts] = await pool.query(`
      SELECT 
        p.*,
        c.name as category,
        c.id as category_id
      FROM posts p
      LEFT JOIN categories c ON p.category_id COLLATE utf8mb4_unicode_ci = c.id COLLATE utf8mb4_unicode_ci
      WHERE p.id = ?
    `, [id]);

    if (posts.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const [tags] = await pool.query(`
      SELECT t.name
      FROM tags t
      INNER JOIN post_tags pt ON t.id COLLATE utf8mb4_unicode_ci = pt.tag_id COLLATE utf8mb4_unicode_ci
      WHERE pt.post_id = ?
    `, [id]);

    const post = {
      ...posts[0],
      tags: tags.map(t => t.name)
    };

    res.json(post);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ error: 'Failed to fetch post' });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM posts WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Failed to delete post' });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await categoryService.listActiveCategories();
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
};

exports.reviews = async (req, res) => {
  try {
    const [reviews] = await pool.query(`
      SELECT 
        c.id AS comment_id,
        c.author_name,
        c.content as comment,
        c.likes,
        c.author_avatar,
        DATE(c.created_at) AS comment_date,

        p.id AS post_id,
        p.title,
        p.slug,
        p.excerpt,
        p.content,
        p.category_id,
        p.author_id,
        p.author_type,
        p.featured_image,
        p.status AS post_status,
        p.views,
        p.likes,
        p.published_at,
        p.created_at AS post_created_at,
        p.updated_at AS post_updated_at

      FROM comments c
      LEFT JOIN posts p ON c.post_id COLLATE utf8mb4_unicode_ci = p.id COLLATE utf8mb4_unicode_ci
      ORDER BY c.author_name ASC
    `);

    res.json({
      success: true,
      data: reviews
    });

  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reviews'
    });
  }
};
