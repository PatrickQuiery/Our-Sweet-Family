const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // Create owner
  const owner = await prisma.user.upsert({
    where: { email: 'parent@demo.com' },
    update: {},
    create: {
      email: 'parent@demo.com',
      passwordHash,
      name: 'Alex Johnson',
      role: 'owner',
      plan: 'plus',
    },
  });

  // Create loved one
  const lovedOne = await prisma.user.upsert({
    where: { email: 'grandma@demo.com' },
    update: {},
    create: {
      email: 'grandma@demo.com',
      passwordHash,
      name: 'Grandma Betty',
      role: 'loved_one',
      plan: 'free',
    },
  });

  // Create family
  const family = await prisma.family.upsert({
    where: { id: 'demo-family-id' },
    update: {},
    create: {
      id: 'demo-family-id',
      name: 'The Johnson Family',
      ownerId: owner.id,
    },
  });

  // Create children
  const emma = await prisma.child.upsert({
    where: { id: 'demo-child-emma' },
    update: {},
    create: {
      id: 'demo-child-emma',
      familyId: family.id,
      name: 'Emma',
      dateOfBirth: new Date('2021-03-15'),
    },
  });

  const liam = await prisma.child.upsert({
    where: { id: 'demo-child-liam' },
    update: {},
    create: {
      id: 'demo-child-liam',
      familyId: family.id,
      name: 'Liam',
      dateOfBirth: new Date('2023-07-22'),
    },
  });

  // Create family member
  await prisma.familyMember.upsert({
    where: { familyId_userId: { familyId: family.id, userId: lovedOne.id } },
    update: {},
    create: {
      familyId: family.id,
      userId: lovedOne.id,
      permissions: 'view_only',
      accessPerChild: 'all',
    },
  });

  // Create some demo memories
  const demoMemories = [
    {
      id: 'memory-1',
      familyId: family.id,
      childIds: [emma.id],
      uploadedById: owner.id,
      fileUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1519689680058-324335c77eba?w=400',
      fileType: 'photo',
      capturedAt: new Date('2023-05-10'),
      caption: 'Emma at the park',
    },
    {
      id: 'memory-2',
      familyId: family.id,
      childIds: [emma.id, liam.id],
      uploadedById: owner.id,
      fileUrl: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=400',
      fileType: 'photo',
      capturedAt: new Date('2023-12-25'),
      caption: 'Christmas morning!',
    },
    {
      id: 'memory-3',
      familyId: family.id,
      childIds: [liam.id],
      uploadedById: owner.id,
      fileUrl: 'https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1471286174890-9c112ffca5b4?w=400',
      fileType: 'photo',
      capturedAt: new Date('2024-01-22'),
      caption: "Liam's first steps!",
    },
    {
      id: 'memory-4',
      familyId: family.id,
      childIds: [emma.id],
      uploadedById: owner.id,
      fileUrl: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=400',
      fileType: 'photo',
      capturedAt: new Date('2024-03-15'),
      caption: "Emma's 3rd birthday party!",
    },
    {
      id: 'memory-5',
      familyId: family.id,
      childIds: [emma.id, liam.id],
      uploadedById: owner.id,
      fileUrl: 'https://images.unsplash.com/photo-1489710437720-ebb67ec84dd2?w=800',
      thumbnailUrl: 'https://images.unsplash.com/photo-1489710437720-ebb67ec84dd2?w=400',
      fileType: 'photo',
      capturedAt: new Date('2024-06-15'),
      caption: 'Summer fun at the beach',
    },
  ];

  for (const memory of demoMemories) {
    await prisma.memory.upsert({
      where: { id: memory.id },
      update: {},
      create: memory,
    });
  }

  // Add a milestone
  await prisma.milestone.upsert({
    where: { id: 'milestone-1' },
    update: {},
    create: {
      id: 'milestone-1',
      childId: emma.id,
      type: 'height',
      value: '92',
      unit: 'cm',
      note: 'Annual checkup',
      date: new Date('2024-03-15'),
    },
  });

  console.log('✅ Seed complete!');
  console.log('Demo accounts:');
  console.log('  Parent: parent@demo.com / password123');
  console.log('  Grandma: grandma@demo.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
