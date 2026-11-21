export const verifyContractRequest = 'gasd/verifyContractCall';
export const exportContractAstRequest = 'gasd/exportContractAst';

interface CompletionEvidence {
    elapsedMilliseconds?: number;
    additionalAttempts?: number;
    evidence?: Record<string, boolean>;
    evaluations?: Record<string, unknown>;
}

export type ContractOutcome = CompletionEvidence & (
    | { kind: 'return'; value?: unknown; resultVariant?: 'success' | 'failure'; error?: unknown }
    | { kind: 'throw'; errorType?: string; error?: unknown; partialResult?: unknown }
);

export interface ContractCallRequest {
    contract: string;
    arguments: Record<string, unknown>;
    outcome: ContractOutcome;
}

export interface ContractVerification {
    status: 'verified' | 'unverified' | 'violation' | 'verification-error';
    matchedCases: string[];
    message: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isContractCallRequest(value: unknown): value is ContractCallRequest {
    if (!isRecord(value) || typeof value.contract !== 'string' || value.contract.trim() === '' ||
        !isRecord(value.arguments) || !isRecord(value.outcome)) return false;
    const { outcome } = value;
    if (outcome.kind !== 'return' && outcome.kind !== 'throw') return false;
    if (outcome.kind === 'return' && outcome.resultVariant !== undefined &&
        outcome.resultVariant !== 'success' && outcome.resultVariant !== 'failure') return false;
    if (outcome.kind === 'throw' && outcome.errorType !== undefined &&
        (typeof outcome.errorType !== 'string' || !outcome.errorType.trim())) return false;
    const { elapsedMilliseconds, additionalAttempts, evidence, evaluations } = outcome;
    return (elapsedMilliseconds === undefined || (typeof elapsedMilliseconds === 'number' && Number.isFinite(elapsedMilliseconds) && elapsedMilliseconds >= 0)) &&
        (additionalAttempts === undefined || (typeof additionalAttempts === 'number' && Number.isSafeInteger(additionalAttempts) && additionalAttempts >= 0)) &&
        (evidence === undefined || (isRecord(evidence) && Object.values(evidence).every(answer => typeof answer === 'boolean'))) &&
        (evaluations === undefined || isRecord(evaluations));
}
