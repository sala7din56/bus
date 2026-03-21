const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedBuses() {
    console.log('🚍 Seeding buses for existing routes...');
    
    // Clear existing buses
    await prisma.bus.deleteMany();

    const routes = await prisma.route.findMany();
    let busesCreated = 0;

    for (const route of routes) {
        let waypoints = [];
        try {
            waypoints = JSON.parse(route.waypoints || '[]');
        } catch(e) {}

        if (waypoints.length === 0) continue;

        // Create exactly 1 bus per route
        const numBuses = 1; 

        for (let i = 0; i < numBuses; i++) {
            // Pick a random waypoint as the starting position, or interpolate
            const wpIdx = Math.floor(Math.random() * waypoints.length);
            let lat = waypoints[wpIdx][0];
            let lng = waypoints[wpIdx][1];

            await prisma.bus.create({
                data: {
                    routeId: route.id,
                    latitude: lat,
                    longitude: lng,
                    status: 'RUNNING',
                    nextStopName: `Stop near ${route.name.split('-')[0].trim()}`
                }
            });
            busesCreated++;
        }
    }

    console.log(`✅ Successfully seeded ${busesCreated} buses across ${routes.length} routes.`);
}

seedBuses()
  .catch((e) => {
    console.error('❌ Error seeding buses:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
