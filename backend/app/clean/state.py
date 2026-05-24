from dataclasses import dataclass, field
from typing import Any


@dataclass
class CleanSession:
    dataset_id: str
    source: str  # "upload" | "generated"
    table: str  # fully-qualified, e.g. clean."dataset_ab12cd34"
    idents: list[str]  # sanitized column identifiers, in order
    row_count: int
    summary: dict[str, Any]  # cached DatasetSummary payload for GET /dataset
    rubric: list[dict[str, Any]] | None = field(default=None)
