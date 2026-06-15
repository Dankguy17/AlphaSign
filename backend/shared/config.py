# backend/shared/config.py
from pathlib import Path
import os
import yaml
from dotenv import load_dotenv, find_dotenv

# Automatically find and load the .env file globally
load_dotenv(find_dotenv())

def get_backend_root() -> Path:
    """Finds the root backend folder by locating the .env file."""
    dotenv_path = find_dotenv()
    if not dotenv_path:
        raise RuntimeError("Could not find .env file. Ensure it exists in the project root.")
    return Path(dotenv_path).resolve().parent

def load_agent_credentials(agent_name: str) -> tuple[str, str]:
    """
    Dynamically finds agent_config.yaml and extracts the 
    requested agent's id and api_key.
    """
    root = get_backend_root()
    config_path = root / "agent_config.yaml"
    
    if not config_path.is_file():
        raise FileNotFoundError(f"Missing configuration file at {config_path}")
        
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)
        
    if agent_name not in config:
        raise KeyError(f"Agent '{agent_name}' configuration block not found in yaml.")
        
    return config[agent_name]["agent_id"], config[agent_name]["api_key"]