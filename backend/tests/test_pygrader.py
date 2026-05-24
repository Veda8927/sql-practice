import pytest

from app.pyexec.grader import grade

EX = {
    "kind": "function",
    "entrypoint": "add",
    "test_cases": [
        {"args": [2, 3], "expected": 5},
        {"args": [-1, 1], "expected": 0},
    ],
}


@pytest.mark.asyncio
async def test_grade_correct():
    r = await grade("def add(a, b):\n    return a + b", EX)
    assert r.status == "correct"
    assert r.passed == 2 and r.total == 2


@pytest.mark.asyncio
async def test_grade_wrong():
    # a - b fails both cases (2-3=-1, -1-1=-2); partial-credit count is exposed via .passed
    r = await grade("def add(a, b):\n    return a - b", EX)
    assert r.status == "wrong"
    assert r.passed == 0 and r.total == 2


@pytest.mark.asyncio
async def test_grade_partial():
    # a * b passes case (-? ) none... use abs to pass exactly one: |2-3|? keep explicit
    r = await grade("def add(a, b):\n    return a + b if a > 0 else 999", EX)
    assert r.status == "wrong"
    assert r.passed == 1


@pytest.mark.asyncio
async def test_grade_runtime_error():
    r = await grade("def add(a, b):\n    return a + c", EX)
    assert r.status == "wrong"
    assert r.tests[0].error and "NameError" in r.tests[0].error


@pytest.mark.asyncio
async def test_grade_syntax_error():
    r = await grade("def add(a, b)\n    return a + b", EX)
    assert r.status == "error"
    assert r.error_message


@pytest.mark.asyncio
async def test_missing_entrypoint():
    r = await grade("def other():\n    return 1", EX)
    assert r.status == "wrong"
    assert r.tests[0].error and "add" in r.tests[0].error


@pytest.mark.asyncio
async def test_normalized_equality_tuple_list():
    ex = {"kind": "function", "entrypoint": "f", "test_cases": [{"args": [], "expected": [1, 2]}]}
    r = await grade("def f():\n    return (1, 2)", ex)
    assert r.status == "correct"


@pytest.mark.asyncio
async def test_user_print_does_not_corrupt_results():
    ex = {"kind": "function", "entrypoint": "f", "test_cases": [{"args": [], "expected": 1}]}
    r = await grade("def f():\n    print('noise')\n    return 1", ex)
    assert r.status == "correct"
    assert "noise" in r.tests[0].stdout


@pytest.mark.asyncio
async def test_script_mode():
    ex = {"kind": "script", "test_cases": [{"stdin": "", "expected_stdout": "hello"}]}
    r = await grade("print('hello')", ex)
    assert r.status == "correct"
