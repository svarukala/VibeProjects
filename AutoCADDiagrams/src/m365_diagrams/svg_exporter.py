"""SVG export for M365 diagrams.

Generates SVG files that can be imported into Figma, Visio, PowerPoint, and other tools.
"""

import xml.etree.ElementTree as ET
from typing import List, Dict, Any, Tuple
from pathlib import Path
import html


class SVGExporter:
    """Exports diagram data to SVG format."""

    # Component colors (matching M365 branding)
    COLORS = {
        "User": "#FFB900",
        "M365 Copilot": "#6264A7",
        "Copilot Studio": "#6264A7",
        "Teams": "#6264A7",
        "SharePoint": "#038387",
        "Word": "#2B579A",
        "Excel": "#217346",
        "Outlook": "#0078D4",
        "Graph API": "#0078D4",
        "Power Apps": "#742774",
        "Power Automate": "#0066FF",
        "Power BI": "#F2C811",
        "Power Pages": "#742774",
        "Dataverse": "#742774",
        "Azure OpenAI": "#0078D4",
        "Azure AI Search": "#0078D4",
        "Azure AI Foundry": "#0078D4",
        "Custom Connector": "#666666",
        "SQL Database": "#CC2131",
        "Blob Storage": "#0078D4",
    }

    DEFAULT_COLOR = "#0078D4"

    def __init__(self):
        """Initialize the SVG exporter."""
        self.node_width = 140
        self.node_height = 60
        self.node_rx = 8  # Border radius
        self.h_spacing = 200
        self.v_spacing = 120
        self.cluster_padding = 30
        self.margin = 50

    def export_from_analysis(
        self,
        analysis: Dict[str, Any],
        output_path: str,
        filename: str = "diagram",
    ) -> Path:
        """Export diagram from AI analysis to SVG format.

        Args:
            analysis: Analysis dict with title, components, flows, clusters.
            output_path: Output directory.
            filename: Output filename (without extension).

        Returns:
            Path to the generated .svg file.
        """
        title = analysis.get("title", "Architecture Diagram")
        components = analysis.get("components", [])
        flows = analysis.get("flows", [])
        clusters = analysis.get("clusters", [])

        # Calculate positions
        node_positions = self._calculate_positions(components, clusters)

        # Calculate canvas size
        canvas_width, canvas_height = self._calculate_canvas_size(node_positions)

        # Create SVG root
        svg = ET.Element("svg", {
            "xmlns": "http://www.w3.org/2000/svg",
            "xmlns:xlink": "http://www.w3.org/1999/xlink",
            "width": str(canvas_width),
            "height": str(canvas_height),
            "viewBox": f"0 0 {canvas_width} {canvas_height}",
        })

        # Add style definitions
        self._add_styles(svg)

        # Add title
        title_elem = ET.SubElement(svg, "title")
        title_elem.text = title

        # Add background
        ET.SubElement(svg, "rect", {
            "width": "100%",
            "height": "100%",
            "fill": "#ffffff",
        })

        # Create main group
        main_group = ET.SubElement(svg, "g", {"id": "diagram"})

        # Add diagram title
        self._add_title(main_group, title, canvas_width)

        # Add clusters first (background)
        cluster_group = ET.SubElement(main_group, "g", {"id": "clusters"})
        for i, cluster in enumerate(clusters):
            self._add_cluster(cluster_group, cluster, node_positions, i)

        # Add edges (before nodes so they appear behind)
        edges_group = ET.SubElement(main_group, "g", {"id": "edges"})
        node_ids = {comp: f"node-{i}" for i, comp in enumerate(components)}
        for i, flow in enumerate(flows):
            self._add_edge(edges_group, flow, node_positions, i)

        # Add nodes
        nodes_group = ET.SubElement(main_group, "g", {"id": "nodes"})
        for i, comp in enumerate(components):
            pos = node_positions.get(comp, {"x": 100, "y": 100})
            color = self.COLORS.get(comp, self.DEFAULT_COLOR)
            self._add_node(nodes_group, comp, pos["x"], pos["y"], color, i)

        # Write to file
        output_dir = Path(output_path)
        output_dir.mkdir(parents=True, exist_ok=True)
        output_file = output_dir / f"{filename}.svg"

        tree = ET.ElementTree(svg)
        ET.indent(tree, space="  ")

        # Write with XML declaration
        with open(output_file, "wb") as f:
            tree.write(f, encoding="utf-8", xml_declaration=True)

        return output_file

    def export_from_components(
        self,
        components: Dict[str, bool],
        title: str,
        output_path: str,
        filename: str = "diagram",
    ) -> Path:
        """Export diagram from component flags to SVG format.

        Args:
            components: Dictionary of component flags.
            title: Diagram title.
            output_path: Output directory.
            filename: Output filename.

        Returns:
            Path to the generated .svg file.
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

    def _add_styles(self, svg: ET.Element) -> None:
        """Add CSS styles to SVG."""
        defs = ET.SubElement(svg, "defs")

        # Arrow marker
        marker = ET.SubElement(defs, "marker", {
            "id": "arrowhead",
            "markerWidth": "10",
            "markerHeight": "7",
            "refX": "9",
            "refY": "3.5",
            "orient": "auto",
            "markerUnits": "strokeWidth",
        })
        ET.SubElement(marker, "polygon", {
            "points": "0 0, 10 3.5, 0 7",
            "fill": "#666666",
        })

        # Style element
        style = ET.SubElement(defs, "style", {"type": "text/css"})
        style.text = """
            .node-rect { stroke: #333333; stroke-width: 2; }
            .node-text { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; font-weight: 600; fill: #ffffff; text-anchor: middle; dominant-baseline: middle; }
            .edge-line { stroke: #666666; stroke-width: 2; fill: none; }
            .edge-text { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; fill: #333333; text-anchor: middle; }
            .cluster-rect { fill: #f5f5f5; stroke: #cccccc; stroke-width: 1; stroke-dasharray: 5,3; }
            .cluster-text { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; font-weight: 600; fill: #666666; }
            .title-text { font-family: 'Segoe UI', Arial, sans-serif; font-size: 18px; font-weight: 700; fill: #333333; text-anchor: middle; }
        """

    def _add_title(self, parent: ET.Element, title: str, canvas_width: int) -> None:
        """Add diagram title."""
        ET.SubElement(parent, "text", {
            "x": str(canvas_width // 2),
            "y": "30",
            "class": "title-text",
        }).text = title

    def _calculate_positions(
        self,
        components: List[str],
        clusters: List[Dict]
    ) -> Dict[str, Dict[str, int]]:
        """Calculate node positions for the diagram."""
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
        x_offset = self.margin
        y_offset = self.margin + 50  # Space for title

        for comp in unclustered:
            positions[comp] = {"x": x_offset, "y": y_offset}
            x_offset += self.h_spacing

        # Position clustered components
        if clusters:
            y_offset = self.margin + 50 + self.node_height + self.v_spacing if unclustered else self.margin + 50
            x_offset = self.margin

            for cluster_name, members in cluster_members.items():
                cluster_x = x_offset
                row_count = 0
                col_count = 0
                max_cols = 3

                for comp in members:
                    if comp in components:
                        positions[comp] = {
                            "x": cluster_x + col_count * self.h_spacing,
                            "y": y_offset + row_count * self.v_spacing
                        }
                        col_count += 1
                        if col_count >= max_cols:
                            col_count = 0
                            row_count += 1

                # Move x_offset for next cluster
                cols_used = min(len(members), max_cols)
                x_offset += cols_used * self.h_spacing + self.cluster_padding * 2

        return positions

    def _calculate_canvas_size(
        self,
        node_positions: Dict[str, Dict[str, int]]
    ) -> Tuple[int, int]:
        """Calculate the required canvas size."""
        if not node_positions:
            return 800, 600

        max_x = max(pos["x"] for pos in node_positions.values()) + self.node_width + self.margin
        max_y = max(pos["y"] for pos in node_positions.values()) + self.node_height + self.margin

        return max(800, max_x), max(400, max_y)

    def _add_node(
        self,
        parent: ET.Element,
        label: str,
        x: int,
        y: int,
        color: str,
        index: int
    ) -> None:
        """Add a node (component) to the diagram."""
        group = ET.SubElement(parent, "g", {"id": f"node-{index}"})

        # Shadow
        ET.SubElement(group, "rect", {
            "x": str(x + 3),
            "y": str(y + 3),
            "width": str(self.node_width),
            "height": str(self.node_height),
            "rx": str(self.node_rx),
            "ry": str(self.node_rx),
            "fill": "#00000022",
        })

        # Main rectangle
        ET.SubElement(group, "rect", {
            "x": str(x),
            "y": str(y),
            "width": str(self.node_width),
            "height": str(self.node_height),
            "rx": str(self.node_rx),
            "ry": str(self.node_rx),
            "fill": color,
            "class": "node-rect",
        })

        # Label
        ET.SubElement(group, "text", {
            "x": str(x + self.node_width // 2),
            "y": str(y + self.node_height // 2),
            "class": "node-text",
        }).text = label

    def _add_edge(
        self,
        parent: ET.Element,
        flow: Dict[str, str],
        node_positions: Dict[str, Dict[str, int]],
        index: int
    ) -> None:
        """Add an edge (flow) between nodes."""
        from_comp = flow.get("from", "")
        to_comp = flow.get("to", "")
        label = flow.get("label", "")

        if from_comp not in node_positions or to_comp not in node_positions:
            return

        from_pos = node_positions[from_comp]
        to_pos = node_positions[to_comp]

        # Calculate edge points (from right side of source to left side of target)
        x1 = from_pos["x"] + self.node_width
        y1 = from_pos["y"] + self.node_height // 2
        x2 = to_pos["x"]
        y2 = to_pos["y"] + self.node_height // 2

        group = ET.SubElement(parent, "g", {"id": f"edge-{index}"})

        # Draw line with arrow
        ET.SubElement(group, "line", {
            "x1": str(x1),
            "y1": str(y1),
            "x2": str(x2 - 5),  # Leave space for arrow
            "y2": str(y2),
            "class": "edge-line",
            "marker-end": "url(#arrowhead)",
        })

        # Add label if present
        if label:
            mid_x = (x1 + x2) // 2
            mid_y = (y1 + y2) // 2 - 10
            ET.SubElement(group, "text", {
                "x": str(mid_x),
                "y": str(mid_y),
                "class": "edge-text",
            }).text = label

    def _add_cluster(
        self,
        parent: ET.Element,
        cluster: Dict,
        node_positions: Dict[str, Dict[str, int]],
        index: int
    ) -> None:
        """Add a cluster (group box) to the diagram."""
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
        padding = self.cluster_padding
        x = min_x - padding
        y = min_y - padding - 20  # Extra space for label
        width = max_x - min_x + 2 * padding
        height = max_y - min_y + 2 * padding + 20

        group = ET.SubElement(parent, "g", {"id": f"cluster-{index}"})

        # Cluster rectangle
        ET.SubElement(group, "rect", {
            "x": str(int(x)),
            "y": str(int(y)),
            "width": str(int(width)),
            "height": str(int(height)),
            "rx": "5",
            "ry": "5",
            "class": "cluster-rect",
        })

        # Cluster label
        ET.SubElement(group, "text", {
            "x": str(int(x + 10)),
            "y": str(int(y + 15)),
            "class": "cluster-text",
        }).text = name
