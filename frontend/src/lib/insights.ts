/**
 * Compare a user result against the expected result and produce small,
 * actionable insights — without revealing the reference SQL. This is the
 * "Tier 2" of our feedback ladder: more specific than a status pill, less
 * spoiler-y than the LLM hint endpoint.
 */
import type { TableResult } from "./types";

export type Insight = {
  title: string;
  detail: string;
};

function rowKey(row: unknown[]): string {
  return JSON.stringify(row);
}

export function computeInsights(
  yours: TableResult,
  expected: TableResult,
  ordered: boolean,
): Insight[] {
  const insights: Insight[] = [];

  const yc = yours.columns.map((c) => c.toLowerCase());
  const ec = expected.columns.map((c) => c.toLowerCase());

  // ── 1. Column mismatch ────────────────────────────────────────────────────
  const ycSorted = [...yc].sort();
  const ecSorted = [...ec].sort();
  if (ycSorted.join("|") !== ecSorted.join("|")) {
    const missing = ec.filter((c) => !yc.includes(c));
    const extra = yc.filter((c) => !ec.includes(c));

    if (missing.length > 0 && extra.length === 0) {
      insights.push({
        title: `Missing ${missing.length} column${missing.length === 1 ? "" : "s"}`,
        detail: `You returned ${yours.columns.length} of ${expected.columns.length} expected columns. The question names every output column explicitly — re-read it and add the missing one${missing.length === 1 ? "" : "s"} to your SELECT.`,
      });
    } else if (extra.length > 0 && missing.length === 0) {
      insights.push({
        title: `Extra column${extra.length === 1 ? "" : "s"} in your output`,
        detail: `\`${extra.join("`, `")}\` ${extra.length === 1 ? "isn't" : "aren't"} part of the expected output. Trim your SELECT to just what the question asks for.`,
      });
    } else {
      insights.push({
        title: "Column names don't match",
        detail: `You returned ${yours.columns.length} columns; expected ${expected.columns.length}. Check the question for the exact column names and order in your SELECT.`,
      });
    }
    return insights; // Skip row-level checks until columns align.
  }

  // ── 2. Row count differs ──────────────────────────────────────────────────
  if (yours.rows.length !== expected.rows.length) {
    const diff = yours.rows.length - expected.rows.length;
    if (diff > 0) {
      insights.push({
        title: `${diff} extra row${diff === 1 ? "" : "s"}`,
        detail: `You returned ${yours.rows.length} rows; expected ${expected.rows.length}. Common causes: a filter you're missing, an INNER JOIN that should be LEFT, or duplicates from joining one-to-many tables.`,
      });
    } else {
      insights.push({
        title: `${-diff} row${diff === -1 ? "" : "s"} short`,
        detail: `You returned ${yours.rows.length} rows; expected ${expected.rows.length}. Common causes: a JOIN dropping rows where one side has no match, a WHERE that's too strict, or a GROUP BY collapsing more than it should.`,
      });
    }

    // Duplicate detection on the user's side.
    const yourUnique = new Set(yours.rows.map(rowKey));
    if (yourUnique.size < yours.rows.length) {
      insights.push({
        title: "Your result has duplicate rows",
        detail: `${yours.rows.length - yourUnique.size} row${yours.rows.length - yourUnique.size === 1 ? " is" : "s are"} repeated. Try DISTINCT, or check whether your JOIN is producing the cross-product of two child tables.`,
      });
    }
    return insights;
  }

  // ── 3. Same shape, sort matters ───────────────────────────────────────────
  const yoursStr = yours.rows.map(rowKey);
  const expectedStr = expected.rows.map(rowKey);
  const yoursSorted = [...yoursStr].sort();
  const expectedSorted = [...expectedStr].sort();

  // 3a. Right rows, wrong order.
  if (
    ordered &&
    yoursStr.join("|") !== expectedStr.join("|") &&
    yoursSorted.join("|") === expectedSorted.join("|")
  ) {
    insights.push({
      title: "Right rows, wrong order",
      detail:
        "Your data exactly matches the expected set — only the order is off. The question specifies a sort. Add or fix your ORDER BY clause.",
    });
    return insights;
  }

  // 3b. Most rows match — likely an aggregation or one filter is off.
  const expectedSet = new Set(expectedSorted);
  const matching = yoursSorted.filter((r) => expectedSet.has(r)).length;
  const total = yoursSorted.length;
  const matchPct = total === 0 ? 0 : matching / total;

  if (matching === total) {
    // Sorted sets matched but order differs and `ordered` is false — shouldn't
    // be marked wrong, but defensively surface ordering as a hint.
    insights.push({
      title: "All rows match but order differs",
      detail:
        "If the question requires a specific order, add an ORDER BY. Otherwise this should grade as correct.",
    });
  } else if (matchPct > 0.7) {
    const offBy = total - matching;
    insights.push({
      title: `${offBy} of ${total} rows are off`,
      detail: `Same shape, and ${matching} rows are right. Look at the rows that differ — usually it's an aggregation (SUM vs COUNT, AVG vs MAX), a GROUP BY missing a column, or a boundary on a date filter.`,
    });
  } else {
    insights.push({
      title: "Right shape, but the values are wrong",
      detail:
        "Columns and row count match, but the data inside is different. Re-check what the question is asking you to compute — usually an aggregation, a CASE WHEN, or which table you're pulling from.",
    });
  }

  return insights;
}
