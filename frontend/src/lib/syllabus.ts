/**
 * SQL Learning Roadmap — the syllabus shown in Learn mode.
 *
 * Structure: 14 modules ordered by dependency. Each module is a logical
 * progression of topics; each topic has prose + working PostgreSQL
 * examples. Where a topic maps cleanly to one of our existing question
 * concepts, the `practiceConcept` field wires a "Practice this" button
 * into the Practice mode with that concept pre-selected.
 *
 * Drafting note: full bodies for modules 1-7 (the learning core).
 * Modules 8-14 ship as structured stubs with blurbs + examples so the
 * roadmap is visible end-to-end; we'll fill bodies as we go.
 */

export type PracticeConcept =
  | "joins"
  | "left_joins"
  | "aggregations"
  | "group_by"
  | "having"
  | "window_functions"
  | "cte"
  | "subqueries"
  | "case_when"
  | "date_functions"
  | "string_functions"
  | "null_handling"
  | "set_operations"
  | "self_joins";

export type Example = {
  code: string;
  note?: string;
};

export type StepItem = {
  title: string;
  detail: string;
  code?: string;
};

export type VennType =
  | "inner"
  | "left"
  | "right"
  | "full"
  | "leftOnly"
  | "rightOnly"
  | "outer";

export type TableCell = string | number | null;
export type CellHighlight = "match" | "drop" | "new";

export type TableViz = {
  caption?: string;
  columns: string[];
  rows: TableCell[][];
  /** Per-row highlight ("match"/"drop") — index into rows. */
  rowHighlights?: Record<number, CellHighlight>;
  note?: string;
};

export type ContentBlock =
  | { kind: "p"; text: string }
  | { kind: "steps"; title?: string; items: StepItem[] }
  | { kind: "bullets"; title?: string; items: string[] }
  | { kind: "code"; code: string; note?: string }
  | { kind: "callout"; tone: "tip" | "warning" | "note"; text: string }
  | {
      kind: "venn";
      type: VennType;
      caption?: string;
      leftLabel?: string;
      rightLabel?: string;
      legend?: string;
    }
  | { kind: "table"; table: TableViz }
  | {
      kind: "tablePair";
      caption?: string;
      left: TableViz;
      right: TableViz;
      /** Symbol to render between the two tables. */
      arrow?: "→" | "⇒" | "↓";
    }
  | {
      kind: "flow";
      caption?: string;
      steps: { label: string; sub?: string }[];
    }
  | {
      kind: "compare";
      caption?: string;
      left: { title: string; items: string[] };
      right: { title: string; items: string[] };
    };

export type Topic = {
  id: string;
  title: string;
  blurb: string;
  /** One-sentence summary of the "point" of the topic. Rendered prominently. */
  bigIdea?: string;
  /** Everyday-language analogy at the top of the topic. */
  realWorld?: string;
  /** Legacy paragraphs. Renderer wraps each as a `p` block if richBody is absent. */
  body: string[];
  /** New, richer content. If present, takes precedence over `body`. */
  richBody?: ContentBlock[];
  examples: Example[];
  practiceConcept?: PracticeConcept;
};

export type Module = {
  id: string;
  title: string;
  description: string;
  topics: Topic[];
};

