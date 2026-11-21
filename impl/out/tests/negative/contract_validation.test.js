"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("node:assert/strict"));
const contracts_1 = require("../../src/server/contracts");
const header = `VERSION 1.2
TYPE Request:
    count: Integer
COMPONENT Service:
    INTERFACE:
        run(req: Request, limit: Integer) -> Void
`;
const signature = '    INPUT: req: Request, limit: Integer\n    OUTPUT: Void\n';
const testContract = (body, name = 'Service.run') => (0, contracts_1.analyzeContracts)(header + `CONTRACT ${name}:\n` + body);
const behaviors = (clauses) => '    BEHAVIORS:\n        CASE done:\n' + clauses;
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
        const verify = (args) => (0, contracts_1.verifyContractCall)(analysis, {
            contract: 'Service.run', arguments: args, outcome: { kind: 'return' },
        }).status;
        assert.equal(verify({}), 'verification-error');
        assert.equal(verify({ limit: '1' }), 'verification-error');
        assert.equal(verify({ limit: 0 }), 'verified');
    });
});
//# sourceMappingURL=contract_validation.test.js.map