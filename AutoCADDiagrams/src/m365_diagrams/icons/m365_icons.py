"""Custom M365/Copilot icon definitions for the diagrams library.

This module provides custom node classes for Microsoft 365 ecosystem components
that are not available in the standard diagrams library.
"""

from diagrams import Node
from diagrams.azure.general import Resourcegroups
from diagrams.azure.ml import CognitiveServices, AzureOpenAI as AzureOpenAIBase
from diagrams.azure.database import CosmosDb
from diagrams.azure.analytics import AnalysisServices
from diagrams.azure.integration import LogicApps
from diagrams.azure.web import AppServices, CognitiveSearch
from diagrams.generic.device import Mobile, Tablet
from diagrams.generic.compute import Rack
from diagrams.onprem.client import User, Users
from diagrams.saas.chat import Teams as SaasTeams


class M365Node(Node):
    """Base class for M365 custom nodes."""

    _provider = "m365"
    _type = "m365"
    _icon_dir = None

    def __init__(self, label: str = "", **kwargs):
        super().__init__(label, **kwargs)


# Using existing diagrams library icons as proxies for M365 components
# This approach works without requiring custom icon files


class CopilotStudio(CognitiveServices):
    """Microsoft Copilot Studio - Agent builder with topics and plugins."""

    def __init__(self, label: str = "Copilot Studio", **kwargs):
        super().__init__(label, **kwargs)


class M365Copilot(CognitiveServices):
    """Microsoft 365 Copilot - AI assistant for M365 apps."""

    def __init__(self, label: str = "M365 Copilot", **kwargs):
        super().__init__(label, **kwargs)


class AzureAIFoundry(CognitiveServices):
    """Azure AI Foundry - Model catalog, prompt flow, deployments."""

    def __init__(self, label: str = "Azure AI Foundry", **kwargs):
        super().__init__(label, **kwargs)


class AzureOpenAI(AzureOpenAIBase):
    """Azure OpenAI Service."""

    def __init__(self, label: str = "Azure OpenAI", **kwargs):
        super().__init__(label, **kwargs)


class AzureAISearch(CognitiveSearch):
    """Azure AI Search (Cognitive Search)."""

    def __init__(self, label: str = "Azure AI Search", **kwargs):
        super().__init__(label, **kwargs)


class PowerApps(AppServices):
    """Power Apps - Low-code application builder."""

    def __init__(self, label: str = "Power Apps", **kwargs):
        super().__init__(label, **kwargs)


class PowerAutomate(LogicApps):
    """Power Automate - Workflow automation."""

    def __init__(self, label: str = "Power Automate", **kwargs):
        super().__init__(label, **kwargs)


class PowerBI(AnalysisServices):
    """Power BI - Business intelligence and analytics."""

    def __init__(self, label: str = "Power BI", **kwargs):
        super().__init__(label, **kwargs)


class PowerPages(AppServices):
    """Power Pages - External-facing websites."""

    def __init__(self, label: str = "Power Pages", **kwargs):
        super().__init__(label, **kwargs)


class Dataverse(CosmosDb):
    """Microsoft Dataverse - Data platform for Power Platform."""

    def __init__(self, label: str = "Dataverse", **kwargs):
        super().__init__(label, **kwargs)


class SharePoint(Resourcegroups):
    """SharePoint Online - Document management and collaboration."""

    def __init__(self, label: str = "SharePoint", **kwargs):
        super().__init__(label, **kwargs)


class GraphAPI(Rack):
    """Microsoft Graph API - Unified API for Microsoft 365."""

    def __init__(self, label: str = "Graph API", **kwargs):
        super().__init__(label, **kwargs)


class CustomConnector(Rack):
    """Custom connectors and third-party integrations."""

    def __init__(self, label: str = "Custom Connector", **kwargs):
        super().__init__(label, **kwargs)


class Teams(SaasTeams):
    """Microsoft Teams."""

    def __init__(self, label: str = "Teams", **kwargs):
        super().__init__(label, **kwargs)


class Word(Resourcegroups):
    """Microsoft Word."""

    def __init__(self, label: str = "Word", **kwargs):
        super().__init__(label, **kwargs)


class Excel(Resourcegroups):
    """Microsoft Excel."""

    def __init__(self, label: str = "Excel", **kwargs):
        super().__init__(label, **kwargs)


class Outlook(Resourcegroups):
    """Microsoft Outlook."""

    def __init__(self, label: str = "Outlook", **kwargs):
        super().__init__(label, **kwargs)


# Re-export commonly used nodes from diagrams library
User = User
Users = Users
Mobile = Mobile
Tablet = Tablet
