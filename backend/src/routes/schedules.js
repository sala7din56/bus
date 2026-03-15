const express = require('express');
const authMiddleware = require('../middleware/auth');
const scheduleController = require('../controllers/scheduleController');

const router = express.Router();

router.get('/', authMiddleware, scheduleController.listSchedules);
router.get('/:id', authMiddleware, scheduleController.getSchedule);
router.post('/', authMiddleware, scheduleController.createSchedule);
router.put('/:id', authMiddleware, scheduleController.updateSchedule);
router.delete('/:id', authMiddleware, scheduleController.deleteSchedule);

module.exports = router;
