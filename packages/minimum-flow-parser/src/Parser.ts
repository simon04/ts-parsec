// tslint:disable:no-duplicate-imports

import * as parsec from 'ts-parsec';
import { rep_sc, rule } from 'ts-parsec';
import { alt, apply, list_sc, lrec_sc, opt_sc, seq, str, tok } from 'ts-parsec';
import * as ast from './AST';
import { TokenKind } from './Tokenizer';

type Token = parsec.Token<TokenKind>;

function applyNull(value: Token): ast.Type {
  return { kind: 'PrimitiveType', name: 'null' };
}

function applyNumber(value: Token): ast.Type {
  return { kind: 'PrimitiveType', name: 'number' };
}

function applyString(value: Token): ast.Type {
  return { kind: 'PrimitiveType', name: 'string' };
}

function applyBoolean(value: Token): ast.Type {
  return { kind: 'PrimitiveType', name: 'boolean' };
}

function applyLiteralType(value: Token): ast.Type {
  return { kind: 'LiteralType', text: value.text };
}

function applyOptionalType(value: [Token, ast.Type]): ast.Type {
  const elementType = value[1];
  if (elementType.kind === 'OptionalType') {
    return elementType;
  } else {
    return { kind: 'OptionalType', elementType };
  }
}

function applyParenType(value: [Token, ast.Type, Token]): ast.Type {
  return {
    kind: 'ParenType',
    elementType: value[1]
  };
}

function applyReadonlyArrayType(value: [Token, Token, ast.Type, Token]): ast.Type {
  return {
    kind: 'ArrayType',
    isReadonly: true,
    elementType: value[2]
  };
}

function applyDecoratedGenericType(value: [Token, Token, ast.Type, Token]): ast.Type {
  return {
    kind: 'DecoratedGenericType',
    elementType: value[2],
    name: '$ReadOnly'
  };
}

function applyTypeReference(value: [Token[], undefined | [Token, ast.Type[], Token]]): ast.Type {
  const [names, typeArguments] = value;

  let entity: ast.EntityName | undefined;
  for (const name of names) {
    if (entity === undefined) {
      entity = name.text;
    } else {
      entity = { parent: entity, name: name.text };
    }
  }

  if (typeArguments === undefined) {
    return {
      kind: 'TypeReference',
      name: <ast.EntityName>entity,
      typeArguments: []
    };
  } else {
    return {
      kind: 'TypeReference',
      name: <ast.EntityName>entity,
      typeArguments: typeArguments[1]
    };
  }
}

function applyObjectTypeMixin(value: [Token, ast.Type]): ast.Type {
  return value[1];
}

function applyObjectTypeProp(value: [
  undefined | Token,
  Token,
  undefined | Token,
  Token,
  ast.Type
]): ast.ObjectProp {
  const [isReadonly, name, isOptional, , propType] = value;
  return {
    kind: 'Prop',
    isReadonly: isReadonly !== undefined,
    name: name.text,
    isOptional: isOptional !== undefined,
    propType
  };
}

function applyObjectIndexer(value: [
  undefined | Token,
  Token,
  Token,
  Token,
  ast.Type,
  Token,
  Token,
  ast.Type
]): ast.ObjectIndexer {
  const [isReadonly, , keyName, , keyType, , , valueType] = value;
  return {
    kind: 'Indexer',
    isReadonly: isReadonly !== undefined,
    keyName: keyName.text,
    keyType,
    valueType
  };
}

function applyObjectType(value: [
  Token,
  undefined | Token,
  undefined | (ast.Type | ast.ObjectMember)[],
  undefined | Token,
  undefined | Token,
  Token
]): ast.Type {
  const [, isExact, members] = value;
  return {
    kind: 'ObjectType',
    isExact: isExact !== undefined,
    mixinTypes: members === undefined ? [] : <ast.Type[]>members.filter((member: ast.Type | ast.ObjectMember) => {
      return member.kind !== 'Prop' && member.kind !== 'Indexer';
    }),
    members: members === undefined ? [] : <ast.ObjectMember[]>members.filter((member: ast.Type | ast.ObjectMember) => {
      return member.kind === 'Prop' || member.kind === 'Indexer';
    })
  };
}

function applyArrayTypeLrec(value: [Token, Token]): ast.ArrayType {
  return {
    kind: 'ArrayType',
    isReadonly: false,
    elementType: <ast.Type><unknown>undefined
  };
}

function applyUnionHead(value: [undefined | Token, ast.Type]): ast.Type {
  return value[1];
}

function applyUnionTypeLrec(value: [Token, ast.Type]): ast.UnionType {
  return {
    kind: 'UnionType',
    elementTypes: [value[1]]
  };
}

function applyTypeLrec(first: ast.Type, second: ast.ArrayType | ast.UnionType): ast.Type {
  switch (second.kind) {
    case 'ArrayType': {
      second.elementType = first;
      return second;
    }
    case 'UnionType': {
      if (first.kind === 'UnionType') {
        first.elementTypes.push(...second.elementTypes);
        return first;
      } else {
        second.elementTypes.unshift(first);
        return second;
      }
    }
    default: throw new Error(`Unrecognized type AST.`);
  }
}

