import os
import pkgutil
import importlib
import structlog
from typing import List

logger = structlog.get_logger()

def find_cogs(cogs_dir: str = "cogs") -> List[str]:
    """
    Recursively find all cogs in the given directory.
    Returns a list of extension names (dotted paths).
    """
    cogs = []
    
    # Walk through the directory
    for root, dirs, files in os.walk(cogs_dir):
        for file in files:
            if file.endswith(".py") and not file.startswith("_"):
                # Construct the module path
                rel_path = os.path.relpath(os.path.join(root, file), start=os.getcwd())
                # If running inside bot directory, start from current dir
                # But we need to be careful about how we are running
                
                # Assuming we are running from inside 'bot' directory (where main.py is)
                # and cogs_dir is relative to that.
                
                # Convert path to dotted notation
                # e.g. cogs/simple_llm.py -> cogs.simple_llm
                
                # Remove .py extension
                module_path = os.path.join(root, file)[:-3]
                
                # Replace path separators with dots
                module_name = module_path.replace(os.sep, ".")
                
                # If the path starts with ./, remove it
                if module_name.startswith("."):
                    module_name = module_name[1:]
                
                cogs.append(module_name)
                
    return cogs

async def load_cogs(bot, cogs_dir: str = "cogs"):
    """
    Load all cogs found in the directory.
    """
    cogs = find_cogs(cogs_dir)
    for cog in cogs:
        try:
            await bot.load_extension(cog)
            logger.info(f"Loaded extension: {cog}")
        except Exception as e:
            logger.error(f"Failed to load extension {cog}: {e}")
