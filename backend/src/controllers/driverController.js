const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const VALID_STATUSES = ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'RETIRED', 'TERMINATED'];
const VALID_SHIFTS = ['MORNING', 'AFTERNOON', 'NIGHT', 'ROTATING'];
const VALID_LICENSE_TYPES = ['CLASS_A', 'CLASS_B', 'CLASS_C'];
const VALID_DEPOTS = ['ANKAWA_DEPOT', 'CITADEL_DEPOT', 'EAST_ERBIL_DEPOT', 'SOUTH_ERBIL_DEPOT', 'AIRPORT_DEPOT', 'CENTRAL_DEPOT'];
const VALID_CONTRACTS = ['FULL_TIME', 'PART_TIME', 'CONTRACT'];

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

// GET /api/drivers
exports.getAllDrivers = async (req, res) => {
  try {
    const { status, depot, shift, search, page = 1, limit = 20 } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (depot) where.depotName = depot;
    if (shift) where.shift = shift;
    
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { fullNameKurdish: { contains: search } },
        { employeeCode: { contains: search } },
        { phoneNumber: { contains: search } },
        { licenseNumber: { contains: search } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [total, drivers] = await Promise.all([
      prisma.driver.count({ where }),
      prisma.driver.findMany({
        where,
        skip,
        take,
        include: {
          assignedBus: { select: { id: true, status: true } },
          assignedRoute: { select: { id: true, name: true, nameKurdish: true, colorHex: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    res.json({ total, page: parseInt(page), limit: parseInt(limit), drivers });
  } catch (error) {
    console.error('getAllDrivers error:', error);
    res.status(500).json({ error: 'Failed to fetch drivers.' });
  }
};

// GET /api/drivers/:id
exports.getDriverById = async (req, res) => {
  try {
    const driver = await prisma.driver.findUnique({
      where: { id: req.params.id },
      include: {
        assignedBus: true,
        assignedRoute: true
      }
    });
    if (!driver) return res.status(404).json({ error: 'Driver not found.' });
    res.json(driver);
  } catch (error) {
    console.error('getDriverById error:', error);
    res.status(500).json({ error: 'Failed to fetch driver.' });
  }
};

// POST /api/drivers
exports.createDriver = async (req, res) => {
  try {
    const data = req.body;
    
    if (!data.fullName?.trim()) return res.status(400).json({ error: 'fullName is required.' });
    if (!data.fullNameKurdish?.trim()) return res.status(400).json({ error: 'fullNameKurdish is required.' });
    if (!data.employeeCode?.trim()) return res.status(400).json({ error: 'employeeCode is required.' });
    if (!data.phoneNumber?.trim()) return res.status(400).json({ error: 'phoneNumber is required.' });
    if (!data.licenseNumber?.trim()) return res.status(400).json({ error: 'licenseNumber is required.' });
    if (!VALID_LICENSE_TYPES.includes(data.licenseType)) return res.status(400).json({ error: 'Invalid licenseType.' });
    if (!data.licenseExpiry || isNaN(new Date(data.licenseExpiry).getTime())) return res.status(400).json({ error: 'Invalid or missing licenseExpiry date.' });
    if (new Date(data.licenseExpiry) <= new Date()) return res.status(400).json({ error: 'licenseExpiry must be a future date.' });
    if (!VALID_DEPOTS.includes(data.depotName)) return res.status(400).json({ error: 'Invalid depotName.' });
    if (!VALID_STATUSES.includes(data.status)) return res.status(400).json({ error: 'Invalid status.' });
    if (!VALID_SHIFTS.includes(data.shift)) return res.status(400).json({ error: 'Invalid shift.' });
    if (!VALID_CONTRACTS.includes(data.contractType)) return res.status(400).json({ error: 'Invalid contractType.' });
    if (!data.hireDate || isNaN(new Date(data.hireDate).getTime())) return res.status(400).json({ error: 'Invalid or missing hireDate.' });

    const existingCode = await prisma.driver.findUnique({ where: { employeeCode: data.employeeCode } });
    if (existingCode) return res.status(409).json({ error: 'employeeCode already in use.' });

    const existingLicense = await prisma.driver.findUnique({ where: { licenseNumber: data.licenseNumber } });
    if (existingLicense) return res.status(409).json({ error: 'licenseNumber already in use.' });

    if (data.email) {
      const existingEmail = await prisma.driver.findUnique({ where: { email: data.email } });
      if (existingEmail) return res.status(409).json({ error: 'email already in use.' });
    }

    if (data.assignedBusId) {
      const bus = await prisma.bus.findUnique({ where: { id: data.assignedBusId } });
      if (!bus) return res.status(400).json({ error: 'Assigned bus not found.' });
    }

    const driver = await prisma.driver.create({
      data: {
        fullName: data.fullName.trim(),
        fullNameKurdish: data.fullNameKurdish.trim(),
        employeeCode: data.employeeCode.trim(),
        photo: data.photo || null,
        phoneNumber: data.phoneNumber.trim(),
        phoneNumberAlt: data.phoneNumberAlt || null,
        email: data.email || null,
        address: data.address || null,
        licenseNumber: data.licenseNumber.trim(),
        licenseType: data.licenseType,
        licenseExpiry: new Date(data.licenseExpiry),
        licenseIssuedBy: data.licenseIssuedBy || null,
        assignedBusId: data.assignedBusId || null,
        carPlateNumber: data.carPlateNumber || null,
        depotName: data.depotName,
        depotLocation: data.depotLocation || null,
        shift: data.shift,
        routeId: data.routeId || null,
        supervisorName: data.supervisorName || null,
        status: data.status,
        hireDate: new Date(data.hireDate),
        terminationDate: data.terminationDate ? new Date(data.terminationDate) : null,
        contractType: data.contractType,
        emergencyContactName: data.emergencyContactName || null,
        emergencyContactPhone: data.emergencyContactPhone || null,
        emergencyContactRelation: data.emergencyContactRelation || null,
        notes: data.notes || null,
      }
    });

    await logActivity(req, 'CREATED', 'DRIVER', driver.id, driver.fullName);
    res.status(201).json(driver);
  } catch (error) {
    console.error('createDriver error:', error);
    res.status(500).json({ error: 'Failed to create driver.' });
  }
};

// PUT /api/drivers/:id
exports.updateDriver = async (req, res) => {
  try {
    const existing = await prisma.driver.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Driver not found.' });

    const data = req.body;
    
    if (data.fullName !== undefined && !data.fullName.trim()) return res.status(400).json({ error: 'fullName cannot be empty.' });
    if (data.licenseType !== undefined && !VALID_LICENSE_TYPES.includes(data.licenseType)) return res.status(400).json({ error: 'Invalid licenseType.' });
    if (data.licenseExpiry !== undefined) {
      if (isNaN(new Date(data.licenseExpiry).getTime())) return res.status(400).json({ error: 'Invalid licenseExpiry date.' });
    }

    const updateData = { ...data };
    if (updateData.licenseExpiry) updateData.licenseExpiry = new Date(updateData.licenseExpiry);
    if (updateData.hireDate) updateData.hireDate = new Date(updateData.hireDate);
    if (updateData.terminationDate) updateData.terminationDate = new Date(updateData.terminationDate);

    delete updateData.id;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: updateData
    });

    await logActivity(req, 'UPDATED', 'DRIVER', driver.id, driver.fullName);
    res.json(driver);
  } catch (error) {
    console.error('updateDriver error:', error);
    res.status(500).json({ error: 'Failed to update driver.' });
  }
};

// DELETE /api/drivers/:id
exports.deleteDriver = async (req, res) => {
  try {
    const existing = await prisma.driver.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Driver not found.' });

    await logActivity(req, 'DELETED', 'DRIVER', req.params.id, existing.fullName);
    await prisma.driver.delete({ where: { id: req.params.id } });
    res.json({ message: 'Driver deleted successfully.' });
  } catch (error) {
    console.error('deleteDriver error:', error);
    res.status(500).json({ error: 'Failed to delete driver.' });
  }
};

// PATCH /api/drivers/:id/status
exports.updateDriverStatus = async (req, res) => {
  try {
    const existing = await prisma.driver.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'Driver not found.' });

    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });

    let terminationDate = existing.terminationDate;
    if (status === 'TERMINATED' || status === 'RETIRED') {
      if (!terminationDate) terminationDate = new Date();
    } else if (status === 'ACTIVE') {
      terminationDate = null;
    }

    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: { status, terminationDate }
    });

    await logActivity(req, 'UPDATED', 'DRIVER', driver.id, `Status changed to ${status}`);
    res.json(driver);
  } catch (error) {
    console.error('updateDriverStatus error:', error);
    res.status(500).json({ error: 'Failed to update status.' });
  }
};

