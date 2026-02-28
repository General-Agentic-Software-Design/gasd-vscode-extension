# User Stories: GASD Visual Studio Code Extension

This document outlines the user stories for the official Visual Studio Code language extension for the General Agentic Software Design (GASD) language. The extension must strictly implement and conform to the normative [GASD Specification](https://github.com/General-Agentic-Software-Design/General-Agentic-Software-Design-Language).

## Core Language Support

### #US-1: Syntax Highlighting

**As a** GASD Engineer,
**I want** the extension to provide syntax highlighting for directives, keywords, types, and annotations,
**so that** I can easily distinguish between different language constructs and read the design files efficiently.

- **Acceptance Criteria**:
  - **#AC-1.1**: Directives (`CONTEXT`, `TARGET`, `TRACE`, `NAMESPACE`, `IMPORT`, `AS`) are highlighted.
  - **#AC-1.2**: Block keywords (`COMPONENT`, `INTERFACE`, `FLOW`, `TYPE`, `DECISION`, `STRATEGY`, `MATCH`, `IF`, `ELSE`, `DEFAULT`) are highlighted.
  - **#AC-1.3**: Action keywords (`VALIDATE`, `ENSURE`, `OTHERWISE`, `ACHIEVE`, `CREATE`, `PERSIST`, `TRANSFORM`, `RETURN`, `LOG`, `THROW`, `ON_ERROR`) are highlighted.
  - **#AC-1.4**: Core types (`String`, `Integer`, `Float`, `Decimal`, `Boolean`, `Bytes`, `UUID`, `DateTime`, `List<T>`, `Map<K,V>`, `Optional<T>`, `Result<T>`, `Enum(...)`, `Any`, `Void`) have distinct coloring.
  - **#AC-1.5**: Annotations (`@injectable`, `@mockable`, `@async`, `@trace`, `@unique`, etc. — full §13 library) are styled differently.
  - **#AC-1.6**: Comments (`//`, `/* */`, `///`) are correctly handled and displayed in a distinct, low-contrast color (following industry best practices, e.g., Slate or Gray).

### #US-2: Code Snippets

**As a** Designer,
**I want** to have snippets for common GASD blocks,
**so that** I can quickly scaffold components, types, and flows without remembering the exact syntax.

- **Acceptance Criteria**:
  - **#AC-2.1**: Snippets exist for `COMPONENT`, `TYPE`, `FLOW`, `DECISION`, and `STRATEGY` (must match case-sensitive uppercase keywords).
  - **#AC-2.2**: Snippets include tab-stops for identifiers and values.

### #US-3: Folding & Indentation

**As a** Software Architect,
**I want** to be able to fold large `COMPONENT` or `FLOW` blocks,
**so that** I can manage large design documents effectively.

- **Acceptance Criteria**:
  - **#AC-3.1**: Blocks starting with a colon and using indentation can be collapsed.
  - **#AC-3.2**: Automatic indentation occurs after a colon (`:`).

### #US-4: Code Formatting

**As a** Developer,
**I want** the extension to automatically format my GASD file on save,
**so that** I can maintain a consistent indentation and style across the project.

- **Acceptance Criteria**:
  - **#AC-4.1**: A "Format Document" command that aligns colons, spaces, and indentation according to the GASD style guide.
  - **#AC-4.2**: Proper handling of block comments and documentation tags.
  - **#AC-4.3**: Automatically corrects lowercase GASD keywords (per EBNF grammar, Appendix A) to their proper uppercase format during formatting.
  - **#AC-4.4**: On-type formatting auto-corrects keyword casing as the user types (triggered on newline, colon, and space characters). Keywords follow the GASD 1.0.0 EBNF grammar.

## Language Server Protocol (LSP) Features

### #US-5: Code Completion (IntelliSense)

**As a** Developer,
**I want** the extension to suggest types, components, and keywords as I type,
**so that** I can minimize typos and discover available design elements.

- **Acceptance Criteria**:
  - **#AC-5.1**: Suggestions for all GASD keywords and directives.
  - **#AC-5.2**: Suggestions for names of already defined `TYPE` and `COMPONENT` blocks.
  - **#AC-5.3**: Suggestion for `IMPORT` paths based on the workspace.
  - **#AC-5.4**: Auto-suggestions MUST always insert the spec-correct casing per the [EBNF grammar (Appendix A)](https://github.com/General-Agentic-Software-Design/General-Agentic-Software-Design-Language/blob/main/GASD_Specification.md#appendix-a-formal-ebnf-grammar) regardless of what the user typed. Keywords are UPPERCASE, types are PascalCase, annotations are lowercase. The implementation MUST use LSP `textEdit` (not `insertText`) to prevent VS Code from adapting casing to match user input.

### #US-6: Go to Definition & Find References

**As a** Reviewer,
**I want** to click on a type name in a `FLOW` and jump to its `TYPE` definition,
**so that** I can understand the underlying data contract.

- **Acceptance Criteria**:
  - **#AC-6.1**: "Go to Definition" works for types, components, and flows.
  - **#AC-6.2**: "Find All References" shows everywhere a specific component or type is used.

### #US-7: Hover Information & Documentation

**As an** Engineer,
**I want** to see the documentation for a component when I hover over its name,
**so that** I don't have to scroll to the definition to read the `///` comments.

- **Acceptance Criteria**:
  - **#AC-7.1**: Hovering over a symbol displays the associated triple-slash (`///`) documentation.
  - **#AC-7.2**: Hovering over core types displays their GASD behavioral contract.

### #US-8: Rename Refactoring

**As a** Designer,
**I want** to rename a `TYPE` or `COMPONENT` and have all its references updated throughout the project,
**so that** I can refactor my design safely.

- **Acceptance Criteria**:
  - **#AC-8.1**: "Rename Symbol" (F2) updates the definition and all usages in `FLOW` and `TYPE` blocks across multiple files.

### #US-9: Real-time Diagnostics (Linting)

**As a** Designer,
**I want** the extension to highlight syntax errors or missing requirements (like a missing `CONTEXT`),
**so that** I can fix issues before attempting to generate code.

- **Acceptance Criteria**:
  - **#AC-9.1**: Error markers for invalid EBNF grammar.
  - **#AC-9.2**: Warning if `CONTEXT` or `TARGET` is missing.
  - **#AC-9.3**: Warning for unused `IMPORT` statements.
  - **#AC-9.4**: Error for duplicated identifiers in the same namespace.

## Agentic & AI Features

### #US-10: AI-Assisted Design Generation

**As a** Product Owner,
**I want** to provide a User Story in a comment and have the extension suggest a GASD `FLOW` or `TYPE`,
**so that** I can accelerate the design-to-code process.

- **Acceptance Criteria**:
  - **#AC-10.1**: Integration with an AI agent to "Draft from Story".
  - **#AC-10.2**: Ability to highlight text and request a GASD implementation snippet.

### #US-11: Design Validation & Traceability

**As a** QA Engineer,
**I want** to see which requirements (from `TRACE`) are covered by which components,
**so that** I can ensure 100% design coverage.

- **Acceptance Criteria**:
  - **#AC-11.1**: A "Traceability View" or lens showing the relationship between `TRACE` IDs and GASD blocks.
  - **#AC-11.2**: Visualization of `DECISION` impact (what files/elements are affected).

### #US-12: Multi-Language Preview

**As a** Developer,
**I want** to see a "Preview" of the generated code side-by-side with my GASD file,
**so that** I can understand the implications of my design decisions instantly.

- **Acceptance Criteria**:
  - **#AC-12.1**: A split-view preview showing transpiled pseudo-code or actual code based on the `TARGET` directive.

### #US-13: Human-in-the-Loop (Collaboration)

**As a** Lead Architect,
**I want** the extension to highlight `QUESTION` blocks that require my attention,
**so that** I can provide necessary design decisions to the agent.

- **Acceptance Criteria**:
  - **#AC-13.1**: `QUESTION` blocks are styled as "Action Items" (e.g., in the Problems view).
  - **#AC-13.2**: Code lenses allow for quick "APPROVE" or "RESOLVE" actions.
  - **#AC-13.3**: Hovering over a `QUESTION` shows the agent's rationale.

### #US-14: Algorithmic Strategy Visualization

**As a** Performance Engineer,
**I want** to see a flowchart or diagram of `STRATEGY` and `FLOW` blocks,
**so that** I can verify the algorithmic logic without reading line-by-line.

- **Acceptance Criteria**:
  - **#AC-14.1**: A command to "Visualize Flow" that renders a Mermaid or custom diagram.

## Extension Commands & Workspace Integration

### #US-15: Project Scaffolding

**As a** New GASD User,
**I want** a command to "Initialize GASD Project",
**so that** I have a standard folder structure and a base `main.gasd` file.

- **Acceptance Criteria**:
  - **#AC-15.1**: Generates structure with `build/`, `design/`, `user-story/`.

### #US-16: Multi-File Design Management

**As a** Systems Architect,
**I want** the extension to manage `NAMESPACE` and `IMPORT` paths automatically,
**so that** I don't have to manually track file paths.

- **Acceptance Criteria**:
  - **#AC-16.1**: Auto-completion for file paths in `IMPORT` statements.
  - **#AC-16.2**: "Move File" refactoring updates all relevant `IMPORT` statements.

### #US-17: Cross-Language Consistency Check

**As a** Multi-Platform Developer,
**I want** to run a "Check Compatibility" command,
**so that** I can ensure my GASD design uses only types supported by my `TARGET`.

- **Acceptance Criteria**:
  - **#AC-17.1**: Warnings for using unsupported types per `TARGET`.

## Advanced Professional-Grade LSP Features

### #US-18: Code Actions (Quick Fixes)

**As a** Designer,
**I want** the editor to suggest "Quick Fixes" for common errors (like a typo in a core type),
**so that** I can fix linting issues with a single click.

- **Acceptance Criteria**:
  - **#AC-18.1**: Suggests correct spelling for misspelled GASD keywords.
  - **#AC-18.2**: Suggests adding missing `CONTEXT` or `TARGET` directives.
  - **#AC-18.3**: Provides a quick fix to auto-correct lowercase GASD keywords to uppercase (triggered by `keyword-case` diagnostics).

### #US-19: Document Symbols (Outline & Breadcrumbs)

**As a** Systems Architect,
**I want** to see a hierarchical view of my GASD file in the Outline view,
**so that** I can navigate large files via components, types, and flows.

- **Acceptance Criteria**:
  - **#AC-19.1**: Displays all `COMPONENT`, `TYPE`, `FLOW`, and `DECISION` blocks in the Outline.
  - **#AC-19.2**: Supports Breadcrumbs navigation at the top of the editor.

### #US-20: Workspace Symbols

**As a** Developer,
**I want** to search for any component or type across the entire project (Cmd+T),
**so that** I don't have to remember which file contains a specific design element.

- **Acceptance Criteria**:
  - **#AC-20.1**: Global search returns symbols from all `.gasd` files in the workspace.

### #US-21: Semantic Highlighting

**As an** Engineer,
**I want** the editor to color identifiers based on their semantic meaning (e.g., distinguishing a defined `TYPE` from a local variable in a `FLOW`),
**so that** the code is more readable than standard keyword-based highlighting.

- **Acceptance Criteria**:
  - **#AC-21.1**: Types, Components, and Flows have unique semantic colors based on their definition.

### #US-22: Signature Help

**As a** Designer,
**I want** to see parameter info when I'm calling a `FLOW` or `COMPONENT` method,
**so that** I know exactly which arguments are required without checking the definition.

- **Acceptance Criteria**:
  - **#AC-22.1**: A tooltip appears showing parameter names and types when typing inside parentheses.

### #US-23: Inlay Hints

**As a** Reviewer,
**I want** to see inferred type or parameter name hints inline in the editor,
**so that** the logic transitions are explicit.

- **Acceptance Criteria**:
  - **#AC-23.1**: Shows parameter name hints (e.g., `user_id:`) in method calls.

### #US-24: Selection Range (Smart Select)

**As a** Developer,
**I want** to expand my selection logically (e.g., from a field to a `TYPE` block),
**so that** I can manipulate blocks of design code quickly.

- **Acceptance Criteria**:
  - **#AC-24.1**: Successive "Expand Selection" commands (Shift+Alt+Right) select larger semantic blocks.

### #US-25: Call Hierarchy

**As a** Lead Architect,
**I want** to see a tree of what flows call a specific flow,
**so that** I can understand the impact of logic changes.

- **Acceptance Criteria**:
  - **#AC-25.1**: "Show Call Hierarchy" works for all `FLOW` definitions.

### #US-26: Document Highlights

**As a** Designer,
**I want** other occurrences of a symbol to be highlighted when my cursor is on it,
**so that** I can see usages within the current file at a glance.

- **Acceptance Criteria**:
  - **#AC-26.1**: Highlighting works for all identifiers (Types, Components, Variables).

### #US-27: File Association (.gasd)

**As a** Developer,
**I want** VS Code to automatically recognize files with the `.gasd` extension as GASD files,
**so that** syntax highlighting and LSP features are enabled immediately upon opening the file.

- **Acceptance Criteria**:
  - **#AC-27.1**: Files ending in `.gasd` are assigned the `gasd` language ID.
  - **#AC-27.2**: The blue GASD logo (`icons/gasd_icon.png`) MUST be associated and shown for `.gasd` files in the file explorer.
