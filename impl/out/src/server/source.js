"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nameSegment = exports.gasdIdentifier = void 0;
exports.stringValue = stringValue;
exports.uncomment = uncomment;
exports.maskStrings = maskStrings;
exports.lineTree = lineTree;
exports.parseSourceImport = parseSourceImport;
exports.resolveSourceImport = resolveSourceImport;
const node_path_1 = require("node:path");
const node_url_1 = require("node:url");
const node_1 = require("vscode-languageserver/node");
exports.gasdIdentifier = '[A-Za-z_#][A-Za-z0-9_.-]*';
exports.nameSegment = '[A-Za-z_#][A-Za-z0-9_-]*';
const importPattern = new RegExp(`^IMPORT\\s+("(?:[^"\\\\]|\\\\.)*")(?:\\s+AS\\s+(${exports.nameSegment}))?$`);
function stringValue(token) {
    try {
        return JSON.parse(token);
    }
    catch {
        return token.slice(1, -1).replace(/\\(["\\])/g, '$1');
    }
}
function uncomment(source, replacement = ' ') {
    return source.replace(/"(?:[^"\\\r\n]|\\.)*"|\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\r\n]*/g, part => part.startsWith('"') ? part : part.replace(/[^\r\n]/g, replacement));
}
function maskStrings(source) {
    return source.replace(/"(?:[^"\\]|\\.)*"/g, value => ' '.repeat(value.length));
}
function lineTree(source) {
    const roots = [];
    const stack = [];
    // Mask comments separately from indentation while retaining the original source columns.
    uncomment(source, '\0').split(/\r?\n/).forEach((raw, index) => {
        const code = raw.replace(/\0/g, ' ').trimEnd();
        const start = code.search(/\S/);
        if (start === -1)
            return;
        const indent = /^[\t ]*/.exec(raw)[0].replace(/\t/g, '    ').length;
        const line = { text: code.slice(start), indent, range: node_1.Range.create(index, start, index, code.length), children: [] };
        while (stack.length && stack[stack.length - 1].indent >= indent)
            stack.pop();
        const parent = stack[stack.length - 1];
        (parent ? parent.children : roots).push(line);
        stack.push(line);
    });
    return roots;
}
function parseSourceImport(text) {
    const match = importPattern.exec(text);
    return match ? { path: stringValue(match[1]), alias: match[2] } : undefined;
}
function resolveSourceImport(importPath, documentUri) {
    try {
        if (importPath.startsWith('file:'))
            return (0, node_url_1.pathToFileURL)((0, node_url_1.fileURLToPath)(importPath)).href;
        return (0, node_url_1.pathToFileURL)((0, node_path_1.resolve)((0, node_path_1.dirname)((0, node_url_1.fileURLToPath)(documentUri)), importPath)).href;
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=source.js.map