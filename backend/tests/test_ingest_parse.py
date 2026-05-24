import pytest

from app.clean.ingest import parse_csv


def test_parse_basic():
    raw = b"Name,Age\nAlice,30\nBob,\n"
    header, rows = parse_csv(raw)
    assert header == ["Name", "Age"]
    assert rows == [["Alice", "30"], ["Bob", None]]  # empty -> None


def test_parse_strips_bom():
    raw = "﻿A,B\n1,2\n".encode("utf-8")
    header, _ = parse_csv(raw)
    assert header == ["A", "B"]


def test_parse_rejects_empty():
    with pytest.raises(ValueError):
        parse_csv(b"")


def test_parse_rejects_too_many_cols():
    header = ",".join(f"c{i}" for i in range(61))
    with pytest.raises(ValueError):
        parse_csv((header + "\n1\n").encode())


def test_parse_caps_rows():
    body = "A\n" + "\n".join(str(i) for i in range(6000)) + "\n"
    _, rows = parse_csv(body.encode())
    assert len(rows) == 5000
