const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const auth = require('../middlewares/auth');

router.use(auth);

router.get('/', notificationController.getList);
router.get('/unread-count', notificationController.getUnreadCount);
router.get('/unread-counts', notificationController.getUnreadCounts);
router.put('/:id/read', notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);

module.exports = router;
