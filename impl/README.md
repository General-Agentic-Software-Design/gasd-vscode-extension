# GASD Visual Studio Code Extension

Professional language support for **General Agentic Software Design (GASD)**.

## Features

- **Expert Syntax Highlighting**: Vivid color schemes for GASD keywords (`COMPONENT`, `FLOW`, `TRACE`).
- **LSP-Powered IntelliSense**: Context-aware code completion.
- **Real-time Diagnostics**: Deep syntax and requirement validation.
- **Project Scaffolding**: Command to initialize a standard GASD workspace.

## Usage

1. Install the `.vsix` package.
2. Open any `.gasd` file to activate the extension.
3. Use `Cmd+Shift+P` (or `Ctrl+Shift+P`) and search for **"GASD: Initialize Project"** to bootstrap your workspace.

## Validate an executable entry point

In a `VERSION 1.2` file, add `ENTRYPOINT: greet` after `CONTEXT` and `TARGET`. Use the exact name of a top-level `FLOW` in that file. Type `entrypoint` for the snippet. The editor offers local flow names and Go to Definition.

Run **GASD: Validate Executable** to check the active file and its transitive imports. To validate several root files together, select them in the Explorer and run **Validate Executable** from the context menu. The command accepts zero or one declaration across the selected executable and reports conflicting declarations with their file and line.

Tooling can call the language-server request `gasd/validateExecutable` with `{ "uris": ["file:///path/main.gasd"], "exportAST": true }`. The response includes diagnostics and, on success, the entry-point AST nodes and any resolved startup flow with its source location. Target generators use that identity to implement native launch behavior.

## Verify an observed contract call

Open a `VERSION 1.2` document that declares the contract and run **GASD: Verify Contract Call**. Enter a JSON observation with the contract name, arguments keyed by the contract's `INPUT` names, and the outcome.

```json
{
  "contract": "InventoryService.release_stock",
  "arguments": { "items": [{ "sku": "SKU-001", "quantity": 2 }] },
  "outcome": {
    "kind": "return",
    "resultVariant": "success",
    "evidence": {
      "An existing reservation is cleared and its quantities are returned to available stock. Repeating the same release leaves stock unchanged.": true
    }
  }
}
```

- A normal return uses `kind: "return"` and reports its value under `value`. Omit `value` for `Void`. Use `resultVariant: "success"` or `"failure"` for `Result<T>` and provide the failure payload under `error`.
- An exception uses `kind: "throw"` with the observed `errorType`. Include `error` for exception data and `partialResult` if one was observed.
- Duration and retry cases use `elapsedMilliseconds` and `additionalAttempts`. The initial attempt is excluded from the retry count.
- The `evidence` object maps the exact text of quoted postconditions to observed booleans. Missing evidence can yield an unverified result. A contradicted case cannot satisfy the contract.
- For a function used in a formal postcondition, `evaluations` maps the function expression to its observed value. Separate the expression's tokens with spaces, as in `"count ( result )"`.
- Encode precise decimals and integers outside JavaScript's safe integer range as `{"$gasd":"Decimal","value":"0.200000000000000001"}` or `{"$gasd":"Integer","value":"9223372036854775807"}`.

The command checks a single recorded call. The report identifies matching cases and distinguishes violations, missing evidence, and guard evaluation errors.

---
Part of the [General Agentic Software Design](https://github.com/General-Agentic-Software-Design) initiative.
