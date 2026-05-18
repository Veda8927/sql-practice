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

export type Topic = {
  id: string;
  title: string;
  blurb: string;
  body: string[];
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
        blurb: "A declarative language for asking questions of a database.",
        body: [
          "SQL (Structured Query Language) is how you talk to a relational database. You describe WHAT you want — 'all customers from Canada' — and the database figures out HOW to fetch it. That's the 'declarative' part.",
          "Every relational database (Postgres, MySQL, SQLite, SQL Server, Oracle) speaks SQL, but each has its own dialect with small differences. This roadmap uses PostgreSQL — the dialect most data analysts and product engineers see today.",
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
        blurb: "The shape of relational data.",
        body: [
          "A relational database is a collection of TABLES. Each table is a grid of ROWS (records) and COLUMNS (fields). Every row in a table has the same columns; every column has a fixed data type.",
          "Think of a spreadsheet, but with strict types per column (you can't put text in a number column) and the ability to link rows across sheets via shared IDs.",
        ],
        examples: [
          {
            code: "-- customers table\n-- id  | name      | email           | country\n-- ----|-----------|-----------------|--------\n--   1 | Ava Patel | ava@example.com | Canada\n--   2 | Liam Chen | liam@example... | Japan",
            note: "Every row has the same four columns, in the same types.",
          },
        ],
      },
      {
        id: "data-types",
        title: "Data types",
        blurb: "Numbers, text, dates, booleans, JSON, arrays.",
        body: [
          "Every column has a type. The big buckets in Postgres: INTEGER and NUMERIC for numbers, TEXT for strings, DATE / TIMESTAMP for time, BOOLEAN for true/false, JSONB for nested objects, and arrays for lists.",
          "Picking the right type matters: NUMERIC(10,2) for money keeps cents precise where FLOAT would round; TIMESTAMPTZ stores time zones; TEXT is unbounded where VARCHAR(50) caps length.",
        ],
        examples: [
          {
            code: "CREATE TABLE orders (\n  id            SERIAL PRIMARY KEY,\n  customer_id   INTEGER NOT NULL,\n  order_date    DATE NOT NULL,\n  status        TEXT,\n  total_amount  NUMERIC(10, 2) NOT NULL\n);",
            note: "Mixed types — SERIAL auto-numbers, NUMERIC keeps decimals exact.",
          },
        ],
      },
      {
        id: "primary-foreign-keys",
        title: "Primary keys and foreign keys",
        blurb: "How rows are uniquely identified and how tables link.",
        body: [
          "A PRIMARY KEY uniquely identifies a row. Usually it's a single column called `id`. No two rows can share a primary key, and it can't be NULL.",
          "A FOREIGN KEY is a column that points to another table's primary key. `orders.customer_id` points to `customers.id` — that's how you say 'this order belongs to that customer'. Foreign keys keep your data honest: the DB refuses to insert an order pointing at a customer that doesn't exist.",
        ],
        examples: [
          {
            code: "CREATE TABLE orders (\n  id SERIAL PRIMARY KEY,\n  customer_id INTEGER NOT NULL REFERENCES customers(id),\n  order_date DATE NOT NULL\n);",
            note: "REFERENCES is the FK constraint. Now every order must point to a real customer.",
          },
        ],
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
        blurb: "Pick which columns from which table.",
        body: [
          "Every query starts with SELECT (which columns) and FROM (which table). The order of clauses in a query is fixed: SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT.",
          "Tip: avoid `SELECT *` in real code. Naming columns explicitly makes queries faster, safer, and clearer to readers.",
        ],
        examples: [
          {
            code: "SELECT name, email, signup_date\nFROM customers;",
          },
          {
            code: "-- Aliases rename columns or tables\nSELECT name AS customer_name, signup_date AS joined\nFROM customers AS c;",
          },
        ],
      },
      {
        id: "where-filtering",
        title: "WHERE — filtering rows",
        blurb: "Keep only the rows that match a condition.",
        body: [
          "WHERE is how you narrow a query. Use comparison operators (= < > <= >= <>), logical operators (AND, OR, NOT), and parentheses for grouping.",
          "Common patterns: equality (`country = 'Canada'`), ranges (`age BETWEEN 18 AND 30`), set membership (`status IN ('completed','pending')`), pattern match (`email LIKE '%@gmail.com'`).",
        ],
        examples: [
          {
            code: "SELECT *\nFROM orders\nWHERE status = 'completed'\n  AND total_amount > 100;",
          },
          {
            code: "SELECT name FROM customers\nWHERE country IN ('Canada', 'United States')\n   OR signup_date >= '2025-01-01';",
          },
        ],
      },
      {
        id: "order-by",
        title: "ORDER BY",
        blurb: "Sort the result rows.",
        body: [
          "Without ORDER BY, the database can return rows in any order. ORDER BY pins the order.",
          "You can sort by multiple columns (the second is a tiebreaker) and choose ASC (default) or DESC for each.",
        ],
        examples: [
          {
            code: "SELECT name, total_amount\nFROM orders\nORDER BY total_amount DESC, name ASC;",
            note: "Highest spenders first, alphabetical name as tiebreaker.",
          },
        ],
      },
      {
        id: "limit-offset",
        title: "LIMIT and OFFSET",
        blurb: "First N rows, or paginate.",
        body: [
          "LIMIT N keeps only the first N rows. OFFSET N skips the first N — together they paginate.",
          "ORDER BY before LIMIT is almost always necessary — otherwise 'the first 10' is undefined.",
        ],
        examples: [
          {
            code: "SELECT name, total_amount\nFROM orders\nORDER BY total_amount DESC\nLIMIT 10;",
            note: "Top 10 orders by amount.",
          },
          {
            code: "-- Page 3, 20 per page\nSELECT * FROM customers ORDER BY id LIMIT 20 OFFSET 40;",
          },
        ],
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
        blurb: "COUNT, SUM, AVG, MIN, MAX.",
        body: [
          "Aggregates take many rows and return one number. Without GROUP BY they reduce the whole table to a single row.",
          "COUNT(*) counts rows (including NULLs). COUNT(col) counts non-NULL values in that column. COUNT(DISTINCT col) counts unique non-NULL values.",
        ],
        examples: [
          {
            code: "SELECT COUNT(*) AS total_customers,\n       COUNT(age) AS customers_with_age,\n       AVG(age) AS avg_age,\n       MAX(signup_date) AS most_recent_signup\nFROM customers;",
          },
        ],
        practiceConcept: "aggregations",
      },
      {
        id: "group-by",
        title: "GROUP BY",
        blurb: "One summary row per group.",
        body: [
          "GROUP BY collapses rows that share a value. After GROUP BY country, you get one row per country — aggregates in the SELECT are computed per group.",
          "Every column in SELECT must either be in GROUP BY or wrapped in an aggregate. The DB doesn't know which row to pick from a group otherwise.",
        ],
        examples: [
          {
            code: "SELECT country, COUNT(*) AS customer_count\nFROM customers\nGROUP BY country\nORDER BY customer_count DESC;",
          },
          {
            code: "-- Multiple group columns: one row per (country, year)\nSELECT country, EXTRACT(YEAR FROM signup_date) AS year, COUNT(*)\nFROM customers\nGROUP BY country, year;",
          },
        ],
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
        blurb: "Joins glue two tables together on matching values.",
        body: [
          "Think of a join as: for each row on the left, find every row on the right that matches a condition, and stitch them into one wider row.",
          "If a left row matches three right rows, you get three combined rows. If it matches zero, the behavior depends on the join TYPE (inner vs outer).",
        ],
        examples: [
          {
            code: "-- two tables, joined on customer_id\nSELECT c.name, o.order_date, o.total_amount\nFROM customers c\nJOIN orders o ON o.customer_id = c.id;",
            note: "One result row per (customer, order) pair.",
          },
        ],
        practiceConcept: "joins",
      },
      {
        id: "inner-join",
        title: "INNER JOIN",
        blurb: "Keep only rows that match on both sides.",
        body: [
          "INNER JOIN (or just JOIN) drops any left row that has no right match, and vice versa. The result has only rows where both sides exist.",
          "Use it when you don't care about customers who never ordered. Use LEFT JOIN when you do.",
        ],
        examples: [
          {
            code: "SELECT c.name, COUNT(o.id) AS order_count\nFROM customers c\nINNER JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name;",
            note: "Customers without orders won't appear.",
          },
        ],
        practiceConcept: "joins",
      },
      {
        id: "left-join",
        title: "LEFT JOIN",
        blurb: "Keep every left row, even with no match.",
        body: [
          "LEFT JOIN preserves every row on the left. If there's no matching right row, the right columns come back as NULL.",
          "This is how you find rows that DON'T have a match: LEFT JOIN, then WHERE right.id IS NULL.",
        ],
        examples: [
          {
            code: "-- all customers, even those with zero orders\nSELECT c.name, COUNT(o.id) AS order_count\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nGROUP BY c.name;",
          },
          {
            code: "-- customers who never placed an order\nSELECT c.name\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL;",
          },
        ],
        practiceConcept: "left_joins",
      },
      {
        id: "right-full-cross",
        title: "RIGHT, FULL OUTER, CROSS",
        blurb: "The less common joins.",
        body: [
          "RIGHT JOIN is the mirror of LEFT JOIN — preserves every row on the right. In practice, almost nobody writes RIGHT JOIN; swap the table order and use LEFT JOIN instead.",
          "FULL OUTER JOIN keeps every row from both sides, padding with NULL where there's no match. CROSS JOIN multiplies — every left row paired with every right row (the Cartesian product). Usually a mistake unless intentional.",
        ],
        examples: [
          {
            code: "-- Every (size, color) combination\nSELECT s.size, c.color\nFROM sizes s CROSS JOIN colors c;",
          },
        ],
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
    ],
  },
];
