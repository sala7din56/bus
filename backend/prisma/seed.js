const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.schedule.deleteMany();
  await prisma.bus.deleteMany();
  await prisma.stop.deleteMany();
  await prisma.route.deleteMany();
  await prisma.admin.deleteMany();

  // Seed Admin
  const hashedPassword = await bcrypt.hash('Admin@1234', 12);
  await prisma.admin.create({
    data: {
      email: 'admin@erbilbus.iq',
      passwordHash: hashedPassword,
      name: 'Admin User',
    },
  });
  console.log('✅ Admin seeded');

  // Seed Routes
  const routes = await Promise.all([
    prisma.route.create({
      data: {
        name: 'Route 1 - Ankawa',
        nameKurdish: 'ڕێگا ١ - ئەنکاوە',
        colorHex: '#1877F2',
        status: 'RUNNING',
        description: 'North Erbil to Ankawa',
      },
    }),
    prisma.route.create({
      data: {
        name: 'Route 2 - Citadel',
        nameKurdish: 'ڕێگا ٢ - قەڵا',
        colorHex: '#10B981',
        status: 'RUNNING',
        description: 'City center loop via Citadel',
      },
    }),
    prisma.route.create({
      data: {
        name: 'Route 3 - Gulan',
        nameKurdish: 'ڕێگا ٣ - گولان',
        colorHex: '#FF9800',
        status: 'DELAYED',
        description: 'East Erbil Gulan district',
      },
    }),
    prisma.route.create({
      data: {
        name: 'Route 4 - Ringas',
        nameKurdish: 'ڕێگا ٤ - رینگاس',
        colorHex: '#EF4444',
        status: 'OUT_OF_SERVICE',
        description: 'Under maintenance',
      },
    }),
    prisma.route.create({
      data: {
        name: 'Route 5 - Empire',
        nameKurdish: 'ڕێگا ٥ - ئیمپایەر',
        colorHex: '#00BCD4',
        status: 'RUNNING',
        description: 'Empire World to City',
      },
    }),
  ]);
  console.log('✅ Routes seeded');

  // Seed Stops (8 stops in Erbil area)
  const stops = await Promise.all([
    prisma.stop.create({ data: { name: 'Ankawa Square', latitude: 36.2320, longitude: 44.0110 } }),
    prisma.stop.create({ data: { name: 'Erbil Citadel', latitude: 36.1901, longitude: 44.0091 } }),
    prisma.stop.create({ data: { name: 'Gulan Park', latitude: 36.2050, longitude: 44.0300 } }),
    prisma.stop.create({ data: { name: 'Sami Abdulrahman Park', latitude: 36.1980, longitude: 43.9960 } }),
    prisma.stop.create({ data: { name: 'Empire World Mall', latitude: 36.2100, longitude: 44.0450 } }),
    prisma.stop.create({ data: { name: 'Naz City Mall', latitude: 36.1850, longitude: 44.0200 } }),
    prisma.stop.create({ data: { name: 'Erbil International Airport', latitude: 36.2376, longitude: 43.9632 } }),
    prisma.stop.create({ data: { name: 'Shanidar Park', latitude: 36.1912, longitude: 44.0123 } }),
  ]);
  console.log('✅ Stops seeded');

  // Seed Buses (6 buses)
  const buses = await Promise.all([
    prisma.bus.create({ data: { routeId: routes[0].id, latitude: 36.2250, longitude: 44.0100, status: 'RUNNING', nextStopName: 'Ankawa Square' } }),
    prisma.bus.create({ data: { routeId: routes[1].id, latitude: 36.1910, longitude: 44.0085, status: 'RUNNING', nextStopName: 'Erbil Citadel' } }),
    prisma.bus.create({ data: { routeId: routes[2].id, latitude: 36.2030, longitude: 44.0280, status: 'DELAYED', nextStopName: 'Gulan Park' } }),
    prisma.bus.create({ data: { routeId: routes[0].id, latitude: 36.2000, longitude: 43.9970, status: 'RUNNING', nextStopName: 'Sami Abdulrahman Park' } }),
    prisma.bus.create({ data: { routeId: routes[4].id, latitude: 36.2090, longitude: 44.0430, status: 'RUNNING', nextStopName: 'Empire World Mall' } }),
    prisma.bus.create({ data: { routeId: routes[3].id, latitude: 36.1860, longitude: 44.0190, status: 'OUT_OF_SERVICE', nextStopName: 'Naz City Mall' } }),
  ]);
  console.log('✅ Buses seeded');

  // Seed Schedules (10 rows)
  await Promise.all([
    prisma.schedule.create({ data: { stopId: stops[0].id, routeId: routes[0].id, busId: buses[0].id, arrivalTime: '07:30', isRealtime: true } }),
    prisma.schedule.create({ data: { stopId: stops[1].id, routeId: routes[1].id, busId: buses[1].id, arrivalTime: '08:00', isRealtime: true } }),
    prisma.schedule.create({ data: { stopId: stops[2].id, routeId: routes[2].id, busId: buses[2].id, arrivalTime: '08:15', isRealtime: false } }),
    prisma.schedule.create({ data: { stopId: stops[3].id, routeId: routes[0].id, busId: buses[3].id, arrivalTime: '08:45', isRealtime: true } }),
    prisma.schedule.create({ data: { stopId: stops[4].id, routeId: routes[4].id, busId: buses[4].id, arrivalTime: '09:00', isRealtime: false } }),
    prisma.schedule.create({ data: { stopId: stops[5].id, routeId: routes[1].id, busId: buses[1].id, arrivalTime: '09:30', isRealtime: true } }),
    prisma.schedule.create({ data: { stopId: stops[6].id, routeId: routes[0].id, busId: buses[0].id, arrivalTime: '10:00', isRealtime: false } }),
    prisma.schedule.create({ data: { stopId: stops[7].id, routeId: routes[2].id, busId: buses[2].id, arrivalTime: '10:30', isRealtime: false } }),
    prisma.schedule.create({ data: { stopId: stops[0].id, routeId: routes[4].id, busId: buses[4].id, arrivalTime: '11:00', isRealtime: true } }),
    prisma.schedule.create({ data: { stopId: stops[1].id, routeId: routes[3].id, busId: buses[5].id, arrivalTime: '11:30', isRealtime: false } }),
  ]);
  console.log('✅ Schedules seeded');

  console.log('🎉 All seed data inserted successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
