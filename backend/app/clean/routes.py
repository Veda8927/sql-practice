"""/api/clean/* routes: upload, generate, dataset, run, review, reset."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, File, HTTPException, UploadFile

from .. import llm
from ..db import engine
from ..deps import SessionDep
from ..schemas import TableResult
from ..state import SessionState
from . import generate, ingest
from .pipeline import run_pipeline
from .schemas import (
    DatasetSummary,
    GenerateRequest,
    ReviewRequest,
    ReviewResponse,
    RunRequest,
    RunResponse,
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
