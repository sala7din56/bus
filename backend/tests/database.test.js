/**
 * Erbil Bus Transit - Full Database Integration Test Suite
 * Run: npm run test:db
 */
const request = require('supertest');
const { PrismaClient } = require('@prisma/client');

// Set env before loading app
process.env.NODE_ENV = 'test';
const app = require('../src/app');

const prisma = new PrismaClient();
let authToken = '';
let refreshToken = '';
const testIds = {};

// Perform login ONCE before all tests so authToken is available in every describe block
beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@erbilbus.iq', password: 'Admin@1234' });
  
  if (res.status === 200) {
    authToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  }
});

// ============================================================
// BLOCK 1 - Authentication
// ============================================================
describe('AUTHENTICATION', () => {
  it('should have at least one admin in the database', async () => {
    const count = await prisma.admin.count();
    expect(count).toBeGreaterThan(0);
  });

  it('admin password must be bcrypt-hashed (not plain text)', async () => {
    const admins = await prisma.admin.findMany({ select: { passwordHash: true } });
    admins.forEach(a => {
      expect(a.passwordHash).not.toBe('Admin@1234');
      expect(a.passwordHash.startsWith('$2')).toBe(true);
    });
  });

  it('POST /api/auth/login — should fail with empty body (400)', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login — should fail with wrong password (401)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@erbilbus.iq', password: 'WRONG' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login — should fail with non-existent email (401)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@none.com', password: 'x' });
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/login — should succeed with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@erbilbus.iq', password: 'Admin@1234' });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.accessToken.split('.').length).toBe(3);
    authToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  it('GET /api/routes — should reject request without auth token (401)', async () => {
    const res = await request(app).get('/api/routes');
    expect(res.status).toBe(401);
  });

  it('GET /api/routes — should reject malformed token (401)', async () => {
    const res = await request(app).get('/api/routes').set('Authorization', 'Bearer bad.token.here');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/refresh — should issue new access token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it('POST /api/auth/refresh — fake token should fail (401)', async () => {
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'faketoken123' });
    expect(res.status).toBe(401);
  });
});

