# User Stories: GASD 1.2 Support (Exhaustive)

This document defines the user stories and acceptance criteria for adding GASD 1.2.0 support to the Visual Studio Code extension. These requirements strictly follow the [GEP-6 Specification](../GASD-Specs/GEPS/GEP-6%3A%20GASD%201.2%20%E2%80%94%20Formal%20Semantics%2C%20Contract%20Modeling%2C%20and%20Verification%20Support).

---

## #US-29: GASD 1.2 Spec Versioning

**As a** GASD Engineer,
**I want** the extension to recognize the `VERSION` directive,
**so that** it can apply the correct semantic rules and linting based on the target specification version.

- **Acceptance Criteria**:
  - **#AC-29.1**: The `VERSION` keyword is highlighted as a primary directive.
  - **#AC-29.2**: Version numbers (e.g., `1.1`, `1.2`) are highlighted as literals.
  - **#AC-29.3**: A warning is issued if `VERSION` is not the first directive in the file (per §10.1).
  - **#AC-29.4**: If `VERSION` is missing, the extension must default to GASD 1.1 semantics for backward compatibility.
  - **#AC-29.5**: Snippet support for `VERSION 1.2`.

## #US-30: Formal Postconditions (ACHIEVE + POSTCONDITION)

**As a** Designer,
**I want** to specify formal outcomes for my `ACHIEVE` steps,
**so that** an agent can verify the success of a high-level goal.

- **Acceptance Criteria**:
  - **#AC-30.1**: The `POSTCONDITION` keyword is recognized and highlighted.
  - **#AC-30.2**: The extension supports the full range of comparison operators in postconditions: `IS`, `==`, `!=`, `>`, `<`, `>=`, `<=`.
  - **#AC-30.3**: **[LINT-001]** Error is triggered if an `ACHIEVE` step in a `VERSION 1.2` file is missing a `POSTCONDITION` block.
  - **#AC-30.4**: **[LINT-001]** Warning (not error) is issued if an `ACHIEVE` step in a `VERSION 1.1` file is missing a `POSTCONDITION`.
  - **#AC-30.5**: Indentation support: Postcondition expressions must be indented relative to the `POSTCONDITION:` header.
  - **#AC-30.6**: Syntax highlighting for `TIMEOUT` and `ON_ERROR` within the `ACHIEVE` body.

## #US-31: Contract Modeling (CONTRACT Block)

**As an** Architect,
**I want** to define formal behavioral contracts for component interfaces,
**so that** I can ensure cross-component consistency at `IMPORT` boundaries.

- **Acceptance Criteria**:
  - **#AC-31.1**: Syntax highlighting for the `CONTRACT` top-level block and its sub-keywords: `INPUT`, `OUTPUT`, `BEHAVIORS`, `CASE`, `THROWS`, `AFTER`, `IDEMPOTENT`, `VERSION`.
  - **#AC-31.2**: Code folding support for `CONTRACT` and `CASE` blocks.
  - **#AC-31.3**: Symbols for `CONTRACT` blocks appear in the Outline and Workspace Symbol search.
  - **#AC-31.4**: **[LINT-002]** Error if an `IMPORT` in a `VERSION 1.2` file does not have a corresponding `CONTRACT` definition.
  - **#AC-31.5**: Go-to-definition from an `IMPORT` alias to its `CONTRACT`.

## #US-32: Explicit Dependency Management (DEPENDS_ON)

**As a** Systems Engineer,
**I want** to explicitly declare dependencies between `FLOW` steps,
**so that** the execution order is unambiguous regardless of variable usage.

- **Acceptance Criteria**:
  - **#AC-32.1**: Syntax highlighting for `DEPENDS_ON` and `STEP`.
  - **#AC-32.2**: **[LINT-008]** Error if `DEPENDS_ON` references a non-existent step number.
  - **#AC-32.3**: **[LINT-009]** Error if `DEPENDS_ON` creates a circular dependency (e.g., Step 2 depends on Step 3, and Step 3 depends on Step 2).
  - **#AC-32.4**: Hover info displays the description of the depended-on step.

## #US-33: Scoped Invariants (LOCAL/GLOBAL)

**As a** Designer,
**I want** to distinguish between component-local and system-wide invariants,
**so that** the verification scope is clear to the developer and testing tools.

- **Acceptance Criteria**:
  - **#AC-33.1**: Syntax highlighting for `LOCAL` and `GLOBAL` qualifiers.
  - **#AC-33.2**: **[LINT-003]** Error if an `INVARIANT` in a `VERSION 1.2` file lacks an explicit `LOCAL` or `GLOBAL` scope.
  - **#AC-33.3**: Default behavior for `VERSION 1.1` files remains `LOCAL` (no error).

## #US-34: Stable Annotation IDs (AS Identifier)

**As a** QA Engineer,
**I want** to assign stable identifiers to my annotations,
**so that** traceability reports remain consistent even after file refactoring.

- **Acceptance Criteria**:
  - **#AC-34.1**: Support for the `AS identifier` syntax on all annotations (e.g., `@trace("#US-1") AS TR_US1`).
  - **#AC-34.2**: **[LINT-010]** Error if `AS` identifiers are not unique within the file scope.
  - **#AC-34.3**: **[LINT-011]** Error if an annotation in a `VERSION 1.2` file is missing an `AS` identifier.

## #US-35: External Model & Assumption Tracking

**As an** Architect,
**I want** to link my designs to external formal models (like TLA+ or Alloy),
**so that** I can incorporate complex protocol verification results into my GASD project.

