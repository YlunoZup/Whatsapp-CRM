# WhatsApp CRM - Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Running with Docker](#running-with-docker)
5. [Running without Docker](#running-without-docker)
6. [Production Considerations](#production-considerations)
7. [Scaling](#scaling)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
- Node.js 18+ (LTS recommended)
- pnpm 8+
- PostgreSQL 14+
- Redis 7+
- Docker & Docker Compose (optional, for containerized deployment)

### External Services
- **Evolution API**: WhatsApp Web API instance for WhatsApp integration
  - Documentation: https://doc.evolution-api.com
  - Run your own instance or use a hosted provider

---

## Environment Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/whatsapp-crm.git
cd whatsapp-crm
```

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Configure Environment Variables

Copy the example environment files:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

#### API Environment Variables (`apps/api/.env`)

```env
# Application
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/whatsapp_crm

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# JWT Authentication
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRATION=24h
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_REFRESH_EXPIRATION=7d

# Evolution API (WhatsApp)
EVOLUTION_API_URL=https://your-evolution-api.com
EVOLUTION_API_KEY=your-evolution-api-key

# CORS
CORS_ORIGIN=https://your-frontend-domain.com

# File Uploads
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10485760

# Encryption (for sensitive data)
ENCRYPTION_KEY=your-32-character-encryption-key
```

#### Web Environment Variables (`apps/web/.env`)

```env
VITE_API_URL=https://api.your-domain.com
VITE_WS_URL=wss://api.your-domain.com
```

---

## Database Setup

### 1. Create Database
```bash
createdb whatsapp_crm
```

### 2. Run Migrations
```bash
cd apps/api
pnpm prisma migrate deploy
```

### 3. Seed Initial Data (Optional)
```bash
pnpm prisma db seed
```

This creates a default tenant and admin user:
- Email: `admin@example.com`
- Password: `admin123`

---

## Running with Docker

### Development
```bash
docker-compose up -d
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Docker Compose Services
- **api**: NestJS API server
- **web**: React frontend (Nginx)
- **postgres**: PostgreSQL database
- **redis**: Redis for caching and queues
- **worker**: Background job processor

---

## Running without Docker

### Development

1. Start PostgreSQL and Redis locally

2. Run database migrations:
```bash
cd apps/api
pnpm prisma migrate dev
```

3. Start the API:
```bash
pnpm --filter @whatsapp-crm/api dev
```

4. Start the frontend:
```bash
pnpm --filter @whatsapp-crm/web dev
```

### Production Build

1. Build all packages:
```bash
pnpm build
```

2. Start the API:
```bash
cd apps/api
node dist/main.js
```

3. Serve the frontend:
```bash
# Using any static server
npx serve apps/web/dist -s
```

---

## Production Considerations

### Security Checklist
- [ ] Use strong, unique JWT secrets (32+ characters)
- [ ] Enable HTTPS everywhere
- [ ] Configure proper CORS origins
- [ ] Set up rate limiting
- [ ] Enable audit logging
- [ ] Rotate API keys regularly
- [ ] Keep dependencies updated

### Environment Variables
- Never commit `.env` files to version control
- Use environment variable management (e.g., AWS Secrets Manager, HashiCorp Vault)

### Database
- Enable SSL connections
- Set up automated backups
- Configure connection pooling
- Use read replicas for scaling

### Redis
- Enable persistence (RDB + AOF)
- Use Redis Cluster for high availability
- Configure max memory policy

### File Storage
- Use cloud storage (S3, GCS) for production
- Configure CDN for media files
- Set up lifecycle policies for cleanup

---

## Scaling

### Horizontal Scaling

#### API Servers
- Run multiple API instances behind a load balancer
- Use sticky sessions for WebSocket connections
- Share session data via Redis

#### Background Workers
- Scale worker instances independently
- Use Redis-based queue (BullMQ) for job distribution

### Database Scaling
- Use connection pooling (PgBouncer)
- Add read replicas for read-heavy workloads
- Consider sharding for multi-tenant isolation

### Caching Strategy
- Cache frequently accessed data in Redis
- Use HTTP cache headers for static assets
- Implement query result caching

---

## Monitoring

### Metrics to Track
- API response times
- Error rates
- Active WebSocket connections
- Queue job processing times
- Database query performance
- Memory and CPU usage

### Recommended Tools
- **Prometheus + Grafana**: Metrics and dashboards
- **Sentry**: Error tracking
- **Datadog/New Relic**: APM
- **ELK Stack**: Log aggregation

### Health Checks
The API exposes health check endpoints:
- `GET /health`: Basic health check
- `GET /health/detailed`: Detailed service status

---

## Troubleshooting

### Common Issues

#### WebSocket Connection Fails
- Check CORS configuration
- Verify load balancer WebSocket support
- Ensure sticky sessions are enabled

#### Database Connection Issues
- Verify DATABASE_URL format
- Check network connectivity
- Ensure SSL certificates are valid

#### WhatsApp Session Not Connecting
- Verify Evolution API is accessible
- Check API key validity
- Review Evolution API logs

#### High Memory Usage
- Monitor for memory leaks
- Adjust Node.js heap size
- Review query patterns

### Logs

#### View API Logs
```bash
docker logs -f whatsapp-crm-api
```

#### View Worker Logs
```bash
docker logs -f whatsapp-crm-worker
```

### Debug Mode
Set `LOG_LEVEL=debug` for verbose logging:
```env
LOG_LEVEL=debug
```

---

## Support

For issues and feature requests, please open an issue on GitHub.
