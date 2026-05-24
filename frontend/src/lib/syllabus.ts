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
  /** Concept slug to pre-select in Practice mode. SQL uses PracticeConcept values;
   * other languages (e.g. Python) use their own concept slugs, so this is a string. */
  practiceConcept?: string;
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
        blurb: "Three minutes with the schema diagram saves an hour of guessing.",
        bigIdea:
          "Before writing any query, learn the shape of the data: tables, columns, types, and the FK arrows between them.",
        realWorld:
          "Like opening a board game and reading the legend first. You don't just dump out the pieces and hope — you check the map, count the players, and notice which tokens connect to which.",
        body: [],
        richBody: [
          {
            kind: "steps",
            title: "What to look at first",
            items: [
              { title: "Tables", detail: "How many? What are they roughly about (customers, orders, products)?" },
              { title: "Columns", detail: "For each table, what's stored? What type is each column?" },
              { title: "Primary keys", detail: "Which column uniquely identifies a row? Usually `id`." },
              { title: "Foreign keys", detail: "Which columns point to other tables? Those are your JOIN targets." },
            ],
          },
          {
            kind: "callout",
            tone: "tip",
            text: "In this app, the Schema button (top-right of Practice mode) opens an entity-relationship diagram with PK/FK badges and sample rows. Open it whenever you're stuck — the JOIN you need is usually visible as an arrow.",
          },
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
        bigIdea:
          "Single quotes wrap VALUES ('Sweden'). Double quotes wrap IDENTIFIERS (\"User Name\"). They are not interchangeable.",
        realWorld:
          "Imagine luggage tags. The destination written on the tag (the value) goes inside the box. The owner's name (the identifier — who this belongs to) goes on the outside label. Different kinds of writing, different brackets.",
        body: [],
        richBody: [
          {
            kind: "compare",
            caption: "Quote types",
            left: {
              title: "Single quotes — for values",
              items: [
                "'Sweden', 'ada@example.com', '2024-01-01'",
                "Use them around any string literal",
                "Double up if the string itself has a quote: 'O''Reilly'",
              ],
            },
            right: {
              title: "Double quotes — for identifiers",
              items: [
                "\"User Name\" (column with a space)",
                "\"customerId\" (preserve case)",
                "Usually unnecessary — most identifiers don't need them",
              ],
            },
          },
          {
            kind: "callout",
            tone: "warning",
            text: "Common bug: writing `WHERE country = \"Sweden\"` — that makes Postgres look for a column named Sweden, not a value. Always single-quote string values.",
          },
          {
            kind: "p",
            text: "Comments: use `-- this is a line comment` for short notes, `/* ... */` for blocks. They're ignored by the database — pure documentation for humans.",
          },
        ],
        examples: [
          {
            code: "-- single-line comment\n/* block comment */\nSELECT name, 'hello' AS greeting\nFROM customers;",
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
        title: "DISTINCT — collapse duplicate rows",
        blurb: "Keep only one copy of each repeated row.",
        bigIdea:
          "DISTINCT looks at all the columns in your SELECT and collapses exact duplicates into one row.",
        realWorld:
          "Like asking a class: \"What countries are you all from?\" Without DISTINCT you'd hear \"Canada, Canada, Japan, Canada, France, France.\" With DISTINCT you hear \"Canada, Japan, France.\" Same data, deduped.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- every country that appears at least once\nSELECT DISTINCT country\nFROM customers\nORDER BY country;",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "DISTINCT applies to ALL columns in SELECT together. `SELECT DISTINCT country, age` means \"unique (country, age) PAIRS\" — not just unique countries.",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "DISTINCT sorts behind the scenes — it's not free on large data. If you're reaching for it on every query, you might be joining or grouping wrong.",
          },
        ],
        examples: [],
      },
      {
        id: "nulls",
        title: "NULL — the missing value",
        blurb: "NULL means \"unknown\" — not zero, not empty, not equal to itself.",
        bigIdea:
          "Comparisons with NULL return NULL, not TRUE or FALSE. That's why `age = NULL` never matches — use `age IS NULL` instead.",
        realWorld:
          "Imagine a blank line on a form. Did the person mean \"zero\"? Or did they just not fill it in? You can't tell — that's NULL. \"Is the blank EQUAL to zero?\" is a question you can't even answer.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "Rules of NULL",
            items: [
              "NULL = NULL is NULL (not TRUE). So a filter `age = NULL` matches nothing.",
              "Use `IS NULL` or `IS NOT NULL` to test for missingness.",
              "Most aggregates ignore NULL: AVG, SUM, COUNT(col). Only COUNT(*) counts rows including NULL ones.",
              "Math with NULL produces NULL: `5 + NULL` is NULL.",
              "String concat with NULL produces NULL in standard SQL: `'a' || NULL` is NULL. Use CONCAT() for NULL-tolerance.",
            ],
          },
          {
            kind: "code",
            code: "-- ✓ find customers whose age is missing\nSELECT name FROM customers WHERE age IS NULL;\n\n-- ✗ this never matches anything\nSELECT name FROM customers WHERE age = NULL;",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "Substitute a default with COALESCE: `COALESCE(age, 0)` returns age if it isn't NULL, otherwise 0. Saves you from NULL leaking into math.",
          },
        ],
        examples: [],
        practiceConcept: "null_handling",
      },
      {
        id: "comparison-boolean",
        title: "Comparison and boolean operators",
        blurb: "The vocabulary you'll use inside every WHERE.",
        bigIdea:
          "WHERE conditions are built from comparison operators (=, <, >, ...) and combined with AND / OR / NOT.",
        realWorld:
          "Like checkpoint rules at airport security. Each rule is a comparison (\"is your bag under 10kg?\", \"is your boarding pass for today?\"). They combine with AND / OR — both passes (AND), or either-or (OR).",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "Comparison operators",
            items: [
              "= equals · <> or != not equals",
              "< less than · <= less or equal",
              "> greater than · >= greater or equal",
              "BETWEEN a AND b — inclusive range, same as `x >= a AND x <= b`",
              "IS NULL · IS NOT NULL — the only way to test missing values",
              "IS DISTINCT FROM — NULL-safe inequality (NULL is distinct from anything except NULL)",
            ],
          },
          {
            kind: "bullets",
            title: "Boolean operators (with precedence)",
            items: [
              "NOT runs first",
              "AND runs second",
              "OR runs last",
              "When in doubt: parenthesize. `(A OR B) AND C` is different from `A OR (B AND C)`",
            ],
          },
          {
            kind: "code",
            code: "SELECT *\nFROM orders\nWHERE (status = 'completed' OR status = 'shipped')\n  AND total_amount > 100\n  AND order_date IS NOT NULL;",
            note: "Three conditions joined with AND. The first uses OR inside parens so it groups correctly.",
          },
        ],
        examples: [],
      },
      {
        id: "like-ilike",
        title: "LIKE and ILIKE — pattern matching",
        blurb: "Wildcard matching for strings.",
        bigIdea:
          "LIKE matches strings against a simple pattern. % is any number of characters, _ is exactly one. ILIKE is the case-insensitive version.",
        realWorld:
          "Like Find on your phone but with two wildcards. % is \"anything\" — `'%@gmail.com'` is \"anything, then @gmail.com\". _ is exactly one character — `'A__'` is \"A then exactly two more letters\".",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "The two wildcards",
            items: [
              "% — match zero or more of any character",
              "_ — match exactly one character",
              "No wildcard means exact match",
            ],
          },
          {
            kind: "code",
            code: "-- Gmail addresses\nSELECT email FROM customers WHERE email ILIKE '%@gmail.com';\n\n-- Names starting with 'A' followed by exactly two more characters\nSELECT name FROM customers WHERE name LIKE 'A__';\n\n-- Any name containing 'son'\nSELECT name FROM customers WHERE name LIKE '%son%';",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "If you need real regular expressions (character classes, alternation, capture groups), reach for `~` (case-sensitive) or `~*` (case-insensitive) instead. LIKE is intentionally simple.",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "Leading `%` (like `'%foo'`) can't use a normal index — every row gets scanned. For prefix searches keep the % on the right: `'foo%'` is index-friendly.",
          },
        ],
        examples: [],
        practiceConcept: "string_functions",
      },
      {
        id: "in-between",
        title: "IN, NOT IN, BETWEEN",
        blurb: "Cleaner alternatives to long OR chains.",
        bigIdea:
          "IN tests membership in a list. BETWEEN tests an inclusive range. Both are shortcuts for what you'd otherwise write with multiple OR / AND.",
        realWorld:
          "Like the express checkout sign: \"15 items or less.\" That's `BETWEEN 1 AND 15`. \"This line accepts: cash, card, mobile pay\" — that's `IN ('cash', 'card', 'mobile')`.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- IN — value is in the list\nSELECT * FROM customers\nWHERE country IN ('Canada', 'Mexico', 'Brazil');\n\n-- Same thing, longer:\nSELECT * FROM customers\nWHERE country = 'Canada'\n   OR country = 'Mexico'\n   OR country = 'Brazil';",
          },
          {
            kind: "code",
            code: "-- BETWEEN — inclusive range\nSELECT * FROM orders\nWHERE order_date BETWEEN '2024-01-01' AND '2024-12-31';\n\n-- Same thing:\nSELECT * FROM orders\nWHERE order_date >= '2024-01-01'\n  AND order_date <= '2024-12-31';",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "NOT IN behaves badly with NULL. If the list contains even one NULL, `NOT IN` returns NULL (not TRUE) for every row, so you get an empty result. Use NOT EXISTS or filter NULLs out first.",
          },
        ],
        examples: [],
      },
      {
        id: "calculated-columns",
        title: "Calculated columns and expressions",
        blurb: "SELECT can produce columns that don't exist in the table.",
        bigIdea:
          "Anywhere a column name goes, you can put an expression — math, a function call, CASE, concatenation — and name it with AS.",
        realWorld:
          "Like adding a \"total\" column on a receipt that you calculated by multiplying quantity × price. The store's database never STORES the total, it computes it when you ask.",
        body: [],
        richBody: [
          {
            kind: "p",
            text: "Calculated columns let you compute totals, format strings, bucket values, or compare columns inline — without touching the underlying data.",
          },
          {
            kind: "code",
            code: "SELECT order_id,\n       quantity * unit_price AS line_total,\n       UPPER(product_name) AS product,\n       CASE WHEN quantity > 5 THEN 'bulk' ELSE 'normal' END AS tier\nFROM order_items;",
            note: "Three computed columns: arithmetic, function, CASE. None of them exist on disk — all derived.",
          },
        ],
        examples: [],
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
        blurb: "Like WHERE, but runs after the grouping is done.",
        bigIdea:
          "WHERE filters rows before grouping. HAVING filters groups after aggregating. Use HAVING when your condition involves an aggregate.",
        realWorld:
          "Two bouncers at a club. WHERE is the first bouncer at the door — they only let people in if they meet certain rules. HAVING is the second bouncer inside, who only lets a whole TABLE stay if the table meets some rule (\"more than 5 people\").",
        body: [],
        richBody: [
          {
            kind: "compare",
            caption: "WHERE vs HAVING",
            left: {
              title: "WHERE",
              items: [
                "Runs BEFORE grouping",
                "Filters individual rows",
                "Cannot use aggregates (COUNT, SUM, etc.)",
                "Example: WHERE country = 'Canada'",
              ],
            },
            right: {
              title: "HAVING",
              items: [
                "Runs AFTER grouping",
                "Filters whole groups",
                "MUST use aggregates",
                "Example: HAVING COUNT(*) >= 10",
              ],
            },
          },
          {
            kind: "code",
            code: "-- countries with 10 or more customers\nSELECT country, COUNT(*) AS n\nFROM customers\nGROUP BY country\nHAVING COUNT(*) >= 10\nORDER BY n DESC;",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "`WHERE COUNT(*) > 5` is always an error — WHERE can't see aggregates. Move it to HAVING.",
          },
        ],
        examples: [],
        practiceConcept: "having",
      },
      {
        id: "aggregate-edge-cases",
        title: "Aggregate edge cases",
        blurb: "NULLs and empty groups trip everyone up at least once.",
        bigIdea:
          "Aggregates ignore NULLs (except COUNT(*)). And when a query has zero rows, MIN/MAX/SUM return NULL — even SUM, where you'd expect 0.",
        realWorld:
          "Like asking \"what's the average score?\" in a class where some students didn't take the test. SQL skips the no-shows. But if NOBODY took the test, asking for the average gives you nothing (NULL), not 0.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "Three gotchas",
            items: [
              "AVG([10, NULL, 30]) = 20, not 13.3 — NULLs are skipped, not treated as 0.",
              "COUNT(*) counts every row including NULLs. COUNT(col) skips NULLs. They give different answers.",
              "SUM(x) WHERE there are no matching rows = NULL, not 0. Wrap in COALESCE if you need 0.",
            ],
          },
          {
            kind: "code",
            code: "-- safe sum that returns 0 instead of NULL\nSELECT COALESCE(SUM(total_amount), 0) AS revenue\nFROM orders\nWHERE status = 'completed';",
          },
        ],
        examples: [],
      },
      {
        id: "string-array-agg",
        title: "STRING_AGG and ARRAY_AGG",
        blurb: "Aggregate many rows into one delimited string or one array.",
        bigIdea:
          "Most aggregates produce a single number. These two produce a single LIST — comma-joined text, or an array.",
        realWorld:
          "Like making a guest list. For each table at a wedding (the group), you want the names of everyone seated there, joined with commas, in alphabetical order. That's STRING_AGG.",
        body: [],
        richBody: [
          {
            kind: "p",
            text: "Perfect for \"show me the list of X per Y\" — items per order, tags per article, members per team.",
          },
          {
            kind: "code",
            code: "-- list of products per order\nSELECT o.id,\n       STRING_AGG(oi.product_name, ', ' ORDER BY oi.product_name) AS products\nFROM orders o\nJOIN order_items oi ON oi.order_id = o.id\nGROUP BY o.id;",
            note: "STRING_AGG accepts ORDER BY inside its parens to control item order.",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "Use ARRAY_AGG when downstream code wants a real array (Postgres arrays, JSON arrays in your app). Use STRING_AGG for human-readable lists.",
          },
        ],
        examples: [],
        practiceConcept: "aggregations",
      },
      {
        id: "filter-clause",
        title: "FILTER — conditional aggregates",
        blurb: "Aggregate only the rows that match a per-aggregate condition.",
        bigIdea:
          "`AGG(...) FILTER (WHERE ...)` lets each aggregate in your SELECT have its own filter, independent of the others.",
        realWorld:
          "Like running a checkout report. \"How many sales did each cashier ring up TOTAL? How many were CASH? How many were CARD?\" — three different counts with three different filters, all in one report.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "SELECT customer_id,\n       COUNT(*)                  FILTER (WHERE status = 'completed') AS completed,\n       COUNT(*)                  FILTER (WHERE status = 'cancelled') AS cancelled,\n       SUM(total_amount)         FILTER (WHERE status = 'completed') AS revenue\nFROM orders\nGROUP BY customer_id;",
            note: "One pass over the data, three independently-filtered aggregates per customer.",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "FILTER is cleaner and faster than the older `SUM(CASE WHEN ... THEN ... END)` trick. Same idea, less ceremony.",
          },
        ],
        examples: [],
        practiceConcept: "aggregations",
      },
      {
        id: "grouping-sets",
        title: "ROLLUP, CUBE, GROUPING SETS",
        blurb: "Multiple levels of grouping in a single query.",
        bigIdea:
          "ROLLUP adds subtotal rows climbing a hierarchy. CUBE adds subtotals for every combination. GROUPING SETS lets you pick exact combinations.",
        realWorld:
          "Like a sales report: revenue per (region, store, month), plus subtotals per region, plus a grand total — all in one table. ROLLUP gives you that hierarchy in one query.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- per (country, year), per country, and grand total in one query\nSELECT country, EXTRACT(YEAR FROM signup_date) AS year, COUNT(*) AS n\nFROM customers\nGROUP BY ROLLUP (country, year);",
            note: "Rows where year is NULL are the per-country subtotals. The row where both are NULL is the grand total.",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "Use `GROUPING(col)` in SELECT to tell apart real NULLs from subtotal NULLs.",
          },
        ],
        examples: [],
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
        blurb: "Join a table to a second copy of itself.",
        bigIdea:
          "A self-join is a regular JOIN where both sides are the same table — distinguished by different aliases.",
        realWorld:
          "Like an org chart. Every employee row has a `manager_id` pointing to ANOTHER row in the same employees table. To show \"employee + their manager's name\", you treat the table as two copies and join them.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- employees with their manager's name\nSELECT e.name AS employee, m.name AS manager\nFROM employees e\nLEFT JOIN employees m ON m.id = e.manager_id;",
            note: "Two aliases (e for employee, m for manager) on the same table.",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "Use LEFT JOIN, not INNER, so employees without a manager (e.g., the CEO) still show up.",
          },
        ],
        examples: [],
        practiceConcept: "self_joins",
      },
      {
        id: "multi-table-joins",
        title: "Joining three or more tables",
        blurb: "Chain joins one after another.",
        bigIdea:
          "Joins compose. After joining A to B, you can join the result to C. Each JOIN's ON clause references tables already in scope.",
        realWorld:
          "Like assembling a sandwich. Start with bread, add lettuce, add tomato, add cheese — each step builds on the result of the previous. Each step needs to physically touch the part already in your hand.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "SELECT c.name, o.order_date, oi.product_name, oi.quantity\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nJOIN order_items oi ON oi.order_id = o.id\nWHERE c.country = 'Canada';",
            note: "Three tables. customers → orders → order_items, chained by FK relationships.",
          },
        ],
        examples: [],
        practiceConcept: "joins",
      },
      {
        id: "join-gotchas",
        title: "Common join gotchas",
        blurb: "The bugs that hide in plain sight.",
        bigIdea:
          "Joining two one-to-many tables fans out the rows — counts get multiplied. Aggregate FIRST, then join.",
        realWorld:
          "Like asking each parent how many kids they have, then accidentally asking the SAME question for each kid. Now the answers are wrong because you over-counted the parents.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "Three classic traps",
            items: [
              "Fan-out: joining A → B → C when both relations are one-to-many will multiply A's rows. Pre-aggregate B in a subquery or CTE before joining.",
              "Aggregates on joined rows: COUNT(*) after a join counts joined rows, not original rows. Use COUNT(DISTINCT a.id) or pre-aggregate.",
              "NULL FK columns never match. Even LEFT JOIN gives NULL right columns. If you wanted them to match (e.g., 'unknown' bucket), COALESCE the key first.",
            ],
          },
          {
            kind: "code",
            code: "-- ✗ over-counts: joining items multiplies orders\nSELECT c.id, COUNT(*) AS total\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nJOIN order_items oi ON oi.order_id = o.id\nGROUP BY c.id;\n\n-- ✓ pre-aggregate items, then join\nSELECT c.id, SUM(o.item_count) AS total\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nJOIN (SELECT order_id, COUNT(*) AS item_count FROM order_items GROUP BY order_id) o ...",
          },
        ],
        examples: [],
      },
      {
        id: "using-clause",
        title: "USING — a shorter ON",
        blurb: "When both tables have the same join-column name, USING is tidier.",
        bigIdea:
          "`JOIN orders USING (customer_id)` is shorthand for `JOIN orders ON c.customer_id = o.customer_id`. The column appears once in the result, not twice.",
        realWorld:
          "Like introducing two people who already share the same name. \"Anna, meet Anna\" — but in the room, you just call her Anna once.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- USING (column has the same name on both sides)\nSELECT name, order_date\nFROM customers\nJOIN orders USING (customer_id);\n\n-- equivalent ON form\nSELECT c.name, o.order_date\nFROM customers c\nJOIN orders o ON c.customer_id = o.customer_id;",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "Avoid NATURAL JOIN. It auto-joins on every same-named column — silently breaks the day someone adds a `created_at` to both tables.",
          },
        ],
        examples: [],
      },
      {
        id: "anti-joins",
        title: "Anti-joins — finding what's missing",
        blurb: "Rows on one side that have NO match on the other.",
        bigIdea:
          "An anti-join finds the GAP — customers who never ordered, products never sold, articles never read. Two common forms: LEFT JOIN + IS NULL, or NOT EXISTS.",
        realWorld:
          "Like taking attendance and finding who's absent. You don't list who's present and tick them off — you list the whole class and look for missing checkmarks.",
        body: [],
        richBody: [
          {
            kind: "venn",
            type: "leftOnly",
            leftLabel: "customers",
            rightLabel: "orders",
            caption: "Anti-join",
            legend: "Only the left circle minus the overlap — left rows with no right match.",
          },
          {
            kind: "code",
            code: "-- customers who never placed an order (LEFT JOIN form)\nSELECT c.name\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL;\n\n-- same thing with NOT EXISTS\nSELECT c.name\nFROM customers c\nWHERE NOT EXISTS (\n  SELECT 1 FROM orders o WHERE o.customer_id = c.id\n);",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "NOT EXISTS is often clearer and handles NULLs more sensibly than NOT IN. Pick whichever reads best.",
          },
        ],
        examples: [],
        practiceConcept: "left_joins",
      },
      {
        id: "lateral-joins",
        title: "LATERAL — joins that see each row",
        blurb: "A subquery on the right side that can reference the row on the left.",
        bigIdea:
          "LATERAL lets a JOIN's right-side subquery use columns from the left side. The subquery re-runs for every left row.",
        realWorld:
          "Like a tour guide who customizes the tour for each person. \"For YOU, since you're 12, I'll skip the boring stuff.\" The right-side decision changes for each left visitor.",
        body: [],
        richBody: [
          {
            kind: "p",
            text: "The killer use case: top-N per group. For each customer, give me their 3 most recent orders — cleanly expressible with a LATERAL subquery + LIMIT.",
          },
          {
            kind: "code",
            code: "-- each customer's 3 most recent orders\nSELECT c.name, o.order_date, o.total_amount\nFROM customers c\nJOIN LATERAL (\n  SELECT order_date, total_amount\n  FROM orders\n  WHERE customer_id = c.id    -- references the outer row\n  ORDER BY order_date DESC\n  LIMIT 3\n) o ON true;",
            note: "`ON true` is a placeholder — LATERAL doesn't need an extra join condition since the WHERE inside handles the link.",
          },
        ],
        examples: [],
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
        bigIdea:
          "A subquery in WHERE produces a set of values. The outer WHERE compares against that set with IN, NOT IN, =, EXISTS, or comparison.",
        realWorld:
          "Like asking a question whose answer depends on another question. \"Which customers placed an order over $500?\" first answers \"which customer IDs are in the over-$500 orders?\" — that's the subquery — and uses the answer to filter customers.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- customers who placed an order over $500\nSELECT name FROM customers\nWHERE id IN (\n  SELECT customer_id FROM orders WHERE total_amount > 500\n);",
            note: "Inner query runs first, produces customer_ids. Outer query then filters customers by that list.",
          },
        ],
        examples: [],
        practiceConcept: "subqueries",
      },
      {
        id: "scalar-subquery",
        title: "Scalar subqueries",
        blurb: "A subquery that returns exactly one value.",
        bigIdea:
          "When a subquery returns one row, one column, you can use it anywhere you'd put a literal — inside SELECT, WHERE comparisons, etc.",
        realWorld:
          "Like comparing your grade to the class average. The class average is one number — computed by a subquery — and every row in the outer query gets compared to it.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- compare each order to the overall average\nSELECT id,\n       total_amount,\n       total_amount - (SELECT AVG(total_amount) FROM orders) AS delta_from_avg\nFROM orders;",
            note: "The inner query runs once, returns one number. Each row uses that number.",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "If a scalar subquery accidentally returns more than one row, Postgres throws an error. Wrap it in a LIMIT 1 if it could ever return many.",
          },
        ],
        examples: [],
        practiceConcept: "subqueries",
      },
      {
        id: "correlated-subquery",
        title: "Correlated subqueries",
        blurb: "An inner query that references the outer row.",
        bigIdea:
          "A correlated subquery references a column from the outer row, so it re-runs for each outer row.",
        realWorld:
          "Like asking, for each customer in your list: \"What's THIS person's largest order?\" The answer changes per customer — the subquery has to run again for each one.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- customers whose largest order was over $200\nSELECT c.name\nFROM customers c\nWHERE 200 < (\n  SELECT MAX(o.total_amount) FROM orders o\n  WHERE o.customer_id = c.id   -- references the outer row\n);",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "Powerful but slow on large data — N outer rows × subquery time. A JOIN + GROUP BY or a window function is usually faster.",
          },
        ],
        examples: [],
        practiceConcept: "subqueries",
      },
      {
        id: "exists-vs-in",
        title: "EXISTS vs IN",
        blurb: "Two ways to ask \"does a match exist somewhere?\"",
        bigIdea:
          "EXISTS returns TRUE if its subquery finds any row. IN checks membership in a list. Both can answer the same question; EXISTS is usually faster on large data and safer around NULLs.",
        realWorld:
          "Like asking \"is your name on the guest list?\" Two phrasings: \"is your name IN this list?\" (IN) or \"does an entry EXIST in the list for you?\" (EXISTS). Same answer, different mechanics.",
        body: [],
        richBody: [
          {
            kind: "compare",
            caption: "When to choose which",
            left: {
              title: "IN — value matches a list",
              items: [
                "Simple, reads naturally",
                "Best for small literal lists: `country IN ('A', 'B')`",
                "Be careful with NULLs in NOT IN — they break it",
              ],
            },
            right: {
              title: "EXISTS — any row matches",
              items: [
                "Stops at the first match — efficient on large data",
                "NULL-safe with NOT EXISTS",
                "Best when the subquery is correlated to the outer row",
              ],
            },
          },
          {
            kind: "code",
            code: "SELECT name FROM customers c\nWHERE EXISTS (\n  SELECT 1 FROM orders o WHERE o.customer_id = c.id\n);",
            note: "Same answer as the IN version, usually faster on big data.",
          },
        ],
        examples: [],
        practiceConcept: "subqueries",
      },
      {
        id: "subquery-in-from",
        title: "Subqueries in FROM (derived tables)",
        blurb: "Treat the result of a subquery as a temporary table.",
        bigIdea:
          "A subquery inside FROM is treated like a virtual table — the outer query can SELECT, JOIN, WHERE on it as if it were a real table.",
        realWorld:
          "Like making a quick draft on scratch paper before writing your final answer. The scratch result is just for this question.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- average order total per country\nSELECT t.country, AVG(t.order_total) AS avg_order\nFROM (\n  SELECT c.country, o.total_amount AS order_total\n  FROM customers c JOIN orders o ON o.customer_id = c.id\n) t\nGROUP BY t.country;",
            note: "The subquery produces a virtual table aliased `t`. The outer SELECT averages over it.",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "When the subquery has a name and might be referenced more than once, a CTE (WITH clause) is clearer. FROM-subqueries are great for one-shot intermediates.",
          },
        ],
        examples: [],
        practiceConcept: "subqueries",
      },
      {
        id: "any-all",
        title: "ANY and ALL operators",
        blurb: "Compare a value to every row a subquery returns.",
        bigIdea:
          "`x > ANY (subquery)` is true if x beats at least one value. `x > ALL (subquery)` is true only if x beats every value.",
        realWorld:
          "Like a school race. \"Were you faster than ANY of the runners?\" — just need to beat one. \"Were you faster than ALL the runners?\" — you have to beat everyone.",
        body: [],
        richBody: [
          {
            kind: "compare",
            caption: "Comparing to a set",
            left: {
              title: "ANY (or SOME)",
              items: [
                "True if x relates to AT LEAST ONE row",
                "`x > ANY (...)` = beats the smallest",
                "Same as `x > (SELECT MIN(...))`",
              ],
            },
            right: {
              title: "ALL",
              items: [
                "True only if x relates to EVERY row",
                "`x > ALL (...)` = beats the largest",
                "Same as `x > (SELECT MAX(...))`",
              ],
            },
          },
          {
            kind: "code",
            code: "-- customers older than every Canadian customer\nSELECT name, age FROM customers\nWHERE age > ALL (\n  SELECT age FROM customers\n  WHERE country = 'Canada' AND age IS NOT NULL\n);",
          },
        ],
        examples: [],
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
        blurb: "Name a subquery so the rest of the query reads it like a table.",
        bigIdea:
          "A Common Table Expression is a subquery you give a name. The outer query references it like a real table. CTEs turn dense queries into named, readable steps.",
        realWorld:
          "Like prepping ingredients for a recipe. \"First, make the dough. Then make the sauce. Then assemble the pizza.\" Each prep step has a name. The final step combines them. That's CTEs.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "WITH order_totals AS (\n  SELECT customer_id, SUM(total_amount) AS total\n  FROM orders\n  GROUP BY customer_id\n)\nSELECT c.name, ot.total\nFROM customers c\nJOIN order_totals ot ON ot.customer_id = c.id\nORDER BY ot.total DESC;",
            note: "`order_totals` is the named CTE. The main SELECT then joins it like a table.",
          },
        ],
        examples: [],
        practiceConcept: "cte",
      },
      {
        id: "multiple-ctes",
        title: "Chaining multiple CTEs",
        blurb: "Each step is its own named block.",
        bigIdea:
          "Stack CTEs separated by commas. Each can use any earlier CTE. Gnarly queries become a readable pipeline.",
        realWorld:
          "Like a multi-stage assembly line. Stage 1 cuts the wood. Stage 2 sands it. Stage 3 paints it. Stage 4 assembles. Each stage builds on the previous one.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "WITH completed AS (\n  SELECT * FROM orders WHERE status = 'completed'\n),\ncustomer_totals AS (\n  SELECT customer_id, SUM(total_amount) AS total\n  FROM completed\n  GROUP BY customer_id\n)\nSELECT c.name, ct.total\nFROM customer_totals ct\nJOIN customers c ON c.id = ct.customer_id\nORDER BY ct.total DESC;",
            note: "Two CTEs. The second uses the first. The main SELECT uses the second.",
          },
        ],
        examples: [],
        practiceConcept: "cte",
      },
      {
        id: "recursive-cte",
        title: "Recursive CTEs",
        blurb: "Walk hierarchies and graphs.",
        bigIdea:
          "A recursive CTE references itself. Use it to walk trees (org charts, category trees, threaded comments) and graphs.",
        realWorld:
          "Like climbing a family tree. You start with one person (base case), then look up their parent, then THAT person's parent, and so on until you can't go further.",
        body: [],
        richBody: [
          {
            kind: "steps",
            title: "Shape of a recursive CTE",
            items: [
              { title: "Base case", detail: "Start with the seed rows — usually one specific node." },
              { title: "Recursive case", detail: "Reference the CTE itself, joining to add one level. Connect with UNION ALL." },
              { title: "Stop condition", detail: "Postgres keeps going until the recursive step produces zero new rows." },
            ],
          },
          {
            kind: "code",
            code: "-- Build the full reporting chain for an employee\nWITH RECURSIVE chain AS (\n  -- base case: start with employee 42\n  SELECT id, name, manager_id, 1 AS depth\n  FROM employees WHERE id = 42\n  UNION ALL\n  -- recursive case: add the manager one level up\n  SELECT e.id, e.name, e.manager_id, c.depth + 1\n  FROM employees e\n  JOIN chain c ON e.id = c.manager_id\n)\nSELECT * FROM chain ORDER BY depth;",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "If your graph has cycles (A reports to B reports to A), you'll loop forever. Limit depth with a counter (`WHERE depth < 100`) or use Postgres's `CYCLE` clause.",
          },
        ],
        examples: [],
        practiceConcept: "cte",
      },
      {
        id: "cte-vs-subquery",
        title: "CTE vs subquery: when to choose which",
        blurb: "CTEs name things; subqueries inline them. Pick based on readability.",
        bigIdea:
          "Both can do the same job. CTEs win when the logic deserves a name or is referenced more than once. Subqueries win when it's a small inline thing.",
        realWorld:
          "Like adding a named variable in code vs inlining a value. Use a variable when it carries meaning or is used twice; inline when it's an obvious one-off.",
        body: [],
        richBody: [
          {
            kind: "compare",
            caption: "Choose by readability",
            left: {
              title: "Use a CTE when…",
              items: [
                "You'd reference the same subquery twice",
                "The logic has a meaningful name (\"completed_orders\")",
                "You're building a multi-step pipeline",
                "Recursive walks (only CTEs can do those)",
              ],
            },
            right: {
              title: "Use a subquery when…",
              items: [
                "It's a tiny one-shot expression",
                "It's used in WHERE or SELECT once",
                "Naming it would be ceremony",
              ],
            },
          },
          {
            kind: "callout",
            tone: "note",
            text: "Old wisdom: \"CTEs are optimization fences and hurt performance.\" Since Postgres 12, CTEs are inlinable when safe — performance is usually identical. Don't pick based on imagined performance.",
          },
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
        blurb: "Aggregate-style math without collapsing your rows.",
        bigIdea:
          "A window function computes across a group of rows but doesn't merge them. The original row stays; you just get an extra column.",
        realWorld:
          "Like writing on each student's report card not just their grade but ALSO the class average and their rank. Each student keeps their row — you just attach extra context.",
        body: [],
        richBody: [
          {
            kind: "p",
            text: "Syntax: `FUNCTION(...) OVER (PARTITION BY ... ORDER BY ...)`. PARTITION BY groups; ORDER BY orders within each group.",
          },
          {
            kind: "tablePair",
            caption: "GROUP BY collapses; window function doesn't",
            arrow: "→",
            left: {
              caption: "orders",
              columns: ["id", "customer_id", "amount"],
              rows: [
                [1, 100, 50],
                [2, 100, 30],
                [3, 200, 80],
              ],
            },
            right: {
              caption: "with window SUM per customer",
              columns: ["id", "customer_id", "amount", "cust_total"],
              rows: [
                [1, 100, 50, 80],
                [2, 100, 30, 80],
                [3, 200, 80, 80],
              ],
              rowHighlights: { 0: "new", 1: "new", 2: "new" },
              note: "Same row count. New column repeats the per-customer total.",
            },
          },
          {
            kind: "code",
            code: "SELECT o.id, o.customer_id, o.total_amount,\n       SUM(o.total_amount) OVER (PARTITION BY o.customer_id) AS customer_total\nFROM orders o;",
          },
        ],
        examples: [],
        practiceConcept: "window_functions",
      },
      {
        id: "row-number-rank",
        title: "ROW_NUMBER, RANK, DENSE_RANK",
        blurb: "Three ways to number rows within a group.",
        bigIdea:
          "Three sibling functions that number rows. They differ only in how they handle ties.",
        realWorld:
          "Like ranking runners in a race. ROW_NUMBER = give everyone a unique number even on ties (1, 2, 3, 4). RANK = ties share a number, then skip (1, 2, 2, 4). DENSE_RANK = ties share but don't skip (1, 2, 2, 3).",
        body: [],
        richBody: [
          {
            kind: "compare",
            caption: "How ties are handled",
            left: {
              title: "Two runners tied at 10s, next at 12s",
              items: [
                "ROW_NUMBER: 1, 2, 3 (unique forced)",
                "RANK: 1, 1, 3 (tied at 1, then skip)",
                "DENSE_RANK: 1, 1, 2 (tied at 1, then continue)",
              ],
            },
            right: {
              title: "Common uses",
              items: [
                "ROW_NUMBER: pick \"top N\" with unique cutoff",
                "RANK: leaderboards where 2nd place exists if there's no clear 1st",
                "DENSE_RANK: percentile-style bucketing",
              ],
            },
          },
          {
            kind: "code",
            code: "-- each customer's most recent order (top-1 per group)\nWITH ranked AS (\n  SELECT o.*,\n         ROW_NUMBER() OVER (\n           PARTITION BY customer_id ORDER BY order_date DESC\n         ) AS rn\n  FROM orders o\n)\nSELECT * FROM ranked WHERE rn = 1;",
          },
        ],
        examples: [],
        practiceConcept: "window_functions",
      },
      {
        id: "lag-lead",
        title: "LAG and LEAD",
        blurb: "Peek at the previous or next row.",
        bigIdea:
          "LAG(col) returns the previous row's value. LEAD(col) returns the next row's value. Both need ORDER BY inside OVER to define order.",
        realWorld:
          "Like reading your fitness app's weekly weight. \"This week minus last week\" = LAG. Every row gets a column showing the previous row's value next to it.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "Killer uses",
            items: [
              "Deltas — this period minus last period",
              "Gap detection — how long between events",
              "Sessionization — start a new session when LAG difference > N minutes",
              "Detecting changes — flag rows where col != LAG(col)",
            ],
          },
          {
            kind: "code",
            code: "-- days between each customer's consecutive orders\nSELECT customer_id, order_date,\n       order_date - LAG(order_date) OVER (\n         PARTITION BY customer_id ORDER BY order_date\n       ) AS days_since_last\nFROM orders;",
            note: "First order per customer gets NULL (no previous row).",
          },
        ],
        examples: [],
        practiceConcept: "window_functions",
      },
      {
        id: "running-totals",
        title: "Running totals and moving averages",
        blurb: "Add ORDER BY to a windowed SUM to make it cumulative.",
        bigIdea:
          "`SUM(x) OVER (ORDER BY d)` returns the sum so far for each row — a running total. Add PARTITION BY to reset per group.",
        realWorld:
          "Like a fundraising thermometer that keeps rising. Each donation adds to the previous total — by row 100 you see the total of donations 1 through 100.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- cumulative revenue by day\nSELECT order_date, total_amount,\n       SUM(total_amount) OVER (ORDER BY order_date) AS running_total\nFROM orders\nORDER BY order_date;",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "Combine with PARTITION BY for per-group running totals: `SUM(x) OVER (PARTITION BY customer_id ORDER BY order_date)` resets the running total at each customer.",
          },
        ],
        examples: [],
        practiceConcept: "window_functions",
      },
      {
        id: "window-frames",
        title: "Window frames (ROWS / RANGE BETWEEN)",
        blurb: "Control which rows the window actually covers.",
        bigIdea:
          "By default, the window covers all rows from the partition start to the current row. A frame clause lets you pick a different range — e.g., last 7 rows.",
        realWorld:
          "Like a 7-day weather forecast that always shows the last 7 days. The window slides along with you — at any moment it covers the current day and the 6 days before.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "Common frame patterns",
            items: [
              "`ROWS BETWEEN 6 PRECEDING AND CURRENT ROW` — last 7 rows (moving window)",
              "`ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` — start to current (default for SUM with ORDER BY)",
              "`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` — entire partition",
              "`ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING` — current row + neighbors",
            ],
          },
          {
            kind: "code",
            code: "-- 7-day moving average of daily revenue\nSELECT order_date,\n       AVG(total_amount) OVER (\n         ORDER BY order_date\n         ROWS BETWEEN 6 PRECEDING AND CURRENT ROW\n       ) AS avg_7d\nFROM orders;",
          },
        ],
        examples: [],
        practiceConcept: "window_functions",
      },
      {
        id: "first-last-value",
        title: "FIRST_VALUE, LAST_VALUE, NTH_VALUE",
        blurb: "Pick a specific row's value within a window.",
        bigIdea:
          "FIRST_VALUE gets the first row in the window. LAST_VALUE gets the last. NTH_VALUE gets the Nth. All need ORDER BY to know what \"first\" means.",
        realWorld:
          "Like asking, for each test you've taken, \"what was my FIRST score this semester? What was my LAST?\" Every row of the result gets those reference points attached.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- each order, plus this customer's first-ever order date\nSELECT o.id, o.customer_id, o.order_date,\n       FIRST_VALUE(order_date) OVER (\n         PARTITION BY customer_id ORDER BY order_date\n       ) AS first_order\nFROM orders o;",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "LAST_VALUE has a sneaky default frame that ends at the current row, so it often returns the current value, not the actual last in the group. Add `ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING` to get the real last.",
          },
        ],
        examples: [],
        practiceConcept: "window_functions",
      },
      {
        id: "ntile",
        title: "NTILE — bucketing rows into N groups",
        blurb: "Split your data into N equal-sized chunks.",
        bigIdea:
          "NTILE(n) labels each row with its bucket number from 1 to n. Used for quartiles, deciles, percentile analysis.",
        realWorld:
          "Like sorting a class by grade and splitting into four groups: top quarter, second quarter, etc. NTILE(4) is exactly that — quartile labels.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- tag each customer with their revenue quartile\nSELECT customer_id, total,\n       NTILE(4) OVER (ORDER BY total DESC) AS quartile\nFROM (\n  SELECT customer_id, SUM(total_amount) AS total\n  FROM orders GROUP BY 1\n) t;",
            note: "Quartile 1 = top 25% by spend. Quartile 4 = bottom 25%.",
          },
        ],
        examples: [],
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
        blurb: "Transform, slice, and inspect text values.",
        bigIdea:
          "Functions to join (`||`, CONCAT), measure (LENGTH), change case (UPPER, LOWER, INITCAP), strip whitespace (TRIM), slice (SUBSTRING), and find positions (POSITION).",
        realWorld:
          "Like the toolkit you reach for when cleaning up messy data — trimming extra spaces, capitalizing names, pulling out the part of an email before the @.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "The daily ones",
            items: [
              "`a || b` or `CONCAT(a, b)` — join strings",
              "`LENGTH(s)` — character count",
              "`UPPER(s)`, `LOWER(s)`, `INITCAP(s)` — case",
              "`TRIM(s)` — strip whitespace; LTRIM / RTRIM for one side",
              "`SUBSTRING(s, start, len)` — slice",
              "`POSITION(sub IN s)` — find a substring's position",
              "`REPLACE(s, find, replace)` — substitute text",
            ],
          },
          {
            kind: "code",
            code: "SELECT name,\n       UPPER(name) AS shouty,\n       SUBSTRING(email, 1, POSITION('@' IN email) - 1) AS local_part\nFROM customers;",
          },
        ],
        examples: [],
        practiceConcept: "string_functions",
      },
      {
        id: "date-functions",
        title: "Date and time functions",
        blurb: "EXTRACT, DATE_TRUNC, INTERVAL, NOW — your time toolkit.",
        bigIdea:
          "EXTRACT pulls a part out (year, month, dow). DATE_TRUNC zeros out everything below a unit. INTERVAL does date math.",
        realWorld:
          "Like asking about a stack of receipts. EXTRACT is \"what month is this one from?\" DATE_TRUNC is \"sort these into monthly buckets — collapse the day and time.\" INTERVAL is \"give me everything from the last 30 days.\"",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "Daily date tools",
            items: [
              "`NOW()` / `CURRENT_DATE` / `CURRENT_TIMESTAMP` — right now",
              "`EXTRACT(YEAR FROM ts)` — pull out year, month, day, dow, etc.",
              "`DATE_TRUNC('month', ts)` — zero out everything below month (great for grouping)",
              "`ts + INTERVAL '7 days'` — date math",
              "`AGE(ts1, ts2)` — human-friendly duration ('2 years 3 months')",
            ],
          },
          {
            kind: "code",
            code: "-- monthly signup counts for the last year\nSELECT DATE_TRUNC('month', signup_date) AS month, COUNT(*)\nFROM customers\nWHERE signup_date >= NOW() - INTERVAL '1 year'\nGROUP BY month\nORDER BY month;",
          },
        ],
        examples: [],
        practiceConcept: "date_functions",
      },
      {
        id: "case-when",
        title: "CASE WHEN — if/else inside a query",
        blurb: "Branch on a condition inside SELECT or WHERE.",
        bigIdea:
          "CASE is SQL's if/else. Test conditions in order; the first matching THEN runs. An optional ELSE catches everything else.",
        realWorld:
          "Like a flow chart: \"Are you under 18? Minor. No? Are you under 65? Adult. Otherwise? Senior.\" CASE walks down the list, takes the first match, and returns its value.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "SELECT name,\n       CASE\n         WHEN age < 18 THEN 'minor'\n         WHEN age < 65 THEN 'adult'\n         ELSE 'senior'\n       END AS life_stage\nFROM customers;",
          },
          {
            kind: "bullets",
            title: "Where you'll use it",
            items: [
              "Bucketing numeric values into named tiers",
              "Renaming codes ('A' → 'Active', 'I' → 'Inactive')",
              "Conditional aggregation: `SUM(CASE WHEN ... THEN amount END)`",
              "Computing pivot columns (one column per category)",
            ],
          },
        ],
        examples: [],
        practiceConcept: "case_when",
      },
      {
        id: "coalesce-nullif",
        title: "COALESCE and NULLIF",
        blurb: "Tame NULL in two directions.",
        bigIdea:
          "COALESCE picks the first non-NULL from its arguments. NULLIF converts a sentinel value (like 0 or '') into a real NULL.",
        realWorld:
          "COALESCE is a fallback chain — \"use a, or b, or c, or finally 0.\" NULLIF is the opposite — \"treat empty string as if it were missing.\"",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "SELECT name,\n       COALESCE(age, 0) AS age_or_zero,\n       COALESCE(nickname, name) AS display_name,\n       NULLIF(country, '') AS country_clean\nFROM customers;",
            note: "First two use COALESCE for defaults. NULLIF turns empty strings into NULL so downstream aggregates skip them.",
          },
        ],
        examples: [],
        practiceConcept: "null_handling",
      },
      {
        id: "type-casts",
        title: "Type casts",
        blurb: "Convert between data types with `::` or `CAST()`.",
        bigIdea:
          "Two syntaxes for the same thing: SQL-standard `CAST(x AS TYPE)` and Postgres shorthand `x::TYPE`.",
        realWorld:
          "Like converting units when cooking. \"What's 250 grams in cups?\" You don't change the recipe — you just translate the unit so the math works.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "Common casts you'll need",
            items: [
              "integer/integer → drops decimals; cast to numeric for real division",
              "'2024-01-01'::date — text to date",
              "amount::text — number to string for concatenation",
              "x::jsonb — text JSON to a JSONB column",
            ],
          },
          {
            kind: "code",
            code: "-- safe integer division\nSELECT SUM(quantity)::numeric / COUNT(*)::numeric AS avg_per_order\nFROM order_items;",
            note: "Without the cast, `5 / 2` is 2, not 2.5. Numeric cast preserves the decimal.",
          },
        ],
        examples: [],
      },
      {
        id: "regex",
        title: "Regular expressions",
        blurb: "When LIKE patterns aren't powerful enough.",
        bigIdea:
          "Postgres has full regex via `~` (match), `~*` (case-insensitive), `!~` (doesn't match). Plus `regexp_replace`, `regexp_matches`, `regexp_split_to_array`.",
        realWorld:
          "Like the find-and-replace in a text editor with \"Use Regex\" turned on. You can match patterns LIKE can't dream of: character classes, anchors, alternation, captures.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- emails with a numeric local part: '123@...'\nSELECT email FROM customers WHERE email ~ '^[0-9]+@';\n\n-- extract domain from each email\nSELECT regexp_replace(email, '^.*@', '') AS domain FROM customers;",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "If you're just doing prefix or contains matching, LIKE/ILIKE is simpler and friendlier to indexes. Reach for regex when you need real patterns.",
          },
        ],
        examples: [],
        practiceConcept: "string_functions",
      },
      {
        id: "time-zones",
        title: "Time zones",
        blurb: "TIMESTAMP vs TIMESTAMPTZ — always pick TIMESTAMPTZ.",
        bigIdea:
          "TIMESTAMP stores wall-clock time with no zone — ambiguous. TIMESTAMPTZ stores an absolute UTC instant. Use `AT TIME ZONE 'name'` to view it in any zone.",
        realWorld:
          "Like telling a friend \"I'll call you at 3pm.\" 3pm WHERE? Without a zone, the time is meaningless. TIMESTAMPTZ is the same instant globally; display flips per viewer's zone.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- group orders by local-time day in New York\nSELECT DATE_TRUNC('day', order_ts AT TIME ZONE 'America/New_York') AS local_day,\n       COUNT(*)\nFROM orders\nGROUP BY 1;",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "Storing local times in TIMESTAMP and assuming everyone is in the same zone is one of the most common date-related bugs. Pick TIMESTAMPTZ from day one.",
          },
        ],
        examples: [],
        practiceConcept: "date_functions",
      },
      {
        id: "generate-series",
        title: "generate_series — make a row stream",
        blurb: "Generate a sequence of numbers or dates AS ROWS.",
        bigIdea:
          "`generate_series(start, stop, step)` produces a row per value in the range. You can iterate without writing a loop.",
        realWorld:
          "Like a calendar grid that shows every day in January, even days with no events. Generate the dates first, then LEFT JOIN your data — missing days survive as NULLs.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- daily order count, with zeros for days with no orders\nWITH days AS (\n  SELECT generate_series('2025-01-01'::date, '2025-01-31'::date, '1 day') AS day\n)\nSELECT d.day, COUNT(o.id) AS orders\nFROM days d\nLEFT JOIN orders o ON o.order_date = d.day\nGROUP BY d.day\nORDER BY d.day;",
            note: "Without this, days with zero orders would just be missing from the result.",
          },
        ],
        examples: [],
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
        blurb: "Stack two result sets on top of each other.",
        bigIdea:
          "UNION combines two queries into one result, removing duplicates. UNION ALL keeps duplicates — faster and almost always what you want.",
        realWorld:
          "Like merging two contact lists into one. UNION dedupes — same person in both lists appears once. UNION ALL keeps everything, duplicates and all.",
        body: [],
        richBody: [
          {
            kind: "compare",
            caption: "UNION vs UNION ALL",
            left: {
              title: "UNION",
              items: [
                "Removes exact duplicate rows",
                "Slower (the dedup costs)",
                "Use when duplicates are genuinely wrong",
              ],
            },
            right: {
              title: "UNION ALL",
              items: [
                "Keeps everything",
                "Faster — no dedup work",
                "The default to reach for",
              ],
            },
          },
          {
            kind: "code",
            code: "SELECT id, name, 'customer' AS source FROM customers\nUNION ALL\nSELECT id, name, 'vendor' AS source FROM vendors;",
            note: "Both queries return the same shape: 3 columns, matching types.",
          },
        ],
        examples: [],
        practiceConcept: "set_operations",
      },
      {
        id: "intersect-except",
        title: "INTERSECT and EXCEPT",
        blurb: "Rows in both, or in one but not the other.",
        bigIdea:
          "INTERSECT keeps rows that appear in BOTH queries. EXCEPT keeps rows from the first that DON'T appear in the second.",
        realWorld:
          "Two guest lists. INTERSECT = \"who's on both lists.\" EXCEPT = \"who's on my list but not yours.\" Set math, applied to rows.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- emails that appear as both customer and vendor\nSELECT email FROM customers\nINTERSECT\nSELECT email FROM vendors;\n\n-- customers who aren't also vendors\nSELECT email FROM customers\nEXCEPT\nSELECT email FROM vendors;",
          },
        ],
        examples: [],
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
        title: "INSERT — add new rows",
        blurb: "Three flavors: single row, many rows, or rows from a SELECT.",
        bigIdea:
          "INSERT INTO table (cols...) VALUES (...). Or feed VALUES many tuples. Or SELECT from somewhere else.",
        realWorld:
          "Like adding new entries to a notebook. One at a time, a page of them, or copying from another notebook — same action, just different sources.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- one row\nINSERT INTO customers (name, email, country)\nVALUES ('Ada Lovelace', 'ada@example.com', 'UK');\n\n-- many rows\nINSERT INTO customers (name, email, country) VALUES\n  ('Marie',  'marie@x.com', 'France'),\n  ('Linus',  'linus@x.com', 'Finland');\n\n-- from a SELECT\nINSERT INTO archived_orders\nSELECT * FROM orders WHERE order_date < '2024-01-01';",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "Always list the column names explicitly. INSERT without column names depends on the table's column order, which can shift over time and break old queries.",
          },
        ],
        examples: [],
      },
      {
        id: "update",
        title: "UPDATE — change existing rows",
        blurb: "SET new values on rows that match the WHERE.",
        bigIdea:
          "UPDATE table SET col = value WHERE ... — without WHERE, you update every row in the table.",
        realWorld:
          "Like editing a contact list. \"Change the country of everyone whose country says 'USA' to 'United States'.\" One rule applied to every matching row.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "UPDATE customers\nSET country = 'United States'\nWHERE country = 'USA';",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "Always test the WHERE as a SELECT first. `UPDATE ... WHERE typo` with a mistake can hit every row. Run `SELECT * FROM customers WHERE country = 'USA'` first and confirm the rows look right before turning it into an UPDATE.",
          },
        ],
        examples: [],
      },
      {
        id: "delete",
        title: "DELETE — remove rows",
        blurb: "Same warning as UPDATE: no WHERE = empty table.",
        bigIdea:
          "DELETE FROM table WHERE ... removes the rows that match. Without WHERE, every row is gone.",
        realWorld:
          "Like deleting emails. With a filter applied (\"older than 1 year, no replies\"), you remove just the matching ones. Without one, you empty the entire inbox.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "DELETE FROM orders\nWHERE status = 'cancelled'\n  AND order_date < '2023-01-01';",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "Wrap destructive deletes in a transaction (BEGIN/COMMIT) and run a SELECT count first. Once committed, the rows are gone.",
          },
        ],
        examples: [],
      },
      {
        id: "upsert",
        title: "UPSERT (ON CONFLICT)",
        blurb: "Insert if it's new; update if it already exists.",
        bigIdea:
          "`INSERT ... ON CONFLICT (col) DO UPDATE SET ...` is Postgres shorthand for \"try to insert; if a key collides, update instead\".",
        realWorld:
          "Like saving a contact by phone number. New number? Add a new contact. Number already there? Update the name. One atomic operation.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "INSERT INTO customers (email, name)\nVALUES ('ada@example.com', 'Ada Lovelace')\nON CONFLICT (email)\nDO UPDATE SET name = EXCLUDED.name;",
            note: "`EXCLUDED` refers to the row that tried to insert. Use `EXCLUDED.col` to access its values.",
          },
        ],
        examples: [],
      },
      {
        id: "transactions",
        title: "Transactions",
        blurb: "Group statements so they all succeed or all fail together.",
        bigIdea:
          "Wrap statements in BEGIN ... COMMIT. If anything fails (or you ROLLBACK), the whole block is undone — as if it never happened.",
        realWorld:
          "Like writing a check between bank accounts. Two steps: deduct $100 here, add $100 there. If the second step fails, the first must be undone — otherwise money vanishes. Transactions guarantee both happen or neither does.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "BEGIN;\nUPDATE accounts SET balance = balance - 100 WHERE id = 1;\nUPDATE accounts SET balance = balance + 100 WHERE id = 2;\nCOMMIT;",
            note: "If anything between BEGIN and COMMIT fails, run ROLLBACK to undo everything.",
          },
          {
            kind: "callout",
            tone: "note",
            text: "Most database clients implicitly start a transaction for every statement and commit when it succeeds. Use explicit BEGIN/COMMIT when you need multiple statements to be all-or-nothing.",
          },
        ],
        examples: [],
      },
      {
        id: "returning",
        title: "RETURNING — values back from a write",
        blurb: "INSERT/UPDATE/DELETE can hand the affected rows back to you.",
        bigIdea:
          "Append `RETURNING col, ...` to any INSERT, UPDATE, or DELETE to get those columns from the rows you changed.",
        realWorld:
          "Like a check-in app that not only saves your visit but tells you the visit number right back. \"Visit #4823 — you've been here 12 times this year.\" Postgres can hand back data about what just happened.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "INSERT INTO customers (name, email)\nVALUES ('Marie', 'marie@example.com')\nRETURNING id, signup_date;",
            note: "Returns one row with the auto-generated id and default signup_date.",
          },
          {
            kind: "bullets",
            title: "Why it matters",
            items: [
              "Get auto-generated IDs without a second SELECT",
              "Log what got deleted: `DELETE ... RETURNING *`",
              "Chain writes via CTEs: insert in one CTE, use RETURNING in another",
            ],
          },
        ],
        examples: [],
      },
      {
        id: "truncate",
        title: "TRUNCATE vs DELETE",
        blurb: "TRUNCATE empties a table fast — but more brutally.",
        bigIdea:
          "DELETE removes rows one at a time, respecting triggers and FKs. TRUNCATE wipes the whole table in one shot — much faster, but bypasses triggers and resets identities.",
        realWorld:
          "DELETE is like erasing rows one at a time with an eraser. TRUNCATE is like ripping the page out and tossing it. Fast, brutal, harder to undo.",
        body: [],
        richBody: [
          {
            kind: "compare",
            caption: "When to use which",
            left: {
              title: "DELETE",
              items: [
                "Respects triggers + FKs",
                "Can use WHERE for partial deletion",
                "Slower on large tables",
                "Easier to ROLLBACK inside a transaction",
              ],
            },
            right: {
              title: "TRUNCATE",
              items: [
                "All-or-nothing — no WHERE",
                "Bypasses triggers",
                "Resets sequences (with RESTART IDENTITY)",
                "Use for staging tables you want to nuke fast",
              ],
            },
          },
          {
            kind: "code",
            code: "TRUNCATE TABLE staging_orders RESTART IDENTITY CASCADE;",
          },
        ],
        examples: [],
      },
      {
        id: "isolation-levels",
        title: "Transaction isolation levels",
        blurb: "How much your transaction can see of other transactions.",
        bigIdea:
          "Three levels matter in Postgres: READ COMMITTED (default), REPEATABLE READ (stable snapshot), and SERIALIZABLE (full conflict detection).",
        realWorld:
          "Like a photo at a busy intersection. READ COMMITTED takes a new photo each step (things move). REPEATABLE READ takes one photo at the start and pretends nothing moves. SERIALIZABLE adds: \"if our photo disagrees with reality in a way that matters, abort.\"",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "Three levels",
            items: [
              "READ COMMITTED — each statement sees the latest committed data when it runs. Postgres default.",
              "REPEATABLE READ — the whole transaction sees a frozen snapshot from its start.",
              "SERIALIZABLE — strongest. Adds conflict detection; rejects transactions whose interleaving would violate true serial order.",
            ],
          },
          {
            kind: "code",
            code: "BEGIN ISOLATION LEVEL SERIALIZABLE;\n  -- ... statements ...\nCOMMIT;",
          },
          {
            kind: "callout",
            tone: "note",
            text: "Most apps never change isolation level. Reach for SERIALIZABLE for money transfers / inventory adjustments — and be ready to retry the transaction if Postgres aborts it.",
          },
        ],
        examples: [],
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
        title: "CREATE TABLE — define a new table",
        blurb: "Columns, types, and constraints together in one statement.",
        bigIdea:
          "CREATE TABLE declares a table's name, its columns and their types, and any constraints (NOT NULL, DEFAULT, UNIQUE, CHECK, FK).",
        realWorld:
          "Like designing a form before printing it. You decide which fields exist, what kind of value each takes, which ones are required, which ones default to something. Once printed, every row of the form follows the same rules.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "CREATE TABLE products (\n  id          SERIAL PRIMARY KEY,\n  name        TEXT NOT NULL,\n  price       NUMERIC(10,2) NOT NULL CHECK (price >= 0),\n  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()\n);",
            note: "PK gives uniqueness + an index for free. CHECK enforces price >= 0. DEFAULT means you don't have to supply created_at on insert.",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "Pick types deliberately. NUMERIC for money. TIMESTAMPTZ for time. TEXT for strings (unless you need a hard length cap — usually you don't).",
          },
        ],
        examples: [],
      },
      {
        id: "constraints",
        title: "Constraints — rules the database enforces",
        blurb: "Constraints make whole classes of bad data impossible.",
        bigIdea:
          "Constraints are checks the database runs on every insert/update. If a row violates one, the write fails. Bugs caught at the source.",
        realWorld:
          "Like an online form's validation rules. \"Email must contain @.\" \"Age must be a number.\" \"Password must be filled in.\" The form refuses to submit anything that breaks the rules. Constraints are that, in the database.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "The six you'll use",
            items: [
              "PRIMARY KEY — unique + not null. Identifies the row.",
              "FOREIGN KEY — must point at a real row in another table.",
              "UNIQUE — no duplicates allowed in this column.",
              "NOT NULL — value must be supplied.",
              "CHECK (expr) — custom rule. e.g. CHECK (price >= 0).",
              "DEFAULT — value to use when the column is omitted on insert.",
            ],
          },
          {
            kind: "code",
            code: "ALTER TABLE orders\nADD CONSTRAINT positive_total CHECK (total_amount >= 0);",
          },
        ],
        examples: [],
      },
      {
        id: "normalization",
        title: "Normalization",
        blurb: "Store every fact once, in exactly one place.",
        bigIdea:
          "Normalize means: don't repeat data across tables. Store customer name in `customers`. Orders reference customer_id — never duplicate the name.",
        realWorld:
          "Like an address book. You store your friend's phone number ONCE in their contact card. Everywhere else (a calendar event, a group chat) just references their contact. Change the number once, everything stays in sync.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "The three classic normal forms",
            items: [
              "1NF — no nested values in a cell. Each cell holds one atomic value.",
              "2NF — every non-key column depends on the WHOLE primary key (not part of it).",
              "3NF — non-key columns don't depend on other non-key columns.",
            ],
          },
          {
            kind: "callout",
            tone: "tip",
            text: "In day-to-day work, just remember: each fact lives in one table. If you find yourself copying a value into another table \"for convenience\", you're denormalizing — sometimes okay (next topic), but document why.",
          },
        ],
        examples: [],
      },
      {
        id: "denormalization",
        title: "Denormalization tradeoffs",
        blurb: "When to break normalization on purpose.",
        bigIdea:
          "Storing some redundant data trades write complexity for read speed. Use it deliberately in analytics, data warehouses, and read-heavy systems.",
        realWorld:
          "Like keeping a printed copy of a phone number on your fridge. Slightly out of sync with the source, but instant to access. Worth it when you reference it often and the cost of being slightly stale is low.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "Common forms",
            items: [
              "Precomputed aggregates (a daily_revenue table)",
              "Materialized views (cached query results)",
              "Snapshot tables (point-in-time copies)",
              "Wide reporting tables flattening multi-table joins",
            ],
          },
          {
            kind: "callout",
            tone: "warning",
            text: "Always document WHY a column is denormalized and HOW it stays in sync (trigger, scheduled refresh, etc.). The next person reading the schema needs to know.",
          },
        ],
        examples: [],
      },
      {
        id: "alter-table",
        title: "ALTER TABLE — evolve the schema",
        blurb: "Add, drop, rename columns; change types; add or drop constraints.",
        bigIdea:
          "Schemas aren't frozen. ALTER TABLE lets you change a table over time — add a column, change a type, attach a constraint.",
        realWorld:
          "Like renovating a house. You don't tear it down to add a room — you build onto what's there. Some changes are cheap (paint), others are expensive (move a wall + everyone has to leave).",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "ALTER TABLE customers ADD COLUMN phone TEXT;\nALTER TABLE customers ALTER COLUMN phone SET NOT NULL;\nALTER TABLE customers RENAME COLUMN phone TO phone_number;\nALTER TABLE orders ADD CONSTRAINT positive_total CHECK (total_amount >= 0);",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "On production tables, ALTER takes an exclusive lock — concurrent queries wait. Adding a column is fast; changing a type can rewrite the whole table. Test in staging first.",
          },
        ],
        examples: [],
      },
      {
        id: "on-delete-cascade",
        title: "ON DELETE behavior",
        blurb: "What happens to child rows when their parent is deleted.",
        bigIdea:
          "Every FK has an ON DELETE rule. RESTRICT (default) blocks the parent delete. CASCADE deletes the children too. SET NULL nulls the FK. Pick deliberately.",
        realWorld:
          "Like deleting a folder on your computer. Should the files inside go too (CASCADE)? Or should the system stop you because they exist (RESTRICT)? Or move them to a 'no parent' bucket (SET NULL)? The right answer depends on what the child rows mean without the parent.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "The choices",
            items: [
              "RESTRICT (default) — refuse the parent delete if children exist. Safest.",
              "CASCADE — delete children automatically with the parent. Convenient + dangerous.",
              "SET NULL — null out the FK on children. Children stay, parent reference gone.",
              "SET DEFAULT — use the FK column's default value (often itself a FK to a placeholder).",
              "NO ACTION — like RESTRICT but checked at end of transaction.",
            ],
          },
          {
            kind: "code",
            code: "CREATE TABLE order_items (\n  id SERIAL PRIMARY KEY,\n  order_id INTEGER NOT NULL\n    REFERENCES orders(id) ON DELETE CASCADE,\n  product TEXT NOT NULL\n);",
            note: "Delete an order → all its items go too. Right choice here: items don't make sense without the order.",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "CASCADE is convenient but unforgiving. One unintentional parent delete can wipe out thousands of related rows. Test in staging.",
          },
        ],
        examples: [],
      },
      {
        id: "schemas-namespaces",
        title: "Schemas (namespaces)",
        blurb: "Group tables into named buckets within a database.",
        bigIdea:
          "A Postgres \"schema\" (different from \"the schema of a table\") is a namespace inside a database. Tables live as `schema_name.table_name`.",
        realWorld:
          "Like folders in a filing cabinet. Same cabinet (the database), different folders (schemas): one for active records, one for archives, one for drafts. Each folder can have a file called \"Q3 report\" — no collision because they're in different folders.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "CREATE SCHEMA analytics;\nCREATE TABLE analytics.daily_metrics (\n  d DATE PRIMARY KEY,\n  active_users INTEGER NOT NULL\n);",
          },
          {
            kind: "bullets",
            title: "Common layouts",
            items: [
              "public — your app's tables (default schema)",
              "analytics or reporting — BI / dashboard tables",
              "staging — raw imports before they're cleaned",
              "audit — change-tracking tables",
            ],
          },
        ],
        examples: [],
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
        title: "B-tree indexes — the default",
        blurb: "A sorted lookup that turns row searches from linear into logarithmic.",
        bigIdea:
          "An index is a sorted-on-disk structure that lets Postgres jump straight to matching rows instead of scanning the whole table.",
        realWorld:
          "Like the index at the back of a textbook. Without it, to find \"photosynthesis\" you flip every page. With it, you flip three pages and land on the answer.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "When a B-tree index helps",
            items: [
              "Equality lookups: WHERE email = '...'",
              "Range scans: WHERE age BETWEEN 20 AND 30",
              "ORDER BY on the indexed column",
              "JOIN ON x = y when one side is indexed",
            ],
          },
          {
            kind: "code",
            code: "CREATE INDEX idx_orders_customer ON orders(customer_id);",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "Primary keys come with an index for free. FOREIGN KEY columns do NOT — adding an index on every FK column is one of the most reliable performance wins.",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "Indexes aren't free. Every insert/update has to maintain them. Don't index columns you don't query, and don't index columns with very few distinct values (like boolean — a full scan is faster).",
          },
        ],
        examples: [],
      },
      {
        id: "composite-partial",
        title: "Composite and partial indexes",
        blurb: "Multi-column indexes and filtered indexes.",
        bigIdea:
          "Composite index covers two or more columns in a fixed order. Partial index covers only the rows matching a WHERE.",
        realWorld:
          "Composite is like a phone book sorted by last name, then first name. Looking up \"Smith\" works great. Looking up just \"John\" doesn't — wrong sort order. Partial is like a special list of \"customers with unpaid invoices\" — smaller, faster, but only useful for that specific question.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "Composite index rules",
            items: [
              "Index on (a, b) helps WHERE a = ...",
              "Helps WHERE a = ... AND b = ...",
              "Does NOT help WHERE b = ... alone",
              "Order of columns matters — put the most-filtered column first",
            ],
          },
          {
            kind: "code",
            code: "-- partial index — only covers open orders\nCREATE INDEX idx_orders_open\nON orders(customer_id)\nWHERE status = 'open';",
            note: "Smaller and faster. Only used when the query has the same WHERE.",
          },
        ],
        examples: [],
      },
      {
        id: "explain",
        title: "EXPLAIN and EXPLAIN ANALYZE",
        blurb: "Ask Postgres how it plans to run a query.",
        bigIdea:
          "EXPLAIN shows the plan. EXPLAIN ANALYZE actually runs the query AND reports real times and row counts.",
        realWorld:
          "Like asking GPS to show the route before you drive. EXPLAIN is the route preview. EXPLAIN ANALYZE is taking the drive and getting actual minute-by-minute timing.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "EXPLAIN ANALYZE\nSELECT * FROM orders WHERE customer_id = 42;",
          },
          {
            kind: "bullets",
            title: "Red flags in a plan",
            items: [
              "Seq Scan on a large table where you expected an Index Scan",
              "Big gap between estimated rows and actual rows",
              "Sort step using lots of memory (Sort Method: external merge)",
              "Nested Loop joining big tables — usually wants a Hash Join",
            ],
          },
          {
            kind: "callout",
            tone: "tip",
            text: "Format the output as JSON for visualization: `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ...`. Tools like explain.depesz.com or pev2 turn that into a clickable tree.",
          },
        ],
        examples: [],
      },
      {
        id: "other-index-types",
        title: "Beyond B-tree: GIN, GiST, BRIN, Hash",
        blurb: "Different index types for different shapes of data.",
        bigIdea:
          "B-tree is the default. For other shapes — JSONB, arrays, full-text, geometric, time-series — Postgres ships specialized index types that B-tree can't match.",
        realWorld:
          "Like specialized search tools. A regular index card box (B-tree) is great for finding a name. But searching a book's text needs a different structure — an inverted index of every word (GIN). Each tool is best at its specific job.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "When to reach for each",
            items: [
              "B-tree — equality, range, ordering. The default. 95% of cases.",
              "GIN — JSONB containment, array membership, full-text search.",
              "GiST — geometric data, range types, fuzzy text search.",
              "BRIN — huge tables where data is naturally ordered (time-series append-only).",
              "Hash — equality only. Rarely worth using over B-tree.",
            ],
          },
          {
            kind: "code",
            code: "-- GIN index for fast JSONB containment\nCREATE INDEX idx_events_payload ON events USING GIN (payload);\nSELECT * FROM events WHERE payload @> '{\"action\":\"login\"}';",
          },
        ],
        examples: [],
      },
      {
        id: "vacuum-analyze",
        title: "VACUUM and ANALYZE",
        blurb: "Two background maintenance commands that keep tables fast.",
        bigIdea:
          "VACUUM reclaims space left behind by updates and deletes. ANALYZE updates the planner's statistics so it picks good query plans.",
        realWorld:
          "VACUUM is like emptying the recycle bin after deleting files — the space is back. ANALYZE is like the planner consulting a fresh map: \"how big is each table? how varied is each column?\" Stale stats lead to bad plans.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "VACUUM ANALYZE orders;",
          },
          {
            kind: "callout",
            tone: "note",
            text: "Postgres runs autovacuum in the background — you usually don't need to do this manually. But after big bulk loads or mass deletes, a one-off VACUUM ANALYZE is a healthy habit.",
          },
        ],
        examples: [],
      },
      {
        id: "index-only-scans",
        title: "Index-only scans",
        blurb: "When the index alone has everything the query needs.",
        bigIdea:
          "Postgres can answer some queries straight from the index — skipping the table entirely. Add the SELECT columns to the index with INCLUDE to enable this.",
        realWorld:
          "Like a phone book that also lists each person's age. If you only need names and ages, you never have to walk to the person's house — the index alone has the answer.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- covering index for a common lookup\nCREATE INDEX idx_orders_lookup\nON orders (customer_id) INCLUDE (order_date, total_amount);",
            note: "WHERE columns first (customer_id), then INCLUDE the columns SELECT returns.",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "EXPLAIN will show \"Index Only Scan\" in the plan when this kicks in. Massive speedup for hot lookups.",
          },
        ],
        examples: [],
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
        blurb: "Store nested data structures and query into them.",
        bigIdea:
          "JSONB stores JSON in a binary format that's queryable. Use `->` to get a JSON field, `->>` for text, and `@>` to test containment.",
        realWorld:
          "Like an envelope that holds another envelope inside. Postgres can both store the envelopes AND open them up to find what's inside — without you having to define a column for every possible inner field.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "The operators that matter",
            items: [
              "`->` get a field as JSON: `payload->'name'`",
              "`->>` get a field as text: `payload->>'name'`",
              "`@>` does the JSON contain this subset: `payload @> '{\"type\":\"signup\"}'`",
              "`?` does this key exist: `payload ? 'email'`",
            ],
          },
          {
            kind: "code",
            code: "SELECT id, payload->>'name' AS name\nFROM events\nWHERE payload @> '{\"type\":\"signup\"}';",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "JSONB ≠ JSON. Always use JSONB — it's faster, indexable, and the binary format avoids re-parsing on every query. JSON is text-mode and slow.",
          },
        ],
        examples: [],
      },
      {
        id: "arrays",
        title: "Arrays",
        blurb: "A column that holds many values.",
        bigIdea:
          "Postgres supports array columns of any type. Useful for small, unbounded lists (tags, categories) without needing a separate join table.",
        realWorld:
          "Like the tags on a blog post. Instead of making a separate `post_tags` table for what's really just a list of words per post, store the words directly: `tags TEXT[]`.",
        body: [],
        richBody: [
          {
            kind: "bullets",
            title: "Array essentials",
            items: [
              "Indexing is 1-based: `tags[1]` returns the first tag",
              "`= ANY(arr)` tests membership: `'sql' = ANY(tags)`",
              "`UNNEST(arr)` expands an array into rows",
              "`array_length(arr, 1)` returns length along dim 1",
            ],
          },
          {
            kind: "code",
            code: "-- articles tagged with 'sql'\nSELECT id, tags FROM articles WHERE 'sql' = ANY(tags);\n\n-- one row per (article, tag)\nSELECT id, UNNEST(tags) AS tag FROM articles;",
          },
        ],
        examples: [],
      },
      {
        id: "views",
        title: "Views and materialized views",
        blurb: "Save a query under a name. Optionally cache its results.",
        bigIdea:
          "A VIEW is a saved SELECT — runs fresh every time. A MATERIALIZED VIEW caches the result on disk and refreshes on demand.",
        realWorld:
          "VIEW is a smart shortcut that re-runs each time: \"show me active customers\" is always today's answer. MATERIALIZED VIEW is a frozen photo: cheaper to query but goes stale until you re-take it.",
        body: [],
        richBody: [
          {
            kind: "compare",
            caption: "VIEW vs MATERIALIZED VIEW",
            left: {
              title: "VIEW",
              items: [
                "Re-runs every query",
                "Always fresh",
                "Performance = the underlying query's performance",
                "No extra storage",
              ],
            },
            right: {
              title: "MATERIALIZED VIEW",
              items: [
                "Stores the result on disk",
                "Stale until REFRESH MATERIALIZED VIEW",
                "Fast to query",
                "Best for expensive aggregates that don't need to be real-time",
              ],
            },
          },
          {
            kind: "code",
            code: "CREATE VIEW active_customers AS\nSELECT * FROM customers\nWHERE last_seen_at >= NOW() - INTERVAL '90 days';\n\n-- query it like a table\nSELECT COUNT(*) FROM active_customers;",
          },
        ],
        examples: [],
      },
      {
        id: "full-text",
        title: "Full-text search",
        blurb: "Native search with ranking, stemming, and language support.",
        bigIdea:
          "Postgres has real full-text search built in via tsvector + tsquery. Tokenization, stemming, stop words, ranking — all without leaving the database.",
        realWorld:
          "Like the search bar in a documentation site. You type \"how to JOIN\" and it finds articles about JOINs even when the exact phrase isn't there. That's stemming and tokenization at work.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "SELECT id, title\nFROM articles\nWHERE to_tsvector(title) @@ to_tsquery('postgres & index');",
            note: "`to_tsvector` builds a searchable form, `to_tsquery` parses the search expression, `@@` is the match operator.",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "For real use, store the tsvector in a generated column and index it with GIN. Then queries are instant. You probably don't need Elasticsearch — Postgres FTS goes a long way.",
          },
        ],
        examples: [],
      },
      {
        id: "uuid",
        title: "UUIDs",
        blurb: "Globally unique 128-bit IDs you can generate anywhere.",
        bigIdea:
          "UUIDs are random 128-bit identifiers. No central counter needed — any machine can mint one without collisions.",
        realWorld:
          "Like Apple's AirTag serial numbers. They're generated independently by every device on the planet — yet practically guaranteed to never collide. Compare that to a bakery numbering tickets 1, 2, 3 — needs a central counter.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "CREATE TABLE events (\n  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),\n  payload JSONB\n);",
          },
          {
            kind: "compare",
            caption: "UUID vs SERIAL",
            left: {
              title: "UUID",
              items: [
                "Generate anywhere, no coordination",
                "Safe to expose publicly (no leakage of count)",
                "Larger (16 bytes), slower index",
                "Random — bad for time ordering",
              ],
            },
            right: {
              title: "SERIAL / BIGSERIAL",
              items: [
                "Auto-incrementing integer",
                "Small (4 or 8 bytes), fast index",
                "Reveals row count if exposed",
                "Natural time order",
              ],
            },
          },
        ],
        examples: [],
      },
      {
        id: "generated-columns",
        title: "Generated columns",
        blurb: "A column whose value is automatically computed from other columns.",
        bigIdea:
          "`GENERATED ALWAYS AS (...) STORED` defines a column whose value is automatically computed and kept in sync — no trigger needed.",
        realWorld:
          "Like the \"Total\" line on a paper receipt that's printed automatically from quantity × price. You never write it yourself — it's always derived from the parts.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "CREATE TABLE order_items (\n  id SERIAL PRIMARY KEY,\n  quantity INTEGER NOT NULL,\n  unit_price NUMERIC(10,2) NOT NULL,\n  total NUMERIC(10,2)\n    GENERATED ALWAYS AS (quantity * unit_price) STORED\n);",
            note: "Postgres recomputes `total` whenever quantity or unit_price changes. You can never write to it directly.",
          },
        ],
        examples: [],
      },
      {
        id: "triggers",
        title: "Triggers",
        blurb: "Code that runs automatically on INSERT, UPDATE, or DELETE.",
        bigIdea:
          "A trigger calls a function before or after a row change. Use sparingly: audit logging, denormalized counters, complex validation.",
        realWorld:
          "Like security cameras that auto-record when motion is detected. You don't tell them to start — they fire on a trigger event. Powerful, but the cameras are invisible to people walking through.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "CREATE FUNCTION log_order_change() RETURNS trigger AS $$\nBEGIN\n  INSERT INTO order_log (order_id, action, changed_at)\n  VALUES (NEW.id, TG_OP, NOW());\n  RETURN NEW;\nEND;\n$$ LANGUAGE plpgsql;\n\nCREATE TRIGGER orders_audit\nAFTER INSERT OR UPDATE ON orders\nFOR EACH ROW EXECUTE FUNCTION log_order_change();",
          },
          {
            kind: "callout",
            tone: "warning",
            text: "Triggers make data flow harder to reason about — every write has invisible side effects. Use them when there's no other clean option (audit logs, cross-table invariants), not as a first reach.",
          },
        ],
        examples: [],
      },
      {
        id: "stored-functions",
        title: "Stored functions",
        blurb: "Encapsulate logic the database itself can run.",
        bigIdea:
          "Postgres has full procedural support via PL/pgSQL. Functions take parameters, return values or sets, and can be called from queries like built-ins.",
        realWorld:
          "Like saving a recipe so anyone can ask the kitchen to \"make me the customer-total dish\" without re-explaining the steps. The kitchen knows the recipe; the order is just a name.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "CREATE FUNCTION customer_total(cust_id INTEGER)\nRETURNS NUMERIC AS $$\n  SELECT COALESCE(SUM(total_amount), 0)\n  FROM orders\n  WHERE customer_id = cust_id;\n$$ LANGUAGE SQL STABLE;\n\n-- call like any built-in function\nSELECT name, customer_total(id) AS total FROM customers;",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "Mark functions STABLE / IMMUTABLE / VOLATILE so Postgres knows how aggressively to cache results. STABLE = same input gives same output during a transaction. IMMUTABLE = always.",
          },
        ],
        examples: [],
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
        blurb: "Find the first/last/best row in each category.",
        bigIdea:
          "Number the rows within each group with ROW_NUMBER, then keep the rows where rn = 1 (or rn <= N).",
        realWorld:
          "Like picking the top finisher in each event at a track meet. For each event (group), rank the runners by time (ORDER BY time), then keep the one with rank 1.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- most recent order per customer\nWITH ranked AS (\n  SELECT o.*,\n         ROW_NUMBER() OVER (\n           PARTITION BY customer_id\n           ORDER BY order_date DESC\n         ) AS rn\n  FROM orders o\n)\nSELECT * FROM ranked WHERE rn = 1;",
            note: "Top-3 per customer? Just change to `WHERE rn <= 3`.",
          },
          {
            kind: "callout",
            tone: "tip",
            text: "ROW_NUMBER is usually what you want here. Use RANK if ties should share a rank (and skip the next), DENSE_RANK if ties share but don't skip.",
          },
        ],
        examples: [],
        practiceConcept: "window_functions",
      },
      {
        id: "pivot-unpivot",
        title: "Pivot and unpivot",
        blurb: "Reshape data between long and wide.",
        bigIdea:
          "Pivot: rows to columns. Postgres does it with FILTER on aggregates — `COUNT(*) FILTER (WHERE category = 'A')` per category column. Unpivot: columns to rows — UNION ALL or jsonb_each.",
        realWorld:
          "Like a spreadsheet where you have \"category\" as a row label vs. each category as its own column. Same data, two shapes — pivot flips between them. Reports often want the wide shape; storage prefers the long one.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- orders per status, one column per status (pivot)\nSELECT customer_id,\n       COUNT(*) FILTER (WHERE status = 'completed') AS completed,\n       COUNT(*) FILTER (WHERE status = 'pending')   AS pending,\n       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled\nFROM orders\nGROUP BY customer_id;",
          },
        ],
        examples: [],
      },
      {
        id: "deduplication",
        title: "Deduplication",
        blurb: "Pick one canonical row per duplicate group.",
        bigIdea:
          "Partition by the duplicate key, ORDER BY a tiebreaker (usually \"most recent wins\"), keep ROW_NUMBER = 1.",
        realWorld:
          "Like cleaning up a contact list with the same person added three times. You pick one to keep (the one with the most info, or the most recent), delete the rest.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "WITH ranked AS (\n  SELECT *,\n         ROW_NUMBER() OVER (\n           PARTITION BY email\n           ORDER BY signup_date DESC\n         ) AS rn\n  FROM customers\n)\nSELECT * FROM ranked WHERE rn = 1;",
            note: "Keeps the most-recent signup per unique email. Change ORDER BY to pick a different winner.",
          },
        ],
        examples: [],
      },
      {
        id: "cohort-retention",
        title: "Cohort retention",
        blurb: "Did users from each signup month come back later?",
        bigIdea:
          "Bucket users by signup month (their cohort), then count how many were active in each subsequent month.",
        realWorld:
          "Like checking a yearbook 10 years later. \"Of the class of 2015, how many showed up to the 1-year reunion? The 5-year? The 10-year?\" Each year is a cohort; you track who comes back when.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "WITH cohorts AS (\n  SELECT id, DATE_TRUNC('month', signup_date) AS cohort\n  FROM customers\n),\nactivity AS (\n  SELECT customer_id, DATE_TRUNC('month', order_date) AS active_month\n  FROM orders\n  GROUP BY 1, 2\n)\nSELECT c.cohort, a.active_month, COUNT(*) AS active_users\nFROM cohorts c JOIN activity a ON a.customer_id = c.id\nGROUP BY 1, 2\nORDER BY 1, 2;",
          },
        ],
        examples: [],
      },
      {
        id: "funnels",
        title: "Funnel analysis",
        blurb: "Who made it from step 1 to step 2 to step 3.",
        bigIdea:
          "Build a CTE for each step in the funnel. LEFT JOIN them sequentially. Count rows at each step to see the drop-off.",
        realWorld:
          "Like watching how many people walked into a store (step 1), how many added something to cart (step 2), how many paid (step 3). At each step you lose some — the funnel narrows. The numbers tell you where to fix the leak.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "WITH signed_up AS (\n  SELECT id FROM customers\n),\nordered AS (\n  SELECT DISTINCT customer_id AS id FROM orders\n),\ncompleted AS (\n  SELECT DISTINCT customer_id AS id FROM orders WHERE status = 'completed'\n)\nSELECT (SELECT COUNT(*) FROM signed_up) AS step1_signups,\n       (SELECT COUNT(*) FROM ordered)   AS step2_ordered,\n       (SELECT COUNT(*) FROM completed) AS step3_completed;",
          },
        ],
        examples: [],
      },
      {
        id: "sessionization",
        title: "Sessionization",
        blurb: "Cluster a stream of events into sessions based on time gaps.",
        bigIdea:
          "Walk the user's events in order with LAG. If the gap from the previous event exceeds a threshold, mark a new session. SUM that flag as a running total — it becomes the session number.",
        realWorld:
          "Like measuring how many gym visits a member made. They tap their card 10 times today, but maybe 5 of those are one continuous workout and the others are separate visits. If the gap between two taps is over 30 minutes, count it as a new visit.",
        body: [],
        richBody: [
          {
            kind: "steps",
            title: "The pattern",
            items: [
              { title: "Get the previous event's time", detail: "Use LAG(event_at) OVER (PARTITION BY user_id ORDER BY event_at)." },
              { title: "Mark new sessions", detail: "If the gap is bigger than your threshold (e.g. 30 min), flag with 1. Else 0." },
              { title: "Running total of flags = session id", detail: "SUM the flag with the same PARTITION/ORDER BY. Each user's session id starts at 0 and ticks up." },
            ],
          },
          {
            kind: "code",
            code: "WITH gaps AS (\n  SELECT user_id, event_at,\n         CASE WHEN event_at - LAG(event_at) OVER (\n           PARTITION BY user_id ORDER BY event_at\n         ) > INTERVAL '30 min' THEN 1 ELSE 0 END AS new_session\n  FROM events\n)\nSELECT user_id, event_at,\n       SUM(new_session) OVER (\n         PARTITION BY user_id ORDER BY event_at\n       ) AS session_id\nFROM gaps;",
          },
        ],
        examples: [],
        practiceConcept: "window_functions",
      },
      {
        id: "gap-fill",
        title: "Time-series gap fill",
        blurb: "Show every day in the range, even days with zero activity.",
        bigIdea:
          "Naive GROUP BY only emits rows for periods that had data. To get a complete time axis, generate the dates yourself and LEFT JOIN your data onto them.",
        realWorld:
          "Like a daily attendance chart. If 3 students were absent every day this week, naive GROUP BY would skip them entirely. Gap fill says: show every student, every day, mark zeros where there was no attendance.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "WITH days AS (\n  SELECT generate_series('2025-01-01'::date, CURRENT_DATE, '1 day') AS day\n)\nSELECT d.day,\n       COALESCE(COUNT(o.id), 0) AS orders\nFROM days d\nLEFT JOIN orders o ON o.order_date = d.day\nGROUP BY d.day\nORDER BY d.day;",
            note: "Every day in the range has a row, even ones with 0 orders.",
          },
        ],
        examples: [],
        practiceConcept: "date_functions",
      },
      {
        id: "hierarchical-queries",
        title: "Hierarchical queries",
        blurb: "Walk trees: org charts, threaded comments, category hierarchies.",
        bigIdea:
          "Self-referencing tables (employees → manager_id, comments → parent_id) form a tree. Recursive CTEs walk that tree, top-down for descendants or bottom-up for ancestors.",
        realWorld:
          "Like exploring your family tree. Start with one person, then ask \"who's their kids?\" Then \"and THEIR kids?\" Each level the tree expands. That's a recursive CTE — Postgres keeps applying the step until there's nothing more to add.",
        body: [],
        richBody: [
          {
            kind: "code",
            code: "-- entire reporting tree under a director\nWITH RECURSIVE team AS (\n  -- seed: the director\n  SELECT id, name, manager_id, 0 AS level\n  FROM employees WHERE id = 1\n  UNION ALL\n  -- step: anyone reporting to someone already in `team`\n  SELECT e.id, e.name, e.manager_id, t.level + 1\n  FROM employees e\n  JOIN team t ON e.manager_id = t.id\n)\nSELECT * FROM team ORDER BY level;",
          },
        ],
        examples: [],
        practiceConcept: "cte",
      },
    ],
  },
];
