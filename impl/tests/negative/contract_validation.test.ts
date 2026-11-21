import * as assert from 'node:assert/strict';
import { analyzeContracts, verifyContractCall } from '../../src/server/contracts';
const header = `VERSION 1.2
TYPE Request:
    count: Integer
COMPONENT Service:
    INTERFACE:
        run(req: Request, limit: Integer) -> Void
`;
const signature = '    INPUT: req: Request, limit: Integer\n    OUTPUT: Void\n';
const testContract = (body: string, name = 'Service.run') => analyzeContracts(header + `CONTRACT ${name}:\n` + body);
const behaviors = (clauses: string) => '    BEHAVIORS:\n        CASE done:\n' + clauses;
const success = '            POSTCONDITION: result == void\n';

describe('GEP-7 invalid contracts', () => {
    it('NT-GEP7-001 emits LINT-007 for missing cases or outcomes', () => {
        for (const fragment of ['', '    BEHAVIORS:\n', behaviors(''), behaviors('            WHEN: limit > 0\n'), behaviors('            AFTER: 2s\n')]) {
            const analysis = testContract(signature + fragment);
            assert.ok(analysis.diagnostics.some(diagnostic => diagnostic.code === 'LINT-007'), fragment);
        }
    });

    it('NT-GEP7-002 rejects duplicates, unresolved methods and incompatible signatures', () => {
        const cases = behaviors(success);
        for (const invalid of [
            signature.replace('limit: Integer', 'req: Integer') + cases,
            signature + cases + '        CASE done:\n' + success,
            '    INPUT: limit: Integer, req: Request\n    OUTPUT: Void\n' + cases,
            signature.replace('limit: Integer', 'limit: String') + cases,
            signature.replace('OUTPUT: Void', 'OUTPUT: Boolean') + cases,
            '    OUTPUT: Void\n' + cases,
        ]) {
            assert.ok(testContract(invalid).diagnostics.length > 0, invalid);
        }
        assert.ok(testContract(signature + cases, 'Service.unknown').diagnostics.length > 0);
    });

    it('NT-GEP7-003 rejects invalid guard references, comparisons and clause order', () => {
        for (const guard of ['missing == null', 'result == null', 'req.missing == null', 'req > 1', 'limit == "1"', 'limit == 1.5', 'limit > null', 'limit >= 1 trailing']) {
            const analysis = testContract(signature + behaviors(`            WHEN: ${guard}\n` + success));
            assert.ok(analysis.diagnostics.length > 0, guard);
        }
        assert.ok(testContract(signature + behaviors(success + '            WHEN: limit > 0\n')).diagnostics.length > 0);
    });

    it('rejects repeated or malformed THROWS and AFTER clauses', () => {
        for (const clauses of [
            'THROWS: ErrorA\n            THROWS: ErrorB',
            'AFTER: 2s\n            AFTER: retry(2)',
            'AFTER: retry(-1)', 'AFTER: retry(1.5)', 'AFTER: retry("2")', 'AFTER: sleep(1)',
        ]) {
            assert.ok(testContract(signature + behaviors(success + `            ${clauses}\n`)).diagnostics.length > 0, clauses);
        }
    });

    it('reports reached unevaluable guards even if another eligible case matches', () => {
        const analysis = testContract(signature + behaviors('            WHEN: limit > 0\n' + success) + '        CASE always:\n' + success);
        const verify = (args: Record<string, unknown>) => verifyContractCall(analysis, {
            contract: 'Service.run', arguments: args, outcome: { kind: 'return' },
        }).status;
        assert.equal(verify({}), 'verification-error');
        assert.equal(verify({ limit: '1' }), 'verification-error');
        assert.equal(verify({ limit: 0 }), 'verified');
    });
});
