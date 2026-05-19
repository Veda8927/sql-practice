"""OpenAI tutor: question generation + mistake explanation + step-by-step solution."""
from __future__ import annotations

import json
import random
import re
from typing import Any

from openai import AsyncOpenAI
from sqlalchemy import text

from .config import settings
from .db import engine

# Question shapes — we rotate through these to force structural diversity.
# Each entry: (shape_id, one-line description for the prompt).
QUESTION_SHAPES: list[tuple[str, str]] = [
    ("per_group_aggregate", "Per-group aggregate. GROUP BY one column from an anchor table, return one row per group with an aggregate (COUNT, SUM, AVG)."),
    ("simple_filter", "Simple filter, NO aggregation. SELECT a few columns from ONE table WHERE some condition holds. Return many rows."),
    ("ranking_topn", "Top-N ranking. ORDER BY some metric DESC, LIMIT N. State the N and the metric in the question."),
    ("anti_join_missing", "Anti-join / missing data. Find rows in A that have NO matching row in B (LEFT JOIN ... IS NULL or NOT EXISTS). Phrase it as 'X that have never...'."),
    ("time_bucket", "Time-bucketed count. GROUP BY DATE_TRUNC('month'/'week'/'year', some_date) so each row is a time bucket. Order chronologically."),
    ("distinct_count", "Distinct count. COUNT(DISTINCT some_column) — answer is a single number or one row per group of distinct things."),
    ("two_group_comparison", "Two-group comparison using CASE or filtered aggregates. Compare e.g. weekday vs weekend, A vs B category, completed vs cancelled. Show both numbers side by side."),
    ("null_or_missing_field", "NULL / missing field detection. Find rows where some optional column IS NULL, or COALESCE a missing value to a default."),
    ("date_math_gap", "Date arithmetic. Compute days/weeks/months between two dates (returned, due, signup, etc.) or 'within the last N days'."),
    ("string_match", "String manipulation. Use ILIKE / LOWER / SPLIT_PART / LENGTH / POSITION to filter or transform a text column."),
    ("self_comparison", "Self-join or self-reference. Same table aliased twice — parent/child, manager/employee, replacement/original. Hard difficulty."),
    ("ranking_with_ties", "Ranking with ties using DENSE_RANK or RANK over a metric. Hard difficulty."),
    ("running_total", "Running total with a window function (SUM(...) OVER (ORDER BY date)). Hard difficulty."),
    ("having_threshold", "GROUP BY + HAVING with a numeric threshold (e.g. 'more than 5 of X'). The threshold MUST appear in the question text."),
    ("bucket_with_case", "Bucketing with CASE WHEN into 2-3 named buckets. The thresholds MUST appear in the question text in parentheses."),
    ("pivot_aggregation", "Pivot: one row per anchor, columns are categories. SUM(CASE WHEN category='A' THEN val END) AS a_total, SUM(CASE WHEN category='B' THEN val END) AS b_total. Or use FILTER (WHERE ...) per aggregate."),
    ("deduplicate_rows", "Deduplication: return unique rows. SELECT DISTINCT for whole-row dedup, or a CTE with ROW_NUMBER() OVER (PARTITION BY dedup_key ORDER BY tiebreaker) keeping rn = 1."),
    ("validate_records", "Find rows that violate an expected rule: bad email format (regex mismatch), date in the future, value not in a reference list, required field IS NULL, value out of valid range. The question must use words like 'invalid', 'bad', 'anomalous', or describe the violated rule."),
    ("string_clean", "Cleanup / standardize a text column: TRIM whitespace, LOWER/UPPER, REPLACE substrings, INITCAP. The question must ask for a 'cleaned' or 'standardized' version of a column."),
    ("json_extract", "Extract a value from a JSON/JSONB column using -> ->> or jsonb_path_query. Requires the schema to have a JSON column."),
    ("array_collect", "Aggregate per group into an array using ARRAY_AGG, or unnest an array column using UNNEST. Requires the schema to have either an aggregation use-case or an array column."),
    ("lateral_topn_per_group", "Top-N per group via LATERAL: for each row in the outer table, return the top N matching child rows. CROSS JOIN LATERAL (SELECT ... LIMIT N)."),
    ("rollup_subtotals", "Subtotals + grand total in one result using GROUPING SETS / ROLLUP / CUBE. Each row is one aggregation level."),
    ("type_cast_filter", "Type casting to make a filter or comparison work — cast TEXT to NUMERIC/DATE before comparing, or pull EXTRACT(year FROM date)."),
    ("correlated_per_row", "Correlated subquery: a per-row scalar subquery that references the outer row's columns (e.g. count children for each parent inline)."),
]

SHAPES_BY_DIFFICULTY: dict[str, list[str]] = {
    "easy": ["simple_filter", "ranking_topn", "distinct_count", "null_or_missing_field", "string_clean", "type_cast_filter"],
    "medium": ["per_group_aggregate", "anti_join_missing", "time_bucket", "two_group_comparison", "date_math_gap", "string_match", "having_threshold", "bucket_with_case", "pivot_aggregation", "deduplicate_rows", "validate_records", "json_extract", "array_collect", "rollup_subtotals"],
    "hard": ["self_comparison", "ranking_with_ties", "running_total", "lateral_topn_per_group", "correlated_per_row"],
}

SHAPES_BY_CONCEPT: dict[str, list[str]] = {
    # Query patterns
    "joins": ["per_group_aggregate", "anti_join_missing", "two_group_comparison"],
    "left_joins": ["anti_join_missing", "null_or_missing_field"],
    "self_joins": ["self_comparison"],
    "full_joins": ["two_group_comparison", "anti_join_missing"],
    "lateral_joins": ["lateral_topn_per_group"],
    "subqueries": ["per_group_aggregate", "two_group_comparison"],
    "correlated_subqueries": ["correlated_per_row"],
    "exists": ["anti_join_missing", "validate_records"],
    "set_operations": ["two_group_comparison"],
    # Aggregation
    "aggregations": ["per_group_aggregate", "distinct_count", "running_total"],
    "distinct": ["distinct_count", "deduplicate_rows"],
    "group_by": ["per_group_aggregate", "time_bucket", "two_group_comparison"],
    "having": ["having_threshold"],
    "filter_clause": ["pivot_aggregation", "two_group_comparison"],
    "grouping_sets": ["rollup_subtotals"],
    # Advanced
    "window_functions": ["ranking_with_ties", "running_total"],
    "cte": ["running_total", "two_group_comparison", "ranking_with_ties", "deduplicate_rows"],
    "recursive_cte": ["self_comparison"],
    "case_when": ["bucket_with_case", "two_group_comparison", "pivot_aggregation"],
    "pivot": ["pivot_aggregation"],
    # Data operations
    "date_functions": ["time_bucket", "date_math_gap"],
    "string_functions": ["string_match", "string_clean"],
    "regex": ["string_match", "validate_records"],
    "null_handling": ["null_or_missing_field", "anti_join_missing"],
    "json_functions": ["json_extract"],
    "array_functions": ["array_collect"],
    # Data cleaning
    "deduplication": ["deduplicate_rows"],
    "type_casting": ["type_cast_filter"],
    "data_validation": ["validate_records"],
    "standardization": ["string_clean"],
}


# Tokens we never want to count as "overused" — they're SQL/output words, not topic words.
_STOPWORDS = {
    "the", "a", "an", "of", "for", "each", "in", "on", "to", "by", "and", "or",
    "with", "their", "show", "list", "find", "count", "return", "what", "is",
    "how", "many", "are", "from", "that", "this", "these", "those", "as", "be",
    "do", "did", "have", "has", "had", "call", "it", "id", "name", "names",
    "total", "amount", "number", "all", "any", "no", "not", "into", "out",
    "over", "per", "than", "more", "less", "least", "most", "across", "along",
    "between", "based", "only", "which", "who", "where", "when",
    "sorted", "ordered", "descending", "ascending", "desc", "asc",
}


