import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Range } from 'vscode-languageserver/node';

export const gasdIdentifier = '[A-Za-z_#][A-Za-z0-9_.-]*';
export const nameSegment = '[A-Za-z_#][A-Za-z0-9_-]*';
const importPattern = new RegExp(`^IMPORT\\s+("(?:[^"\\\\]|\\\\.)*")(?:\\s+AS\\s+(${nameSegment}))?$`);

export interface SourceLine {
    text: string;
    indent: number;
    range: Range;
    children: SourceLine[];
}

export function stringValue(token: string): string {
    try { return JSON.parse(token) as string; }
    catch { return token.slice(1, -1).replace(/\\(["\\])/g, '$1'); }
}

export function uncomment(source: string, replacement = ' '): string {
    return source.replace(/"(?:[^"\\\r\n]|\\.)*"|\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\r\n]*/g,
        part => part.startsWith('"') ? part : part.replace(/[^\r\n]/g, replacement));
}

export function maskStrings(source: string): string {
    return source.replace(/"(?:[^"\\]|\\.)*"/g, value => ' '.repeat(value.length));
}

export function lineTree(source: string): SourceLine[] {
    const roots: SourceLine[] = [];
    const stack: SourceLine[] = [];
    // Mask comments separately from indentation while retaining the original source columns.
    uncomment(source, '\0').split(/\r?\n/).forEach((raw, index) => {
        const code = raw.replace(/\0/g, ' ').trimEnd();
        const start = code.search(/\S/);
        if (start === -1) return;
        const indent = /^[\t ]*/.exec(raw)![0].replace(/\t/g, '    ').length;
        const line = { text: code.slice(start), indent, range: Range.create(index, start, index, code.length), children: [] };
        while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
        const parent = stack[stack.length - 1];
        (parent ? parent.children : roots).push(line);
        stack.push(line);
    });
    return roots;
}

export function parseSourceImport(text: string): { path: string; alias?: string } | undefined {
    const match = importPattern.exec(text);
    return match ? { path: stringValue(match[1]), alias: match[2] } : undefined;
}

export function resolveSourceImport(importPath: string, documentUri: string): string | undefined {
    try {
        if (importPath.startsWith('file:')) return pathToFileURL(fileURLToPath(importPath)).href;
        return pathToFileURL(resolve(dirname(fileURLToPath(documentUri)), importPath)).href;
    } catch { return undefined; }
}
