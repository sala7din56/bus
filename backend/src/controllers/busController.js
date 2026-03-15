const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/buses — Include route name
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
      include: { route: true, schedules: true },
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
    const { routeId, latitude, longitude, status, nextStopName } = req.body;
    const bus = await prisma.bus.create({
      data: { routeId, latitude, longitude, status, nextStopName },
      include: { route: { select: { name: true, colorHex: true } } },
    });
    res.status(201).json(bus);
  } catch (err) {
    console.error('Create bus error:', err);
    res.status(500).json({ error: 'Failed to create bus.' });
  }
};

// PUT /api/buses/:id — Also update lastUpdated
exports.updateBus = async (req, res) => {
  try {
    const { routeId, latitude, longitude, status, nextStopName } = req.body;
    const bus = await prisma.bus.update({
      where: { id: req.params.id },
      data: { routeId, latitude, longitude, status, nextStopName, lastUpdated: new Date() },
      include: { route: { select: { name: true, colorHex: true } } },
    });
    res.json(bus);
  } catch (err) {
    console.error('Update bus error:', err);
    res.status(500).json({ error: 'Failed to update bus.' });
  }
};

// DELETE /api/buses/:id
exports.deleteBus = async (req, res) => {
  try {
    await prisma.bus.delete({ where: { id: req.params.id } });
    res.json({ message: 'Bus deleted successfully.' });
  } catch (err) {
    console.error('Delete bus error:', err);
    res.status(500).json({ error: 'Failed to delete bus.' });
  }
};
