import redis.asyncio as redis
from app.core.config import settings

# Create a global Redis pool
redis_pool = redis.ConnectionPool.from_url(settings.REDIS_URL)

async def get_redis():
    client = redis.Redis(connection_pool=redis_pool)
    try:
        yield client
    finally:
        await client.close()
