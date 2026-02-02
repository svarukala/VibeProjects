"""Draw.io XML export for M365 diagrams."""

import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Optional
from pathlib import Path
import html
import math


class DrawioExporter:
    """Exports diagram data to Draw.io XML format."""

    # Component colors (matching M365 branding)
    COLORS = {
        "User": "#FFB900",  # Yellow
        "M365 Copilot": "#6264A7",  # Teams purple
        "Copilot Studio": "#6264A7",
        "Teams": "#6264A7",
        "SharePoint": "#038387",  # Teal
        "Word": "#2B579A",  # Word blue
        "Excel": "#217346",  # Excel green
        "Outlook": "#0078D4",  # Outlook blue
        "Graph API": "#0078D4",
        "Power Apps": "#742774",  # Purple
        "Power Automate": "#0066FF",  # Blue
        "Power BI": "#F2C811",  # Yellow
        "Power Pages": "#742774",
        "Dataverse": "#742774",
        "Azure OpenAI": "#0078D4",  # Azure blue
        "Azure AI Search": "#0078D4",
        "Azure AI Foundry": "#0078D4",
        "Custom Connector": "#666666",  # Gray
        "SQL Database": "#CC2131",  # Red
        "Blob Storage": "#0078D4",
    }

    DEFAULT_COLOR = "#0078D4"

    def __init__(self):
        """Initialize the Draw.io exporter."""
        self.node_width = 120
        self.node_height = 60
        self.h_spacing = 180
        self.v_spacing = 100
        self.cluster_padding = 40

    def export_from_analysis(
        self,
        analysis: Dict[str, Any],
        output_path: str,
        filename: str = "diagram",
    ) -> Path:
        """Export diagram from AI analysis to Draw.io format.

        Args:
            analysis: Analysis dict with title, components, flows, clusters.
            output_path: Output directory.
            filename: Output filename (without extension).

        Returns:
            Path to the generated .drawio file.
        """
        title = analysis.get("title", "Architecture Diagram")
        components = analysis.get("components", [])
        flows = analysis.get("flows", [])
        clusters = analysis.get("clusters", [])

        # Create the Draw.io XML structure
        root = self._create_root()
        diagram = ET.SubElement(root, "diagram", name=title, id="diagram-1")
        mxGraphModel = ET.SubElement(diagram, "mxGraphModel", {
            "dx": "1426",
            "dy": "798",
            "grid": "1",
            "gridSize": "10",
            "guides": "1",
            "tooltips": "1",
            "connect": "1",
            "arrows": "1",
            "fold": "1",
            "page": "1",
            "pageScale": "1",
            "pageWidth": "1169",
            "pageHeight": "827",
            "math": "0",
            "shadow": "0",
        })
        mxroot = ET.SubElement(mxGraphModel, "root")

        # Add required root cells
        ET.SubElement(mxroot, "mxCell", id="0")
        ET.SubElement(mxroot, "mxCell", id="1", parent="0")

        # Calculate positions
        node_positions = self._calculate_positions(components, clusters)

        # Create cluster groups first
        cluster_ids = {}
        for i, cluster in enumerate(clusters):
            cluster_id = f"cluster-{i}"
            cluster_ids[cluster.get("name", "")] = cluster_id
            self._add_cluster(mxroot, cluster_id, cluster, node_positions)

        # Create component nodes
        node_ids = {}
        for comp in components:
            node_id = f"node-{comp.replace(' ', '-')}"
            node_ids[comp] = node_id
            pos = node_positions.get(comp, {"x": 100, "y": 100})
            color = self.COLORS.get(comp, self.DEFAULT_COLOR)
            self._add_node(mxroot, node_id, comp, pos["x"], pos["y"], color)

        # Create edges/flows
        for i, flow in enumerate(flows):
            from_comp = flow.get("from", "")
            to_comp = flow.get("to", "")
            label = flow.get("label", "")

            if from_comp in node_ids and to_comp in node_ids:
                edge_id = f"edge-{i}"
                self._add_edge(
                    mxroot, edge_id,
                    node_ids[from_comp],
                    node_ids[to_comp],
                    label
                )

        # Write to file
        output_dir = Path(output_path)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / f"{filename}.drawio"

        tree = ET.ElementTree(root)
        ET.indent(tree, space="  ")
        tree.write(str(output_file), encoding="utf-8", xml_declaration=True)

        return output_file

    def export_from_components(
        self,
        components: Dict[str, bool],
        title: str,
        output_path: str,
        filename: str = "diagram",
    ) -> Path:
        """Export diagram from component flags to Draw.io format.

        Args:
            components: Dictionary of component flags.
            title: Diagram title.
            output_path: Output directory.
            filename: Output filename.

        Returns:
            Path to the generated .drawio file.
        """
        # Convert component flags to list
        component_list = []
        component_map = {
            "has_user": "User",
            "has_copilot": "M365 Copilot",
            "has_copilot_studio": "Copilot Studio",
            "has_sharepoint": "SharePoint",
            "has_teams": "Teams",
            "has_graph_api": "Graph API",
            "has_dataverse": "Dataverse",
            "has_power_automate": "Power Automate",
            "has_power_apps": "Power Apps",
            "has_power_bi": "Power BI",
            "has_azure_openai": "Azure OpenAI",
            "has_azure_ai_search": "Azure AI Search",
            "has_azure_foundry": "Azure AI Foundry",
            "has_connector": "Custom Connector",
        }

        for key, name in component_map.items():
            if components.get(key):
                component_list.append(name)

        # Create simple left-to-right flows
        flows = []
        for i in range(len(component_list) - 1):
            flows.append({
                "from": component_list[i],
                "to": component_list[i + 1],
                "label": ""
            })

        analysis = {
            "title": title,
            "components": component_list,
            "flows": flows,
            "clusters": []
        }

        return self.export_from_analysis(analysis, output_path, filename)

    def _create_root(self) -> ET.Element:
        """Create the root mxfile element."""
        return ET.Element("mxfile", {
            "host": "m365-diagrams",
            "modified": "2024-01-01T00:00:00.000Z",
            "agent": "M365 Diagram Generator",
            "version": "1.0.0",
            "type": "device",
        })

    def _calculate_positions(
        self,
        components: List[str],
        clusters: List[Dict]
    ) -> Dict[str, Dict[str, int]]:
        """Calculate node positions for the diagram.

        Args:
            components: List of component names.
            clusters: List of cluster definitions.

        Returns:
            Dictionary mapping component names to {x, y} positions.
        """
        positions = {}

        # Build cluster membership
        cluster_members = {}
        for cluster in clusters:
            name = cluster.get("name", "")
            cluster_members[name] = cluster.get("components", [])

        # Find unclustered components
        clustered = set()
        for comps in cluster_members.values():
            clustered.update(comps)
        unclustered = [c for c in components if c not in clustered]

        # Position unclustered components in a row at the top
        x_offset = 100
        y_offset = 100

        for comp in unclustered:
            positions[comp] = {"x": x_offset, "y": y_offset}
            x_offset += self.h_spacing

        # Position clusters below
        y_offset = 250
        x_offset = 100

        for cluster_name, members in cluster_members.items():
            cluster_x = x_offset
            for i, comp in enumerate(members):
                if comp in components:
                    positions[comp] = {
                        "x": cluster_x + (i % 3) * self.h_spacing,
                        "y": y_offset + (i // 3) * self.v_spacing
                    }
            x_offset += max(len(members), 1) * self.h_spacing // 2 + self.cluster_padding
            if len(members) > 3:
                y_offset += self.v_spacing

        return positions

    def _add_node(
        self,
        parent: ET.Element,
        node_id: str,
        label: str,
        x: int,
        y: int,
        color: str
    ) -> None:
        """Add a node (component) to the diagram.

        Args:
            parent: Parent XML element.
            node_id: Unique node ID.
            label: Node label text.
            x: X position.
            y: Y position.
            color: Fill color.
        """
        style = (
            f"rounded=1;whiteSpace=wrap;html=1;fillColor={color};"
            f"strokeColor=#333333;fontColor=#ffffff;fontStyle=1;"
            f"fontSize=12;shadow=1;"
        )

        cell = ET.SubElement(parent, "mxCell", {
            "id": node_id,
            "value": html.escape(label),
            "style": style,
            "vertex": "1",
            "parent": "1",
        })

        ET.SubElement(cell, "mxGeometry", {
            "x": str(x),
            "y": str(y),
            "width": str(self.node_width),
            "height": str(self.node_height),
            "as": "geometry",
        })

    def _add_edge(
        self,
        parent: ET.Element,
        edge_id: str,
        source_id: str,
        target_id: str,
        label: str = ""
    ) -> None:
        """Add an edge (flow) between nodes.

        Args:
            parent: Parent XML element.
            edge_id: Unique edge ID.
            source_id: Source node ID.
            target_id: Target node ID.
            label: Edge label text.
        """
        style = (
            "edgeStyle=orthogonalEdgeStyle;rounded=1;orthogonalLoop=1;"
            "jettySize=auto;html=1;strokeWidth=2;strokeColor=#666666;"
            "fontColor=#333333;fontSize=10;"
        )

        cell = ET.SubElement(parent, "mxCell", {
            "id": edge_id,
            "value": html.escape(label),
            "style": style,
            "edge": "1",
            "parent": "1",
            "source": source_id,
            "target": target_id,
        })

        geometry = ET.SubElement(cell, "mxGeometry", {
            "relative": "1",
            "as": "geometry",
        })

    def _add_cluster(
        self,
        parent: ET.Element,
        cluster_id: str,
        cluster: Dict,
        node_positions: Dict[str, Dict[str, int]]
    ) -> None:
        """Add a cluster (group box) to the diagram.

        Args:
            parent: Parent XML element.
            cluster_id: Unique cluster ID.
            cluster: Cluster definition with name and components.
            node_positions: Dictionary of node positions.
        """
        name = cluster.get("name", "")
        members = cluster.get("components", [])

        if not members:
            return

        # Calculate cluster bounds
        min_x = float('inf')
        min_y = float('inf')
        max_x = 0
        max_y = 0

        for comp in members:
            if comp in node_positions:
                pos = node_positions[comp]
                min_x = min(min_x, pos["x"])
                min_y = min(min_y, pos["y"])
                max_x = max(max_x, pos["x"] + self.node_width)
                max_y = max(max_y, pos["y"] + self.node_height)

        if min_x == float('inf'):
            return

        # Add padding
        padding = 30
        x = min_x - padding
        y = min_y - padding - 25  # Extra space for label
        width = max_x - min_x + 2 * padding
        height = max_y - min_y + 2 * padding + 25

        style = (
            "swimlane;whiteSpace=wrap;html=1;fillColor=#f5f5f5;"
            "strokeColor=#666666;fontColor=#333333;fontStyle=1;"
            "startSize=25;rounded=1;"
        )

        cell = ET.SubElement(parent, "mxCell", {
            "id": cluster_id,
            "value": html.escape(name),
            "style": style,
            "vertex": "1",
            "parent": "1",
        })

        ET.SubElement(cell, "mxGeometry", {
            "x": str(int(x)),
            "y": str(int(y)),
            "width": str(int(width)),
            "height": str(int(height)),
            "as": "geometry",
        })
