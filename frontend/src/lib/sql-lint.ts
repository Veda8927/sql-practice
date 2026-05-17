/**
 * Lightweight SQL typo detection. Two strategies:
 *  1) An explicit map of common misspellings -> canonical keyword.
 *  2) Levenshtein-1 fuzzy match against a keyword list for tokens that look
 *     like they were meant to be keywords.
 *
 * Identifiers from the schema are excluded so legitimate column/table names
 * like "country" don't get flagged.
 */

const SQL_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "GROUP", "BY", "HAVING", "ORDER",
  "LIMIT", "OFFSET", "DISTINCT", "AS", "AND", "OR", "NOT", "NULL",
  "IS", "IN", "LIKE", "ILIKE", "BETWEEN", "EXISTS", "CASE", "WHEN",
  "THEN", "ELSE", "END", "JOIN", "INNER", "OUTER", "LEFT", "RIGHT",
  "FULL", "CROSS", "ON", "USING", "UNION", "INTERSECT", "EXCEPT",
  "ALL", "ANY", "SOME", "WITH", "OVER", "PARTITION", "ROW_NUMBER",
  "RANK", "DENSE_RANK", "LAG", "LEAD", "SUM", "COUNT", "AVG", "MIN",
  "MAX", "COALESCE", "NULLIF", "CAST", "INTERVAL", "DATE",
  "TIMESTAMP", "INTEGER", "TEXT", "NUMERIC", "BOOLEAN", "TRUE", "FALSE",
  "ASC", "DESC", "RETURNING", "INSERT", "UPDATE", "DELETE", "VALUES",
];

const KEYWORD_SET = new Set(SQL_KEYWORDS);

const EXPLICIT_FIXES: Record<string, string> = {
  slect: "SELECT", sleect: "SELECT", seelct: "SELECT", selct: "SELECT",
  selcet: "SELECT", sleet: "SELECT",
  form: "FROM", frmo: "FROM", fomr: "FROM", fom: "FROM",
  wher: "WHERE", whre: "WHERE", hwere: "WHERE", wehre: "WHERE",
  groupby: "GROUP BY", orderby: "ORDER BY",
  distict: "DISTINCT", ditinct: "DISTINCT", distnict: "DISTINCT",
  limti: "LIMIT", lmit: "LIMIT", liimt: "LIMIT",
  joim: "JOIN", jion: "JOIN",
  inenr: "INNER", innr: "INNER",
  otuer: "OUTER",
  lef: "LEFT", lft: "LEFT",
  rigt: "RIGHT", rght: "RIGHT",
  havign: "HAVING", havng: "HAVING",
  caes: "CASE", wehn: "WHEN",
  asnd: "AND", ro: "OR",
};

export type LintIssue = {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  message: string;
  suggestion: string;
  wrong: string;
};

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  const dp: number[] = Array(n + 1).fill(0);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[n];
}

const WORD_PATTERN = /[A-Za-z_][A-Za-z_]*/g;

export function lintSql(
  source: string,
  schemaIdentifiers: Set<string> = new Set(),
): LintIssue[] {
  const issues: LintIssue[] = [];
  const lines = source.split("\n");

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const commentIdx = line.indexOf("--");
    const scan = commentIdx >= 0 ? line.slice(0, commentIdx) : line;

    let match: RegExpExecArray | null;
    const re = new RegExp(WORD_PATTERN.source, "g");
    while ((match = re.exec(scan)) !== null) {
      const word = match[0];
      const lower = word.toLowerCase();
      const upper = word.toUpperCase();

      if (KEYWORD_SET.has(upper)) continue;
      if (schemaIdentifiers.has(lower)) continue;
      if (word.length < 3) continue;

      let suggestion: string | null = null;

      if (EXPLICIT_FIXES[lower]) {
        suggestion = EXPLICIT_FIXES[lower];
      } else if (word.length >= 4) {
        for (const kw of SQL_KEYWORDS) {
          if (Math.abs(kw.length - word.length) > 1) continue;
          if (levenshtein(lower, kw.toLowerCase()) === 1) {
            suggestion = kw;
            break;
          }
        }
      }

      if (suggestion) {
        issues.push({
          startLine: li + 1,
          startColumn: match.index + 1,
          endLine: li + 1,
          endColumn: match.index + 1 + word.length,
          message: "Did you mean `" + suggestion + "`?",
          suggestion,
          wrong: word,
        });
      }
    }
  }

  return issues;
}

export function collectSchemaIdentifiers(
  tables: { name: string; columns: { name: string }[] }[],
): Set<string> {
  const s = new Set<string>();
  for (const t of tables) {
    s.add(t.name.toLowerCase());
    for (const c of t.columns) s.add(c.name.toLowerCase());
  }
  return s;
}
