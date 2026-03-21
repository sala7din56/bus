const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/activity
exports.listActivityLogs = async (req, res) => {
  try {
    const logs = await prisma.activityLog.findMany({
      include: { admin: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200
    });
    res.json(logs);
  } catch (err) {
    console.error('List activity logs error:', err);
    res.status(500).json({ error: 'Failed to fetch activity logs.' });
  }
};

// POST /api/activity (manual log entry — for client-side events)
exports.createActivityLog = async (req, res) => {
  try {
    const { action, entityType, entityId, entityName, detail } = req.body;
    if (!action || !entityType || !entityId || !entityName) {
      return res.status(400).json({ error: 'action, entityType, entityId, and entityName are required.' });
    }
    const log = await prisma.activityLog.create({
      data: {
        adminId: req.admin?.id || null,
        action,
        entityType,
        entityId,
        entityName,
        detail: detail || null
      }
    });
    res.status(201).json(log);
  } catch (err) {
    console.error('Create activity log error:', err);
    res.status(500).json({ error: 'Failed to create activity log.' });
  }
};
