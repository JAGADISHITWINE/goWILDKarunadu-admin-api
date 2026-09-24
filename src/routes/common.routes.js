const router = require('express').Router();
const auth = require('../controllers/auth.controller');
const user = require('../controllers/user.controller');
const trek = require('../controllers/trek.controlller');
const analytics = require('../controllers/analytics.controller');
const booking = require('../controllers/booking.controller');
const notifications = require('../controllers/notifications.controller');
const dropdown = require('../controllers/dropdown.controller');
const rbac = require('../controllers/rbac.controller');
const admins = require('../controllers/admins.controller');
const coupon = require('../controllers/coupon.controller');
const postEditorController = require('../controllers/postEditor.controller');
const categoryController = require('../controllers/category.controller');
const referralSettings = require('../controllers/referralSettings.controller');
const audit = require('../controllers/audit.controller');
const staticPagesController = require('../controllers/staticPages.controller');
const paymentsController = require('../controllers/payments.controller');
const operationsController = require('../controllers/operations.controller');
const reviewsController = require('../controllers/reviews.controller');
const upload = require('../middleware/upload.middleware');
const uploadPost = require('../middleware/uploadPost');

function handleUploadFields(fields) {
  const middleware = upload.fields(fields);
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) {
        console.error('[Upload] trek upload middleware error:', err);
        return res.status(400).json({
          success: false,
          message: err?.message || 'Failed to process trek upload',
          error: err?.stack || String(err),
        });
      }

      return next();
    });
  };
}

function handleSingleUpload(fieldName) {
  const middleware = uploadPost.single(fieldName);
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (err) {
        console.error('[Upload] post upload middleware error:', err);
        return res.status(400).json({
          success: false,
          message: err?.message || 'Failed to process post upload',
          error: err?.stack || String(err),
        });
      }

      return next();
    });
  };
}

/* ---------- AUTH ---------- */
router.post('/login', auth.login);
router.post('/logout', auth.logout);

// All routes after this require authentication (cookie or Authorization header)
const authMiddleware = require('../middleware/auth.middleware');
const { requirePermission } = require('../middleware/permission.middleware');
router.use(authMiddleware);

router.get('/dashData', auth.getDashboardData);
router.get('/me', auth.me);
router.get('/audit-logs', requirePermission('operations.view'), audit.getAuditLogs);
router.get('/rbac/table', rbac.getRbacTable);
router.put('/rbac/table', requirePermission('rbac.manage'), rbac.updateRbacTable);
router.post('/admins', requirePermission('rbac.manage'), admins.createAdminWithRole);
router.get('/coupons', requirePermission('treks.view'), coupon.getCoupons);
router.post('/coupons', requirePermission('treks.manage'), coupon.createCoupon);
router.get('/coupons/:id/usage', requirePermission('treks.view'), coupon.getCouponUsage);
router.put('/coupons/:id', requirePermission('treks.manage'), coupon.updateCoupon);
router.delete('/coupons/:id', requirePermission('treks.manage'), coupon.deleteCoupon);

/* ---------- USERS ---------- */
router.get('/getUsers', user.getUsersData);
router.get('/user/:userid/getUserById', user.getUserById);

/* ---------- TREKS ---------- */
router.post(
  '/createTrek',
  handleUploadFields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'gallery', maxCount: 10 },
  ]),
  trek.createTrek
);

router.get('/getAllTreks', trek.getAllTreks);
router.get('/getTrekById/:id', trek.getTrekById);
router.get('/getTrekByIdToUpdate/:id', trek.getTrekByIdToUpdate);
router.get('/treks/:trekId/batches', trek.getBatchesById);
router.get('/batches/:batchId/bookings', trek.getBookingsById);
router.patch('/batches/:batchId/stop-booking', trek.stopBooking);
router.patch('/batches/:batchId/resume-booking', trek.resumeBooking);
router.get('/batches/:batchId/export-bookings', trek.exportBookings);
router.get('/treks/:trekId/export-all-bookings', trek.exportallBookings);
router.get('/treks', trek.getTreks);

router.post(
  '/treks/:id',
  handleUploadFields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'gallery', maxCount: 10 }
  ]),
  trek.updateTrek
);

/* ---------- ANALYTICS + BOOKINGS ---------- */
router.get('/revenue', analytics.getAllRevenueData);
router.get('/bookingData', booking.getAllBookingData);
router.get('/bookings/completion-stats', booking.updateCompletedBookings);
router.patch('/bookings/bulk-status', requirePermission('bookings.manage'), booking.updateBulkBookingStatus);
router.get('/bookings/:id', requirePermission('bookings.view'), booking.getBookingById);
router.patch('/bookings/:id/status', requirePermission('bookings.manage'), booking.updateBookingStatus);
router.put('/batches/:batchId/complete', booking.updateBatchCompleted);
router.post('/batches/auto-complete-sweep', booking.runAutoCompleteSweep);
router.get('/batches/auto-complete-status', booking.getAutoCompleteStatus);

