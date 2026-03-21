const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// The requested color algorithm
function generateRouteColors(count) {
  const colors = [];
  for (let i = 0; i < count; i++) {
    const hue = Math.round((i * 137.508) % 360); // golden angle distribution
    const saturation = 65 + (i % 3) * 10; // 65%, 75%, or 85%
    const lightness = 42 + (i % 4) * 6;  // 42%, 48%, 54%, or 60%
    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  }
  return colors;
}

// Convert HSL to Hex
function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

// Ensure hex parsing
function hslStringTohHex(hslStr) {
  const match = hslStr.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (match) {
    return hslToHex(parseInt(match[1]), parseInt(match[2]), parseInt(match[3]));
  }
  return '#1877F2';
}

const hubs = [
    { name: 'Erbil Citadel', lat: 36.1901, lng: 44.0089 },
    { name: 'Ankawa', lat: 36.2193, lng: 43.9971 },
    { name: 'Empire World Mall', lat: 36.1756, lng: 44.0045 },
    { name: 'Family Mall', lat: 36.1823, lng: 43.9912 },
    { name: 'Italian Village', lat: 36.2156, lng: 44.0234 },
    { name: 'Gulan Street', lat: 36.1967, lng: 44.0167 },
    { name: '60m Street', lat: 36.1834, lng: 44.0234 },
    { name: '100m Street', lat: 36.2012, lng: 44.0312 },
    { name: 'Dream City', lat: 36.2089, lng: 44.0456 },
    { name: 'Bakhtiari', lat: 36.1756, lng: 44.0312 },
    { name: 'Shorish', lat: 36.1823, lng: 44.0123 },
    { name: 'Qushtapa', lat: 36.1534, lng: 44.0567 },
    { name: 'Kasnazan', lat: 36.2345, lng: 44.0678 },
    { name: 'Shaqlawa Road', lat: 36.2167, lng: 44.0789 },
    { name: 'Rizgary', lat: 36.1912, lng: 44.0234 },
    { name: 'Iskan', lat: 36.1678, lng: 44.0189 },
    { name: 'Zanko', lat: 36.1589, lng: 43.9967 },
    { name: 'Mamzawa', lat: 36.1456, lng: 43.9834 },
    { name: 'Darbandikhan Road', lat: 36.1234, lng: 44.0567 },
    { name: 'Erbil Airport', lat: 36.2378, lng: 43.9634 },
    { name: 'Sami Abdulrahman Park', lat: 36.1934, lng: 44.0056 },
    { name: 'Erbil Bus Terminal', lat: 36.1756, lng: 44.0456 },
    { name: 'Koya Road', lat: 36.2234, lng: 44.0890 },
    { name: 'Duhok Road (North)', lat: 36.2456, lng: 44.0234 },
    { name: 'Sulaymaniyah Road', lat: 36.1345, lng: 44.0678 },
    { name: 'Ainkawa Road', lat: 36.2089, lng: 43.9845 },
    { name: 'Medical City Hospital', lat: 36.1867, lng: 44.0312 },
    { name: 'Erbil Stadium', lat: 36.1934, lng: 44.0345 },
    { name: 'Rozhawa', lat: 36.1623, lng: 44.0089 },
    { name: 'Naznaz', lat: 36.2012, lng: 43.9956 }
];

function generateKurdishName(englishName) {
    const translations = {
        'Express': 'خێرا',
        'Inner City': 'ناوەندی شار',
        'North': 'باکوور',
        'East': 'رۆژهەڵات',
        'South': 'باشوور',
        'Cross-City': 'بەناو شاردا',
        'Route': 'ڕێگا'
    };
    let kurdish = englishName;
    for (const [eng, kur] of Object.entries(translations)) {
        kurdish = kurdish.replace(eng, kur);
    }
    return kurdish;
}