// PATCH /api/drivers/:id/assign-route
exports.assignDriverToRoute = async (req, res) => {
  try {
    const { routeId } = req.body;
    if (routeId) {
      const route = await prisma.route.findUnique({ where: { id: routeId } });
      if (!route) return res.status(400).json({ error: 'Route not found.' });
    }
    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: { routeId: routeId || null }
    });
    await logActivity(req, 'UPDATED', 'DRIVER', driver.id, `Assigned to route ${routeId}`);
    res.json(driver);
  } catch (error) {
    console.error('assignDriverToRoute error:', error);
    res.status(500).json({ error: 'Failed to assign route.' });
  }
};

// PATCH /api/drivers/:id/assign-bus
exports.assignDriverToBus = async (req, res) => {
  try {
    const { busId } = req.body;
    
    if (busId) {
      const bus = await prisma.bus.findUnique({ where: { id: busId } });
      if (!bus) return res.status(400).json({ error: 'Bus not found.' });

      const existingDriverOnBus = await prisma.driver.findFirst({
        where: { assignedBusId: busId, id: { not: req.params.id } }
      });
      if (existingDriverOnBus) {
        return res.status(409).json({ error: 'Bus is already assigned to another driver.' });
      }
    }

    const driver = await prisma.driver.update({
      where: { id: req.params.id },
      data: { assignedBusId: busId || null }
    });
    
    await logActivity(req, 'UPDATED', 'DRIVER', driver.id, `Assigned to bus ${busId}`);
    res.json(driver);
  } catch (error) {
    console.error('assignDriverToBus error:', error);
    res.status(500).json({ error: 'Failed to assign bus.' });
  }
};