def _overused_tokens(recent_questions: list[str], threshold: int = 3) -> list[str]:
    """Return content words that appear in `threshold` or more recent questions.
    These get banned in the next generation to force topic variety."""
    if not recent_questions:
        return []
    counts: dict[str, int] = {}
    for q in recent_questions[:8]:
        seen: set[str] = set()
        for w in re.findall(r"[a-zA-Z_]+", q.lower()):
            if len(w) <= 2 or w in _STOPWORDS:
                continue
            if w in seen:
                continue
            seen.add(w)
            counts[w] = counts.get(w, 0) + 1
    return sorted([w for w, c in counts.items() if c >= threshold])[:12]


def _pick_shape(rng: random.Random, concept_hint: str | None, difficulty_hint: str | None, recent_shapes: list[str]) -> tuple[str, str]:
    """Pick a question shape, biased away from recently used ones, and constrained by
    concept_hint and difficulty_hint if provided."""
    candidates: set[str] = {sid for sid, _ in QUESTION_SHAPES}
    if difficulty_hint in SHAPES_BY_DIFFICULTY:
        candidates &= set(SHAPES_BY_DIFFICULTY[difficulty_hint])
    if concept_hint in SHAPES_BY_CONCEPT:
        candidates &= set(SHAPES_BY_CONCEPT[concept_hint])
    if not candidates:
        # Constraints conflicted — fall back to concept-only, then anything.
        candidates = set(SHAPES_BY_CONCEPT.get(concept_hint or "", []))
        if not candidates:
            candidates = {sid for sid, _ in QUESTION_SHAPES}

    fresh = [c for c in candidates if c not in recent_shapes[-4:]] or list(candidates)
    pick = rng.choice(fresh)
    desc = next(d for sid, d in QUESTION_SHAPES if sid == pick)
    return pick, desc

# Regex patterns that must appear in reference_sql when a concept_hint is set.
# Each value is a (description, list-of-regex-any-of) tuple.
_CONCEPT_PATTERNS: dict[str, tuple[str, list[str]]] = {
    # Query patterns
    "joins": ("an INNER JOIN", [r"\bJOIN\b"]),
    "left_joins": ("LEFT JOIN + IS NULL or COALESCE", [r"\bLEFT\s+JOIN\b.+\b(IS\s+NULL|COALESCE)\b"]),
    "self_joins": ("the same table aliased twice", [r"\b(\w+)\b\s+(?:AS\s+)?(\w+)[\s,].+\1\s+(?:AS\s+)?(\w+)"]),
    "full_joins": ("FULL OUTER JOIN", [r"\bFULL\s+(OUTER\s+)?JOIN\b"]),
    "lateral_joins": ("a LATERAL join (JOIN LATERAL or CROSS JOIN LATERAL)", [r"\bLATERAL\b"]),
    "subqueries": ("a subquery in SELECT/WHERE/FROM", [r"\bSELECT\b[\s\S]*\(\s*SELECT\b", r"\bFROM\s*\(\s*SELECT\b", r"\bEXISTS\s*\(\s*SELECT\b", r"\bIN\s*\(\s*SELECT\b"]),
    "correlated_subqueries": ("a CORRELATED subquery (inner SELECT references an outer table alias)", []),  # checked via Python helper
    "exists": ("EXISTS or NOT EXISTS subquery", [r"\b(NOT\s+)?EXISTS\s*\(\s*SELECT\b"]),
    "set_operations": ("UNION / INTERSECT / EXCEPT", [r"\b(UNION(\s+ALL)?|INTERSECT|EXCEPT)\b"]),
    # Aggregation
    "aggregations": ("an aggregate function", [r"\b(COUNT|SUM|AVG|MIN|MAX)\s*\("]),
    "distinct": ("SELECT DISTINCT or COUNT(DISTINCT ...)", [r"\bSELECT\s+DISTINCT\b", r"\b(COUNT|SUM|AVG|MIN|MAX|STRING_AGG|ARRAY_AGG)\s*\(\s*DISTINCT\b"]),
    "group_by": ("GROUP BY + an aggregate", [r"\bGROUP\s+BY\b.+\b(COUNT|SUM|AVG|MIN|MAX)\s*\("]),
    "having": ("HAVING after GROUP BY", [r"\bHAVING\b"]),
    "filter_clause": ("aggregate FILTER (WHERE ...) clause", [r"\bFILTER\s*\(\s*WHERE\b"]),
    "grouping_sets": ("GROUPING SETS / ROLLUP / CUBE", [r"\b(GROUPING\s+SETS|ROLLUP|CUBE)\b"]),
    # Advanced
    "window_functions": ("a window function (OVER (...))", [r"\bOVER\s*\("]),
    "cte": ("a CTE (WITH ... AS)", [r"\bWITH\b\s+\w+\s+AS\s*\("]),
    "recursive_cte": ("a recursive CTE (WITH RECURSIVE ... UNION ALL ...)", [r"\bWITH\s+RECURSIVE\b"]),
    "case_when": ("CASE WHEN", [r"\bCASE\s+WHEN\b"]),
    "pivot": ("pivot-style conditional aggregation: SUM/COUNT(CASE WHEN ...) or aggregate FILTER (WHERE ...)", [r"\b(SUM|COUNT|AVG|MIN|MAX)\s*\(\s*CASE\s+WHEN\b", r"\b\w+\s*\([^)]*\)\s*FILTER\s*\(\s*WHERE\b"]),
    # Data operations
    "date_functions": ("a date function", [r"\b(DATE_TRUNC|EXTRACT|AGE|INTERVAL|TO_CHAR|TO_DATE|DATE_PART)\b", r"\b\w+\s*-\s*\w+\s*::\s*DATE\b"]),
    "string_functions": ("a string function", [r"\b(LOWER|UPPER|SUBSTRING|SUBSTR|SPLIT_PART|POSITION|TRIM|LENGTH|CONCAT)\s*\(", r"\b(I?LIKE)\b"]),
    "regex": ("a regex operator (~ / ~* / !~ / REGEXP_MATCHES / REGEXP_REPLACE)", [r"\s(~\*?|!~\*?)\s+", r"\b(REGEXP_MATCHES|REGEXP_REPLACE|REGEXP_COUNT|SIMILAR\s+TO)\b"]),
    "null_handling": ("IS NULL / COALESCE / NULLIF", [r"\bIS\s+(NOT\s+)?NULL\b", r"\bCOALESCE\s*\(", r"\bNULLIF\s*\("]),
    "json_functions": ("JSON operators (-> ->> #>>) or jsonb_* functions", [r"->>?", r"#>>?", r"\bJSONB?_\w+\s*\(", r"\bTO_JSON(B)?\s*\(", r"::JSONB?\b"]),
    "array_functions": ("ARRAY_AGG / UNNEST / array operators", [r"\b(ARRAY_AGG|UNNEST|ARRAY_LENGTH|ARRAY_POSITION|ARRAY_REMOVE|CARDINALITY)\s*\(", r"\bARRAY\s*\[", r"=\s*ANY\s*\(", r"=\s*ALL\s*\("]),
    # Data cleaning
    "deduplication": ("deduplication: SELECT DISTINCT, or ROW_NUMBER() OVER (PARTITION BY ...) WHERE rn = 1", [r"\bSELECT\s+DISTINCT\b", r"\bROW_NUMBER\s*\(\s*\)\s*OVER\s*\(\s*PARTITION\s+BY\b"]),
    "type_casting": ("explicit type cast (CAST(...) or ::type)", [r"\bCAST\s*\(", r"::(?:INTEGER|BIGINT|INT|TEXT|DATE|TIMESTAMP|NUMERIC|VARCHAR|BOOLEAN|FLOAT|DECIMAL|JSONB?|UUID|REAL|DOUBLE\s+PRECISION|TIME)\b"]),
    "data_validation": ("a filter that finds INVALID / BAD / inconsistent rows (regex mismatch, NOT IN, out-of-range, missing required field)", [r"\b(NOT\s+IN|NOT\s+LIKE|NOT\s+SIMILAR\s+TO|!~\*?)\b", r"\bIS\s+NULL\b", r"<>|!="]),
    "standardization": ("string normalization (TRIM / LOWER / UPPER / REPLACE / INITCAP)", [r"\b(TRIM|LTRIM|RTRIM|BTRIM|LOWER|UPPER|REPLACE|INITCAP)\s*\("]),
}


