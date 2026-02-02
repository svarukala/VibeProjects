"""Copilot Studio diagram templates."""

from pathlib import Path

from diagrams import Diagram, Cluster, Edge
from diagrams.generic.device import Mobile
from diagrams.onprem.client import User

from ..icons import (
    CopilotStudio,
    Dataverse,
    SharePoint,
    GraphAPI,
    CustomConnector,
    PowerAutomate,
    Teams,
)


class CopilotStudioTemplates:
    """Pre-built templates for Copilot Studio scenarios."""

    @staticmethod
    def copilot_studio_agent(output_path: str, filename: str = "copilot_studio_agent") -> Path:
        """Generate a Copilot Studio custom agent diagram.

        Shows: User -> Copilot Studio -> Topics -> Actions -> Connectors

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "Copilot Studio Custom Agent Architecture",
            filename=output_file,
            show=False,
            direction="LR",
            outformat="png",
        ):
            user = User("End User")

            with Cluster("Copilot Studio"):
                agent = CopilotStudio("Custom Agent")

                with Cluster("Topics & Actions"):
                    topic1 = CopilotStudio("FAQ Topic")
                    topic2 = CopilotStudio("Data Query Topic")
                    action = PowerAutomate("Cloud Flow Action")

            with Cluster("Data Sources"):
                connector = CustomConnector("Custom Connector")
                dataverse = Dataverse("Dataverse")
                sharepoint = SharePoint("SharePoint")

            # User interactions
            user >> Edge(label="asks question") >> agent

            # Agent to topics
            agent >> topic1
            agent >> topic2

            # Topics to actions
            topic2 >> Edge(label="triggers") >> action

            # Actions to data sources
            action >> Edge(label="queries") >> connector
            action >> Edge(label="reads") >> dataverse
            action >> Edge(label="fetches docs") >> sharepoint

            # Response back to user
            agent >> Edge(label="responds", style="dashed") >> user

        return Path(f"{output_file}.png")

    @staticmethod
    def copilot_studio_teams(output_path: str, filename: str = "copilot_studio_teams") -> Path:
        """Generate a Copilot Studio Teams integration diagram.

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "Copilot Studio Teams Integration",
            filename=output_file,
            show=False,
            direction="LR",
            outformat="png",
        ):
            user = User("Teams User")

            with Cluster("Microsoft Teams"):
                teams = Teams("Teams Channel")

            with Cluster("Copilot Studio"):
                agent = CopilotStudio("Teams Bot")
                topics = CopilotStudio("Conversation Topics")

            with Cluster("Backend Services"):
                graph = GraphAPI("Graph API")
                connector = CustomConnector("External API")

            user >> teams >> agent
            agent >> topics
            topics >> graph
            topics >> connector
            agent >> Edge(style="dashed") >> teams >> user

        return Path(f"{output_file}.png")

    @staticmethod
    def copilot_studio_plugins(output_path: str, filename: str = "copilot_studio_plugins") -> Path:
        """Generate a Copilot Studio with plugins diagram.

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "Copilot Studio Plugin Architecture",
            filename=output_file,
            show=False,
            direction="TB",
            outformat="png",
        ):
            with Cluster("User Interface"):
                user = User("User")

            with Cluster("Copilot Studio Agent"):
                agent = CopilotStudio("Agent")

                with Cluster("Plugins"):
                    plugin1 = CustomConnector("Search Plugin")
                    plugin2 = CustomConnector("CRM Plugin")
                    plugin3 = CustomConnector("Calendar Plugin")

            with Cluster("External Systems"):
                api1 = CustomConnector("Search API")
                api2 = CustomConnector("Dynamics 365")
                api3 = GraphAPI("Graph Calendar")

            user >> agent
            agent >> plugin1 >> api1
            agent >> plugin2 >> api2
            agent >> plugin3 >> api3

        return Path(f"{output_file}.png")
