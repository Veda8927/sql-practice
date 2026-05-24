"""Build + validate the curated Python exercise bank.

Defines exercises as Python dicts (no JSON-escaping pain), grades each reference
solution against its own test cases in the real sandbox, and only then writes the
frontend JSON files. Run: `uv run python -m scripts.build_py_bank` from backend/.
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path

from app.pyexec.grader import grade

OUT = Path(__file__).resolve().parent.parent.parent / "frontend" / "src" / "data" / "py-questions"

# Each exercise: id, concept, difficulty, kind, prompt, starter_code, entrypoint,
# reference_solution, test_cases, hints, solution_steps, solution_summary,
# solution_final_thought.
EXERCISES: list[dict] = [
    # ---------- basics ----------
    {
        "id": "py-rectangle-area", "concept": "basics", "difficulty": "easy", "kind": "function",
        "prompt": "Write `rectangle_area(width, height)` that returns the area of a rectangle.",
        "starter_code": "def rectangle_area(width, height):\n    pass",
        "entrypoint": "rectangle_area",
        "reference_solution": "def rectangle_area(width, height):\n    return width * height",
        "test_cases": [
            {"args": [3, 4], "expected": 12},
            {"args": [5, 5], "expected": 25},
            {"args": [0, 9], "expected": 0},
            {"args": [2.5, 4], "expected": 10.0},
        ],
        "hints": [
            {"hint": "Area of a rectangle is width times height.", "suggested_code": None},
            {"hint": "Use the * operator and return the result.", "suggested_code": "return width * height"},
        ],
        "solution_steps": [
            {"title": "Multiply", "what_it_does": "Computes width times height.",
             "code": "return width * height", "how_it_runs": "Python multiplies the two numbers and hands the value back."},
        ],
        "solution_summary": "Multiply the two sides and return the product.",
        "solution_final_thought": "Most 'area' problems are just one multiplication.",
    },
    {
        "id": "py-celsius-to-f", "concept": "basics", "difficulty": "easy", "kind": "function",
        "prompt": "Write `to_fahrenheit(celsius)` that converts a Celsius temperature to Fahrenheit. Formula: F = C * 9/5 + 32.",
        "starter_code": "def to_fahrenheit(celsius):\n    pass",
        "entrypoint": "to_fahrenheit",
        "reference_solution": "def to_fahrenheit(celsius):\n    return celsius * 9 / 5 + 32",
        "test_cases": [
            {"args": [0], "expected": 32.0},
            {"args": [100], "expected": 212.0},
            {"args": [37], "expected": 98.6},
            {"args": [-40], "expected": -40.0},
        ],
        "hints": [
            {"hint": "Apply the formula F = C * 9/5 + 32.", "suggested_code": None},
        ],
        "solution_steps": [
            {"title": "Apply the formula", "what_it_does": "Scales by 9/5 and shifts by 32.",
             "code": "return celsius * 9 / 5 + 32", "how_it_runs": "Order of operations does the multiply/divide before the +32."},
        ],
        "solution_summary": "Plug Celsius into F = C*9/5 + 32.",
        "solution_final_thought": "Watch out for integer vs float division in other languages — Python's / always gives a float.",
    },
    # ---------- conditionals ----------
    {
        "id": "py-grade-letter", "concept": "conditionals", "difficulty": "easy", "kind": "function",
        "prompt": "Write `letter_grade(score)` returning 'A' for >=90, 'B' for >=80, 'C' for >=70, else 'F'.",
        "starter_code": "def letter_grade(score):\n    pass",
        "entrypoint": "letter_grade",
        "reference_solution": (
            "def letter_grade(score):\n"
            "    if score >= 90:\n        return 'A'\n"
            "    if score >= 80:\n        return 'B'\n"
            "    if score >= 70:\n        return 'C'\n"
            "    return 'F'"
        ),
        "test_cases": [
            {"args": [95], "expected": "A"},
            {"args": [83], "expected": "B"},
            {"args": [70], "expected": "C"},
            {"args": [40], "expected": "F"},
            {"args": [89], "expected": "B"},
        ],
        "hints": [
            {"hint": "Check the highest threshold first, then work down.", "suggested_code": None},
            {"hint": "Return as soon as a condition matches so later checks are skipped.", "suggested_code": None},
        ],
        "solution_steps": [
            {"title": "Cascade the checks", "what_it_does": "Tests thresholds from high to low.",
             "code": "if score >= 90: return 'A'", "how_it_runs": "The first matching branch returns and stops."},
        ],
        "solution_summary": "Use a top-down chain of if/return checks.",
        "solution_final_thought": "Ordering matters: check the strictest condition first.",
    },
    # ---------- strings ----------
    {
        "id": "py-reverse-string", "concept": "strings", "difficulty": "easy", "kind": "function",
        "prompt": "Write `reverse_string(s)` that returns the string reversed.",
        "starter_code": "def reverse_string(s):\n    pass",
        "entrypoint": "reverse_string",
        "reference_solution": "def reverse_string(s):\n    return s[::-1]",
        "test_cases": [
            {"args": ["hello"], "expected": "olleh"},
            {"args": [""], "expected": ""},
            {"args": ["a"], "expected": "a"},
            {"args": ["racecar"], "expected": "racecar"},
        ],
        "hints": [
            {"hint": "Python slicing can step backwards.", "suggested_code": None},
            {"hint": "Try the slice s[::-1].", "suggested_code": "return s[::-1]"},
        ],
        "solution_steps": [
            {"title": "Reverse slice", "what_it_does": "Walks the string from end to start.",
             "code": "return s[::-1]", "how_it_runs": "The -1 step reads characters in reverse order."},
        ],
        "solution_summary": "Use the reverse slice s[::-1].",
        "solution_final_thought": "Slicing is the idiomatic way to reverse sequences in Python.",
    },
    {
        "id": "py-count-vowels", "concept": "strings", "difficulty": "easy", "kind": "function",
        "prompt": "Write `count_vowels(s)` returning how many vowels (a, e, i, o, u, case-insensitive) are in the string.",
        "starter_code": "def count_vowels(s):\n    pass",
        "entrypoint": "count_vowels",
        "reference_solution": "def count_vowels(s):\n    return sum(1 for c in s.lower() if c in 'aeiou')",
        "test_cases": [
            {"args": ["hello"], "expected": 2},
            {"args": ["XYZ"], "expected": 0},
            {"args": ["AeIoU"], "expected": 5},
            {"args": [""], "expected": 0},
        ],
        "hints": [
            {"hint": "Lowercase the string so case doesn't matter.", "suggested_code": None},
            {"hint": "Loop over characters and count those in 'aeiou'.", "suggested_code": None},
        ],
        "solution_steps": [
            {"title": "Count matches", "what_it_does": "Counts characters that are vowels.",
             "code": "sum(1 for c in s.lower() if c in 'aeiou')", "how_it_runs": "A generator yields 1 per vowel; sum totals them."},
        ],
        "solution_summary": "Lowercase, then count characters in 'aeiou'.",
        "solution_final_thought": "Generator expressions make counting concise.",
    },
    {
        "id": "py-is-palindrome", "concept": "strings", "difficulty": "medium", "kind": "function",
        "prompt": "Write `is_palindrome(s)` returning True if the string reads the same forwards and backwards, else False.",
        "starter_code": "def is_palindrome(s):\n    pass",
        "entrypoint": "is_palindrome",
        "reference_solution": "def is_palindrome(s):\n    return s == s[::-1]",
        "test_cases": [
            {"args": ["racecar"], "expected": True},
            {"args": ["hello"], "expected": False},
            {"args": [""], "expected": True},
            {"args": ["abba"], "expected": True},
        ],
        "hints": [
            {"hint": "A palindrome equals its own reverse.", "suggested_code": None},
        ],
        "solution_steps": [
            {"title": "Compare to reverse", "what_it_does": "Checks equality with the reversed string.",
             "code": "return s == s[::-1]", "how_it_runs": "If reversing changes nothing, it's a palindrome."},
        ],
        "solution_summary": "Compare the string to its reverse.",
        "solution_final_thought": "Reuse the reverse-slice trick you already learned.",
    },
    # ---------- lists ----------
    {
        "id": "py-sum-list", "concept": "lists", "difficulty": "easy", "kind": "function",
        "prompt": "Write `total(numbers)` that returns the sum of a list of numbers (0 for an empty list).",
        "starter_code": "def total(numbers):\n    pass",
        "entrypoint": "total",
        "reference_solution": "def total(numbers):\n    return sum(numbers)",
        "test_cases": [
            {"args": [[1, 2, 3]], "expected": 6},
            {"args": [[]], "expected": 0},
            {"args": [[-5, 5]], "expected": 0},
            {"args": [[10]], "expected": 10},
        ],
        "hints": [
            {"hint": "Python has a built-in for adding up a list.", "suggested_code": "return sum(numbers)"},
        ],
        "solution_steps": [
            {"title": "Use sum()", "what_it_does": "Adds every element.",
             "code": "return sum(numbers)", "how_it_runs": "sum() iterates the list and accumulates a total."},
        ],
        "solution_summary": "Call the built-in sum().",
        "solution_final_thought": "Reach for built-ins before writing manual loops.",
    },
    {
        "id": "py-max-in-list", "concept": "lists", "difficulty": "easy", "kind": "function",
        "prompt": "Write `largest(numbers)` that returns the biggest number in a non-empty list, without using max().",
        "starter_code": "def largest(numbers):\n    pass",
        "entrypoint": "largest",
        "reference_solution": (
            "def largest(numbers):\n"
            "    best = numbers[0]\n"
            "    for n in numbers[1:]:\n"
            "        if n > best:\n            best = n\n"
            "    return best"
        ),
        "test_cases": [
            {"args": [[1, 7, 3]], "expected": 7},
            {"args": [[-5, -2, -9]], "expected": -2},
            {"args": [[42]], "expected": 42},
            {"args": [[5, 5, 5]], "expected": 5},
        ],
        "hints": [
            {"hint": "Track a 'best so far' starting at the first element.", "suggested_code": None},
            {"hint": "Loop the rest and update when you find something bigger.", "suggested_code": None},
        ],
        "solution_steps": [
            {"title": "Track the max", "what_it_does": "Keeps the largest value seen.",
             "code": "if n > best: best = n", "how_it_runs": "Each element replaces best only when larger."},
        ],
        "solution_summary": "Scan once, keeping a running maximum.",
        "solution_final_thought": "This 'running best' pattern shows up everywhere.",
    },
    {
        "id": "py-unique-sorted", "concept": "lists", "difficulty": "medium", "kind": "function",
        "prompt": "Write `unique_sorted(items)` returning the distinct values, sorted ascending.",
        "starter_code": "def unique_sorted(items):\n    pass",
        "entrypoint": "unique_sorted",
        "reference_solution": "def unique_sorted(items):\n    return sorted(set(items))",
        "test_cases": [
            {"args": [[3, 1, 2, 1, 3]], "expected": [1, 2, 3]},
            {"args": [[]], "expected": []},
            {"args": [[5, 5, 5]], "expected": [5]},
            {"args": [[2, -1, 0, -1]], "expected": [-1, 0, 2]},
        ],
        "hints": [
            {"hint": "A set removes duplicates; sorted() orders them.", "suggested_code": None},
        ],
        "solution_steps": [
            {"title": "Dedupe then sort", "what_it_does": "Removes repeats and orders the result.",
             "code": "return sorted(set(items))", "how_it_runs": "set() drops duplicates; sorted() returns a new ordered list."},
        ],
        "solution_summary": "Combine set() and sorted().",
        "solution_final_thought": "Composing built-ins solves a lot in one line.",
    },
    # ---------- loops ----------
    {
        "id": "py-factorial", "concept": "loops", "difficulty": "medium", "kind": "function",
        "prompt": "Write `factorial(n)` returning n! for n >= 0 (factorial(0) == 1).",
        "starter_code": "def factorial(n):\n    pass",
        "entrypoint": "factorial",
        "reference_solution": (
            "def factorial(n):\n"
            "    result = 1\n"
            "    for i in range(2, n + 1):\n"
            "        result *= i\n"
            "    return result"
        ),
        "test_cases": [
            {"args": [0], "expected": 1},
            {"args": [1], "expected": 1},
            {"args": [5], "expected": 120},
            {"args": [6], "expected": 720},
        ],
        "hints": [
            {"hint": "Start a running product at 1.", "suggested_code": None},
            {"hint": "Multiply by each integer from 2 up to n.", "suggested_code": None},
        ],
        "solution_steps": [
            {"title": "Multiply up", "what_it_does": "Accumulates the product 1*2*...*n.",
             "code": "for i in range(2, n + 1): result *= i", "how_it_runs": "Each loop multiplies result by the next integer."},
        ],
        "solution_summary": "Loop from 2 to n, multiplying into a running product.",
        "solution_final_thought": "Starting at 1 makes the empty case (0! and 1!) fall out naturally.",
    },
    {
        "id": "py-fizzbuzz", "concept": "loops", "difficulty": "medium", "kind": "function",
        "prompt": "Write `fizzbuzz(n)` returning a list for 1..n where multiples of 3 are 'Fizz', of 5 are 'Buzz', of both are 'FizzBuzz', else the number.",
        "starter_code": "def fizzbuzz(n):\n    pass",
        "entrypoint": "fizzbuzz",
        "reference_solution": (
            "def fizzbuzz(n):\n"
            "    out = []\n"
            "    for i in range(1, n + 1):\n"
            "        if i % 15 == 0:\n            out.append('FizzBuzz')\n"
            "        elif i % 3 == 0:\n            out.append('Fizz')\n"
            "        elif i % 5 == 0:\n            out.append('Buzz')\n"
            "        else:\n            out.append(i)\n"
            "    return out"
        ),
        "test_cases": [
            {"args": [5], "expected": [1, 2, "Fizz", 4, "Buzz"]},
            {"args": [3], "expected": [1, 2, "Fizz"]},
            {"args": [15], "expected": [1, 2, "Fizz", 4, "Buzz", "Fizz", 7, 8, "Fizz", "Buzz", 11, "Fizz", 13, 14, "FizzBuzz"]},
            {"args": [1], "expected": [1]},
        ],
        "hints": [
            {"hint": "Check divisibility by 15 first, then 3, then 5.", "suggested_code": None},
            {"hint": "Use the modulo operator i % 3 == 0 to test multiples.", "suggested_code": None},
        ],
        "solution_steps": [
            {"title": "Check 15 first", "what_it_does": "Catches multiples of both 3 and 5.",
             "code": "if i % 15 == 0: out.append('FizzBuzz')", "how_it_runs": "15 is the least common multiple, so test it before 3 and 5."},
        ],
        "solution_summary": "Loop 1..n and branch on modulo 15/3/5.",
        "solution_final_thought": "Order the conditions from most specific to least.",
    },
    # ---------- dicts ----------
    {
        "id": "py-word-count", "concept": "dicts", "difficulty": "medium", "kind": "function",
        "prompt": "Write `word_count(text)` returning a dict mapping each whitespace-separated word to how many times it appears.",
        "starter_code": "def word_count(text):\n    pass",
        "entrypoint": "word_count",
        "reference_solution": (
            "def word_count(text):\n"
            "    counts = {}\n"
            "    for w in text.split():\n"
            "        counts[w] = counts.get(w, 0) + 1\n"
            "    return counts"
        ),
        "test_cases": [
            {"args": ["a b a"], "expected": {"a": 2, "b": 1}},
            {"args": [""], "expected": {}},
            {"args": ["hi hi hi"], "expected": {"hi": 3}},
            {"args": ["one two three"], "expected": {"one": 1, "two": 1, "three": 1}},
        ],
        "hints": [
            {"hint": "split() breaks the text into words.", "suggested_code": None},
            {"hint": "Use dict.get(word, 0) + 1 to tally.", "suggested_code": None},
        ],
        "solution_steps": [
            {"title": "Tally with get()", "what_it_does": "Increments each word's count.",
             "code": "counts[w] = counts.get(w, 0) + 1", "how_it_runs": "get returns 0 for new words, so the first increment makes it 1."},
        ],
        "solution_summary": "Split into words and tally into a dict with get().",
        "solution_final_thought": "collections.Counter does this too — worth exploring later.",
    },
    {
        "id": "py-merge-dicts", "concept": "dicts", "difficulty": "medium", "kind": "function",
        "prompt": "Write `merge(a, b)` returning a new dict with both dicts' items; on key conflicts, b wins. Inputs are not modified.",
        "starter_code": "def merge(a, b):\n    pass",
        "entrypoint": "merge",
        "reference_solution": "def merge(a, b):\n    return {**a, **b}",
        "test_cases": [
            {"args": [{"x": 1}, {"y": 2}], "expected": {"x": 1, "y": 2}},
            {"args": [{"x": 1}, {"x": 9}], "expected": {"x": 9}},
            {"args": [{}, {}], "expected": {}},
            {"args": [{"a": 1, "b": 2}, {"b": 3}], "expected": {"a": 1, "b": 3}},
        ],
        "hints": [
            {"hint": "Dict unpacking {**a, **b} merges two dicts.", "suggested_code": None},
            {"hint": "Later keys override earlier ones, so put b second.", "suggested_code": None},
        ],
        "solution_steps": [
            {"title": "Unpack both", "what_it_does": "Builds a fresh dict from both.",
             "code": "return {**a, **b}", "how_it_runs": "b is unpacked last, so its values win on conflicts."},
        ],
        "solution_summary": "Use dict unpacking with b last.",
        "solution_final_thought": "{**a, **b} never mutates the inputs — it makes a new dict.",
    },
]

LABELS = {
    "basics": "Basics", "conditionals": "Conditionals", "strings": "Strings",
    "lists": "Lists", "loops": "Loops", "dicts": "Dictionaries",
}
ORDER = ["basics", "conditionals", "strings", "lists", "loops", "dicts"]


async def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    by_concept: dict[str, list[dict]] = {}
    failures = 0
    for ex in EXERCISES:
        res = await grade(ex["reference_solution"], ex)
        ok = res.status == "correct"
        print(f"{'OK ' if ok else 'FAIL'} {ex['id']:24} {res.passed}/{res.total} {res.error_message or ''}")
        if not ok:
            failures += 1
        by_concept.setdefault(ex["concept"], []).append(ex)

    if failures:
        raise SystemExit(f"{failures} exercise(s) failed validation; not writing files.")

    concepts_meta = []
    for concept in ORDER:
        items = by_concept.get(concept, [])
        if not items:
            continue
        fname = f"{concept}.json"
        (OUT / fname).write_text(json.dumps(items, indent=2))
        concepts_meta.append(
            {"concept": concept, "label": LABELS[concept], "count": len(items), "file": fname}
        )
    index = {"generated_at": "2026-05-24", "concepts": concepts_meta}
    (OUT / "index.json").write_text(json.dumps(index, indent=2))
    print(f"\nWrote {sum(c['count'] for c in concepts_meta)} exercises across {len(concepts_meta)} concepts to {OUT}")


if __name__ == "__main__":
    asyncio.run(main())
