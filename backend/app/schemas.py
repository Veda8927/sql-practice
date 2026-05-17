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


class NewQuestionRequest(BaseModel):
    concept: str | None = None
    difficulty: Literal["easy", "medium", "hard"] | None = None


class TableResult(BaseModel):
    columns: list[str]
    rows: list[list[Any]]


class QuestionResponse(BaseModel):
    question: str
    ordered_results: bool
    concepts: list[str]
    difficulty: Literal["easy", "medium", "hard"]
    expected_output: TableResult | None = None


class SubmitRequest(BaseModel):
    sql: str


class GradeResult(BaseModel):
    status: Literal["correct", "wrong", "error"]
    user_output: TableResult | None = None
    expected_output: TableResult | None = None
    error_message: str | None = None


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


class GiveUpResponse(BaseModel):
    reference_sql: str
    summary: str
    steps: list[SolutionStep]
    final_thought: str
