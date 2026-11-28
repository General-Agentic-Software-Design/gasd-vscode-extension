import * as assert from 'node:assert/strict';
import { readFile, symlink } from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { greet, header, validateExecutable, withSources } from '../fixtures/entrypoint';

describe('GEP-8 entry point acceptance', function () {
    this.timeout(10000);

    it('AT-GEP8-001 offers editor support and exports the exact local flow location', async () => {
        const content = header + 'ENTRYPOINT: greet\n' + greet;
        await withSources({ 'hello.gasd': content }, async ({ 'hello.gasd': uri }) => {
            const doc = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(doc);
            const byActiveFile = await validateExecutable();
            assert.deepEqual(byActiveFile.diagnostics, []);
            assert.equal(byActiveFile.entrypoint?.name, 'greet');

            const exported = await validateExecutable([uri]);
            assert.deepEqual(exported.diagnostics, []);
            assert.equal(exported.ast?.documents[0].entrypoints[0].name, 'greet');
            assert.deepEqual(exported.ast?.entrypoint, exported.entrypoint);
            assert.equal(exported.entrypoint?.declaration.range.start.line, 3);
            assert.equal(exported.entrypoint?.flow.uri, uri.toString());
            assert.equal(exported.entrypoint?.flow.range.start.line, 4);

            const request = (command: string, position: vscode.Position) =>
                vscode.commands.executeCommand(command, uri, position);
            const keywords = await request('vscode.executeCompletionItemProvider', new vscode.Position(3, 1)) as vscode.CompletionList;
            assert.ok(keywords.items.some(item => item.label === 'ENTRYPOINT'));
            const localNames = await request('vscode.executeCompletionItemProvider', new vscode.Position(3, 12)) as vscode.CompletionList;
            const flows = localNames.items.filter(item => item.kind === vscode.CompletionItemKind.Function);
            assert.deepEqual(flows.map(item => item.label), ['greet']);
            const hovers = await request('vscode.executeHoverProvider', new vscode.Position(3, 2)) as vscode.Hover[];
            const hoverText = hovers.flatMap(hover => hover.contents.map(item => typeof item === 'string' ? item : item.value)).join('\n');
            assert.match(hoverText, /FLOW.*launch|launch.*FLOW/i);
            const definitions = await request('vscode.executeDefinitionProvider', new vscode.Position(3, 14)) as vscode.Location[];
            assert.equal(definitions.length, 1);
            assert.equal(definitions[0].uri.toString(), uri.toString());
            assert.equal(definitions[0].range.start.line, 4);

            const extension = vscode.extensions.getExtension('gasd-expert.vscode-gasd')!;
            const { grammars, snippets } = extension.packageJSON.contributes;
            const grammar = JSON.parse(await readFile(path.join(extension.extensionPath, grammars[0].path), 'utf8'));
            function matchesDirective(value: unknown): boolean {
                if (typeof value !== 'object' || value === null) return false;
                if ('match' in value && typeof value.match === 'string' && value.match.includes('ENTRYPOINT')) {
                    return new RegExp(value.match).test('ENTRYPOINT: greet');
                }
                return Object.values(value).some(matchesDirective);
            }
            assert.ok(matchesDirective(grammar));
            const snippetData = await readFile(path.join(extension.extensionPath, snippets[0].path), 'utf8');
            assert.match(snippetData, /ENTRYPOINT: \$\{/);
        });
    });

    it('AT-GEP8-002 and AT-GEP8-006 select the declared typed flow regardless of its order', async () => {
        const selected = 'FLOW greet(name: String) -> String:\n    1. RETURN name\n';
        const other = 'FLOW other():\n    1. LOG "Other"\n';
        await withSources({
            'first.gasd': header + 'ENTRYPOINT: greet\n' + selected + other,
            'last.gasd': header + other + 'ENTRYPOINT: greet\n' + selected,
        }, async uris => {
            for (const uri of Object.values(uris)) {
                const result = await validateExecutable([uri]);
                assert.deepEqual(result.diagnostics, []);
                assert.equal(result.entrypoint?.name, 'greet');
                assert.equal(result.entrypoint?.flow.uri, uri.toString());
            }
        });
    });

    it('AT-GEP8-003 deduplicates transitive imports and uses unsaved editor changes', async () => {
        const root = header + 'NAMESPACE: "app.root"\nIMPORT "middle.gasd" AS Middle\n'
            + 'IMPORT "launch-link.gasd" AS Launch\n'
            + 'CONTRACT Middle.Service.ping:\n    OUTPUT: Void\n    BEHAVIORS:\n        CASE ok:\n            POSTCONDITION: result == void\n'
            + 'CONTRACT Launch.Service.ping:\n    OUTPUT: Void\n    BEHAVIORS:\n        CASE ok:\n            POSTCONDITION: result == void\n';
        const service = 'COMPONENT Service:\n    INTERFACE:\n        ping() -> Void\n';
        const middle = header + 'NAMESPACE: "app.middle"\nIMPORT "./launch.gasd" AS Launch\n' + service
            + 'CONTRACT Launch.Service.ping:\n    OUTPUT: Void\n    BEHAVIORS:\n        CASE ok:\n            POSTCONDITION: result == void\n';
        const launch = header + 'NAMESPACE: "app.launch"\n' + service + greet;
        await withSources({ 'root.gasd': root, 'middle.gasd': middle, 'launch.gasd': launch }, async (uris, directory) => {
            await symlink('launch.gasd', path.join(directory, 'launch-link.gasd'));
            const doc = await vscode.workspace.openTextDocument(uris['launch.gasd']);
            const editor = await vscode.window.showTextDocument(doc);
            assert.equal(await editor.edit(edit => edit.insert(new vscode.Position(4, 0), 'ENTRYPOINT: greet\n')), true);
            try {
                const rootOnly = await validateExecutable([uris['root.gasd']]);
                assert.deepEqual(rootOnly.diagnostics, []);
                assert.equal(rootOnly.entrypoint?.flow.uri, uris['launch.gasd'].toString());
                assert.equal(rootOnly.ast?.documents.length, 3);
                assert.deepEqual(await validateExecutable([uris['launch.gasd'], uris['root.gasd']]), rootOnly);
                assert.deepEqual(await validateExecutable([uris['root.gasd'], uris['launch.gasd']]), rootOnly);
            } finally {
                await vscode.commands.executeCommand('workbench.action.files.revert');
            }
        });
    });

    it('AT-GEP8-005 validates and exports an executable with no declaration', async () => {
        await withSources({ 'a.gasd': header + greet, 'b.gasd': header + 'FLOW main():\n    1. RETURN void\n' }, async uris => {
            const inputs = Object.values(uris);
            assert.deepEqual(await validateExecutable(inputs, false), { diagnostics: [], entrypoint: null, ast: null });
            const result = await validateExecutable(inputs);
            assert.deepEqual(result.diagnostics, []);
            assert.equal(result.ast?.entrypoint, null);
            assert.deepEqual(result.ast?.documents.map(doc => doc.uri), inputs.map(uri => uri.toString()));
            assert.ok(result.ast?.documents.every(doc => doc.entrypoints.length === 0));
        });
    });

    it('AT-GEP8-004, AT-GEP8-007, AT-GEP8-008, AT-GEP8-009, NT-GEP8-005 and NT-GEP8-006 preserve the source identity for target tools', async () => {
        const bindings = 'CONSTRAINT: "Bind args to user arguments and use the result as the exit status."\n';
        const cases = [
            ['Go', 'main', 'FLOW main():\n    1. RETURN void\n'],
            ['Go', 'main', bindings + 'FLOW main(args: List<String>) -> Integer:\n    1. RETURN 0\n'
                + 'FLOW helper(args: List<String>) -> Integer:\n    1. RETURN main(args)\n'],
            ['Python', 'greet', greet],
            ['Node.js', 'greet', greet],
            ['Node.js', 'run', bindings + 'FLOW run(args: List<String>) -> Integer:\n    1. RETURN 2\n'],
            ['Host-managed', 'greet', greet],
            ['Go', 'greet', 'FLOW greet(name: String) -> String:\n    1. RETURN name\n'],
        ];
        for (const [target, name, definition] of cases) {
            const source = header.replace('"Go"', JSON.stringify(target)) + `ENTRYPOINT: ${name}\n` + definition;
            await withSources({ 'entry.gasd': source }, async ({ 'entry.gasd': uri }) => {
                const result = await validateExecutable([uri]);
                assert.deepEqual(result.diagnostics, []);
                assert.equal(result.ast?.entrypoint?.name, name);
                assert.equal(result.ast?.entrypoint?.flow.uri, uri.toString());
                const line = result.ast.entrypoint.flow.range.start.line;
                assert.ok(source.split('\n')[line].startsWith(`FLOW ${name}(`));
            });
        }
    });
});
