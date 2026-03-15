const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/stops
exports.listStops = async (req, res) => {
  try {
    const stops = await prisma.stop.findMany({ orderBy: { createdAt: 'desc' } });
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
    const { name, latitude, longitude } = req.body;
    const stop = await prisma.stop.create({
      data: { name, latitude, longitude },
    });
    res.status(201).json(stop);
  } catch (err) {
    console.error('Create stop error:', err);
    res.status(500).json({ error: 'Failed to create stop.' });
  }
};

// PUT /api/stops/:id
exports.updateStop = async (req, res) => {
  try {
    const { name, latitude, longitude } = req.body;
    const stop = await prisma.stop.update({
      where: { id: req.params.id },
      data: { name, latitude, longitude },
    });
    res.json(stop);
  } catch (err) {
    console.error('Update stop error:', err);
    res.status(500).json({ error: 'Failed to update stop.' });
  }
};

// DELETE /api/stops/:id
exports.deleteStop = async (req, res) => {
  try {
    await prisma.stop.delete({ where: { id: req.params.id } });
    res.json({ message: 'Stop deleted successfully.' });
  } catch (err) {
    console.error('Delete stop error:', err);
    res.status(500).json({ error: 'Failed to delete stop.' });
  }
};
