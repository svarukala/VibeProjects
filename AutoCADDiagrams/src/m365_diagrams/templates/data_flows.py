"""Common data flow diagram templates."""

from pathlib import Path

from diagrams import Diagram, Cluster, Edge
from diagrams.generic.device import Mobile
from diagrams.onprem.client import User
from diagrams.generic.storage import Storage

from ..icons import (
    M365Copilot,
    CopilotStudio,
    AzureAIFoundry,
    AzureOpenAI,
    AzureAISearch,
    PowerApps,
    PowerAutomate,
    PowerBI,
    Dataverse,
    SharePoint,
    GraphAPI,
    CustomConnector,
    Teams,
    Word,
    Excel,
    Outlook,
)


class DataFlowTemplates:
    """Pre-built templates for common M365 data flow scenarios."""

    @staticmethod
    def copilot_sharepoint(output_path: str, filename: str = "copilot_sharepoint") -> Path:
        """Generate a Copilot querying SharePoint data diagram.

        Shows: Copilot -> Graph API -> SharePoint -> User

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "M365 Copilot SharePoint Integration",
            filename=output_file,
            show=False,
            direction="LR",
            outformat="png",
        ):
            user = User("End User")

            with Cluster("Microsoft 365"):
                copilot = M365Copilot("M365 Copilot")
                graph = GraphAPI("Microsoft Graph")

            with Cluster("SharePoint Online"):
                site = SharePoint("SharePoint Site")
                docs = SharePoint("Document Library")
                lists = SharePoint("Lists")

            # Query flow
            user >> Edge(label="asks about documents") >> copilot
            copilot >> Edge(label="queries") >> graph
            graph >> site
            site >> docs
            site >> lists

            # Response flow
            copilot >> Edge(label="summarizes content", style="dashed") >> user

        return Path(f"{output_file}.png")

    @staticmethod
    def full_ecosystem(output_path: str, filename: str = "full_ecosystem") -> Path:
        """Generate a complete M365 Copilot architecture diagram.

        Shows all major components integrated.

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "M365 Copilot Full Ecosystem",
            filename=output_file,
            show=False,
            direction="TB",
            outformat="png",
        ):
            with Cluster("Users"):
                user = User("End Users")

            with Cluster("Microsoft 365 Apps"):
                teams = Teams("Teams")
                word = Word("Word")
                excel = Excel("Excel")
                outlook = Outlook("Outlook")

            with Cluster("Copilot Layer"):
                copilot = M365Copilot("M365 Copilot")
                studio = CopilotStudio("Copilot Studio")

            with Cluster("Microsoft Graph"):
                graph = GraphAPI("Graph API")

            with Cluster("Data Sources"):
                sharepoint = SharePoint("SharePoint")
                dataverse = Dataverse("Dataverse")

            with Cluster("Azure AI"):
                foundry = AzureAIFoundry("AI Foundry")
                openai = AzureOpenAI("Azure OpenAI")
                search = AzureAISearch("AI Search")

            with Cluster("Power Platform"):
                apps = PowerApps("Power Apps")
                automate = PowerAutomate("Power Automate")
                bi = PowerBI("Power BI")

            with Cluster("External"):
                connector = CustomConnector("Connectors")

            # User to Apps
            user >> teams
            user >> word
            user >> excel
            user >> outlook

            # Apps to Copilot
            teams >> copilot
            word >> copilot
            excel >> copilot
            outlook >> copilot

            # Copilot to Graph
            copilot >> graph
            studio >> graph

            # Graph to Data
            graph >> sharepoint
            graph >> dataverse

            # Copilot to Azure AI
            copilot >> foundry
            foundry >> openai
            foundry >> search
            search >> sharepoint

            # Power Platform connections
            apps >> dataverse
            automate >> dataverse
            automate >> connector
            dataverse >> bi

            # Studio to connectors
            studio >> connector

        return Path(f"{output_file}.png")

    @staticmethod
    def copilot_word_excel(output_path: str, filename: str = "copilot_word_excel") -> Path:
        """Generate a Copilot in Word/Excel diagram.

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "Copilot in Word and Excel",
            filename=output_file,
            show=False,
            direction="LR",
            outformat="png",
        ):
            user = User("Knowledge Worker")

            with Cluster("Microsoft 365"):
                word = Word("Word")
                excel = Excel("Excel")
                copilot = M365Copilot("Copilot")

            with Cluster("Content Sources"):
                graph = GraphAPI("Graph API")
                sharepoint = SharePoint("SharePoint")

            user >> word >> copilot
            user >> excel >> copilot
            copilot >> graph >> sharepoint

        return Path(f"{output_file}.png")

    @staticmethod
    def data_sync_flow(output_path: str, filename: str = "data_sync_flow") -> Path:
        """Generate a data synchronization flow diagram.

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "M365 Data Synchronization Flow",
            filename=output_file,
            show=False,
            direction="LR",
            outformat="png",
        ):
            with Cluster("External Systems"):
                ext_api = CustomConnector("External API")
                ext_db = Storage("External DB")

            with Cluster("Integration Layer"):
                flow = PowerAutomate("Power Automate")
                connector = CustomConnector("Custom Connector")

            with Cluster("M365 Data"):
                dataverse = Dataverse("Dataverse")
                sharepoint = SharePoint("SharePoint")

            with Cluster("Consumption"):
                apps = PowerApps("Power Apps")
                bi = PowerBI("Power BI")
                copilot = M365Copilot("Copilot")

            # Sync flow
            ext_api >> connector >> flow
            ext_db >> connector
            flow >> Edge(label="sync") >> dataverse
            flow >> Edge(label="sync") >> sharepoint

            # Consumption
            dataverse >> apps
            dataverse >> bi
            sharepoint >> copilot

        return Path(f"{output_file}.png")

    @staticmethod
    def teams_copilot_workflow(output_path: str, filename: str = "teams_copilot_workflow") -> Path:
        """Generate a Teams + Copilot workflow diagram.

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "Teams Copilot Workflow",
            filename=output_file,
            show=False,
            direction="LR",
            outformat="png",
        ):
            user = User("Team Member")

            with Cluster("Microsoft Teams"):
                teams = Teams("Teams")
                chat = Teams("Chat/Channel")

            with Cluster("Copilot"):
                copilot = M365Copilot("Teams Copilot")

            with Cluster("Actions"):
                meeting = Teams("Meeting Summary")
                tasks = PowerAutomate("Create Tasks")
                docs = SharePoint("Draft Documents")

            with Cluster("Data"):
                graph = GraphAPI("Graph API")
                sharepoint = SharePoint("SharePoint")

            user >> teams >> chat >> copilot
            copilot >> meeting
            copilot >> tasks
            copilot >> docs
            copilot >> graph >> sharepoint

        return Path(f"{output_file}.png")
