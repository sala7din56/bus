const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VALID_STATUSES = ['RUNNING', 'DELAYED', 'OUT_OF_SERVICE'];
const MIN_LAT = 35, MAX_LAT = 38, MIN_LNG = 43, MAX_LNG = 46;

// GET /api/buses
exports.listBuses = async (req, res) => {
  try {
    const buses = await prisma.bus.findMany({
      include: { route: { select: { name: true, colorHex: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(buses);
  } catch (err) {
    console.error('List buses error:', err);
    res.status(500).json({ error: 'Failed to fetch buses.' });
  }
};

// GET /api/buses/:id
exports.getBus = async (req, res) => {
  try {
    const bus = await prisma.bus.findUnique({
      where: { id: req.params.id },
      include: { route: true, schedules: true, depot: true },
    });
    if (!bus) return res.status(404).json({ error: 'Bus not found.' });
    res.json(bus);
  } catch (err) {
    console.error('Get bus error:', err);
    res.status(500).json({ error: 'Failed to fetch bus.' });
  }
};

// POST /api/buses
exports.createBus = async (req, res) => {
  try {
    const { routeId, depotId, latitude, longitude, status, nextStopName } = req.body;

    if (latitude !== undefined && (latitude < MIN_LAT || latitude > MAX_LAT)) {
      return res.status(400).json({ error: `latitude must be between ${MIN_LAT} and ${MAX_LAT}.` });
    }
    if (longitude !== undefined && (longitude < MIN_LNG || longitude > MAX_LNG)) {
      return res.status(400).json({ error: `longitude must be between ${MIN_LNG} and ${MAX_LNG}.` });
    }
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}.` });
    }

    const bus = await prisma.bus.create({
      data: {
        routeId: routeId || null,
        depotId: depotId || null,
        latitude: latitude || 36.1901,
        longitude: longitude || 44.0089,
        status: status || 'RUNNING',
        nextStopName: nextStopName || null,
        lastUpdated: new Date()
      },
      include: { route: { select: { name: true, colorHex: true } } },
    });

    await logActivity(req, 'CREATED', 'BUS', bus.id, bus.id.slice(-6).toUpperCase());
    res.status(201).json(bus);
  } catch (err) {
    console.error('Create bus error:', err);
    res.status(500).json({ error: 'Failed to create bus.' });
  }
};

// PUT /api/buses/:id
exports.updateBus = async (req, res) => {
  try {
    const existing = await prisma.bus.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Bus not found.' });

    const { routeId, depotId, latitude, longitude, status, nextStopName } = req.body;

    if (latitude !== undefined && (latitude < MIN_LAT || latitude > MAX_LAT)) {
      return res.status(400).json({ error: `latitude must be between ${MIN_LAT} and ${MAX_LAT}.` });
    }
    if (longitude !== undefined && (longitude < MIN_LNG || longitude > MAX_LNG)) {
      return res.status(400).json({ error: `longitude must be between ${MIN_LNG} and ${MAX_LNG}.` });
    }
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(', ')}.` });
    }

    const updateData = { lastUpdated: new Date() };
    if (routeId !== undefined) updateData.routeId = routeId;
    if (depotId !== undefined) updateData.depotId = depotId;
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (status !== undefined) updateData.status = status;
    if (nextStopName !== undefined) updateData.nextStopName = nextStopName;

    const bus = await prisma.bus.update({
      where: { id: req.params.id },
      data: updateData,
      include: { route: { select: { name: true, colorHex: true } } },
    });

    await logActivity(req, 'UPDATED', 'BUS', bus.id, bus.id.slice(-6).toUpperCase());
    res.json(bus);
  } catch (err) {
    console.error('Update bus error:', err);
    res.status(500).json({ error: 'Failed to update bus.' });
  }
};

// DELETE /api/buses/:id
exports.deleteBus = async (req, res) => {
  try {
    const existing = await prisma.bus.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Bus not found.' });

    await prisma.bus.delete({ where: { id: req.params.id } });
    await logActivity(req, 'DELETED', 'BUS', req.params.id, req.params.id.slice(-6).toUpperCase());
    res.json({ message: 'Bus deleted successfully.' });
  } catch (err) {
    console.error('Delete bus error:', err);
    res.status(500).json({ error: 'Failed to delete bus.' });
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
