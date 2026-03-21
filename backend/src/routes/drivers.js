const express = require('express');
const authMiddleware = require('../middleware/auth');
const driverController = require('../controllers/driverController');

const router = express.Router();

router.use(authMiddleware);

router.get('/stats', driverController.getDriverStats);
router.get('/licenses/expiring', driverController.getExpiringLicenses);
router.get('/', driverController.getAllDrivers);
router.get('/:id', driverController.getDriverById);
router.post('/', driverController.createDriver);
router.put('/:id', driverController.updateDriver);
router.delete('/:id', driverController.deleteDriver);
router.patch('/:id/status', driverController.updateDriverStatus);
router.patch('/:id/assign-route', driverController.assignDriverToRoute);
router.patch('/:id/assign-bus', driverController.assignDriverToBus);

module.exports = router;
