import { isRecord } from '../../shared/contractProtocol';

export type NumericKind = 'Integer' | 'Float' | 'Decimal';
export type Numeric = { kind: 'Integer' | 'Decimal'; numerator: bigint; denominator: bigint }
    | { kind: 'Float'; value: number };

const minInteger = -(2n ** 63n);
const maxInteger = 2n ** 63n - 1n;

export function numeric(value: unknown, preferred?: string): Numeric | undefined {
    if (isRecord(value) && (value.$gasd === 'Integer' || value.$gasd === 'Decimal') && typeof value.value === 'string') {
        if (!/^-?\d+(?:\.\d+)?$/.test(value.value)) return undefined;
        return numericLiteral(value.value, value.$gasd);
    }
    if (typeof value === 'bigint') return integer(value);
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    if (preferred === 'Float') return { kind: 'Float', value };
    if (preferred === 'Decimal') return numericLiteral(String(value), 'Decimal');
    if (Number.isSafeInteger(value)) return integer(BigInt(value));
    if (preferred === 'Integer') return undefined;
    return { kind: 'Float', value };
}

function integer(value: bigint): Numeric | undefined {
    if (value < minInteger || value > maxInteger) return undefined;
    return { kind: 'Integer', numerator: value, denominator: 1n };
}

export function numericLiteral(value: string, preferred?: string): Numeric | undefined {
    const kind = preferred ?? (value.includes('.') ? 'Float' : 'Integer');
    if (kind === 'Integer') return /^-?\d+$/.test(value) ? integer(BigInt(value)) : undefined;
    if (kind === 'Float') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? { kind, value: parsed } : undefined;
    }
    const match = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(value);
    if (!match) return undefined;
    const [, sign, whole, fraction = '', exponent = '0'] = match;
    const scale = fraction.length - Number(exponent);
    const digits = BigInt(sign + whole + fraction);
    return { kind: 'Decimal', numerator: digits * 10n ** BigInt(Math.max(0, -scale)), denominator: 10n ** BigInt(Math.max(0, scale)) };
}

function asFloat(value: Numeric): number {
    return value.kind === 'Float' ? value.value : Number(value.numerator) / Number(value.denominator);
}

export function compareNumbers(left: Numeric, right: Numeric): number {
    if (left.kind === 'Float' || right.kind === 'Float') {
        // Mixed kinds are allowed for ordering. Use relational operators for an exact Float/Integer comparison.
        const a = left.kind === 'Integer' ? left.numerator : asFloat(left);
        const b = right.kind === 'Integer' ? right.numerator : asFloat(right);
        return a < b ? -1 : a > b ? 1 : 0;
    }
    const difference = left.numerator * right.denominator - right.numerator * left.denominator;
    return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function arithmetic(op: string, left: Numeric, right: Numeric): Numeric | undefined {
    if (left.kind === 'Float' || right.kind === 'Float') {
        const a = asFloat(left);
        const b = asFloat(right);
        const result = op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : op === '/' ? a / b : a ** b;
        return Number.isFinite(result) ? { kind: 'Float', value: result } : undefined;
    }
    const { numerator: a, denominator: b } = left;
    const { numerator: c, denominator: d } = right;
    const rational = (numerator: bigint, denominator: bigint): Numeric | undefined => {
        if (denominator === 0n) return undefined;
        if (denominator === 1n && left.kind === 'Integer' && right.kind === 'Integer') return integer(numerator);
        return denominator > 0n ? { kind: 'Decimal', numerator, denominator }
            : { kind: 'Decimal', numerator: -numerator, denominator: -denominator };
    };
    switch (op) {
        case '+': return rational(a * d + c * b, b * d);
        case '-': return rational(a * d - c * b, b * d);
        case '*': return rational(a * c, b * d);
        case '/':
            if (c && left.kind === 'Integer' && right.kind === 'Integer' && a % c === 0n) return integer(a / c);
            return rational(a * d, b * c);
        case '^':
            if (d !== 1n || c < -1024n || c > 1024n) return undefined;
            return c < 0n ? rational(b ** -c, a ** -c) : rational(a ** c, b ** c);
        default: return undefined;
    }
}
