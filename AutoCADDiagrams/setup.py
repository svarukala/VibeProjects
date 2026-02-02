from setuptools import setup, find_packages

setup(
    name="m365-diagrams",
    version="1.0.0",
    description="M365 Copilot Ecosystem Diagram Generator",
    author="Your Name",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    python_requires=">=3.9",
    install_requires=[
        "diagrams>=0.24.4",
        "graphviz>=0.20.3",
        "typer>=0.9.0",
        "rich>=13.0.0",
        "openai>=1.0.0",
        "python-dotenv>=1.0.0",
        "pydantic>=2.0.0",
        "python-docx>=1.1.0",
        "pypdf>=4.0.0",
    ],
    extras_require={
        "drawio": ["graphviz2drawio>=1.1.0"],
    },
    entry_points={
        "console_scripts": [
            "m365-diagram=m365_diagrams.cli:app",
        ],
    },
)
