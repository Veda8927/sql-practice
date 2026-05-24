/**
 * Python Learning Roadmap — shown in the Python > Learn tab.
 *
 * Reuses the SQL syllabus data model (Module/Topic/ContentBlock) so the same
 * SyllabusView renders it. `practiceConcept` slugs match the Python practice
 * concepts (basics, conditionals, strings, lists, loops, dicts, functions) so
 * the "Practice this concept" button jumps into Python Practice.
 */
import type { Module } from "./syllabus";

export const PY_SYLLABUS: Module[] = [
  {
    id: "py-getting-started",
    title: "Getting Started",
    description: "What Python is, how code runs, and how to print and comment.",
    topics: [
      {
        id: "py-what-is-python",
        title: "What is Python",
        blurb: "A readable, general-purpose programming language.",
        bigIdea: "Python lets you give a computer step-by-step instructions in language that reads almost like English.",
        realWorld: "Think of a recipe: a list of clear steps the computer follows top to bottom.",
        body: [],
        richBody: [
          { kind: "p", text: "Python runs your instructions one line at a time, in order. You write text (code), and the interpreter carries it out immediately." },
          { kind: "p", text: "It is used for web apps, data analysis, automation, AI, and scripting. Its strength is readability: programs are short and look close to plain English." },
          { kind: "callout", tone: "tip", text: "In this trainer, press Run to execute your code and see its output, or Submit to check it against the exercise's tests." },
        ],
        examples: [
          { code: "print(\"Hello, world!\")", note: "The classic first program — prints text to the screen." },
        ],
      },
      {
        id: "py-print-comments",
        title: "Printing and comments",
        blurb: "Show output with print(); leave notes with #.",
        bigIdea: "print() is how your program talks back to you; comments are notes the computer ignores.",
        body: [],
        richBody: [
          { kind: "p", text: "print() displays whatever you pass it. You can pass several values separated by commas and Python joins them with spaces." },
          { kind: "p", text: "Anything after a # on a line is a comment — for humans only. Use comments to explain why, not what." },
          { kind: "code", code: "print(\"Score:\", 42)   # prints: Score: 42\n# this whole line is ignored", note: "Commas add spaces; # starts a comment." },
        ],
        examples: [
          { code: "name = \"Ada\"\nprint(\"Hi\", name)", note: "Prints: Hi Ada" },
        ],
      },
    ],
  },
  {
    id: "py-variables-types",
    title: "Variables & Types",
    description: "Store values in names, and the basic kinds of data.",
    topics: [
      {
        id: "py-variables",
        title: "Variables",
        blurb: "Names that point to values.",
        bigIdea: "A variable is a label you stick on a value so you can reuse it later.",
        realWorld: "Like writing a number on a sticky note and giving the note a name.",
        body: [],
        richBody: [
          { kind: "p", text: "You create a variable by assigning to it with =. The name goes on the left, the value on the right." },
          { kind: "code", code: "age = 30\nprice = 9.99\nname = \"Sam\"\nis_member = True" },
          { kind: "bullets", title: "Naming rules", items: [
            "Use lowercase_with_underscores (snake_case).",
            "Start with a letter or underscore, not a digit.",
            "Pick descriptive names: total_price beats tp.",
          ] },
        ],
        examples: [
          { code: "x = 5\ny = x + 3\nprint(y)", note: "y becomes 8." },
        ],
        practiceConcept: "basics",
      },
      {
        id: "py-types",
        title: "Numbers, text, and booleans",
        blurb: "int, float, str, bool — and converting between them.",
        bigIdea: "Every value has a type, and the type decides what you can do with it.",
        body: [],
        richBody: [
          { kind: "bullets", title: "The core types", items: [
            "int — whole numbers: 3, -7, 1000",
            "float — decimals: 3.14, -0.5",
            "str — text in quotes: \"hello\"",
            "bool — True or False",
          ] },
          { kind: "p", text: "Convert with int(), float(), and str(). This matters because \"5\" (text) is not 5 (number)." },
          { kind: "code", code: "n = int(\"5\")     # 5 as a number\ns = str(42)      # \"42\" as text\nf = float(\"3.5\") # 3.5", note: "Type conversions ('casting')." },
          { kind: "callout", tone: "warning", text: "Adding a number to text raises a TypeError. Convert first: int(\"5\") + 2 == 7." },
        ],
        examples: [
          { code: "print(7 / 2)    # 3.5 (float division)\nprint(7 // 2)   # 3 (integer division)\nprint(7 % 2)    # 1 (remainder)" },
        ],
        practiceConcept: "basics",
      },
    ],
  },
  {
    id: "py-strings",
    title: "Strings",
    description: "Work with text: indexing, slicing, methods, and f-strings.",
    topics: [
      {
        id: "py-string-basics",
        title: "Indexing and slicing",
        blurb: "Reach into text by position.",
        bigIdea: "A string is a sequence of characters you can index (one char) or slice (a range).",
        realWorld: "Like reading specific letters off a row of scrabble tiles.",
        body: [],
        richBody: [
          { kind: "p", text: "Positions start at 0. Negative positions count from the end (-1 is the last character)." },
          { kind: "code", code: "s = \"python\"\ns[0]     # 'p'\ns[-1]    # 'n'\ns[0:3]   # 'pyt'  (start..stop, stop excluded)\ns[::-1]  # 'nohtyp' (reversed)" },
          { kind: "callout", tone: "tip", text: "Slicing never errors on out-of-range bounds — s[0:99] just gives the whole string." },
        ],
        examples: [
          { code: "word = \"hello\"\nprint(word[1:4])  # 'ell'" },
        ],
        practiceConcept: "strings",
      },
      {
        id: "py-string-methods",
        title: "String methods & f-strings",
        blurb: "Clean, search, and build text.",
        bigIdea: "Strings come with handy built-in methods, and f-strings let you drop values into text.",
        body: [],
        richBody: [
          { kind: "bullets", title: "Common methods", items: [
            ".lower() / .upper() — change case",
            ".strip() — remove surrounding whitespace",
            ".replace(a, b) — swap text",
            ".split() — break into a list of words",
            ".startswith(x) / .endswith(x) — checks",
          ] },
          { kind: "code", code: "name = \"Ada\"\nage = 36\nprint(f\"{name} is {age}\")  # Ada is 36", note: "An f-string: put an f before the quote, values in {braces}." },
        ],
        examples: [
          { code: "msg = \"  Hi There  \"\nprint(msg.strip().lower())  # 'hi there'" },
        ],
        practiceConcept: "strings",
      },
    ],
  },
  {
    id: "py-conditionals",
    title: "Conditionals",
    description: "Make decisions with if / elif / else and booleans.",
    topics: [
      {
        id: "py-if-else",
        title: "if / elif / else",
        blurb: "Run code only when a condition is true.",
        bigIdea: "Conditionals let your program choose different paths based on the data.",
        realWorld: "Like a fork in the road: take one branch if it's raining, another if it's sunny.",
        body: [],
        richBody: [
          { kind: "p", text: "Python checks each condition top to bottom and runs the first block whose condition is True. Indentation (4 spaces) marks what's inside the branch." },
          { kind: "code", code: "if score >= 90:\n    grade = \"A\"\nelif score >= 80:\n    grade = \"B\"\nelse:\n    grade = \"F\"" },
          { kind: "callout", tone: "warning", text: "Use == to compare and = to assign. if x = 5 is an error; if x == 5 is a check." },
        ],
        examples: [
          { code: "n = 7\nprint(\"even\" if n % 2 == 0 else \"odd\")  # odd" },
        ],
        practiceConcept: "conditionals",
      },
      {
        id: "py-booleans",
        title: "Booleans and logic",
        blurb: "Combine conditions with and / or / not.",
        bigIdea: "Comparisons produce True/False, which you combine to express complex rules.",
        body: [],
        richBody: [
          { kind: "bullets", title: "Operators", items: [
            "Compare: ==, !=, <, <=, >, >=",
            "Combine: and (both), or (either), not (flip)",
            "Membership: x in collection",
          ] },
          { kind: "code", code: "age = 20\nif age >= 18 and age < 65:\n    print(\"adult\")" },
        ],
        examples: [
          { code: "vowels = \"aeiou\"\nprint(\"e\" in vowels)  # True" },
        ],
        practiceConcept: "conditionals",
      },
    ],
  },
  {
    id: "py-loops",
    title: "Loops",
    description: "Repeat work with for and while.",
    topics: [
      {
        id: "py-for-loops",
        title: "for loops and range",
        blurb: "Do something for each item.",
        bigIdea: "A for loop walks through a sequence, running the body once per item.",
        realWorld: "Like dealing cards: repeat the same action for each player.",
        body: [],
        richBody: [
          { kind: "p", text: "for x in sequence: runs the indented body with x set to each element in turn. range(n) gives 0,1,...,n-1." },
          { kind: "code", code: "for i in range(3):\n    print(i)        # 0, 1, 2\n\nfor c in \"hi\":\n    print(c)        # h, i" },
          { kind: "callout", tone: "tip", text: "The accumulator pattern: start a total at 0, then add to it inside the loop." },
        ],
        examples: [
          { code: "total = 0\nfor n in [10, 20, 30]:\n    total += n\nprint(total)  # 60" },
        ],
        practiceConcept: "loops",
      },
      {
        id: "py-while-loops",
        title: "while loops",
        blurb: "Repeat until a condition stops being true.",
        bigIdea: "Use while when you don't know in advance how many times to loop.",
        body: [],
        richBody: [
          { kind: "p", text: "A while loop checks its condition before each pass and stops when it becomes False. Make sure something inside the loop changes, or it runs forever." },
          { kind: "code", code: "n = 5\nwhile n > 0:\n    print(n)\n    n -= 1   # without this, infinite loop" },
          { kind: "callout", tone: "warning", text: "If a Submit times out, you likely have a loop whose condition never becomes False." },
        ],
        examples: [
          { code: "count = 0\nwhile count < 3:\n    count += 1\nprint(count)  # 3" },
        ],
        practiceConcept: "loops",
      },
    ],
  },
  {
    id: "py-lists",
    title: "Lists",
    description: "Ordered collections you can grow, index, and transform.",
    topics: [
      {
        id: "py-list-basics",
        title: "List basics",
        blurb: "Create, index, and modify a list.",
        bigIdea: "A list holds many values in order, and you can change it after creating it.",
        realWorld: "Like a numbered shopping list you can add to or cross items off.",
        body: [],
        richBody: [
          { kind: "code", code: "nums = [3, 1, 2]\nnums[0]        # 3\nnums.append(4) # [3, 1, 2, 4]\nlen(nums)      # 4\nnums.sort()    # [1, 2, 3, 4]" },
          { kind: "bullets", title: "Handy operations", items: [
            ".append(x) — add to the end",
            ".sort() — order in place; sorted(x) — new ordered list",
            "sum(x), max(x), min(x) — aggregates",
            "x in nums — membership test",
          ] },
        ],
        examples: [
          { code: "scores = [50, 90, 70]\nprint(sum(scores) / len(scores))  # 70.0 (average)" },
        ],
        practiceConcept: "lists",
      },
      {
        id: "py-comprehensions",
        title: "List comprehensions",
        blurb: "Build a new list from an old one in one line.",
        bigIdea: "A comprehension expresses 'transform/filter each item' compactly.",
        body: [],
        richBody: [
          { kind: "p", text: "Read [f(x) for x in items if cond] as: for each x in items where cond is true, collect f(x)." },
          { kind: "code", code: "nums = [1, 2, 3, 4]\nsquares = [n * n for n in nums]      # [1, 4, 9, 16]\nevens = [n for n in nums if n % 2 == 0]  # [2, 4]" },
        ],
        examples: [
          { code: "words = [\"hi\", \"bye\"]\nprint([w.upper() for w in words])  # ['HI', 'BYE']" },
        ],
        practiceConcept: "lists",
      },
    ],
  },
  {
    id: "py-dicts",
    title: "Dictionaries",
    description: "Look things up by key instead of position.",
    topics: [
      {
        id: "py-dict-basics",
        title: "Key/value pairs",
        blurb: "Map keys to values.",
        bigIdea: "A dict stores values you fetch by a meaningful key, not a number.",
        realWorld: "Like a phone book: look up a name (key) to get a number (value).",
        body: [],
        richBody: [
          { kind: "code", code: "person = {\"name\": \"Ada\", \"age\": 36}\nperson[\"name\"]          # 'Ada'\nperson[\"age\"] = 37       # update\nperson.get(\"email\", \"-\") # safe lookup with default" },
          { kind: "callout", tone: "warning", text: "person[\"missing\"] raises KeyError. Use .get(key, default) when a key might be absent." },
        ],
        examples: [
          { code: "counts = {}\nfor c in \"aab\":\n    counts[c] = counts.get(c, 0) + 1\nprint(counts)  # {'a': 2, 'b': 1}" },
        ],
        practiceConcept: "dicts",
      },
      {
        id: "py-dict-iter",
        title: "Iterating dictionaries",
        blurb: "Loop over keys, values, and pairs.",
        bigIdea: ".items() gives you both the key and the value at once.",
        body: [],
        richBody: [
          { kind: "code", code: "prices = {\"pen\": 2, \"book\": 5}\nfor name, price in prices.items():\n    print(name, price)" },
          { kind: "bullets", title: "Views", items: [
            ".keys() — the keys",
            ".values() — the values",
            ".items() — (key, value) pairs",
          ] },
        ],
        examples: [
          { code: "prices = {\"a\": 1, \"b\": 3}\nprint(sum(prices.values()))  # 4" },
        ],
        practiceConcept: "dicts",
      },
    ],
  },
  {
    id: "py-functions",
    title: "Functions",
    description: "Package reusable behavior with inputs and outputs.",
    topics: [
      {
        id: "py-def-return",
        title: "Defining functions",
        blurb: "def, parameters, and return.",
        bigIdea: "A function is a named recipe: give it inputs (parameters), it gives back a result (return).",
        realWorld: "Like a coffee machine: put in water and beans, get back coffee.",
        body: [],
        richBody: [
          { kind: "p", text: "Define with def name(params):, put the body indented below, and use return to send a value back. Without return, a function gives back None." },
          { kind: "code", code: "def add(a, b):\n    return a + b\n\nresult = add(2, 3)  # 5" },
          { kind: "steps", title: "What happens on add(2, 3)", items: [
            { title: "Bind inputs", detail: "a becomes 2, b becomes 3." },
            { title: "Run body", detail: "Compute a + b → 5." },
            { title: "Return", detail: "Hand 5 back to the caller." },
          ] },
        ],
        examples: [
          { code: "def greet(name):\n    return f\"Hi, {name}\"\nprint(greet(\"Sam\"))  # Hi, Sam" },
        ],
        practiceConcept: "functions",
      },
      {
        id: "py-default-args",
        title: "Default and keyword arguments",
        blurb: "Make parameters optional and explicit.",
        bigIdea: "Defaults let callers skip arguments; keyword args make calls readable.",
        body: [],
        richBody: [
          { kind: "code", code: "def power(base, exp=2):\n    return base ** exp\n\npower(5)         # 25 (exp defaults to 2)\npower(2, exp=3)  # 8 (keyword argument)" },
          { kind: "callout", tone: "tip", text: "Never use a mutable default like def f(x=[]): — it is shared across calls. Use None and create inside." },
        ],
        examples: [
          { code: "def join(items, sep=\", \"):\n    return sep.join(items)\nprint(join([\"a\", \"b\"]))  # a, b" },
        ],
        practiceConcept: "functions",
      },
    ],
  },
];
