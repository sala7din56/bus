/**
 * Erbil Bus Transit - Driver Management Module Test Suite
 * Run: npx jest tests/drivers.test.js
 */
const request = require('supertest');
const { PrismaClient } = require('@prisma/client');

process.env.NODE_ENV = 'test';
const app = require('../src/app');

const prisma = new PrismaClient();
let authToken = '';
const testIds = {};

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@erbilbus.iq', password: 'Admin@1234' });
  
  if (res.status === 200) {
    authToken = res.body.accessToken;
  }
});

// BLOCK 1: Auth Gates
describe('1. AUTHENTICATION GATES', () => {
  it('GET /api/drivers rejects no token', async () => {
    const res = await request(app).get('/api/drivers');
    expect(res.status).toBe(401);
  });
});

// BLOCK 2: Schema / Create
describe('2. SCHEMA INITIALIZATION & CREATE (CRUD)', () => {
  it('POST /api/drivers fails missing required fields', async () => {
    const res = await request(app).post('/api/drivers').set('Authorization', `Bearer ${authToken}`).send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/drivers creates valid driver', async () => {
    const data = {
      fullName: 'Test Driver',
      fullNameKurdish: 'شۆفێری تاقیکردنەوە',
      employeeCode: 'TEST-DRV-01',
      phoneNumber: '+964 750 000 0000',
      licenseNumber: 'TEST-LIC-01',
      licenseType: 'CLASS_A',
      licenseExpiry: new Date(Date.now() + 86400000 * 365).toISOString(),
      depotName: 'CENTRAL_DEPOT',
      status: 'ACTIVE',
      shift: 'MORNING',
      contractType: 'FULL_TIME',
      hireDate: new Date().toISOString()
    };
    const res = await request(app).post('/api/drivers').set('Authorization', `Bearer ${authToken}`).send(data);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    testIds.driverId = res.body.id;
  });
});

// BLOCK 3: Read & Filter
describe('3. READ, FILTER, & SEARCH', () => {
  it('GET /api/drivers returns array', async () => {
    const res = await request(app).get('/api/drivers').set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.drivers)).toBe(true);
    expect(res.body.total).toBeGreaterThan(0);
  });
  
  it('GET /api/drivers with search finds matching driver', async () => {
    const res = await request(app).get('/api/drivers?search=TEST-DRV-01').set('Authorization', `Bearer ${authToken}`);
    expect(res.body.drivers.length).toBe(1);
    expect(res.body.drivers[0].fullName).toBe('Test Driver');
  });
});

// BLOCK 4: Updates
describe('4. UPDATE DRIVER', () => {
  it('PUT /api/drivers/:id updates driver info', async () => {
    const res = await request(app).put(`/api/drivers/${testIds.driverId}`).set('Authorization', `Bearer ${authToken}`)
      .send({ address: 'New Test Address' });
    expect(res.status).toBe(200);
    expect(res.body.address).toBe('New Test Address');
  });
});

// BLOCK 5: Status Management
describe('5. STATUS & EMPLOYMENT LIFECYCLE', () => {
  it('PATCH /api/drivers/:id/status updates status', async () => {
    const res = await request(app).patch(`/api/drivers/${testIds.driverId}/status`).set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'SUSPENDED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUSPENDED');
  });
});

// BLOCK 6: Assignments
describe('6. BUS & ROUTE ASSIGNMENTS', () => {
  let testBusId;
  let testRouteId;
  
  beforeAll(async () => {
    const route = await prisma.route.create({ data: { name: 'DRV-TEST-ROUTE', nameKurdish: 'T', status: 'RUNNING', colorHex: '#FFFFFF' } });
    testRouteId = route.id;
    const bus = await prisma.bus.create({ data: { routeId: testRouteId, latitude: 36.19, longitude: 44.01, status: 'RUNNING' }});
    testBusId = bus.id;
  });

  afterAll(async () => {
    // Assigned driver needs to be unassigned first or cascade will be handled by SetNull?
    // In schema assignedBusId is SetNull, so deleting bus is fine.
    await prisma.bus.delete({ where: { id: testBusId } });
    await prisma.route.delete({ where: { id: testRouteId } });
  });

  it('PATCH /api/drivers/:id/assign-bus assigns bus', async () => {
    testIds.busId = testBusId;
    const res = await request(app).patch(`/api/drivers/${testIds.driverId}/assign-bus`).set('Authorization', `Bearer ${authToken}`)
      .send({ busId: testBusId });
    expect(res.status).toBe(200);
    expect(res.body.assignedBusId).toBe(testBusId);
  });

  it('PATCH /api/drivers/:id/assign-bus prevents assigning same bus to another driver', async () => {
    const d2 = await prisma.driver.create({
      data: {
        fullName: 'Test 2',
        fullNameKurdish: 'تاقیکردنەوە 2',
        employeeCode: 'TEST-DRV-02',
        phoneNumber: '0',
        licenseNumber: 'TEST-LIC-02',
        licenseType: 'CLASS_A',
        licenseExpiry: new Date(),
        depotName: 'CENTRAL_DEPOT',
        status: 'ACTIVE',
        shift: 'MORNING',
        contractType: 'FULL_TIME',
        hireDate: new Date()
      }
    });
    testIds.driverId2 = d2.id;
    const res = await request(app).patch(`/api/drivers/${d2.id}/assign-bus`).set('Authorization', `Bearer ${authToken}`)
      .send({ busId: testBusId });
    expect(res.status).toBe(409);
  });
});

// BLOCK 7: Stats
describe('7. STATISTICS PIPELINE', () => {
  it('GET /api/drivers/stats retrieves metrics', async () => {
    const res = await request(app).get('/api/drivers/stats').set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBeDefined();
    expect(res.body.byDepot).toBeDefined();
    expect(res.body.byShift).toBeDefined();
  });
});

// BLOCK 8: Activity Logging
describe('8. ACTIVITY LOG COMPLIANCE', () => {
  it('Modifying driver creates an ActivityLog', async () => {
    const lastLog = await prisma.activityLog.findFirst({
      where: { entityType: 'DRIVER' },
      orderBy: { createdAt: 'desc' }
    });
    expect(lastLog).not.toBeNull();
    expect(lastLog.action).toBeDefined();
  });
});

// BLOCK 9: Deletion & Cleanup
describe('9. DELETION AND CASCADE', () => {
  it('DELETE /api/drivers/:id removes driver safely', async () => {
    const res = await request(app).delete(`/api/drivers/${testIds.driverId}`).set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    const d = await prisma.driver.findUnique({ where: { id: testIds.driverId } });
    expect(d).toBeNull();
  });
});

afterAll(async () => {
  await prisma.driver.deleteMany({ where: { employeeCode: { startsWith: 'TEST-DRV' } } });
  await prisma.$disconnect();
});
