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

    async def search_guild_members(self, guild_id: str, query: str, limit: int = 20) -> List[Dict]:
        if not self.token:
            raise ValueError("Discord Bot Token is not set")

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/guilds/{guild_id}/members/search",
                headers=self.headers,
                params={"query": query, "limit": limit}
            )
            response.raise_for_status()
            return response.json()

    async def get_guild_member(self, guild_id: str, user_id: str) -> Dict:
        if not self.token:
            raise ValueError("Discord Bot Token is not set")
            
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/guilds/{guild_id}/members/{user_id}",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()

    async def get_user(self, user_id: str) -> Dict:
        if not self.token:
            raise ValueError("Discord Bot Token is not set")
            
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/users/{user_id}",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()

    async def get_guild(self, guild_id: str) -> Dict:
        if not self.token:
            raise ValueError("Discord Bot Token is not set")
            
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/guilds/{guild_id}",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()

    async def get_current_user_guilds(self, access_token: str) -> List[Dict]:
        """Fetch guilds for the authenticated user using their Bearer token."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/users/@me/guilds",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            return response.json()

discord_client = DiscordClient()