/* ---------- DROPDOWNS + NOTIFICATIONS ---------- */
router.get('/dropdowns', dropdown.getDropdownOptions);
router.get('/dropdowns/batches', dropdown.getBatchDropdown);
router.get('/dropdowns/manage', requirePermission('dropdowns.manage'), dropdown.getDropdownManagementGroups);
router.post('/dropdowns/groups', requirePermission('dropdowns.manage'), dropdown.createDropdownGroup);
router.put('/dropdowns/groups/:id', requirePermission('dropdowns.manage'), dropdown.updateDropdownGroup);
router.delete('/dropdowns/groups/:id', requirePermission('dropdowns.manage'), dropdown.deleteDropdownGroup);
router.post('/dropdowns/options', requirePermission('dropdowns.manage'), dropdown.createDropdownOption);
router.put('/dropdowns/options/:id', requirePermission('dropdowns.manage'), dropdown.updateDropdownOption);
router.delete('/dropdowns/options/:id', requirePermission('dropdowns.manage'), dropdown.deleteDropdownOption);
router.get('/notifications', notifications.getNotifications);
router.post('/notifications/read-all', notifications.markAllNotificationsRead);
router.post('/notifications/read', notifications.markNotificationRead);
router.get('/referrals/settings', requirePermission('referrals.manage'), referralSettings.getReferralSettings);
router.put('/referrals/settings', requirePermission('referrals.manage'), referralSettings.updateReferralSettings);

/* ---------- STATIC PAGES ---------- */
router.get('/static-pages', requirePermission('blog.manage'), staticPagesController.listStaticPages);
router.get('/static-pages/:pageKey', requirePermission('blog.manage'), staticPagesController.getStaticPage);
router.put('/static-pages/:pageKey', requirePermission('blog.manage'), staticPagesController.updateStaticPage);

/* ---------- POSTS ---------- */
router.get('/postEditor', requirePermission('blog.view'), postEditorController.getAllPosts);
router.get('/postEditor/:id', requirePermission('blog.view'), postEditorController.getPostById);
router.post(
  '/postEditor',
  requirePermission('blog.manage'),
  handleSingleUpload('image'),
  postEditorController.createPost
);
router.post('/postEditor/:id', requirePermission('blog.manage'), handleSingleUpload('image'), postEditorController.updatePost);
router.delete('/postEditor/:id', requirePermission('blog.manage'), postEditorController.deletePost);

/* ---------- CATEGORIES + REVIEWS ---------- */
router.get('/categories', requirePermission('blog.view'), categoryController.getCategories);
router.get('/categories/manage', requirePermission('dropdowns.manage'), categoryController.getCategoriesManagement);
router.post('/categories', requirePermission('dropdowns.manage'), categoryController.createCategory);
router.put('/categories/:id', requirePermission('dropdowns.manage'), categoryController.updateCategory);
router.delete('/categories/:id', requirePermission('dropdowns.manage'), categoryController.deleteCategory);

// Reviews & Ratings Moderation
router.get('/reviews', requirePermission('reviews.view'), reviewsController.getAllReviews);
router.patch('/reviews/:id/status', requirePermission('reviews.manage'), reviewsController.updateReviewStatus);
router.post('/reviews/:id/reply', requirePermission('reviews.manage'), reviewsController.replyToReview);
// Payments & Refunds
router.get('/payments', requirePermission('operations.view'), paymentsController.listPayments);
router.get('/payments/methods', paymentsController.getPaymentMethods);
router.get('/payments/refunds', requirePermission('operations.view'), paymentsController.listRefunds);
router.get('/payments/reconcile', requirePermission('operations.view'), paymentsController.reconcilePayments);
router.post('/bookings/:bookingId/refund', requirePermission('bookings.manage'), paymentsController.processRefund);
router.put('/bookings/:bookingId/payment', requirePermission('bookings.manage'), paymentsController.updateBookingPayment);

// Basecamp Operations, Check-in, Manifest, Gear, Batch P&L, Royalty & Remainder Collection
router.post('/operations/checkin', operationsController.recordCheckin);
router.get('/operations/checkin/batch/:batchId', operationsController.getBatchCheckins);
router.get('/bookings/:bookingId/participants', operationsController.getBookingParticipants);
router.post('/bookings/:bookingId/participants', operationsController.saveBookingParticipants);
router.get('/operations/gear', operationsController.listGearInventory);
router.post('/operations/gear', operationsController.upsertGearItem);
router.get('/operations/batches/:batchId/pnl', operationsController.getBatchPnl);
router.post('/operations/batches/:batchId/expenses', operationsController.addBatchExpense);
router.post('/operations/broadcast/advisory', operationsController.broadcastTrailAdvisory);
router.post('/operations/collect-remainder', operationsController.collectRemainderPayment);
router.get('/operations/royalty-ledger', operationsController.getForestRoyaltyLedger);
router.post('/operations/journey/dispatch', operationsController.dispatchJourneyNotification);

// Brand & System Settings Configuration
router.get('/settings', operationsController.getSettings);
router.put('/settings', operationsController.updateSettings);

module.exports = router;
