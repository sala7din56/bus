const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Simulates live GPS movement of all active buses by slightly adjusting their lat/lng
async function simulateMovement() {
    console.log('🚍 Starting Live GPS Tracker Simulator...');
    setInterval(async () => {
        try {
            const buses = await prisma.bus.findMany();
            for (const bus of buses) {
                if (bus.status === 'RUNNING') {
                    // Random small offset (approx 5-10 meters)
                    const latOffset = (Math.random() - 0.5) * 0.0005;
                    const lngOffset = (Math.random() - 0.5) * 0.0005;
                    
                    await prisma.bus.update({
                        where: { id: bus.id },
                        data: {
                            latitude: bus.latitude + latOffset,
                            longitude: bus.longitude + lngOffset,
                            lastUpdated: new Date()
                        }
                    });
                }
            }
        } catch (err) {
            console.error('Simulation error:', err);
        }
    }, 5000); // Move every 5 seconds
}

simulateMovement();
