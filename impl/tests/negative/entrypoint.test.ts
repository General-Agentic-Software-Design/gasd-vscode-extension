import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import { greet, header, validateExecutable, withSources } from '../fixtures/entrypoint';

describe('GEP-8 invalid entry points', function () {
    this.timeout(10000);

    it('NT-GEP8-001 applies version, placement, identifier, and local flow rules', async () => {
        // Trace: #US-29, #US-41
        const cases: [string, string, RegExp][] = [
            ['repeated', header + 'ENTRYPOINT: greet\nENTRYPOINT: greet\n' + greet, /duplicate|only one|at most one/i],
            ['unknown', header + 'ENTRYPOINT: missing\n' + greet, /missing.*(?:local|FLOW)/i],
            ['ambiguous', header + 'ENTRYPOINT: greet\n' + greet + greet, /ambiguous|exactly one/i],
            ['case', header + 'ENTRYPOINT: Greet\n' + greet, /Greet.*(?:local|FLOW)/],
            ['nested', header + 'ENTRYPOINT: greet\n' + 'COMPONENT Nested:\n    ' + greet, /greet.*(?:local|FLOW)/i],
            ['quoted', header + 'ENTRYPOINT: "greet"\n' + greet, /identifier/i],
            ['empty', header + 'ENTRYPOINT:\n' + greet, /identifier/i],
            ['multiple', header + 'ENTRYPOINT: greet other\n' + greet, /identifier/i],
            ['punctuation', header + 'ENTRYPOINT=greet\n' + greet, /identifier/i],
            ['placement', 'VERSION 1.2\nENTRYPOINT: greet\n' + header.replace('VERSION 1.2\n', '') + greet, /CONTEXT.*TARGET|TARGET.*CONTEXT/i],
            ['legacy', header.replace('VERSION 1.2\n', '') + 'ENTRYPOINT: greet\n' + greet, /1\.2/],
            ['old', header.replace('1.2', '1.1') + 'ENTRYPOINT: greet\n' + greet, /1\.2/],
        ];
        for (const [name, source, expectedMessage] of cases) {
            await withSources({ 'invalid.gasd': source }, async ({ 'invalid.gasd': uri }) => {
                const result = await validateExecutable([uri]);
                assert.ok(result.diagnostics.some(({ diagnostic }) =>
                    /ENTRYPOINT/i.test(diagnostic.message) && expectedMessage.test(diagnostic.message)), name);
                assert.equal(result.ast, null, name);
                assert.equal(result.entrypoint, null, name);
            });
        }
    });

    it('NT-GEP8-001 rejects imported-only flow names', async () => {
        const contract = 'CONTRACT Imported.Example.ping:\n    OUTPUT: Void\n    BEHAVIORS:\n        CASE ok:\n            POSTCONDITION: result == void\n';
        await withSources({
            'main.gasd': header + 'IMPORT "imported.gasd" AS Imported\nENTRYPOINT: greet\n' + contract,
            'imported.gasd': header + 'COMPONENT Example:\n    INTERFACE:\n        ping() -> Void\n' + greet,
        }, async ({ 'main.gasd': uri }) => {
            const result = await validateExecutable([uri]);
            assert.ok(result.diagnostics.some(item => item.uri === uri.toString()
                && /greet.*(?:local|same document)/i.test(item.diagnostic.message)));
            assert.equal(result.ast, null);
        });
    });

    it('runs ordinary FLOW rules while validating the selected flow', async () => {
        // Trace: #US-30, #US-32
        const source = header + 'ENTRYPOINT: greet\nFLOW greet():\n'
            + '    1. ACHIEVE "Missing postcondition" DEPENDS_ON STEP 2\n'
            + '    2. LOG "Hello" DEPENDS_ON STEP 1\n';
        await withSources({ 'invalid.gasd': source }, async ({ 'invalid.gasd': uri }) => {
            const result = await validateExecutable([uri]);
            assert.ok(result.diagnostics.some(({ diagnostic }) => /ACHIEVE.*POSTCONDITION/i.test(diagnostic.message)));
            assert.ok(result.diagnostics.some(({ diagnostic }) => /circular|cycle/i.test(diagnostic.message)));
            assert.equal(result.ast, null);
        });
        await withSources({ 'signature.gasd': header + 'ENTRYPOINT: greet\nFLOW greet(name):\n    1. RETURN name\n' },
            async ({ 'signature.gasd': uri }) => {
                const result = await validateExecutable([uri]);
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
            const source = (namespace: string, name: string) => header
                + (namespace ? `NAMESPACE: "${namespace}"\n` : '')
                + `ENTRYPOINT: ${name}\nFLOW ${name}():\n    1. RETURN void\n`;
            await withSources({
                'left.gasd': source(leftNamespace, 'greet'),
                'right.gasd': source(rightNamespace, rightName),
            }, async ({ 'left.gasd': left, 'right.gasd': right }) => {
                for (const uri of [left, right]) {
                    assert.deepEqual((await validateExecutable([uri])).diagnostics, []);
                }
                for (const exportAST of [false, true]) {
                    const result = await validateExecutable([right, left], exportAST);
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
        await withSources({ 'main.gasd': header + 'IMPORT "missing.gasd" AS Missing\n' + greet }, async ({ 'main.gasd': uri }) => {
            const result = await validateExecutable([uri]);
            assert.ok(result.diagnostics.some(item => item.uri === uri.toString()
                && item.diagnostic.range.start.line === 3 && /missing\.gasd/.test(item.diagnostic.message)));
            assert.equal(result.ast, null);
        });
    });

    it('publishes local diagnostics and offers a keyword case fix without running an executable check', async () => {
        await withSources({ 'main.gasd': header + 'entrypoint: greet\n' + greet }, async ({ 'main.gasd': uri }) => {
            const diagnostic = (async () => {
                const current = () => vscode.languages.getDiagnostics(uri).find(item => /ENTRYPOINT/.test(item.message));
                return new Promise<vscode.Diagnostic>((resolve, reject) => {
                    const subscription = vscode.languages.onDidChangeDiagnostics(event => {
                        if (event.uris.some(changed => changed.toString() === uri.toString()) && current()) {
                            clearTimeout(timer);
                            subscription.dispose();
                            resolve(current()!);
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
            const fixes = await vscode.commands.executeCommand<vscode.CodeAction[]>('vscode.executeCodeActionProvider', uri, error.range);
            assert.ok(fixes?.some(fix => fix.edit?.get(uri).some(edit => edit.newText === 'ENTRYPOINT')));
        });
    });
});
