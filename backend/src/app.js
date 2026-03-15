require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const authRoutes = require('./routes/auth');
const routeRoutes = require('./routes/routes');
const stopRoutes = require('./routes/stops');
const busRoutes = require('./routes/buses');
const scheduleRoutes = require('./routes/schedules');
const authMiddleware = require('./middleware/auth');

const app = express();
const prisma = new PrismaClient();
require('./simulator');
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:5501', 'http://127.0.0.1:5501'],
  credentials: true,
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/stops', stopRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/schedules', scheduleRoutes);

// Dashboard Stats
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const [totalRoutes, activeBuses, totalStops, delayedBuses, recentRoutes] = await Promise.all([
      prisma.route.count(),
      prisma.bus.count({ where: { status: 'RUNNING' } }),
      prisma.stop.count(),
      prisma.bus.count({ where: { status: 'DELAYED' } }),
      prisma.route.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { buses: true } } },
      }),
    ]);

    res.json({
      totalRoutes,
      activeBuses,
      totalStops,
      delayedBuses,
      recentRoutes,
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

app.listen(PORT, () => {
  console.log(`🚌 Erbil Bus Transit API running on http://localhost:${PORT}`);
});

module.exports = app;
