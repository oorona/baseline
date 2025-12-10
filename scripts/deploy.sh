#!/bin/bash
set -e

echo "🚀 Starting deployment..."

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Build and start services
echo "🔨 Building and starting services..."
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Run migrations
echo "🔄 Running database migrations..."
docker compose exec backend alembic upgrade head

echo "✅ Deployment complete!"
echo "📊 Service status:"
docker compose ps
