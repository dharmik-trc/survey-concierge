"""
AI Analyzer service - builds report context from survey analytics and powers chat.
"""

import json
from typing import Any, Dict, List

from ..exports.analytics import calculate_analytics
from ..exports.data_collector import collect_completed_responses_only
from ..models import Question, Survey


SYSTEM_PROMPT = """You are an expert survey analyst. You will be given survey data and statistics.
Answer the user's questions concisely and accurately. Use specific numbers and percentages when relevant.
If the data doesn't support a claim, say so. Keep responses focused and actionable."""


def _format_value(v: Any) -> str:
    if v is None:
        return "N/A"
    if isinstance(v, float):
        return f"{v:.2f}" if v == int(v) else f"{v:.2f}"
    return str(v)


def _extract_text_sample(answer: Any, max_len: int = 200) -> str:
    """Extract a short text sample from an answer for open text questions."""
    if answer is None:
        return ""
    if isinstance(answer, dict) and "answer" in answer:
        answer = answer["answer"]
    if isinstance(answer, str):
        s = answer.strip()
        return s[:max_len] + ("..." if len(s) > max_len else "")
    if isinstance(answer, (int, float)):
        return str(answer)
    return str(answer)[:max_len]


def build_report_context(survey: Survey, max_open_text_samples: int = 15) -> str:
    """
    Build a text summary of survey analytics for the LLM.
    Reuses existing analytics calculation.
    """
    sessions, response_metadata = collect_completed_responses_only(survey)
    if not sessions:
        return f"Survey: {survey.title}\n\nNo completed responses yet."

    questions = list(Question.objects.filter(survey=survey).order_by("order", "created_at"))
    total = len(sessions)
    analytics = calculate_analytics(sessions, questions, total, response_metadata)

    lines = [
        f"# Survey: {survey.title}",
        f"Total completed responses: {total}",
        "",
    ]

    for i, q in enumerate(questions, 1):
        q_analytics = analytics.get(q.id)
        if not q_analytics:
            continue

        q_text = (q.question_text or "")[:200]
        lines.append(f"## Q{i}: {q_text}")
        lines.append(f"Answered: {q_analytics.get('answered_count', 0)}, Skipped: {q_analytics.get('skipped_count', 0)}")

        atype = q_analytics.get("type", "other")

        if atype == "choice":
            results = q_analytics.get("results", [])
            for r in results:
                opt = r.get("option", "")
                cnt = r.get("count", 0)
                pct = r.get("percentage", 0)
                lines.append(f"  - {opt}: {cnt} ({pct}%)")
            if q_analytics.get("comments"):
                lines.append("  Comments: (see below)")
        elif atype == "numeric":
            lines.append(f"  Min: {_format_value(q_analytics.get('min'))}, Max: {_format_value(q_analytics.get('max'))}")
            lines.append(f"  Average: {_format_value(q_analytics.get('average'))}, Median: {_format_value(q_analytics.get('median'))}")
        elif atype == "grid":
            rows = q_analytics.get("rows", {})
            for row_name, row_data in list(rows.items())[:10]:  # Limit rows
                cols = row_data.get("columns", [])[:5]  # Limit columns
                col_str = ", ".join(f"{c.get('column')}: {c.get('count')}" for c in cols)
                lines.append(f"  {row_name}: {col_str}")
            if len(rows) > 10:
                lines.append(f"  ... ({len(rows)} rows total)")
        elif atype == "form_fields_numeric":
            subfields = q_analytics.get("subfields", {})
            for sf_name, sf_data in subfields.items():
                lines.append(f"  {sf_name}: min={_format_value(sf_data.get('min'))}, max={_format_value(sf_data.get('max'))}, avg={_format_value(sf_data.get('average'))}")
        else:
            msg = q_analytics.get("message", "")
            if msg:
                lines.append(f"  {msg}")

        # Add sample open text answers for text/paragraph questions
        if q.primary_type == "open_text" and q.secondary_type in ("text", "paragraph"):
            samples = []
            for sid, sdata in list(sessions.items())[:50]:
                ans = sdata.get("questions", {}).get(q.id)
                sample = _extract_text_sample(ans)
                if sample and sample not in samples:
                    samples.append(sample)
                if len(samples) >= max_open_text_samples:
                    break
            if samples:
                lines.append("  Sample responses:")
                for s in samples[:max_open_text_samples]:
                    lines.append(f"    - \"{s[:150]}{'...' if len(s) > 150 else ''}\"")

        lines.append("")

    return "\n".join(lines)


def chat_with_analyzer(
    survey_id: str,
    user_message: str,
    chat_history: List[Dict[str, str]],
) -> str:
    """
    Process a chat message about survey analytics.
    Returns the LLM response.
    """
    from ..models import Survey
    from ..llm import get_llm_provider

    survey = Survey.objects.filter(id=survey_id).first()
    if not survey:
        return "Survey not found."

    context = build_report_context(survey)
    provider = get_llm_provider()

    messages = []
    for h in chat_history:
        role = h.get("role")
        content = h.get("content", "")
        if role and content:
            messages.append({"role": role, "content": content})

    # Current turn: inject context + user message
    context_block = f"<survey_data>\n{context}\n</survey_data>"
    user_with_context = f"{context_block}\n\nUser question: {user_message}"
    messages.append({"role": "user", "content": user_with_context})

    return provider.chat(
        messages,
        system_prompt=SYSTEM_PROMPT,
        max_tokens=2048,
        temperature=0.3,
    )
