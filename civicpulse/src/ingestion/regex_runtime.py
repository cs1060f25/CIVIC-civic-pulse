"""
Runtime regex builder for interpolating TARGET_DATE into regex patterns.
"""

import re
from re import Pattern
from typing import Dict


def build_date_regex(template: str, date_str: str) -> Pattern:
    """
    Replace {{TARGET_DATE}} in the template regex with the actual date string.
    Escapes special regex characters in the date string.
    
    Args:
        template: Regex template string, e.g., "Meeting for {{TARGET_DATE}}"
        date_str: The formatted date string to interpolate
        
    Returns:
        Compiled regex Pattern object
        
    Example:
        >>> pattern = build_date_regex("{{TARGET_DATE}}", "October 14, 2025")
        >>> pattern.search("October 14, 2025")
        <Match ...>
    """
    # Escape special regex characters in the date string
    escaped_date = re.escape(date_str)
    
    # Replace {{TARGET_DATE}} placeholder
    regex_str = template.replace("{{TARGET_DATE}}", escaped_date)
    
    return re.compile(regex_str)


def build_date_regex_from_config(config: dict, date_str: str) -> Pattern:
    """
    Convenience function to build date regex directly from a config dict.
    
    Args:
        config: Validated config dictionary
        date_str: The formatted date string to interpolate
        
    Returns:
        Compiled regex Pattern object
    """
    template = config['selectors']['link_text_regex']
    return build_date_regex(template, date_str)


if __name__ == "__main__":
    # Example usage
    template = "{{TARGET_DATE}}"
    date_str = "October 14, 2025"
    
    pattern = build_date_regex(template, date_str)
    
    test_strings = [
        "October 14, 2025",
        "Meeting Agenda for October 14, 2025",
        "December 25, 2025"
    ]
    
    print(f"Pattern: {pattern.pattern}")
    print()
    for test in test_strings:
        match = pattern.search(test)
        result = "✓" if match else "✗"
        print(f"{result} '{test}'")

