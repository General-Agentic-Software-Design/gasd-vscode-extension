"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareContractCall = prepareContractCall;
exports.verifyPreparedCall = verifyPreparedCall;
exports.verifyContractCall = verifyContractCall;
const node_util_1 = require("node:util");
const contractProtocol_1 = require("../../shared/contractProtocol");
const analysis_1 = require("./analysis");
const numeric_1 = require("./numeric");
const unit = Symbol('GASD void');
const unavailable = Symbol('Unavailable binding');
const missingEvidence = Symbol('Missing evidence');
function ownValue(object, key) {
    if (typeof object !== 'object' || object === null || !Object.hasOwn(object, key))
        return unavailable;
    const descriptor = Object.getOwnPropertyDescriptor(object, key);
    return descriptor && 'value' in descriptor && descriptor.value !== undefined ? descriptor.value : unavailable;
}
function matchesType(value, scoped, scope) {
    const { type, document } = scoped;
    const raw = value.value;
    if (type.kind === 'literal') {
        if (type.value.kind === 'number') {
            const expected = (0, numeric_1.numericLiteral)(type.value.text);
            return !!value.number && !!expected && value.number.kind === expected.kind && (0, numeric_1.compareNumbers)(value.number, expected) === 0;
        }
        return type.value.kind === 'void' ? raw === unit : raw === type.value.value;
    }
    if (type.kind === 'enum')
        return typeof raw === 'string' && type.values.includes(raw);
    if (type.kind === 'generic') {
        const arg = (n) => ({ type: type.args[n], document });
        const matches = (entry, index = 0) => matchesType({ value: entry, number: (0, numeric_1.numeric)(entry) }, arg(index), scope);
        switch (type.name) {
            case 'Optional': return raw === null || raw === undefined || matches(raw);
            case 'List': return Array.isArray(raw) && all(raw.map(entry => matches(entry)));
            case 'Map': {
                if (raw instanceof Map)
                    return all([...raw].flatMap(([key, value]) => [matches(key), matches(value, 1)]));
                if (!(0, contractProtocol_1.isRecord)(raw))
                    return false;
                return all(Object.entries(raw).flatMap(([key, value]) => [matches(key), matches(value, 1)]));
            }
            case 'Result': {
                if (!(0, contractProtocol_1.isRecord)(raw))
                    return false;
                if (raw.kind === 'failure')
                    return Object.hasOwn(raw, 'error');
                return raw.kind === 'success' && matches(raw.value);
            }
            default: return unavailable;
        }
    }
    switch (type.name) {
        case 'Any': return true;
        case 'Void': return raw === unit || raw === undefined;
        case 'Integer': return value.number?.kind === 'Integer';
        case 'Float': return value.number?.kind === 'Float';
        case 'Decimal': return value.number?.kind === 'Decimal';
        case 'String': return typeof raw === 'string';
        case 'Boolean': return typeof raw === 'boolean';
        case 'Bytes': return raw instanceof Uint8Array;
        case 'UUID': return typeof raw === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(raw);
        case 'DateTime': return typeof raw === 'string' && /^\d{4}-\d\d-\d\dT.+Z$/.test(raw) && Number.isFinite(Date.parse(raw));
    }
    const record = scope.record(document, type.name);
    if (!record)
        return unavailable;
    if (!(0, contractProtocol_1.isRecord)(raw))
        return false;
    return all([...record.fields].map(([name, field]) => {
        const entry = ownValue(raw, name);
        if (entry === unavailable)
            return field.kind === 'generic' && field.name === 'Optional';
        const fieldType = { type: field, document: record.document };
        return matchesType({ value: entry, number: (0, numeric_1.numeric)(entry, (0, analysis_1.typeKind)(fieldType)) }, fieldType, scope);
    }));
}
function all(values) {
    if (values.includes(false))
        return false;
    if (values.includes(unavailable))
        return unavailable;
    return values.includes(missingEvidence) ? missingEvidence : true;
}
function declaredKind(expression, env) {
    if (expression.kind !== 'reference')
        return undefined;
    const scoped = env.scope.reference(env.types, expression.path);
    return scoped && (0, analysis_1.typeKind)(scoped);
}
function read(expression, env, preferredNumericKind) {
    switch (expression.kind) {
        case 'literal': return { value: expression.value };
        case 'void': return { value: unit };
        case 'number': {
            const number = (0, numeric_1.numericLiteral)(expression.text, preferredNumericKind);
            return number ? { value: number, number } : unavailable;
        }
        case 'reference': {
            const value = expression.path.reduce(ownValue, env.bindings);
            if (value === unavailable)
                return unavailable;
            const kind = declaredKind(expression, env);
            return { value, number: (0, numeric_1.numeric)(value, kind) };
        }
        case 'group': {
            if ('kind' in expression.expression)
                return read(expression.expression, env, preferredNumericKind);
            const value = evaluate(expression.expression, env);
            return typeof value === 'boolean' ? { value } : value;
        }
        case 'call': {
            const args = expression.args.map(arg => 'kind' in arg ? read(arg, env) : evaluate(arg, env));
            if (args.includes(unavailable))
                return unavailable;
            if (args.includes(missingEvidence))
                return missingEvidence;
            const value = ownValue(env.evaluations, expression.source);
            return value === unavailable ? missingEvidence : { value, number: (0, numeric_1.numeric)(value) };
        }
        case 'arithmetic': {
            const left = read(expression.left, env, numericHint(expression.right, env) ?? preferredNumericKind);
            const right = read(expression.right, env, numericHint(expression.left, env) ?? preferredNumericKind);
            if (left === unavailable || right === unavailable)
                return unavailable;
            if (left === missingEvidence || right === missingEvidence)
                return missingEvidence;
            if (!left.number || !right.number)
                return unavailable;
            const number = (0, numeric_1.arithmetic)(expression.op, left.number, right.number);
            return number ? { value: number, number } : unavailable;
        }
    }
}
function numericHint(expression, env) {
    if (expression.kind === 'group' && 'kind' in expression.expression)
        return numericHint(expression.expression, env);
    if (expression.kind === 'arithmetic') {
        const left = numericHint(expression.left, env);
        const right = numericHint(expression.right, env);
        return left === 'Float' || right === 'Float' ? 'Float' : left ?? right;
    }
    const kind = declaredKind(expression, env);
    return kind === 'Decimal' || kind === 'Float' ? kind : undefined;
}
function evaluate(predicate, env) {
    const left = read(predicate.left, env, predicate.op === 'IS' ? undefined : numericHint(predicate.right, env));
    if (predicate.op === 'IS') {
        if (typeof left === 'symbol')
            return left;
        // An IS guard tests the supplied value even when it does not conform to the INPUT declaration.
        return matchesType(left, { type: predicate.type, document: env.scope.root }, env.scope);
    }
    const right = read(predicate.right, env, numericHint(predicate.left, env));
    if (left === unavailable || right === unavailable)
        return unavailable;
    if (left === missingEvidence || right === missingEvidence)
        return missingEvidence;
    if (predicate.op === '==' || predicate.op === '!=') {
        let matches;
        if (left.value === null || right.value === null)
            matches = left.value === right.value;
        else if (left.number || right.number) {
            matches = !!left.number && !!right.number && left.number.kind === right.number.kind && (0, numeric_1.compareNumbers)(left.number, right.number) === 0;
        }
        else
            matches = (0, node_util_1.isDeepStrictEqual)(left.value, right.value);
        return predicate.op === '==' ? matches : !matches;
    }
    if (!left.number || !right.number)
        return unavailable;
    const comparison = (0, numeric_1.compareNumbers)(left.number, right.number);
    switch (predicate.op) {
        case '>': return comparison > 0;
        case '<': return comparison < 0;
        case '>=': return comparison >= 0;
        case '<=': return comparison <= 0;
    }
}
function prepareContractCall(contract, scope, args) {
    const env = {
        scope, bindings: args, types: new Map(contract.input.map(input => [input.name, { type: input.type, document: scope.root }])),
    };
    const eligible = [];
    const errors = [];
    for (const entry of contract.behaviors) {
        let passed = true;
        for (const guard of entry.when) {
            const outcome = evaluate(guard, env);
            if (outcome === true)
                continue;
            if (outcome !== false)
                errors.push(`${entry.name}: ${guard.source}`);
            passed = false;
            break;
        }
        if (passed)
            eligible.push(entry);
    }
    if (errors.length)
        return { error: `Could not evaluate WHEN guard (${errors.sort().join(', ')}).` };
    return { eligible, inputs: args };
}
function outcomeEvaluation(contract, scope, inputs, outcome) {
    const bindings = Object.assign(Object.create(null), inputs);
    const types = new Map(contract.input.map(input => [input.name, { type: input.type, document: scope.root }]));
    delete bindings.result;
    delete bindings.error;
    types.delete('result');
    types.delete('error');
    const bindResult = (value, type = contract.output) => {
        if (value !== unavailable)
            bindings.result = value;
        else if (type?.kind === 'named' && type.name === 'Void')
            bindings.result = unit;
        if (type)
            types.set('result', { type, document: scope.root });
    };
    if (outcome.kind === 'throw') {
        const error = ownValue(outcome, 'error');
        if (error !== unavailable)
            bindings.error = error;
        // Seeing a typed exception establishes that the error binding exists even without its fields.
        else if (outcome.errorType)
            bindings.error = { name: outcome.errorType };
        const partialResult = ownValue(outcome, 'partialResult');
        if (partialResult !== unavailable)
            bindings.result = partialResult;
    }
    else if (contract.output?.kind === 'generic' && contract.output.name === 'Result') {
        if (outcome.resultVariant === 'success')
            bindResult(ownValue(outcome, 'value'), contract.output.args[0]);
        else if (outcome.resultVariant === 'failure')
            bindings.error = outcome.error;
    }
    else
        bindResult(ownValue(outcome, 'value'));
    return { scope, bindings, types, evaluations: outcome.evaluations };
}
function checkCase(entry, outcome, env) {
    if (entry.throws ? outcome.kind !== 'throw' : outcome.kind !== 'return')
        return false;
    let pending = false;
    if (entry.throws && outcome.kind === 'throw') {
        if (outcome.errorType === undefined)
            pending = true;
        else if (env.scope.typeKey({ type: { kind: 'named', name: outcome.errorType }, document: env.scope.root }) !==
            env.scope.typeKey({ type: { kind: 'named', name: entry.throws }, document: env.scope.root }))
            return false;
    }
    if (entry.after) {
        const timing = entry.after.kind === 'duration' ? outcome.elapsedMilliseconds : outcome.additionalAttempts;
        if (timing === undefined)
            pending = true;
        else if (entry.after.kind === 'duration' ? timing < entry.after.value : timing !== entry.after.value)
            return false;
    }
    for (const postcondition of entry.postconditions) {
        let met;
        if ('kind' in postcondition) {
            const evidence = ownValue(outcome.evidence, postcondition.text);
            met = evidence === unavailable ? missingEvidence : evidence === true;
        }
        else
            met = evaluate(postcondition, env);
        if (met === false || met === unavailable)
            return false;
        if (met === missingEvidence)
            pending = true;
    }
    return pending ? missingEvidence : true;
}
function verifyPreparedCall(contract, scope, prepared, outcome) {
    if ('error' in prepared)
        return verificationError(prepared.error);
    const env = outcomeEvaluation(contract, scope, prepared.inputs, outcome);
    const matchedCases = [];
    let pending = false;
    for (const entry of prepared.eligible) {
        const result = checkCase(entry, outcome, env);
        if (result === true)
            matchedCases.push(entry.name);
        if (result === missingEvidence)
            pending = true;
    }
    if (matchedCases.length)
        return {
            status: 'verified', matchedCases: matchedCases.sort(), message: `Verified by ${matchedCases.join(', ')}.`,
        };
    if (pending)
        return { status: 'unverified', matchedCases, message: 'An eligible case could match with additional outcome or timing evidence.' };
    return { status: 'violation', matchedCases, message: 'The observed call cannot satisfy any eligible contract case.' };
}
function verificationError(message) {
    return { status: 'verification-error', matchedCases: [], message };
}
function verifyContractCall(analysis, request) {
    if (!(0, contractProtocol_1.isContractCallRequest)(request))
        return verificationError('Supply a contract name, named arguments, and a valid return or throw observation.');
    const contract = analysis.contracts.find(entry => entry.name === request.contract);
    if (!contract)
        return verificationError(`No GASD 1.2 contract named '${request.contract}' in this document.`);
    if (analysis.contracts.filter(entry => entry.name === request.contract).length > 1) {
        return verificationError(`Multiple contracts named '${request.contract}' in this document.`);
    }
    const invalid = analysis.diagnostics.find(diagnostic => diagnostic.range.start.line >= contract.range.start.line &&
        diagnostic.range.start.line <= contract.range.end.line);
    if (invalid)
        return verificationError(`Fix '${contract.name}' before verification. ${invalid.message}`);
    const prepared = prepareContractCall(contract, analysis.scope, request.arguments);
    return verifyPreparedCall(contract, analysis.scope, prepared, request.outcome);
}
//# sourceMappingURL=verification.js.map