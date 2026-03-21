const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const mockDepots = [
    {
      id: "depot_001",
      name: "Ankawa Central Depot",
      nameKurdish: "ئامارگەی ناوەندی ئەنکاوە",
      lat: 36.2210,
      lng: 43.9980,
      capacity: 35,
      status: "ACTIVE",
      manager: "Karwan Ahmed",
      phone: "+964 750 111 2233",
      address: "Ankawa District, near Ankawa Church Road",
      addressKurdish: "ناحیەی ئەنکاوە، نزیک شەقامی کەنیسای ئەنکاوە",
      openTime: "05:00",
      closeTime: "23:00",
      colorHex: "#1877F2"
    },
    {
      id: "depot_002",
      name: "Citadel South Depot",
      nameKurdish: "ئامارگەی باشووری قەڵا",
      lat: 36.1820,
      lng: 44.0120,
      capacity: 20,
      status: "ACTIVE",
      manager: "Saman Rashid",
      phone: "+964 750 222 3344",
      address: "South of Erbil Citadel, Shorish District",
      addressKurdish: "باشووری قەڵای هەولێر، ناحیەی شۆڕش",
      openTime: "05:30",
      closeTime: "22:30",
      colorHex: "#10B981"
    },
    {
      id: "depot_003",
      name: "East Erbil Depot",
      nameKurdish: "ئامارگەی ڕۆژهەڵاتی هەولێر",
      lat: 36.1912,
      lng: 44.0612,
      capacity: 25,
      status: "ACTIVE",
      manager: "Dilveen Hassan",
      phone: "+964 750 333 4455",
      address: "Dream City Road, East Erbil",
      addressKurdish: "شەقامی شارۆچکەی خەون، ڕۆژهەڵاتی هەولێر",
      openTime: "05:00",
      closeTime: "23:30",
      colorHex: "#FF9800"
    },
    {
      id: "depot_004",
      name: "South Erbil Depot",
      nameKurdish: "ئامارگەی باشووری هەولێر",
      lat: 36.1456,
      lng: 44.0289,
      capacity: 30,
      status: "MAINTENANCE",
      manager: "Rebwar Jalal",
      phone: "+964 750 444 5566",
      address: "Qushtapa Road, South Erbil",
      addressKurdish: "شەقامی قوشتەپە، باشووری هەولێر",
      openTime: "06:00",
      closeTime: "22:00",
      colorHex: "#EF4444"
    },
    {
      id: "depot_005",
      name: "Airport Express Depot",
      nameKurdish: "ئامارگەی خێرای فڕۆکەخانە",
      lat: 36.2345,
      lng: 43.9712,
      capacity: 15,
      status: "FULL",
      manager: "Chiman Nawzad",
      phone: "+964 750 555 6677",
      address: "Erbil International Airport Road",
      addressKurdish: "شەقامی فڕۆکەخانەی نێودەوڵەتی هەولێر",
      openTime: "04:00",
      closeTime: "00:00",
      colorHex: "#00BCD4"
    }
  ];

async function main() {
    console.log('Seeding Depots...');
    
    // Clear old depots
    await prisma.depot.deleteMany();
    
    // Insert depots
    const createdDepots = [];
    for (const d of mockDepots) {
        const depot = await prisma.depot.create({ data: d });
        createdDepots.push(depot);
    }
    
    console.log(`Created ${createdDepots.length} depots.`);
    
    // Assign existing buses evenly across valid depots
    const buses = await prisma.bus.findMany();
    let assigned = 0;
    for (let i = 0; i < buses.length; i++) {
        // Pick a dynamic depot from the 5 available
        const randDepot = createdDepots[i % createdDepots.length];
        await prisma.bus.update({
            where: { id: buses[i].id },
            data: { depotId: randDepot.id }
        });
        assigned++;
    }
    
    console.log(`Assigned ${assigned} existing buses to depots.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