def _extract_subquery_bodies(s: str) -> list[str]:
    """Find all `(SELECT ... )` blocks honouring balanced parentheses. Returns
    just the content between the outer parens for each subquery."""
    out: list[str] = []
    i = 0
    while i < len(s):
        if s[i] == "(":
            j = i + 1
            while j < len(s) and s[j].isspace():
                j += 1
            if s[j : j + 6].upper() == "SELECT" and (j + 6 >= len(s) or not (s[j + 6].isalnum() or s[j + 6] == "_")):
                depth = 1
                k = i + 1
                while k < len(s) and depth > 0:
                    if s[k] == "(":
                        depth += 1
                    elif s[k] == ")":
                        depth -= 1
                    k += 1
                if depth == 0:
                    out.append(s[i + 1 : k - 1])
                    i = k
                    continue
        i += 1
    return out


def _has_correlated_subquery(sql: str) -> bool:
    """Detect whether any subquery references a table alias from the OUTER query —
    the canonical signature of a correlated subquery."""
    s = _strip_sql_comments(sql)

    def aliases_in(scope: str) -> set[str]:
        out: set[str] = set()
        for m in re.finditer(
            r"\b(?:FROM|JOIN)\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?",
            scope,
            re.IGNORECASE,
        ):
            out.add(m.group(1).lower())
            second = m.group(2)
            if second and second.lower() not in {
                "on", "where", "group", "order", "limit", "having",
                "inner", "left", "right", "full", "cross", "join", "using", "lateral",
            }:
                out.add(second.lower())
        return out

    outer = aliases_in(s)
    if not outer:
        return False

    for body in _extract_subquery_bodies(s):
        own = aliases_in(body)
        for ref in re.finditer(r"\b(\w+)\.\w+", body):
            t = ref.group(1).lower()
            if t in outer and t not in own:
                return True
    return False


_CUSTOM_CONCEPT_CHECKS: dict[str, Any] = {
    "correlated_subqueries": _has_correlated_subquery,
}


def _concept_visible(concept: str, sql: str) -> bool:
    custom = _CUSTOM_CONCEPT_CHECKS.get(concept)
    if custom is not None:
        return bool(custom(sql))
    if concept not in _CONCEPT_PATTERNS:
        return True
    patterns = _CONCEPT_PATTERNS[concept][1]
    if not patterns:
        return True
    sql_clean = _strip_sql_comments(sql)
    return any(re.search(p, sql_clean, re.IGNORECASE | re.DOTALL) for p in patterns)


def _strip_sql_comments(sql: str) -> str:
    s = re.sub(r"--[^\n]*", "", sql)
    s = re.sub(r"/\*[\s\S]*?\*/", "", s)
    return s


# Banned phrasings — substring or regex matches in question text trigger rejection.
_BANNED_PATTERNS: list[tuple[str, str]] = [
    (r"\bid\s+\d+\b", "references a specific primary key id"),
    (r"\bwith\s+id\s+\d+\b", "references a specific primary key id"),
    (r"\bfor\s+example\b", "uses 'for example' (question must stand alone)"),
    (r"\bas\s+an?\s+example\b", "uses 'as an example' (question must stand alone)"),
    (r"\be\.?g\.?\s", "uses e.g. (question must stand alone)"),
    (r"\busing\s+a\s+(window\s+function|cte|subquery|self[- ]join|having\s+clause)\b", "tells learner which SQL construct to use"),
    (r"\buse\s+a\s+(window\s+function|cte|subquery|self[- ]join|group\s+by|having)\b", "tells learner which SQL construct to use"),
    (r"\bwith\s+group\s+by\b", "tells learner to use GROUP BY"),
    (r"\bjoin\s+the\s+tables?\b", "tells learner to JOIN"),
    (r"\bincluding\s+\w+\s+with\s+at\s+least\s+1\b", "vacuous condition (at least 1 always holds)"),
    (r"\bthat\s+have\s+occurred\b", "tautology — every row has 'occurred'"),
    (r"\bthat\s+exist\b\s*\.", "tautology — every row exists"),
]


def find_banned_phrasings(question: str) -> list[str]:
    out: list[str] = []
    for pattern, desc in _BANNED_PATTERNS:
        if re.search(pattern, question, re.IGNORECASE):
            out.append(desc)
    return out


def find_unstated_literals(question: str, sql: str) -> list[str]:
    """Return a list of literals (numbers, quoted strings, INTERVAL spans) that appear in the
    reference_sql's CASE/WHERE/HAVING clauses but are NOT mentioned in the question text.
    These are 'hidden thresholds' that make a question unanswerable.

    We focus on:
      - numeric comparisons (> 1000, <= 90, BETWEEN 500 AND 1000, = 5)
      - string equality / IN ('Sweden', 'France')
      - INTERVAL spans ('30 days', '1 year')

    Aliases, schema column names, and CASE *output labels* (like 'High'/'Medium'/'Low') are NOT
    flagged because the question already names the alias and bucket labels.
    """
    s = _strip_sql_comments(sql)

    # Carve out clauses that hardcode comparison values.
    # Grab everything after CASE / WHERE / HAVING (case-insensitive).
    clauses: list[str] = []
    for kw in ("CASE", "WHERE", "HAVING"):
        for m in re.finditer(rf"\b{kw}\b", s, re.IGNORECASE):
            # Take the next ~200 chars to scan
            clauses.append(s[m.start(): m.start() + 240])
    blob = " ".join(clauses)
    if not blob:
        return []

    # Collect candidate literals from the CASE/WHERE/HAVING regions.
    # Numbers immediately following a comparison op or BETWEEN/AND.
    numeric_literals: set[str] = set()
    for m in re.finditer(r"(?:>=|<=|>|<|=|<>|!=|\bBETWEEN\b|\bAND\b|\bIN\s*\(\s*)\s*(-?\d+(?:\.\d+)?)", blob, re.IGNORECASE):
        numeric_literals.add(m.group(1))

    # Quoted string literals.
    string_literals: set[str] = set(re.findall(r"'([^']{1,40})'", blob))

    # INTERVAL '30 days' style.
    interval_literals: set[str] = set()
    for m in re.finditer(r"INTERVAL\s+'([^']+)'", s, re.IGNORECASE):
        interval_literals.add(m.group(1))

    q_lower = question.lower()
    q_norm = re.sub(r"[,]", " ", q_lower)

    # CASE output labels — pull anything in `CASE WHEN ... THEN 'X'` to ignore those strings.
    case_output_labels: set[str] = set()
    for m in re.finditer(r"\bTHEN\s+'([^']+)'", s, re.IGNORECASE):
        case_output_labels.add(m.group(1).lower())
    for m in re.finditer(r"\bELSE\s+'([^']+)'", s, re.IGNORECASE):
        case_output_labels.add(m.group(1).lower())

    missing: list[str] = []

    for num in numeric_literals:
        # Allow tiny constants (0, 1, 2) — they often appear as DENSE_RANK seeds or 1-based offsets.
        try:
            f = float(num)
            if -2 <= f <= 2:
                continue
        except ValueError:
            continue
        if num in q_norm:
            continue
        # Allow if the absolute value (without a leading "+") appears
        if num.lstrip("+") in q_norm:
            continue
        missing.append(num)

    for s_lit in string_literals:
        sl = s_lit.lower()
        if sl in case_output_labels:
            continue
        if not sl.strip():
            continue
        if sl in q_norm:
            continue
        missing.append(f"'{s_lit}'")

    for iv in interval_literals:
        # interval like "30 days" or "1 year"
        parts = iv.lower().split()
        if all(p in q_norm for p in parts):
            continue
        missing.append(f"INTERVAL '{iv}'")

    return missing


