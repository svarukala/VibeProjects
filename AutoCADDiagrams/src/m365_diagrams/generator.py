"""Core diagram generation logic using the diagrams library."""

import os
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

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
    AzureOpenAI,
    AzureAISearch,
)


class DiagramGenerator:
    """Generates M365 ecosystem diagrams programmatically."""

    def __init__(self, output_dir: str = "./output"):
        """Initialize the diagram generator.

        Args:
            output_dir: Directory to save generated diagrams.
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_from_template(
        self,
        template_name: str,
        output_format: str = "png",
        filename: Optional[str] = None,
    ) -> Path:
        """Generate a diagram from a pre-built template.

        Args:
            template_name: Name of the template to use.
            output_format: Output format (png, dot, drawio).
            filename: Custom filename (without extension).

        Returns:
            Path to the generated diagram file.
        """
        from .templates import AVAILABLE_TEMPLATES

        if template_name not in AVAILABLE_TEMPLATES:
            available = ", ".join(AVAILABLE_TEMPLATES.keys())
            raise ValueError(
                f"Unknown template: {template_name}. Available: {available}"
            )

        template_info = AVAILABLE_TEMPLATES[template_name]
        module_name = template_info["module"]
        function_name = template_info["function"]

        # Import the appropriate template module
        if module_name == "copilot_studio":
            from .templates.copilot_studio import CopilotStudioTemplates as tmpl
        elif module_name == "power_platform":
            from .templates.power_platform import PowerPlatformTemplates as tmpl
        elif module_name == "azure_foundry":
            from .templates.azure_foundry import AzureFoundryTemplates as tmpl
        elif module_name == "data_flows":
            from .templates.data_flows import DataFlowTemplates as tmpl
        else:
            raise ValueError(f"Unknown template module: {module_name}")

        # Get the template function and execute
        template_func = getattr(tmpl, function_name)
        output_filename = filename or template_name
        output_path = template_func(str(self.output_dir), output_filename)

        # Convert to requested format if not PNG
        if output_format == "dot":
            return self._convert_to_dot(output_path)
        elif output_format == "drawio":
            return self._convert_to_drawio(output_path)

        return Path(output_path)

    def generate_from_description(
        self,
        description: str,
        output_format: str = "png",
        filename: str = "custom_diagram",
    ) -> Path:
        """Generate a diagram from a text description (manual parsing).

        Args:
            description: Text description of the diagram to generate.
            output_format: Output format (png, dot, drawio, ascii).
            filename: Output filename (without extension).

        Returns:
            Path to the generated diagram file.
        """
        # Parse description and identify components
        components = self._parse_description(description)

        if output_format == "ascii":
            from .ascii_renderer import ASCIIRenderer

            renderer = ASCIIRenderer()
            ascii_output = renderer.render_from_components(components, description)
            output_path = self.output_dir / f"{filename}.txt"
            output_path.write_text(ascii_output)
            return output_path

        if output_format == "drawio":
            from .drawio_exporter import DrawioExporter

            exporter = DrawioExporter()
            title = description[:50] + "..." if len(description) > 50 else description
            return exporter.export_from_components(
                components, title, str(self.output_dir), filename
            )

        if output_format == "svg":
            from .svg_exporter import SVGExporter

            exporter = SVGExporter()
            title = description[:50] + "..." if len(description) > 50 else description
            return exporter.export_from_components(
                components, title, str(self.output_dir), filename
            )

        # Generate diagram using identified components
        output_path = self._generate_diagram_from_components(
            components, description, filename
        )

        if output_format == "dot":
            return self._convert_to_dot(output_path)

        return output_path

    def _parse_description(self, description: str) -> dict:
        """Parse a text description to identify M365 components.

        Args:
            description: Text description of the diagram.

        Returns:
            Dictionary of identified components and relationships.
        """
        description_lower = description.lower()

        components = {
            "has_user": any(
                word in description_lower for word in ["user", "person", "employee"]
            ),
            "has_copilot": any(
                word in description_lower
                for word in ["copilot", "ai assistant", "m365 copilot"]
            ),
            "has_copilot_studio": "copilot studio" in description_lower
            or "custom agent" in description_lower,
            "has_sharepoint": "sharepoint" in description_lower,
            "has_teams": "teams" in description_lower,
            "has_graph_api": any(
                word in description_lower for word in ["graph", "graph api", "microsoft graph"]
            ),
            "has_dataverse": "dataverse" in description_lower,
            "has_power_automate": any(
                word in description_lower for word in ["power automate", "flow", "workflow", "automation"]
            ),
            "has_power_apps": "power apps" in description_lower
            or "powerapps" in description_lower,
            "has_power_bi": "power bi" in description_lower
            or "powerbi" in description_lower,
            "has_azure_openai": any(
                word in description_lower
                for word in ["azure openai", "openai", "gpt", "llm"]
            ),
            "has_azure_ai_search": any(
                word in description_lower
                for word in ["ai search", "cognitive search", "search index", "rag"]
            ),
            "has_azure_foundry": any(
                word in description_lower
                for word in ["ai foundry", "azure ai", "model catalog"]
            ),
            "has_connector": any(
                word in description_lower
                for word in ["connector", "api", "integration", "third-party", "3p"]
            ),
        }

        return components

    def _generate_diagram_from_components(
        self, components: dict, description: str, filename: str
    ) -> Path:
        """Generate a diagram based on identified components.

        Args:
            components: Dictionary of component flags.
            description: Original description (for title).
            filename: Output filename.

        Returns:
            Path to generated PNG file.
        """
        output_file = str(self.output_dir / filename)

        # Create a clean title from description
        title = description[:50] + "..." if len(description) > 50 else description

        with Diagram(
            title,
            filename=output_file,
            show=False,
            direction="LR",
            outformat="png",
        ):
            nodes = {}

            # Create user node if needed
            if components["has_user"]:
                nodes["user"] = User("User")

            # Create M365 cluster
            with Cluster("Microsoft 365"):
                if components["has_copilot"]:
                    nodes["copilot"] = M365Copilot("M365 Copilot")
                if components["has_copilot_studio"]:
                    nodes["copilot_studio"] = CopilotStudio("Copilot Studio")
                if components["has_teams"]:
                    nodes["teams"] = Teams("Teams")
                if components["has_sharepoint"]:
                    nodes["sharepoint"] = SharePoint("SharePoint")
                if components["has_graph_api"]:
                    nodes["graph_api"] = GraphAPI("Graph API")

            # Create Power Platform cluster if needed
            if any(
                [
                    components["has_power_automate"],
                    components["has_power_apps"],
                    components["has_power_bi"],
                ]
            ):
                with Cluster("Power Platform"):
                    if components["has_power_automate"]:
                        nodes["power_automate"] = PowerAutomate("Power Automate")
                    if components["has_power_apps"]:
                        nodes["power_apps"] = PowerApps("Power Apps")
                    if components["has_power_bi"]:
                        nodes["power_bi"] = PowerBI("Power BI")

            # Create Data cluster if needed
            if components["has_dataverse"]:
                with Cluster("Data Layer"):
                    nodes["dataverse"] = Dataverse("Dataverse")

            # Create Azure AI cluster if needed
            if any(
                [
                    components["has_azure_openai"],
                    components["has_azure_ai_search"],
                    components["has_azure_foundry"],
                ]
            ):
                with Cluster("Azure AI"):
                    if components["has_azure_foundry"]:
                        nodes["azure_foundry"] = AzureAIFoundry("AI Foundry")
                    if components["has_azure_openai"]:
                        nodes["azure_openai"] = AzureOpenAI("Azure OpenAI")
                    if components["has_azure_ai_search"]:
                        nodes["azure_ai_search"] = AzureAISearch("AI Search")

            # Create connector node if needed
            if components["has_connector"]:
                nodes["connector"] = CustomConnector("Connector")

            # Create relationships based on common patterns
            self._create_relationships(nodes, components)

        return Path(f"{output_file}.png")

    def _create_relationships(self, nodes: dict, components: dict) -> None:
        """Create edges between nodes based on common patterns.

        Args:
            nodes: Dictionary of created nodes.
            components: Dictionary of component flags.
        """
        # User interactions
        if "user" in nodes:
            if "copilot" in nodes:
                nodes["user"] >> Edge(label="queries") >> nodes["copilot"]
            elif "copilot_studio" in nodes:
                nodes["user"] >> Edge(label="interacts") >> nodes["copilot_studio"]
            elif "teams" in nodes:
                nodes["user"] >> Edge(label="uses") >> nodes["teams"]
            elif "power_apps" in nodes:
                nodes["user"] >> Edge(label="uses") >> nodes["power_apps"]

        # Copilot to data sources
        if "copilot" in nodes:
            if "graph_api" in nodes:
                nodes["copilot"] >> Edge(label="calls") >> nodes["graph_api"]
            if "azure_openai" in nodes:
                nodes["copilot"] >> Edge(label="uses") >> nodes["azure_openai"]

        # Copilot Studio flows
        if "copilot_studio" in nodes:
            if "connector" in nodes:
                nodes["copilot_studio"] >> Edge(label="triggers") >> nodes["connector"]
            if "dataverse" in nodes:
                nodes["copilot_studio"] >> Edge(label="queries") >> nodes["dataverse"]

        # Graph API to data sources
        if "graph_api" in nodes:
            if "sharepoint" in nodes:
                nodes["graph_api"] >> nodes["sharepoint"]
            if "teams" in nodes:
                nodes["graph_api"] >> nodes["teams"]

        # Power Automate flows
        if "power_automate" in nodes:
            if "sharepoint" in nodes:
                nodes["sharepoint"] >> Edge(label="triggers") >> nodes["power_automate"]
            if "dataverse" in nodes:
                nodes["power_automate"] >> Edge(label="writes to") >> nodes["dataverse"]
            if "connector" in nodes:
                nodes["power_automate"] >> Edge(label="calls") >> nodes["connector"]

        # Azure AI connections
        if "azure_ai_search" in nodes and "azure_openai" in nodes:
            nodes["azure_ai_search"] >> Edge(label="retrieves for") >> nodes["azure_openai"]

        if "azure_foundry" in nodes and "azure_openai" in nodes:
            nodes["azure_foundry"] >> Edge(label="deploys") >> nodes["azure_openai"]

        # Power BI data sources
        if "power_bi" in nodes:
            if "dataverse" in nodes:
                nodes["dataverse"] >> Edge(label="feeds") >> nodes["power_bi"]
            if "sharepoint" in nodes:
                nodes["sharepoint"] >> Edge(label="feeds") >> nodes["power_bi"]

    def _convert_to_dot(self, png_path: Path) -> Path:
        """Extract DOT file from diagram generation.

        Note: The diagrams library generates DOT internally.
        We need to regenerate with dot output format.

        Args:
            png_path: Path to the PNG file.

        Returns:
            Path to the DOT file.
        """
        # The DOT file should be alongside the PNG with same name
        dot_path = png_path.with_suffix(".dot")
        if dot_path.exists():
            return dot_path

        # If not, the PNG is what we have
        return png_path

    def _convert_to_drawio(self, png_path: Path) -> Path:
        """Convert diagram to Draw.io format using graphviz2drawio.

        Args:
            png_path: Path to the PNG file (we need the DOT).

        Returns:
            Path to the Draw.io XML file.
        """
        dot_path = png_path.with_suffix(".dot")
        drawio_path = png_path.with_suffix(".drawio")

        if not dot_path.exists():
            # Can't convert without DOT file
            raise FileNotFoundError(
                f"DOT file not found: {dot_path}. Cannot convert to Draw.io format."
            )

        try:
            subprocess.run(
                ["graphviz2drawio", str(dot_path), "-o", str(drawio_path)],
                check=True,
                capture_output=True,
            )
            return drawio_path
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Failed to convert to Draw.io: {e.stderr.decode()}")
        except FileNotFoundError:
            raise RuntimeError(
                "graphviz2drawio not found. Install with: pip install graphviz2drawio"
            )

    def list_templates(self) -> dict:
        """List all available templates.

        Returns:
            Dictionary of template names and descriptions.
        """
        from .templates import AVAILABLE_TEMPLATES

        return {
            name: info["description"] for name, info in AVAILABLE_TEMPLATES.items()
        }

    def generate_from_analysis(
        self,
        analysis: dict,
        output_format: str = "png",
        filename: str = "analyzed_diagram",
    ) -> Path:
        """Generate a diagram from AI analysis results.

        Args:
            analysis: Analysis dict with title, components, flows, clusters.
            output_format: Output format (png, ascii, drawio).
            filename: Output filename (without extension).

        Returns:
            Path to the generated diagram file.
        """
        if output_format == "ascii":
            from .ascii_renderer import ASCIIRenderer

            renderer = ASCIIRenderer()
            ascii_output = renderer.render_from_analysis(analysis)
            output_path = self.output_dir / f"{filename}.txt"
            output_path.write_text(ascii_output)
            return output_path

        if output_format == "drawio":
            from .drawio_exporter import DrawioExporter

            exporter = DrawioExporter()
            return exporter.export_from_analysis(
                analysis, str(self.output_dir), filename
            )

        if output_format == "svg":
            from .svg_exporter import SVGExporter

            exporter = SVGExporter()
            return exporter.export_from_analysis(
                analysis, str(self.output_dir), filename
            )

        return self._generate_diagram_from_analysis(analysis, filename)

    def _generate_diagram_from_analysis(self, analysis: dict, filename: str) -> Path:
        """Generate a PNG diagram from AI analysis.

        Args:
            analysis: Analysis dict with title, components, flows, clusters.
            filename: Output filename.

        Returns:
            Path to generated PNG file.
        """
        from .icons import Word, Excel, Outlook

        output_file = str(self.output_dir / filename)
        title = analysis.get("title", "Architecture Diagram")
        components = analysis.get("components", [])
        flows = analysis.get("flows", [])
        clusters = analysis.get("clusters", [])

        # Map component names to classes
        component_classes = {
            "User": User,
            "M365 Copilot": M365Copilot,
            "Copilot Studio": CopilotStudio,
            "Teams": Teams,
            "SharePoint": SharePoint,
            "Word": Word,
            "Excel": Excel,
            "Outlook": Outlook,
            "Graph API": GraphAPI,
            "Power Apps": PowerApps,
            "Power Automate": PowerAutomate,
            "Power BI": PowerBI,
            "Power Pages": PowerPages,
            "Dataverse": Dataverse,
            "Azure OpenAI": AzureOpenAI,
            "Azure AI Search": AzureAISearch,
            "Azure AI Foundry": AzureAIFoundry,
            "Custom Connector": CustomConnector,
            "SQL Database": Dataverse,  # Use Dataverse icon as proxy
            "Blob Storage": SharePoint,  # Use SharePoint icon as proxy
            "Logic Apps": PowerAutomate,  # Similar icon
            "Azure Functions": CustomConnector,  # Similar concept
        }

        # Build cluster membership map
        cluster_membership = {}
        for cluster in clusters:
            cluster_name = cluster.get("name", "")
            for comp in cluster.get("components", []):
                cluster_membership[comp] = cluster_name

        # Group components by cluster
        clustered_components = {}
        unclustered = []
        for comp in components:
            cluster_name = cluster_membership.get(comp)
            if cluster_name:
                if cluster_name not in clustered_components:
                    clustered_components[cluster_name] = []
                clustered_components[cluster_name].append(comp)
            else:
                unclustered.append(comp)

        with Diagram(
            title,
            filename=output_file,
            show=False,
            direction="LR",
            outformat="png",
        ):
            nodes = {}

            # Create unclustered nodes first
            for comp in unclustered:
                if comp in component_classes:
                    nodes[comp] = component_classes[comp](comp)

            # Create clustered nodes
            for cluster_name, cluster_comps in clustered_components.items():
                with Cluster(cluster_name):
                    for comp in cluster_comps:
                        if comp in component_classes:
                            nodes[comp] = component_classes[comp](comp)

            # Create flows/edges
            for flow in flows:
                from_comp = flow.get("from", "")
                to_comp = flow.get("to", "")
                label = flow.get("label", "")

                if from_comp in nodes and to_comp in nodes:
                    if label:
                        nodes[from_comp] >> Edge(label=label) >> nodes[to_comp]
                    else:
                        nodes[from_comp] >> nodes[to_comp]

        return Path(f"{output_file}.png")
