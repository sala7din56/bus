require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const routeRoutes = require('./routes/routes');
const stopRoutes = require('./routes/stops');
const busRoutes = require('./routes/buses');
const scheduleRoutes = require('./routes/schedules');
const depotRoutes = require('./routes/depots');
const activityRoutes = require('./routes/activity');
const settingsRoutes = require('./routes/settings');
const driverRoutes = require('./routes/drivers');
const authMiddleware = require('./middleware/auth');

const app = express();
const prisma = new PrismaClient();
if (process.env.NODE_ENV !== 'test') {
  require('./simulator');
}
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/stops', stopRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/depots', depotRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/drivers', driverRoutes);

// Dashboard Stats
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const [totalRoutes, activeBuses, totalStops, delayedBuses, recentRoutes, totalDrivers, activeDrivers, driversOnLeave, licensesExpiringSoon] = await Promise.all([
      prisma.route.count(),
      prisma.bus.count({ where: { status: 'RUNNING' } }),
      prisma.stop.count(),
      prisma.bus.count({ where: { status: 'DELAYED' } }),
      prisma.route.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { buses: true } } },
      }),
      prisma.driver.count(),
      prisma.driver.count({ where: { status: 'ACTIVE' } }),
      prisma.driver.count({ where: { status: 'ON_LEAVE' } }),
      prisma.driver.count({
        where: {
          licenseExpiry: {
            lte: new Date(new Date().setDate(new Date().getDate() + 30)),
            gt: new Date()
          }
        }
      })
    ]);

    res.json({
      totalRoutes,
      activeBuses,
      totalStops,
      delayedBuses,
      recentRoutes,
      totalDrivers,
      activeDrivers,
      driversOnLeave,
      licensesExpiringSoon
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats.' });
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// Only start listening when run directly (not when required by tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚌 Erbil Bus Transit API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
