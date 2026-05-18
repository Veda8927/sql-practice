/**
 * Cheap regex-only structural parse of a SQL snippet to power the editor
 * outline strip. Not a parser — just enough to tell the learner what their
 * query currently has.
 */

const CLAUSES = [
  "SELECT",
  "FROM",
  "JOIN",
  "WHERE",
  "GROUP BY",
  "HAVING",
  "ORDER BY",
  "LIMIT",
] as const;

export type Clause = (typeof CLAUSES)[number];

export type Outline = {
  clauses: Clause[];
  tables: string[];
  hasAggregate: boolean;
  hasSubquery: boolean;
  hasCte: boolean;
  hasDistinct: boolean;
};

function stripStringsAndComments(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/'(?:[^'\\]|\\.|'')*'/g, "''");
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

export function outlineSql(rawSql: string): Outline {
  const sql = stripStringsAndComments(rawSql);
  const upper = sql.toUpperCase();

  const clauses: Clause[] = [];
  for (const c of CLAUSES) {
    const pattern = new RegExp(`\\b${c.replace(" ", "\\s+")}\\b`, "i");
    if (pattern.test(upper)) clauses.push(c);
  }

  // Tables referenced after FROM / JOIN.
  const tablePattern = /\b(?:FROM|JOIN)\s+([A-Za-z_][A-Za-z_0-9]*)/gi;
  const tables: string[] = [];
  let match: RegExpMatchArray | null;
  while ((match = tablePattern.exec(sql)) !== null) {
    tables.push(match[1].toLowerCase());
  }

  const hasAggregate =
    /\b(COUNT|SUM|AVG|MIN|MAX|ARRAY_AGG|STRING_AGG)\s*\(/i.test(sql);
  const hasSubquery = /\(\s*SELECT\b/i.test(sql);
  const hasCte = /\bWITH\s+[A-Za-z_]/i.test(sql);
  const hasDistinct = /\bDISTINCT\b/i.test(sql);

  return {
    clauses,
    tables: uniq(tables),
    hasAggregate,
    hasSubquery,
    hasCte,
    hasDistinct,
  };
}

export const CLAUSE_ORDER: readonly Clause[] = CLAUSES;
