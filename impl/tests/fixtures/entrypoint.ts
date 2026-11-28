import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

interface SourceRange {
    start: { line: number; character: number };
    end: { line: number; character: number };
}

interface SourceLocation {
    uri: string;
    range: SourceRange;
}

interface EntryPoint {
    name: string;
    declaration: SourceLocation;
    flow: SourceLocation;
}

interface ExecutableResult {
    diagnostics: { uri: string; diagnostic: { message: string; range: SourceRange } }[];
    entrypoint: EntryPoint | null;
    ast: {
        documents: { uri: string; entrypoints: { name: string; location: SourceLocation }[] }[];
        entrypoint: EntryPoint | null;
    } | null;
}

export const header = 'VERSION 1.2\nCONTEXT: "Executable design"\nTARGET: "Go"\n';
export const greet = 'FLOW greet():\n    1. LOG "Hello, World!"\n';

export async function withSources(
    files: Record<string, string>,
    run: (uris: Record<string, vscode.Uri>, directory: string) => Promise<void>
): Promise<void> {
    const directory = await realpath(await mkdtemp(path.join(tmpdir(), 'gasd-entrypoint-')));
    try {
        const uris: Record<string, vscode.Uri> = {};
        for (const [name, content] of Object.entries(files)) {
            const file = path.join(directory, name);
            await writeFile(file, content);
            uris[name] = vscode.Uri.file(file);
        }
        await run(uris, directory);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

export async function validateExecutable(uris?: vscode.Uri[], exportAST = true): Promise<ExecutableResult> {
    const extension = vscode.extensions.getExtension('gasd-expert.vscode-gasd');
    assert.ok(extension);
    await extension.activate();
    const result = uris
        ? await vscode.commands.executeCommand<ExecutableResult>('gasd.validateExecutable', {
            uris: uris.map(uri => uri.toString()),
            exportAST
        })
        : await vscode.commands.executeCommand<ExecutableResult>('gasd.validateExecutable');
    assert.ok(result, 'The executable command must return its validation result');
    return result;
}
