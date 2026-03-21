const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const route = await prisma.route.create({
      data: { name: "Test R", nameKurdish: "R" }
    });
    const stop = await prisma.stop.create({
      data: { name: "Test S", nameKurdish: "S", latitude: 0, longitude: 0 }
    });
    await prisma.schedule.create({
      data: { routeId: route.id, stopId: stop.id, arrivalTime: "10:00" }
    });
    
    console.log("Created Route & Schedule");
    await prisma.route.delete({ where: { id: route.id } });
    console.log("Route deleted successfully with schedules attached");
    
    await prisma.stop.delete({ where: { id: stop.id } });
  } catch (e) {
    console.error("Delete failed:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