def classify_difficulty(sql: str) -> str:
    """Bucket reference SQL into easy / medium / hard based on observable structure.

    - hard: window function, CTE, self-join, correlated subquery, or 4+ tables joined.
    - easy: a single table, no JOIN, no GROUP BY, no CASE, no UNION, no subquery.
    - medium: everything in between.
    """
    s = _strip_sql_comments(sql)

    # HARD signals
    if re.search(r"\bOVER\s*\(", s, re.IGNORECASE):
        return "hard"
    if re.search(r"\bWITH\b\s+\w+\s+AS\s*\(", s, re.IGNORECASE):
        return "hard"
    # Self-join: same table name listed twice in FROM/JOIN list
    tables_in_from = re.findall(r"\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)", s, re.IGNORECASE)
    if len(tables_in_from) - len(set(t.lower() for t in tables_in_from)) >= 1:
        return "hard"
    # Correlated subquery — a subquery in WHERE/SELECT (heuristic: SELECT ... SELECT)
    subq_count = len(re.findall(r"\(\s*SELECT\b", s, re.IGNORECASE))
    if subq_count >= 1 and (re.search(r"\bEXISTS\s*\(\s*SELECT", s, re.IGNORECASE) or re.search(r"\b(IN|=|>|<|>=|<=)\s*\(\s*SELECT", s, re.IGNORECASE)):
        return "hard"
    if len(tables_in_from) >= 4:
        return "hard"

    # EASY signals (must have NONE of the medium markers)
    has_join = bool(re.search(r"\bJOIN\b", s, re.IGNORECASE))
    has_group_by = bool(re.search(r"\bGROUP\s+BY\b", s, re.IGNORECASE))
    has_case = bool(re.search(r"\bCASE\s+WHEN\b", s, re.IGNORECASE))
    has_having = bool(re.search(r"\bHAVING\b", s, re.IGNORECASE))
    has_union = bool(re.search(r"\b(UNION|INTERSECT|EXCEPT)\b", s, re.IGNORECASE))
    has_subquery = subq_count >= 1

    medium_markers = has_join or has_group_by or has_case or has_having or has_union or has_subquery
    if not medium_markers:
        return "easy"

    return "medium"

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


CONCEPT_PLAYBOOK = """Concept playbook — when a concept_hint is given, the reference_sql MUST visibly use it:
- joins: at least one INNER JOIN combining two tables that are actually related by FK; question must require columns from BOTH tables.
- left_joins: a LEFT JOIN where the right side may legitimately be missing (the question asks about "people with no X", "items never used", etc.). Include IS NULL in the WHERE or COALESCE in the SELECT.
- self_joins: same table aliased twice (employees + manager, products + substitute, parent/child rows).
- aggregations: COUNT/SUM/AVG/MIN/MAX over a non-trivial set. NOT a simple SELECT COUNT(*) FROM one_table.
- group_by: GROUP BY at least one column, with an aggregate per group; the question must name "per X" or "for each X".
- having: GROUP BY + HAVING that filters on the aggregate (not just WHERE). The question must include a threshold like "with more than", "fewer than", "averaging at least".
- window_functions: OVER (...) clause with PARTITION BY and/or ORDER BY. RANK / DENSE_RANK / ROW_NUMBER / LAG / LEAD / running totals. The question must require a per-row comparison or ranking, not just an aggregate.
- cte: WITH ... AS (...) at the top, then referenced. The CTE must be load-bearing, not decorative.
- recursive_cte: WITH RECURSIVE name AS (anchor UNION ALL recursive_step) — for hierarchies (parent/child traversal), generated sequences, or graph-walk problems. Anchor must reference a self-FK column (e.g. manager_id, parent_id) or a date series.
- subqueries: scalar subquery in SELECT/WHERE, or a derived table in FROM. The question must require comparing to an aggregate or an "is X in Y" check.
- case_when: CASE WHEN ... THEN ... in the SELECT or in an aggregate. Use it to bucket values or to compute conditional sums.
- date_functions: DATE_TRUNC, EXTRACT, AGE, INTERVAL, or date arithmetic. The question must ask about time buckets, ages, gaps, or "within N days".
- string_functions: LOWER / UPPER / SPLIT_PART / SUBSTRING / LIKE / ILIKE / POSITION. The question must require manipulating or matching strings non-trivially.
- regex: Postgres regex operators (~, ~*, !~, !~*) or REGEXP_MATCHES / REGEXP_REPLACE / SIMILAR TO. The question must require pattern matching that plain LIKE can't express (alternation, anchors, character classes, repetition).
- null_handling: IS NULL / IS NOT NULL / COALESCE / NULLIF. The question must hinge on missing data.
- set_operations: UNION / UNION ALL / INTERSECT / EXCEPT. The question must combine or compare two row sets.
- full_joins: FULL OUTER JOIN. The question must require rows from BOTH sides even when one side has no match (e.g. "show every X and every Y, marking which are paired").
- lateral_joins: JOIN LATERAL or CROSS JOIN LATERAL — when the right side depends on the left side. Classic use case: "top 3 per group" where the lateral subselect returns rows per outer row.
- correlated_subqueries: a subquery in WHERE / SELECT / HAVING that references a column from the OUTER query (e.g. `WHERE EXISTS (SELECT 1 FROM child c WHERE c.parent_id = outer.id)`). The inner SELECT must use an outer-scope alias.
- exists: `EXISTS (SELECT ... WHERE ...)` or `NOT EXISTS`. Used to check whether ANY matching row exists, without returning the inner row. Often replaces `IN (SELECT ...)`.
- distinct: `SELECT DISTINCT` (unique rows) or `COUNT(DISTINCT col)` (unique-value count). Question must care about UNIQUENESS, not just listing.
- filter_clause: `COUNT(*) FILTER (WHERE condition)` — conditional aggregation in a cleaner form than CASE-inside-aggregate. Often paired with GROUP BY for side-by-side metrics.
- grouping_sets: GROUPING SETS / ROLLUP / CUBE — aggregate at multiple grouping levels in one query (subtotals + grand total). Question must ask for multiple summary levels in one result.
- pivot: conditional aggregation pivoting categories into columns. `SUM(CASE WHEN cat='A' THEN x END) AS a_total, SUM(CASE WHEN cat='B' THEN x END) AS b_total`. One row per anchor, columns are the categories.
- json_functions: `->`, `->>`, `#>>`, `jsonb_path_query`, `jsonb_each`, etc. The schema must have a JSON/JSONB column. The question must require pulling a value from inside JSON.
- array_functions: `ARRAY_AGG`, `UNNEST`, `array @> array`, `= ANY (array_col)`, `CARDINALITY`. The schema must have an array column OR the question must aggregate into an array.
- deduplication: removing duplicate rows. Either `SELECT DISTINCT` (whole-row dedup) or `ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...) ... WHERE rn = 1` (pick one row per group). Question must explicitly say "unique" / "remove duplicates" / "one row per X".
- type_casting: `CAST(col AS TYPE)` or `col::TYPE`. The question must require interpreting a column as a different type (e.g. a TEXT column holding numbers, or extracting a year from a date).
- data_validation: finding rows that VIOLATE an expected pattern — bad emails (regex mismatch), out-of-range numbers, NULL where required, dates in the future, values not in a reference list. Question phrasing must say "invalid", "bad", "anomalous", "incorrect", or describe the rule being violated.
- standardization: cleaning text values into a canonical form. `TRIM`, `LOWER`, `UPPER`, `INITCAP`, `REPLACE`. The question must ask to normalize / clean / standardize a text column.

If concept_hint is missing, pick a concept that fits the schema and difficulty, and still follow the rule above for that concept."""


