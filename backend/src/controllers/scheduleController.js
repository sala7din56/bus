const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TIME_REGEX = /^([0-1]\d|2[0-3]):[0-5]\d$/;

// GET /api/schedules
exports.listSchedules = async (req, res) => {
  try {
    const schedules = await prisma.schedule.findMany({
      include: {
        route: { select: { name: true, nameKurdish: true, colorHex: true } },
        stop: { select: { name: true } },
        bus: { select: { id: true } },
      },
      orderBy: { route: { name: 'asc' } },
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
    const { stopId, routeId, busId, arrivalTime, isRealtime, dayOfWeek } = req.body;

    if (!routeId) return res.status(400).json({ error: 'routeId is required.' });
    if (!stopId) return res.status(400).json({ error: 'stopId is required.' });
    if (!arrivalTime) return res.status(400).json({ error: 'arrivalTime is required.' });
    if (!TIME_REGEX.test(arrivalTime)) {
      return res.status(400).json({ error: 'arrivalTime must be in HH:MM format (e.g. 08:30).' });
    }

    // Verify foreign keys exist
    const [route, stop] = await Promise.all([
      prisma.route.findUnique({ where: { id: routeId } }),
      prisma.stop.findUnique({ where: { id: stopId } })
    ]);
    if (!route) return res.status(400).json({ error: 'routeId does not reference an existing route.' });
    if (!stop) return res.status(400).json({ error: 'stopId does not reference an existing stop.' });

    const schedule = await prisma.schedule.create({
      data: { stopId, routeId, busId: busId || null, arrivalTime, isRealtime: isRealtime || false, dayOfWeek: dayOfWeek || null },
      include: {
        route: { select: { name: true, nameKurdish: true } },
        stop: { select: { name: true } },
        bus: { select: { id: true } },
      },
    });

    await logActivity(req, 'CREATED', 'SCHEDULE', schedule.id, `${route.name} @ ${stop.name}`);
    res.status(201).json(schedule);
  } catch (err) {
    console.error('Create schedule error:', err);
    res.status(500).json({ error: 'Failed to create schedule.' });
  }
};

// PUT /api/schedules/:id
exports.updateSchedule = async (req, res) => {
  try {
    const existing = await prisma.schedule.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Schedule not found.' });

    const { stopId, routeId, busId, arrivalTime, isRealtime, dayOfWeek } = req.body;

    if (arrivalTime !== undefined && !TIME_REGEX.test(arrivalTime)) {
      return res.status(400).json({ error: 'arrivalTime must be in HH:MM format.' });
    }

    const updateData = {};
    if (stopId !== undefined) updateData.stopId = stopId;
    if (routeId !== undefined) updateData.routeId = routeId;
    if (busId !== undefined) updateData.busId = busId;
    if (arrivalTime !== undefined) updateData.arrivalTime = arrivalTime;
    if (isRealtime !== undefined) updateData.isRealtime = isRealtime;
    if (dayOfWeek !== undefined) updateData.dayOfWeek = dayOfWeek;

    const schedule = await prisma.schedule.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        route: { select: { name: true, nameKurdish: true } },
        stop: { select: { name: true } },
        bus: { select: { id: true } },
      },
    });

    await logActivity(req, 'UPDATED', 'SCHEDULE', schedule.id, schedule.id.slice(-6));
    res.json(schedule);
  } catch (err) {
    console.error('Update schedule error:', err);
    res.status(500).json({ error: 'Failed to update schedule.' });
  }
};

// DELETE /api/schedules/:id
exports.deleteSchedule = async (req, res) => {
  try {
    const existing = await prisma.schedule.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Schedule not found.' });

    await prisma.schedule.delete({ where: { id: req.params.id } });
    await logActivity(req, 'DELETED', 'SCHEDULE', req.params.id, req.params.id.slice(-6));
    res.json({ message: 'Schedule deleted successfully.' });
  } catch (err) {
    console.error('Delete schedule error:', err);
    res.status(500).json({ error: 'Failed to delete schedule.' });
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
