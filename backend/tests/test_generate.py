from app.clean.generate import generate_messy


def test_generate_deterministic():
    h1, r1, rub1 = generate_messy(42)
    h2, r2, _ = generate_messy(42)
    assert h1 == h2
    assert r1 == r2  # same seed -> identical
    assert len(r1) > 200  # base rows + duplicates


def test_generate_varies_by_seed():
    _, r1, _ = generate_messy(1)
    _, r2, _ = generate_messy(2)
    assert r1 != r2


def test_rubric_shape():
    _, _, rubric = generate_messy(7)
    assert all({"issue", "column", "description"} <= set(item) for item in rubric)
