const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// List all depots
exports.listDepots = async (req, res) => {
  try {
    const depots = await prisma.depot.findMany({
      include: {
        _count: {
          select: { buses: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(depots);
  } catch (err) {
    console.error('List depots error:', err);
    res.status(500).json({ error: 'Failed to fetch depots.' });
  }
};

// Get a single depot with its buses
exports.getDepot = async (req, res) => {
  try {
    const depot = await prisma.depot.findUnique({
      where: { id: req.params.id },
      include: {
        buses: {
          include: {
            route: true
          }
        }
      }
    });
    if (!depot) return res.status(404).json({ error: 'Depot not found.' });
    res.json(depot);
  } catch (err) {
    console.error('Get depot error:', err);
    res.status(500).json({ error: 'Failed to fetch depot.' });
  }
};

// Create a depot
exports.createDepot = async (req, res) => {
  try {
    const depot = await prisma.depot.create({
      data: req.body
    });
    res.status(201).json(depot);
  } catch (err) {
    console.error('Create depot error:', err);
    res.status(500).json({ error: 'Failed to create depot.' });
  }
};

// Update a depot
exports.updateDepot = async (req, res) => {
  try {
    const depot = await prisma.depot.update({
      where: { id: req.params.id },
      data: req.body
    });
    res.json(depot);
  } catch (err) {
    console.error('Update depot error:', err);
    res.status(500).json({ error: 'Failed to update depot.' });
  }
};

// Delete a depot
exports.deleteDepot = async (req, res) => {
  try {
    await prisma.depot.delete({
      where: { id: req.params.id }
    });
    res.json({ message: 'Depot deleted successfully.' });
  } catch (err) {
    console.error('Delete depot error:', err);
    res.status(500).json({ error: 'Failed to delete depot.' });
  }
};
