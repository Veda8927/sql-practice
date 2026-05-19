from typing import Any, Literal

from pydantic import BaseModel, Field


class ColumnInfo(BaseModel):
    name: str
    type: str
    nullable: bool
    primary_key: bool = False
    foreign_key: str | None = None  # "table.column" if FK


class TableInfo(BaseModel):
    name: str
    columns: list[ColumnInfo]
    sample_rows: list[dict[str, Any]]
    row_count: int


class SchemaInfo(BaseModel):
    tables: list[TableInfo]
    seed: int
    scenario_id: str | None = None
    scenario_label: str | None = None


class ResetDataRequest(BaseModel):
    seed: int | None = None
    mode: Literal["auto", "ai", "ai_fresh"] = "auto"
    scenario: str | None = None


class NewQuestionRequest(BaseModel):
    concept: str | None = None
    difficulty: Literal["easy", "medium", "hard"] | None = None


class TableResult(BaseModel):
    columns: list[str]
    rows: list[list[Any]]


class QuestionSchemaTable(BaseModel):
    name: str
    columns: list[str]


class QuestionSchemaJoin(BaseModel):
    from_table: str
    from_column: str
    to_table: str
    to_column: str


class QuestionSchemaContext(BaseModel):
    tables: list[QuestionSchemaTable]
    joins: list[QuestionSchemaJoin]


class QuestionResponse(BaseModel):
    id: str
    question: str
    ordered_results: bool
    concepts: list[str]
    difficulty: Literal["easy", "medium", "hard"]
    expected_output: TableResult | None = None
    schema_context: QuestionSchemaContext | None = None


class QuestionHistoryItem(BaseModel):
    id: str
    question: str
    concepts: list[str]
    difficulty: Literal["easy", "medium", "hard"]


class SelectQuestionRequest(BaseModel):
    question_id: str


class SubmitRequest(BaseModel):
    sql: str


class GradeResult(BaseModel):
    status: Literal["correct", "wrong", "error"]
    user_output: TableResult | None = None
    expected_output: TableResult | None = None
    error_message: str | None = None
    execution_time_ms: float | None = None
    reference_time_ms: float | None = None


class RunQueryRequest(BaseModel):
    sql: str


class RunQueryResponse(BaseModel):
    status: Literal["ok", "error"]
    output: TableResult | None = None
    error_message: str | None = None
    execution_time_ms: float | None = None


class ExplainRequest(BaseModel):
    sql: str


class TypoCorrection(BaseModel):
    wrong: str
    right: str


class ExplainResponse(BaseModel):
    explanation: str
    typo_corrections: list[TypoCorrection] = Field(default_factory=list)


class SolutionStep(BaseModel):
    title: str
    what_it_does: str
    sql_snippet: str
    how_postgres_reads_it: str


class BreakdownItem(BaseModel):
    phrase: str
    means: str


class GiveUpResponse(BaseModel):
    reference_sql: str
    summary: str
    breakdown: list[BreakdownItem] = Field(default_factory=list)
    approach: str = ""
    steps: list[SolutionStep]
    final_thought: str


class HintRequest(BaseModel):
    sql: str | None = None


class HintResponse(BaseModel):
    hint: str
    suggested_sql: str | None = None


class ErrorHelpResponse(BaseModel):
    explanation: str
    next_step: str
    suggested_sql: str | None = None


class PerformanceRequest(BaseModel):
    sql: str


class PerformanceResponse(BaseModel):
    user_time_ms: float | None = None
    reference_time_ms: float | None = None
    raw_plan: Any
    summary: str
    suggestions: list[str]
    optimized_sql: str | None = None
