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
const entrypoint_1 = require("../fixtures/entrypoint");
describe('GEP-8 entry point regressions', function () {
    this.timeout(10000);
    it('RT-GEP8-001 keeps library-style 1.1 and 1.2 sources valid without a directive', async () => {
        const softIdentifier = 'TYPE Config:\n    ENTRYPOINT: String\n'
            + 'FLOW ENTRYPOINT():\n    1. LOG "ENTRYPOINT: invented"\n';
        const ignored = '// ENTRYPOINT: missing\n/*\nENTRYPOINT: also_missing\nFLOW fake():\n*/\n';
        await (0, entrypoint_1.withSources)({
            'legacy.gasd': entrypoint_1.header.replace('VERSION 1.2\n', '') + ignored + softIdentifier,
            'library.gasd': entrypoint_1.header + ignored + softIdentifier + entrypoint_1.greet,
        }, async (uris) => {
            const result = await (0, entrypoint_1.validateExecutable)(Object.values(uris));
            assert.deepEqual(result.diagnostics, []);
            assert.equal(result.entrypoint, null);
            assert.ok(result.ast?.documents.every(source => source.entrypoints.length === 0));
        });
    });
    it('retains extended GASD identifier spelling in an entry point', async () => {
        // Trace: #US-28
        const source = entrypoint_1.header + '/* Start of declarations */ ENTRYPOINT: #cli.start-up\n'
            + 'FLOW #cli.start-up():\n    1. LOG "A quoted @trace is part of the message."\n';
        await (0, entrypoint_1.withSources)({ 'extended.gasd': source }, async ({ 'extended.gasd': uri }) => {
            const result = await (0, entrypoint_1.validateExecutable)([uri]);
            assert.deepEqual(result.diagnostics, []);
            assert.equal(result.entrypoint?.name, '#cli.start-up');
        });
    });
    it('preserves annotation semantic hover in a GASD 1.2 executable', async () => {
        // Trace: #US-38
        const source = entrypoint_1.header + 'ENTRYPOINT: greet\nFLOW greet():\n'
            + '    1. ACHIEVE "Try once" @retry(1) AS RETRY @idempotent AS IDEMPOTENT:\n'
            + '        POSTCONDITION: result != null\n';
        await (0, entrypoint_1.withSources)({ 'hover.gasd': source }, async ({ 'hover.gasd': uri }) => {
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc);
            const position = new vscode.Position(5, doc.lineAt(5).text.indexOf('@retry') + 2);
            const hovers = await vscode.commands.executeCommand('vscode.executeHoverProvider', uri, position);
            const contents = hovers.flatMap(hover => hover.contents.map(item => typeof item === 'string' ? item : item.value)).join('\n');
            assert.match(contents, /Structural/i);
            assert.match(contents, /Runtime/i);
            assert.match(contents, /Environment/i);
        });
    });
});
//# sourceMappingURL=entrypoint.test.js.map