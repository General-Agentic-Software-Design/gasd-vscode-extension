"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFlowSignature = checkFlowSignature;
exports.parseContractDocument = parseContractDocument;
exports.isCaseClauseLine = isCaseClauseLine;
const node_crypto_1 = require("node:crypto");
const node_1 = require("vscode-languageserver/node");
const source_1 = require("../source");
const identifier = source_1.nameSegment;
const qualifiedName = `${identifier}(?:\\.${identifier})*`;
const namePattern = new RegExp(`^${qualifiedName}$`);
const comparisonPattern = /^(==|!=|>=|<=|>|<|IS)$/;
const tokensPattern = new RegExp(`"(?:[^"\\\\]|\\\\.)*"|${qualifiedName}|\\d+(?:\\.\\d+)?|==|!=|>=|<=|->|[+*/^<>()@,:-]`, 'gy');
class Tokens {
    index = 0;
    tokens = [];
    constructor(source) {
        const lexer = new RegExp(tokensPattern);
        while (lexer.lastIndex < source.length) {
            if (/\s/.test(source[lexer.lastIndex])) {
                lexer.lastIndex++;
                continue;
            }
            const match = lexer.exec(source);
            if (match === null)
                throw new Error('Unexpected character.');
            this.tokens.push(match[0]);
        }
    }
    peek() { return this.tokens[this.index] ?? ''; }
    take() { return this.tokens[this.index++] ?? ''; }
    accept(token) {
        if (this.peek() !== token)
            return false;
        this.index++;
        return true;
    }
    expect(token) {
        if (!this.accept(token))
            throw new Error(`Expected '${token}'.`);
    }
    done() {
        if (this.peek())
            throw new Error(`Unexpected '${this.peek()}'.`);
    }
    name() {
        const token = this.take();
        if (!namePattern.test(token))
            throw new Error('Expected an identifier.');
        return token;
    }
    parameterList(until) {
        const result = [];
        if (until && this.peek() === until)
            return result;
        do {
            const name = this.name();
            this.expect(':');
            result.push({ name, type: this.type() });
        } while (this.accept(','));
        return result;
    }
    type() {
        const token = this.peek();
        if (token.startsWith('"') || /^[-\d]/.test(token))
            return { kind: 'literal', value: this.operand(false) };
        const name = this.name();
        if (name === 'Enum' && this.accept('(')) {
            const values = [];
            do {
                values.push(this.peek().startsWith('"') ? (0, source_1.stringValue)(this.take()) : this.name());
            } while (this.accept(','));
            this.expect(')');
            return { kind: 'enum', values };
        }
        const arity = name === 'Map' ? 2 : ['List', 'Optional', 'Result'].includes(name) ? 1 : 0;
        if (!arity)
            return { kind: 'named', name };
        this.expect('<');
        const args = [this.type()];
        if (arity === 2) {
            this.expect(',');
            args.push(this.type());
        }
        this.expect('>');
        return { kind: 'generic', name, args };
    }
    predicate(guard) {
        const left = guard ? this.operand(false) : this.arithmetic();
        return this.comparison(left, guard);
    }
    comparison(left, guard) {
        const op = this.take();
        if (!comparisonPattern.test(op))
            throw new Error('Expected a comparison operator or IS.');
        if (op === 'IS')
            return { left, op, type: this.type() };
        return { left, op: op, right: guard ? this.operand(false) : this.arithmetic() };
    }
    arithmetic(minPriority = 1) {
        let left = this.operand(true);
        const priorities = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 };
        for (;;) {
            const op = this.peek();
            const priority = priorities[op] ?? 0;
            if (priority < minPriority)
                return left;
            this.take();
            const right = this.arithmetic(priority + (op === '^' ? 0 : 1));
            left = { kind: 'arithmetic', op, left, right };
        }
    }
    operand(formal) {
        const token = this.peek();
        if (token.startsWith('"'))
            return { kind: 'literal', value: (0, source_1.stringValue)(this.take()) };
        if (/^\d/.test(token) || token === '-') {
            const sign = this.accept('-') ? '-' : '';
            const number = this.take();
            if (!/^\d/.test(number))
                throw new Error('Expected a number.');
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
        if (name === 'void' && formal)
            return { kind: 'void' };
        if (formal && this.accept('(')) {
            const args = name === 'TRANSFORM' ? this.transformArguments() : this.callArguments();
            return { kind: 'call', source: this.tokens.slice(start, this.index).join(' '), args };
        }
        return { kind: 'reference', path: name.split('.') };
    }
    argument() {
        const left = this.arithmetic();
        return comparisonPattern.test(this.peek()) ? this.comparison(left, false) : left;
    }
    callArguments() {
        if (this.accept(')'))
            return [];
        const args = [this.argument()];
        while (this.accept(','))
            args.push(this.argument());
        this.expect(')');
        return args;
    }
    transformArguments() {
        const args = [this.argument()];
        this.expect(',');
        do {
            this.expect('@');
            this.name();
            if (this.accept('('))
                args.push(...this.callArguments());
            if (this.accept('AS'))
                this.name();
        } while (this.peek() === '@');
        this.expect(')');
        return args;
    }
}
function checkFlowSignature(source) {
    try {
        const tokens = new Tokens(source);
        tokens.expect('(');
        const parameters = tokens.parameterList(')');
        if (new Set(parameters.map(parameter => parameter.name)).size !== parameters.length) {
            return 'Parameter names must be unique.';
        }
        tokens.expect(')');
        if (tokens.accept('->'))
            tokens.type();
        while (tokens.accept('@')) {
            tokens.name();
            if (tokens.accept('('))
                tokens.callArguments();
            if (tokens.accept('AS'))
                tokens.name();
        }
        tokens.expect(':');
        tokens.done();
    }
    catch (error) {
        return error.message;
    }
}
function parseCase(line, report) {
    const match = new RegExp(`^CASE\\s+(${qualifiedName})\\s*:$`).exec(line.text);
    if (!match) {
        report(line, 'Expected CASE name: inside BEHAVIORS.');
        return undefined;
    }
    const result = { name: match[1], when: [], postconditions: [], range: line.range };
    const seen = new Set();
    let afterGuardSection = false;
    for (const clause of line.children) {
        const parts = /^(WHEN|POSTCONDITION|THROWS|AFTER)\s*:\s*(.*)$/.exec(clause.text);
        if (!parts || clause.indent !== line.children[0].indent || clause.children.length) {
            report(clause, 'Expected a single-line WHEN, POSTCONDITION, THROWS, or AFTER case clause.');
            continue;
        }
        const [, key, source] = parts;
        if (key === 'WHEN' && afterGuardSection)
            report(clause, 'WHEN guards must precede case outcome and timing clauses.');
        if (key !== 'WHEN')
            afterGuardSection = true;
        if ((key === 'THROWS' || key === 'AFTER') && seen.has(key)) {
            report(clause, `CASE may declare ${key} only once.`);
            continue;
        }
        seen.add(key);
        try {
            if (key === 'THROWS') {
                if (!namePattern.test(source))
                    throw new Error('Expected a qualified exception type.');
                result.throws = source;
            }
            else if (key === 'AFTER') {
                const duration = /^(\d+)\s*(ms|s|m)$/.exec(source);
                const retry = /^retry\s*\(\s*(\d+)\s*\)$/.exec(source);
                if (duration) {
                    const milliseconds = Number(duration[1]) * ({ ms: 1, s: 1000, m: 60000 }[duration[2]]);
                    if (!Number.isSafeInteger(milliseconds))
                        throw new Error('Duration is outside the supported millisecond range.');
                    result.after = { kind: 'duration', value: milliseconds };
                }
                else if (retry && Number.isSafeInteger(Number(retry[1]))) {
                    result.after = { kind: 'retry', value: Number(retry[1]) };
                }
                else
                    throw new Error('Expected a duration or retry(n) with a nonnegative integer.');
            }
            else if (key === 'POSTCONDITION' && /^"(?:[^"\\]|\\.)*"$/.test(source)) {
                result.postconditions.push({ kind: 'evidence', text: (0, source_1.stringValue)(source), source, range: clause.range });
            }
            else {
                const tokens = new Tokens(source);
                const predicate = { ...tokens.predicate(key === 'WHEN'), source, range: clause.range };
                tokens.done();
                if (key === 'WHEN')
                    result.when.push(predicate);
                else
                    result.postconditions.push(predicate);
            }
        }
        catch (error) {
            report(clause, `Invalid ${key}. ${error.message}`);
        }
    }
    if (!result.throws && !result.postconditions.length) {
        report(line, 'CASE must declare at least one POSTCONDITION or THROWS.', 'LINT-007');
    }
    return result;
}
function parseContract(line, name, report) {
    const input = [];
    const behaviors = [];
    const nameStart = line.range.start.character + line.text.indexOf(name, 'CONTRACT'.length);
    const range = node_1.Range.create(line.range.start, lastLine(line).range.end);
    const contract = { name, input, behaviors, range, hash: '',
        selectionRange: node_1.Range.create(line.range.start.line, nameStart, line.range.start.line, nameStart + name.length) };
    const order = ['INPUT', 'OUTPUT', 'BEHAVIORS', 'IDEMPOTENT', 'VERSION'];
    const seen = new Set();
    let lastIndex = -1;
    for (const clause of line.children) {
        const parts = /^(INPUT|OUTPUT|BEHAVIORS|IDEMPOTENT|VERSION)\s*:\s*(.*)$/.exec(clause.text);
        if (!parts || clause.indent !== line.children[0].indent) {
            report(clause, 'Unexpected CONTRACT clause.');
            continue;
        }
        const [, key, source] = parts;
        const index = order.indexOf(key);
        if (seen.has(key)) {
            report(clause, `Duplicate ${key} clause.`);
            continue;
        }
        seen.add(key);
        if (index < lastIndex)
            report(clause, `${key} is out of order in the CONTRACT.`);
        lastIndex = Math.max(lastIndex, index);
        try {
            if (key === 'BEHAVIORS') {
                if (source)
                    throw new Error('Expected an indented block of CASE declarations.');
                const names = new Set();
                for (const child of clause.children) {
                    if (child.indent !== clause.children[0].indent) {
                        report(child, 'CASE declarations must have the same indentation.');
                        continue;
                    }
                    const entry = parseCase(child, report);
                    if (!entry)
                        continue;
                    if (names.has(entry.name))
                        report(child, `Duplicate CASE name '${entry.name}'.`);
                    names.add(entry.name);
                    behaviors.push(entry);
                }
                continue;
            }
            if (clause.children.length)
                throw new Error('Expected a single-line clause.');
            const tokens = new Tokens(source);
            if (key === 'INPUT') {
                const parameters = tokens.parameterList();
                if (new Set(parameters.map(parameter => parameter.name)).size !== parameters.length) {
                    report(clause, 'Duplicate parameter name in INPUT.');
                }
                input.push(...parameters);
            }
            else if (key === 'OUTPUT')
                contract.output = tokens.type();
            else if (key === 'IDEMPOTENT') {
                const value = tokens.take();
                if (value !== 'true' && value !== 'false')
                    throw new Error('Expected true or false.');
                contract.idempotent = value === 'true';
            }
            else {
                const version = tokens.take();
                if (!version.startsWith('"'))
                    throw new Error('Expected a quoted version.');
                contract.version = (0, source_1.stringValue)(version);
            }
            tokens.done();
        }
        catch (error) {
            report(clause, `Invalid ${key}. ${error.message}`);
        }
    }
    if (!seen.has('OUTPUT'))
        report(line, 'CONTRACT must declare an OUTPUT type.');
    if (!behaviors.length)
        report(line, 'CONTRACT must declare BEHAVIORS with at least one CASE.', 'LINT-007');
    contract.hash = (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(contract, (key, value) => ['range', 'selectionRange', 'hash'].includes(key) ? undefined : value)).digest('hex');
    return contract;
}
function lastLine(line) {
    while (line.children.length)
        line = line.children[line.children.length - 1];
    return line;
}
function parseContractDocument(source, uri, declarationsOnly = false) {
    const roots = (0, source_1.lineTree)(source);
    const is12 = roots.some(line => /^VERSION\s+1\.2(?:\.\d+)?$/.test(line.text));
    const document = { uri, is12, imports: [], methods: [], types: new Map(), contracts: [], diagnostics: [] };
    const report = (line, message, code = 'contract-syntax') => document.diagnostics.push({
        range: line.range, severity: node_1.DiagnosticSeverity.Error, source: 'GASD 1.2', message, code,
    });
    for (const line of roots) {
        const imported = (0, source_1.parseSourceImport)(line.text);
        if (imported) {
            document.imports.push(imported);
            continue;
        }
        const declaration = new RegExp(`^(TYPE|COMPONENT|CONTRACT)\\s+(${qualifiedName})(?=\\s|:|$)`).exec(line.text);
        if (!declaration)
            continue;
        const [, kind, name] = declaration;
        if (kind === 'CONTRACT' && !declarationsOnly && is12) {
            if (!new RegExp(`^CONTRACT\\s+${qualifiedName}\\s*:$`).test(line.text))
                report(line, 'Expected CONTRACT qualified.name:.');
            else
                document.contracts.push(parseContract(line, name, report));
        }
        else if (kind === 'TYPE') {
            const fields = new Map();
            for (const field of line.children) {
                const match = new RegExp(`^(${qualifiedName})\\s*:\\s*(.+)$`).exec(field.text);
                if (!match)
                    continue;
                try {
                    fields.set(match[1], new Tokens(match[2]).type());
                }
                catch { /* Malformed declarations cannot provide a typed field. */ }
            }
            document.types.set(name, fields);
        }
        else if (kind === 'COMPONENT') {
            const block = line.children.find(child => /^INTERFACE\s*:$/.test(child.text));
            for (const method of block?.children ?? []) {
                if (method.indent !== block.children[0].indent)
                    continue;
                try {
                    const tokens = new Tokens(method.text);
                    const methodName = tokens.name();
                    tokens.expect('(');
                    const input = tokens.parameterList(')');
                    tokens.expect(')');
                    tokens.expect('->');
                    const output = tokens.type();
                    if (tokens.peek() !== '@')
                        tokens.done();
                    document.methods.push({ component: name, name: methodName, input, output });
                }
                catch { /* Malformed declarations cannot provide an interface signature. */ }
            }
        }
    }
    return document;
}
function isCaseClauseLine(source, target) {
    const lines = (0, source_1.uncomment)(source).split(/\r?\n/);
    if (!lines.some(line => /^VERSION\s+1\.2(?:\.\d+)?\s*$/.test(line)))
        return false;
    const clauses = [/^CASE\s+[^:]+:\s*$/, /^BEHAVIORS\s*:\s*$/, /^CONTRACT\s+[^:]+:\s*$/];
    const indent = lines[target].search(/\S/);
    let level = indent === -1 ? lines[target].length : indent;
    for (let i = target - 1; i >= 0; i--) {
        const start = lines[i].search(/\S/);
        if (start < 0 || start >= level)
            continue;
        if (!clauses.shift()?.test(lines[i].trim()))
            return false;
        if (!clauses.length)
            return true;
        level = start;
    }
    return false;
}
//# sourceMappingURL=syntax.js.map