QUESTION_SYSTEM_PROMPT = """You write SQL practice questions for a learner using PostgreSQL. You are a careful SQL instructor — every question you ship is one a real interviewer or textbook would use.

Return ONLY a JSON object:
{
  "question": "the question text",
  "reference_sql": "a working PostgreSQL query that answers it",
  "ordered_results": true|false,
  "concepts": [list of SQL concepts from the allowed set],
  "difficulty": "easy"|"medium"|"hard"
}

Allowed concepts: ["joins","left_joins","self_joins","full_joins","lateral_joins","subqueries","correlated_subqueries","exists","set_operations","aggregations","distinct","group_by","having","filter_clause","grouping_sets","window_functions","cte","recursive_cte","case_when","pivot","date_functions","string_functions","regex","null_handling","json_functions","array_functions","deduplication","type_casting","data_validation","standardization"].

""" + CONCEPT_PLAYBOOK + """

Difficulty contract (STRICT):
- easy: 1 table, simple WHERE / ORDER BY / single aggregate. No JOIN. ~2-5 tokens of logic beyond SELECT.
- medium: 2-3 tables joined, OR 1 table with GROUP BY + HAVING, OR meaningful date/string manipulation. No CTEs, no window functions.
- hard: window function OR CTE OR correlated subquery OR self-join OR a multi-step calculation that genuinely needs one of those. The reference_sql must visibly contain the construct ("OVER (", "WITH ", "EXISTS (", "alias_a JOIN same_table alias_b").

QUESTION wording:
- Direct, conversational, like a peer asking a peer. ONE or TWO sentences (a third sentence is OK ONLY when you must specify thresholds — see below).
- Start with a real verb: "Find...", "Show...", "List...", "Count...", "For each <thing>, ...", "Which <noun>...", "How many...", "What is the...", "Return...".
- NO stakeholder framing ("the marketing team wants", "finance needs", "we're prepping for the QBR"). Cut all of it.
- Name the EXACT output columns the learner must return, in order. If a column is computed, give it a clear alias hint ("call it total_revenue").
- If sort matters, state it ("sorted by X descending"). If sort doesn't matter, set ordered_results=false.
- Never say "top N" without naming the metric. Never say "best" / "popular" without defining it.
- The question must be unambiguous: a careful reader should produce exactly the reference_sql's output, not "something close".

Threshold / bucketing rule (STRICT — no exceptions):
- If the reference_sql uses CASE WHEN to bucket a numeric value, the question MUST spell out the exact thresholds. Bad: "categorize sales as High/Medium/Low". Good: "categorize sales as 'High' (>= 1000), 'Medium' (500-999), or 'Low' (< 500)".
- Same rule for date buckets ("recent" → define it: "within the last 90 days"), for ranking thresholds ("top sellers" → "with total sales of at least $1000"), and for any boundary the SQL hardcodes.
- Any numeric literal that appears in CASE WHEN / WHERE / HAVING of the reference_sql MUST be quoted in the question text, OR the question must paraphrase that boundary precisely (e.g. "more than 5" matches `> 5`).
- For string filters (`WHERE country = 'Sweden'`), the question must name that exact value ("for customers in Sweden").

Banned phrasings (NEVER include these):
- Specific primary key ids: "use festival id 2", "for customer with id 5", "the order with id 123". Questions must generalize across all rows — never anchor to a single PK value. Use a NAME or a CATEGORY instead.
- "as an example", "for example", "such as id 5", "e.g. id 2" — never use these. The question must stand alone.
- Vacuous filters: "including locations with at least 1 festival" (every location with festivals has ≥ 1). Don't add a condition that filters nothing.
- Tautologies: "festivals that have occurred" when every festival row IS an occurrence. Don't add words that don't filter.
- Hints about how to write the SQL: "using a window function", "use a CTE", "join the tables", "with GROUP BY". The learner is supposed to figure out the technique. The QUESTION describes WHAT to return, not HOW.

Variety controls (HARD — these are not suggestions):
- The user payload contains `REQUIRED_SHAPE` with an id and a description. Your reference_sql MUST match that shape's structure. If it says "anti-join / missing data", you must write a LEFT JOIN ... IS NULL or NOT EXISTS query. If it says "time-bucketed count", you must DATE_TRUNC and group by the bucket. Do NOT pick a different shape.
- The payload contains `REQUIRED_ANCHOR_TABLE`. Your reference_sql MUST anchor on (FROM) that table. If it's null, pick whichever table best fits the shape.
- The payload contains `FORBIDDEN_TOKENS`: a list of content words that appeared too often in recent questions. Your question text MUST NOT contain ANY of those words (other than as part of a quoted threshold). If `sales` is forbidden, do not write about sales — pick a different column or angle.
- Your output MUST also differ from `recent_questions` in: (a) opening verb, (b) anchor table, (c) output column set.

Reference SQL rules:
- MUST run on the given schema without error. Use only columns that exist (check the schema tables/columns list before writing).
- MUST visibly use the requested concept_hint per the Concept playbook above.
- MUST return at least one row on the sample data (the system will verify this and reject queries that return zero rows).
- Use clear aliases (c for customers, o for orders) when joining. Snake_case for any new aliases you define.
- Round money/percentages reasonably (ROUND(x, 2)).
- Mentally execute the SQL on the sample rows before returning.

Self-check before returning:
1. Does the question name every output column?
2. Does reference_sql produce exactly those columns in that order?
3. If concept_hint is set, does reference_sql visibly use it per the playbook?
4. Does the difficulty field match the actual complexity of reference_sql?
5. Is the question different from all recent_questions in verb, anchor table, AND output shape?"""


EXPLAIN_SYSTEM_PROMPT = """You are a kind, direct SQL tutor. The learner got a question wrong. You will receive: the question, their SQL, the reference SQL, their output (or an error message), and the expected output.

Return JSON with two fields:
- typo_corrections: array of {wrong: "...", right: "..."} for any obvious typos in their SQL (e.g. "slect" → "SELECT"). Empty array if none.
- explanation: 3-5 sentences in plain English. First, describe what their query actually does. Then explain why it produces the wrong result. End with ONE concrete hint toward the fix. Do NOT reveal the full reference SQL. Use simple language. No filler."""


HINT_SYSTEM_PROMPT = """You are a SQL tutor. The learner has a question they are about to answer, and they want a HINT to point them in the right direction. They have NOT yet attempted the query (or have only partial code).

You will receive: the question, the table schema, the reference SQL, and optionally the learner's current code.

Return ONLY JSON:
{
  "hint": "1-3 short sentences. Plain English.",
  "suggested_sql": null | "the learner's SQL with a SMALL targeted fix applied"
}

Rules for the HINT (strict):
- Mention WHICH tables to use.
- Mention WHICH SQL concepts apply (JOIN, GROUP BY, COUNT, etc.). Briefly explain any term the first time you use it.
- Mention WHICH columns to filter or group on, BUT never write more than one or two-word fragments of SQL.
- DO NOT write the full SQL or anything close to it. No full SELECT/FROM/WHERE clauses.
- DO NOT just restate the question.
- If the learner's current code is provided, gently point out a missing piece (e.g. "you have the SELECT but still need a WHERE clause that..."). Do not solve it for them.
- Keep it short. 1-3 sentences max.

Rules for SUGGESTED_SQL (very strict — default to null):
- Provide a corrected version of the learner's SQL ONLY when ALL of the following are true:
  1. The learner has already written most of the SQL — they're not blank or only have a comment.
  2. The fix is SMALL and TARGETED (a few characters or a single token), not a structural rewrite.
  3. The fix is mechanical / technical, NOT strategic. Good: quoting a bare string ('Sweden' instead of Sweden), fixing a typo (slect → SELECT), adding a missing comma, fixing an unbalanced paren, correcting a column-name typo to one that exists in the schema. Bad: adding a missing JOIN, adding a missing GROUP BY, changing the aggregation function, adding a HAVING clause — these would give the answer away.
  4. After applying the fix the SQL should be valid Postgres and closer to the reference logic, but it does NOT have to be the full correct answer.
- If the learner's SQL is empty, vague, or has multiple structural problems, return null.
- The suggested_sql, when provided, must be the FULL corrected SQL (not a diff or fragment), preserving the learner's original variable names, aliases, formatting, and comments wherever possible — change only what needs to change."""


