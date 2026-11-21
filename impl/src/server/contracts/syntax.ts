import { createHash } from 'node:crypto';
import { Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';

const identifier = '[A-Za-z_#][A-Za-z0-9_-]*';
const qualifiedName = `${identifier}(?:\\.${identifier})*`;
const namePattern = new RegExp(`^${qualifiedName}$`);

export type TypeExpression =
    | { kind: 'named'; name: string }
    | { kind: 'generic'; name: string; args: TypeExpression[] }
    | { kind: 'enum'; values: string[] }
    | { kind: 'literal'; value: Literal };

export type Literal =
    | { kind: 'number'; text: string }
    | { kind: 'literal'; value: string | boolean | null }
    | { kind: 'void' };

export type Expression = Literal
    | { kind: 'reference'; path: string[] }
    | { kind: 'arithmetic'; op: string; left: Expression; right: Expression }
    | { kind: 'call'; source: string; args: (Expression | PredicateExpression)[] }
    | { kind: 'group'; expression: Expression | PredicateExpression };

export type PredicateExpression =
    | { left: Expression; op: 'IS'; type: TypeExpression }
    | { left: Expression; op: '==' | '!=' | '>' | '<' | '>=' | '<='; right: Expression };

export type Predicate = PredicateExpression & { source: string; range: Range };
export type Postcondition = Predicate | { kind: 'evidence'; text: string; source: string; range: Range };
export type Timing = { kind: 'duration' | 'retry'; value: number };
export interface Parameter { name: string; type: TypeExpression }
export interface Method { component: string; name: string; input: Parameter[]; output: TypeExpression }
export interface ContractCase {
    name: string;
    when: Predicate[];
    postconditions: Postcondition[];
    throws?: string;
    after?: Timing;
    range: Range;
}
export interface Contract {
    name: string;
    input: Parameter[];
    output?: TypeExpression;
    behaviors: ContractCase[];
    idempotent?: boolean;
    version?: string;
    hash: string;
    range: Range;
    selectionRange: Range;
}
interface Line { text: string; indent: number; range: Range; children: Line[] }
export interface ContractDocument {
    uri: string;
    is12: boolean;
    imports: { path: string; alias?: string }[];
    methods: Method[];
    types: Map<string, Map<string, TypeExpression>>;
    contracts: Contract[];
    diagnostics: Diagnostic[];
}

const comparisonPattern = /^(==|!=|>=|<=|>|<|IS)$/;
const tokensPattern = new RegExp(`"(?:[^"\\\\]|\\\\.)*"|${qualifiedName}|\\d+(?:\\.\\d+)?|==|!=|>=|<=|->|[+*/^<>()@,:-]`, 'gy');

function stringValue(token: string): string {
    try { return JSON.parse(token) as string; }
    catch { return token.slice(1, -1).replace(/\\(["\\])/g, '$1'); }
}

class Tokens {
    private index = 0;
    private readonly tokens: string[] = [];

    constructor(source: string) {
        const lexer = new RegExp(tokensPattern);
        while (lexer.lastIndex < source.length) {
            if (/\s/.test(source[lexer.lastIndex])) { lexer.lastIndex++; continue; }
            const match = lexer.exec(source);
            if (match === null) throw new Error('Unexpected character.');
            this.tokens.push(match[0]);
        }
    }

    peek(): string { return this.tokens[this.index] ?? ''; }
    take(): string { return this.tokens[this.index++] ?? ''; }
    accept(token: string): boolean {
        if (this.peek() !== token) return false;
        this.index++;
        return true;
    }
    expect(token: string): void {
        if (!this.accept(token)) throw new Error(`Expected '${token}'.`);
    }
    done(): void {
        if (this.peek()) throw new Error(`Unexpected '${this.peek()}'.`);
    }
    name(): string {
        const token = this.take();
        if (!namePattern.test(token)) throw new Error('Expected an identifier.');
        return token;
    }
    parameterList(until?: string): Parameter[] {
        const result: Parameter[] = [];
        if (until && this.peek() === until) return result;
        do {
            const name = this.name();
            this.expect(':');
            result.push({ name, type: this.type() });
        } while (this.accept(','));
        return result;
    }
    type(): TypeExpression {
        const token = this.peek();
        if (token.startsWith('"') || /^[-\d]/.test(token)) return { kind: 'literal', value: this.operand(false) as Literal };
        const name = this.name();
        if (name === 'Enum' && this.accept('(')) {
            const values: string[] = [];
            do { values.push(this.peek().startsWith('"') ? stringValue(this.take()) : this.name()); }
            while (this.accept(','));
            this.expect(')');
            return { kind: 'enum', values };
        }
        const arity = name === 'Map' ? 2 : ['List', 'Optional', 'Result'].includes(name) ? 1 : 0;
        if (!arity) return { kind: 'named', name };
        this.expect('<');
        const args = [this.type()];
        if (arity === 2) { this.expect(','); args.push(this.type()); }
        this.expect('>');
        return { kind: 'generic', name, args };
    }
    predicate(guard: boolean): PredicateExpression {
        const left = guard ? this.operand(false) : this.arithmetic();
        return this.comparison(left, guard);
    }
    private comparison(left: Expression, guard: boolean): PredicateExpression {
        const op = this.take();
        if (!comparisonPattern.test(op)) throw new Error('Expected a comparison operator or IS.');
        if (op === 'IS') return { left, op, type: this.type() };
        return { left, op: op as '==' | '!=' | '>' | '<' | '>=' | '<=', right: guard ? this.operand(false) : this.arithmetic() };
    }
    private arithmetic(minPriority = 1): Expression {
        let left = this.operand(true);
        const priorities: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
        for (;;) {
            const op = this.peek();
            const priority = priorities[op] ?? 0;
            if (priority < minPriority) return left;
            this.take();
            const right = this.arithmetic(priority + (op === '^' ? 0 : 1));
            left = { kind: 'arithmetic', op, left, right };
        }
    }
    private operand(formal: boolean): Expression {
        const token = this.peek();
        if (token.startsWith('"')) return { kind: 'literal', value: stringValue(this.take()) };
        if (/^\d/.test(token) || token === '-') {
            const sign = this.accept('-') ? '-' : '';
            const number = this.take();
            if (!/^\d/.test(number)) throw new Error('Expected a number.');
            return { kind: 'number', text: sign + number };
        }
        if (formal && this.accept('(')) {
            const left = this.arithmetic();
            const expression = comparisonPattern.test(this.peek()) ? this.comparison(left, false) : left;
            this.expect(')');
            return { kind: 'group', expression };
        }
        const start = this.index;
        const name = this.name();
        if (name === 'null' || name === 'true' || name === 'false') {
            return { kind: 'literal', value: name === 'null' ? null : name === 'true' };
        }
        if (name === 'void' && formal) return { kind: 'void' };
        if (formal && this.accept('(')) {
            const args = name === 'TRANSFORM' ? this.transformArguments() : this.callArguments();
            return { kind: 'call', source: this.tokens.slice(start, this.index).join(' '), args };
        }
        return { kind: 'reference', path: name.split('.') };
    }
    private argument(): Expression | PredicateExpression {
        const left = this.arithmetic();
        return comparisonPattern.test(this.peek()) ? this.comparison(left, false) : left;
    }
    private callArguments(): (Expression | PredicateExpression)[] {
        if (this.accept(')')) return [];
        const args = [this.argument()];
        while (this.accept(',')) args.push(this.argument());
        this.expect(')');
        return args;
    }
    private transformArguments(): (Expression | PredicateExpression)[] {
        const args = [this.argument()];
        this.expect(',');
        do {
            this.expect('@');
            this.name();
            if (this.accept('(')) args.push(...this.callArguments());
            if (this.accept('AS')) this.name();
        } while (this.peek() === '@');
        this.expect(')');
        return args;
    }
}

function uncomment(source: string): string {
    // Preserve offsets while removing comments, leaving quoted comment markers intact.
    return source.replace(/"(?:[^"\\\r\n]|\\.)*"|\/\*[\s\S]*?(?:\*\/|$)|\/\/[^\r\n]*/g,
        part => part.startsWith('"') ? part : part.replace(/[^\r\n]/g, ' '));
}

function lineTree(source: string): Line[] {
    const roots: Line[] = [];
    const stack: Line[] = [];
    uncomment(source).split(/\r?\n/).forEach((raw, index) => {
        const text = raw.trim();
        if (text === '') return;
        const start = raw.search(/\S/);
        const indent = raw.slice(0, start).replace(/\t/g, '    ').length;
        const line = { text, indent, range: Range.create(index, start, index, raw.trimEnd().length), children: [] };
        while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
        const parent = stack[stack.length - 1];
        (parent ? parent.children : roots).push(line);
        stack.push(line);
    });
    return roots;
}

function parseCase(line: Line, report: Report): ContractCase | undefined {
    const match = new RegExp(`^CASE\\s+(${qualifiedName})\\s*:$`).exec(line.text);
    if (!match) { report(line, 'Expected CASE name: inside BEHAVIORS.'); return undefined; }
    const result: ContractCase = { name: match[1], when: [], postconditions: [], range: line.range };
    const seen = new Set<string>();
    let afterGuardSection = false;
    for (const clause of line.children) {
        const parts = /^(WHEN|POSTCONDITION|THROWS|AFTER)\s*:\s*(.*)$/.exec(clause.text);
        if (!parts || clause.indent !== line.children[0].indent || clause.children.length) {
            report(clause, 'Expected a single-line WHEN, POSTCONDITION, THROWS, or AFTER case clause.');
            continue;
        }
        const [, key, source] = parts;
        if (key === 'WHEN' && afterGuardSection) report(clause, 'WHEN guards must precede case outcome and timing clauses.');
        if (key !== 'WHEN') afterGuardSection = true;
        if ((key === 'THROWS' || key === 'AFTER') && seen.has(key)) {
            report(clause, `CASE may declare ${key} only once.`);
            continue;
        }
        seen.add(key);
        try {
            if (key === 'THROWS') {
                if (!namePattern.test(source)) throw new Error('Expected a qualified exception type.');
                result.throws = source;
            } else if (key === 'AFTER') {
                const duration = /^(\d+)\s*(ms|s|m)$/.exec(source);
                const retry = /^retry\s*\(\s*(\d+)\s*\)$/.exec(source);
                if (duration) {
                    const milliseconds = Number(duration[1]) * ({ ms: 1, s: 1000, m: 60000 }[duration[2]]!);
                    if (!Number.isSafeInteger(milliseconds)) throw new Error('Duration is outside the supported millisecond range.');
                    result.after = { kind: 'duration', value: milliseconds };
                } else if (retry && Number.isSafeInteger(Number(retry[1]))) {
                    result.after = { kind: 'retry', value: Number(retry[1]) };
                } else throw new Error('Expected a duration or retry(n) with a nonnegative integer.');
            } else if (key === 'POSTCONDITION' && /^"(?:[^"\\]|\\.)*"$/.test(source)) {
                result.postconditions.push({ kind: 'evidence', text: stringValue(source), source, range: clause.range });
            } else {
                const tokens = new Tokens(source);
                const predicate = { ...tokens.predicate(key === 'WHEN'), source, range: clause.range };
                tokens.done();
                if (key === 'WHEN') result.when.push(predicate);
                else result.postconditions.push(predicate);
            }
        } catch (error) { report(clause, `Invalid ${key}. ${(error as Error).message}`); }
    }
    if (!result.throws && !result.postconditions.length) {
        report(line, 'CASE must declare at least one POSTCONDITION or THROWS.', 'LINT-007');
    }
    return result;
}

type Report = (line: Line, message: string, code?: string) => void;

function parseContract(line: Line, name: string, report: Report): Contract {
    const input: Parameter[] = [];
    const behaviors: ContractCase[] = [];
    const nameStart = line.range.start.character + line.text.indexOf(name, 'CONTRACT'.length);
    const range = Range.create(line.range.start, lastLine(line).range.end);
    const contract: Contract = { name, input, behaviors, range, hash: '',
        selectionRange: Range.create(line.range.start.line, nameStart, line.range.start.line, nameStart + name.length) };
    const order = ['INPUT', 'OUTPUT', 'BEHAVIORS', 'IDEMPOTENT', 'VERSION'];
    const seen = new Set<string>();
    let lastIndex = -1;
    for (const clause of line.children) {
        const parts = /^(INPUT|OUTPUT|BEHAVIORS|IDEMPOTENT|VERSION)\s*:\s*(.*)$/.exec(clause.text);
        if (!parts || clause.indent !== line.children[0].indent) { report(clause, 'Unexpected CONTRACT clause.'); continue; }
        const [, key, source] = parts;
        const index = order.indexOf(key);
        if (seen.has(key)) { report(clause, `Duplicate ${key} clause.`); continue; }
        seen.add(key);
        if (index < lastIndex) report(clause, `${key} is out of order in the CONTRACT.`);
        lastIndex = Math.max(lastIndex, index);
        try {
            if (key === 'BEHAVIORS') {
                if (source) throw new Error('Expected an indented block of CASE declarations.');
                const names = new Set<string>();
                for (const child of clause.children) {
                    if (child.indent !== clause.children[0].indent) { report(child, 'CASE declarations must have the same indentation.'); continue; }
                    const entry = parseCase(child, report);
                    if (!entry) continue;
                    if (names.has(entry.name)) report(child, `Duplicate CASE name '${entry.name}'.`);
                    names.add(entry.name);
                    behaviors.push(entry);
                }
                continue;
            }
            if (clause.children.length) throw new Error('Expected a single-line clause.');
            const tokens = new Tokens(source);
            if (key === 'INPUT') {
                const parameters = tokens.parameterList();
                if (new Set(parameters.map(parameter => parameter.name)).size !== parameters.length) {
                    report(clause, 'Duplicate parameter name in INPUT.');
                }
                input.push(...parameters);
            } else if (key === 'OUTPUT') contract.output = tokens.type();
            else if (key === 'IDEMPOTENT') {
                const value = tokens.take();
                if (value !== 'true' && value !== 'false') throw new Error('Expected true or false.');
                contract.idempotent = value === 'true';
            } else {
                const version = tokens.take();
                if (!version.startsWith('"')) throw new Error('Expected a quoted version.');
                contract.version = stringValue(version);
            }
            tokens.done();
        } catch (error) { report(clause, `Invalid ${key}. ${(error as Error).message}`); }
    }
    if (!seen.has('OUTPUT')) report(line, 'CONTRACT must declare an OUTPUT type.');
    if (!behaviors.length) report(line, 'CONTRACT must declare BEHAVIORS with at least one CASE.', 'LINT-007');
    contract.hash = createHash('sha256').update(JSON.stringify(contract, (key, value) =>
        ['range', 'selectionRange', 'hash'].includes(key) ? undefined : value)).digest('hex');
    return contract;
}

function lastLine(line: Line): Line {
    while (line.children.length) line = line.children[line.children.length - 1];
    return line;
}

export function parseContractDocument(source: string, uri: string, declarationsOnly = false): ContractDocument {
    const roots = lineTree(source);
    const is12 = roots.some(line => /^VERSION\s+1\.2(?:\.\d+)?$/.test(line.text));
    const document: ContractDocument = { uri, is12, imports: [], methods: [], types: new Map(), contracts: [], diagnostics: [] };
    const report: Report = (line, message, code = 'contract-syntax') => document.diagnostics.push({
        range: line.range, severity: DiagnosticSeverity.Error, source: 'GASD 1.2', message, code,
    });
    for (const line of roots) {
        const importMatch = new RegExp(`^IMPORT\\s+("(?:[^"\\\\]|\\\\.)*")(?:\\s+AS\\s+(${identifier}))?$`).exec(line.text);
        if (importMatch) {
            document.imports.push({ path: stringValue(importMatch[1]), alias: importMatch[2] });
            continue;
        }
        const declaration = new RegExp(`^(TYPE|COMPONENT|CONTRACT)\\s+(${qualifiedName})(?=\\s|:|$)`).exec(line.text);
        if (!declaration) continue;
        const [, kind, name] = declaration;
        if (kind === 'CONTRACT' && !declarationsOnly && is12) {
            if (!new RegExp(`^CONTRACT\\s+${qualifiedName}\\s*:$`).test(line.text)) report(line, 'Expected CONTRACT qualified.name:.');
            else document.contracts.push(parseContract(line, name, report));
        } else if (kind === 'TYPE') {
            const fields = new Map<string, TypeExpression>();
            for (const field of line.children) {
                const match = new RegExp(`^(${qualifiedName})\\s*:\\s*(.+)$`).exec(field.text);
                if (!match) continue;
                try { fields.set(match[1], new Tokens(match[2]).type()); }
                catch { /* Malformed declarations cannot provide a typed field. */ }
            }
            document.types.set(name, fields);
        } else if (kind === 'COMPONENT') {
            const block = line.children.find(child => /^INTERFACE\s*:$/.test(child.text));
            for (const method of block?.children ?? []) {
                if (method.indent !== block!.children[0].indent) continue;
                try {
                    const tokens = new Tokens(method.text);
                    const methodName = tokens.name();
                    tokens.expect('(');
                    const input = tokens.parameterList(')');
                    tokens.expect(')');
                    tokens.expect('->');
                    const output = tokens.type();
                    if (tokens.peek() !== '@') tokens.done();
                    document.methods.push({ component: name, name: methodName, input, output });
                } catch { /* Malformed declarations cannot provide an interface signature. */ }
            }
        }
    }
    return document;
}

export function isCaseClauseLine(source: string, target: number): boolean {
    const lines = uncomment(source).split(/\r?\n/);
    if (!lines.some(line => /^VERSION\s+1\.2(?:\.\d+)?\s*$/.test(line))) return false;
    const clauses = [/^CASE\s+[^:]+:\s*$/, /^BEHAVIORS\s*:\s*$/, /^CONTRACT\s+[^:]+:\s*$/];
    const indent = lines[target].search(/\S/);
    let level = indent === -1 ? lines[target].length : indent;
    for (let i = target - 1; i >= 0; i--) {
        const start = lines[i].search(/\S/);
        if (start < 0 || start >= level) continue;
        if (!clauses.shift()?.test(lines[i].trim())) return false;
        if (!clauses.length) return true;
        level = start;
    }
    return false;
}
