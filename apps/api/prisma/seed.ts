import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-company' },
    update: {},
    create: {
      name: 'Demo Company',
      slug: 'demo-company',
      plan: 'pro',
      settings: {
        theme: 'light',
        language: 'en',
        timezone: 'America/New_York',
      },
    },
  });
  console.log('Created tenant:', tenant.name);

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      email: 'admin@demo.com',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: 'admin',
      tenantId: tenant.id,
      isActive: true,
    },
  });
  console.log('Created admin user:', admin.email);

  // Create member user
  const memberPassword = await bcrypt.hash('member123', 12);
  const member = await prisma.user.upsert({
    where: { email: 'member@demo.com' },
    update: {},
    create: {
      email: 'member@demo.com',
      passwordHash: memberPassword,
      name: 'Team Member',
      role: 'member',
      tenantId: tenant.id,
      isActive: true,
    },
  });
  console.log('Created member user:', member.email);

  // Create tags
  const tags = await Promise.all([
    prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'VIP' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'VIP',
        color: '#f59e0b',
      },
    }),
    prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'New Lead' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'New Lead',
        color: '#22c55e',
      },
    }),
    prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Support' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Support',
        color: '#3b82f6',
      },
    }),
    prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Sales' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Sales',
        color: '#8b5cf6',
      },
    }),
    prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Urgent' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Urgent',
        color: '#ef4444',
      },
    }),
  ]);
  console.log('Created tags:', tags.length);

  // Create message templates
  const templates = await Promise.all([
    prisma.messageTemplate.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Welcome' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Welcome',
        content: 'Hello {{name}}! Welcome to our service. How can we help you today?',
        variables: ['name'],
        category: 'greeting',
        isActive: true,
      },
    }),
    prisma.messageTemplate.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Thank You' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Thank You',
        content: 'Thank you for contacting us, {{name}}! We appreciate your business.',
        variables: ['name'],
        category: 'closing',
        isActive: true,
      },
    }),
    prisma.messageTemplate.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Out of Office' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Out of Office',
        content: 'Thank you for your message. We are currently out of office and will respond during business hours (Mon-Fri, 9am-6pm).',
        variables: [],
        category: 'auto-reply',
        isActive: true,
      },
    }),
    prisma.messageTemplate.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: 'Follow Up' } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: 'Follow Up',
        content: 'Hi {{name}}, just following up on our previous conversation. Is there anything else you need help with?',
        variables: ['name'],
        category: 'follow-up',
        isActive: true,
      },
    }),
  ]);
  console.log('Created message templates:', templates.length);

  // Create sample contacts
  const contacts = await Promise.all([
    prisma.contact.upsert({
      where: { tenantId_phone: { tenantId: tenant.id, phone: '+5511999990001' } },
      update: {},
      create: {
        tenantId: tenant.id,
        phone: '+5511999990001',
        whatsappId: '5511999990001@s.whatsapp.net',
        name: 'John Doe',
        email: 'john.doe@example.com',
        metadata: { company: 'Acme Corp', position: 'Manager' },
      },
    }),
    prisma.contact.upsert({
      where: { tenantId_phone: { tenantId: tenant.id, phone: '+5511999990002' } },
      update: {},
      create: {
        tenantId: tenant.id,
        phone: '+5511999990002',
        whatsappId: '5511999990002@s.whatsapp.net',
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        metadata: { company: 'Tech Solutions', position: 'CEO' },
      },
    }),
    prisma.contact.upsert({
      where: { tenantId_phone: { tenantId: tenant.id, phone: '+5511999990003' } },
      update: {},
      create: {
        tenantId: tenant.id,
        phone: '+5511999990003',
        whatsappId: '5511999990003@s.whatsapp.net',
        name: 'Bob Wilson',
        metadata: {},
      },
    }),
  ]);
  console.log('Created contacts:', contacts.length);

  // Add tags to contacts
  await prisma.contactTag.createMany({
    data: [
      { contactId: contacts[0]!.id, tagId: tags[0]!.id }, // John - VIP
      { contactId: contacts[0]!.id, tagId: tags[3]!.id }, // John - Sales
      { contactId: contacts[1]!.id, tagId: tags[0]!.id }, // Jane - VIP
      { contactId: contacts[1]!.id, tagId: tags[1]!.id }, // Jane - New Lead
      { contactId: contacts[2]!.id, tagId: tags[2]!.id }, // Bob - Support
    ],
    skipDuplicates: true,
  });
  console.log('Added tags to contacts');

  // Create a demo WhatsApp session
  const session = await prisma.whatsappSession.upsert({
    where: { id: 'demo-session-id' },
    update: {},
    create: {
      id: 'demo-session-id',
      tenantId: tenant.id,
      name: 'Demo WhatsApp',
      status: 'disconnected',
      settings: {
        autoReply: false,
        welcomeMessage: 'Hello! How can I help you?',
      },
    },
  });
  console.log('Created WhatsApp session:', session.name);

  // Create sample conversations
  const conversations = await Promise.all([
    prisma.conversation.upsert({
      where: { sessionId_contactId: { sessionId: session.id, contactId: contacts[0]!.id } },
      update: {},
      create: {
        tenantId: tenant.id,
        sessionId: session.id,
        contactId: contacts[0]!.id,
        status: 'open',
        assignedTo: admin.id,
        unreadCount: 2,
        lastMessageAt: new Date(),
      },
    }),
    prisma.conversation.upsert({
      where: { sessionId_contactId: { sessionId: session.id, contactId: contacts[1]!.id } },
      update: {},
      create: {
        tenantId: tenant.id,
        sessionId: session.id,
        contactId: contacts[1]!.id,
        status: 'open',
        unreadCount: 0,
        lastMessageAt: new Date(Date.now() - 3600000), // 1 hour ago
      },
    }),
  ]);
  console.log('Created conversations:', conversations.length);

  // Create sample messages
  const messages = await Promise.all([
    // Conversation 1 messages
    prisma.message.create({
      data: {
        conversationId: conversations[0]!.id,
        direction: 'inbound',
        type: 'text',
        content: 'Hello! I need help with my order.',
        status: 'received',
        createdAt: new Date(Date.now() - 7200000), // 2 hours ago
      },
    }),
    prisma.message.create({
      data: {
        conversationId: conversations[0]!.id,
        direction: 'outbound',
        type: 'text',
        content: 'Hi John! Of course, I would be happy to help. What is your order number?',
        status: 'read',
        createdAt: new Date(Date.now() - 7000000),
      },
    }),
    prisma.message.create({
      data: {
        conversationId: conversations[0]!.id,
        direction: 'inbound',
        type: 'text',
        content: 'Order #12345',
        status: 'received',
        createdAt: new Date(Date.now() - 6800000),
      },
    }),
    prisma.message.create({
      data: {
        conversationId: conversations[0]!.id,
        direction: 'inbound',
        type: 'text',
        content: 'Can you check the status?',
        status: 'received',
        createdAt: new Date(Date.now() - 300000), // 5 minutes ago
      },
    }),
    // Conversation 2 messages
    prisma.message.create({
      data: {
        conversationId: conversations[1]!.id,
        direction: 'inbound',
        type: 'text',
        content: 'Hi, I am interested in your services.',
        status: 'received',
        createdAt: new Date(Date.now() - 3700000),
      },
    }),
    prisma.message.create({
      data: {
        conversationId: conversations[1]!.id,
        direction: 'outbound',
        type: 'text',
        content: 'Hello Jane! Thank you for reaching out. What services are you interested in?',
        status: 'read',
        createdAt: new Date(Date.now() - 3600000),
      },
    }),
  ]);
  console.log('Created messages:', messages.length);

  // Create webhook endpoint
  const webhook = await prisma.webhookEndpoint.upsert({
    where: { id: 'demo-webhook-id' },
    update: {},
    create: {
      id: 'demo-webhook-id',
      tenantId: tenant.id,
      name: 'Demo n8n Webhook',
      url: 'https://n8n.example.com/webhook/demo',
      events: ['message.received', 'message.sent', 'conversation.created'],
      secret: 'demo-webhook-secret-key',
      isActive: false, // Disabled by default in demo
    },
  });
  console.log('Created webhook endpoint:', webhook.name);

  console.log('\n========================================');
  console.log('Database seeded successfully!');
  console.log('========================================');
  console.log('\nDemo credentials:');
  console.log('  Admin: admin@demo.com / admin123');
  console.log('  Member: member@demo.com / member123');
  console.log('========================================\n');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