export const SYLLABUS: Module[] = [
  // ── Module 1: Foundations ────────────────────────────────────────────────
  {
    id: "foundations",
    title: "Foundations",
    description: "What SQL is, how relational databases store data, and how to read a schema.",
    topics: [
      {
        id: "what-is-sql",
        title: "What is SQL",
        blurb: "A short language for asking a database questions.",
        bigIdea:
          "SQL is how you ask a database for information. You describe WHAT you want; the database figures out HOW to fetch it.",
        realWorld:
          "Imagine a giant library. SQL is the form you fill out at the front desk: \"Bring me every book by an author from Canada, sorted by year.\" You don't tell the librarian which shelves to walk — they figure that out.",
        body: [],
        richBody: [
          { kind: "p", text: "SQL stands for Structured Query Language. You write a short request, the database runs it on the data, and you get rows back." },
          {
            kind: "steps",
            title: "How a query goes from your hands to an answer",
            items: [
              {
                title: "You type a request",
                detail: "A few lines of SQL that say which table and which columns you want.",
                code: "SELECT name, email FROM customers WHERE country = 'Canada';",
              },
              {
                title: "The database parses it",
                detail: "Postgres reads your SQL and checks that the tables and columns exist and the syntax makes sense.",
              },
              {
                title: "It builds a plan",
                detail: "Postgres figures out the fastest way to find those rows — using an index, scanning a table, or joining things together.",
              },
              {
                title: "It runs the plan and returns rows",
                detail: "You see the answer as a table — usually in your editor or your app.",
              },
            ],
          },
          {
            kind: "bullets",
            title: "Why people use SQL",
            items: [
              "It's been around for 50 years and isn't going away.",
              "Almost every database speaks it: Postgres, MySQL, SQLite, SQL Server, BigQuery, Snowflake.",
              "It's declarative — you say WHAT you want, the database picks HOW.",
              "It works on tiny apps and huge data warehouses with the same shape.",
            ],
          },
          {
            kind: "callout",
            tone: "note",
            text: "This roadmap uses PostgreSQL. Other dialects (MySQL, SQLite, etc.) are 95% the same. Once you know one, you can pick up another in a few hours.",
          },
        ],
        examples: [
          {
            code: "SELECT name, email\nFROM customers\nWHERE country = 'Canada';",
            note: "Read it like English: take name and email from customers where country is Canada.",
          },
        ],
      },
      {
        id: "tables-rows-columns",
        title: "Tables, rows, columns",
        blurb: "How data is stored — a grid with rules.",
        bigIdea:
          "A database is a collection of tables. Each table is a grid: columns are the fields, rows are the records.",
        realWorld:
          "Picture a spreadsheet. Each tab is a TABLE (Customers, Orders, Products). Each row is one customer or one order. Each column is one piece of info (name, email, signup_date). Unlike a spreadsheet, the column types are locked: a number column can't suddenly hold text.",
        body: [],
        richBody: [
          { kind: "p", text: "Three words you'll hear forever in SQL:" },
          {
            kind: "bullets",
            items: [
              "TABLE — a named collection of rows. Example: customers.",
              "ROW — one record. One customer, one order, one event.",
              "COLUMN — one field in every row. Example: every customer has an email column.",
            ],
          },
          {
            kind: "code",
            code: "-- the customers table\n-- ┌────┬───────────┬──────────────────┬─────────┐\n-- │ id │ name      │ email            │ country │\n-- ├────┼───────────┼──────────────────┼─────────┤\n-- │  1 │ Ava Patel │ ava@example.com  │ Canada  │\n-- │  2 │ Liam Chen │ liam@example.com │ Japan   │\n-- │  3 │ Maya Rao  │ maya@example.com │ India   │\n-- └────┴───────────┴──────────────────┴─────────┘",
            note: "Three rows, four columns. Every row has the same four pieces of info.",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "The order of the rows isn't promised by the database. If you want a specific order, you have to ask for one with ORDER BY (coming soon).",
          },
        ],
        examples: [],
      },
      {
        id: "data-types",
        title: "Data types",
        blurb: "Every column has a strict type. Picking the right one matters.",
        bigIdea:
          "Each column locks down what kind of value it can hold — numbers, words, dates, true/false. The database refuses anything else.",
        realWorld:
          "Like a vending machine slot. One slot only takes quarters, another only takes dollar bills. Try to push a banana in and it spits back at you. That strictness is a feature: the database catches bad data BEFORE it gets saved.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "The buckets you'll see most",
            items: [
              "INTEGER — whole numbers. IDs, counts, ages.",
              "NUMERIC(10,2) — decimals with exact precision. Money, prices.",
              "TEXT — strings of any length. Names, emails, descriptions.",
              "DATE — just a calendar date (2026-05-18).",
              "TIMESTAMPTZ — a date AND time, with time zone. Use this for anything 'happened at'.",
              "BOOLEAN — true / false.",
              "JSONB — a nested object (like JSON in JavaScript).",
            ],
          },
          {
            kind: "callout",
            tone: "warning",
            text: "Money in FLOAT will round in ways that lose pennies. Always use NUMERIC for currency. NUMERIC(10,2) means up to 10 digits, 2 after the decimal point — i.e. $99,999,999.99 max.",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "For times: prefer TIMESTAMPTZ over TIMESTAMP. TIMESTAMPTZ stores an absolute moment in time; TIMESTAMP stores 'wall clock' time with no zone, which gets confusing fast.",
          },
        ],
        examples: [
          {
            code: "CREATE TABLE orders (\n  id            SERIAL PRIMARY KEY,\n  customer_id   INTEGER NOT NULL,\n  order_date    DATE NOT NULL,\n  status        TEXT,\n  total_amount  NUMERIC(10, 2) NOT NULL\n);",
            note: "SERIAL auto-numbers id. NUMERIC keeps decimals exact. TEXT is unbounded.",
          },
        ],
      },
      {
        id: "primary-foreign-keys",
        title: "Primary keys and foreign keys",
        blurb: "How rows are uniquely identified and how tables link to each other.",
        bigIdea:
          "Primary key = the ID of a row. Foreign key = a pointer from one table to another's ID.",
        realWorld:
          "Think of a school. Each student has a unique student number (primary key). Each library book loan has a `student_number` field on it — that's the foreign key, pointing back to which student borrowed the book. Same idea in databases.",
        body: [],
        richBody: [
          {
            kind: "steps",
            title: "How the two keys work together",
            items: [
              {
                title: "Each row gets a unique ID — the primary key",
                detail: "Usually a column called `id`. The database refuses two rows with the same primary key, and no row can have a NULL primary key.",
                code: "CREATE TABLE customers (\n  id    SERIAL PRIMARY KEY,  -- unique, auto-numbered\n  name  TEXT NOT NULL\n);",
              },
              {
                title: "Other tables refer to it — the foreign key",
                detail: "When an order belongs to a customer, the order table stores `customer_id`. That column points at `customers.id`. The link between tables is just a number on each side.",
                code: "CREATE TABLE orders (\n  id           SERIAL PRIMARY KEY,\n  customer_id  INTEGER NOT NULL\n    REFERENCES customers(id),   -- this is the FK\n  order_date   DATE NOT NULL\n);",
              },
              {
                title: "The database enforces the link",
                detail: "If you try to insert an order with customer_id = 999 and there's no customer 999, the database refuses. This is how you keep the data honest.",
              },
            ],
          },
          {
            kind: "callout",
            tone: "tip",
            text: "When you see `tableA.col → tableB.id` in the Schema view, that's a foreign key. It's also exactly how you JOIN the two tables later: `ON orders.customer_id = customers.id`.",
          },
          {
            kind: "callout",
            tone: "note",
            text: "Primary keys come with an index for free, so finding a row by id is fast. Foreign keys do NOT come with an index — adding one on the FK column is one of the most common performance wins.",
          },
        ],
        examples: [],
      },
      {
        id: "reading-schema",
        title: "Reading a schema",
        blurb: "How to make sense of a database you've never seen.",
        body: [
          "Before writing a query, look at the schema: which tables exist, which columns are in each, which columns are primary/foreign keys, and what the data types are.",
          "In this app the Schema button (top-right) opens an entity-relationship diagram and a table view. Use it whenever you're stuck — the join you need is almost always staring at you in the FK arrows.",
        ],
        examples: [],
      },
      {
        id: "execution-order",
        title: "How a query actually runs",
        blurb: "The order Postgres processes clauses isn't the order you write them.",
        bigIdea:
          "You WRITE SELECT first, but the database RUNS it almost last. The actual order is FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT.",
        realWorld:
          "Like cooking dinner. You announce the recipe name first (SELECT my pasta), but you don't START with the pasta. You gather ingredients (FROM), chop and filter (WHERE), group by dish type if you're making multiple, plate it (SELECT what to show), then arrange (ORDER BY), then portion (LIMIT).",
        body: [],
        richBody: [
          {
            kind: "flow",
            caption: "Logical execution order",
            steps: [
              { label: "FROM", sub: "load tables" },
              { label: "WHERE", sub: "filter rows" },
              { label: "GROUP BY", sub: "bucket rows" },
              { label: "HAVING", sub: "filter buckets" },
              { label: "SELECT", sub: "pick columns" },
              { label: "ORDER BY", sub: "sort" },
              { label: "LIMIT", sub: "take N" },
            ],
          },
          {
            kind: "p",
            text: "This order has practical consequences. The biggest one: you can't use a SELECT alias in WHERE, because WHERE runs BEFORE SELECT. But you CAN use it in ORDER BY, which runs after.",
          },
          {
            kind: "code",
            code: "-- ✗ fails: alias `tax` used in WHERE before it's computed\nSELECT total_amount * 0.1 AS tax\nFROM orders\nWHERE tax > 5;",
            note: "ERROR: column \"tax\" does not exist — WHERE ran first and tax wasn't defined yet.",
          },
          {
            kind: "code",
            code: "-- ✓ works: ORDER BY runs after SELECT so the alias is available\nSELECT total_amount * 0.1 AS tax\nFROM orders\nORDER BY tax DESC;",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "If you need a computed value in WHERE, either repeat the expression or wrap the query in a subquery / CTE so the alias is computed first.",
          },
        ],
        examples: [],
      },
      {
        id: "comments-and-quoting",
        title: "Comments and identifier quoting",
        blurb: "Two kinds of comments. Two kinds of quotes. Don't mix them.",
        body: [
          "Single-line comments start with `--`. Block comments wrap in `/* ... */`. Use them generously.",
          "Single quotes are for string VALUES (`'Sweden'`). Double quotes are for IDENTIFIERS that need case preservation or contain spaces (`\"User Name\"`). Putting double quotes around a string value is a common bug.",
        ],
        examples: [
          {
            code: "-- single-line comment\n/* block comment */\nSELECT \"customerId\" AS id, 'hello' AS greeting\nFROM \"My Table\";",
          },
        ],
      },
    ],
  },

  // ── Module 2: Querying basics ────────────────────────────────────────────
  {
    id: "querying-basics",
    title: "Querying basics",
    description: "SELECT, WHERE, ORDER BY, LIMIT, DISTINCT, and NULL — the daily verbs.",
    topics: [
      {
        id: "select-from",
        title: "SELECT and FROM",
        blurb: "The first two words of nearly every query.",
        bigIdea:
          "SELECT names the columns you want. FROM names the table they come from.",
        realWorld:
          "Like ordering at a coffee shop: \"I'll have an iced latte (SELECT) from the new menu (FROM).\" You're specifying WHAT you want and WHERE to get it from.",
        body: [],
        richBody: [
          {
            kind: "steps",
            title: "Reading a basic query",
            items: [
              {
                title: "SELECT — pick the columns",
                detail: "List the column names you want, separated by commas. Use * to mean \"all columns\" (but try to avoid that in real code).",
                code: "SELECT name, email",
              },
              {
                title: "FROM — pick the table",
                detail: "Name the table the columns come from. One table for now; we'll add joins later.",
                code: "FROM customers",
              },
              {
                title: "End with a semicolon",
                detail: "Most editors don't require it, but it's how SQL marks the end of a statement.",
                code: ";",
              },
            ],
          },
          { kind: "p", text: "Put together:" },
          {
            kind: "code",
            code: "SELECT name, email\nFROM customers;",
            note: "Reads as \"give me the name and email columns from the customers table\".",
          },
          {
            kind: "bullets",
            title: "Useful tricks",
            items: [
              "Rename a column in the output with `AS`: `SELECT name AS customer_name`.",
              "Compute new columns on the fly: `SELECT quantity * unit_price AS total`.",
              "Alias the table for short names later: `FROM customers AS c`.",
            ],
          },
          {
            kind: "callout",
            tone: "warning",
            text: "Avoid `SELECT *` in real code. It's slower (the DB sends every column), more fragile (your code breaks if a column is renamed), and less clear to readers. Name what you actually need.",
          },
        ],
        examples: [],
      },
      {
        id: "where-filtering",
        title: "WHERE — keep only the rows you want",
        blurb: "Narrow the result down to rows that match a condition.",
        bigIdea:
          "SELECT picks the columns. WHERE picks the rows. Without WHERE, you get everything.",
        realWorld:
          "Imagine sorting through a stack of mail. WHERE is the rule you use to throw some away: \"Only the bills.\" Or \"Only mail addressed to me from this month.\" Everything that doesn't match gets dropped.",
        body: [],
        richBody: [
          {
            kind: "p",
            text: "WHERE goes right after FROM. It checks a condition against every row and keeps only the rows that pass.",
          },
          {
            kind: "tablePair",
            caption: "WHERE country = 'Canada'",
            arrow: "→",
            left: {
              caption: "customers (before)",
              columns: ["id", "name", "country"],
              rows: [
                [1, "Ava", "Canada"],
                [2, "Liam", "Japan"],
                [3, "Maya", "Canada"],
                [4, "Theo", "France"],
              ],
              rowHighlights: { 0: "match", 1: "drop", 2: "match", 3: "drop" },
            },
            right: {
              caption: "result",
              columns: ["id", "name", "country"],
              rows: [
                [1, "Ava", "Canada"],
                [3, "Maya", "Canada"],
              ],
              rowHighlights: { 0: "match", 1: "match" },
            },
          },
          {
            kind: "code",
            code: "SELECT name, email\nFROM customers\nWHERE country = 'Canada';",
            note: "Only Canadian customers come back.",
          },
          {
            kind: "bullets",
            title: "Comparison operators",
            items: [
              "= equals — `country = 'Canada'`",
              "<> or != not equals",
              "< <= > >= less than, less-or-equal, greater than, greater-or-equal",
              "BETWEEN a AND b — inclusive range",
              "IN (...) — value matches any item in the list",
              "LIKE 'a%' — pattern match (% is any text, _ is one character)",
              "IS NULL / IS NOT NULL — for missing values",
            ],
          },
          {
            kind: "bullets",
            title: "Combine with AND, OR, NOT",
            items: [
              "AND — both conditions must be true",
              "OR — either condition is enough",
              "NOT — flips a condition",
              "Use parentheses when mixing — `(A OR B) AND C` is different from `A OR (B AND C)`",
            ],
          },
          {
            kind: "code",
            code: "-- multiple conditions\nSELECT *\nFROM orders\nWHERE status = 'completed'\n  AND total_amount > 100;\n\n-- OR with parentheses\nSELECT name FROM customers\nWHERE (country = 'Canada' OR country = 'Mexico')\n  AND signup_date >= '2025-01-01';",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "NULL is weird. `age = NULL` never matches anything — even rows where age IS actually NULL. Use `age IS NULL` instead.",
          },
        ],
        examples: [],
      },
      {
        id: "order-by",
        title: "ORDER BY — put the rows in order",
        blurb: "Sort the result by one or more columns.",
        bigIdea:
          "Without ORDER BY, the database returns rows in whatever order is fastest — which can change run to run. ORDER BY pins the order.",
        realWorld:
          "Like asking a librarian for books by author. Without instructions, they hand them over in whatever order. With \"sort by year, newest first,\" you get a predictable line-up.",
        body: [],
        richBody: [
          {
            kind: "steps",
            title: "How to use it",
            items: [
              {
                title: "Pick the column to sort by",
                detail: "Goes after WHERE. Default direction is ascending (smallest to largest, A to Z, oldest to newest).",
                code: "SELECT name, age FROM customers ORDER BY age;",
              },
              {
                title: "Flip with DESC for descending",
                detail: "Largest to smallest, Z to A, newest to oldest.",
                code: "SELECT name, age FROM customers ORDER BY age DESC;",
              },
              {
                title: "Sort by multiple columns",
                detail: "Separate with commas. The second column breaks ties from the first.",
                code: "SELECT name, age FROM customers ORDER BY age DESC, name ASC;",
              },
            ],
          },
          {
            kind: "callout",
            tone: "tip",
            text: "Want \"the top 5\"? Combine ORDER BY with LIMIT (next topic): order from highest to lowest, then take the first 5.",
          },
          {
            kind: "callout",
            tone: "note",
            text: "NULL values sort last by default in Postgres. Override with `ORDER BY col NULLS FIRST` or `NULLS LAST`.",
          },
        ],
        examples: [],
      },
      {
        id: "limit-offset",
        title: "LIMIT and OFFSET — keep only N rows",
        blurb: "Take just the first N rows, or paginate through a long result.",
        bigIdea:
          "LIMIT N stops after N rows. OFFSET N skips the first N. Together, they let you paginate.",
        realWorld:
          "Like scrolling through a long Instagram feed. LIMIT is \"show me 20 at a time.\" OFFSET is \"I've seen the first 40; show me 41 through 60.\"",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "The two parts",
            items: [
              "LIMIT 10 — keep the first 10 rows of the result.",
              "OFFSET 20 — skip the first 20 rows before counting.",
              "Combined: `LIMIT 10 OFFSET 20` = rows 21-30.",
            ],
          },
          {
            kind: "callout",
            tone: "warning",
            text: "Always pair LIMIT with ORDER BY. Without an order, \"the first 10\" is undefined — the database can give different rows each run.",
          },
          {
            kind: "steps",
            title: "Common patterns",
            items: [
              {
                title: "Top 5 by some metric",
                detail: "Order high to low, then take the top.",
                code: "SELECT name, total_amount\nFROM orders\nORDER BY total_amount DESC\nLIMIT 5;",
              },
              {
                title: "Page through results",
                detail: "Page 1 is `LIMIT 20 OFFSET 0`, page 2 is `OFFSET 20`, page 3 is `OFFSET 40`...",
                code: "-- page 3 of customers, 20 per page\nSELECT * FROM customers ORDER BY id LIMIT 20 OFFSET 40;",
              },
            ],
          },
        ],
        examples: [],
      },
      {
        id: "distinct",
        title: "DISTINCT",
        blurb: "Remove duplicate rows from the result.",
        body: [
          "DISTINCT collapses identical result rows into one. It applies to all selected columns together, not just the first one.",
          "If you only want distinct values of a single column, project just that column.",
        ],
        examples: [
          {
            code: "SELECT DISTINCT country\nFROM customers\nORDER BY country;",
            note: "Every country that appears at least once.",
          },
        ],
      },
      {
        id: "nulls",
        title: "NULL — the missing value",
        blurb: "NULL is not equal to anything, not even itself.",
        body: [
          "NULL means 'unknown'. Any comparison with NULL is NULL (not TRUE, not FALSE). So `age = NULL` never matches anything. Use `age IS NULL` or `age IS NOT NULL`.",
          "Aggregates skip NULLs: `COUNT(age)` counts rows where age isn't NULL. `COUNT(*)` counts all rows.",
        ],
        examples: [
          {
            code: "-- find customers with unknown age\nSELECT name FROM customers WHERE age IS NULL;",
          },
          {
            code: "-- replace NULL with a default\nSELECT name, COALESCE(age, 0) AS age\nFROM customers;",
          },
        ],
        practiceConcept: "null_handling",
      },
      {
        id: "comparison-boolean",
        title: "Comparison and boolean operators",
        blurb: "The vocabulary inside WHERE.",
        body: [
          "Comparison: `=`, `<>` (or `!=`), `<`, `<=`, `>`, `>=`. Boolean: `AND`, `OR`, `NOT`. Precedence runs NOT > AND > OR — when in doubt, parenthesize.",
          "Use `IS DISTINCT FROM` / `IS NOT DISTINCT FROM` if you want NULL-safe equality (treats NULL = NULL as true, unlike plain `=`).",
        ],
        examples: [
          {
            code: "SELECT *\nFROM orders\nWHERE (status = 'completed' OR status = 'shipped')\n  AND total_amount > 100\n  AND order_date IS NOT NULL;",
          },
        ],
      },
      {
        id: "like-ilike",
        title: "LIKE and ILIKE patterns",
        blurb: "Wildcard pattern matching, case-sensitive (LIKE) or not (ILIKE).",
        body: [
          "`%` matches any number of characters, `_` matches exactly one. ILIKE is the case-insensitive version. For real regex use `~` (or `~*` for case-insensitive).",
          "`ESCAPE` lets you escape literal `%` or `_` — handy when you actually want to match those characters.",
        ],
        examples: [
          {
            code: "-- emails on gmail\nSELECT email FROM customers WHERE email ILIKE '%@gmail.com';\n-- names starting with 'A' followed by exactly two more characters\nSELECT name FROM customers WHERE name LIKE 'A__';",
          },
        ],
        practiceConcept: "string_functions",
      },
      {
        id: "in-between",
        title: "IN, NOT IN, BETWEEN",
        blurb: "Cleaner alternatives to long OR chains.",
        body: [
          "`x IN (a, b, c)` is shorthand for `x = a OR x = b OR x = c`. `BETWEEN a AND b` is `x >= a AND x <= b` (inclusive on both ends).",
          "Careful with `NOT IN` and NULLs — if the list contains a NULL, `NOT IN` returns NULL (not TRUE) for every row, so you get an empty result. Use `NOT EXISTS` or filter NULLs out first.",
        ],
        examples: [
          {
            code: "SELECT * FROM customers WHERE country IN ('Canada', 'Mexico', 'Brazil');\nSELECT * FROM orders WHERE order_date BETWEEN '2024-01-01' AND '2024-12-31';",
          },
        ],
      },
      {
        id: "calculated-columns",
        title: "Calculated columns and expressions",
        blurb: "SELECT can produce columns that don't exist in the table.",
        body: [
          "Anywhere you'd put a column, you can put an expression: arithmetic, function calls, CASE, concatenation. Give it a name with AS.",
          "This is how you compute totals, format strings, bucket values, or compare two columns inline — without touching the underlying table.",
        ],
        examples: [
          {
            code: "SELECT order_id,\n       quantity * unit_price AS line_total,\n       UPPER(product_name) AS product\nFROM order_items;",
          },
        ],
      },
    ],
  },

  // ── Module 3: Aggregating data ───────────────────────────────────────────
  {
    id: "aggregating",
    title: "Aggregating data",
    description: "Collapse many rows into one summary number — counts, sums, averages, grouped.",
    topics: [
      {
        id: "aggregate-funcs",
        title: "Aggregate functions",
        blurb: "Collapse many rows into one number.",
        bigIdea:
          "Aggregates take a whole column of values and produce one summary value — a count, a sum, an average.",
        realWorld:
          "Like asking a classroom for their ages. Instead of getting back 30 numbers, you ask one question and get one answer: \"What's the average?\" or \"How many of you are over 18?\"",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "The five everyday aggregates",
            items: [
              "COUNT — how many rows. `COUNT(*)` counts every row, including ones with NULL.",
              "SUM — adds up a numeric column.",
              "AVG — the average of a numeric column.",
              "MIN — smallest value. Works for numbers, dates, even text (alphabetical).",
              "MAX — largest value.",
            ],
          },
          {
            kind: "code",
            code: "SELECT COUNT(*)      AS total_customers,\n       COUNT(age)    AS customers_with_age,\n       AVG(age)      AS avg_age,\n       MIN(signup_date) AS earliest_signup,\n       MAX(signup_date) AS latest_signup\nFROM customers;",
            note: "All in one query. Returns a single row with five columns.",
          },
          {
            kind: "callout",
            tone: "note",
            text: "COUNT has three flavors: COUNT(*) counts rows. COUNT(col) counts rows where col is not NULL. COUNT(DISTINCT col) counts how many UNIQUE non-NULL values there are.",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "Aggregates ignore NULLs (except COUNT(*)). AVG of [10, NULL, 30] is 20, not 13.3 — the NULL is skipped entirely.",
          },
        ],
        examples: [],
        practiceConcept: "aggregations",
      },
      {
        id: "group-by",
        title: "GROUP BY — one summary row per group",
        blurb: "Bucket rows that share a value, then aggregate within each bucket.",
        bigIdea:
          "Without GROUP BY, an aggregate collapses ALL rows into one. With GROUP BY country, you get one row per country instead.",
        realWorld:
          "Imagine a teacher counting students by grade. Without GROUP BY: \"125 students total.\" With GROUP BY grade: \"Grade 7: 40, Grade 8: 42, Grade 9: 43.\" Same students, summarized per bucket.",
        body: [],
        richBody: [
          {
            kind: "tablePair",
            caption: "GROUP BY country → one row per group",
            arrow: "→",
            left: {
              caption: "customers (before)",
              columns: ["id", "name", "country"],
              rows: [
                [1, "Ava", "Canada"],
                [2, "Liam", "Japan"],
                [3, "Maya", "Canada"],
                [4, "Theo", "France"],
                [5, "Sora", "Japan"],
              ],
            },
            right: {
              caption: "GROUP BY country, COUNT(*)",
              columns: ["country", "count"],
              rows: [
                ["Canada", 2],
                ["France", 1],
                ["Japan", 2],
              ],
            },
          },
          {
            kind: "steps",
            title: "How it works",
            items: [
              {
                title: "Pick a column to group by",
                detail: "Rows with the same value in that column become one bucket.",
                code: "GROUP BY country",
              },
              {
                title: "Add aggregates to the SELECT",
                detail: "Each aggregate is computed per group, not across the whole table.",
                code: "SELECT country, COUNT(*) AS customer_count\nFROM customers\nGROUP BY country;",
              },
              {
                title: "Optionally sort or limit the groups",
                detail: "ORDER BY after GROUP BY works on the grouped result.",
                code: "SELECT country, COUNT(*) AS customer_count\nFROM customers\nGROUP BY country\nORDER BY customer_count DESC\nLIMIT 5;",
              },
            ],
          },
          {
            kind: "callout",
            tone: "warning",
            text: "Every column in your SELECT must either be in the GROUP BY OR wrapped in an aggregate. Otherwise the database doesn't know which row's value to pick from each group.",
          },
          {
            kind: "p",
            text: "You can group by more than one column. Each unique combination becomes a bucket.",
          },
          {
            kind: "code",
            code: "-- one row per (country, year)\nSELECT country, EXTRACT(YEAR FROM signup_date) AS year, COUNT(*)\nFROM customers\nGROUP BY country, year\nORDER BY country, year;",
          },
        ],
        examples: [],
        practiceConcept: "group_by",
      },
      {
        id: "having",
        title: "HAVING — filter groups",
        blurb: "Like WHERE, but runs after GROUP BY.",
        body: [
          "WHERE filters rows before grouping. HAVING filters groups after aggregating. You need HAVING when your condition involves an aggregate.",
          "Wrong: `WHERE COUNT(*) > 5` — WHERE can't see aggregates. Right: `HAVING COUNT(*) > 5`.",
        ],
        examples: [
          {
            code: "SELECT country, COUNT(*) AS n\nFROM customers\nGROUP BY country\nHAVING COUNT(*) >= 10\nORDER BY n DESC;",
            note: "Only countries with 10+ customers.",
          },
        ],
        practiceConcept: "having",
      },
      {
        id: "aggregate-edge-cases",
        title: "Aggregate edge cases",
        blurb: "NULLs, empty groups, DISTINCT.",
        body: [
          "Aggregates ignore NULLs (except COUNT(*)). AVG over a column where half the values are NULL averages just the non-NULL half.",
          "When a query returns zero rows, MIN/MAX/SUM return NULL — even for SUM, where 'no rows' is arguably 0. Use COALESCE to substitute.",
        ],
        examples: [
          {
            code: "-- safe sum that returns 0 instead of NULL\nSELECT COALESCE(SUM(total_amount), 0)\nFROM orders\nWHERE status = 'completed';",
          },
        ],
      },
      {
        id: "string-array-agg",
        title: "STRING_AGG and ARRAY_AGG",
        blurb: "Aggregate many rows into one delimited string or one array.",
        body: [
          "STRING_AGG(col, ', ') collects values into a comma-separated string. ARRAY_AGG(col) collects them into a Postgres array. Both respect GROUP BY and accept ORDER BY inside the call to control the order of items.",
          "Great for 'show me the list of X per Y' queries — items per order, tags per article, members per team.",
        ],
        examples: [
          {
            code: "SELECT o.id, STRING_AGG(oi.product_name, ', ' ORDER BY oi.product_name) AS products\nFROM orders o\nJOIN order_items oi ON oi.order_id = o.id\nGROUP BY o.id;",
          },
        ],
        practiceConcept: "aggregations",
      },
      {
        id: "filter-clause",
        title: "FILTER — conditional aggregates",
        blurb: "Aggregate only the rows that match a per-aggregate condition.",
        body: [
          "`AGG(col) FILTER (WHERE condition)` includes only rows that pass the condition. Cleaner and faster than `SUM(CASE WHEN condition THEN col END)` for the same effect.",
          "Use it to compute multiple aggregates side-by-side with different filters — perfect for pivot-style result tables.",
        ],
        examples: [
          {
            code: "SELECT customer_id,\n       COUNT(*) FILTER (WHERE status = 'completed') AS completed,\n       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,\n       SUM(total_amount) FILTER (WHERE status = 'completed') AS revenue\nFROM orders\nGROUP BY customer_id;",
          },
        ],
        practiceConcept: "aggregations",
      },
      {
        id: "grouping-sets",
        title: "ROLLUP, CUBE, GROUPING SETS",
        blurb: "Multiple group levels in one query.",
        body: [
          "ROLLUP adds subtotal rows up a hierarchy. CUBE adds subtotals for every combination of group columns. GROUPING SETS lets you specify exact group combinations.",
          "Useful for report-style queries that need totals at multiple levels in one pass — e.g., per category, per region, and grand total.",
        ],
        examples: [
          {
            code: "-- per (country, year), per country, and grand total in one query\nSELECT country, EXTRACT(YEAR FROM signup_date) AS year, COUNT(*) AS n\nFROM customers\nGROUP BY ROLLUP (country, year);",
          },
        ],
      },
    ],
  },

  // ── Module 4: Joining tables ────────────────────────────────────────────
  {
    id: "joining",
    title: "Joining tables",
    description: "Combine rows across tables on a shared key — the core skill.",
    topics: [
      {
        id: "join-mental-model",
        title: "The join mental model",
        blurb: "Glue two tables together where they share a value.",
        bigIdea:
          "A JOIN pairs up rows from two tables based on a matching column. Each pair becomes one wider row in the result.",
        realWorld:
          "Like matching homework sheets to students. You have a stack of homework, each marked with a student ID. You have a class list with student IDs and names. JOIN them on the ID and you get one row per homework, with the student's name attached.",
        body: [],
        richBody: [
          {
            kind: "steps",
            title: "What a JOIN does, step by step",
            items: [
              {
                title: "Start with the left table",
                detail: "Look at the first row.",
              },
              {
                title: "Find matches in the right table",
                detail: "Scan the right table for any row where the join condition is true. Often that condition is `left.id = right.foreign_id`.",
              },
              {
                title: "Stitch each match into a wider row",
                detail: "For each match, output one row that combines columns from both tables.",
              },
              {
                title: "Move to the next left row, repeat",
                detail: "If a left row has 3 matches, you get 3 output rows for it. If it has 0 matches, the behavior depends on the JOIN type (INNER vs LEFT, coming up).",
              },
            ],
          },
          {
            kind: "code",
            code: "SELECT c.name, o.order_date, o.total_amount\nFROM customers c\nJOIN orders o ON o.customer_id = c.id;",
            note: "For every order, attach the customer's name. One result row per (customer, order) pair.",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "The ON clause is where the matching condition lives. Almost always it's an equality between a primary key on one side and a foreign key on the other.",
          },
        ],
        examples: [],
        practiceConcept: "joins",
      },
      {
        id: "inner-join",
        title: "INNER JOIN",
        blurb: "Keep only rows that have a match on BOTH sides.",
        bigIdea:
          "INNER JOIN drops rows that don't have a partner. If a customer never ordered, they vanish from the result.",
        realWorld:
          "Imagine pairing up dance partners. INNER JOIN: anyone without a partner sits out. Just the matched pairs are on the floor.",
        body: [],
        richBody: [
          {
            kind: "venn",
            type: "inner",
            leftLabel: "customers",
            rightLabel: "orders",
            caption: "INNER JOIN",
            legend: "Only rows where both sides match — the overlap.",
          },
          {
            kind: "p",
            text: "Plain `JOIN` and `INNER JOIN` mean the same thing — the most common kind of join.",
          },
          {
            kind: "tablePair",
            caption: "customers JOIN orders ON customer_id = id",
            arrow: "→",
            left: {
              caption: "customers + orders",
              columns: ["customer_id", "name", "order_id", "amount"],
              rows: [
                [1, "Ava", 100, 50],
                [1, "Ava", 101, 30],
                [2, "Liam", null, null],
                [3, "Maya", 102, 80],
              ],
              rowHighlights: { 0: "match", 1: "match", 2: "drop", 3: "match" },
              note: "Liam never ordered — that row will be dropped.",
            },
            right: {
              caption: "result",
              columns: ["customer_id", "name", "order_id", "amount"],
              rows: [
                [1, "Ava", 100, 50],
                [1, "Ava", 101, 30],
                [3, "Maya", 102, 80],
              ],
              rowHighlights: { 0: "match", 1: "match", 2: "match" },
            },
          },
          {
            kind: "code",
            code: "SELECT c.name, o.order_date\nFROM customers c\nINNER JOIN orders o ON o.customer_id = c.id;",
            note: "Customers with zero orders disappear from the result.",
          },
          {
            kind: "bullets",
            title: "When to reach for INNER JOIN",
            items: [
              "You only care about the matched cases — \"customers who actually placed orders\".",
              "You're piecing together info that has to exist on both sides — like a name from one table and a date from another.",
              "You DON'T care about the rows that have nothing on the other side.",
            ],
          },
          {
            kind: "callout",
            tone: "warning",
            text: "If you're counting customers and used INNER JOIN to orders, you'll undercount — customers with zero orders are silently dropped. Use LEFT JOIN (next topic) when you need every customer to appear.",
          },
        ],
        examples: [],
        practiceConcept: "joins",
      },
      {
        id: "left-join",
        title: "LEFT JOIN",
        blurb: "Keep every row on the left, match-or-not.",
        bigIdea:
          "LEFT JOIN preserves every row from the left table. If a left row has no match on the right, the right columns come back as NULL.",
        realWorld:
          "Back to the dance partners. LEFT JOIN: everyone on the left is on the dance floor. The ones with a partner are paired; the ones without dance alone — their \"partner\" slot is empty (NULL).",
        body: [],
        richBody: [
          {
            kind: "venn",
            type: "left",
            leftLabel: "customers",
            rightLabel: "orders",
            caption: "LEFT JOIN",
            legend: "Every customer kept. Right side is NULL when nothing matches.",
          },
          {
            kind: "tablePair",
            caption: "customers LEFT JOIN orders",
            arrow: "→",
            left: {
              caption: "customers",
              columns: ["id", "name"],
              rows: [
                [1, "Ava"],
                [2, "Liam"],
                [3, "Maya"],
              ],
            },
            right: {
              caption: "result (orders attached or NULL)",
              columns: ["id", "name", "order_id", "amount"],
              rows: [
                [1, "Ava", 100, 50],
                [1, "Ava", 101, 30],
                [2, "Liam", null, null],
                [3, "Maya", 102, 80],
              ],
              rowHighlights: { 2: "new" },
              note: "Liam stays in the result — his order columns are NULL.",
            },
          },
          {
            kind: "compare",
            caption: "INNER vs LEFT — when to use which",
            left: {
              title: "INNER JOIN",
              items: [
                "Drops left rows with no match",
                "Use when you only care about the intersection",
                "Right answer for \"customers who actually ordered\"",
              ],
            },
            right: {
              title: "LEFT JOIN",
              items: [
                "Keeps every left row, right columns NULL when no match",
                "Use when zero-count rows are meaningful",
                "Right answer for \"every customer with their order count\"",
              ],
            },
          },
          {
            kind: "steps",
            title: "Two killer use cases",
            items: [
              {
                title: "Counting things that might be zero",
                detail: "Show every customer with their order count, including customers who placed zero orders.",
                code: "SELECT c.name, COUNT(o.id) AS order_count\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name;",
              },
              {
                title: "Finding rows with NO match",
                detail: "LEFT JOIN, then WHERE the right side IS NULL. That's the rows where nothing matched. Classic \"customers who never ordered\" query.",
                code: "SELECT c.name\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL;",
              },
            ],
          },
          {
            kind: "callout",
            tone: "tip",
            text: "Notice `COUNT(o.id)` not `COUNT(*)`. With LEFT JOIN, COUNT(*) includes the NULL-filled rows (one per customer-no-orders), counting them as 1. COUNT(o.id) only counts rows where o.id isn't NULL, which is what you actually want.",
          },
          {
            kind: "callout",
            tone: "note",
            text: "RIGHT JOIN is the mirror image — preserves every row on the right. In practice, almost everyone just swaps the table order and uses LEFT JOIN, since it reads more naturally.",
          },
        ],
        examples: [],
        practiceConcept: "left_joins",
      },
      {
        id: "right-full-cross",
        title: "RIGHT, FULL OUTER, CROSS",
        blurb: "The less common joins.",
        bigIdea:
          "RIGHT mirrors LEFT (rarely used). FULL OUTER keeps everything from both sides. CROSS pairs every left row with every right row.",
        realWorld:
          "Back to dance partners. FULL OUTER: everyone is on the floor, paired or not — both sides preserved. CROSS: chaos. Every left person dances with every right person. 5×5 = 25 pairs.",
        body: [],
        richBody: [
          {
            kind: "venn",
            type: "full",
            leftLabel: "A",
            rightLabel: "B",
            caption: "FULL OUTER JOIN",
            legend: "Keep every row from both sides. NULLs fill the gaps.",
          },
          {
            kind: "callout",
            tone: "note",
            text: "RIGHT JOIN is just LEFT JOIN with the tables swapped. Almost no one writes RIGHT JOIN in real code — it reads more naturally to put the kept-everything side first and call it LEFT.",
          },
          {
            kind: "p",
            text: "CROSS JOIN has no ON clause. Every left row is paired with every right row. Result size = left_rows × right_rows. Useful for generating combinations (every size × every color = your full product catalog).",
          },
          {
            kind: "code",
            code: "-- every (size, color) combination\nSELECT s.size, c.color\nFROM sizes s CROSS JOIN colors c;",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "Accidental CROSS JOIN is a classic bug — if you forget the ON clause, some databases treat your INNER JOIN as a CROSS JOIN, multiplying your rows. Always include ON.",
          },
        ],
        examples: [],
      },
      {
        id: "self-join",
        title: "SELF JOIN",
        blurb: "Join a table to itself.",
        body: [
          "A self join is just a regular join where both sides are the same table — with different aliases. Useful when a table refers to itself (employees → manager, products → substitute).",
        ],
        examples: [
          {
            code: "-- employees with their manager's name\nSELECT e.name AS employee, m.name AS manager\nFROM employees e\nLEFT JOIN employees m ON m.id = e.manager_id;",
          },
        ],
        practiceConcept: "self_joins",
      },
      {
        id: "multi-table-joins",
        title: "Joining three or more tables",
        blurb: "Chain joins together.",
        body: [
          "Joins compose. After joining A to B, you can join the result to C. The ON clause for each step references whichever tables are already in scope.",
        ],
        examples: [
          {
            code: "SELECT c.name, o.order_date, oi.product_name, oi.quantity\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nJOIN order_items oi ON oi.order_id = o.id\nWHERE c.country = 'Canada';",
          },
        ],
        practiceConcept: "joins",
      },
      {
        id: "join-gotchas",
        title: "Common join gotchas",
        blurb: "Duplicate rows, NULL keys, fan-out.",
        body: [
          "If table B has multiple rows per A, joining A→B multiplies A's rows. Aggregations on the joined result will over-count. Aggregate inside a subquery first, then join.",
          "NULL FK columns never match in a JOIN — even with LEFT JOIN they appear with right columns as NULL. If that's wrong, COALESCE the key first.",
        ],
        examples: [
          {
            code: "-- Wrong: over-counts because joining items multiplies orders\nSELECT c.id, COUNT(*) FROM customers c\nJOIN orders o ON o.customer_id = c.id\nJOIN order_items oi ON oi.order_id = o.id\nGROUP BY c.id;",
          },
        ],
      },
      {
        id: "using-clause",
        title: "USING — a shorter ON",
        blurb: "When both tables have the same column name, USING is tidier.",
        body: [
          "`JOIN orders USING (customer_id)` is shorthand for `JOIN orders ON c.customer_id = o.customer_id`. The joined column shows up only once in the result instead of twice.",
          "Only works when the join column has the same name on both sides. Avoid NATURAL JOIN (joins on every same-named column automatically) — it's a footgun when schemas change.",
        ],
        examples: [
          {
            code: "SELECT name, order_date\nFROM customers c\nJOIN orders USING (customer_id);  -- only valid if both have customer_id",
          },
        ],
      },
      {
        id: "anti-joins",
        title: "Anti-joins — finding what's missing",
        blurb: "Rows on one side that have no match on the other.",
        body: [
          "The classic anti-join: LEFT JOIN B, then `WHERE B.id IS NULL`. Returns rows in A with no match in B. Use it to find customers who never ordered, products never sold, etc.",
          "NOT EXISTS is often clearer and handles NULLs more sensibly than NOT IN. Pick whichever reads best.",
        ],
        examples: [
          {
            code: "-- customers who never placed an order\nSELECT c.name\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL;\n\n-- same thing with NOT EXISTS\nSELECT c.name\nFROM customers c\nWHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.id);",
          },
        ],
        practiceConcept: "left_joins",
      },
      {
        id: "lateral-joins",
        title: "LATERAL — joins that see each row",
        blurb: "A subquery on the right side that can reference the row on the left.",
        body: [
          "LATERAL lets a JOIN's right-side subquery use columns from the left side. Without LATERAL the subquery is evaluated once; with LATERAL it runs per left row.",
          "The killer use case: top-N per group. For each customer, give me their 3 most recent orders — cleanly expressible with a LATERAL subquery + LIMIT.",
        ],
        examples: [
          {
            code: "-- each customer's 3 most recent orders\nSELECT c.name, o.order_date, o.total_amount\nFROM customers c\nJOIN LATERAL (\n  SELECT order_date, total_amount\n  FROM orders\n  WHERE customer_id = c.id\n  ORDER BY order_date DESC\n  LIMIT 3\n) o ON true;",
          },
        ],
      },
    ],
  },

  // ── Module 5: Advanced selection ─────────────────────────────────────────
  {
    id: "advanced-select",
    title: "Advanced selection",
    description: "Subqueries, correlated queries, EXISTS, ANY/ALL.",
    topics: [
      {
        id: "subqueries-where",
        title: "Subqueries in WHERE",
        blurb: "A query inside another query's filter.",
        body: [
          "A subquery in WHERE returns values that the outer WHERE compares against. Useful when the filter depends on another query's result.",
        ],
        examples: [
          {
            code: "-- customers who placed an order over $500\nSELECT name FROM customers\nWHERE id IN (\n  SELECT customer_id FROM orders WHERE total_amount > 500\n);",
          },
        ],
        practiceConcept: "subqueries",
      },
      {
        id: "scalar-subquery",
        title: "Scalar subqueries",
        blurb: "A subquery that returns exactly one value.",
        body: [
          "When a subquery returns one row, one column, you can use it like a single value — in SELECT, in WHERE comparisons, anywhere a literal goes.",
        ],
        examples: [
          {
            code: "-- compare each order to the overall average\nSELECT id, total_amount,\n       total_amount - (SELECT AVG(total_amount) FROM orders) AS delta_from_avg\nFROM orders;",
          },
        ],
        practiceConcept: "subqueries",
      },
      {
        id: "correlated-subquery",
        title: "Correlated subqueries",
        blurb: "An inner query that references the outer row.",
        body: [
          "Correlated subqueries reference a column from the outer query, so they re-evaluate for every outer row. Powerful but slow on large data — usually a JOIN or window function is faster.",
        ],
        examples: [
          {
            code: "-- customers whose latest order was over $200\nSELECT c.name\nFROM customers c\nWHERE 200 < (\n  SELECT MAX(o.total_amount) FROM orders o\n  WHERE o.customer_id = c.id\n);",
          },
        ],
        practiceConcept: "subqueries",
      },
      {
        id: "exists-vs-in",
        title: "EXISTS vs IN",
        blurb: "Two ways to ask 'does a match exist'.",
        body: [
          "EXISTS returns TRUE if its subquery returns any row. IN compares a value to a list. Both can answer 'does this customer have an order?' but EXISTS is often faster on large data and handles NULLs more sensibly.",
        ],
        examples: [
          {
            code: "SELECT name FROM customers c\nWHERE EXISTS (\n  SELECT 1 FROM orders o WHERE o.customer_id = c.id\n);",
            note: "Same answer as the IN version above, usually faster.",
          },
        ],
        practiceConcept: "subqueries",
      },
      {
        id: "subquery-in-from",
        title: "Subqueries in FROM (derived tables)",
        blurb: "Treat a subquery as a temporary table.",
        body: [
          "A subquery in FROM produces a virtual table the outer query joins or filters. Useful for pre-aggregating before joining, or building a multi-step transformation.",
          "Often clearer as a CTE (next module) — but FROM-subqueries are still idiomatic for one-shot intermediate results.",
        ],
        examples: [
          {
            code: "-- avg order total per country\nSELECT t.country, AVG(t.order_total) AS avg_order\nFROM (\n  SELECT c.country, o.total_amount AS order_total\n  FROM customers c JOIN orders o ON o.customer_id = c.id\n) t\nGROUP BY t.country;",
          },
        ],
        practiceConcept: "subqueries",
      },
      {
        id: "any-all",
        title: "ANY and ALL operators",
        blurb: "Compare a value to every row in a subquery.",
        body: [
          "`x > ANY (subquery)` is true if x exceeds at least one value the subquery returns. `x > ALL (subquery)` is true only if x exceeds every value.",
          "Often replaceable with MIN / MAX subqueries: `x > ALL (SELECT v FROM t)` is the same as `x > (SELECT MAX(v) FROM t)`.",
        ],
        examples: [
          {
            code: "-- customers older than every Canadian customer\nSELECT name, age FROM customers\nWHERE age > ALL (\n  SELECT age FROM customers WHERE country = 'Canada' AND age IS NOT NULL\n);",
          },
        ],
        practiceConcept: "subqueries",
      },
    ],
  },

  // ── Module 6: CTEs ───────────────────────────────────────────────────────
  {
    id: "ctes",
    title: "CTEs (WITH clause)",
    description: "Name a subquery so the rest of the query reads it like a table.",
    topics: [
      {
        id: "with-basic",
        title: "WITH — your first CTE",
        blurb: "A named temporary result, scoped to one query.",
        body: [
          "A Common Table Expression (CTE) is a subquery you give a name with the WITH keyword. The rest of the query reads it like a table. CTEs make complex queries readable by giving each step a name.",
        ],
        examples: [
          {
            code: "WITH order_totals AS (\n  SELECT customer_id, SUM(total_amount) AS total\n  FROM orders\n  GROUP BY customer_id\n)\nSELECT c.name, ot.total\nFROM customers c\nJOIN order_totals ot ON ot.customer_id = c.id\nORDER BY ot.total DESC;",
          },
        ],
        practiceConcept: "cte",
      },
      {
        id: "multiple-ctes",
        title: "Chaining multiple CTEs",
        blurb: "Each step is its own named block.",
        body: [
          "You can stack CTEs separated by commas. Each can reference any earlier CTE. This breaks gnarly queries into a readable pipeline.",
        ],
        examples: [
          {
            code: "WITH completed AS (\n  SELECT * FROM orders WHERE status = 'completed'\n),\ncustomer_totals AS (\n  SELECT customer_id, SUM(total_amount) AS total\n  FROM completed\n  GROUP BY customer_id\n)\nSELECT c.name, ct.total\nFROM customer_totals ct\nJOIN customers c ON c.id = ct.customer_id\nORDER BY ct.total DESC;",
          },
        ],
        practiceConcept: "cte",
      },
      {
        id: "recursive-cte",
        title: "Recursive CTEs",
        blurb: "Walk hierarchies and graphs.",
        body: [
          "Recursive CTEs let a CTE reference itself. They're how you traverse trees (org charts, threaded comments, category hierarchies) and graphs in SQL.",
          "The shape is: a base case (the seed), then a recursive case that builds on the previous step. Postgres runs it until no new rows are produced.",
        ],
        examples: [
          {
            code: "-- Build the full reporting chain for an employee\nWITH RECURSIVE chain AS (\n  SELECT id, name, manager_id, 1 AS depth\n  FROM employees WHERE id = 42\n  UNION ALL\n  SELECT e.id, e.name, e.manager_id, c.depth + 1\n  FROM employees e\n  JOIN chain c ON e.id = c.manager_id\n)\nSELECT * FROM chain ORDER BY depth;",
          },
        ],
        practiceConcept: "cte",
      },
      {
        id: "cte-vs-subquery",
        title: "CTE vs subquery: when to choose which",
        blurb: "CTEs name things; subqueries inline them.",
        body: [
          "Use a CTE when: the same subquery is referenced more than once, the logic deserves a name, or you're building a multi-step pipeline. Use a regular subquery when the logic is small and only used once.",
          "Postgres treats CTEs as 'optimization fences' less aggressively than it used to (since v12 they're inlinable). Don't worry about CTE performance until you've measured.",
        ],
        examples: [],
      },
    ],
  },

  // ── Module 7: Window functions ───────────────────────────────────────────
  {
    id: "window-functions",
    title: "Window functions",
    description: "Compute across rows without collapsing them — running totals, ranks, deltas.",
    topics: [
      {
        id: "window-intro",
        title: "What is a window function",
        blurb: "Aggregate-style math without losing your row detail.",
        body: [
          "A window function looks at a 'window' of rows around the current row and returns a value for the current row. Unlike GROUP BY, the original row stays in the result — you just get an extra column.",
          "The syntax is FUNCTION(...) OVER (PARTITION BY ... ORDER BY ...). PARTITION BY groups rows; ORDER BY orders within each group.",
        ],
        examples: [
          {
            code: "-- each order, plus the customer's total\nSELECT o.id, o.customer_id, o.total_amount,\n       SUM(o.total_amount) OVER (PARTITION BY o.customer_id) AS customer_total\nFROM orders o;",
            note: "Every order keeps its row; the new column repeats the total per customer.",
          },
        ],
        practiceConcept: "window_functions",
      },
      {
        id: "row-number-rank",
        title: "ROW_NUMBER, RANK, DENSE_RANK",
        blurb: "Numbering rows within a partition.",
        body: [
          "ROW_NUMBER gives every row a unique sequential number. RANK skips numbers after ties (1, 2, 2, 4). DENSE_RANK doesn't skip (1, 2, 2, 3).",
          "All three need ORDER BY inside the OVER — they need to know what 'first' means.",
        ],
        examples: [
          {
            code: "-- each customer's most recent order\nWITH ranked AS (\n  SELECT o.*, ROW_NUMBER() OVER (\n    PARTITION BY customer_id ORDER BY order_date DESC\n  ) AS rn\n  FROM orders o\n)\nSELECT * FROM ranked WHERE rn = 1;",
            note: "Classic 'top-N per group' pattern.",
          },
        ],
        practiceConcept: "window_functions",
      },
      {
        id: "lag-lead",
        title: "LAG and LEAD",
        blurb: "See the previous or next row's value.",
        body: [
          "LAG(col) gives you col from the previous row in the partition; LEAD(col) gives you col from the next row. Both need ORDER BY in the OVER.",
          "Used for: deltas (this period − last period), gap detection, sessionization.",
        ],
        examples: [
          {
            code: "-- days between consecutive orders for each customer\nSELECT customer_id, order_date,\n       order_date - LAG(order_date) OVER (\n         PARTITION BY customer_id ORDER BY order_date\n       ) AS days_since_last\nFROM orders;",
          },
        ],
        practiceConcept: "window_functions",
      },
      {
        id: "running-totals",
        title: "Running totals and moving averages",
        blurb: "SUM/AVG OVER (ORDER BY ...) accumulates across rows.",
        body: [
          "When you add ORDER BY to a SUM OVER without PARTITION BY, it becomes a running total — each row's value is the sum so far. Add PARTITION BY to reset per group.",
        ],
        examples: [
          {
            code: "-- cumulative revenue by day\nSELECT order_date, total_amount,\n       SUM(total_amount) OVER (ORDER BY order_date) AS running_total\nFROM orders\nORDER BY order_date;",
          },
        ],
        practiceConcept: "window_functions",
      },
      {
        id: "window-frames",
        title: "Window frames (ROWS / RANGE BETWEEN)",
        blurb: "Control which rows the window actually covers.",
        body: [
          "By default, `SUM(x) OVER (ORDER BY d)` covers all rows from the start of the partition to the current row. You can override with a frame: `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW` looks at the current row and the two before it.",
          "Frames unlock moving averages, sliding sums, and time-window aggregates.",
        ],
        examples: [
          {
            code: "-- 7-day moving average of daily revenue\nSELECT order_date,\n       AVG(total_amount) OVER (\n         ORDER BY order_date\n         ROWS BETWEEN 6 PRECEDING AND CURRENT ROW\n       ) AS avg_7d\nFROM orders;",
          },
        ],
        practiceConcept: "window_functions",
      },
      {
        id: "first-last-value",
        title: "FIRST_VALUE, LAST_VALUE, NTH_VALUE",
        blurb: "Grab a specific row's value from within a window.",
        body: [
          "FIRST_VALUE picks the first row in the window, LAST_VALUE the last, NTH_VALUE the Nth. They need ORDER BY in the OVER to know what 'first' means.",
          "Watch out: LAST_VALUE's default frame ends at the current row, so it often returns the current value, not the actual last. Fix with `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`.",
        ],
        examples: [
          {
            code: "-- each order, plus this customer's first-ever order date\nSELECT o.id, o.customer_id, o.order_date,\n       FIRST_VALUE(order_date) OVER (\n         PARTITION BY customer_id ORDER BY order_date\n       ) AS first_order\nFROM orders o;",
          },
        ],
        practiceConcept: "window_functions",
      },
      {
        id: "ntile",
        title: "NTILE — bucketing rows into N groups",
        blurb: "Slice your data into equal-sized buckets.",
        body: [
          "NTILE(n) splits the ordered partition into n buckets and labels each row with its bucket number (1..n). Great for percentile / quartile / decile analysis.",
        ],
        examples: [
          {
            code: "-- tag each customer with their revenue quartile\nSELECT customer_id, total,\n       NTILE(4) OVER (ORDER BY total DESC) AS quartile\nFROM (SELECT customer_id, SUM(total_amount) AS total FROM orders GROUP BY 1) t;",
          },
        ],
        practiceConcept: "window_functions",
      },
    ],
  },

  // ── Module 8: Strings, dates, conditionals ──────────────────────────────
  {
    id: "strings-dates-conditionals",
    title: "Strings, dates, conditionals",
    description: "The everyday utility belt: string transforms, date math, CASE, COALESCE, casts.",
    topics: [
      {
        id: "string-functions",
        title: "String functions",
        blurb: "CONCAT, SUBSTRING, UPPER, TRIM, LIKE, regex.",
        body: [
          "Common string operations: `||` or CONCAT to join, LENGTH for character count, UPPER/LOWER/INITCAP for case, TRIM to strip whitespace, SUBSTRING(s, start, len) to slice.",
          "Pattern match: LIKE for SQL wildcards (%, _), ILIKE for case-insensitive. For real regex use `~` or `~*`.",
        ],
        examples: [
          {
            code: "SELECT name,\n       UPPER(name) AS shouty,\n       SUBSTRING(email, 1, POSITION('@' IN email) - 1) AS local_part\nFROM customers;",
          },
        ],
        practiceConcept: "string_functions",
      },
      {
        id: "date-functions",
        title: "Date and time functions",
        blurb: "EXTRACT, DATE_TRUNC, intervals, NOW().",
        body: [
          "Postgres has rich date support. EXTRACT(field FROM ts) pulls a part (year, month, dow). DATE_TRUNC('month', ts) zeros out everything below the month — perfect for grouping.",
          "Date arithmetic uses INTERVAL: `order_date + INTERVAL '7 days'`. AGE(ts1, ts2) gives a human-friendly duration.",
        ],
        examples: [
          {
            code: "-- monthly signup counts for the last year\nSELECT DATE_TRUNC('month', signup_date) AS month, COUNT(*)\nFROM customers\nWHERE signup_date >= NOW() - INTERVAL '1 year'\nGROUP BY month\nORDER BY month;",
          },
        ],
        practiceConcept: "date_functions",
      },
      {
        id: "case-when",
        title: "CASE WHEN — conditional logic",
        blurb: "If/else inside a query.",
        body: [
          "CASE lets you branch in a SELECT or WHERE. Useful for bucketing, simple categorization, and computing pivot columns.",
        ],
        examples: [
          {
            code: "SELECT name,\n       CASE\n         WHEN age < 18 THEN 'minor'\n         WHEN age < 65 THEN 'adult'\n         ELSE 'senior'\n       END AS life_stage\nFROM customers;",
          },
        ],
        practiceConcept: "case_when",
      },
      {
        id: "coalesce-nullif",
        title: "COALESCE and NULLIF",
        blurb: "Tame NULL in two directions.",
        body: [
          "COALESCE(a, b, c) returns the first non-NULL of its arguments. Great for defaulting NULLs to something sensible.",
          "NULLIF(a, b) returns NULL if a = b, else a. Often used to convert sentinel values (like 0 or '') back to true NULL before computation.",
        ],
        examples: [
          {
            code: "SELECT name,\n       COALESCE(age, 0) AS age,\n       NULLIF(country, '') AS country_clean\nFROM customers;",
          },
        ],
        practiceConcept: "null_handling",
      },
      {
        id: "type-casts",
        title: "Type casts",
        blurb: "Convert between data types — :: or CAST().",
        body: [
          "Postgres has two cast syntaxes: SQL-standard `CAST(x AS TYPE)` and Postgres shorthand `x::TYPE`. They do the same thing.",
          "Common needs: text-to-number, number-to-text, integer-to-numeric for safe division, date strings to DATE.",
        ],
        examples: [
          {
            code: "-- safe integer division: integer / integer drops decimals\nSELECT SUM(quantity)::numeric / COUNT(*)::numeric AS avg_per_order\nFROM order_items;",
          },
        ],
      },
      {
        id: "regex",
        title: "Regular expressions",
        blurb: "When LIKE isn't enough.",
        body: [
          "Postgres has full regex support via `~` (matches), `~*` (case-insensitive match), `!~` (doesn't match). Functions: `regexp_replace`, `regexp_matches`, `regexp_split_to_array`.",
          "Reach for regex when you need character classes, anchors, alternation, or capture groups — anything beyond `%` and `_`.",
        ],
        examples: [
          {
            code: "-- emails with a numeric local part\nSELECT email FROM customers WHERE email ~ '^[0-9]+@';\n\n-- extract domain\nSELECT regexp_replace(email, '^.*@', '') AS domain FROM customers;",
          },
        ],
        practiceConcept: "string_functions",
      },
      {
        id: "time-zones",
        title: "Time zones",
        blurb: "TIMESTAMP vs TIMESTAMPTZ — pick TIMESTAMPTZ.",
        body: [
          "TIMESTAMP stores 'wall clock' time with no zone — ambiguous. TIMESTAMPTZ stores an absolute UTC instant and converts to your session's zone on display. Almost always use TIMESTAMPTZ.",
          "Convert with `AT TIME ZONE`: `ts AT TIME ZONE 'America/New_York'` returns the wall-clock time in that zone.",
        ],
        examples: [
          {
            code: "-- group orders by local-time day in New York\nSELECT DATE_TRUNC('day', order_ts AT TIME ZONE 'America/New_York') AS local_day, COUNT(*)\nFROM orders\nGROUP BY 1;",
          },
        ],
        practiceConcept: "date_functions",
      },
      {
        id: "generate-series",
        title: "generate_series — build a row stream",
        blurb: "Generate a sequence of numbers or dates as rows.",
        body: [
          "`generate_series(start, stop, step)` produces a row per value. Used everywhere: filling date gaps in time-series, generating test data, doing math you'd otherwise need a loop for.",
          "Combine with LEFT JOIN to ensure every day/month has a row even if there's no activity (gap fill).",
        ],
        examples: [
          {
            code: "-- daily order count, with zeros for days with no orders\nWITH days AS (\n  SELECT generate_series('2025-01-01'::date, '2025-01-31'::date, '1 day') AS day\n)\nSELECT d.day, COUNT(o.id) AS orders\nFROM days d\nLEFT JOIN orders o ON o.order_date = d.day\nGROUP BY d.day\nORDER BY d.day;",
          },
        ],
        practiceConcept: "date_functions",
      },
    ],
  },

  // ── Module 9: Set operations ────────────────────────────────────────────
  {
    id: "set-operations",
    title: "Set operations",
    description: "Combine the results of two queries — union, intersection, difference.",
    topics: [
      {
        id: "union",
        title: "UNION and UNION ALL",
        blurb: "Stack two result sets together.",
        body: [
          "UNION combines two queries into one result, removing duplicate rows. UNION ALL keeps duplicates — faster and almost always what you want unless you specifically need dedup.",
          "Both queries must return the same number of columns with compatible types.",
        ],
        examples: [
          {
            code: "SELECT id, name, 'customer' AS source FROM customers\nUNION ALL\nSELECT id, name, 'vendor' AS source FROM vendors;",
          },
        ],
        practiceConcept: "set_operations",
      },
      {
        id: "intersect-except",
        title: "INTERSECT and EXCEPT",
        blurb: "Rows in both / in one but not the other.",
        body: [
          "INTERSECT returns rows that appear in both queries. EXCEPT returns rows from the first query that don't appear in the second.",
        ],
        examples: [
          {
            code: "-- emails that appear as both customer and vendor\nSELECT email FROM customers\nINTERSECT\nSELECT email FROM vendors;",
          },
        ],
        practiceConcept: "set_operations",
      },
    ],
  },

  // ── Module 10: Modifying data ───────────────────────────────────────────
  {
    id: "modifying-data",
    title: "Modifying data",
    description: "INSERT, UPDATE, DELETE, UPSERT, and transactions.",
    topics: [
      {
        id: "insert",
        title: "INSERT",
        blurb: "Add new rows.",
        body: [
          "INSERT INTO table (cols...) VALUES (...). You can insert one row, many rows, or the result of a SELECT.",
        ],
        examples: [
          {
            code: "INSERT INTO customers (name, email, country)\nVALUES ('Ada Lovelace', 'ada@example.com', 'United Kingdom');",
          },
          {
            code: "-- insert from a query\nINSERT INTO archived_orders\nSELECT * FROM orders WHERE order_date < '2024-01-01';",
          },
        ],
      },
      {
        id: "update",
        title: "UPDATE",
        blurb: "Change existing rows.",
        body: [
          "UPDATE table SET col = value WHERE ... — without WHERE you update EVERY row. Always test the WHERE as a SELECT first.",
        ],
        examples: [
          {
            code: "UPDATE customers\nSET country = 'United States'\nWHERE country = 'USA';",
          },
        ],
      },
      {
        id: "delete",
        title: "DELETE",
        blurb: "Remove rows.",
        body: [
          "DELETE FROM table WHERE ... — same warning as UPDATE: without WHERE you delete EVERYTHING. Run as SELECT first.",
        ],
        examples: [
          {
            code: "DELETE FROM orders WHERE status = 'cancelled' AND order_date < '2023-01-01';",
          },
        ],
      },
      {
        id: "upsert",
        title: "UPSERT (ON CONFLICT)",
        blurb: "Insert if new, update if exists.",
        body: [
          "INSERT ... ON CONFLICT (col) DO UPDATE SET ... — a Postgres-specific shorthand for 'try to insert; if a key collides, update instead'.",
        ],
        examples: [
          {
            code: "INSERT INTO customers (email, name)\nVALUES ('ada@example.com', 'Ada Lovelace')\nON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name;",
          },
        ],
      },
      {
        id: "transactions",
        title: "Transactions",
        blurb: "Group changes — all-or-nothing.",
        body: [
          "Wrap statements in BEGIN ... COMMIT. If anything fails (or you ROLLBACK), the whole block is undone. Essential for multi-step changes that must succeed together (money transfers, inventory adjustments).",
        ],
        examples: [
          {
            code: "BEGIN;\nUPDATE accounts SET balance = balance - 100 WHERE id = 1;\nUPDATE accounts SET balance = balance + 100 WHERE id = 2;\nCOMMIT;",
          },
        ],
      },
      {
        id: "returning",
        title: "RETURNING — get values back from a write",
        blurb: "INSERT/UPDATE/DELETE can return the affected rows.",
        body: [
          "Append `RETURNING col1, col2, ...` to an INSERT, UPDATE, or DELETE to get those columns from the rows you changed — useful for getting auto-generated IDs back, logging deletions, or chaining writes.",
        ],
        examples: [
          {
            code: "INSERT INTO customers (name, email)\nVALUES ('Marie', 'marie@example.com')\nRETURNING id, signup_date;",
          },
        ],
      },
      {
        id: "truncate",
        title: "TRUNCATE vs DELETE",
        blurb: "Empty a table fast.",
        body: [
          "DELETE removes rows one-at-a-time and respects triggers + foreign keys. TRUNCATE drops everything in the table in one shot — much faster but more brutal: it bypasses triggers, can reset sequences, and requires you to handle dependent rows yourself (CASCADE).",
        ],
        examples: [
          {
            code: "TRUNCATE TABLE staging_orders RESTART IDENTITY CASCADE;",
          },
        ],
      },
      {
        id: "isolation-levels",
        title: "Transaction isolation levels",
        blurb: "How much your transaction can see of others'.",
        body: [
          "Postgres defaults to READ COMMITTED — each statement sees committed work as of when it ran. REPEATABLE READ gives the whole transaction a stable snapshot. SERIALIZABLE adds detection of conflicts that would violate true serial ordering.",
          "You usually don't need to think about this. When you do (money transfers, inventory adjustments with concurrent updates), reach for SERIALIZABLE and be ready to retry on serialization failure.",
        ],
        examples: [
          {
            code: "BEGIN ISOLATION LEVEL SERIALIZABLE;\n  -- ... statements ...\nCOMMIT;",
          },
        ],
      },
    ],
  },

  // ── Module 11: Schema design ────────────────────────────────────────────
  {
    id: "schema-design",
    title: "Schema design",
    description: "Designing tables: types, constraints, normalization.",
    topics: [
      {
        id: "create-table",
        title: "CREATE TABLE",
        blurb: "Define a new table.",
        body: [
          "CREATE TABLE defines a table with its columns and types. Add constraints inline (NOT NULL, DEFAULT, UNIQUE) or with separate CONSTRAINT clauses for keys.",
        ],
        examples: [
          {
            code: "CREATE TABLE products (\n  id SERIAL PRIMARY KEY,\n  name TEXT NOT NULL,\n  price NUMERIC(10,2) NOT NULL CHECK (price >= 0),\n  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);",
          },
        ],
      },
      {
        id: "constraints",
        title: "Constraints",
        blurb: "Rules the database enforces.",
        body: [
          "PRIMARY KEY (unique + not null), FOREIGN KEY (must point at a real row in another table), UNIQUE (no dups), NOT NULL (no missing), CHECK (custom predicate), DEFAULT (value when omitted).",
          "Constraints catch bugs early — they make whole classes of bad data impossible.",
        ],
        examples: [
          {
            code: "ALTER TABLE orders\nADD CONSTRAINT positive_total CHECK (total_amount >= 0);",
          },
        ],
      },
      {
        id: "normalization",
        title: "Normalization",
        blurb: "Don't repeat yourself in storage.",
        body: [
          "Normalization is the process of organizing tables so each fact is stored exactly once. 1NF: no nested values per cell. 2NF: every non-key column depends on the WHOLE primary key. 3NF: non-key columns don't depend on other non-key columns.",
          "In practice: store customer name in `customers` only — orders reference `customer_id`, never duplicate the name. If the name changes, you update one place.",
        ],
        examples: [],
      },
      {
        id: "denormalization",
        title: "Denormalization tradeoffs",
        blurb: "When to break the rules on purpose.",
        body: [
          "Normalized data is correct by construction but can be slow to query (joins everywhere). Denormalization — storing some redundant data — is a performance tradeoff for analytics, data warehouses, and read-heavy systems.",
          "Examples: precomputed aggregates, materialized views, snapshot tables. Always document why a column is denormalized and how it stays in sync.",
        ],
        examples: [],
      },
      {
        id: "alter-table",
        title: "ALTER TABLE — evolve the schema",
        blurb: "Add, drop, rename columns; change types; add/drop constraints.",
        body: [
          "Schemas aren't frozen. ALTER TABLE lets you adapt as requirements change: add a column, rename one, change a type, add an index later. Some operations are instant; others rewrite the whole table.",
          "Beware of locking on production tables — adding a NOT NULL column with a DEFAULT used to require a full rewrite, though modern Postgres avoids this for fixed defaults.",
        ],
        examples: [
          {
            code: "ALTER TABLE customers ADD COLUMN phone TEXT;\nALTER TABLE customers ALTER COLUMN phone SET NOT NULL;\nALTER TABLE customers RENAME COLUMN phone TO phone_number;\nALTER TABLE orders ADD CONSTRAINT positive_total CHECK (total_amount >= 0);",
          },
        ],
      },
      {
        id: "on-delete-cascade",
        title: "ON DELETE behavior for foreign keys",
        blurb: "What happens to the child when the parent is deleted.",
        body: [
          "When a FK column references another table, you choose what happens if the referenced row goes away. ON DELETE RESTRICT (default) blocks the parent delete. CASCADE deletes children with the parent. SET NULL nulls the FK column. SET DEFAULT uses the column default.",
          "Pick deliberately. CASCADE is convenient but dangerous — one parent delete can wipe out thousands of related rows.",
        ],
        examples: [
          {
            code: "CREATE TABLE order_items (\n  id SERIAL PRIMARY KEY,\n  order_id INTEGER NOT NULL\n    REFERENCES orders(id) ON DELETE CASCADE,\n  product TEXT NOT NULL\n);",
          },
        ],
      },
      {
        id: "schemas-namespaces",
        title: "Schemas (namespaces)",
        blurb: "Group tables under a namespace — `public.customers`, `analytics.events`.",
        body: [
          "A Postgres schema (different from 'the schema' of a table) is a namespace inside a database. `CREATE SCHEMA analytics` then put tables in it with `analytics.events`. Useful for isolating concerns: app tables in `public`, BI tables in `analytics`, raw imports in `staging`.",
        ],
        examples: [
          {
            code: "CREATE SCHEMA analytics;\nCREATE TABLE analytics.daily_metrics (\n  d DATE PRIMARY KEY,\n  active_users INTEGER NOT NULL\n);",
          },
        ],
      },
    ],
  },

  // ── Module 12: Performance & indexes ────────────────────────────────────
  {
    id: "performance",
    title: "Performance & indexes",
    description: "Make slow queries fast — index design and reading EXPLAIN.",
    topics: [
      {
        id: "indexes-basic",
        title: "B-tree indexes",
        blurb: "The default index — speeds up =, <, >, BETWEEN, ORDER BY.",
        body: [
          "An index is a sorted lookup structure. With an index on customers(email), finding a customer by email is logarithmic instead of scanning every row.",
          "Primary keys come with an index automatically. Foreign keys do NOT — add one on the FK column or joins get slow as the table grows.",
        ],
        examples: [
          {
            code: "CREATE INDEX idx_orders_customer ON orders(customer_id);",
          },
        ],
      },
      {
        id: "composite-partial",
        title: "Composite and partial indexes",
        blurb: "Multi-column and filtered indexes.",
        body: [
          "Composite index on (a, b) helps WHERE a=... and (a=... AND b=...) but not (b=... alone). Order matters.",
          "Partial index covers only some rows: `CREATE INDEX ... WHERE status = 'open'`. Smaller, faster, but only useful when the query has the same WHERE.",
        ],
        examples: [
          {
            code: "CREATE INDEX idx_orders_open ON orders(customer_id) WHERE status = 'open';",
          },
        ],
      },
      {
        id: "explain",
        title: "EXPLAIN and EXPLAIN ANALYZE",
        blurb: "See how Postgres runs your query.",
        body: [
          "EXPLAIN shows the planned execution. EXPLAIN ANALYZE runs the query AND reports actual times and row counts. Reading the plan tells you whether it's using an index, doing a sequential scan, or producing surprising row counts.",
          "Red flags: 'Seq Scan' on a large table where you expected an index, big differences between estimated and actual rows, sort steps using lots of memory.",
        ],
        examples: [
          {
            code: "EXPLAIN ANALYZE\nSELECT * FROM orders WHERE customer_id = 42;",
          },
        ],
      },
      {
        id: "other-index-types",
        title: "Beyond B-tree: GIN, GiST, BRIN, Hash",
        blurb: "Different index types for different shapes of data.",
        body: [
          "B-tree is the default and handles equality, ranges, and ordering. GIN excels at containment in JSONB and arrays, full-text search. GiST handles geometric and range types. BRIN is for huge tables where data is naturally ordered (time-series). Hash supports equality only and is usually not worth it.",
        ],
        examples: [
          {
            code: "-- GIN index for fast JSONB containment\nCREATE INDEX idx_events_payload ON events USING GIN (payload);\nSELECT * FROM events WHERE payload @> '{\"action\":\"login\"}';",
          },
        ],
      },
      {
        id: "vacuum-analyze",
        title: "VACUUM and ANALYZE",
        blurb: "How Postgres keeps tables tidy and statistics fresh.",
        body: [
          "Updates and deletes leave 'dead' rows behind. VACUUM reclaims that space. ANALYZE updates the planner's statistics about how data is distributed, so it can pick good plans.",
          "Postgres runs autovacuum in the background — you usually don't need to vacuum manually. But after big batch deletes or bulk loads, a one-off VACUUM ANALYZE is a healthy habit.",
        ],
        examples: [
          {
            code: "VACUUM ANALYZE orders;",
          },
        ],
      },
      {
        id: "index-only-scans",
        title: "Index-only scans",
        blurb: "When the index alone has everything the query needs.",
        body: [
          "Postgres can answer a query straight from the index without touching the table — if all columns in SELECT and WHERE are in the index AND the visibility map says the rows are visible. Massive speedup.",
          "The trick: include the columns you SELECT in the index with INCLUDE (covering index). Add WHERE columns first, INCLUDE columns after.",
        ],
        examples: [
          {
            code: "-- covering index for a common lookup\nCREATE INDEX idx_orders_lookup\nON orders (customer_id) INCLUDE (order_date, total_amount);",
          },
        ],
      },
    ],
  },

  // ── Module 13: Advanced Postgres ────────────────────────────────────────
  {
    id: "advanced-postgres",
    title: "Advanced Postgres",
    description: "JSON, arrays, views, full-text search, materialized views.",
    topics: [
      {
        id: "json",
        title: "JSON and JSONB",
        blurb: "Store and query nested objects.",
        body: [
          "JSONB stores nested JSON efficiently and lets you query into it. Use `->` to get a field (returns JSON), `->>` to get a text value, and `@>` to test containment.",
        ],
        examples: [
          {
            code: "SELECT id, payload->>'name' AS name\nFROM events\nWHERE payload @> '{\"type\":\"signup\"}';",
          },
        ],
      },
      {
        id: "arrays",
        title: "Arrays",
        blurb: "A column that holds many values.",
        body: [
          "Postgres supports array columns of any type. Index with `[1]` (1-based), expand to rows with UNNEST, test membership with `= ANY(...)`.",
        ],
        examples: [
          {
            code: "SELECT id, tags FROM articles WHERE 'sql' = ANY(tags);",
          },
        ],
      },
      {
        id: "views",
        title: "Views and materialized views",
        blurb: "Save a query under a name.",
        body: [
          "A VIEW is a saved query that you can SELECT from like a table — the underlying SQL runs every time you query it. A MATERIALIZED VIEW caches the result and refreshes on demand. Useful for expensive aggregates that don't need to be real-time.",
        ],
        examples: [
          {
            code: "CREATE VIEW active_customers AS\nSELECT * FROM customers WHERE last_seen_at >= NOW() - INTERVAL '90 days';",
          },
        ],
      },
      {
        id: "full-text",
        title: "Full-text search",
        blurb: "Native search with ranking, stemming, language support.",
        body: [
          "Postgres has built-in full-text search via tsvector / tsquery. It handles tokenization, stemming, stop words, and ranking — usually enough that you don't need Elasticsearch until you really do.",
        ],
        examples: [
          {
            code: "SELECT id, title\nFROM articles\nWHERE to_tsvector(title) @@ to_tsquery('postgres & index');",
          },
        ],
      },
      {
        id: "uuid",
        title: "UUIDs",
        blurb: "Globally unique identifiers — when serial IDs aren't enough.",
        body: [
          "UUIDs are 128-bit identifiers you can generate independently (no need for a central sequence). Useful for distributed systems, IDs you expose publicly, or merging datasets from multiple sources.",
          "Postgres has built-in `gen_random_uuid()` (enable `pgcrypto` extension if older versions). Indexes on UUIDs are larger and slower than on bigints — use only when you need the global uniqueness.",
        ],
        examples: [
          {
            code: "CREATE TABLE events (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  payload JSONB\n);",
          },
        ],
      },
      {
        id: "generated-columns",
        title: "Generated columns",
        blurb: "A column whose value is computed from other columns.",
        body: [
          "`GENERATED ALWAYS AS (...) STORED` defines a column whose value is computed from a row expression. Postgres re-computes it whenever the source columns change. Lets you persist denormalized values consistently — no trigger needed.",
        ],
        examples: [
          {
            code: "CREATE TABLE order_items (\n  id SERIAL PRIMARY KEY,\n  quantity INTEGER NOT NULL,\n  unit_price NUMERIC(10,2) NOT NULL,\n  total NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED\n);",
          },
        ],
      },
      {
        id: "triggers",
        title: "Triggers",
        blurb: "Code that runs automatically on INSERT/UPDATE/DELETE.",
        body: [
          "A trigger fires a function before or after a row change. Use them sparingly: audit logging, denormalized counters, validation that can't be expressed as a CHECK constraint. They make data flows harder to reason about — every write now has invisible side effects.",
        ],
        examples: [
          {
            code: "CREATE FUNCTION log_order_change() RETURNS trigger AS $$\nBEGIN\n  INSERT INTO order_log (order_id, action, changed_at)\n  VALUES (NEW.id, TG_OP, NOW());\n  RETURN NEW;\nEND;\n$$ LANGUAGE plpgsql;\n\nCREATE TRIGGER orders_audit AFTER INSERT OR UPDATE\nON orders FOR EACH ROW EXECUTE FUNCTION log_order_change();",
          },
        ],
      },
      {
        id: "stored-functions",
        title: "Stored functions",
        blurb: "Encapsulate logic the database can call.",
        body: [
          "Postgres has full procedural support via PL/pgSQL. Functions take parameters, return values or sets, and can be called from queries like built-ins. Useful for complex aggregations, encapsulating multi-step business logic, or making the same logic callable from many places.",
        ],
        examples: [
          {
            code: "CREATE FUNCTION customer_total(cust_id INTEGER)\nRETURNS NUMERIC AS $$\n  SELECT COALESCE(SUM(total_amount), 0)\n  FROM orders\n  WHERE customer_id = cust_id;\n$$ LANGUAGE SQL STABLE;\n\nSELECT name, customer_total(id) AS total FROM customers;",
          },
        ],
      },
    ],
  },

  // ── Module 14: Real-world patterns ──────────────────────────────────────
  {
    id: "real-world-patterns",
    title: "Real-world query patterns",
    description: "The recipes you'll actually reach for at work.",
    topics: [
      {
        id: "top-n-per-group",
        title: "Top-N per group",
        blurb: "The most common analyst question — first/last/best per category.",
        body: [
          "ROW_NUMBER inside a CTE, then WHERE rn = 1 (or rn <= N). Cleaner than the LEFT JOIN trick, faster than correlated subqueries.",
        ],
        examples: [
          {
            code: "-- most recent order per customer\nWITH ranked AS (\n  SELECT o.*, ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY order_date DESC) AS rn\n  FROM orders o\n)\nSELECT * FROM ranked WHERE rn = 1;",
          },
        ],
        practiceConcept: "window_functions",
      },
      {
        id: "pivot-unpivot",
        title: "Pivot and unpivot",
        blurb: "Reshape long ↔ wide.",
        body: [
          "Pivot: rows to columns. Postgres uses FILTER on aggregates: `COUNT(*) FILTER (WHERE category = 'A')` gives you one column per category.",
          "Unpivot: columns to rows. Use UNION ALL or `jsonb_each` to walk through columns.",
        ],
        examples: [
          {
            code: "-- orders by status, one column per status\nSELECT customer_id,\n       COUNT(*) FILTER (WHERE status = 'completed') AS completed,\n       COUNT(*) FILTER (WHERE status = 'pending') AS pending,\n       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled\nFROM orders GROUP BY customer_id;",
          },
        ],
      },
      {
        id: "deduplication",
        title: "Deduplication",
        blurb: "Pick one row per duplicate group.",
        body: [
          "Real data has duplicates. ROW_NUMBER OVER (PARTITION BY duplicate_key ORDER BY something) then keep rn = 1. The ORDER BY decides which copy survives — usually the most recent.",
        ],
        examples: [
          {
            code: "WITH ranked AS (\n  SELECT *, ROW_NUMBER() OVER (PARTITION BY email ORDER BY signup_date DESC) AS rn\n  FROM customers\n)\nSELECT * FROM ranked WHERE rn = 1;",
          },
        ],
      },
      {
        id: "cohort-retention",
        title: "Cohort retention",
        blurb: "Did users come back?",
        body: [
          "Bucket users by signup month (the cohort), then count which months they were active. Two date_trunc calls + a self-join or window function.",
        ],
        examples: [
          {
            code: "WITH cohorts AS (\n  SELECT id, DATE_TRUNC('month', signup_date) AS cohort\n  FROM customers\n),\nactivity AS (\n  SELECT customer_id, DATE_TRUNC('month', order_date) AS active_month\n  FROM orders\n  GROUP BY 1, 2\n)\nSELECT c.cohort, a.active_month, COUNT(*) AS active_users\nFROM cohorts c JOIN activity a ON a.customer_id = c.id\nGROUP BY 1, 2 ORDER BY 1, 2;",
          },
        ],
      },
      {
        id: "funnels",
        title: "Funnel analysis",
        blurb: "Who got from step 1 to step 2 to step 3.",
        body: [
          "Build a CTE per step (signed up, placed order, completed order), then LEFT JOIN them sequentially. Count rows at each step to see the drop-off.",
        ],
        examples: [],
      },
      {
        id: "sessionization",
        title: "Sessionization",
        blurb: "Group consecutive events that happened close in time.",
        body: [
          "User events come in as a long stream. Cluster them into 'sessions' by looking at the gap between consecutive events for each user — if the gap exceeds N minutes, start a new session.",
          "The trick: LAG to get the previous event's timestamp, mark each row 1 or 0 depending on whether the gap exceeds the threshold, then SUM that as a running total — that becomes the session number.",
        ],
        examples: [
          {
            code: "WITH gaps AS (\n  SELECT user_id, event_at,\n         CASE WHEN event_at - LAG(event_at) OVER (\n           PARTITION BY user_id ORDER BY event_at\n         ) > INTERVAL '30 min' THEN 1 ELSE 0 END AS new_session\n  FROM events\n)\nSELECT user_id, event_at,\n       SUM(new_session) OVER (PARTITION BY user_id ORDER BY event_at) AS session_id\nFROM gaps;",
          },
        ],
        practiceConcept: "window_functions",
      },
      {
        id: "gap-fill",
        title: "Time-series gap fill",
        blurb: "Generate a row for every period, even ones with no activity.",
        body: [
          "Reports want a complete time axis: every day from Jan 1 to today, even days with zero orders. Naive GROUP BY only emits rows for days that had data — gaps appear as missing rows.",
          "Solution: generate the full date range with `generate_series`, then LEFT JOIN your actual data. Missing days come back as NULL and you COALESCE to 0.",
        ],
        examples: [
          {
            code: "WITH days AS (\n  SELECT generate_series('2025-01-01'::date, CURRENT_DATE, '1 day') AS day\n)\nSELECT d.day, COALESCE(COUNT(o.id), 0) AS orders\nFROM days d\nLEFT JOIN orders o ON o.order_date = d.day\nGROUP BY d.day\nORDER BY d.day;",
          },
        ],
        practiceConcept: "date_functions",
      },
      {
        id: "hierarchical-queries",
        title: "Hierarchical queries",
        blurb: "Walk a tree: org charts, threaded comments, category trees.",
        body: [
          "Self-referencing tables (employees → manager_id, comments → parent_id) form a tree. Recursive CTEs walk that tree — top-down to find descendants, bottom-up to trace ancestors.",
        ],
        examples: [
          {
            code: "-- entire reporting tree under a director\nWITH RECURSIVE team AS (\n  SELECT id, name, manager_id, 0 AS level\n  FROM employees WHERE id = 1\n  UNION ALL\n  SELECT e.id, e.name, e.manager_id, t.level + 1\n  FROM employees e JOIN team t ON e.manager_id = t.id\n)\nSELECT * FROM team ORDER BY level;",
          },
        ],
        practiceConcept: "cte",
      },
    ],
  },
];
