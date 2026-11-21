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
const vscode = __importStar(require("vscode"));
const contracts_1 = require("../../src/server/contracts");
const payment = `VERSION 1.2
CONTEXT: "Contract guards"
TARGET: "TypeScript"
TYPE PaymentCustomer:
    status: String
    customerId: UUID
COMPONENT PaymentService:
    INTERFACE:
        createCustomer(email: String) -> PaymentCustomer
CONTRACT PaymentService.createCustomer:
    INPUT: email: String
    OUTPUT: PaymentCustomer
    BEHAVIORS:
`;
const paymentCases = [
    `        CASE success:
            WHEN: email != null
            POSTCONDITION: result.status == "ACTIVE"
            POSTCONDITION: result.customerId IS UUID
`,
    `        CASE service_failure:
            WHEN: email != null
            THROWS: PaymentGatewayException
            AFTER: retry(2)
`,
    `        CASE timeout:
            WHEN: email != null
            THROWS: PaymentGatewayException
            AFTER: 3000ms
`,
    `        CASE null_input:
            WHEN: email == null
            THROWS: IllegalArgumentException
`,
];
describe('GEP-7 contract acceptance', () => {
    it('AT-GEP7-001 supports imported interfaces, ordered generic inputs and omitted zero-parameter INPUT', () => {
        const files = {
            'file:///common.gasd': 'VERSION 1.2\nTYPE OrderItem:\n    id: String\n',
            'file:///inventory.gasd': `VERSION 1.2
IMPORT "common.gasd" AS Data
COMPONENT Inventory:
    INTERFACE:
        reserve(items: List<Data.OrderItem>, options: Map<String, List<Integer>>) -> Result<Void>
        reset() -> Void
`,
        };
        const source = `VERSION 1.2
IMPORT "common.gasd" AS Common
IMPORT "inventory.gasd" AS Stock
CONTRACT Stock.Inventory.reserve:
    INPUT: items: List<Common.OrderItem>, options: Map<String, List<Integer>>
    OUTPUT: Result<Void>
    BEHAVIORS:
        CASE success:
            POSTCONDITION: result == void
CONTRACT Stock.reset:
    OUTPUT: Void
    BEHAVIORS:
        CASE success:
            POSTCONDITION: result == void
`;
        const analysis = (0, contracts_1.analyzeContracts)(source, { uri: 'file:///test.gasd', readImport: (uri) => files[uri] });
        assert.deepEqual(analysis.diagnostics, []);
        assert.deepEqual(analysis.contracts[0].input.map(input => input.name), ['items', 'options']);
        assert.deepEqual(analysis.contracts[1].input, []);
    });
    it('AT-GEP7-002 preserves ordered guards and short-circuits unavailable field access', () => {
        const source = `VERSION 1.2
TYPE Request:
    quantity: Integer
COMPONENT Inventory:
    INTERFACE:
        reserve(request: Request) -> Void
CONTRACT Inventory.reserve:
    INPUT: request: Request
    OUTPUT: Void
    BEHAVIORS:
        CASE positive:
            WHEN: request != null
            WHEN: request.quantity > 0
            POSTCONDITION: result == void
        CASE missing:
            WHEN: request == null
            THROWS: MissingRequest
`;
        for (const mode of ['syntax', 'semantic']) {
            const [{ behaviors }] = (0, contracts_1.exportContractAst)(source, mode);
            assert.deepEqual(behaviors[0].when.map(guard => guard.source), [
                'request != null', 'request.quantity > 0',
            ]);
        }
        const result = (0, contracts_1.verifyContractCall)((0, contracts_1.analyzeContracts)(source), {
            contract: 'Inventory.reserve', arguments: { request: null }, outcome: { kind: 'throw', errorType: 'MissingRequest' },
        });
        assert.equal(result.status, 'verified');
        assert.deepEqual(result.matchedCases, ['missing']);
    });
    it('AT-GEP7-003 matches null, success, retry and elapsed time independently of case order', () => {
        for (const cases of [paymentCases, [...paymentCases].reverse()]) {
            const analysis = (0, contracts_1.analyzeContracts)(payment + cases.join(''));
            assert.deepEqual(analysis.diagnostics, []);
            const casesToVerify = [
                { email: null, name: 'null_input', outcome: { kind: 'throw', errorType: 'IllegalArgumentException' } },
                { email: 'a@example.com', name: 'success', outcome: { kind: 'return', value: { status: 'ACTIVE', customerId: 'b4be82bf-4820-4f21-9bd3-2bfa68d1fa21' } } },
                { email: 'a@example.com', name: 'service_failure', outcome: { kind: 'throw', errorType: 'PaymentGatewayException', additionalAttempts: 2 } },
                { email: 'a@example.com', name: 'timeout', outcome: { kind: 'throw', errorType: 'PaymentGatewayException', additionalAttempts: 0, elapsedMilliseconds: 3000 } },
            ];
            for (const { email, name, outcome } of casesToVerify) {
                const result = (0, contracts_1.verifyContractCall)(analysis, { contract: 'PaymentService.createCustomer', arguments: { email }, outcome });
                assert.equal(result.status, 'verified');
                assert.deepEqual(result.matchedCases, [name]);
            }
        }
    });
    it('AT-GEP7-004 distinguishes missing evidence, proven outcomes and contradictions', () => {
        const analysis = (0, contracts_1.analyzeContracts)(payment + `        CASE audited:
            POSTCONDITION: "The audit record was written."
            POSTCONDITION: result.status == "ACTIVE"
            AFTER: 2s
`);
        const verify = (status, elapsedMilliseconds, evidence) => (0, contracts_1.verifyContractCall)(analysis, {
            contract: 'PaymentService.createCustomer', arguments: { email: 'a@example.com' },
            outcome: { kind: 'return', value: { status }, elapsedMilliseconds, evidence },
        }).status;
        assert.equal(verify('ACTIVE'), 'unverified');
        assert.equal(verify('ACTIVE', 2000), 'unverified');
        assert.equal(verify('ACTIVE', 2000, { 'The audit record was written.': true }), 'verified');
        assert.equal(verify('ACTIVE', 1999), 'violation');
        assert.equal(verify('ACTIVE', 2000, { 'The audit record was written.': false }), 'violation');
        assert.equal(verify('INACTIVE'), 'violation');
    });
    it('offers WHEN in the editor and verifies an observation through the extension command', async function () {
        this.timeout(15000);
        const extension = vscode.extensions.getExtension('gasd-expert.vscode-gasd');
        assert.ok(extension);
        await extension.activate();
        const document = await vscode.workspace.openTextDocument({ language: 'gasd', content: payment + paymentCases.join('') });
        await vscode.window.showTextDocument(document);
        const line = Array.from({ length: document.lineCount }, (_, i) => i).find(i => document.lineAt(i).text.includes('WHEN:'));
        const completion = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, new vscode.Position(line, '            WHEN'.length));
        assert.ok(completion.items.some(item => item.label === 'WHEN'));
        const result = await vscode.commands.executeCommand('gasd.verifyContractCall', {
            contract: 'PaymentService.createCustomer', arguments: { email: null }, outcome: { kind: 'throw', errorType: 'IllegalArgumentException' },
        });
        assert.equal(result?.status, 'verified');
        assert.deepEqual(result.matchedCases, ['null_input']);
    });
    it('publishes LINT-007 in VS Code for an empty CASE outcome', async function () {
        this.timeout(10000);
        const document = await vscode.workspace.openTextDocument({
            language: 'gasd',
            content: payment + '        CASE incomplete:\n            WHEN: email != null\n',
        });
        let subscription;
        try {
            const diagnostics = new Promise(resolve => {
                const check = () => {
                    const entries = vscode.languages.getDiagnostics(document.uri);
                    if (entries.length)
                        resolve(entries);
                };
                subscription = vscode.languages.onDidChangeDiagnostics(event => {
                    if (event.uris.some(uri => uri.toString() === document.uri.toString()))
                        check();
                });
                check();
            });
            await vscode.window.showTextDocument(document);
            const lint = (await diagnostics).find(diagnostic => diagnostic.code === 'LINT-007');
            assert.equal(lint?.severity, vscode.DiagnosticSeverity.Error);
            assert.match(document.lineAt(lint.range.start.line).text, /CASE incomplete:/);
        }
        finally {
            subscription?.dispose();
        }
    });
});
//# sourceMappingURL=contract_guards.test.js.map