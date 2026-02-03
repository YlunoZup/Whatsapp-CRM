#!/bin/bash

# Database Migration Script for WhatsApp CRM
# This script handles database migrations in different environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get environment
ENV=${NODE_ENV:-development}

echo -e "${GREEN}Running database migrations for environment: ${ENV}${NC}"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}ERROR: DATABASE_URL environment variable is not set${NC}"
    exit 1
fi

# Function to run migrations
run_migrations() {
    echo -e "${YELLOW}Generating Prisma client...${NC}"
    npx prisma generate

    if [ "$ENV" = "production" ]; then
        echo -e "${YELLOW}Deploying migrations to production...${NC}"
        npx prisma migrate deploy
    else
        echo -e "${YELLOW}Running migrations in development mode...${NC}"
        npx prisma migrate dev
    fi
}

# Function to reset database (development only)
reset_database() {
    if [ "$ENV" = "production" ]; then
        echo -e "${RED}ERROR: Cannot reset production database${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Resetting database...${NC}"
    npx prisma migrate reset --force
}

# Function to seed database
seed_database() {
    echo -e "${YELLOW}Seeding database...${NC}"
    npx prisma db seed
}

# Parse arguments
case "$1" in
    "migrate")
        run_migrations
        ;;
    "reset")
        reset_database
        ;;
    "seed")
        seed_database
        ;;
    "deploy")
        npx prisma migrate deploy
        ;;
    "status")
        npx prisma migrate status
        ;;
    *)
        echo "Usage: $0 {migrate|reset|seed|deploy|status}"
        echo ""
        echo "Commands:"
        echo "  migrate  - Run migrations (dev mode in development, deploy in production)"
        echo "  reset    - Reset database (development only)"
        echo "  seed     - Seed database with initial data"
        echo "  deploy   - Deploy pending migrations (production mode)"
        echo "  status   - Show migration status"
        exit 1
        ;;
esac

echo -e "${GREEN}Done!${NC}"
