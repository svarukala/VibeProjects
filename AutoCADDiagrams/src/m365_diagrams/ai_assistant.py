"""LLM integration for natural language to diagram generation."""

import os
import re
import tempfile
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

load_dotenv()


class AIAssistant:
    """AI-powered diagram generation using Azure OpenAI or OpenAI."""

    def __init__(self):
        """Initialize the AI assistant with available API credentials."""
        self.client = None
        self.model = None
        self._initialize_client()

    def _initialize_client(self) -> None:
        """Initialize the OpenAI client based on available environment variables."""
        # Try Azure OpenAI first
        azure_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        azure_key = os.getenv("AZURE_OPENAI_KEY")
        azure_deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT")

        if azure_endpoint and azure_key and azure_deployment:
            try:
                from openai import AzureOpenAI

                self.client = AzureOpenAI(
                    api_key=azure_key,
                    api_version="2024-02-15-preview",
                    azure_endpoint=azure_endpoint,
                )
                self.model = azure_deployment
                self.provider = "azure"
                return
            except ImportError:
                pass

        # Fall back to OpenAI
        openai_key = os.getenv("OPENAI_API_KEY")
        if openai_key:
            try:
                from openai import OpenAI

                self.client = OpenAI(api_key=openai_key)
                self.model = "gpt-4"
                self.provider = "openai"
                return
            except ImportError:
                pass

        self.provider = None

    def is_available(self) -> bool:
        """Check if AI assistant is available (API configured)."""
        return self.client is not None

    def get_provider_info(self) -> str:
        """Get information about the configured provider."""
        if not self.is_available():
            return "No AI provider configured. Set AZURE_OPENAI_* or OPENAI_API_KEY environment variables."
        return f"Using {self.provider.upper()} with model: {self.model}"

    def generate_diagram(
        self,
        description: str,
        output_dir: str = "./output",
        filename: str = "ai_generated_diagram",
        output_format: str = "png",
    ) -> Path:
        """Generate a diagram from a natural language description using AI.

        Args:
            description: Natural language description of the desired diagram.
            output_dir: Directory to save the generated diagram.
            filename: Name for the output file (without extension).
            output_format: Output format (png, dot, drawio, ascii).

        Returns:
            Path to the generated diagram file.

        Raises:
            RuntimeError: If AI is not available or generation fails.
        """
        if not self.is_available():
            raise RuntimeError(
                "AI assistant not available. Configure AZURE_OPENAI_* or OPENAI_API_KEY."
            )

        # Load system prompt
        prompt_path = Path(__file__).parent.parent.parent / "templates" / "prompts" / "diagram_generation.txt"
        if prompt_path.exists():
            system_prompt = prompt_path.read_text()
        else:
            system_prompt = self._get_default_system_prompt()

        # Generate diagram code using LLM
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Generate a diagram for: {description}",
                },
            ],
            temperature=0.7,
            max_tokens=2000,
        )

        generated_code = response.choices[0].message.content

        # Extract Python code from response
        code = self._extract_code(generated_code)

        # Execute the generated code
        output_path = self._execute_diagram_code(code, output_dir, filename)

        # Convert format if needed
        if output_format == "ascii":
            from .ascii_renderer import ASCIIRenderer

            renderer = ASCIIRenderer()
            ascii_output = renderer.render_from_description(description)
            ascii_path = Path(output_dir) / f"{filename}.txt"
            ascii_path.write_text(ascii_output)
            return ascii_path

        return output_path

    def _extract_code(self, response: str) -> str:
        """Extract Python code from LLM response.

        Args:
            response: Raw LLM response that may contain markdown code blocks.

        Returns:
            Clean Python code.
        """
        # Try to extract from code blocks
        code_pattern = r"```python\s*(.*?)```"
        matches = re.findall(code_pattern, response, re.DOTALL)

        if matches:
            return matches[0].strip()

        # Try without language specifier
        code_pattern = r"```\s*(.*?)```"
        matches = re.findall(code_pattern, response, re.DOTALL)

        if matches:
            return matches[0].strip()

        # Assume the whole response is code
        return response.strip()

    def _fix_generated_code(self, code: str) -> str:
        """Fix common import errors in AI-generated code.

        Args:
            code: Generated Python code.

        Returns:
            Fixed Python code.
        """
        # Fix incorrect User imports
        bad_imports = [
            "from diagrams.generic.user import User",
            "from diagrams.generic.compute import User",
            "from diagrams.aws.general import User",
            "from diagrams.azure.general import User",
        ]
        correct_import = "from diagrams.onprem.client import User"

        for bad_import in bad_imports:
            code = code.replace(bad_import, correct_import)

        # Fix if User is imported from a non-existent module inline
        code = re.sub(
            r'from diagrams\.[a-z_.]+\s+import.*\bUser\b.*',
            correct_import,
            code
        )

        # Remove duplicate User imports if we added one
        lines = code.split('\n')
        seen_user_import = False
        fixed_lines = []
        for line in lines:
            if 'import User' in line or 'import User,' in line:
                if not seen_user_import:
                    seen_user_import = True
                    fixed_lines.append(line)
                # Skip duplicate User imports
            else:
                fixed_lines.append(line)

        return '\n'.join(fixed_lines)

    def _execute_diagram_code(
        self, code: str, output_dir: str, filename: str
    ) -> Path:
        """Execute generated diagram code safely.

        Args:
            code: Python code to execute.
            output_dir: Output directory for the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram file.
        """
        # Ensure output directory exists
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        # Create a safe execution environment
        exec_globals = {
            "__builtins__": __builtins__,
            "Diagram": None,
            "Cluster": None,
            "Edge": None,
        }

        # Add necessary imports to the execution context
        try:
            from diagrams import Diagram, Cluster, Edge
            from diagrams.generic.device import Mobile
            from diagrams.onprem.client import User

            from .icons import (
                CopilotStudio,
                M365Copilot,
                AzureAIFoundry,
                PowerApps,
                PowerAutomate,
                PowerBI,
                PowerPages,
                Dataverse,
                SharePoint,
                GraphAPI,
                CustomConnector,
                Teams,
                Word,
                Excel,
                Outlook,
                AzureOpenAI,
                AzureAISearch,
            )

            exec_globals.update({
                "Diagram": Diagram,
                "Cluster": Cluster,
                "Edge": Edge,
                "Mobile": Mobile,
                "User": User,
                "CopilotStudio": CopilotStudio,
                "M365Copilot": M365Copilot,
                "AzureAIFoundry": AzureAIFoundry,
                "PowerApps": PowerApps,
                "PowerAutomate": PowerAutomate,
                "PowerBI": PowerBI,
                "PowerPages": PowerPages,
                "Dataverse": Dataverse,
                "SharePoint": SharePoint,
                "GraphAPI": GraphAPI,
                "CustomConnector": CustomConnector,
                "Teams": Teams,
                "Word": Word,
                "Excel": Excel,
                "Outlook": Outlook,
                "AzureOpenAI": AzureOpenAI,
                "AzureAISearch": AzureAISearch,
            })
        except ImportError as e:
            raise RuntimeError(f"Failed to import diagram dependencies: {e}")

        # Fix common import errors in generated code
        code = self._fix_generated_code(code)

        # Execute the code
        exec_locals = {}
        try:
            exec(code, exec_globals, exec_locals)

            # Look for a generate_diagram function
            if "generate_diagram" in exec_locals:
                exec_locals["generate_diagram"](output_dir, filename)
            else:
                # The code might have directly created the diagram
                pass

        except Exception as e:
            raise RuntimeError(f"Failed to execute generated diagram code: {e}")

        # Find the generated file
        output_path = Path(output_dir) / f"{filename}.png"
        if output_path.exists():
            return output_path

        # Try to find any PNG in the output directory
        png_files = list(Path(output_dir).glob("*.png"))
        if png_files:
            return png_files[-1]

        raise RuntimeError("Diagram generation completed but no output file was found.")

    def _get_default_system_prompt(self) -> str:
        """Get a default system prompt if the file is not found."""
        return """You are an expert in Microsoft 365 Copilot ecosystem architecture.
Generate Python code using the diagrams library to create architecture diagrams.

Use these imports:
from diagrams import Diagram, Cluster, Edge
from diagrams.generic.device import Mobile
from diagrams.onprem.client import User

Available M365 components (import from m365_diagrams.icons):
- CopilotStudio, M365Copilot, AzureAIFoundry
- PowerApps, PowerAutomate, PowerBI, PowerPages
- Dataverse, SharePoint, GraphAPI, CustomConnector
- Teams, Word, Excel, Outlook
- AzureOpenAI, AzureAISearch

Always create a function called generate_diagram(output_path, filename) that creates the diagram.
Return only Python code, no explanations."""

    def explain_diagram(self, description: str) -> str:
        """Get an AI explanation of what components would be in a diagram.

        Args:
            description: Description of the scenario.

        Returns:
            AI-generated explanation of the architecture.
        """
        if not self.is_available():
            raise RuntimeError("AI assistant not available.")

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": """You are an expert in Microsoft 365 and Azure architecture.
Explain what components and data flows would be needed for the described scenario.
Be concise and focus on the key architectural elements.""",
                },
                {
                    "role": "user",
                    "content": f"Explain the architecture for: {description}",
                },
            ],
            temperature=0.7,
            max_tokens=500,
        )

        return response.choices[0].message.content

    def analyze_document(self, document_text: str) -> dict:
        """Analyze document content and extract architecture information.

        Uses AI to identify M365 components, data flows, and relationships
        from document text.

        Args:
            document_text: Extracted text from a document.

        Returns:
            dict with keys:
                - title: Suggested diagram title
                - components: List of component names
                - flows: List of {from, to, label} dicts
                - clusters: List of {name, components} dicts
                - description: Brief description

        Raises:
            RuntimeError: If AI is not available.
        """
        import json

        if not self.is_available():
            raise RuntimeError("AI assistant not available.")

        # Load the document analysis prompt
        prompt_path = Path(__file__).parent.parent.parent / "templates" / "prompts" / "document_analysis.txt"
        if prompt_path.exists():
            system_prompt = prompt_path.read_text()
        else:
            system_prompt = self._get_default_document_analysis_prompt()

        # Truncate document if too long (keep first 8000 chars to stay within token limits)
        max_chars = 8000
        if len(document_text) > max_chars:
            document_text = document_text[:max_chars] + "\n\n[... Document truncated for analysis ...]"

        # Replace placeholder in prompt
        system_prompt = system_prompt.replace("{document_text}", document_text)

        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "Analyze this document and extract the architecture components and flows."},
            ],
            temperature=0.3,  # Lower temperature for more consistent JSON output
            max_tokens=2000,
        )

        response_text = response.choices[0].message.content

        # Extract JSON from response (handle markdown code blocks)
        json_text = response_text
        if "```json" in response_text:
            match = re.search(r"```json\s*(.*?)```", response_text, re.DOTALL)
            if match:
                json_text = match.group(1)
        elif "```" in response_text:
            match = re.search(r"```\s*(.*?)```", response_text, re.DOTALL)
            if match:
                json_text = match.group(1)

        try:
            analysis = json.loads(json_text.strip())
        except json.JSONDecodeError as e:
            # Return a basic structure if JSON parsing fails
            return {
                "title": "Architecture Diagram",
                "components": ["User", "M365 Copilot"],
                "flows": [{"from": "User", "to": "M365 Copilot", "label": "interacts"}],
                "clusters": [],
                "description": "Could not parse document analysis",
                "error": str(e),
            }

        # Validate and ensure required keys exist
        analysis.setdefault("title", "Architecture Diagram")
        analysis.setdefault("components", [])
        analysis.setdefault("flows", [])
        analysis.setdefault("clusters", [])
        analysis.setdefault("description", "")

        return analysis

    def _get_default_document_analysis_prompt(self) -> str:
        """Get default prompt for document analysis."""
        return """You are an expert in Microsoft 365 and Azure architecture.
Analyze the document and identify architecture components and data flows.

Document:
{document_text}

Return a JSON object with:
- title: Diagram title
- components: List of component names
- flows: List of {from, to, label} objects
- clusters: List of {name, components} objects
- description: Brief description

Valid components: User, M365 Copilot, Copilot Studio, Teams, SharePoint,
Power Apps, Power Automate, Power BI, Dataverse, Graph API, Azure OpenAI,
Azure AI Search, Azure AI Foundry, Custom Connector

Return ONLY JSON, no explanations."""
