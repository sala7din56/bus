const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // 1. Create a route
    const route = await prisma.route.create({
      data: {
        name: "Test Route FK",
        nameKurdish: "تێست FK"
      }
    });
    console.log("Created Route:", route.id);

    // 2. Create a bus linked to the route
    const bus = await prisma.bus.create({
      data: {
        routeId: route.id,
        latitude: 36.0,
        longitude: 44.0,
        status: "RUNNING"
      }
    });
    console.log("Created Bus:", bus.id);

    // 3. Try to delete the route
    console.log("Attempting to delete Route...");
    await prisma.route.delete({
      where: { id: route.id }
    });
    console.log("Route deleted successfully! Cascade/SetNull worked in SQLite.");
  } catch (e) {
    console.error("Delete failed:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