ERROR_HELP_SYSTEM_PROMPT = """You translate PostgreSQL errors for a SQL learner.

Return ONLY JSON:
{
  "explanation": "1-2 short plain-English sentences explaining the raw error.",
  "next_step": "one concrete next step using the provided schema",
  "suggested_sql": null | "the learner's SQL with the small fix that resolves this error"
}

Rules:
- Keep the raw Postgres error out of your answer; the UI already shows it.
- Mention nearby valid table or column names when helpful.
- Do not reveal the full reference SQL.

Rules for SUGGESTED_SQL (strict — default to null):
- Provide a corrected SQL ONLY when the fix is small and targeted, e.g.:
  · Quoting a bare string literal that was parsed as a column name
  · Fixing a misspelled column name to one that exists in the schema
  · Replacing an unknown table name with a real one when the intent is clear
  · Adding a missing closing paren or comma
  · Fixing an obvious typo of a SQL keyword
- DO NOT provide a corrected SQL if the fix requires structural changes (adding a JOIN, a GROUP BY, an aggregation, changing semantics).
- When provided, suggested_sql must be the FULL corrected SQL, preserving everything else the learner wrote (formatting, aliases, comments)."""


PERFORMANCE_SYSTEM_PROMPT = """You are a PostgreSQL performance coach for a SQL learner.

You will receive the question, schema, the learner SQL, the reference SQL, and EXPLAIN ANALYZE JSON for the learner query. You may also receive timing for the reference query.

Return ONLY JSON:
{
  "summary": "1-2 short sentences explaining whether the query shape is efficient.",
  "suggestions": ["2-4 concrete optimization lessons, beginner friendly"],
  "optimized_sql": "a cleaner or faster PostgreSQL query, or null if their query is already fine"
}

Rules:
- Keep it practical: avoid vague advice like 'add indexes' unless the plan clearly points to it.
- Prefer query-shape improvements: filter earlier, aggregate after joins when useful, avoid unnecessary subqueries, select only needed columns.
- If the reference SQL is a better teaching answer, you may use it as optimized_sql.
- Do not shame the learner. Explain why the faster shape helps."""


EXPLAIN_SOLUTION_SYSTEM_PROMPT = """You teach a beginner HOW TO THINK about a SQL question — parsing the English, planning the query, then writing it. Assume they know what a spreadsheet is but have NEVER written SQL.

You receive: the question, the reference SQL that solves it, and the table schema.

Return ONLY JSON:
{
  "summary": "ONE short sentence saying what we're trying to find. No SQL terms.",
  "breakdown": [
    {
      "phrase": "short phrase copied VERBATIM from the question (e.g. \"for each food truck\")",
      "means": "what that phrase tells us about the SQL — which clause, which column, which operation, in plain English"
    }
  ],
  "approach": "2-4 short sentences explaining the OVERALL plan, like you're at a whiteboard. Which tables we start from. What needs joining. What needs grouping. What needs filtering. Mention SQL terms once but in plain words.",
  "steps": [
    {
      "title": "5-8 words. Plain English. No SQL keywords.",
      "what_it_does": "1-2 short sentences. Plain English. Mention which tables we touch.",
      "sql_snippet": "the smallest piece of the reference SQL for this step, copied VERBATIM",
      "how_postgres_reads_it": "1-2 short sentences. What does the database actually do here?"
    }
  ],
  "final_thought": "ONE short sentence tying it together."
}

WRITING RULES (strict):
- BREAKDOWN: split the question into 3-6 chunks. Each `phrase` MUST be a literal substring of the question (don't paraphrase). Each `means` is one short sentence explaining what SQL operation that phrase implies. Examples:
  · "for each food truck" → "we want one row per food truck — that means GROUP BY food_truck"
  · "with more than 5 reviews" → "filter the groups, keeping only those whose count is over 5 — that's HAVING"
  · "sorted by total sales descending" → "ORDER BY the total_sales column from highest to lowest"
  · "Return name and count" → "the SELECT clause has exactly two output columns: name and the count"
- APPROACH: walk through the PLAN, not the SQL. Like: "We have customers and orders. We need to count orders per customer, so we group by customer. Then we filter to only those over 5 with HAVING."
- STEPS: walk through the SQL in Postgres execution order (FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT). 3-5 steps.
- 5th-grade vocabulary. Short sentences. Active voice.
- The FIRST time you mention any SQL term (SELECT, JOIN, GROUP BY, HAVING, etc.) in ANY field, explain it once in parentheses. Don't keep re-defining it.
- Each sql_snippet MUST appear verbatim somewhere in the reference SQL.
- titles do NOT start with "Step N:" — the UI numbers them.
- NO filler. NO restating the question. NO "as you can see"."""


SCHEMA_SYSTEM_PROMPT = """You design realistic PostgreSQL practice databases. Each schema you ship is a self-contained learning playground that supports interesting questions across many SQL concepts.

Return ONLY a JSON object with this shape:
{
  "id": "short_snake_case_id",
  "label": "Human-friendly label (3-5 words)",
  "domain": "one short sentence describing the domain",
  "tables": [
    {
      "name": "snake_case_plural",
      "row_count": <int 50..2000>,
      "columns": [
        {"name": "id", "type": "SERIAL PRIMARY KEY"},
        {
          "name": "column_name",
          "type": "<PG type — see allowed list>",
          "nullable": true|false,
          "primary_key": false,
          "foreign_key": null | "other_table.id",
          "nullable_rate": 0.0..0.3,
          "gen": <recipe>
        }
      ]
    }
  ],
  "indexes": [["table_name", "column_name"], ...],
  "post_setup_sql": ["optional list of UPDATE statements run after inserts for derived columns"]
}

Allowed PG types: SERIAL PRIMARY KEY, INTEGER, BIGINT, TEXT, VARCHAR(N), BOOLEAN, DATE, TIMESTAMP, NUMERIC(P,S).

Recipe forms (the `gen` field):
- {"kind": "faker", "method": "name|first_name|last_name|email|user_name|city|country|company|street_address|phone_number|sentence|word|domain_word"}
- {"kind": "choice", "values": [v1, v2, ...]}
- {"kind": "weighted_choice", "values": [v1, ...], "weights": [w1, ...]}  (weights need not sum to 1)
- {"kind": "int_range", "min": <int>, "max": <int>}
- {"kind": "decimal_range", "min": <float>, "max": <float>, "digits": 2}
- {"kind": "date_range", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD"}
- {"kind": "date_after_col", "column": "<other column on the same row>", "min_days": <int>, "max_days": <int>}
- {"kind": "fk", "references": "other_table.id"}  (samples a random already-inserted parent id)
- {"kind": "self_fk", "references": "this_table.id", "null_rate": 0.0..1.0}  (for self-references like manager_id; ~30% nullable_rate typical)
- {"kind": "template", "format": "{a}.{b}@example.com", "parts": {"a": <recipe>, "b": <recipe>}}
- {"kind": "constant", "value": ...}
- {"kind": "row_index"}  (1-based row counter within this table — useful for code-like IDs)
- {"kind": "bool", "true_rate": 0.0..1.0}

Hard rules — every schema MUST satisfy:
1. 4 to 7 tables. Each table 1..2000 rows. Total inserted rows < 15000.
2. Every non-`id` column has a `gen` recipe. The `id` column (SERIAL PRIMARY KEY) has no gen.
3. Tables are listed in dependency order: a child table with an FK to T appears AFTER T.
4. At least 3 foreign-key columns total. At least one table with TWO FKs (to enable join-of-joins).
5. Include at least one DATE or TIMESTAMP column on a fact-style table so date_functions questions work.
6. Include at least one nullable column with nullable_rate > 0 so null_handling questions work.
7. Include at least one column whose value comes from a `choice` or `weighted_choice` of 3-8 categorical values (so group_by feels natural).
8. The schema must enable questions across: joins, aggregations, group_by, window_functions, date_functions, null_handling. (Not all in one query — just possible.)
9. Use snake_case_plural for table names. snake_case for column names. Don't shadow Postgres reserved words.
10. AVOID these overused domains: e-commerce / customers+orders, library/loans, movies/ratings, social network posts, generic users/products. Pick something specific and fresh.

Domain ideas (NOT exhaustive — invent your own): community garden plots, urgent care visits, esports tournaments, food-truck festivals, podcast network episodes, kindergarten enrollments, dog daycare check-ins, vinyl record store inventory, surf school lessons, observatory telescope bookings, conference talks + speakers, recycling depot pickups, bike share trips, escape room sessions, gym class signups, marketplace listings, ski lift passes, drone delivery routes, board game cafe sessions, art gallery exhibits, planetarium shows, urban farm harvests, ham radio contacts, climate monitoring stations, blood donation drives.

Output quality bar:
- Names sound like real columns ("checked_in_at", "lane_number", "harvest_weight_kg"), not "value1" / "data2".
- Choice values are realistic for the domain (not "type_a, type_b").
- Row counts are sensible: parent tables 50-500 rows, fact tables 500-5000.
- Recipes don't conflict (e.g. fk.references must point at a real prior-listed table column).
- The schema, taken together, tells a small story you could explain in one sentence.

You will receive `recent_domains` — domains used recently. DO NOT pick one of those or a near-duplicate."""


