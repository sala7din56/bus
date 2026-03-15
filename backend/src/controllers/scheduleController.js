const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/schedules — Include route name, stop name, bus id
exports.listSchedules = async (req, res) => {
  try {
    const schedules = await prisma.schedule.findMany({
      include: {
        route: { select: { name: true, nameKurdish: true } },
        stop: { select: { name: true } },
        bus: { select: { id: true } },
      },
      orderBy: { 
        route: { name: 'asc' }
      },
    });
    res.json(schedules);
  } catch (err) {
    console.error('List schedules error:', err);
    res.status(500).json({ error: 'Failed to fetch schedules.' });
  }
};

// GET /api/schedules/:id
exports.getSchedule = async (req, res) => {
  try {
    const schedule = await prisma.schedule.findUnique({
      where: { id: req.params.id },
      include: { route: true, stop: true, bus: true },
    });
    if (!schedule) return res.status(404).json({ error: 'Schedule not found.' });
    res.json(schedule);
  } catch (err) {
    console.error('Get schedule error:', err);
    res.status(500).json({ error: 'Failed to fetch schedule.' });
  }
};

// POST /api/schedules
exports.createSchedule = async (req, res) => {
  try {
    const { stopId, routeId, busId, arrivalTime, isRealtime } = req.body;
    const schedule = await prisma.schedule.create({
      data: { stopId, routeId, busId, arrivalTime, isRealtime },
      include: {
        route: { select: { name: true, nameKurdish: true } },
        stop: { select: { name: true } },
        bus: { select: { id: true } },
      },
    });
    res.status(201).json(schedule);
  } catch (err) {
    console.error('Create schedule error:', err);
    res.status(500).json({ error: 'Failed to create schedule.' });
  }
};

// PUT /api/schedules/:id
exports.updateSchedule = async (req, res) => {
  try {
    const { stopId, routeId, busId, arrivalTime, isRealtime } = req.body;
    const schedule = await prisma.schedule.update({
      where: { id: req.params.id },
      data: { stopId, routeId, busId, arrivalTime, isRealtime },
      include: {
        route: { select: { name: true, nameKurdish: true } },
        stop: { select: { name: true } },
        bus: { select: { id: true } },
      },
    });
    res.json(schedule);
  } catch (err) {
    console.error('Update schedule error:', err);
    res.status(500).json({ error: 'Failed to update schedule.' });
  }
};

// DELETE /api/schedules/:id
exports.deleteSchedule = async (req, res) => {
  try {
    await prisma.schedule.delete({ where: { id: req.params.id } });
    res.json({ message: 'Schedule deleted successfully.' });
  } catch (err) {
    console.error('Delete schedule error:', err);
    res.status(500).json({ error: 'Failed to delete schedule.' });
  }
};
