"""M365 Copilot Ecosystem Diagram Generator.

A Python utility to generate architecture diagrams, data flow diagrams,
and ASCII diagrams for Microsoft 365 Copilot ecosystem scenarios.
"""

__version__ = "1.0.0"

from .generator import DiagramGenerator
from .ai_assistant import AIAssistant
from .ascii_renderer import ASCIIRenderer

__all__ = ["DiagramGenerator", "AIAssistant", "ASCIIRenderer"]
