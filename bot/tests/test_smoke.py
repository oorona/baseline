import pytest
import discord
from unittest.mock import MagicMock

@pytest.mark.asyncio
async def test_bot_smoke():
    """Simple smoke test to verify pytest is working."""
    assert True

@pytest.mark.asyncio
async def test_mock_discord_client():
    """Verify we can mock discord client."""
    mock_client = MagicMock(spec=discord.Client)
    assert isinstance(mock_client, discord.Client)
