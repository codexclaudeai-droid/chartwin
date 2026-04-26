import moo from 'moo';
import nearley from 'nearley';

export type PineSmaExpr = {
  type: 'sma';
  source: 'close';
  period: number;
};

export type PineCondition = {
  op: 'crossover' | 'crossunder';
  left: PineSmaExpr;
  right: PineSmaExpr;
};

export type PineStatement = {
  kind: 'BUY' | 'SELL';
  condition: PineCondition;
};

export type PineProgram = {
  statements: PineStatement[];
};

const baseLexer = moo.compile({
  WS: { match: /[ \t\r\n]+/, lineBreaks: true },
  BUY: /[Bb][Uu][Yy]/,
  SELL: /[Ss][Ee][Ll][Ll]/,
  TA: /[Tt][Aa]/,
  CROSSOVER: /[Cc][Rr][Oo][Ss][Ss][Oo][Vv][Ee][Rr]/,
  CROSSUNDER: /[Cc][Rr][Oo][Ss][Ss][Uu][Nn][Dd][Ee][Rr]/,
  SMA: /[Ss][Mm][Aa]/,
  CLOSE: /[Cc][Ll][Oo][Ss][Ee]/,
  EQ: '=',
  DOT: '.',
  LPAREN: '(',
  RPAREN: ')',
  COMMA: ',',
  NUMBER: /[0-9]+/,
});

const lexer = {
  reset: (chunk: string, info?: moo.LexerState) => baseLexer.reset(chunk, info),
  next: (): moo.Token | undefined => {
    let token = baseLexer.next();
    while (token && token.type === 'WS') {
      token = baseLexer.next();
    }
    return token;
  },
  save: () => baseLexer.save(),
  formatError: (token: moo.Token, message: string) => baseLexer.formatError(token, message),
  has: (name: string) => baseLexer.has(name),
};

const grammar = {
  Lexer: lexer,
  ParserRules: [
    {
      name: 'main',
      symbols: ['statement_list'],
      postprocess: (d: any[]): PineProgram => ({ statements: d[0] }),
    },
    {
      name: 'statement_list',
      symbols: ['statement'],
      postprocess: (d: any[]): PineStatement[] => [d[0]],
    },
    {
      name: 'statement_list',
      symbols: ['statement_list', 'statement'],
      postprocess: (d: any[]): PineStatement[] => [...d[0], d[1]],
    },
    {
      name: 'statement',
      symbols: [{ type: 'BUY' }, { type: 'EQ' }, 'condition'],
      postprocess: (d: any[]): PineStatement => ({
        kind: 'BUY',
        condition: d[2],
      }),
    },
    {
      name: 'statement',
      symbols: [{ type: 'SELL' }, { type: 'EQ' }, 'condition'],
      postprocess: (d: any[]): PineStatement => ({
        kind: 'SELL',
        condition: d[2],
      }),
    },
    {
      name: 'condition',
      symbols: [
        { type: 'TA' },
        { type: 'DOT' },
        { type: 'CROSSOVER' },
        { type: 'LPAREN' },
        'sma_expr',
        { type: 'COMMA' },
        'sma_expr',
        { type: 'RPAREN' },
      ],
      postprocess: (d: any[]): PineCondition => ({
        op: 'crossover',
        left: d[4],
        right: d[6],
      }),
    },
    {
      name: 'condition',
      symbols: [
        { type: 'TA' },
        { type: 'DOT' },
        { type: 'CROSSUNDER' },
        { type: 'LPAREN' },
        'sma_expr',
        { type: 'COMMA' },
        'sma_expr',
        { type: 'RPAREN' },
      ],
      postprocess: (d: any[]): PineCondition => ({
        op: 'crossunder',
        left: d[4],
        right: d[6],
      }),
    },
    {
      name: 'sma_expr',
      symbols: [
        { type: 'TA' },
        { type: 'DOT' },
        { type: 'SMA' },
        { type: 'LPAREN' },
        { type: 'CLOSE' },
        { type: 'COMMA' },
        { type: 'NUMBER' },
        { type: 'RPAREN' },
      ],
      postprocess: (d: any[]): PineSmaExpr => ({
        type: 'sma',
        source: 'close',
        period: Number(d[6].value),
      }),
    },
  ],
  ParserStart: 'main',
};

export function parsePineProgram(sourceCode: string): PineProgram {
  const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar as unknown as nearley.CompiledRules));
  parser.feed(sourceCode);

  const results = parser.results as PineProgram[];
  if (!results.length) {
    throw new Error('Pine 구문을 해석하지 못했습니다.');
  }
  if (results.length > 1) {
    throw new Error('Pine 구문이 모호합니다. BUY/SELL 라인을 명확히 작성해주세요.');
  }

  const program = results[0];
  const hasBuy = program.statements.some((s) => s.kind === 'BUY');
  const hasSell = program.statements.some((s) => s.kind === 'SELL');
  if (!hasBuy || !hasSell) {
    throw new Error('Pine 전략은 BUY/SELL 두 라인을 모두 포함해야 합니다.');
  }

  return program;
}
