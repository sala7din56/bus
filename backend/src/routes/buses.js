const express = require('express');
const authMiddleware = require('../middleware/auth');
const busController = require('../controllers/busController');

const router = express.Router();

router.get('/', authMiddleware, busController.listBuses);
router.get('/:id', authMiddleware, busController.getBus);
router.post('/', authMiddleware, busController.createBus);
router.put('/:id', authMiddleware, busController.updateBus);
router.delete('/:id', authMiddleware, busController.deleteBus);

module.exports = router;
