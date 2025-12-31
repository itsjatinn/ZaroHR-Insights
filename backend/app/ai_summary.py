import json
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .config import get_settings


class ChartSummaryItem(BaseModel):
    id: str
    title: str
    data: Any
    context: dict[str, Any] | None = None


class SummaryRequest(BaseModel):
    dashboard_title: str | None = Field(None, alias="dashboardTitle")
    organization: str | None = None
    period: dict[str, Any] | None = None
    charts: list[ChartSummaryItem]


class SummaryResponse(BaseModel):
    dashboard_summary: str = Field(..., alias="dashboardSummary")
    chart_summaries: dict[str, str] = Field(..., alias="chartSummaries")


def _extract_json(text: str) -> dict[str, Any] | None:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`").strip()
        if cleaned.startswith("json"):
            cleaned = cleaned[4:].strip()
    if cleaned.startswith("{") and cleaned.endswith("}"):
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            return None
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1 or end <= start:
        return None
    try:
        return json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        return None


def _build_prompt(payload: SummaryRequest) -> str:
    data = payload.model_dump(by_alias=True)
    return (
        "You are an HR analytics assistant. Analyze the dashboard chart data and "
        "return a JSON object with keys \"dashboardSummary\" and \"chartSummaries\". "
        "\"dashboardSummary\" should be a detailed, section-wise narrative (4-6 sentences). "
        "\"chartSummaries\" should map chart ids to 2-4 sentence summaries. "
        "Use only the provided data. When values represent fractions, format as percentages "
        "with one decimal. Call out peaks, dips, latest period changes, and differences "
        "across groups where applicable. Return ONLY valid JSON.\n\n"
        f"INPUT_DATA={json.dumps(data, ensure_ascii=True)}"
    )


def _parse_response(text: str) -> SummaryResponse:
    parsed = _extract_json(text)
    if not parsed:
        return SummaryResponse(
            dashboardSummary=text.strip() or "No summary available.",
            chartSummaries={},
        )
    dashboard_summary = parsed.get("dashboardSummary") or "No summary available."
    chart_summaries = parsed.get("chartSummaries") or {}
    if not isinstance(chart_summaries, dict):
        chart_summaries = {}
    sanitized = {
        str(key): str(value)
        for key, value in chart_summaries.items()
        if isinstance(key, (str, int))
    }
    return SummaryResponse(
        dashboardSummary=str(dashboard_summary),
        chartSummaries=sanitized,
    )


def register_ai_summary_routes(app: FastAPI) -> None:
    @app.get("/ai/models", tags=["ai"])
    def list_models() -> list[dict[str, Any]]:
        try:
            import google.generativeai as genai
        except ImportError as exc:
            raise HTTPException(
                status_code=500,
                detail="Gemini SDK not installed. Install google-generativeai.",
            ) from exc
        settings = get_settings()
        if not getattr(settings, "gemini_api_key", None):
            raise HTTPException(
                status_code=500,
                detail="Missing GEMINI_API_KEY configuration.",
            )
        genai.configure(api_key=settings.gemini_api_key)
        models = []
        for model in genai.list_models():
            name = getattr(model, "name", "")
            models.append(
                {
                    "name": name,
                    "shortName": name.replace("models/", "", 1),
                    "displayName": getattr(model, "display_name", None),
                    "supportedMethods": getattr(
                        model, "supported_generation_methods", []
                    ),
                }
            )
        return models

    @app.post("/ai/summary", response_model=SummaryResponse, tags=["ai"])
    def generate_summary(payload: SummaryRequest) -> SummaryResponse:
        try:
            import google.generativeai as genai
        except ImportError as exc:
            raise HTTPException(
                status_code=500,
                detail="Gemini SDK not installed. Install google-generativeai.",
            ) from exc
        settings = get_settings()
        if not getattr(settings, "gemini_api_key", None):
            raise HTTPException(
                status_code=500,
                detail="Missing GEMINI_API_KEY configuration.",
            )
        model_name = getattr(settings, "gemini_model", None) or "gemini-2.5-flash"
        normalized_model = model_name.replace("models/", "", 1)
        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel(normalized_model)
        try:
            response = model.generate_content(_build_prompt(payload))
        except Exception as exc:  # pragma: no cover - external SDK
            raise HTTPException(
                status_code=502,
                detail=f"Gemini request failed: {exc}",
            ) from exc
        text = getattr(response, "text", None) or ""
        return _parse_response(text)