async function main() {
    console.log('Clearing existing data...');
    await prisma.schedule.deleteMany();
    await prisma.bus.deleteMany();
    await prisma.stop.deleteMany();
    await prisma.route.deleteMany();
    // await prisma.admin.deleteMany(); // Keep admin or recreate if needed. Let's recreate to be safe.
    
    const hashedPassword = await bcrypt.hash('Admin@1234', 12);
    await prisma.admin.upsert({
        where: { email: 'admin@erbilbus.iq' },
        update: { passwordHash: hashedPassword, name: 'Admin User' },
        create: { email: 'admin@erbilbus.iq', passwordHash: hashedPassword, name: 'Admin User' }
    });
    console.log('✅ Admin seeded/refreshed');

    const hslColors = generateRouteColors(100);
    const generatedRoutes = [];
    const generatedStops = [];
    const generatedSchedules = [];

    const depotNames = ['CENTRAL_DEPOT', 'ANKAWA_DEPOT', 'CITADEL_DEPOT', 'SOUTH_ERBIL_DEPOT', 'EAST_ERBIL_DEPOT', 'AIRPORT_DEPOT'];
    for (const d of depotNames) {
        await prisma.depot.create({
            data: {
                name: d, nameKurdish: d, lat: 36.19, lng: 44.01, capacity: 50, status: 'ACTIVE', colorHex: '#00BCD4'
            }
        });
    }
    console.log('Generating 100 Routes & Stops...');
    for (let i = 0; i < 100; i++) {
        const routeNum = i + 1;
        let category = 'Express';
        if (i < 20) category = 'Inner City';
        else if (i < 40) category = 'North';
        else if (i < 60) category = 'East';
        else if (i < 80) category = 'South';
        else category = 'Cross-City';

        // Select origins and destination randomly but with some logical spread
        const oIdx = Math.floor(Math.random() * hubs.length);
        let dIdx = Math.floor(Math.random() * hubs.length);
        while(dIdx === oIdx) dIdx = Math.floor(Math.random() * hubs.length);

        const origin = hubs[oIdx];
        const dest = hubs[dIdx];
        
        const nameEng = `Route ${routeNum} - ${category} (${origin.name} to ${dest.name})`;
        const nameKur = `ڕێگا ${routeNum} - ${generateKurdishName(category)}`;
        const hex = hslStringTohHex(hslColors[i]);
        
        const statuses = ['RUNNING', 'RUNNING', 'RUNNING', 'RUNNING', 'DELAYED', 'OUT_OF_SERVICE'];
        const status = statuses[Math.floor(Math.random() * statuses.length)];

        // Generate 4 to 8 stops between origin and dest
        const numStops = Math.floor(Math.random() * 5) + 4; // 4 to 8
        const waypoints = [];
        
        for (let s = 0; s < numStops; s++) {
            const fraction = s / (numStops - 1);
            // Linear interpolation
            let splat = origin.lat + (dest.lat - origin.lat) * fraction;
            let splng = origin.lng + (dest.lng - origin.lng) * fraction;
            // Add tiny noise (0 to 0.005) to simulate not perfectly straight lines, except for first/last
            if (s > 0 && s < numStops - 1) {
                splat += (Math.random() - 0.5) * 0.01;
                splng += (Math.random() - 0.5) * 0.01;
            }
            waypoints.push([splat, splng]);
            
            generatedStops.push({
                name: s === 0 ? origin.name : (s === numStops - 1 ? dest.name : `Stop ${s} near ${origin.name}`),
                latitude: splat,
                longitude: splng,
                routeIndex: i // temporary link
            });
        }

        generatedRoutes.push({
            name: nameEng,
            nameKurdish: nameKur,
            colorHex: hex,
            status: status,
            description: `Connects ${origin.name} and ${dest.name} covering ${category} Erbil.`,
            isFavorite: false,
            waypoints: JSON.stringify(waypoints)
        });
    }

    // Insert to DB using raw loops or createMany
    // Prisma SQLite doesn't bulk-create well with relations, so iterate
    for (let i = 0; i < generatedRoutes.length; i++) {
        const rData = generatedRoutes[i];
        const route = await prisma.route.create({ data: rData });
        
        const routeStops = generatedStops.filter(s => s.routeIndex === i);
        // Create stops and schedules to link them to the route
        for (let j = 0; j < routeStops.length; j++) {
            const sData = routeStops[j];
            const stop = await prisma.stop.create({
                data: { name: sData.name, latitude: sData.latitude, longitude: sData.longitude }
            });
            // Link via schedule
            await prisma.schedule.create({
                data: {
                    stopId: stop.id,
                    routeId: route.id,
                    arrivalTime: `1${Math.floor(Math.random() * 2)}:${Math.floor(Math.random() * 5)}${Math.floor(Math.random() * 9)}`,
                    isRealtime: true
                }
            });
        }
    }

    console.log('Generating 20 active buses...');
    for (let i = 0; i < 20; i++) {
        // Assign to a random route
        const rIndex = Math.floor(Math.random() * generatedRoutes.length);
        // Find the actual route. We can pick its first stop for coordinates
        const rt = await prisma.route.findFirst({ skip: rIndex });
        if (rt) {
            const rtStops = await prisma.routeStop.findMany({ where: { routeId: rt.id }, include: { stop: true } });
            let lat = 36.19;
            let lng = 44.01;
            if (rtStops.length > 0) {
                lat = rtStops[0].stop.latitude;
                lng = rtStops[0].stop.longitude;
            }
            
            await prisma.bus.create({
                data: {
                    route: { connect: { id: rt.id } },
                    latitude: lat + (Math.random() - 0.5) * 0.005,
                    longitude: lng + (Math.random() - 0.5) * 0.005,
                    status: i % 5 === 0 ? 'DELAYED' : 'RUNNING'
                }
            });
        }
    }

    console.log('✅ 100 Routes, corresponding Stops, Schedules, and 20 Buses seeded');
    console.log('Generating 20 realistic drivers...');

    const drivers = [
        {
            fullName: "Ahmad Kareem Mahmoud",
            fullNameKurdish: "ئەحمەد کەریم مەحمود",
            employeeCode: "DRV-0001",
            phoneNumber: "+964 750 123 4567",
            phoneNumberAlt: "+964 770 987 6543",
            email: "ahmad.kareem@erbilbus.iq",
            address: "Ankawa District, Street 14, House 22, Erbil",
            licenseNumber: "EBL-2019-00142",
            licenseType: "CLASS_A",
            licenseExpiry: new Date("2026-08-15"),
            licenseIssuedBy: "Erbil Traffic Directorate",
            carPlateNumber: "ه ر 12345",
            depotName: "ANKAWA_DEPOT",
            depotLocation: "Ankawa Industrial Zone, Erbil",
            shift: "MORNING",
            supervisorName: "Hassan Ali",
            status: "ACTIVE",
            hireDate: new Date("2019-03-10"),
            contractType: "FULL_TIME",
            emergencyContactName: "Kareem Mahmoud",
            emergencyContactPhone: "+964 750 111 2222",
            emergencyContactRelation: "Father",
            notes: "Excellent safety record. 5 years without incident."
        },
        {
            fullName: "Saman Azad Majeed",
            fullNameKurdish: "سامان ئازاد مەجید",
            employeeCode: "DRV-0002",
            phoneNumber: "+964 750 222 3344",
            licenseNumber: "EBL-2020-00211",
            licenseType: "CLASS_B",
            licenseExpiry: new Date("2025-11-20"),
            carPlateNumber: "ه ر 23456",
            depotName: "CITADEL_DEPOT",
            shift: "AFTERNOON",
            status: "ACTIVE",
            hireDate: new Date("2020-05-15"),
            contractType: "FULL_TIME"
        },
        {
            fullName: "Rebaz Othman Qadir",
            fullNameKurdish: "ڕێباز عوسمان قادر",
            employeeCode: "DRV-0003",
            phoneNumber: "+964 770 333 4455",
            licenseNumber: "EBL-2018-00512",
            licenseType: "CLASS_A",
            licenseExpiry: new Date("2024-05-10"),
            depotName: "EAST_ERBIL_DEPOT",
            shift: "NIGHT",
            status: "ACTIVE",
            hireDate: new Date("2018-09-01"),
            contractType: "FULL_TIME"
        },
        {
            fullName: "Karwan Ali Hassan",
            fullNameKurdish: "کاروان عەلی حەسەن",
            employeeCode: "DRV-0004",
            phoneNumber: "+964 751 444 5566",
            licenseNumber: "EBL-2021-00833",
            licenseType: "CLASS_C",
            licenseExpiry: new Date("2026-02-28"),
            depotName: "SOUTH_ERBIL_DEPOT",
            shift: "ROTATING",
            status: "ACTIVE",
            hireDate: new Date("2021-01-20"),
            contractType: "CONTRACT"
        },
        {
            fullName: "Niyan Hawkar Rasool",
            fullNameKurdish: "نیان هاوکار ڕەسول",
            employeeCode: "DRV-0005",
            phoneNumber: "+964 750 555 6677",
            licenseNumber: "EBL-2017-00445",
            licenseType: "CLASS_A",
            licenseExpiry: new Date("2025-07-15"),
            depotName: "AIRPORT_DEPOT",
            shift: "MORNING",
            status: "ACTIVE",
            hireDate: new Date("2017-06-10"),
            contractType: "FULL_TIME"
        },
        {
            fullName: "Ako Jamal Hussein",
            fullNameKurdish: "ئاکۆ جەماڵ حسێن",
            employeeCode: "DRV-0006",
            phoneNumber: "+964 770 666 7788",
            licenseNumber: "EBL-2015-00991",
            licenseType: "CLASS_B",
            licenseExpiry: new Date("2027-01-05"),
            depotName: "CENTRAL_DEPOT",
            shift: "AFTERNOON",
            status: "ON_LEAVE",
            hireDate: new Date("2015-08-01"),
            contractType: "FULL_TIME"
        },
        {
            fullName: "Dana Omar Saeed",
            fullNameKurdish: "دانا عومەر سەعید",
            employeeCode: "DRV-0007",
            phoneNumber: "+964 750 777 8899",
            licenseNumber: "EBL-2016-00332",
            licenseType: "CLASS_A",
            licenseExpiry: new Date("2024-12-10"),
            depotName: "ANKAWA_DEPOT",
            shift: "NIGHT",
            status: "ON_LEAVE",
            hireDate: new Date("2016-04-11"),
            contractType: "FULL_TIME"
        },
        {
            fullName: "Peshawa Sardar Nader",
            fullNameKurdish: "پێشەوا سەردار نادر",
            employeeCode: "DRV-0008",
            phoneNumber: "+964 770 888 9900",
            licenseNumber: "EBL-2022-00101",
            licenseType: "CLASS_C",
            licenseExpiry: new Date("2027-05-22"),
            depotName: "CITADEL_DEPOT",
            shift: "ROTATING",
            status: "SUSPENDED",
            hireDate: new Date("2022-03-01"),
            contractType: "CONTRACT"
        },
        {
            fullName: "Soraya Bakhtiar Amin",
            fullNameKurdish: "سورەیا بەختیار ئەمین",
            employeeCode: "DRV-0009",
            phoneNumber: "+964 751 999 0011",
            licenseNumber: "EBL-2010-00876",
            licenseType: "CLASS_A",
            licenseExpiry: new Date("2025-08-30"),
            depotName: "EAST_ERBIL_DEPOT",
            shift: "MORNING",
            status: "SUSPENDED",
            hireDate: new Date("2010-02-15"),
            contractType: "FULL_TIME"
        },
        {
            fullName: "Dlshad Nawzad Taha",
            fullNameKurdish: "دڵشاد نەوزاد تەها",
            employeeCode: "DRV-0010",
            phoneNumber: "+964 750 101 1122",
            licenseNumber: "EBL-2013-00567",
            licenseType: "CLASS_A",
            licenseExpiry: new Date("2024-03-12"),
            depotName: "SOUTH_ERBIL_DEPOT",
            shift: "AFTERNOON",
            status: "RETIRED",
            hireDate: new Date("2013-09-10"),
            terminationDate: new Date("2023-12-01"),
            contractType: "FULL_TIME"
        },
        {
            fullName: "Shwan Asaad Khoshnaw",
            fullNameKurdish: "شوان ئەسعەد خۆشناو",
            employeeCode: "DRV-0011",
            phoneNumber: "+964 770 202 2233",
            licenseNumber: "EBL-2019-00999",
            licenseType: "CLASS_B",
            licenseExpiry: new Date("2026-10-18"),
            depotName: "AIRPORT_DEPOT",
            shift: "NIGHT",
            status: "TERMINATED",
            hireDate: new Date("2019-07-05"),
            terminationDate: new Date("2022-05-15"),
            contractType: "PART_TIME"
        },
        {
            fullName: "Hejar Khasraw Mardan",
            fullNameKurdish: "هەژار خەسرەو مەردان",
            employeeCode: "DRV-0012",
            phoneNumber: "+964 750 303 3344",
            licenseNumber: "EBL-2023-00111",
            licenseType: "CLASS_A",
            licenseExpiry: new Date("2028-01-20"),
            depotName: "CENTRAL_DEPOT",
            shift: "ROTATING",
            status: "ACTIVE",
            hireDate: new Date("2023-02-10"),
            contractType: "FULL_TIME"
        },
        {
            fullName: "Araz Fuad Qader",
            fullNameKurdish: "ئاراز فوئاد قادر",
            employeeCode: "DRV-0013",
            phoneNumber: "+964 751 404 4455",
            licenseNumber: "EBL-2018-00222",
            licenseType: "CLASS_A",
            licenseExpiry: new Date("2025-04-11"),
            depotName: "ANKAWA_DEPOT",
            shift: "MORNING",
            status: "ACTIVE",
            hireDate: new Date("2018-06-25"),
            contractType: "FULL_TIME"
        },
        {
            fullName: "Bahar Sirwan Latif",
            fullNameKurdish: "بەهار سیروان لەتیف",
            employeeCode: "DRV-0014",
            phoneNumber: "+964 750 505 5566",
            licenseNumber: "EBL-2020-00333",
            licenseType: "CLASS_B",
            licenseExpiry: new Date("2026-09-09"),
            depotName: "CITADEL_DEPOT",
            shift: "AFTERNOON",
            status: "ACTIVE",
            hireDate: new Date("2020-08-14"),
            contractType: "FULL_TIME"
        },
        {
            fullName: "Falah Hama Salih",
            fullNameKurdish: "فەلاح حەمە ساڵح",
            employeeCode: "DRV-0015",
            phoneNumber: "+964 770 606 6677",
            licenseNumber: "EBL-2017-00444",
            licenseType: "CLASS_A",
            licenseExpiry: new Date("2024-11-21"),
            depotName: "EAST_ERBIL_DEPOT",
            shift: "NIGHT",
            status: "ACTIVE",
            hireDate: new Date("2017-10-30"),
            contractType: "FULL_TIME"
        },
        {
            fullName: "Goran Tariq Jabar",
            fullNameKurdish: "گۆران تاریق جەبار",
            employeeCode: "DRV-0016",
            phoneNumber: "+964 751 707 7788",
            licenseNumber: "EBL-2021-00555",
            licenseType: "CLASS_C",
            licenseExpiry: new Date("2027-12-15"),
            depotName: "SOUTH_ERBIL_DEPOT",
            shift: "ROTATING",
            status: "ACTIVE",
            hireDate: new Date("2021-11-05"),
            contractType: "CONTRACT"
        },
        {
            fullName: "Hawre Anwar Fatih",
            fullNameKurdish: "هاوڕێ ئەنوەر فاتیح",
            employeeCode: "DRV-0017",
            phoneNumber: "+964 750 808 8899",
            licenseNumber: "EBL-2015-00666",
            licenseType: "CLASS_A",
            licenseExpiry: new Date("2025-01-30"),
            depotName: "AIRPORT_DEPOT",
            shift: "MORNING",
            status: "ACTIVE",
            hireDate: new Date("2015-05-18"),
            contractType: "FULL_TIME"
        },
        {
            fullName: "Jwan Rostam Nuri",
            fullNameKurdish: "جوان ڕۆستەم نوری",
            employeeCode: "DRV-0018",
            phoneNumber: "+964 770 909 9900",
            licenseNumber: "EBL-2016-00777",
            licenseType: "CLASS_B",
            licenseExpiry: new Date("2024-08-08"),
            depotName: "CENTRAL_DEPOT",
            shift: "AFTERNOON",
            status: "ACTIVE",
            hireDate: new Date("2016-07-22"),
            contractType: "FULL_TIME"
        },
        {
            fullName: "Kamaran Tahir Zrar",
            fullNameKurdish: "کامەران تاهیر زرار",
            employeeCode: "DRV-0019",
            phoneNumber: "+964 751 010 1122",
            licenseNumber: "EBL-2022-00888",
            licenseType: "CLASS_A",
            licenseExpiry: new Date("2028-06-19"),
            depotName: "ANKAWA_DEPOT",
            shift: "NIGHT",
            status: "ACTIVE",
            hireDate: new Date("2022-09-12"),
            contractType: "PART_TIME"
        },
        {
            fullName: "Lanja Dler Qadir",
            fullNameKurdish: "لانە دلێر قادر",
            employeeCode: "DRV-0020",
            phoneNumber: "+964 750 121 2233",
            licenseNumber: "EBL-2014-00999",
            licenseType: "CLASS_A",
            licenseExpiry: new Date("2025-03-25"),
            depotName: "CITADEL_DEPOT",
            shift: "ROTATING",
            status: "ACTIVE",
            hireDate: new Date("2014-11-03"),
            contractType: "FULL_TIME"
        }
    ];

    for (const driver of drivers) {
        await prisma.driver.upsert({
            where: { employeeCode: driver.employeeCode },
            update: {},
            create: driver
        });
    }

    console.log('✅ 20 Drivers seeded');
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