// ============================================================
// BLOCK 2 - Routes CRUD
// ============================================================
describe('ROUTES - CRUD', () => {
  it('GET /api/routes — should return an array of routes', async () => {
    const res = await request(app).get('/api/routes').set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('GET /api/routes — each route has required fields', async () => {
    const res = await request(app).get('/api/routes').set('Authorization', `Bearer ${authToken}`);
    const r = res.body[0];
    ['id', 'name', 'nameKurdish', 'colorHex', 'status', 'isFavorite'].forEach(f => {
      expect(r[f]).toBeDefined();
    });
    expect(r.colorHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(['RUNNING', 'DELAYED', 'OUT_OF_SERVICE']).toContain(r.status);
  });

  it('POST /api/routes — should reject missing required fields (400)', async () => {
    const res = await request(app).post('/api/routes').set('Authorization', `Bearer ${authToken}`).send({ colorHex: '#FF0000' });
    expect(res.status).toBe(400);
  });

  it('POST /api/routes — should reject invalid colorHex (400)', async () => {
    const res = await request(app).post('/api/routes').set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test', nameKurdish: 'تاقیکردنەوە', colorHex: 'notacolor' });
    expect(res.status).toBe(400);
  });

  it('POST /api/routes — should reject invalid status enum (400)', async () => {
    const res = await request(app).post('/api/routes').set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Test', nameKurdish: 'تاقیکردنەوە', colorHex: '#FF0000', status: 'INVALID' });
    expect(res.status).toBe(400);
  });

  it('POST /api/routes — should create a route successfully', async () => {
    const res = await request(app).post('/api/routes').set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'TEST-SUITE-Route', nameKurdish: 'ڕێگای تاقیکردنەوە', colorHex: '#123456', status: 'RUNNING' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    testIds.routeId = res.body.id;
  });

  it('created route should exist in database', async () => {
    const r = await prisma.route.findUnique({ where: { id: testIds.routeId } });
    expect(r).not.toBeNull();
    expect(r.name).toBe('TEST-SUITE-Route');
  });

  it('GET /api/routes/:id — returns the route', async () => {
    const res = await request(app).get(`/api/routes/${testIds.routeId}`).set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(testIds.routeId);
  });

  it('GET /api/routes/:id — returns 404 for non-existent', async () => {
    const res = await request(app).get('/api/routes/nonexistentid999').set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });

  it('PUT /api/routes/:id — should update the route', async () => {
    const res = await request(app).put(`/api/routes/${testIds.routeId}`).set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'TEST-SUITE-Route-Updated', status: 'DELAYED', isFavorite: true });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('TEST-SUITE-Route-Updated');
    expect(res.body.status).toBe('DELAYED');
    expect(res.body.isFavorite).toBe(true);
  });

  it('PATCH /api/routes/:id/favorite — should toggle isFavorite', async () => {
    const before = await prisma.route.findUnique({ where: { id: testIds.routeId } });
    const res = await request(app).patch(`/api/routes/${testIds.routeId}/favorite`).set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const after = await prisma.route.findUnique({ where: { id: testIds.routeId } });
    expect(after.isFavorite).toBe(!before.isFavorite);
  });

  it('DELETE /api/routes/:id — should delete the route', async () => {
    const res = await request(app).delete(`/api/routes/${testIds.routeId}`).set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const r = await prisma.route.findUnique({ where: { id: testIds.routeId } });
    expect(r).toBeNull();
  });

  it('DELETE /api/routes/:id — should return 404 for already-deleted route', async () => {
    const res = await request(app).delete(`/api/routes/${testIds.routeId}`).set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

// ============================================================
// BLOCK 3 - Stops CRUD
// ============================================================
describe('STOPS - CRUD', () => {
  it('GET /api/stops — returns array with required fields', async () => {
    const res = await request(app).get('/api/stops').set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const s = res.body[0];
    ['id', 'name', 'latitude', 'longitude'].forEach(f => expect(s[f]).toBeDefined());
    expect(typeof s.latitude).toBe('number');
    expect(typeof s.longitude).toBe('number');
  });

  it('POST /api/stops — should reject missing name (400)', async () => {
    const res = await request(app).post('/api/stops').set('Authorization', `Bearer ${authToken}`)
      .send({ latitude: 36.19, longitude: 44.01 });
    expect(res.status).toBe(400);
  });

  it('POST /api/stops — should reject out-of-range latitude (400)', async () => {
    const res = await request(app).post('/api/stops').set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Bad Stop', nameKurdish: 'test', latitude: 0, longitude: 44.0 });
    expect(res.status).toBe(400);
  });

  it('POST /api/stops — should reject out-of-range longitude (400)', async () => {
    const res = await request(app).post('/api/stops').set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Bad Stop', nameKurdish: 'test', latitude: 36.19, longitude: 0 });
    expect(res.status).toBe(400);
  });

  it('POST /api/stops — should create stop with valid Erbil coordinates', async () => {
    const res = await request(app).post('/api/stops').set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'TEST-SUITE-Stop', nameKurdish: 'وەقفگەی تاقیکردنەوە', latitude: 36.1901, longitude: 44.0089 });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    testIds.stopId = res.body.id;
  });

  it('PUT /api/stops/:id — should update stop', async () => {
    const res = await request(app).put(`/api/stops/${testIds.stopId}`).set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'TEST-SUITE-Stop-Updated', latitude: 36.2000, longitude: 44.0100 });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('TEST-SUITE-Stop-Updated');
  });

  it('DELETE /api/stops/:id — should delete the stop', async () => {
    const res = await request(app).delete(`/api/stops/${testIds.stopId}`).set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const s = await prisma.stop.findUnique({ where: { id: testIds.stopId } });
    expect(s).toBeNull();
  });
});

// ============================================================
// BLOCK 4 - Buses CRUD
// ============================================================
describe('BUSES - CRUD', () => {
  it('GET /api/buses — should return array of buses', async () => {
    const res = await request(app).get('/api/buses').set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    const b = res.body[0];
    expect(['RUNNING', 'DELAYED', 'OUT_OF_SERVICE']).toContain(b.status);
  });

  it('POST /api/buses — should reject out-of-range latitude (400)', async () => {
    const res = await request(app).post('/api/buses').set('Authorization', `Bearer ${authToken}`)
      .send({ latitude: 0, longitude: 44.0 });
    expect(res.status).toBe(400);
  });

  it('POST /api/buses — should reject invalid status (400)', async () => {
    const res = await request(app).post('/api/buses').set('Authorization', `Bearer ${authToken}`)
      .send({ latitude: 36.19, longitude: 44.01, status: 'FLYING' });
    expect(res.status).toBe(400);
  });

  it('POST /api/buses — should create bus', async () => {
    const route = await prisma.route.findFirst();
    const res = await request(app).post('/api/buses').set('Authorization', `Bearer ${authToken}`)
      .send({ routeId: route.id, latitude: 36.1901, longitude: 44.0089, status: 'RUNNING' });
    expect(res.status).toBe(201);
    testIds.busId = res.body.id;
  });

  it('deleting a route — bus routeId should become null (onDelete: SetNull)', async () => {
    const tempRoute = await prisma.route.create({
      data: { name: 'Temp-SetNull-Test', nameKurdish: 'تاقیکردنەوە', colorHex: '#AABBCC', status: 'RUNNING' }
    });
    const tempBus = await prisma.bus.create({
      data: { routeId: tempRoute.id, latitude: 36.19, longitude: 44.01, status: 'RUNNING' }
    });
    await prisma.route.delete({ where: { id: tempRoute.id } });
    const orphanBus = await prisma.bus.findUnique({ where: { id: tempBus.id } });
    expect(orphanBus).not.toBeNull();
    expect(orphanBus.routeId).toBeNull();
    await prisma.bus.delete({ where: { id: tempBus.id } });
  });

  it('DELETE /api/buses/:id — should delete bus', async () => {
    const res = await request(app).delete(`/api/buses/${testIds.busId}`).set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });

  it('DELETE /api/buses/:id — should return 404 for already-deleted', async () => {
    const res = await request(app).delete(`/api/buses/${testIds.busId}`).set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  });
});

// ============================================================
// BLOCK 5 - Schedules CRUD
// ============================================================
describe('SCHEDULES - CRUD', () => {
  it('GET /api/schedules — returns schedules with joined data', async () => {
    const res = await request(app).get('/api/schedules').set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      const s = res.body[0];
      expect(s.route).toBeDefined();
      expect(s.stop).toBeDefined();
      expect(s.arrivalTime).toBeDefined();
      expect(typeof s.isRealtime).toBe('boolean');
    }
  });

  it('POST /api/schedules — should reject missing routeId (400)', async () => {
    const stop = await prisma.stop.findFirst();
    const res = await request(app).post('/api/schedules').set('Authorization', `Bearer ${authToken}`)
      .send({ stopId: stop.id, arrivalTime: '09:00' });
    expect(res.status).toBe(400);
  });

  it('POST /api/schedules — should reject invalid time format (400)', async () => {
    const route = await prisma.route.findFirst();
    const stop = await prisma.stop.findFirst();
    const res = await request(app).post('/api/schedules').set('Authorization', `Bearer ${authToken}`)
      .send({ routeId: route.id, stopId: stop.id, arrivalTime: 'nine-am' });
    expect(res.status).toBe(400);
  });

  it('POST /api/schedules — should reject fake routeId (400)', async () => {
    const stop = await prisma.stop.findFirst();
    const res = await request(app).post('/api/schedules').set('Authorization', `Bearer ${authToken}`)
      .send({ routeId: 'fake_route_id_999', stopId: stop.id, arrivalTime: '09:00' });
    expect(res.status).toBe(400);
  });

  it('POST /api/schedules — should create schedule', async () => {
    const route = await prisma.route.findFirst();
    const stop = await prisma.stop.findFirst();
    const res = await request(app).post('/api/schedules').set('Authorization', `Bearer ${authToken}`)
      .send({ routeId: route.id, stopId: stop.id, arrivalTime: '08:30', isRealtime: false });
    expect(res.status).toBe(201);
    expect(res.body.arrivalTime).toBe('08:30');
    testIds.scheduleId = res.body.id;
  });

  it('deleting a route should cascade-delete its schedules', async () => {
    const tempRoute = await prisma.route.create({
      data: { name: 'Cascade-Test-Route', nameKurdish: 'تاقیکردنەوەی کاسکەید', colorHex: '#EEDDCC', status: 'RUNNING' }
    });
    const tempStop = await prisma.stop.findFirst();
    const tempSched = await prisma.schedule.create({
      data: { routeId: tempRoute.id, stopId: tempStop.id, arrivalTime: '10:00', isRealtime: false }
    });
    await prisma.route.delete({ where: { id: tempRoute.id } });
    const orphanSched = await prisma.schedule.findUnique({ where: { id: tempSched.id } });
    expect(orphanSched).toBeNull();
  });

  it('DELETE /api/schedules/:id — should delete schedule', async () => {
    const res = await request(app).delete(`/api/schedules/${testIds.scheduleId}`).set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });
});