async def generate_schema(recent_domains: list[str] | None = None) -> dict[str, Any]:
    """Ask the LLM to design a novel practice schema. Returns the raw recipe dict
    (not yet materialized). Validation is done in data_gen.materialize_schema."""
    client = _get_client()
    payload = {"recent_domains": recent_domains or []}

    last_error = ""
    for attempt in range(3):
        completion = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": SCHEMA_SYSTEM_PROMPT},
                {"role": "user", "content": json.dumps(payload)},
            ],
            response_format={"type": "json_object"},
            temperature=1.0 if attempt == 0 else 0.7,
        )
        raw = completion.choices[0].message.content or "{}"
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            last_error = f"invalid JSON: {e}"
            continue

        required = {"id", "label", "tables"}
        if not required.issubset(data.keys()):
            last_error = f"missing fields: {required - set(data.keys())}"
            continue
        if not isinstance(data["tables"], list) or len(data["tables"]) < 3:
            last_error = "need at least 3 tables"
            continue
        return data

    raise RuntimeError(f"Failed to generate a valid schema after 3 attempts. Last error: {last_error}")


async def generate_question(
    schema_info: dict[str, Any],
    concept_hint: str | None = None,
    difficulty_hint: str | None = None,
    recent_questions: list[str] | None = None,
    recent_shapes: list[str] | None = None,
) -> dict[str, Any]:
    client = _get_client()
    rng = random.Random()

    # Pick a shape mechanically so the model can't default to the same template every call.
    shape_id, shape_desc = _pick_shape(rng, concept_hint, difficulty_hint, recent_shapes or [])

    # Pick an anchor table — rotate away from anchors seen in recent questions.
    tables = schema_info.get("tables") or []
    table_names = [t["name"] for t in tables if t.get("name")]
    recent_anchor_text = " ".join((recent_questions or [])[:5]).lower()
    fresh_anchors = [t for t in table_names if t.lower() not in recent_anchor_text]
    anchor_pool = fresh_anchors or table_names
    anchor_table = rng.choice(anchor_pool) if anchor_pool else None

    # Forbidden tokens: words that appeared in 3+ recent questions get banned for variety.
    forbidden_tokens = _overused_tokens(recent_questions or [])

    user_content_obj: dict[str, Any] = {
        "schema": schema_info,
        "concept_hint": concept_hint,
        "difficulty_hint": difficulty_hint,
        "recent_questions": recent_questions or [],
        "REQUIRED_SHAPE": {"id": shape_id, "description": shape_desc},
        "REQUIRED_ANCHOR_TABLE": anchor_table,
        "FORBIDDEN_TOKENS": forbidden_tokens,
    }
    user_content = json.dumps(user_content_obj, default=str)

    last_error: str = ""
    messages: list[dict[str, str]] = [
        {"role": "system", "content": QUESTION_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
    # Track the best fallback candidate: one that at least RUNS and returns rows.
    # Priority: fewer violations wins. We'll ship it if nothing perfect comes back.
    best_fallback: tuple[int, dict[str, Any]] | None = None

    for attempt in range(5):
        completion = await client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.9 if attempt == 0 else 0.5,
        )
        raw = completion.choices[0].message.content or "{}"
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            last_error = f"LLM returned invalid JSON: {e}"
            messages.append({"role": "user", "content": "Your previous output was not valid JSON. Return ONLY the JSON object."})
            continue

        required = {"question", "reference_sql", "ordered_results", "concepts", "difficulty"}
        if not required.issubset(data.keys()):
            last_error = f"LLM response missing fields: {required - set(data.keys())}"
            continue

        ref_sql = str(data["reference_sql"])
        ok, err, n_rows = await _try_run(ref_sql)
        if not ok:
            last_error = f"Reference SQL failed: {err}"
            messages.append({"role": "assistant", "content": raw})
            messages.append({"role": "user", "content": f"The reference_sql failed against Postgres: {err}. Fix it. Return the full JSON again."})
            continue
        if n_rows == 0:
            last_error = "Reference SQL returned 0 rows"
            messages.append({"role": "assistant", "content": raw})
            messages.append({"role": "user", "content": "The reference_sql returned 0 rows on the actual data. Rewrite the question and SQL so it returns at least one row. Return the full JSON again."})
            continue

        # Collect ALL secondary violations in one pass so we can give a combined correction.
        question_text = str(data["question"])
        violations: list[str] = []
        corrections: list[str] = []

        if concept_hint and not _concept_visible(concept_hint, ref_sql):
            need = _CONCEPT_PATTERNS.get(concept_hint, ("the requested concept", []))[0]
            violations.append(f"concept '{concept_hint}' not visible in SQL")
            corrections.append(
                f"The reference_sql MUST contain {need}. Keep '{concept_hint}' as the load-bearing technique."
            )

        # Wording-quality enforcement: ban specific-id leaks, vacuous conditions, etc.
        banned = find_banned_phrasings(question_text)
        if banned:
            violations.append(f"bad phrasing: {banned}")
            corrections.append(
                f"Your question has these wording problems: {banned}. "
                "Rewrite without any specific primary key id (use names/categories instead), without 'for example' / 'as an example', "
                "without telling the learner which SQL construct to use, and without vacuous filters."
            )

        # Forbidden-token enforcement: question must not contain any banned topic words.
        if forbidden_tokens:
            q_words = set(re.findall(r"[a-zA-Z_]+", question_text.lower()))
            hits = sorted(set(forbidden_tokens) & q_words)
            if hits:
                violations.append(f"used forbidden words: {hits}")
                corrections.append(
                    f"The question contains overused words {hits}. Rewrite using a DIFFERENT angle / column / metric. "
                    "Pick fresh columns from the schema that don't appear in recent questions."
                )

        missing_literals = find_unstated_literals(question_text, ref_sql)
        if missing_literals:
            violations.append(f"unstated literals: {missing_literals}")
            corrections.append(
                f"Your SQL uses {missing_literals} but the question never mentions them. "
                "Either spell out every threshold in the question text (e.g. 'High (>= 1000), Medium (500-999), Low (< 500)'), "
                "OR rewrite the SQL to not hardcode them (use AVG / percentile / the schema directly)."
            )

        actual_difficulty = classify_difficulty(ref_sql)
        if difficulty_hint in ("easy", "medium", "hard") and actual_difficulty != difficulty_hint:
            violations.append(f"difficulty mismatch: asked {difficulty_hint}, got {actual_difficulty}")
            if difficulty_hint == "easy":
                corrections.append("EASY: ONE table, NO JOIN, NO GROUP BY, NO CASE, NO subquery. Just SELECT with WHERE/ORDER BY.")
            elif difficulty_hint == "medium":
                corrections.append("MEDIUM: 2-3 tables joined OR GROUP BY + HAVING. No window functions, no CTEs.")
            else:
                corrections.append("HARD: MUST use a window function (OVER ...), a CTE (WITH ... AS), a self-join, or EXISTS/IN subquery.")

        # Always remember the best fallback so far — fewer violations wins,
        # ties broken by the literal-violation taking priority (more important to avoid).
        n_viol = len(violations) + (10 if missing_literals else 0)
        if best_fallback is None or n_viol < best_fallback[0]:
            best_fallback = (n_viol, {**data, "_actual_difficulty": actual_difficulty})

        if violations:
            last_error = "; ".join(violations)
            messages.append({"role": "assistant", "content": raw})
            messages.append({
                "role": "user",
                "content": (
                    "Your previous output had these issues: " + "; ".join(violations) + ". "
                    + " ".join(corrections) +
                    " Return a SINGLE JSON object that fixes ALL of the above at once."
                ),
            })
            continue

        # Perfect candidate.
        data["ordered_results"] = bool(data["ordered_results"])
        if not isinstance(data["concepts"], list):
            data["concepts"] = [str(data["concepts"])]
        if concept_hint and concept_hint not in data["concepts"] and _concept_visible(concept_hint, ref_sql):
            data["concepts"].insert(0, concept_hint)
        data["difficulty"] = actual_difficulty
        if difficulty_hint in ("easy", "medium", "hard"):
            data["difficulty"] = difficulty_hint
        data["_shape_id"] = shape_id
        return data

    # No perfect candidate after the budget — ship the best fallback if we have one.
    # This avoids dead-ending the user when constraints conflict.
    if best_fallback is not None:
        data = best_fallback[1]
        ref_sql = str(data.get("reference_sql", ""))
        actual_difficulty = data.pop("_actual_difficulty", classify_difficulty(ref_sql))
        data["ordered_results"] = bool(data.get("ordered_results", False))
        if not isinstance(data.get("concepts"), list):
            data["concepts"] = [str(data.get("concepts", ""))]
        if concept_hint and concept_hint not in data["concepts"] and _concept_visible(concept_hint, ref_sql):
            data["concepts"].insert(0, concept_hint)
        data["difficulty"] = actual_difficulty
        data["_shape_id"] = shape_id
        return data

    raise RuntimeError(f"Failed to generate a valid question after 5 attempts. Last error: {last_error}")


async def _try_run(sql: str) -> tuple[bool, str, int]:
    try:
        async with engine.connect() as conn:
            trans = await conn.begin()
            try:
                await conn.execute(text("SET LOCAL statement_timeout = '5s'"))
                result = await conn.execute(text(sql))
                rows = result.fetchall()
            finally:
                await trans.rollback()
        return True, "", len(rows)
    except Exception as e:
        return False, str(e).split("\n")[0], 0


async def explain_mistake(
    question: str,
    reference_sql: str,
    user_sql: str,
    user_output: dict[str, Any] | None,
    expected_output: dict[str, Any] | None,
    error_message: str | None,
) -> dict[str, Any]:
    client = _get_client()
    payload = {
        "question": question,
        "user_sql": user_sql,
        "reference_sql": reference_sql,
        "user_output": user_output if user_output is not None else None,
        "expected_output": expected_output if expected_output is not None else None,
        "error_message": error_message,
    }
    completion = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": EXPLAIN_SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(payload, default=str)},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    raw = completion.choices[0].message.content or "{}"
    data = json.loads(raw)
    if "typo_corrections" not in data or not isinstance(data["typo_corrections"], list):
        data["typo_corrections"] = []
    if "explanation" not in data:
        data["explanation"] = "I couldn't generate an explanation. Please try again."
    return data


async def give_hint(
    question: str,
    reference_sql: str,
    schema_info: dict[str, Any],
    user_sql: str | None = None,
) -> dict[str, Any]:
    client = _get_client()
    payload = {
        "question": question,
        "reference_sql": reference_sql,
        "schema": schema_info,
        "user_sql_so_far": user_sql,
    }
    completion = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": HINT_SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(payload, default=str)},
        ],
        response_format={"type": "json_object"},
        temperature=0.4,
    )
    raw = completion.choices[0].message.content or "{}"
    data = json.loads(raw)
    if "hint" not in data:
        data["hint"] = ""
    raw_suggestion = data.get("suggested_sql")
    if isinstance(raw_suggestion, str) and raw_suggestion.strip():
        data["suggested_sql"] = raw_suggestion
    else:
        data["suggested_sql"] = None
    return data


