"""ASCII diagram generation for text-based output."""

from typing import List, Dict, Optional


class ASCIIRenderer:
    """Renders M365 ecosystem diagrams as ASCII art."""

    # Box drawing characters (ASCII-compatible for Windows)
    HORIZONTAL = "-"
    VERTICAL = "|"
    TOP_LEFT = "+"
    TOP_RIGHT = "+"
    BOTTOM_LEFT = "+"
    BOTTOM_RIGHT = "+"
    ARROW_RIGHT = "-->"
    ARROW_LEFT = "<--"
    ARROW_DOWN = "|\nv"
    T_RIGHT = "+"
    T_LEFT = "+"

    def __init__(self, max_width: int = 100):
        """Initialize the ASCII renderer.

        Args:
            max_width: Maximum width of the output in characters.
        """
        self.max_width = max_width

    def render_from_components(self, components: dict, title: str = "M365 Diagram") -> str:
        """Render an ASCII diagram from component flags.

        Args:
            components: Dictionary of component flags from generator.
            title: Title for the diagram.

        Returns:
            ASCII diagram as a string.
        """
        lines = []

        # Title
        lines.append(self._create_title_box(title))
        lines.append("")

        # Build component list
        active_components = []
        if components.get("has_user"):
            active_components.append("User")
        if components.get("has_copilot"):
            active_components.append("M365 Copilot")
        if components.get("has_copilot_studio"):
            active_components.append("Copilot Studio")
        if components.get("has_teams"):
            active_components.append("Teams")
        if components.get("has_sharepoint"):
            active_components.append("SharePoint")
        if components.get("has_graph_api"):
            active_components.append("Graph API")
        if components.get("has_dataverse"):
            active_components.append("Dataverse")
        if components.get("has_power_automate"):
            active_components.append("Power Automate")
        if components.get("has_power_apps"):
            active_components.append("Power Apps")
        if components.get("has_power_bi"):
            active_components.append("Power BI")
        if components.get("has_azure_openai"):
            active_components.append("Azure OpenAI")
        if components.get("has_azure_ai_search"):
            active_components.append("AI Search")
        if components.get("has_azure_foundry"):
            active_components.append("AI Foundry")
        if components.get("has_connector"):
            active_components.append("Connector")

        if not active_components:
            active_components = ["No components identified"]

        # Render flow diagram
        lines.append(self._create_flow_diagram(active_components))

        return "\n".join(lines)

    def render_from_description(self, description: str) -> str:
        """Render an ASCII diagram from a text description.

        Args:
            description: Text description of the diagram.

        Returns:
            ASCII diagram as a string.
        """
        # Parse description to identify components
        components = self._parse_description(description)
        return self.render_from_components(components, description[:40])

    def _parse_description(self, description: str) -> dict:
        """Parse description to identify components (simplified version)."""
        desc_lower = description.lower()
        return {
            "has_user": "user" in desc_lower,
            "has_copilot": "copilot" in desc_lower and "studio" not in desc_lower,
            "has_copilot_studio": "copilot studio" in desc_lower,
            "has_sharepoint": "sharepoint" in desc_lower,
            "has_teams": "teams" in desc_lower,
            "has_graph_api": "graph" in desc_lower,
            "has_dataverse": "dataverse" in desc_lower,
            "has_power_automate": "power automate" in desc_lower or "flow" in desc_lower,
            "has_power_apps": "power apps" in desc_lower,
            "has_power_bi": "power bi" in desc_lower,
            "has_azure_openai": "openai" in desc_lower or "gpt" in desc_lower,
            "has_azure_ai_search": "search" in desc_lower,
            "has_azure_foundry": "foundry" in desc_lower,
            "has_connector": "connector" in desc_lower or "api" in desc_lower,
        }

    def _create_title_box(self, title: str) -> str:
        """Create a boxed title.

        Args:
            title: Title text.

        Returns:
            Boxed title string.
        """
        # Truncate if too long
        if len(title) > self.max_width - 4:
            title = title[: self.max_width - 7] + "..."

        width = len(title) + 2
        top = self.TOP_LEFT + self.HORIZONTAL * width + self.TOP_RIGHT
        middle = self.VERTICAL + " " + title + " " + self.VERTICAL
        bottom = self.BOTTOM_LEFT + self.HORIZONTAL * width + self.BOTTOM_RIGHT

        return f"{top}\n{middle}\n{bottom}"

    def _create_box(self, text: str, min_width: int = 10) -> List[str]:
        """Create a box around text.

        Args:
            text: Text to box.
            min_width: Minimum box width.

        Returns:
            List of lines forming the box.
        """
        width = max(len(text), min_width)
        padding = (width - len(text)) // 2
        padded_text = " " * padding + text + " " * (width - len(text) - padding)

        return [
            self.TOP_LEFT + self.HORIZONTAL * (width + 2) + self.TOP_RIGHT,
            self.VERTICAL + " " + padded_text + " " + self.VERTICAL,
            self.BOTTOM_LEFT + self.HORIZONTAL * (width + 2) + self.BOTTOM_RIGHT,
        ]

    def _create_flow_diagram(self, components: List[str]) -> str:
        """Create a horizontal flow diagram.

        Args:
            components: List of component names.

        Returns:
            ASCII flow diagram.
        """
        if not components:
            return "No components to display"

        # Calculate box widths
        box_width = max(len(c) for c in components) + 4
        arrow = " --> "

        # Build the diagram row by row
        boxes = [self._create_box(c, box_width - 4) for c in components]

        # Combine boxes horizontally with arrows
        lines = ["", "", ""]
        for i, box in enumerate(boxes):
            for j, line in enumerate(box):
                lines[j] += line
                if i < len(boxes) - 1:
                    if j == 1:  # Middle line gets the arrow
                        lines[j] += arrow
                    else:
                        lines[j] += " " * len(arrow)

        # Add a legend
        legend = self._create_legend(components)

        return "\n".join(lines) + "\n\n" + legend

    def _create_legend(self, components: List[str]) -> str:
        """Create a legend for the diagram.

        Args:
            components: List of component names.

        Returns:
            Legend string.
        """
        legend_items = {
            "User": "End user interacting with the system",
            "M365 Copilot": "Microsoft 365 Copilot AI assistant",
            "Copilot Studio": "Custom agent builder platform",
            "Teams": "Microsoft Teams collaboration",
            "SharePoint": "Document management & collaboration",
            "Graph API": "Microsoft Graph unified API",
            "Dataverse": "Power Platform data storage",
            "Power Automate": "Workflow automation",
            "Power Apps": "Low-code application builder",
            "Power BI": "Business intelligence & analytics",
            "Azure OpenAI": "Azure-hosted OpenAI models",
            "AI Search": "Azure AI Search service",
            "AI Foundry": "Azure AI model management",
            "Connector": "External API integration",
        }

        lines = ["", "Legend:", "-" * 40]
        for comp in components:
            if comp in legend_items:
                lines.append(f"  * {comp}: {legend_items[comp]}")

        return "\n".join(lines)

    def render_template(self, template_name: str) -> str:
        """Render a pre-defined template as ASCII.

        Args:
            template_name: Name of the template.

        Returns:
            ASCII diagram for the template.
        """
        templates = {
            "copilot_sharepoint": {
                "title": "Copilot SharePoint Integration",
                "components": ["User", "M365 Copilot", "Graph API", "SharePoint"],
            },
            "copilot_studio_agent": {
                "title": "Copilot Studio Custom Agent",
                "components": ["User", "Copilot Studio", "Connector", "Dataverse"],
            },
            "power_automate_flow": {
                "title": "Power Automate Workflow",
                "components": ["SharePoint", "Power Automate", "Connector", "Dataverse"],
            },
            "azure_foundry_rag": {
                "title": "Azure AI Foundry RAG Pattern",
                "components": ["User", "M365 Copilot", "AI Search", "Azure OpenAI"],
            },
            "power_bi_pipeline": {
                "title": "Power BI Data Pipeline",
                "components": ["Dataverse", "Power Automate", "Power BI"],
            },
            "full_ecosystem": {
                "title": "M365 Copilot Full Ecosystem",
                "components": [
                    "User",
                    "M365 Copilot",
                    "Graph API",
                    "SharePoint",
                    "Dataverse",
                ],
            },
        }

        if template_name not in templates:
            return f"Unknown template: {template_name}"

        tmpl = templates[template_name]
        return self._create_title_box(tmpl["title"]) + "\n\n" + self._create_flow_diagram(
            tmpl["components"]
        )

    def render_from_analysis(self, analysis: dict) -> str:
        """Render an ASCII diagram from AI analysis results.

        Args:
            analysis: Analysis dict with title, components, flows, clusters.

        Returns:
            ASCII diagram as a string.
        """
        title = analysis.get("title", "Architecture Diagram")
        components = analysis.get("components", [])
        flows = analysis.get("flows", [])
        description = analysis.get("description", "")

        lines = []

        # Title
        lines.append(self._create_title_box(title))
        lines.append("")

        # Description if available
        if description:
            lines.append(description)
            lines.append("")

        # Component flow diagram
        if components:
            lines.append(self._create_flow_diagram(components))
        else:
            lines.append("No components identified")

        # Flow details
        if flows:
            lines.append("")
            lines.append("Data Flows:")
            lines.append("-" * 40)
            for flow in flows:
                from_comp = flow.get("from", "?")
                to_comp = flow.get("to", "?")
                label = flow.get("label", "")
                if label:
                    lines.append(f"  {from_comp} --> {to_comp} ({label})")
                else:
                    lines.append(f"  {from_comp} --> {to_comp}")

        return "\n".join(lines)
