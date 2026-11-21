import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import { Contract, ContractDocument, Expression, Method, TypeExpression, parseContractDocument } from './syntax';

export interface AnalysisOptions {
    uri?: string;
    readImport?: (absoluteUri: string) => string | undefined;
}
export interface ScopedType { type: TypeExpression; document: ContractDocument }
interface ScopedMethod { method: Method; document: ContractDocument }

export class ContractScope {
    private readonly documents = new Map<string, ContractDocument | undefined>();

    constructor(readonly root: ContractDocument, private readonly readImport?: AnalysisOptions['readImport']) {
        this.documents.set(root.uri, root);
    }

    private imported(document: ContractDocument, path: string): ContractDocument | undefined {
        let uri: string;
        try { uri = new URL(path, document.uri).href; }
        catch { return undefined; }
        if (!this.documents.has(uri)) {
            const text = this.readImport?.(uri);
            this.documents.set(uri, text === undefined ? undefined : parseContractDocument(text, uri, true));
        }
        return this.documents.get(uri);
    }

    method(name: string): ScopedMethod | undefined {
        const path = name.split('.');
        if (path.length < 2) return undefined;
        const methodName = path.pop();
        const entry = this.root.imports.find(candidate => candidate.alias === path[0]);
        if (entry) {
            const document = this.imported(this.root, entry.path);
            if (!document) return undefined;
            const component = path.slice(1).join('.');
            const matches = document.methods.filter(method => method.name === methodName && (!component || method.component === component));
            return matches.length === 1 ? { method: matches[0], document } : undefined;
        }
        const component = path.join('.');
        const method = (document: ContractDocument) => document.methods
            .filter(candidate => candidate.component === component && candidate.name === methodName)
            .map(candidate => ({ method: candidate, document }));
        const local = method(this.root);
        if (local.length) return local.length === 1 ? local[0] : undefined;
        const imports = this.root.imports.flatMap(candidate => {
            const document = this.imported(this.root, candidate.path);
            return document ? method(document) : [];
        });
        return imports.length === 1 ? imports[0] : undefined;
    }

    record(document: ContractDocument, name: string): { document: ContractDocument; name: string; fields: Map<string, TypeExpression> } | undefined {
        const local = document.types.get(name);
        if (local) return { document, name, fields: local };
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

    field(scope: ScopedType, field: string): ScopedType | undefined {
        const base = unwrapOptional(scope);
        if (base.type.kind !== 'named') return undefined;
        const record = this.record(base.document, base.type.name);
        const type = record?.fields.get(field);
        return type && record ? { type, document: record.document } : undefined;
    }

    reference(bindings: ReadonlyMap<string, ScopedType>, path: string[]): ScopedType | undefined {
        let result = bindings.get(path[0]);
        for (const field of path.slice(1)) {
            if (!result) return undefined;
            result = this.field(result, field);
        }
        return result;
    }

