"""/api/clean/* routes: upload, generate, dataset, run, review, export, reset."""
from __future__ import annotations

import csv
import io
import uuid
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response

from .. import llm
from ..db import engine
from ..deps import SessionDep
from ..schemas import TableResult
from ..state import SessionState
from . import generate, ingest
from .pipeline import export_pipeline, run_pipeline, validate_pipeline
from .py_pipeline import export_py_pipeline, run_py_pipeline
from .schemas import (
    DatasetSummary,
    GenerateRequest,
    ReviewRequest,
    ReviewResponse,
    RunRequest,
    RunResponse,
    ValidateRequest,
    ValidateResponse,
)
from .state import CleanSession

router = APIRouter(prefix="/api/clean", tags=["clean"])


def _table_for(state: SessionState) -> str:
    sid8 = (state.sid or "anon").replace("-", "")[:8] or "anon"
    return f'clean."dataset_{sid8}"'


async def _build_summary(
    state: SessionState, source: str, header: list[str], idents: list[str], rows
) -> DatasetSummary:
    table = _table_for(state)
    await ingest.load_dataset(table, idents, rows)
    profile = await ingest.profile_relation(table, idents)
    samples: dict[str, list[str]] = {ident: [] for ident in idents}
    for row in rows[:30]:
        for j, ident in enumerate(idents):
            if row[j]:
                samples[ident].append(row[j])
    columns = [
        {
            "name": header[j],
            "ident": idents[j],
            "guessed_type": ingest.guess_type(
                [str(r[j]) for r in rows[:200] if r[j] is not None]
            ),
        }
        for j in range(len(idents))
    ]
    preview_rows = [[r[j] for j in range(len(idents))] for r in rows[:50]]
    suggested = ingest.suggest_rules(profile, samples)
    dataset_id = str(uuid.uuid4())
    summary = DatasetSummary(
        dataset_id=dataset_id,
        source=source,
        row_count=profile["row_count"],
        columns=columns,
        raw_preview=TableResult(columns=idents, rows=preview_rows),
        profile=profile["columns"],
        suggested_rules=suggested,
    )
    state.clean = CleanSession(
        dataset_id=dataset_id, source=source, table=table, idents=idents,
        row_count=profile["row_count"], summary=summary.model_dump(), rubric=None,
    )
    return summary


@router.post("/upload", response_model=DatasetSummary)
async def upload(state: SessionDep, file: Annotated[UploadFile, File()]) -> DatasetSummary:
    raw = await file.read()
    try:
        header, rows = ingest.parse_csv(raw)
        idents = ingest.sanitize_idents(header)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return await _build_summary(state, "upload", header, idents, rows)


@router.post("/generate", response_model=DatasetSummary)
async def generate_dataset(req: GenerateRequest, state: SessionDep) -> DatasetSummary:
    seed = req.seed if req.seed is not None else uuid.uuid4().int % 1_000_000
    header, rows, rubric = generate.generate_messy(seed)
    idents = ingest.sanitize_idents(header)
    summary = await _build_summary(state, "generated", header, idents, rows)
    if state.clean is not None:
        state.clean.rubric = rubric
    return summary


@router.get("/dataset", response_model=DatasetSummary)
async def get_dataset(state: SessionDep) -> DatasetSummary:
    if state.clean is None:
        raise HTTPException(status_code=404, detail="No dataset loaded.")
    return DatasetSummary(**state.clean.summary)


@router.post("/run", response_model=RunResponse)
async def run(req: RunRequest, state: SessionDep) -> RunResponse:
    if state.clean is None:
        raise HTTPException(status_code=400, detail="Upload or generate a dataset first.")
    out = await run_pipeline(
        state.clean.table,
        [s.model_dump() for s in req.steps],
        [r.model_dump() for r in req.rules],
        up_to_index=req.up_to_index,
    )
    return RunResponse(**out)