// GET /api/drivers/stats
exports.getDriverStats = async (req, res) => {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const now = new Date();

    const [
      total, active, onLeave, suspended, retired, terminated,
      depotGroups, shiftGroups,
      expiringCount, expiredCount
    ] = await Promise.all([
      prisma.driver.count(),
      prisma.driver.count({ where: { status: 'ACTIVE' } }),
      prisma.driver.count({ where: { status: 'ON_LEAVE' } }),
      prisma.driver.count({ where: { status: 'SUSPENDED' } }),
      prisma.driver.count({ where: { status: 'RETIRED' } }),
      prisma.driver.count({ where: { status: 'TERMINATED' } }),
      prisma.driver.groupBy({ by: ['depotName'], _count: { id: true } }),
      prisma.driver.groupBy({ by: ['shift'], _count: { id: true } }),
      prisma.driver.count({ where: { licenseExpiry: { lte: thirtyDaysFromNow, gt: now } } }),
      prisma.driver.count({ where: { licenseExpiry: { lte: now } } })
    ]);

    const byDepot = {};
    depotGroups.forEach(g => { byDepot[g.depotName] = g._count.id; });
    VALID_DEPOTS.forEach(d => { if (byDepot[d] === undefined) byDepot[d] = 0; });

    const byShift = {};
    shiftGroups.forEach(g => { byShift[g.shift] = g._count.id; });
    VALID_SHIFTS.forEach(s => { if (byShift[s] === undefined) byShift[s] = 0; });

    res.json({
      total,
      active,
      onLeave,
      suspended,
      retired,
      terminated,
      byDepot,
      byShift,
      licenseExpiringWithin30Days: expiringCount,
      licenseExpired: expiredCount
    });
  } catch (error) {
    console.error('getDriverStats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
};

// GET /api/drivers/licenses/expiring
exports.getExpiringLicenses = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    
    const drivers = await prisma.driver.findMany({
      where: {
        licenseExpiry: {
          lte: targetDate
        }
      },
      orderBy: { licenseExpiry: 'asc' },
      include: {
        assignedBus: true,
        assignedRoute: true
      }
    });

    res.json(drivers);
  } catch (error) {
    console.error('getExpiringLicenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expiring licenses.' });
  }
};
