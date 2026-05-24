from app.clean.ingest import guess_type, sanitize_idents


def test_sanitize_basic():
    assert sanitize_idents(["Full Name", "E-mail!"]) == ["full_name", "e_mail"]


def test_sanitize_dedupes_collisions():
    assert sanitize_idents(["Name", "name", "NAME"]) == ["name", "name_1", "name_2"]


def test_sanitize_empty_and_leading_digit():
    out = sanitize_idents(["", "1st", "  "])
    assert out[0].startswith("col")
    assert out[1][0].isalpha()
    assert len(set(out)) == 3


def test_guess_type():
    assert guess_type(["1", "2", "30"]) == "integer"
    assert guess_type(["1.5", "2", "3.0"]) == "numeric"
    assert guess_type(["2024-01-02", "2023-12-31"]) == "date"
    assert guess_type(["true", "FALSE", "true"]) == "boolean"
    assert guess_type(["alice", "bob"]) == "text"
    assert guess_type([]) == "text"