async def explain_sql_error(
    question: str,
    user_sql: str,
    error_message: str,
    schema_info: dict[str, Any],
) -> dict[str, Any]:
    client = _get_client()
    payload = {
        "question": question,
        "user_sql": user_sql,
        "error_message": error_message,
        "schema": schema_info,
    }
    completion = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": ERROR_HELP_SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(payload, default=str)},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    raw = completion.choices[0].message.content or "{}"
    data = json.loads(raw)
    if "explanation" not in data:
        data["explanation"] = "Postgres could not run that SQL."
    if "next_step" not in data:
        data["next_step"] = "Check the table and column names in the schema."
    raw_suggestion = data.get("suggested_sql")
    if isinstance(raw_suggestion, str) and raw_suggestion.strip():
        data["suggested_sql"] = raw_suggestion
    else:
        data["suggested_sql"] = None
    return data


async def review_performance(
    question: str,
    user_sql: str,
    reference_sql: str,
    schema_info: dict[str, Any],
    user_plan: Any,
    user_time_ms: float | None,
    reference_time_ms: float | None,
) -> dict[str, Any]:
    client = _get_client()
    payload = {
        "question": question,
        "user_sql": user_sql,
        "reference_sql": reference_sql,
        "schema": schema_info,
        "user_plan": user_plan,
        "user_time_ms": user_time_ms,
        "reference_time_ms": reference_time_ms,
    }
    completion = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": PERFORMANCE_SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(payload, default=str)},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    raw = completion.choices[0].message.content or "{}"
    data = json.loads(raw)
    if "summary" not in data:
        data["summary"] = "I could not generate a performance summary."
    if "suggestions" not in data or not isinstance(data["suggestions"], list):
        data["suggestions"] = []
    if "optimized_sql" not in data:
        data["optimized_sql"] = None
    return data


async def explain_solution(
    question: str,
    reference_sql: str,
    schema_info: dict[str, Any],
) -> dict[str, Any]:
    client = _get_client()
    payload = {
        "question": question,
        "reference_sql": reference_sql,
        "schema": schema_info,
    }
    completion = await client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": EXPLAIN_SOLUTION_SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(payload, default=str)},
        ],
        response_format={"type": "json_object"},
        temperature=0.3,
    )
    raw = completion.choices[0].message.content or "{}"
    data = json.loads(raw)
    if "steps" not in data or not isinstance(data["steps"], list):
        data["steps"] = []
    if "summary" not in data:
        data["summary"] = ""
    if "final_thought" not in data:
        data["final_thought"] = ""
    return data
