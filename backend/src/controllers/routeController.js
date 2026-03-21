const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VALID_STATUSES = ['RUNNING', 'DELAYED', 'OUT_OF_SERVICE'];
const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;

// GET /api/routes
exports.listRoutes = async (req, res) => {
  try {
    const routes = await prisma.route.findMany({
      include: {
        _count: { select: { buses: true } },
        schedules: {
          include: { stop: true },
          orderBy: { arrivalTime: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(routes);
  } catch (err) {
    console.error('List routes error:', err);
    res.status(500).json({ error: 'Failed to fetch routes.' });
  }
};

// GET /api/routes/:id
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

// POST /api/routes
exports.createRoute = async (req, res) => {
  try {
    const { name, nameKurdish, colorHex, status, description, isFavorite, waypoints } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'name is required.' });
    }
    if (!nameKurdish || typeof nameKurdish !== 'string' || nameKurdish.trim() === '') {
      return res.status(400).json({ error: 'nameKurdish is required.' });
    }
    if (colorHex !== undefined && !HEX_REGEX.test(colorHex)) {
      return res.status(400).json({ error: 'colorHex must be a valid 6-digit hex color (e.g. #FF0000).' });
    }
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}.` });
    }

    const route = await prisma.route.create({
      data: {
        name: name.trim(),
        nameKurdish: nameKurdish.trim(),
        colorHex: colorHex || '#1877F2',
        status: status || 'RUNNING',
        description,
        isFavorite: isFavorite || false,
        waypoints: waypoints ? JSON.stringify(waypoints) : '[]'
      },
    });

    // Activity log
    await logActivity(req, 'CREATED', 'ROUTE', route.id, route.name);

    res.status(201).json(route);
  } catch (err) {
    console.error('Create route error:', err);
    res.status(500).json({ error: 'Failed to create route.' });
  }
};

// PUT /api/routes/:id
exports.updateRoute = async (req, res) => {
  try {
    const existing = await prisma.route.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Route not found.' });

    const { name, nameKurdish, colorHex, status, description, isFavorite, waypoints } = req.body;

    if (colorHex !== undefined && !HEX_REGEX.test(colorHex)) {
      return res.status(400).json({ error: 'colorHex must be a valid 6-digit hex color.' });
    }
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}.` });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (nameKurdish !== undefined) updateData.nameKurdish = nameKurdish.trim();
    if (colorHex !== undefined) updateData.colorHex = colorHex;
    if (status !== undefined) updateData.status = status;
    if (description !== undefined) updateData.description = description;
    if (isFavorite !== undefined) updateData.isFavorite = isFavorite;
    if (waypoints !== undefined) updateData.waypoints = JSON.stringify(waypoints);

    const route = await prisma.route.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await logActivity(req, 'UPDATED', 'ROUTE', route.id, route.name);
    res.json(route);
  } catch (err) {
    console.error('Update route error:', err);
    res.status(500).json({ error: 'Failed to update route.' });
  }
};

// DELETE /api/routes/:id
exports.deleteRoute = async (req, res) => {
  try {
    const existing = await prisma.route.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Route not found.' });

    await prisma.route.delete({ where: { id: req.params.id } });
    await logActivity(req, 'DELETED', 'ROUTE', req.params.id, existing.name);
    res.json({ message: 'Route deleted successfully.' });
  } catch (err) {
    console.error('Delete route error:', err);
    res.status(500).json({ error: 'Failed to delete route.' });
  }
};

// PATCH /api/routes/:id/favorite
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

async function logActivity(req, action, entityType, entityId, entityName, detail = null) {
  try {
    const adminId = req.admin?.id || null;
    await prisma.activityLog.create({
      data: { adminId, action, entityType, entityId, entityName, detail }
    });
  } catch (e) {
    // Non-critical - don't fail the request
    console.error('Activity log write failed:', e.message);
  }
}