- **Acceptance Criteria**:
  - **#AC-35.1**: Syntax highlighting for `MODEL` and `ASSUMPTION` blocks.
  - **#AC-35.2**: Support for sub-keywords: `TYPE`, `FILE`, `VERIFIES`, `ASSUMPTIONS`, `AFFECTS`, `CONSEQUENCE`.
  - **#AC-35.3**: **[LINT-012]** Error if an annotation with environmental dependency (e.g., `@transaction_type(ACID)`) lacks a corresponding `ASSUMPTION` block.
  - **#AC-35.4**: File path validation: Warning if the `FILE` referenced in a `MODEL` block does not exist on disk.

## #US-38: Annotation Semantic Intelligence (EPIC 1)

**As a** Developer,
**I want** to understand the formal meaning of structural annotations,
**so that** I can ensure my technical implementation satisfies the desired architectural properties.

- **Acceptance Criteria**:
  - **#AC-38.1**: Hovering over an annotation (e.g., `@retry(3)`) displays its **Semantic Triple** from the Registry:
    - **Structural Predicate**: (e.g., "Retry wrapper present in code with count = 3").
    - **Runtime Behavior Contract**: (e.g., "Retries occur; throws after failure 4").
    - **Environmental Dependency**: (e.g., "Operation must be idempotent").
  - **#AC-38.2**: Intellisense: Auto-completion for annotation names and their `AS` identifier boilerplate.

## #US-39: GASD 1.2 Exhaustive Diagnostic Engine

**As a** Project Lead,
**I want** the extension to enforce all GASD 1.2 normative rules with absolute precision,
**so that** our designs are machine-verifiable.

- **Acceptance Criteria**:
  - **#AC-39.1**: Full implementation of the GASD 1.2 Linting Table:
  
| Rule ID | Violation Scenario | Severity (1.2) |
| --- | --- | --- |
| **LINT-001** | `ACHIEVE` without `POSTCONDITION` | ERROR |
| **LINT-002** | `IMPORT` without `CONTRACT` | ERROR |
| **LINT-003** | `INVARIANT` without `LOCAL/GLOBAL` | ERROR |
| **LINT-004** | `@retry` without `@idempotent` | ERROR |
| **LINT-005** | `@transaction_type` without `ASSUMPTION` | ERROR |
| **LINT-006** | `GLOBAL INVARIANT` with only app-level enforcement | ERROR |
| **LINT-007** | `CONTRACT` CASE without OUTCOME (THROWS/POST) | ERROR |
| **LINT-011** | Annotation without `AS` identifier | ERROR |
| **LINT-012** | Environmental Annotation without `ASSUMPTION` | ERROR |

## #US-40: Backward Compatibility & Migration

**As a** Project Manager,
**I want** to ensure that existing GASD 1.1 projects are not broken by the 1.2 upgrade,
**so that** we can migrate to the new standard at our own pace.

- **Acceptance Criteria**:
  - **#AC-40.1**: **Regression Test**: Open a GASD 1.1 file (no `VERSION` tag) containing `ACHIEVE` without `POSTCONDITION`. Result: No Error markers (Only Warnings).
  - **#AC-40.2**: **Regression Test**: Open a GASD 1.1 file containing annotations without `AS` identifiers. Result: No Error markers (Only Info).
  - **#AC-40.3**: **Quick Fix**: Provide a "Upgrade to GASD 1.2" command that:
    1. Adds `VERSION 1.2` directive.
    2. Prompts to scaffold mandatory `POSTCONDITION` blocks.
    3. Auto-generates boilerplate `AS` identifiers for all annotations.

## #US-41: Negative Syntax Validation

**As a** DevOps Engineer,
**I want** to ensure that invalid GASD 1.2 constructs are caught at edit-time,
**so that** we don't commit invalid specifications to CI.

- **Acceptance Criteria**:
  - **#AC-41.1**: Syntax Error if `VERSION` is specified but is NOT the first directive.
  - **#AC-41.2**: Syntax Error if `TIMEOUT` or `ON_ERROR` appear outside of an `ACHIEVE` or `CASE` block.
  - **#AC-41.3**: Indentation checking for `POSTCONDITION` expressions.

---

## Acceptance Testing & Traceability Matrix

| Requirement ID | Trace ID | Test Category | Scenario |
| --- | --- | --- | --- |
| #US-29 | GEP-6.10 | Syntax | Verify coloring of `VERSION 1.2` |
| #US-30 | GEP-6.2 | Semantic | Trigger LINT-001 on ACHIEVE without POSTCONDITION |
| #US-31 | GEP-6.3 | Structure | Verify CONTRACT block symbols in Outline view |
| #US-32 | GEP-6.4 | Logic | Trigger LINT-009 on circular DEPENDS_ON |
| #US-33 | GEP-6.5 | Scope | Trigger LINT-003 on missing scope |
| #US-34 | GEP-6.6 | Identity | Trigger LINT-011 on missing AS identifier |
| #US-35 | GEP-6.7 | External | Trigger LINT-012 on ACID tx without assumption |
| #US-38 | GEP-6.1 | LSP Intelligence | Verify Hover content for @retry includes Semantic Triple |
| #US-39 | GEP-6.9 | Lint Engine | Verify LINT-004 error when @retry is used without @idempotent |
| #US-40 | GEP-6.BC | Regress | Verify 1.1 file parses with zero errors |
| #US-41 | GEP-6.Grammar | Syntax | Verify error for misaligned `POSTCONDITION:` blocks |
