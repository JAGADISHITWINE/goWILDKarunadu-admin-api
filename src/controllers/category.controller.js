const categoryService = require('../service/category.service');

async function getCategories(req, res) {
  try {
    const categories = await categoryService.listActiveCategories();
    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Get categories error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
    });
  }
}

async function getCategoriesManagement(req, res) {
  try {
    const categories = await categoryService.listAllCategories();
    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Get category management error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch category management data',
    });
  }
}

async function createCategory(req, res) {
  try {
    const created = await categoryService.createCategory(req.body || {});
    return res.status(201).json({
      success: true,
      message: 'Category created',
      data: created,
    });
  } catch (error) {
    if (error.message === 'CATEGORY_NAME_REQUIRED') {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    if (error.message === 'CATEGORY_ALREADY_EXISTS') {
      return res.status(409).json({ success: false, message: 'Category already exists' });
    }
    console.error('Create category error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create category',
    });
  }
}

async function updateCategory(req, res) {
  try {
    const updated = await categoryService.updateCategory(req.params?.id, req.body || {});
    return res.status(200).json({
      success: true,
      message: 'Category updated',
      data: updated,
    });
  } catch (error) {
    if (error.message === 'INVALID_CATEGORY_ID') {
      return res.status(400).json({ success: false, message: 'Invalid category id' });
    }
    if (error.message === 'CATEGORY_NAME_REQUIRED') {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    if (error.message === 'CATEGORY_ALREADY_EXISTS') {
      return res.status(409).json({ success: false, message: 'Category already exists' });
    }
    if (error.message === 'CATEGORY_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    if (error.message === 'NO_CATEGORY_FIELDS') {
      return res.status(400).json({ success: false, message: 'No fields provided for update' });
    }
    console.error('Update category error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update category',
    });
  }
}

async function deleteCategory(req, res) {
  try {
    await categoryService.deleteCategoryPermanently(req.params?.id);
    return res.status(200).json({
      success: true,
      message: 'Category deleted',
    });
  } catch (error) {
    if (error.message === 'INVALID_CATEGORY_ID') {
      return res.status(400).json({ success: false, message: 'Invalid category id' });
    }
    if (error.message === 'CATEGORY_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    console.error('Delete category error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete category',
    });
  }
}

module.exports = {
  getCategories,
  getCategoriesManagement,
  createCategory,
  updateCategory,
  deleteCategory,
};
