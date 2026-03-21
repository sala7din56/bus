const express = require('express');
const router = express.Router();
const depotController = require('../controllers/depotController');
const auth = require('../middleware/auth');

router.get('/', auth, depotController.listDepots);
router.get('/:id', auth, depotController.getDepot);
router.post('/', auth, depotController.createDepot);
router.put('/:id', auth, depotController.updateDepot);
router.delete('/:id', auth, depotController.deleteDepot);

module.exports = router;
