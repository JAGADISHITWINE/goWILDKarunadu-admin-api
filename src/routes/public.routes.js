const router = require('express').Router();
const staticPagesController = require('../controllers/staticPages.controller');

router.get('/pages', staticPagesController.listPublicStaticPages);
router.get('/pages/:pageKey', staticPagesController.getPublicStaticPage);

module.exports = router;
