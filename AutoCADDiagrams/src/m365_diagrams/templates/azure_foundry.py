"""Azure AI Foundry diagram templates."""

from pathlib import Path

from diagrams import Diagram, Cluster, Edge
from diagrams.generic.device import Mobile
from diagrams.onprem.client import User
from diagrams.generic.storage import Storage

from ..icons import (
    AzureAIFoundry,
    AzureOpenAI,
    AzureAISearch,
    M365Copilot,
    CopilotStudio,
    Dataverse,
    SharePoint,
    CustomConnector,
)


class AzureFoundryTemplates:
    """Pre-built templates for Azure AI Foundry scenarios."""

    @staticmethod
    def azure_foundry_rag(output_path: str, filename: str = "azure_foundry_rag") -> Path:
        """Generate an Azure AI Foundry RAG pattern diagram.

        Shows: User -> Copilot -> Azure AI Search -> Azure OpenAI -> Response

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "Azure AI Foundry RAG Pattern",
            filename=output_file,
            show=False,
            direction="LR",
            outformat="png",
        ):
            user = User("End User")

            with Cluster("Microsoft 365"):
                copilot = M365Copilot("M365 Copilot")

            with Cluster("Azure AI Foundry"):
                foundry = AzureAIFoundry("AI Foundry\nOrchestrator")

                with Cluster("AI Services"):
                    search = AzureAISearch("AI Search\n(Vector Index)")
                    openai = AzureOpenAI("Azure OpenAI\n(GPT-4)")

            with Cluster("Data Sources"):
                sharepoint = SharePoint("SharePoint\nDocuments")
                blob = Storage("Blob Storage")

            # Query flow
            user >> Edge(label="asks question") >> copilot
            copilot >> Edge(label="sends query") >> foundry
            foundry >> Edge(label="searches") >> search
            search >> Edge(label="retrieves context") >> foundry
            foundry >> Edge(label="generates") >> openai
            openai >> Edge(label="response") >> foundry
            foundry >> Edge(style="dashed", label="answer") >> copilot
            copilot >> Edge(style="dashed") >> user

            # Data indexing
            sharepoint >> Edge(label="indexed", style="dotted") >> search
            blob >> Edge(label="indexed", style="dotted") >> search

        return Path(f"{output_file}.png")

    @staticmethod
    def azure_foundry_prompt_flow(
        output_path: str, filename: str = "azure_foundry_prompt_flow"
    ) -> Path:
        """Generate an Azure AI Foundry Prompt Flow diagram.

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "Azure AI Foundry Prompt Flow",
            filename=output_file,
            show=False,
            direction="TB",
            outformat="png",
        ):
            with Cluster("Input"):
                user = User("User Query")

            with Cluster("Azure AI Foundry - Prompt Flow"):
                with Cluster("Flow Steps"):
                    input_node = AzureAIFoundry("Input Processing")
                    embedding = AzureOpenAI("Generate\nEmbedding")
                    search = AzureAISearch("Vector Search")
                    prompt = AzureAIFoundry("Prompt\nConstruction")
                    llm = AzureOpenAI("LLM Call")
                    output = AzureAIFoundry("Output\nFormatting")

            with Cluster("Output"):
                response = User("Response")

            user >> input_node
            input_node >> embedding
            embedding >> search
            search >> prompt
            prompt >> llm
            llm >> output
            output >> response

        return Path(f"{output_file}.png")

    @staticmethod
    def azure_foundry_model_deployment(
        output_path: str, filename: str = "azure_foundry_deployment"
    ) -> Path:
        """Generate an Azure AI Foundry model deployment diagram.

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "Azure AI Foundry Model Deployment",
            filename=output_file,
            show=False,
            direction="LR",
            outformat="png",
        ):
            with Cluster("Model Catalog"):
                gpt4 = AzureOpenAI("GPT-4")
                gpt35 = AzureOpenAI("GPT-3.5")
                embedding = AzureOpenAI("Embedding\nModel")

            with Cluster("Azure AI Foundry"):
                foundry = AzureAIFoundry("AI Foundry\nProject")

                with Cluster("Deployments"):
                    deploy1 = AzureOpenAI("Production\nEndpoint")
                    deploy2 = AzureOpenAI("Development\nEndpoint")

            with Cluster("Consumers"):
                copilot = M365Copilot("M365 Copilot")
                studio = CopilotStudio("Copilot Studio")
                app = CustomConnector("Custom App")

            gpt4 >> foundry
            gpt35 >> foundry
            embedding >> foundry

            foundry >> deploy1
            foundry >> deploy2

            deploy1 >> copilot
            deploy1 >> studio
            deploy2 >> app

        return Path(f"{output_file}.png")

    @staticmethod
    def azure_foundry_with_copilot_studio(
        output_path: str, filename: str = "foundry_copilot_studio"
    ) -> Path:
        """Generate an Azure AI Foundry + Copilot Studio integration diagram.

        Args:
            output_path: Directory to save the diagram.
            filename: Name for the output file.

        Returns:
            Path to the generated diagram.
        """
        output_file = f"{output_path}/{filename}"

        with Diagram(
            "Azure AI Foundry + Copilot Studio Integration",
            filename=output_file,
            show=False,
            direction="LR",
            outformat="png",
        ):
            user = User("End User")

            with Cluster("Copilot Studio"):
                agent = CopilotStudio("Custom Agent")
                plugin = CustomConnector("AI Plugin")

            with Cluster("Azure AI Foundry"):
                foundry = AzureAIFoundry("Prompt Flow")
                search = AzureAISearch("AI Search")
                openai = AzureOpenAI("Azure OpenAI")

            with Cluster("Enterprise Data"):
                dataverse = Dataverse("Dataverse")
                sharepoint = SharePoint("SharePoint")

            user >> agent
            agent >> plugin
            plugin >> Edge(label="calls") >> foundry
            foundry >> search
            foundry >> openai
            search >> sharepoint
            search >> dataverse
            openai >> Edge(style="dashed") >> foundry
            foundry >> Edge(style="dashed") >> plugin
            plugin >> Edge(style="dashed") >> agent
            agent >> Edge(style="dashed") >> user

        return Path(f"{output_file}.png")
