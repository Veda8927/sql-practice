"""OpenAI tutor: question generation + mistake explanation + step-by-step solution."""
from __future__ import annotations

import json
from typing import Any

from openai import AsyncOpenAI
from sqlalchemy import text

from .config import settings
from .db import engine

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is not set")
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


QUESTION_SYSTEM_PROMPT = """You write SQL practice questions for a learner using PostgreSQL.

You will receive a schema (with sample rows) and optional hints. Return ONLY a JSON object:
{
  "question": "the question text",
  "reference_sql": "a working PostgreSQL query that answers it",
  "ordered_results": true|false,
  "concepts": [list of SQL concepts from the allowed set],
  "difficulty": "easy"|"medium"|"hard"
}

Allowed concepts: ["joins","left_joins","aggregations","group_by","having","window_functions","cte","subqueries","case_when","date_functions","string_functions","null_handling","set_operations","self_joins"].

How to write the QUESTION:
- Direct, conversational. Like a peer asking another peer.
- DO NOT use stakeholder framing ("the marketing team wants...", "finance needs...", "we're prepping for the QBR"). Skip all of that.
- Start the question with a real verb: "Find...", "Show...", "List...", "Count...", "Which customers...", "How many orders...", "For each <thing>, ...", "What is the...", "Return the...".
- Always name the exact output columns. If sort matters, state it ("sorted by X descending").
- Never say "top N" without defining the metric.
- 1-2 sentences. No fluff, no preamble.

Variety rule (STRICT): vary the SHAPE of the question across calls. Do not repeat the same starting clause or the same anchor table back-to-back.
- The user will pass `recent_questions` (a list of the last few questions asked). Your output MUST NOT match any of those shapes. Specifically: pick a different opening verb, a different anchor table, AND a different output column set.
- Mix question shapes across calls. Examples of different shapes:
  · Per-X aggregates (one row per group)
  · Filtering (no aggregation, just a WHERE)
  · Ranking (window functions or ORDER BY + LIMIT)
  · Time-bucketed counts (per month, per week, per year)
  · Comparing two groups (CASE, ratios, deltas)
  · NULL / missing-data detection (anti-joins, IS NULL)
  · Distinct counts ("how many unique X")
  · Top / bottom N with ties (DENSE_RANK)
  · Self-comparisons (employees + their manager, products + their substitute)
- If the schema has 3+ tables, pick a different anchor table than the previous call. Don't always anchor on "customers" / "members" / "users".

Other rules:
- Reference SQL must run against the given schema without errors.
- Difficulty match: easy = 1-2 tables, simple WHERE / GROUP BY. Medium = 2-3 tables with JOIN or aggregation. Hard = CTEs, window functions, or non-trivial subqueries.
- If concept_hint is provided, the question MUST primarily exercise that concept.
- If difficulty_hint is provided, the difficulty field MUST match it.
- Mentally verify the reference_sql runs before returning."""


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


EXPLAIN_SOLUTION_SYSTEM_PROMPT = """You explain a SQL solution to a beginner — assume they know what a spreadsheet is but have NEVER written SQL before. Think 5th grade reading level.

You receive: the question, the reference SQL that solves it, and the table schema.

Return ONLY JSON:
{
  "summary": "ONE short sentence saying what we're trying to find. No SQL terms.",
  "steps": [
    {
      "title": "5-8 words. Plain English. No SQL keywords.",
      "what_it_does": "1-2 short sentences. Plain English. Use an everyday analogy. Mention which tables we touch.",
      "sql_snippet": "the smallest piece of the reference SQL for this step, copied VERBATIM",
      "how_postgres_reads_it": "1-2 short sentences. What does the database actually do here?"
    }
  ],
  "final_thought": "ONE short sentence that ties it together."
}

WRITING RULES (strict):
- 5th-grade vocabulary. Short sentences. Active voice.
- The FIRST time you mention any SQL term (SELECT, JOIN, GROUP BY, etc.), explain it in everyday words in parentheses. Example: "JOIN (it's like gluing two lists together where they share an ID)".
- Use analogies: "matching rows by id" = "finding pairs"; "filtering" = "throwing out ones that don't fit"; "aggregating" = "rolling many rows into one summary".
- 3-5 steps based on query complexity.
- Each sql_snippet MUST appear verbatim somewhere in the reference SQL.
- Walk through steps in the order Postgres executes them (FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT), even if the SQL is written in a different order.
- NO filler. NO restating the question. NO "as you can see".
- titles do not start with "Step N:" — just the description (the UI numbers them)."""


async def generate_question(
    schema_info: dict[str, Any],
    concept_hint: str | None = None,
    difficulty_hint: str | None = None,
    recent_questions: list[str] | None = None,
) -> dict[str, Any]:
    client = _get_client()

    user_content_obj = {
        "schema": schema_info,
        "concept_hint": concept_hint,
        "difficulty_hint": difficulty_hint,
        "recent_questions": recent_questions or [],
    }
    user_content = json.dumps(user_content_obj, default=str)

    last_error: str = ""
    for attempt in range(3):
        completion = await client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": QUESTION_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
            temperature=0.9 if attempt == 0 else 0.6,
        )
        raw = completion.choices[0].message.content or "{}"
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            last_error = f"LLM returned invalid JSON: {e}"
            continue

        required = {"question", "reference_sql", "ordered_results", "concepts", "difficulty"}
        if not required.issubset(data.keys()):
            last_error = f"LLM response missing fields: {required - set(data.keys())}"
            continue

        ok, err, n_rows = await _try_run(data["reference_sql"])
        if not ok:
            last_error = f"Reference SQL failed: {err}"
            continue
        if n_rows == 0:
            last_error = "Reference SQL returned 0 rows"
            continue

        data["ordered_results"] = bool(data["ordered_results"])
        if not isinstance(data["concepts"], list):
            data["concepts"] = [str(data["concepts"])]
        if data["difficulty"] not in ("easy", "medium", "hard"):
            data["difficulty"] = "medium"
        return data

    raise RuntimeError(f"Failed to generate a valid question after 3 attempts. Last error: {last_error}")


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
