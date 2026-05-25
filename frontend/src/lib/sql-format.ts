import { format as formatSql } from "sql-formatter";

// Wrap bare YYYY-MM-DD literals in single quotes so the formatter doesn't
// mangle them into arithmetic (2024 - 01 - 01).
function preFixDates(sql: string): string {
  return sql.replace(
    /(?<!['"0-9])(\d{4})-(\d{2})-(\d{2})(?!['"0-9])/g,
    "'$1-$2-$3'",
  );
}

// Format Postgres SQL. Returns the input unchanged if it can't be parsed,
// so callers can apply it unconditionally.
export function formatSqlText(sql: string): string {
  try {
    return formatSql(preFixDates(sql), {
      language: "postgresql",
      keywordCase: "upper",
      tabWidth: 2,
      linesBetweenQueries: 1,
      expressionWidth: 120,
    });
  } catch {
    return sql;
  }
}
