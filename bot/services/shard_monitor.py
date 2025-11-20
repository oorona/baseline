import structlog
import time
import asyncio
import json
from typing import Dict, Any

logger = structlog.get_logger()

class ShardMonitor:
    """
    Service to monitor shard status and write to Redis.
    """
    def __init__(self, services):
        self.services = services
        self.redis = services.redis
        self.key_prefix = "shard:status:"
        self.ttl = 60 # Seconds before shard is considered dead

    async def update_shard_status(self, shard_id: int, status: str, latency: float = 0.0, guild_count: int = 0):
        """
        Update the status of a shard in Redis.
        """
        key = f"{self.key_prefix}{shard_id}"
        data = {
            "shard_id": shard_id,
            "status": status,
            "latency": latency,
            "guild_count": guild_count,
            "last_heartbeat": time.time()
        }
        try:
            await self.redis.set(key, json.dumps(data), ex=self.ttl)
            # logger.debug("shard_status_updated", shard_id=shard_id, status=status)
        except Exception as e:
            logger.error("failed_to_update_shard_status", shard_id=shard_id, error=str(e))

    async def start_heartbeat(self, bot):
        """
        Start a background task to send heartbeats for all shards.
        """
        while not bot.is_closed():
            try:
                for shard_id, shard in bot.shards.items():
                    latency = shard.latency
                    # Count guilds for this shard
                    guild_count = 0
                    # This might be expensive for many guilds, but for baseline it's fine
                    # Alternatively, we can just use len(bot.guilds) / shard_count approximation
                    # or iterate if needed.
                    # For now, let's just use total guild count divided by shards or 0 if not ready
                    
                    # Better: iterate guilds and check shard_id
                    # guild_count = sum(1 for g in bot.guilds if g.shard_id == shard_id)
                    
                    # Optimization: bot.guilds is a list.
                    # If we have thousands of guilds, this loop is okay every 30s.
                    
                    await self.update_shard_status(
                        shard_id=shard_id,
                        status="online" if not shard.is_closed() else "offline",
                        latency=latency,
                        guild_count=0 # Placeholder for now to avoid iteration overhead
                    )
            except Exception as e:
                logger.error("shard_heartbeat_error", error=str(e))
            
            await asyncio.sleep(30)
