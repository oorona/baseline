.PHONY: help up down prod logs migrate restart-backend restart-bot restart-frontend clean

help:
	@echo "Available commands:"
	@echo "  make up              - Start development environment"
	@echo "  make down            - Stop all services"
	@echo "  make prod            - Start production environment"
	@echo "  make logs            - View logs from all services"
	@echo "  make migrate         - Run database migrations"
	@echo "  make restart-backend - Restart backend service"
	@echo "  make restart-bot     - Restart bot service"
	@echo "  make restart-frontend- Restart frontend service"
	@echo "  make clean           - Stop and remove containers, volumes"

up:
	docker compose up -d

down:
	docker compose down

prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

logs:
	docker compose logs -f

migrate:
	docker compose exec backend alembic upgrade head

restart-backend:
	docker compose restart backend

restart-bot:
	docker compose restart bot

restart-frontend:
	docker compose restart frontend

clean:
	docker compose down -v
