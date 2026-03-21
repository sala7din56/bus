const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/settings
exports.listSettings = async (req, res) => {
  try {
    const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    res.json(settings);
  } catch (err) {
    console.error('List settings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings.' });
  }
};

// PUT /api/settings/:key — upsert (safe create-or-update)
exports.upsertSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (value === undefined || value === null) {
      return res.status(400).json({ error: 'value is required.' });
    }

    const setting = await prisma.setting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) }
    });
    res.json(setting);
  } catch (err) {
    console.error('Upsert setting error:', err);
    res.status(500).json({ error: 'Failed to save setting.' });
  }
};

// DELETE /api/settings/:key
exports.deleteSetting = async (req, res) => {
  try {
    const existing = await prisma.setting.findUnique({ where: { key: req.params.key } });
    if (!existing) return res.status(404).json({ error: 'Setting not found.' });
    await prisma.setting.delete({ where: { key: req.params.key } });
    res.json({ message: 'Setting deleted.' });
  } catch (err) {
    console.error('Delete setting error:', err);
    res.status(500).json({ error: 'Failed to delete setting.' });
  }
};
