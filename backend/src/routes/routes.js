const express = require('express');
const authMiddleware = require('../middleware/auth');
const routeController = require('../controllers/routeController');

const router = express.Router();

router.get('/', authMiddleware, routeController.listRoutes);
router.get('/:id', authMiddleware, routeController.getRoute);
router.post('/', authMiddleware, routeController.createRoute);
router.put('/:id', authMiddleware, routeController.updateRoute);
router.delete('/:id', authMiddleware, routeController.deleteRoute);
router.patch('/:id/favorite', authMiddleware, routeController.toggleFavorite);

module.exports = router;
