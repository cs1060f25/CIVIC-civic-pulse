#!/usr/bin/env python3
"""
Config loader with validation against schema.json and target date computation.
"""

import argparse
import json
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Dict

try:
    import yaml
except ImportError:
    print("Error: PyYAML is required. Install with: pip install pyyaml")
    exit(1)


# Month name mapping
MONTH_NAMES = {
    1: "January", 2: "February", 3: "March", 4: "April",
    5: "May", 6: "June", 7: "July", 8: "August",
    9: "September", 10: "October", 11: "November", 12: "December"
}


def get_backend_path() -> Path:
    """Get the backend directory path relative to this module."""
    # This file is in civicpulse/src/ingestion/
    # Backend is at ../../../backend (up to civicpulse, then up to CIVIC-civic-pulse, then to backend)
    current_dir = Path(__file__).resolve().parent
    
    # Check if we're in local development (civicpulse/src/ingestion/)
    local_backend = current_dir.parent.parent.parent / "backend"
    if local_backend.exists():
        return local_backend
    
    # Check if we're in Docker (working directory is /app)
    docker_backend = current_dir.parent / "backend"
    if docker_backend.exists():
        return docker_backend
    
    # Fallback: try relative to current working directory
    cwd_backend = Path.cwd() / "backend"
    if cwd_backend.exists():
        return cwd_backend
    
    # Last resort: assume we're in /app (Docker)
    return current_dir.parent / "backend"


def get_configs_path() -> Path:
    """Get the configs directory path relative to this module."""
    # Configs are now in civicpulse/src/ingestion/configs/
    current_dir = Path(__file__).resolve().parent
    configs_path = current_dir / "configs"
    
    # If configs don't exist in module directory, check backend/configs (legacy)
    if not configs_path.exists():
        backend_path = get_backend_path()
        legacy_configs = backend_path / "configs"
        if legacy_configs.exists():
            return legacy_configs
    
    return configs_path


def load_config(path: str) -> dict:
    """
    Load a YAML config file and validate against schema.json.
    
    Args:
        path: Path to the YAML config file (can be relative or absolute)
        
    Returns:
        Validated config dictionary
        
    Raises:
        FileNotFoundError: If config or schema file doesn't exist
        ValidationError: If config doesn't match schema
    """
    config_path = Path(path)
    configs_path = get_configs_path()
    schema_path = configs_path / "schema.json"
    
    # If config path is relative, assume it's relative to configs directory
    if not config_path.is_absolute():
        config_path = configs_path / config_path.name
    
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema file not found: {schema_path}")
    
    # Load schema
    with open(schema_path, 'r') as f:
        schema = json.load(f)
    
    # Load config
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    
    # Simple validation
    _validate_config(config, schema)
    
    return config


def _validate_config(config: dict, schema: dict):
    """Simple validation against schema."""
    # Check required fields
    required = schema.get('required', [])
    for field in required:
        if field not in config:
            raise ValueError(f"Missing required field: {field}")
    
    # Type checks
    if 'properties' not in schema:
        return
    
    for field, value in config.items():
        if field not in schema['properties']:
            raise ValueError(f"Unknown field: {field}")
        
        prop_schema = schema['properties'][field]
        if 'type' in prop_schema:
            expected_type = prop_schema['type']
            if expected_type == 'string' and not isinstance(value, str):
                raise ValueError(f"Field '{field}' must be string")
            elif expected_type == 'array' and not isinstance(value, list):
                raise ValueError(f"Field '{field}' must be array")
            elif expected_type == 'object' and not isinstance(value, dict):
                raise ValueError(f"Field '{field}' must be object")
            elif expected_type == 'boolean' and not isinstance(value, bool):
                raise ValueError(f"Field '{field}' must be boolean")
            elif expected_type == 'integer' and not isinstance(value, int):
                raise ValueError(f"Field '{field}' must be integer")


def compute_target_date(today: date, config: dict) -> str:
    """
    Compute target date string based on config's date_selection settings.
    
    Args:
        today: The date to compute from (typically date.today())
        config: The validated config dictionary
        
    Returns:
        Formatted date string matching config.date_selection.match_format
    """
    date_selection = config['date_selection']
    basis = date_selection['basis']
    offset_days = date_selection['offset_days']
    match_format = date_selection['match_format']
    
    # Find nearest Tuesday at or before today
    if basis == "nearest_tuesday":
        # Tuesday is weekday() == 1 (Monday = 0)
        days_until_tuesday = today.weekday() - 1  # days until last Tuesday
        if days_until_tuesday < 0:
            days_until_tuesday += 7
        elif days_until_tuesday == 7:
            days_until_tuesday = 0
        
        nearest_tuesday = today - timedelta(days=days_until_tuesday)
    else:
        raise ValueError(f"Unknown basis: {basis}")
    
    # Add offset
    target_date = nearest_tuesday + timedelta(days=offset_days)
    
    # Format date
    formatted = _format_date(target_date, match_format)
    
    return formatted


def _format_date(d: date, format_str: str) -> str:
    """
    Format a date using the specified format string.
    Supports formats like "MMMM d, yyyy".
    """
    # Handle "MMMM d, yyyy" format
    if format_str == "MMMM d, yyyy":
        month_name = MONTH_NAMES[d.month]
        return f"{month_name} {d.day}, {d.year}"
    
    # Handle other common formats
    # Try using standard strftime first
    try:
        return d.strftime(format_str)
    except:
        pass
    
    # Custom handling for more formats
    result = format_str
    result = result.replace("yyyy", str(d.year))
    result = result.replace("MM", f"{d.month:02d}")
    result = result.replace("M", str(d.month))
    result = result.replace("dd", f"{d.day:02d}")
    result = result.replace("d", str(d.day))
    
    # Month names
    if "MMMM" in result:
        result = result.replace("MMMM", MONTH_NAMES[d.month])
    elif "MMM" in result:
        result = result.replace("MMM", MONTH_NAMES[d.month][:3])
    
    return result


def main():
    parser = argparse.ArgumentParser(description="Load and validate scraper configs")
    parser.add_argument("--validate", type=str, metavar="CONFIG", 
                       help="Validate a config file")
    parser.add_argument("--target-date", type=str, metavar="YYYY-MM-DD",
                       help="Compute target date for the given date")
    parser.add_argument("config", nargs="?", help="Config file path (for target-date)")
    
    args = parser.parse_args()
    
    if args.validate:
        try:
            config = load_config(args.validate)
            print(f"✓ Config valid: {args.validate}")
            print(f"  ID: {config['id']}")
            print(f"  Basis: {config['date_selection']['basis']}")
            print(f"  Offset: {config['date_selection']['offset_days']} days")
            print(f"  Format: {config['date_selection']['match_format']}")
        except Exception as e:
            print(f"✗ Config invalid: {e}")
            exit(1)
    
    elif args.target_date and args.config:
        try:
            config = load_config(args.config)
            today = datetime.strptime(args.target_date, "%Y-%m-%d").date()
            target = compute_target_date(today, config)
            print(target)
        except Exception as e:
            print(f"Error: {e}")
            exit(1)
    
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

