# VS Code GASD Extension

Official Visual Studio Code extension for the **General Agentic Software Design (GASD)** language.

## Project Structure

- `build/`: Contains the official [GASD Build Plan](build/build_plan.gasd).
- `design/`: Contains the [Expert Design Specification](design/vscode_gasd_extension.gasd).
- `user-story/`: Contains the [Consolidated User Stories](user-story/user-story.md).
- `client/`: VS Code Extension Client (TypeScript).
- `server/`: GASD Language Server (LSP).

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- VS Code ^1.80.0

### Build & Test

The project follows a GASD-driven development lifecycle. To build the extension:

1. **Initialize**: Follow the `initialize_environment` flow in `build/build_plan.gasd`.
2. **Quality Gate**: Run the `run_to_pass` flow which executes unit, integration, and acceptance tests (including `.gasd` file recognition).
3. **Package**: Run the `package_extension` flow to generate the `.vsix` installer.

## 🎁 Packaging for Installation

To create a `.vsix` installer for your extension:

1. Navigate to the `impl/` directory.
2. Run the packaging script:

    ```bash
    npm run package
    ```

3. Install the generated bundle:

    ```bash
    code --install-extension build/installation/vscode-gasd-1.0.0.vsix
    ```

## 🚀 Live Demo (Extension Development Host)

To see the extension running live in your editor:

1. Open the project in VS Code.
2. Navigate to `client/extension.ts`.
3. Press **F5** (or go to Run & Debug > "Run Extension").
4. A new **[Extension Development Host]** window will open.
5. In that window, create or open a `.gasd` file to see:
    - **Live Syntax Highlighting** (Keywords/Directives).
    - **IntelliSense** (Triggered by whitespace or `:`).
    - **Real-time Diagnostics** (Problems view).
    - **Breadcrumbs & Outline** navigation.

## Architecture

This extension uses the **LSP (Language Server Protocol)** to decouple language analysis from the editor UI. Parsing is performed using **Nearley.js** to ensure full compliance with the GASD EBNF grammar.

## Features

- **Syntax Highlighting**: Expert-level coloring for all GASD primitives.
- **IntelliSense**: Smart completion for types, components, and flows.
- **Human-in-the-Loop**: Integrated support for `QUESTION` and `APPROVE` blocks.
- **Visualizations**: Automatic Mermaid diagram generation for `FLOW` and `STRATEGY`.

---
*Built with [General Agentic Software Design](https://github.com/General-Agentic-Software-Design/General-Agentic-Software-Design-Language)*
