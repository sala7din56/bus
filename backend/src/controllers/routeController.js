const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/routes — List all routes with bus count
exports.listRoutes = async (req, res) => {
  try {
    const routes = await prisma.route.findMany({
      include: { _count: { select: { buses: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(routes);
  } catch (err) {
    console.error('List routes error:', err);
    res.status(500).json({ error: 'Failed to fetch routes.' });
  }
};

// GET /api/routes/:id — Single route with buses and schedules
exports.getRoute = async (req, res) => {
  try {
    const route = await prisma.route.findUnique({
      where: { id: req.params.id },
      include: { buses: true, schedules: { include: { stop: true } } },
    });
    if (!route) return res.status(404).json({ error: 'Route not found.' });
    res.json(route);
  } catch (err) {
    console.error('Get route error:', err);
    res.status(500).json({ error: 'Failed to fetch route.' });
  }
};

// POST /api/routes — Create route
exports.createRoute = async (req, res) => {
  try {
    const { name, nameKurdish, colorHex, status, description, isFavorite } = req.body;
    const route = await prisma.route.create({
      data: { name, nameKurdish, colorHex, status, description, isFavorite },
    });
    res.status(201).json(route);
  } catch (err) {
    console.error('Create route error:', err);
    res.status(500).json({ error: 'Failed to create route.' });
  }
};

// PUT /api/routes/:id — Update route
exports.updateRoute = async (req, res) => {
  try {
    const { name, nameKurdish, colorHex, status, description, isFavorite } = req.body;
    const route = await prisma.route.update({
      where: { id: req.params.id },
      data: { name, nameKurdish, colorHex, status, description, isFavorite },
    });
    res.json(route);
  } catch (err) {
    console.error('Update route error:', err);
    res.status(500).json({ error: 'Failed to update route.' });
  }
};

// DELETE /api/routes/:id — Delete route
exports.deleteRoute = async (req, res) => {
  try {
    await prisma.route.delete({ where: { id: req.params.id } });
    res.json({ message: 'Route deleted successfully.' });
  } catch (err) {
    console.error('Delete route error:', err);
    res.status(500).json({ error: 'Failed to delete route.' });
  }
};

// PATCH /api/routes/:id/favorite — Toggle isFavorite
exports.toggleFavorite = async (req, res) => {
  try {
    const route = await prisma.route.findUnique({ where: { id: req.params.id } });
    if (!route) return res.status(404).json({ error: 'Route not found.' });
    const updated = await prisma.route.update({
      where: { id: req.params.id },
      data: { isFavorite: !route.isFavorite },
    });
    res.json(updated);
  } catch (err) {
    console.error('Toggle favorite error:', err);
    res.status(500).json({ error: 'Failed to toggle favorite.' });
  }
};
