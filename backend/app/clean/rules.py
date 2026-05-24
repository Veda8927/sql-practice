"""Validation rule vocabulary -> violation-count SQL against the `prev` relation."""
from __future__ import annotations

from typing import Any


class RuleError(ValueError):
    """Raised when a rule references an unknown column or is malformed."""


def _col(params: dict[str, Any], idents: set[str], key: str = "column") -> str:
    name = params.get(key)
    if name not in idents:
        raise RuleError(f"Unknown column: {name!r}")
    return '"' + name + '"'


def build_violation_query(rule: dict[str, Any], idents: set[str]) -> tuple[str, dict[str, Any]]:
    """Return (sql, params). The query selects a single integer `v` = violation count,
    evaluated against the relation named `prev`."""
    rtype = rule.get("type")
    params = rule.get("params") or {}

    if rtype == "not_null":
        c = _col(params, idents)
        return (f"SELECT COUNT(*) AS v FROM prev WHERE {c} IS NULL", {})

    if rtype == "unique":
        c = _col(params, idents)
        return (
            f"SELECT COALESCE(SUM(cnt - 1), 0) AS v FROM "
            f"(SELECT COUNT(*) cnt FROM prev WHERE {c} IS NOT NULL "
            f"GROUP BY {c} HAVING COUNT(*) > 1) g",
            {},
        )

    if rtype == "unique_combo":
        cols = params.get("columns") or []
        if not cols:
            raise RuleError("unique_combo needs columns")
        quoted = ", ".join(_col({"column": c}, idents) for c in cols)
        return (
            f"SELECT COALESCE(SUM(cnt - 1), 0) AS v FROM "
            f"(SELECT COUNT(*) cnt FROM prev GROUP BY {quoted} HAVING COUNT(*) > 1) g",
            {},
        )

    if rtype == "no_duplicate_rows":
        return (
            "SELECT (SELECT COUNT(*) FROM prev) - "
            "(SELECT COUNT(*) FROM (SELECT DISTINCT * FROM prev) d) AS v",
            {},
        )

    if rtype == "regex":
        c = _col(params, idents)
        pattern = params.get("pattern")
        if not isinstance(pattern, str) or not pattern:
            raise RuleError("regex needs a pattern")
        return (
            f"SELECT COUNT(*) AS v FROM prev WHERE {c} IS NOT NULL AND {c} !~ :pattern",
            {"pattern": pattern},
        )

    if rtype == "allowed_values":
        c = _col(params, idents)
        values = params.get("values")
        if not isinstance(values, list) or not values:
            raise RuleError("allowed_values needs a non-empty list")
        return (
            f"SELECT COUNT(*) AS v FROM prev WHERE {c} IS NOT NULL AND NOT ({c} = ANY(:vals))",
            {"vals": [str(v) for v in values]},
        )

    if rtype == "range":
        c = _col(params, idents)
        try:
            mn = float(params["min"])
            mx = float(params["max"])
        except (KeyError, TypeError, ValueError) as e:
            raise RuleError("range needs numeric min and max") from e
        return (
            f"SELECT COUNT(*) AS v FROM prev WHERE {c} IS NOT NULL "
            f"AND {c}::numeric NOT BETWEEN :mn AND :mx",
            {"mn": mn, "mx": mx},
        )

    raise RuleError(f"Unknown rule type: {rtype!r}")
