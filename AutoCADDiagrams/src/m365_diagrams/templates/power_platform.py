"""Power Platform diagram templates."""

from pathlib import Path

from diagrams import Diagram, Cluster, Edge
from diagrams.generic.device import Mobile
from diagrams.onprem.client import User
from diagrams.generic.database import SQL

from ..icons import (
    PowerApps,
    PowerAutomate,
    PowerBI,
    PowerPages,
    Dataverse,
    SharePoint,
    CustomConnector,
    Teams,
)


class PowerPlatformTemplates:
    """Pre-built templates for Power Platform scenarios."""

    @staticmethod
    def power_automate_flow(output_path: str, filename: str = "power_automate_flow") -> Path:
        """Generate a Power Automate workflow diagram.

        Shows: Trigger -> Power Automate -> Connectors -> Dataverse

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "Power Automate Workflow",
            filename=output_file,
            show=False,
            direction="LR",
            outformat="png",
        ):
            with Cluster("Trigger"):
                sharepoint = SharePoint("SharePoint\nFile Upload")

            with Cluster("Power Automate"):
                flow = PowerAutomate("Cloud Flow")

                with Cluster("Flow Steps"):
                    step1 = PowerAutomate("Parse Content")
                    step2 = PowerAutomate("Transform Data")
                    step3 = PowerAutomate("Apply Conditions")

            with Cluster("Actions"):
                connector = CustomConnector("External API")
                teams = Teams("Teams Notification")

            with Cluster("Data Storage"):
                dataverse = Dataverse("Dataverse")

            # Flow connections
            sharepoint >> Edge(label="triggers") >> flow
            flow >> step1 >> step2 >> step3
            step3 >> Edge(label="calls") >> connector
            step3 >> Edge(label="notifies") >> teams
            step3 >> Edge(label="writes") >> dataverse

        return Path(f"{output_file}.png")

    @staticmethod
    def power_bi_pipeline(output_path: str, filename: str = "power_bi_pipeline") -> Path:
        """Generate a Power BI data pipeline diagram.

        Shows: SQL -> Dataflow -> Power BI -> Dashboard

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "Power BI Data Pipeline",
            filename=output_file,
            show=False,
            direction="LR",
            outformat="png",
        ):
            with Cluster("Data Sources"):
                sql = SQL("SQL Database")
                sharepoint = SharePoint("SharePoint Lists")
                dataverse = Dataverse("Dataverse")

            with Cluster("Data Transformation"):
                dataflow = PowerAutomate("Dataflow")

            with Cluster("Power BI"):
                dataset = PowerBI("Dataset")
                report = PowerBI("Report")
                dashboard = PowerBI("Dashboard")

            with Cluster("Consumers"):
                user = User("Business User")
                teams = Teams("Teams Tab")

            # Data flow
            sql >> Edge(label="extract") >> dataflow
            sharepoint >> Edge(label="extract") >> dataflow
            dataverse >> Edge(label="extract") >> dataflow

            dataflow >> Edge(label="load") >> dataset
            dataset >> report >> dashboard

            dashboard >> user
            dashboard >> Edge(label="embed") >> teams

        return Path(f"{output_file}.png")

    @staticmethod
    def power_apps_canvas(output_path: str, filename: str = "power_apps_canvas") -> Path:
        """Generate a Power Apps canvas app architecture diagram.

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "Power Apps Canvas App Architecture",
            filename=output_file,
            show=False,
            direction="TB",
            outformat="png",
        ):
            with Cluster("Users"):
                mobile = Mobile("Mobile User")
                user = User("Desktop User")

            with Cluster("Power Apps"):
                app = PowerApps("Canvas App")

            with Cluster("Connectors"):
                sharepoint_conn = CustomConnector("SharePoint\nConnector")
                sql_conn = CustomConnector("SQL\nConnector")
                custom_conn = CustomConnector("Custom\nConnector")

            with Cluster("Data"):
                sharepoint = SharePoint("SharePoint")
                sql = SQL("SQL Server")
                api = CustomConnector("REST API")

            mobile >> app
            user >> app

            app >> sharepoint_conn >> sharepoint
            app >> sql_conn >> sql
            app >> custom_conn >> api

        return Path(f"{output_file}.png")

    @staticmethod
    def power_pages_portal(output_path: str, filename: str = "power_pages_portal") -> Path:
        """Generate a Power Pages portal architecture diagram.

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "Power Pages Portal Architecture",
            filename=output_file,
            show=False,
            direction="LR",
            outformat="png",
        ):
            with Cluster("External Users"):
                user = User("Portal User")

            with Cluster("Power Pages"):
                portal = PowerPages("Public Portal")

            with Cluster("Authentication"):
                auth = CustomConnector("Azure AD B2C")

            with Cluster("Data Layer"):
                dataverse = Dataverse("Dataverse")

            with Cluster("Backend Automation"):
                flow = PowerAutomate("Cloud Flows")

            user >> portal
            portal >> Edge(label="authenticates") >> auth
            portal >> Edge(label="reads/writes") >> dataverse
            dataverse >> Edge(label="triggers") >> flow

        return Path(f"{output_file}.png")

    @staticmethod
    def full_power_platform(output_path: str, filename: str = "full_power_platform") -> Path:
        """Generate a complete Power Platform ecosystem diagram.

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "Power Platform Ecosystem",
            filename=output_file,
            show=False,
            direction="TB",
            outformat="png",
        ):
            with Cluster("Users"):
                internal = User("Internal Users")
                external = User("External Users")

            with Cluster("Power Platform"):
                with Cluster("Applications"):
                    apps = PowerApps("Power Apps")
                    pages = PowerPages("Power Pages")

                with Cluster("Automation"):
                    automate = PowerAutomate("Power Automate")

                with Cluster("Analytics"):
                    bi = PowerBI("Power BI")

            with Cluster("Data Platform"):
                dataverse = Dataverse("Dataverse")

            with Cluster("Integration"):
                connectors = CustomConnector("Connectors")

            internal >> apps
            external >> pages
            apps >> dataverse
            pages >> dataverse
            automate >> dataverse
            dataverse >> bi
            automate >> connectors
            apps >> connectors

        return Path(f"{output_file}.png")
