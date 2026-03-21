const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const MIN_LAT = 35, MAX_LAT = 38, MIN_LNG = 43, MAX_LNG = 46;

// GET /api/stops
exports.listStops = async (req, res) => {
  try {
    const stops = await prisma.stop.findMany({ orderBy: { name: 'asc' } });
    res.json(stops);
  } catch (err) {
    console.error('List stops error:', err);
    res.status(500).json({ error: 'Failed to fetch stops.' });
  }
};

// GET /api/stops/:id
exports.getStop = async (req, res) => {
  try {
    const stop = await prisma.stop.findUnique({
      where: { id: req.params.id },
      include: { schedules: true },
    });
    if (!stop) return res.status(404).json({ error: 'Stop not found.' });
    res.json(stop);
  } catch (err) {
    console.error('Get stop error:', err);
    res.status(500).json({ error: 'Failed to fetch stop.' });
  }
};

// POST /api/stops
exports.createStop = async (req, res) => {
  try {
    const { name, nameKurdish, latitude, longitude } = req.body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'name is required.' });
    }
    if (latitude === undefined || latitude === null) {
      return res.status(400).json({ error: 'latitude is required.' });
    }
    if (longitude === undefined || longitude === null) {
      return res.status(400).json({ error: 'longitude is required.' });
    }
    if (latitude < MIN_LAT || latitude > MAX_LAT) {
      return res.status(400).json({ error: `latitude must be between ${MIN_LAT} and ${MAX_LAT}.` });
    }
    if (longitude < MIN_LNG || longitude > MAX_LNG) {
      return res.status(400).json({ error: `longitude must be between ${MIN_LNG} and ${MAX_LNG}.` });
    }

    const stop = await prisma.stop.create({
      data: {
        name: name.trim(),
        nameKurdish: nameKurdish?.trim() || '',
        latitude,
        longitude
      },
    });

    await logActivity(req, 'CREATED', 'STOP', stop.id, stop.name);
    res.status(201).json(stop);
  } catch (err) {
    console.error('Create stop error:', err);
    res.status(500).json({ error: 'Failed to create stop.' });
  }
};

// PUT /api/stops/:id
exports.updateStop = async (req, res) => {
  try {
    const existing = await prisma.stop.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Stop not found.' });

    const { name, nameKurdish, latitude, longitude } = req.body;

    if (latitude !== undefined && (latitude < MIN_LAT || latitude > MAX_LAT)) {
      return res.status(400).json({ error: `latitude must be between ${MIN_LAT} and ${MAX_LAT}.` });
    }
    if (longitude !== undefined && (longitude < MIN_LNG || longitude > MAX_LNG)) {
      return res.status(400).json({ error: `longitude must be between ${MIN_LNG} and ${MAX_LNG}.` });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (nameKurdish !== undefined) updateData.nameKurdish = nameKurdish.trim();
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;

    const stop = await prisma.stop.update({
      where: { id: req.params.id },
      data: updateData,
    });

    await logActivity(req, 'UPDATED', 'STOP', stop.id, stop.name);
    res.json(stop);
  } catch (err) {
    console.error('Update stop error:', err);
    res.status(500).json({ error: 'Failed to update stop.' });
  }
};

// DELETE /api/stops/:id
exports.deleteStop = async (req, res) => {
  try {
    const existing = await prisma.stop.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Stop not found.' });

    await prisma.stop.delete({ where: { id: req.params.id } });
    await logActivity(req, 'DELETED', 'STOP', req.params.id, existing.name);
    res.json({ message: 'Stop deleted successfully.' });
  } catch (err) {
    console.error('Delete stop error:', err);
    res.status(500).json({ error: 'Failed to delete stop.' });
  }
};

async function logActivity(req, action, entityType, entityId, entityName, detail = null) {
  try {
    const adminId = req.admin?.id || null;
    await prisma.activityLog.create({
      data: { adminId, action, entityType, entityId, entityName, detail }
    });
  } catch (e) {
    console.error('Activity log write failed:', e.message);
  }
}
