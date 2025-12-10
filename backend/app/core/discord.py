import httpx
from typing import List, Dict, Optional
from app.core.config import settings

class DiscordClient:
    def __init__(self):
        self.base_url = "https://discord.com/api/v10"
        self.token = settings.DISCORD_BOT_TOKEN
        self.headers = {
            "Authorization": f"Bot {self.token}",
            "Content-Type": "application/json",
        }

    async def get_guild_channels(self, guild_id: str) -> List[Dict]:
        if not self.token:
            raise ValueError("Discord Bot Token is not set")
            
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/guilds/{guild_id}/channels",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()

    async def get_guild_roles(self, guild_id: str) -> List[Dict]:
        if not self.token:
            raise ValueError("Discord Bot Token is not set")

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/guilds/{guild_id}/roles",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()

discord_client = DiscordClient()