// ============================================================
// BLOCK 6 - Dashboard Stats
// ============================================================
describe('DASHBOARD STATS', () => {
  it('GET /api/dashboard/stats — returns all stat fields', async () => {
    const res = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalRoutes).toBe('number');
    expect(typeof res.body.activeBuses).toBe('number');
    expect(typeof res.body.totalStops).toBe('number');
    expect(typeof res.body.delayedBuses).toBe('number');
    expect(Array.isArray(res.body.recentRoutes)).toBe(true);
  });

  it('stat numbers match actual database counts', async () => {
    const [totalRoutes, totalStops, activeBuses, delayedBuses] = await Promise.all([
      prisma.route.count(),
      prisma.stop.count(),
      prisma.bus.count({ where: { status: 'RUNNING' } }),
      prisma.bus.count({ where: { status: 'DELAYED' } }),
    ]);
    const res = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${authToken}`);
    expect(res.body.totalRoutes).toBe(totalRoutes);
    expect(res.body.totalStops).toBe(totalStops);
    expect(res.body.activeBuses).toBe(activeBuses);
    expect(res.body.delayedBuses).toBe(delayedBuses);
  });

  it('recentRoutes should have at most 5 entries', async () => {
    const res = await request(app).get('/api/dashboard/stats').set('Authorization', `Bearer ${authToken}`);
    expect(res.body.recentRoutes.length).toBeLessThanOrEqual(5);
  });
});

// ============================================================
// BLOCK 7 - Activity Log
// ============================================================
describe('ACTIVITY LOG', () => {
  it('ActivityLog table is queryable', async () => {
    const count = await prisma.activityLog.count();
    expect(typeof count).toBe('number');
  });

  it('GET /api/activity — returns array of log entries', async () => {
    const res = await request(app).get('/api/activity').set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('creating a route generates an ActivityLog entry', async () => {
    const countBefore = await prisma.activityLog.count();
    const createRes = await request(app).post('/api/routes').set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Activity-Log-Test-Route', nameKurdish: 'تاقیکردنەوەی چالاکی', colorHex: '#112233', status: 'RUNNING' });
    const countAfter = await prisma.activityLog.count();
    expect(countAfter).toBeGreaterThan(countBefore);
    const lastLog = await prisma.activityLog.findFirst({ orderBy: { createdAt: 'desc' } });
    expect(lastLog.action).toBe('CREATED');
    expect(lastLog.entityType).toBe('ROUTE');
    await prisma.route.delete({ where: { id: createRes.body.id } });
  });
});

// ============================================================
// BLOCK 8 - Settings
// ============================================================
describe('SETTINGS', () => {
  it('Settings table is queryable', async () => {
    const count = await prisma.setting.count();
    expect(typeof count).toBe('number');
  });

  it('GET /api/settings — returns settings array', async () => {
    const res = await request(app).get('/api/settings').set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PUT /api/settings/:key — creates setting', async () => {
    const res = await request(app).put('/api/settings/test_suite_theme').set('Authorization', `Bearer ${authToken}`)
      .send({ value: 'dark' });
    expect(res.status).toBe(200);
    const setting = await prisma.setting.findUnique({ where: { key: 'test_suite_theme' } });
    expect(setting.value).toBe('dark');
  });

  it('PUT /api/settings/:key — updates without creating duplicate', async () => {
    await request(app).put('/api/settings/test_suite_theme').set('Authorization', `Bearer ${authToken}`).send({ value: 'light' });
    const count = await prisma.setting.count({ where: { key: 'test_suite_theme' } });
    expect(count).toBe(1);
  });

  it('cleanup: remove test setting', async () => {
    await prisma.setting.delete({ where: { key: 'test_suite_theme' } });
    const s = await prisma.setting.findUnique({ where: { key: 'test_suite_theme' } });
    expect(s).toBeNull();
  });
});

// ============================================================
// BLOCK 9 - Depots CRUD
// ============================================================
describe('DEPOTS - CRUD', () => {
  it('GET /api/depots — returns array of depots', async () => {
    const res = await request(app).get('/api/depots').set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('POST /api/depots — should create a depot', async () => {
    const res = await request(app).post('/api/depots').set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'TEST-SUITE-Depot', nameKurdish: 'ئامارگەی تاقیکردنەوە', lat: 36.1901, lng: 44.0089, capacity: 10, status: 'ACTIVE', colorHex: '#00BCD4' });
    expect(res.status).toBe(201);
    testIds.depotId = res.body.id;
  });

  it('PUT /api/depots/:id — should update depot', async () => {
    const res = await request(app).put(`/api/depots/${testIds.depotId}`).set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'TEST-SUITE-Depot-Updated', capacity: 20 });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/depots/:id — should delete depot', async () => {
    const res = await request(app).delete(`/api/depots/${testIds.depotId}`).set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
  });
});

// ============================================================
// BLOCK 10 - Data Integrity Checks
// ============================================================
describe('DATA INTEGRITY', () => {
  it('all route colorHex values are valid hex strings', async () => {
    const routes = await prisma.route.findMany({ select: { colorHex: true } });
    routes.forEach(r => {
      expect(r.colorHex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it('all bus coordinates are within valid Erbil region', async () => {
    const buses = await prisma.bus.findMany({ select: { latitude: true, longitude: true } });
    buses.forEach(b => {
      expect(b.latitude).toBeGreaterThan(35);
      expect(b.latitude).toBeLessThan(38);
      expect(b.longitude).toBeGreaterThan(43);
      expect(b.longitude).toBeLessThan(46);
    });
  });

  it('all bus statuses are valid enum values', async () => {
    const valid = ['RUNNING', 'DELAYED', 'OUT_OF_SERVICE'];
    const buses = await prisma.bus.findMany({ select: { status: true } });
    buses.forEach(b => expect(valid).toContain(b.status));
  });

  it('all route statuses are valid enum values', async () => {
    const valid = ['RUNNING', 'DELAYED', 'OUT_OF_SERVICE'];
    const routes = await prisma.route.findMany({ select: { status: true } });
    routes.forEach(r => expect(valid).toContain(r.status));
  });

  it('no schedule has null routeId or stopId', async () => {
    const badSchedules = await prisma.schedule.findMany({
      where: { OR: [{ stopId: '' }, { routeId: '' }] }
    });
    expect(badSchedules.length).toBe(0);
  });

  it('RouteStop unique constraint: same stop cannot appear twice on same route', async () => {
    const route = await prisma.route.findFirst();
    const stop = await prisma.stop.findFirst();

    // Clean up any existing entry
    await prisma.routeStop.deleteMany({ where: { routeId: route.id, stopId: stop.id } });

    await prisma.routeStop.create({ data: { routeId: route.id, stopId: stop.id, sequence: 1 } });
    
    await expect(
      prisma.routeStop.create({ data: { routeId: route.id, stopId: stop.id, sequence: 2 } })
    ).rejects.toThrow();
    
    await prisma.routeStop.deleteMany({ where: { routeId: route.id, stopId: stop.id } });
  });

  it('concurrent route creation: no ID collisions', async () => {
    const creates = Array.from({ length: 5 }, (_, i) =>
      prisma.route.create({
        data: { name: `CONCURRENT-TEST-${i}`, nameKurdish: `تاقیکردنەوە${i}`, colorHex: '#FFFFFF', status: 'RUNNING' }
      })
    );
    const results = await Promise.all(creates);
    const ids = results.map(r => r.id);
    expect(new Set(ids).size).toBe(5);
    await prisma.route.deleteMany({ where: { id: { in: ids } } });
  });
});

// ============================================================
// BLOCK 11 - Cleanup Verification
// ============================================================
describe('CLEANUP VERIFICATION', () => {
  it('no TEST-SUITE routes remain in database after all tests', async () => {
    const remaining = await prisma.route.count({ where: { name: { contains: 'TEST-SUITE' } } });
    expect(remaining).toBe(0);
  });

  it('no TEST-SUITE stops remain in database after all tests', async () => {
    const remaining = await prisma.stop.count({ where: { name: { contains: 'TEST-SUITE' } } });
    expect(remaining).toBe(0);
  });

  it('original admin account still exists', async () => {
    const admin = await prisma.admin.findUnique({ where: { email: 'admin@erbilbus.iq' } });
    expect(admin).not.toBeNull();
  });

  it('original routes are still intact', async () => {
    const count = await prisma.route.count();
    expect(count).toBeGreaterThan(0);
  });
});

afterAll(async () => {
  // Final safety cleanup - remove any leftover test data
  await prisma.route.deleteMany({ where: { name: { contains: 'TEST-SUITE' } } });
  await prisma.stop.deleteMany({ where: { name: { contains: 'TEST-SUITE' } } });
  await prisma.setting.deleteMany({ where: { key: { contains: 'test_suite' } } });
  await prisma.$disconnect();
});
