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
describe('GEP-8 invalid entry points', function () {
    this.timeout(10000);
    it('NT-GEP8-001 applies version, placement, identifier, and local flow rules', async () => {
        // Trace: #US-29, #US-41
        const cases = [
            ['repeated', entrypoint_1.header + 'ENTRYPOINT: greet\nENTRYPOINT: greet\n' + entrypoint_1.greet, /duplicate|only one|at most one/i],
            ['unknown', entrypoint_1.header + 'ENTRYPOINT: missing\n' + entrypoint_1.greet, /missing.*(?:local|FLOW)/i],
            ['ambiguous', entrypoint_1.header + 'ENTRYPOINT: greet\n' + entrypoint_1.greet + entrypoint_1.greet, /ambiguous|exactly one/i],
            ['case', entrypoint_1.header + 'ENTRYPOINT: Greet\n' + entrypoint_1.greet, /Greet.*(?:local|FLOW)/],
            ['nested', entrypoint_1.header + 'ENTRYPOINT: greet\n' + 'COMPONENT Nested:\n    ' + entrypoint_1.greet, /greet.*(?:local|FLOW)/i],
            ['quoted', entrypoint_1.header + 'ENTRYPOINT: "greet"\n' + entrypoint_1.greet, /identifier/i],
            ['empty', entrypoint_1.header + 'ENTRYPOINT:\n' + entrypoint_1.greet, /identifier/i],
            ['multiple', entrypoint_1.header + 'ENTRYPOINT: greet other\n' + entrypoint_1.greet, /identifier/i],
            ['punctuation', entrypoint_1.header + 'ENTRYPOINT=greet\n' + entrypoint_1.greet, /identifier/i],
            ['placement', 'VERSION 1.2\nENTRYPOINT: greet\n' + entrypoint_1.header.replace('VERSION 1.2\n', '') + entrypoint_1.greet, /CONTEXT.*TARGET|TARGET.*CONTEXT/i],
            ['legacy', entrypoint_1.header.replace('VERSION 1.2\n', '') + 'ENTRYPOINT: greet\n' + entrypoint_1.greet, /1\.2/],
            ['old', entrypoint_1.header.replace('1.2', '1.1') + 'ENTRYPOINT: greet\n' + entrypoint_1.greet, /1\.2/],
        ];
        for (const [name, source, expectedMessage] of cases) {
            await (0, entrypoint_1.withSources)({ 'invalid.gasd': source }, async ({ 'invalid.gasd': uri }) => {
                const result = await (0, entrypoint_1.validateExecutable)([uri]);
                assert.ok(result.diagnostics.some(({ diagnostic }) => /ENTRYPOINT/i.test(diagnostic.message) && expectedMessage.test(diagnostic.message)), name);
                assert.equal(result.ast, null, name);
                assert.equal(result.entrypoint, null, name);
            });
        }
    });
    it('NT-GEP8-001 rejects imported-only flow names', async () => {
        const contract = 'CONTRACT Imported.Example.ping:\n    OUTPUT: Void\n    BEHAVIORS:\n        CASE ok:\n            POSTCONDITION: result == void\n';
        await (0, entrypoint_1.withSources)({
            'main.gasd': entrypoint_1.header + 'IMPORT "imported.gasd" AS Imported\nENTRYPOINT: greet\n' + contract,
            'imported.gasd': entrypoint_1.header + 'COMPONENT Example:\n    INTERFACE:\n        ping() -> Void\n' + entrypoint_1.greet,
        }, async ({ 'main.gasd': uri }) => {
            const result = await (0, entrypoint_1.validateExecutable)([uri]);
            assert.ok(result.diagnostics.some(item => item.uri === uri.toString()
                && /greet.*(?:local|same document)/i.test(item.diagnostic.message)));
            assert.equal(result.ast, null);
        });
    });
    it('runs ordinary FLOW rules while validating the selected flow', async () => {
        // Trace: #US-30, #US-32
        const source = entrypoint_1.header + 'ENTRYPOINT: greet\nFLOW greet():\n'
            + '    1. ACHIEVE "Missing postcondition" DEPENDS_ON STEP 2\n'
            + '    2. LOG "Hello" DEPENDS_ON STEP 1\n';
        await (0, entrypoint_1.withSources)({ 'invalid.gasd': source }, async ({ 'invalid.gasd': uri }) => {
            const result = await (0, entrypoint_1.validateExecutable)([uri]);
            assert.ok(result.diagnostics.some(({ diagnostic }) => /ACHIEVE.*POSTCONDITION/i.test(diagnostic.message)));
            assert.ok(result.diagnostics.some(({ diagnostic }) => /circular|cycle/i.test(diagnostic.message)));
            assert.equal(result.ast, null);
        });
        await (0, entrypoint_1.withSources)({ 'signature.gasd': entrypoint_1.header + 'ENTRYPOINT: greet\nFLOW greet(name):\n    1. RETURN name\n' }, async ({ 'signature.gasd': uri }) => {
            const result = await (0, entrypoint_1.validateExecutable)([uri]);
            assert.ok(result.diagnostics.some(({ diagnostic }) => /invalid FLOW.*greet/i.test(diagnostic.message)));
            assert.equal(result.ast, null);
        });
    });
    it('NT-GEP8-004 locates every combined diagnostic across namespace and naming variants', async () => {
        for (const [leftNamespace, rightNamespace, rightName] of [
            ['', '', 'greet'],
            ['same', 'same', 'hello'],
            ['left', 'right', 'greet'],
            ['', 'right', 'hello'],
        ]) {
            const source = (namespace, name) => entrypoint_1.header
                + (namespace ? `NAMESPACE: "${namespace}"\n` : '')
                + `ENTRYPOINT: ${name}\nFLOW ${name}():\n    1. RETURN void\n`;
            await (0, entrypoint_1.withSources)({
                'left.gasd': source(leftNamespace, 'greet'),
                'right.gasd': source(rightNamespace, rightName),
            }, async ({ 'left.gasd': left, 'right.gasd': right }) => {
                for (const uri of [left, right]) {
                    assert.deepEqual((await (0, entrypoint_1.validateExecutable)([uri])).diagnostics, []);
                }
                for (const exportAST of [false, true]) {
                    const result = await (0, entrypoint_1.validateExecutable)([right, left], exportAST);
                    assert.equal(result.ast, null);
                    assert.equal(result.entrypoint, null);
                    assert.deepEqual(result.diagnostics.map(({ uri, diagnostic }) => [
                        uri, diagnostic.range.start.line,
                    ]), [[left.toString(), leftNamespace ? 4 : 3], [right.toString(), rightNamespace ? 4 : 3]]);
                    assert.ok(result.diagnostics.every(({ diagnostic }) => /duplicate|only one|at most one/i.test(diagnostic.message)));
                }
            });
        }
    });
    it('reports unreadable imports with their source location', async () => {
        await (0, entrypoint_1.withSources)({ 'main.gasd': entrypoint_1.header + 'IMPORT "missing.gasd" AS Missing\n' + entrypoint_1.greet }, async ({ 'main.gasd': uri }) => {
            const result = await (0, entrypoint_1.validateExecutable)([uri]);
            assert.ok(result.diagnostics.some(item => item.uri === uri.toString()
                && item.diagnostic.range.start.line === 3 && /missing\.gasd/.test(item.diagnostic.message)));
            assert.equal(result.ast, null);
        });
    });
    it('publishes local diagnostics and offers a keyword case fix without running an executable check', async () => {
        await (0, entrypoint_1.withSources)({ 'main.gasd': entrypoint_1.header + 'entrypoint: greet\n' + entrypoint_1.greet }, async ({ 'main.gasd': uri }) => {
            const diagnostic = (async () => {
                const current = () => vscode.languages.getDiagnostics(uri).find(item => /ENTRYPOINT/.test(item.message));
                return new Promise((resolve, reject) => {
                    const subscription = vscode.languages.onDidChangeDiagnostics(event => {
                        if (event.uris.some(changed => changed.toString() === uri.toString()) && current()) {
                            clearTimeout(timer);
                            subscription.dispose();
                            resolve(current());
                        }
                    });
                    const timer = setTimeout(() => {
                        subscription.dispose();
                        reject(new Error('No ENTRYPOINT case diagnostic'));
                    }, 5000);
                });
            })();
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc);
            const error = await diagnostic;
            assert.equal(error.range.start.line, 3);
            const fixes = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', uri, error.range);
            assert.ok(fixes?.some(fix => fix.edit?.get(uri).some(edit => edit.newText === 'ENTRYPOINT')));
        });
    });
});
//# sourceMappingURL=entrypoint.test.js.map