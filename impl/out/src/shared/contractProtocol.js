"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportContractAstRequest = exports.verifyContractRequest = void 0;
exports.isRecord = isRecord;
exports.isContractCallRequest = isContractCallRequest;
exports.verifyContractRequest = 'gasd/verifyContractCall';
exports.exportContractAstRequest = 'gasd/exportContractAst';
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isContractCallRequest(value) {
    if (!isRecord(value) || typeof value.contract !== 'string' || value.contract.trim() === '' ||
        !isRecord(value.arguments) || !isRecord(value.outcome))
        return false;
    const { outcome } = value;
    if (outcome.kind !== 'return' && outcome.kind !== 'throw')
        return false;
    if (outcome.kind === 'return' && outcome.resultVariant !== undefined &&
        outcome.resultVariant !== 'success' && outcome.resultVariant !== 'failure')
        return false;
    if (outcome.kind === 'throw' && outcome.errorType !== undefined &&
        (typeof outcome.errorType !== 'string' || !outcome.errorType.trim()))
        return false;
    const { elapsedMilliseconds, additionalAttempts, evidence, evaluations } = outcome;
    return (elapsedMilliseconds === undefined || (typeof elapsedMilliseconds === 'number' && Number.isFinite(elapsedMilliseconds) && elapsedMilliseconds >= 0)) &&
        (additionalAttempts === undefined || (typeof additionalAttempts === 'number' && Number.isSafeInteger(additionalAttempts) && additionalAttempts >= 0)) &&
        (evidence === undefined || (isRecord(evidence) && Object.values(evidence).every(answer => typeof answer === 'boolean'))) &&
        (evaluations === undefined || isRecord(evaluations));
}
//# sourceMappingURL=contractProtocol.js.map