@router.post("/py_run")
async def py_run(req: RunRequest, state: SessionDep) -> dict:
    """Run a pandas cleaning pipeline (each step's `sql` field holds pandas code)."""
    if state.clean is None:
        raise HTTPException(status_code=400, detail="Upload or generate a dataset first.")
    return await run_py_pipeline(
        state.clean.table,
        [s.model_dump() for s in req.steps],
        [r.model_dump() for r in req.rules],
    )


@router.post("/py_review", response_model=ReviewResponse)
async def py_review(req: ReviewRequest, state: SessionDep) -> ReviewResponse:
    if state.clean is None:
        raise HTTPException(status_code=400, detail="Upload or generate a dataset first.")
    run_out = await run_py_pipeline(
        state.clean.table,
        [s.model_dump() for s in req.steps],
        [r.model_dump() for r in req.rules],
    )
    payload = {
        "raw_profile": run_out["stages"][0] if run_out["stages"] else None,
        "final_profile": run_out["stages"][-1] if run_out["stages"] else None,
        "steps": [s.model_dump() for s in req.steps],
        "validation": run_out.get("validation", []),
        "pipeline_ok": run_out["ok"],
        "error_message": run_out["error_message"],
        "rubric": state.clean.rubric,
    }
    try:
        data = await llm.review_py_cleaning(payload)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e)) from e
    return ReviewResponse(**data)


@router.post("/py_export")
async def py_export(req: RunRequest, state: SessionDep) -> Response:
    """Run the pandas pipeline and stream the cleaned data as a CSV download."""
    if state.clean is None:
        raise HTTPException(status_code=400, detail="Upload or generate a dataset first.")
    csv_text, error = await export_py_pipeline(
        state.clean.table, [s.model_dump() for s in req.steps]
    )
    if error or csv_text is None:
        raise HTTPException(status_code=400, detail=error or "Export failed.")
    return Response(
        content=csv_text,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="cleaned.csv"'},
    )


@router.post("/export")
async def export(req: RunRequest, state: SessionDep) -> Response:
    """Run the full pipeline and stream the cleaned data back as a CSV download."""
    if state.clean is None:
        raise HTTPException(status_code=400, detail="Upload or generate a dataset first.")
    data, error = await export_pipeline(
        state.clean.table, [s.model_dump() for s in req.steps]
    )
    if error or data is None:
        raise HTTPException(status_code=400, detail=error or "Export failed.")
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(data["columns"])
    for row in data["rows"]:
        writer.writerow(["" if v is None else v for v in row])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="cleaned.csv"'},
    )


@router.post("/validate", response_model=ValidateResponse)
async def validate(req: ValidateRequest, state: SessionDep) -> ValidateResponse:
    if state.clean is None:
        raise HTTPException(status_code=400, detail="Upload or generate a dataset first.")
    out = await validate_pipeline(
        state.clean.table,
        [s.model_dump() for s in req.steps],
        [r.model_dump() for r in req.rules],
    )
    return ValidateResponse(**out)


@router.post("/review", response_model=ReviewResponse)
async def review(req: ReviewRequest, state: SessionDep) -> ReviewResponse:
    if state.clean is None:
        raise HTTPException(status_code=400, detail="Upload or generate a dataset first.")
    run_out = await run_pipeline(
        state.clean.table,
        [s.model_dump() for s in req.steps],
        [r.model_dump() for r in req.rules],
    )
    payload = {
        "raw_profile": run_out["stages"][0] if run_out["stages"] else None,
        "final_profile": run_out["stages"][-1] if run_out["stages"] else None,
        "steps": [s.model_dump() for s in req.steps],
        "validation": run_out["validation"],
        "pipeline_ok": run_out["ok"],
        "error_message": run_out["error_message"],
        "rubric": state.clean.rubric,
    }
    try:
        data = await llm.review_cleaning(payload)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(e)) from e
    return ReviewResponse(**data)


@router.post("/reset")
async def reset(state: SessionDep) -> dict[str, bool]:
    if state.clean is not None:
        async with engine.begin() as conn:
            await conn.exec_driver_sql(f"DROP TABLE IF EXISTS {state.clean.table}")
        state.clean = None
    return {"ok": True}
