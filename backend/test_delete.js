const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const routes = await prisma.route.findMany();
  console.log("Routes:", routes.map(r => r.id));
  if (routes.length > 0) {
    try {
      console.log("Deleting route:", routes[0].id);
      await prisma.route.delete({ where: { id: routes[0].id } });
      console.log("Deleted successfully.");
    } catch (e) {
      console.error("Delete failed:", e.message);
    }
  }
}

main().finally(() => prisma.$disconnect());
