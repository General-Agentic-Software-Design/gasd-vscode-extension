# User Story: GASD 1.1 Specification Compliance (with GEPs)

## #US-28: GASD 1.1 Specification Compliance

**As a** Language Engineer,
**I want** the extension to support the GASD 1.1.0 specification features and all accepted Enhancement Proposals (GEPs),
**so that** I can design professional-grade, deterministic agentic systems.

### Acceptance Criteria

#### 1. Core Specification & GEP-2: Literal Types

- **#AC-28.1**: Support for **Literal Types** (Strings and Numbers) in `TYPE` definitions (e.g., `status: "Review"`).
- **#AC-28.2**: Literal types are supported within `Enum(...)` definitions and `MATCH` patterns.
- **#AC-28.3**: Diagnostic error if a literal type value mismatch is detected during assignment or return.

#### 2. GEP-3: Formalized Flow Keywords

- **#AC-28.4**: **TRANSFORM**: Support for `result = TRANSFORM(source, @algo)` syntax in flows.
- **#AC-28.5**: **ON_ERROR**: Support for `ON_ERROR: <action>` blocks within steps (especially `ACHIEVE`).
- **#AC-28.6**: **THROW**: Support for `THROW <ErrorId>` to explicitly surface error conditions.
- **#AC-28.7**: **UPDATE & APPLY**: Support for `UPDATE entity SET field = val` and `APPLY strategy TO target` primitives.

#### 3. GEP-4: Grammar Flexibility & Features

- **#AC-28.8**: **Enhanced Identifiers**: Support for `#` (trace labels), `-` (hyphens), and `.` (paths) in identifiers (e.g., `#AC-101`, `my-component.v1`).
- **#AC-28.9**: **Symbol Support**: Support for backticks (``` ` ```), carets (`^`), and single quotes (`'`) as valid characters in complex identifiers/expressions.
- **#AC-28.10**: **Math Expressions**: Support for binary operators (`+`, `-`, `*`, `/`, `^`, `==`, `!=`, `>`, `<`, `>=`, `<=`) in `FLOW` actions and assignments.
- **#AC-28.11**: **RESOURCES Block**: Support for the top-level `RESOURCES:` block with bulleted lists of external assets and associated `@trace` annotations.
- **#AC-28.12**: **Enhanced MATCH**: Support for multi-pattern lists (e.g., `"admin" | "superadmin" -> ...`) and the `CONTAINS` operator for substring matching.
- **#AC-28.13**: **Soft Keywords**: Support using keywords (e.g., `STATUS`, `DATE`, `INPUT`, `OUTPUT`, `RESOURCES`, `NAMESPACE`, `CHOSEN`) as identifiers in unambiguous contexts (e.g., as field names or component names).
- **#AC-28.14**: **Shorthand Annotations**: Support trace labels and complex path-based identifiers directly within annotations (e.g., `@trace(#AC-101)`, `@ref(Types.Requirement)`).

#### 4. GEP-5: Mandatory VALIDATE Binding

- **#AC-28.15**: **Explicit Binding**: Enforce `VALIDATE <expr> AS TYPE.TypeName` syntax. No implicit binding is allowed.
- **#AC-28.16**: **Path-based Binding**: Support dot-separated type paths in the binding (e.g., `AS TYPE.Project.Types.Requirement`).
- **#AC-28.17**: **Binding Resolution**: Error (V011) if the bound type is missing, invalid, or inaccessible in the current namespace.
- **#AC-28.18**: **Transpiler Guarantees**: Hover info and diagnostics reflect strict 1.1.0 behavioral contracts (64-bit Ints, UTF-8 Strings, fixed-point Decimal precision).
