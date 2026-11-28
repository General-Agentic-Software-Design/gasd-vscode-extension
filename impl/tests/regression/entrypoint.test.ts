import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { greet, header, validateExecutable, withSources } from '../fixtures/entrypoint';

describe('GEP-8 entry point regressions', function () {
    this.timeout(10000);

    it('RT-GEP8-001 keeps library-style 1.1 and 1.2 sources valid without a directive', async () => {
        const softIdentifier = 'TYPE Config:\n    ENTRYPOINT: String\n'
            + 'FLOW ENTRYPOINT():\n    1. LOG "ENTRYPOINT: invented"\n';
        const ignored = '// ENTRYPOINT: missing\n/*\nENTRYPOINT: also_missing\nFLOW fake():\n*/\n';
        await withSources({
            'legacy.gasd': header.replace('VERSION 1.2\n', '') + ignored + softIdentifier,
            'library.gasd': header + ignored + softIdentifier + greet,
        }, async uris => {
            const result = await validateExecutable(Object.values(uris));
            assert.deepEqual(result.diagnostics, []);
            assert.equal(result.entrypoint, null);
            assert.ok(result.ast?.documents.every(source => source.entrypoints.length === 0));
        });
    });

    it('retains extended GASD identifier spelling in an entry point', async () => {
        // Trace: #US-28
        const source = header + '/* Start of declarations */ ENTRYPOINT: #cli.start-up\n'
            + 'FLOW #cli.start-up():\n    1. LOG "A quoted @trace is part of the message."\n';
        await withSources({ 'extended.gasd': source }, async ({ 'extended.gasd': uri }) => {
            const result = await validateExecutable([uri]);
            assert.deepEqual(result.diagnostics, []);
            assert.equal(result.entrypoint?.name, '#cli.start-up');
        });
    });

    it('preserves annotation semantic hover in a GASD 1.2 executable', async () => {
        // Trace: #US-38
        const source = header + 'ENTRYPOINT: greet\nFLOW greet():\n'
            + '    1. ACHIEVE "Try once" @retry(1) AS RETRY @idempotent AS IDEMPOTENT:\n'
            + '        POSTCONDITION: result != null\n';
        await withSources({ 'hover.gasd': source }, async ({ 'hover.gasd': uri }) => {
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc);
            const position = new vscode.Position(5, doc.lineAt(5).text.indexOf('@retry') + 2);
            const hovers = await vscode.commands.executeCommand<vscode.Hover[]>('vscode.executeHoverProvider', uri, position);
            const contents = hovers.flatMap(hover => hover.contents.map(item => typeof item === 'string' ? item : item.value)).join('\n');
            assert.match(contents, /Structural/i);
            assert.match(contents, /Runtime/i);
            assert.match(contents, /Environment/i);
        });
    });
});
