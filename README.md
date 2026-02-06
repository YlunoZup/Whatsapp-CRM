# WhatsApp CRM

A multi-tenant WhatsApp CRM platform for managing customer conversations, contacts, and broadcasts at scale.

## Features

- **Multi-tenant Architecture** - Support multiple organizations with isolated data
- **WhatsApp Integration** - Direct WhatsApp Web connection via Baileys
- **Real-time Messaging** - WebSocket-based live chat updates
- **Contact Management** - Organize contacts with tags and custom fields
- **Conversation Inbox** - Unified inbox for all WhatsApp conversations
- **Message Templates** - Pre-defined templates for quick responses
- **Broadcast Campaigns** - Send bulk messages with rate limiting
- **Team Collaboration** - Assign conversations to team members
- **Analytics Dashboard** - Track message metrics and team performance
- **Webhook Integrations** - Connect with external services
- **API Access** - RESTful API for custom integrations

## Tech Stack

### Backend
- **Framework**: NestJS (Node.js)
- **Database**: PostgreSQL (NeonDB)
- **Cache**: Redis (Upstash)
- **ORM**: Prisma
- **WhatsApp**: Baileys (WhatsApp Web API)
- **Real-time**: Socket.IO

### Frontend
- **Framework**: React + Vite
- **UI**: Tailwind CSS + shadcn/ui
- **State**: Zustand
- **Forms**: React Hook Form + Zod

## Project Structure

```
├── apps/
│   ├── api/          # NestJS backend
│   └── web/          # React frontend
├── packages/
│   └── shared/       # Shared types and utilities
└── docker/           # Docker deployment configs
```

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 8+
- PostgreSQL database
- Redis instance

### Installation

1. Clone the repository
```bash
git clone https://github.com/YlunoZup/Whatsapp-CRM.git
cd Whatsapp-CRM
```

2. Install dependencies
```bash
pnpm install
```

3. Set up environment variables
```bash
cp apps/api/.env.example apps/api/.env
# Edit .env with your database and Redis credentials
```

4. Run database migrations
```bash
cd apps/api
pnpm prisma:push
```

5. Start development servers
```bash
# Terminal 1 - Backend
cd apps/api
pnpm dev

# Terminal 2 - Frontend
cd apps/web
pnpm dev
```

## Environment Variables

### Backend (apps/api/.env)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_HOST` | Redis host |
| `REDIS_PORT` | Redis port |
| `REDIS_PASSWORD` | Redis password |
| `REDIS_TLS` | Enable TLS for Redis |
| `JWT_SECRET` | JWT signing secret |
| `JWT_REFRESH_SECRET` | Refresh token secret |
| `CORS_ORIGIN` | Allowed CORS origin |
| `ENCRYPTION_KEY` | 32-char encryption key |

## Deployment

### Docker (Portainer)

The `docker/docker-compose.portainer.yml` file is configured for deployment via Portainer with git-based stack management.

### Vercel (Frontend)

The frontend is configured for Vercel deployment with API proxy rewrites in `vercel.json`.

## API Documentation

When running in development mode, Swagger documentation is available at:
```
http://localhost:3001/api/docs
```

## License

MIT
