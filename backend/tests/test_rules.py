import pytest

from app.clean.rules import RuleError, build_violation_query

IDENTS = {"id", "email", "country", "age"}


def test_not_null():
    sql, params = build_violation_query(
        {"type": "not_null", "params": {"column": "id"}}, IDENTS)
    assert "IS NULL" in sql and '"id"' in sql and params == {}


def test_regex_binds_pattern():
    sql, params = build_violation_query(
        {"type": "regex", "params": {"column": "email", "pattern": "x"}}, IDENTS)
    assert "!~" in sql and params == {"pattern": "x"}


def test_allowed_values_binds_list():
    sql, params = build_violation_query(
        {"type": "allowed_values", "params": {"column": "country", "values": ["US", "CA"]}},
        IDENTS)
    assert params == {"vals": ["US", "CA"]}


def test_no_duplicate_rows():
    sql, params = build_violation_query({"type": "no_duplicate_rows", "params": {}}, IDENTS)
    assert "DISTINCT" in sql and params == {}


def test_unknown_column_rejected():
    with pytest.raises(RuleError):
        build_violation_query({"type": "not_null", "params": {"column": "nope"}}, IDENTS)


def test_unknown_type_rejected():
    with pytest.raises(RuleError):
        build_violation_query({"type": "bogus", "params": {}}, IDENTS)