function applyTypeAliasDecl(value: [
  undefined | Token,
  Token,
  Token,
  Token,
  ast.Type,
  Token
]): ast.Declaration {
  const [hasExport, , name, , aliasedType] = value;
  return {
    kind: 'TypeAliasDecl',
    hasExport: hasExport !== undefined,
    name: name.text,
    aliasedType
  };
}

function applyUseStrictStat(value: [Token, Token]): ast.Statement {
  return {
    kind: 'UseStrictStat'
  };
}

function applyImportEqualStat(value: [Token, Token, Token, Token, Token, Token, Token, Token]): ast.Statement {
  const [, name, , , , source] = value;
  return {
    kind: 'ImportEqualStat',
    name: name.text,
    source: source.text
  };
}

function applyImportAsStat(value: [Token, Token, Token, Token, Token, Token, Token]): ast.Statement {
  const [, , , name, , source] = value;
  return {
    kind: 'ImportAsStat',
    name: name.text,
    source: source.text
  };
}

function applyImportNameStat(value: [Token, undefined | Token, Token, Token[], Token, Token, Token, Token]): ast.Statement {
  const [, , , names, , , source] = value;
  return {
    kind: 'ImportNameStat',
    names: names.map((item: Token) => { return item.text; }),
    source: source.text
  };
}

function applyProgram(value: ast.Statement[]): ast.FlowProgram {
  return {
    statements: value
  };
}

export const IDENTIFIER = rule<TokenKind, Token>();
export const TYPE_TERM = rule<TokenKind, ast.Type>();
export const TYPE_ARRAY = rule<TokenKind, ast.Type>();
export const TYPE = rule<TokenKind, ast.Type>();
export const DECL = rule<TokenKind, ast.Declaration>();
export const STAT = rule<TokenKind, ast.Statement>();
export const PROGRAM = rule<TokenKind, ast.FlowProgram>();

IDENTIFIER.setPattern(
  alt(
    tok(TokenKind.KEYWORD_type),
    tok(TokenKind.Identifier)
  )
);

TYPE_TERM.setPattern(
  alt(
    alt(
      apply(str('null'), applyNull),
      apply(str('number'), applyNumber),
      apply(str('string'), applyString),
      apply(str('boolean'), applyBoolean),
      apply(
        alt(tok(TokenKind.StringLiteral), tok(TokenKind.NumberLiteral), tok(TokenKind.KEYWORD_true), tok(TokenKind.KEYWORD_false)),
        applyLiteralType),
      apply(seq(str('?'), TYPE), applyOptionalType),
      apply(seq(str('('), TYPE, str(')')), applyParenType)
    ),
    alt(
      apply(seq(str('$ReadOnlyArray'), str('<'), TYPE, str('>')), applyReadonlyArrayType),
      apply(seq(str('$ReadOnly'), str('<'), TYPE, str('>')), applyDecoratedGenericType),
      apply(seq(list_sc(IDENTIFIER, str('.')), opt_sc(seq(str('<'), list_sc(TYPE, str(',')), str('>')))), applyTypeReference)
    ),
    apply(
      seq(
        str('{'),
        opt_sc(str('|')),
        opt_sc(list_sc(
          alt(
            apply(
              seq(str('...'), TYPE),
              applyObjectTypeMixin
            ),
            apply(
              seq(opt_sc(str('+')), IDENTIFIER, opt_sc(str('?')), str(':'), TYPE),
              applyObjectTypeProp
            ),
            apply(
              seq(opt_sc(str('+')), str('['), IDENTIFIER, str(':'), TYPE, str(']'), str(':'), TYPE),
              applyObjectIndexer
            )
          ),
          str(',')
        )),
        opt_sc(str(',')),
        opt_sc(str('|')),
        str('}')
      ),
      applyObjectType
    )
  )
);

TYPE_ARRAY.setPattern(
  lrec_sc(
    TYPE_TERM,
    apply(seq(str('['), str(']')), applyArrayTypeLrec),
    applyTypeLrec
  )
);

TYPE.setPattern(
  lrec_sc(
    apply(seq(opt_sc(str('|')), TYPE_ARRAY), applyUnionHead),
    apply(seq(str('|'), TYPE_ARRAY), applyUnionTypeLrec),
    applyTypeLrec
  )
);

DECL.setPattern(
  apply(
    seq(opt_sc(str('export')), str('type'), IDENTIFIER, str('='), TYPE, str(';')),
    applyTypeAliasDecl
  )
);

STAT.setPattern(
  alt(
    DECL,
    apply(seq(str('const'), tok(TokenKind.Identifier), str('='), str('require'), str('('), tok(TokenKind.StringLiteral), str(')'), str(';')), applyImportEqualStat),
    apply(seq(str('import'), str('*'), str('as'), tok(TokenKind.Identifier), str('from'), tok(TokenKind.StringLiteral), str(';')), applyImportAsStat),
    apply(seq(str('import'), opt_sc(str('type')), str('{'), list_sc(tok(TokenKind.Identifier), str(',')), str('}'), str('from'), tok(TokenKind.StringLiteral), str(';')), applyImportNameStat),
    apply(seq(str(`'use strict'`), str(';')), applyUseStrictStat)
  )
);

PROGRAM.setPattern(apply(rep_sc(STAT), applyProgram));
