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
const releaseEffect = 'An existing reservation is cleared and its quantities are returned to available stock. Repeating the same release leaves stock unchanged.';
const failureEffect = 'Stock and reservations are unchanged.';
const inventory = `VERSION 1.2
TYPE OrderItem:
    quantity: Integer
COMPONENT InventoryService:
    INTERFACE:
        release_stock(items: List<OrderItem>) -> Result<Void>
CONTRACT InventoryService.release_stock:
    INPUT: items: List<OrderItem>
    OUTPUT: Result<Void>
    BEHAVIORS:
        CASE released:
            POSTCONDITION: result == void
            POSTCONDITION: "${releaseEffect}"
        CASE failed:
            POSTCONDITION: error != null
            POSTCONDITION: "${failureEffect}"
    IDEMPOTENT: true
`;
describe('GEP-7 contract regressions', () => {
    it('RT-GEP7-002 preserves the release cases and checks independently observed stock effects', () => {
        const analysis = (0, contracts_1.analyzeContracts)(inventory);
        assert.deepEqual(analysis.diagnostics, []);
        const [contract] = analysis.contracts;
        assert.deepEqual(contract.behaviors.map(entry => entry.name), ['released', 'failed']);
        const [released, failed] = contract.behaviors;
        assert.equal(released.postconditions[0].source, 'result == void');
        assert.equal(failed.postconditions[0].source, 'error != null');
        const verify = (outcome) => (0, contracts_1.verifyContractCall)(analysis, {
            contract: 'InventoryService.release_stock', arguments: { items: [{ quantity: 2 }] }, outcome,
        });
        assert.equal(verify({ kind: 'return', resultVariant: 'success' }).status, 'unverified');
        let stock = 10;
        let reservation = 2;
        const executeRelease = () => { stock += reservation; reservation = 0; };
        executeRelease();
        const stockAfterFirstRelease = stock;
        executeRelease();
        const result = verify({ kind: 'return', resultVariant: 'success', evidence: {
                [releaseEffect]: stockAfterFirstRelease === 12 && stock === stockAfterFirstRelease && reservation === 0,
            } });
        assert.equal(result.status, 'verified');
        assert.deepEqual(result.matchedCases, ['released']);
        assert.deepEqual(verify({ kind: 'return', resultVariant: 'failure', error: 'Unavailable', evidence: {
                [failureEffect]: true,
            } }).matchedCases, ['failed']);
    });
    it('supports an observed partial result only on the exceptional call that supplies it', () => {
        const analysis = (0, contracts_1.analyzeContracts)(`VERSION 1.2
COMPONENT Service:
    INTERFACE:
        run() -> Integer
CONTRACT Service.run:
    OUTPUT: Integer
    BEHAVIORS:
        CASE partial:
            THROWS: Aborted
            POSTCONDITION: result.count + 2 * 3 == 8
            POSTCONDITION: error.message == "aborted"
`);
        const verify = (outcome) => (0, contracts_1.verifyContractCall)(analysis, {
            contract: 'Service.run', arguments: {}, outcome,
        }).status;
        const exception = { kind: 'throw', errorType: 'Aborted', error: { message: 'aborted' } };
        assert.equal(verify(exception), 'violation');
        assert.equal(verify({ ...exception, partialResult: { count: 2 } }), 'verified');
        assert.equal(verify({ kind: 'return', value: { count: 2 } }), 'violation');
    });
    it('uses exact Decimal and 64-bit Integer values in contract predicates', () => {
        const analysis = (0, contracts_1.analyzeContracts)(`VERSION 1.2
COMPONENT Account:
    INTERFACE:
        balance(id: Integer) -> Decimal
CONTRACT Account.balance:
    INPUT: id: Integer
    OUTPUT: Decimal
    BEHAVIORS:
        CASE known:
            WHEN: id == 9223372036854775807
            POSTCONDITION: result + 0.1 == 0.3
`);
        const verify = (id, value) => (0, contracts_1.verifyContractCall)(analysis, {
            contract: 'Account.balance', arguments: { id }, outcome: { kind: 'return', value },
        }).status;
        const observed = { $gasd: 'Integer', value: '9223372036854775807' };
        assert.equal(verify(observed, { $gasd: 'Decimal', value: '0.2' }), 'verified');
        assert.equal(verify(observed, { $gasd: 'Decimal', value: '0.200000000000000001' }), 'violation');
        assert.equal(verify(9223372036854775806n, 0.2), 'violation');
    });
});
//# sourceMappingURL=contract_outcomes.test.js.map