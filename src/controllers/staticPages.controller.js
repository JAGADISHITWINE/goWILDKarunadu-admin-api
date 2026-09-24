const staticPagesService = require('../service/staticPages.service');

function validatePayload(body = {}) {
  const payload = {};

  if (body.title !== undefined) {
    payload.title = String(body.title || '').trim();
    if (!payload.title) {
      return { valid: false, message: 'Title is required' };
    }
  }

  if (body.content !== undefined) {
    payload.content = typeof body.content === 'object' ? JSON.stringify(body.content) : String(body.content || '').trim();
    if (!payload.content) {
      return { valid: false, message: 'Content is required' };
    }
  }

  if (body.aboutData !== undefined && typeof body.aboutData === 'object' && body.aboutData !== null) {
    payload.aboutData = body.aboutData;
  }

  if (body.points !== undefined) {
    if (!Array.isArray(body.points)) {
      return { valid: false, message: 'Points must be an array' };
    }

    payload.points = body.points
      .map((point) => ({
        title: String(point?.title || '').trim(),
        body: String(point?.body || '').trim(),
      }))
      .filter((point) => point.title || point.body);
  }

  if (body.status !== undefined) {
    const status = String(body.status || '').trim().toLowerCase();
    if (!['active', 'inactive'].includes(status)) {
      return { valid: false, message: 'Status must be active or inactive' };
    }
    payload.status = status;
  }

  return { valid: true, payload };
}

async function listStaticPages(req, res) {
  try {
    const pages = await staticPagesService.listStaticPages({ includeInactive: true });
    return res.status(200).json({
      success: true,
      data: pages,
    });
  } catch (error) {
    console.error('List static pages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load static pages',
    });
  }
}

async function getStaticPage(req, res) {
  try {
    const page = await staticPagesService.getStaticPageByKey(req.params?.pageKey, {
      includeInactive: true,
    });

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: page,
    });
  } catch (error) {
    console.error('Get static page error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load static page',
    });
  }
}

async function updateStaticPage(req, res) {
  try {
    const validation = validatePayload(req.body || {});
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.message,
      });
    }

    const updated = await staticPagesService.updateStaticPage(
      req.params?.pageKey,
      validation.payload,
      req.user?.id || null
    );

    return res.status(200).json({
      success: true,
      message: 'Page updated successfully',
      data: updated,
    });
  } catch (error) {
    if (error.message === 'INVALID_PAGE_KEY') {
      return res.status(400).json({
        success: false,
        message: 'Invalid page key',
      });
    }

    if (error.message === 'TITLE_REQUIRED') {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
      });
    }

    if (error.message === 'CONTENT_REQUIRED') {
      return res.status(400).json({
        success: false,
        message: 'Content is required',
      });
    }

    console.error('Update static page error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update static page',
    });
  }
}

async function getPublicStaticPage(req, res) {
  try {
    const page = await staticPagesService.getStaticPageByKey(req.params?.pageKey, {
      includeInactive: false,
    });

    if (!page) {
      return res.status(404).json({
        success: false,
        message: 'Page not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: page,
    });
  } catch (error) {
    console.error('Get public static page error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load page content',
    });
  }
}

async function listPublicStaticPages(req, res) {
  try {
    const pages = await staticPagesService.listStaticPages({ includeInactive: false });
    return res.status(200).json({
      success: true,
      data: pages,
    });
  } catch (error) {
    console.error('List public static pages error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load page content',
    });
  }
}

module.exports = {
  getPublicStaticPage,
  getStaticPage,
  listPublicStaticPages,
  listStaticPages,
  updateStaticPage,
};
