from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel

from ..schemas import TableResult


class ColumnMeta(BaseModel):
    name: str
    ident: str
    guessed_type: str


class ColumnProfile(BaseModel):
    ident: str
    non_null: int
    nulls: int
    distinct: int | None = None


class StageProfile(BaseModel):
    index: int
    label: str
    row_count: int
    distinct_row_count: int | None = None
    columns: list[ColumnProfile]


class RuleModel(BaseModel):
    id: str
    type: str
    label: str
    params: dict[str, Any] = {}
    enabled: bool = True


class RuleResult(BaseModel):
    id: str
    label: str
    status: Literal["pass", "fail", "error"]
    violations: int
    message: str | None = None


class DatasetSummary(BaseModel):
    dataset_id: str
    source: Literal["upload", "generated"]
    row_count: int
    columns: list[ColumnMeta]
    raw_preview: TableResult
    profile: list[ColumnProfile]
    suggested_rules: list[RuleModel]


class StepModel(BaseModel):
    title: str = ""
    sql: str


class RunRequest(BaseModel):
    steps: list[StepModel] = []
    rules: list[RuleModel] = []
    up_to_index: int | None = None


class RunResponse(BaseModel):
    ok: bool
    failed_step_index: int | None = None
    error_message: str | None = None
    final_preview: TableResult | None = None
    stages: list[StageProfile] = []
    validation: list[RuleResult] = []


class ValidateRequest(BaseModel):
    steps: list[StepModel] = []
    rules: list[RuleModel] = []


class ValidateResponse(BaseModel):
    ok: bool
    failed_step_index: int | None = None
    error_message: str | None = None
    validation: list[RuleResult] = []


class GenerateRequest(BaseModel):
    seed: int | None = None


class ReviewRequest(BaseModel):
    steps: list[StepModel] = []
    rules: list[RuleModel] = []


class ReviewResponse(BaseModel):
    assessment: str
    remaining_issues: list[str] = []
    suggestions: list[str] = []
    praise: list[str] = []
    score: int
