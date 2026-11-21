import * as assert from 'node:assert/strict';
import { analyzeContracts, verifyContractCall } from '../../src/server/contracts';
import type { ContractOutcome } from '../../src/shared/contractProtocol';
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
        const analysis = analyzeContracts(inventory);
        assert.deepEqual(analysis.diagnostics, []);
        const [contract] = analysis.contracts;
        assert.deepEqual(contract.behaviors.map(entry => entry.name), ['released', 'failed']);
        const [released, failed] = contract.behaviors;
        assert.equal(released.postconditions[0].source, 'result == void');
        assert.equal(failed.postconditions[0].source, 'error != null');
        const verify = (outcome: ContractOutcome) => verifyContractCall(analysis, {
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
        const analysis = analyzeContracts(`VERSION 1.2
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
        const verify = (outcome: ContractOutcome) => verifyContractCall(analysis, {
            contract: 'Service.run', arguments: {}, outcome,
        }).status;
        const exception = { kind: 'throw', errorType: 'Aborted', error: { message: 'aborted' } } as const;
        assert.equal(verify(exception), 'violation');
        assert.equal(verify({ ...exception, partialResult: { count: 2 } }), 'verified');
        assert.equal(verify({ kind: 'return', value: { count: 2 } }), 'violation');
    });

    it('uses exact Decimal and 64-bit Integer values in contract predicates', () => {
        const analysis = analyzeContracts(`VERSION 1.2
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
        const verify = (id: unknown, value: unknown) => verifyContractCall(analysis, {
            contract: 'Account.balance', arguments: { id }, outcome: { kind: 'return', value },
        }).status;
        const observed = { $gasd: 'Integer', value: '9223372036854775807' };
        assert.equal(verify(observed, { $gasd: 'Decimal', value: '0.2' }), 'verified');
        assert.equal(verify(observed, { $gasd: 'Decimal', value: '0.200000000000000001' }), 'violation');
        assert.equal(verify(9223372036854775806n, 0.2), 'violation');
    });
});
