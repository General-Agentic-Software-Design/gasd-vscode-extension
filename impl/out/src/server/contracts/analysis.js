"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.numericKinds = exports.ContractScope = void 0;
exports.unwrapOptional = unwrapOptional;
exports.typeKind = typeKind;
exports.analyzeContracts = analyzeContracts;
exports.exportContractAst = exportContractAst;
const node_1 = require("vscode-languageserver/node");
const syntax_1 = require("./syntax");
const source_1 = require("../source");
class ContractScope {
    root;
    readImport;
    documents = new Map();
    constructor(root, readImport) {
        this.root = root;
        this.readImport = readImport;
        this.documents.set(root.uri, root);
    }
    imported(document, path) {
        const uri = (0, source_1.resolveSourceImport)(path, document.uri);
        if (!uri)
            return undefined;
        if (!this.documents.has(uri)) {
            const text = this.readImport?.(uri);
            this.documents.set(uri, text === undefined ? undefined : (0, syntax_1.parseContractDocument)(text, uri, true));
        }
        return this.documents.get(uri);
    }
    method(name) {
        const path = name.split('.');
        if (path.length < 2)
            return undefined;
        const methodName = path.pop();
        const entry = this.root.imports.find(candidate => candidate.alias === path[0]);
        if (entry) {
            const document = this.imported(this.root, entry.path);
            if (!document)
                return undefined;
            const component = path.slice(1).join('.');
            const matches = document.methods.filter(method => method.name === methodName && (!component || method.component === component));
            return matches.length === 1 ? { method: matches[0], document } : undefined;
        }
        const component = path.join('.');
        const method = (document) => document.methods
            .filter(candidate => candidate.component === component && candidate.name === methodName)
            .map(candidate => ({ method: candidate, document }));
        const local = method(this.root);
        if (local.length)
            return local.length === 1 ? local[0] : undefined;
        const imports = this.root.imports.flatMap(candidate => {
            const document = this.imported(this.root, candidate.path);
            return document ? method(document) : [];
        });
        return imports.length === 1 ? imports[0] : undefined;
    }
    record(document, name) {
        const local = document.types.get(name);
        if (local)
            return { document, name, fields: local };
        const [alias, ...parts] = name.split('.');
        const importedName = parts.length ? parts.join('.') : name;
        const candidates = document.imports.filter(entry => parts.length ? entry.alias === alias : entry.alias === undefined);
        const matches = candidates.flatMap(entry => {
            const imported = this.imported(document, entry.path);
            const fields = imported?.types.get(importedName);
            return imported && fields ? [{ document: imported, name: importedName, fields }] : [];
        });
        return matches.length === 1 ? matches[0] : undefined;
    }
    field(scope, field) {
        const base = unwrapOptional(scope);
        if (base.type.kind !== 'named')
            return undefined;
        const record = this.record(base.document, base.type.name);
        const type = record?.fields.get(field);
        return type && record ? { type, document: record.document } : undefined;
    }
    reference(bindings, path) {
        let result = bindings.get(path[0]);
        for (const field of path.slice(1)) {
            if (!result)
                return undefined;
            result = this.field(result, field);
        }
        return result;
    }
    typeKey({ type, document }) {
        if (type.kind === 'named') {
            const record = this.record(document, type.name);
            return record ? `${record.document.uri}#${record.name}` : type.name;
        }
        if (type.kind === 'generic') {
            return `${type.name}<${type.args.map(arg => this.typeKey({ type: arg, document })).join(',')}>`;
        }
        if (type.kind === 'enum')
            return JSON.stringify([...new Set(type.values)].sort());
        const value = type.value;
        return value.kind === 'number' ? (value.text.includes('.') ? String(Number(value.text)) + ':Float' : String(BigInt(value.text)))
            : value.kind === 'literal' ? JSON.stringify(value.value) : 'void';
    }
}
exports.ContractScope = ContractScope;
function unwrapOptional(scope) {
    while (scope.type.kind === 'generic' && scope.type.name === 'Optional')
        scope = { ...scope, type: scope.type.args[0] };
    return scope;
}
function typeKind(scope) {
    const { type } = unwrapOptional(scope);
    if (type.kind === 'literal')
        return literalKind(type.value);
    if (type.kind === 'enum')
        return 'String';
    return type.name;
}
function literalKind(expression) {
    if (expression.kind === 'number')
        return expression.text.includes('.') ? 'Float' : 'Integer';
    if (expression.kind === 'void')
        return 'Void';
    if (expression.kind === 'literal')
        return expression.value === null ? 'null'
            : typeof expression.value === 'boolean' ? 'Boolean' : 'String';
    return 'Any';
}
exports.numericKinds = ['Integer', 'Float', 'Decimal'];
const stringKinds = ['String', 'UUID', 'DateTime'];
function validateContract(contract, scope, diagnostics) {
    const { root } = scope;
    const report = (range, message, code) => diagnostics.push({
        range, message, code, severity: node_1.DiagnosticSeverity.Error, source: 'GASD 1.2',
    });
    const match = scope.method(contract.name);
    if (!match) {
        report(contract.selectionRange, `Cannot resolve a unique interface method for '${contract.name}'.`, 'contract-signature');
    }
    else if (contract.output) {
        const { method, document } = match;
        const orderAndTypesMatch = contract.input.length === method.input.length && contract.input.every((input, index) => {
            const expected = method.input[index];
            const methodIndex = method.input.findIndex(parameter => parameter.name === input.name);
            return (methodIndex === -1 || methodIndex === index) &&
                scope.typeKey({ type: input.type, document: root }) === scope.typeKey({ type: expected.type, document });
        });
        if (!orderAndTypesMatch || scope.typeKey({ type: contract.output, document: root }) !== scope.typeKey({ type: method.output, document })) {
            report(contract.selectionRange, `INPUT parameter count, order, and types and the OUTPUT type must match the interface method '${match.method.name}'.`, 'contract-signature');
        }
    }
    const bindings = new Map(contract.input.map(input => [input.name, { type: input.type, document: root }]));
    for (const behavior of contract.behaviors) {
        for (const guard of behavior.when) {
            const operands = guard.op === 'IS' ? [guard.left] : [guard.left, guard.right];
            const declared = operands.map(operand => {
                if (operand.kind !== 'reference')
                    return undefined;
                const type = scope.reference(bindings, operand.path);
                if (!type)
                    report(guard.range, `WHEN value '${operand.path.join('.')}' must resolve to a declared input or input field.`, 'contract-guard');
                return type;
            });
            const kinds = operands.map((operand, index) => {
                const type = declared[index];
                if (type)
                    return typeKind(type);
                return operand.kind === 'reference' ? undefined : literalKind(operand);
            });
            const [left, right] = kinds;
            if (!left || !right || guard.op === 'IS')
                continue;
            if (guard.op !== '==' && guard.op !== '!=') {
                if (!kinds.every(kind => exports.numericKinds.includes(kind) || kind === 'Any')) {
                    report(guard.range, 'Ordering in WHEN requires numeric operands.', 'contract-guard');
                }
                continue;
            }
            if ([left, right].some(kind => kind === 'null' || kind === 'Any'))
                continue;
            const [leftType, rightType] = declared;
            const sameType = leftType && rightType && scope.typeKey(unwrapOptional(leftType)) === scope.typeKey(unwrapOptional(rightType));
            const primitive = ['String', 'Boolean', 'Void', 'UUID', 'DateTime', 'Bytes', ...exports.numericKinds];
            const compatibleNumber = (kind, literal) => (kind === 'Float' || kind === 'Decimal') && literal.kind === 'number';
            if (sameType || (left === right && primitive.includes(left)) ||
                compatibleNumber(left, operands[1]) || compatibleNumber(right, operands[0]) ||
                (stringKinds.includes(left) && stringKinds.includes(right) && operands.some(operand => operand.kind === 'literal')))
                continue;
            report(guard.range, `Cannot compare ${left} and ${right} for equality in WHEN.`, 'contract-guard');
        }
    }
}
function analyzeContracts(source, options = {}) {
    const root = (0, syntax_1.parseContractDocument)(source, options.uri ?? 'file:///document.gasd');
    const scope = new ContractScope(root, options.readImport);
    const diagnostics = [...root.diagnostics];
    const seen = new Set();
    for (const contract of root.contracts) {
        if (seen.has(contract.name))
            diagnostics.push({
                range: contract.selectionRange, message: `Duplicate contract for '${contract.name}'.`, code: 'contract-signature',
                severity: node_1.DiagnosticSeverity.Error, source: 'GASD 1.2',
            });
        seen.add(contract.name);
        validateContract(contract, scope, diagnostics);
    }
    diagnostics.sort((left, right) => left.range.start.line - right.range.start.line);
    return { contracts: root.contracts, diagnostics, scope };
}
function exportContractAst(source, mode, options = {}) {
    return mode === 'syntax' ? (0, syntax_1.parseContractDocument)(source, options.uri ?? 'file:///document.gasd').contracts
        : analyzeContracts(source, options).contracts;
}
//# sourceMappingURL=analysis.js.map