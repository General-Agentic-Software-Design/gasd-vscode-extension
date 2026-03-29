// Shared Data Transfer Objects for GASD 1.2 Communication
// Maps directly to design/types.gasd

export interface SemanticTriple {
    structuralId: string;
    runtimeEffect: string;
    environmentalImpact: string;
}

export interface ContractClause {
    preconditions: string[];
    invariants: string[];
    postconditions: string[];
}

export interface AnnotationASTNode {
    identifier: string; // e.g., @trace
    asId?: string;      // The mapped semantic AS token
}

export enum DiagnosticSeverity {
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4
}

export type LintErrorCode =
    | 'LINT-001' // Missing POSTCONDITION
    | 'LINT-002' // Missing PRECONDITION
    | 'LINT-003' // Invalid Contract Scope
    | 'LINT-004' // Invalid Idempotency Tuple
    | 'LINT-005' // Type Mismatches
    | 'LINT-006' // Invalid Rule Def
    | 'LINT-007' // Action missing state
    | 'LINT-008' // Missing Dependency Ref
    | 'LINT-009' // Circular DEPENDS_ON
    | 'LINT-010' // Invalid Decision Path
    | 'LINT-011' // Missing AS Identifier
    | 'LINT-012'; // Environment TX missing Assumption
