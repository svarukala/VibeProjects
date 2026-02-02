"""Pre-built diagram templates for common M365 Copilot scenarios."""

from .copilot_studio import CopilotStudioTemplates
from .power_platform import PowerPlatformTemplates
from .azure_foundry import AzureFoundryTemplates
from .data_flows import DataFlowTemplates

__all__ = [
    "CopilotStudioTemplates",
    "PowerPlatformTemplates",
    "AzureFoundryTemplates",
    "DataFlowTemplates",
]

AVAILABLE_TEMPLATES = {
    "copilot_sharepoint": {
        "description": "Copilot querying SharePoint data",
        "module": "data_flows",
        "function": "copilot_sharepoint",
    },
    "copilot_studio_agent": {
        "description": "Custom Copilot Studio agent with topics and actions",
        "module": "copilot_studio",
        "function": "copilot_studio_agent",
    },
    "power_automate_flow": {
        "description": "Automated workflow with Power Automate",
        "module": "power_platform",
        "function": "power_automate_flow",
    },
    "azure_foundry_rag": {
        "description": "RAG pattern with Azure AI Foundry",
        "module": "azure_foundry",
        "function": "azure_foundry_rag",
    },
    "power_bi_pipeline": {
        "description": "Data analytics flow with Power BI",
        "module": "power_platform",
        "function": "power_bi_pipeline",
    },
    "full_ecosystem": {
        "description": "Complete M365 Copilot architecture",
        "module": "data_flows",
        "function": "full_ecosystem",
    },
}
