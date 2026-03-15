const express = require('express');
const authMiddleware = require('../middleware/auth');
const stopController = require('../controllers/stopController');

const router = express.Router();

router.get('/', authMiddleware, stopController.listStops);
router.get('/:id', authMiddleware, stopController.getStop);
router.post('/', authMiddleware, stopController.createStop);
router.put('/:id', authMiddleware, stopController.updateStop);
router.delete('/:id', authMiddleware, stopController.deleteStop);

module.exports = router;
