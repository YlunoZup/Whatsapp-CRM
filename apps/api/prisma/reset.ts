import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting database - deleting all users and tenants...\n');

  // Delete in order to respect foreign key constraints
  // Messages have no user FK, but conversations have assignedTo

  // First, unassign all conversations
  await prisma.conversation.updateMany({
    data: { assignedTo: null },
  });
  console.log('Unassigned all conversations');

  // Delete all audit logs (they reference users)
  const auditLogs = await prisma.auditLog.deleteMany({});
  console.log(`Deleted ${auditLogs.count} audit logs`);

  // Delete all message reactions (they reference users)
  const reactions = await prisma.messageReaction.deleteMany({});
  console.log(`Deleted ${reactions.count} message reactions`);

  // Delete all users
  const users = await prisma.user.deleteMany({});
  console.log(`Deleted ${users.count} users`);

  // Delete all tenants (this will cascade delete everything else)
  const tenants = await prisma.tenant.deleteMany({});
  console.log(`Deleted ${tenants.count} tenants`);

  console.log('\n========================================');
  console.log('Database reset complete!');
  console.log('You can now register a new account.');
  console.log('========================================\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Reset failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
