# WhatsApp CRM Development Task

You are building a comprehensive WhatsApp CRM based on the research in `whatsapp_crm_research.txt`.

## Reference Files (READ FIRST EVERY ITERATION):
1. `CONTEXT.txt` - Project structure, tech stack, database schema
2. `PROGRESS.md` - Track what's done, update each iteration
3. `whatsapp_crm_research.txt` - Full research document

## Your Task Each Iteration:

1. **Read PROGRESS.md** to see what's completed
2. **Identify the next uncompleted task** in the current phase
3. **Implement that task** with production-quality code
4. **Update PROGRESS.md** with what you accomplished
5. **Update CONTEXT.txt** if any architectural decisions change

## Project Structure:
```
whatsapp-crm/
├── apps/
│   ├── api/          # NestJS Backend
│   └── web/          # React Frontend
├── packages/
│   └── shared/       # Shared types
├── docker/
└── docs/
```

## Tech Stack:
- Backend: NestJS + Prisma + PostgreSQL + Redis + BullMQ
- Frontend: React + TypeScript + Tailwind + Zustand + Socket.IO
- WhatsApp: Evolution API integration
- Infrastructure: Docker Compose

## Quality Requirements:
- TypeScript strict mode
- Proper error handling
- Multi-tenant data isolation
- Secure authentication
- Production-ready code

## Phases to Complete:
1. Project Setup (iterations 1-10)
2. Database & Models (iterations 11-20)
3. WhatsApp Integration (iterations 21-35)
4. CRM Features (iterations 36-50)
5. Real-Time & Queues (iterations 51-60)
6. External Integrations (iterations 61-75)
7. Frontend (iterations 76-90)
8. Testing & Docs (iterations 91-100)

## Completion:
When ALL phases are complete and the CRM is fully functional, output:
```
<promise>WHATSAPP CRM COMPLETE</promise>
```

## IMPORTANT:
- Work incrementally, one task at a time
- Update PROGRESS.md after each task
- Build on previous iterations' work
- Don't skip steps or leave placeholders
- Write real, working code