    typeKey({ type, document }: ScopedType): string {
        if (type.kind === 'named') {
            const record = this.record(document, type.name);
            return record ? `${record.document.uri}#${record.name}` : type.name;
        }
        if (type.kind === 'generic') {
            return `${type.name}<${type.args.map(arg => this.typeKey({ type: arg, document })).join(',')}>`;
        }
        if (type.kind === 'enum') return JSON.stringify([...new Set(type.values)].sort());
        const value = type.value;
        return value.kind === 'number' ? (value.text.includes('.') ? String(Number(value.text)) + ':Float' : String(BigInt(value.text)))
            : value.kind === 'literal' ? JSON.stringify(value.value) : 'void';
    }
}

export function unwrapOptional(scope: ScopedType): ScopedType {
    while (scope.type.kind === 'generic' && scope.type.name === 'Optional') scope = { ...scope, type: scope.type.args[0] };
    return scope;
}

export function typeKind(scope: ScopedType): string {
    const { type } = unwrapOptional(scope);
    if (type.kind === 'literal') return literalKind(type.value);
    if (type.kind === 'enum') return 'String';
    return type.name;
}

function literalKind(expression: Expression): string {
    if (expression.kind === 'number') return expression.text.includes('.') ? 'Float' : 'Integer';
    if (expression.kind === 'void') return 'Void';
    if (expression.kind === 'literal') return expression.value === null ? 'null'
        : typeof expression.value === 'boolean' ? 'Boolean' : 'String';
    return 'Any';
}

export const numericKinds = ['Integer', 'Float', 'Decimal'];
const stringKinds = ['String', 'UUID', 'DateTime'];

function validateContract(contract: Contract, scope: ContractScope, diagnostics: Diagnostic[]): void {
    const { root } = scope;
    const report = (range: Range, message: string, code: string) => diagnostics.push({
        range, message, code, severity: DiagnosticSeverity.Error, source: 'GASD 1.2',
    });
    const match = scope.method(contract.name);
    if (!match) {
        report(contract.selectionRange, `Cannot resolve a unique interface method for '${contract.name}'.`, 'contract-signature');
    } else if (contract.output) {
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
                if (operand.kind !== 'reference') return undefined;
                const type = scope.reference(bindings, operand.path);
                if (!type) report(guard.range, `WHEN value '${operand.path.join('.')}' must resolve to a declared input or input field.`, 'contract-guard');
                return type;
            });
            const kinds = operands.map((operand, index) => {
                const type = declared[index];
                if (type) return typeKind(type);
                return operand.kind === 'reference' ? undefined : literalKind(operand);
            });
            const [left, right] = kinds;
            if (!left || !right || guard.op === 'IS') continue;
            if (guard.op !== '==' && guard.op !== '!=') {
                if (!kinds.every(kind => numericKinds.includes(kind!) || kind === 'Any')) {
                    report(guard.range, 'Ordering in WHEN requires numeric operands.', 'contract-guard');
                }
                continue;
            }
            if ([left, right].some(kind => kind === 'null' || kind === 'Any')) continue;
            const [leftType, rightType] = declared;
            const sameType = leftType && rightType && scope.typeKey(unwrapOptional(leftType)) === scope.typeKey(unwrapOptional(rightType));
            const primitive = ['String', 'Boolean', 'Void', 'UUID', 'DateTime', 'Bytes', ...numericKinds];
            const compatibleNumber = (kind: string, literal: Expression) => (kind === 'Float' || kind === 'Decimal') && literal.kind === 'number';
            if (sameType || (left === right && primitive.includes(left)) ||
                compatibleNumber(left, operands[1]) || compatibleNumber(right, operands[0]) ||
                (stringKinds.includes(left) && stringKinds.includes(right) && operands.some(operand => operand.kind === 'literal'))) continue;
            report(guard.range, `Cannot compare ${left} and ${right} for equality in WHEN.`, 'contract-guard');
        }
    }
}

export function analyzeContracts(source: string, options: AnalysisOptions = {}) {
    const root = parseContractDocument(source, options.uri ?? 'file:///document.gasd');
    const scope = new ContractScope(root, options.readImport);
    const diagnostics = [...root.diagnostics];
    const seen = new Set<string>();
    for (const contract of root.contracts) {
        if (seen.has(contract.name)) diagnostics.push({
            range: contract.selectionRange, message: `Duplicate contract for '${contract.name}'.`, code: 'contract-signature',
            severity: DiagnosticSeverity.Error, source: 'GASD 1.2',
        });
        seen.add(contract.name);
        validateContract(contract, scope, diagnostics);
    }
    diagnostics.sort((left, right) => left.range.start.line - right.range.start.line);
    return { contracts: root.contracts, diagnostics, scope };
}

export type ContractAnalysis = ReturnType<typeof analyzeContracts>;

export function exportContractAst(source: string, mode: 'syntax' | 'semantic', options: AnalysisOptions = {}): Contract[] {
    return mode === 'syntax' ? parseContractDocument(source, options.uri ?? 'file:///document.gasd').contracts
        : analyzeContracts(source, options).contracts;
}
