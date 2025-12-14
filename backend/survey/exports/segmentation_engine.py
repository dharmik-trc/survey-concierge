"""
Segmentation Engine

Generic segmentation engine that applies configurable segmentation rules to survey sessions.
Accepts dynamic configuration - no hardcoded fields.
"""

from typing import Dict, List, Optional, Set

from ..models import Question


def _parse_numeric_value(value) -> Optional[float]:
    """Parse a numeric value from various formats."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.strip())
        except (ValueError, AttributeError):
            cleaned = value.strip().replace(",", "")
            try:
                return float(cleaned)
            except (ValueError, AttributeError):
                return None
    return None


def _get_total_fte_from_form_fields(session_answers) -> Optional[float]:
    """
    Extract total FTE from form_fields numeric question.
    Sums all numeric subfield values without rounding (preserves up to 2 decimals).
    """
    if not isinstance(session_answers, dict):
        return None

    # Unwrap answer if needed
    if "answer" in session_answers:
        session_answers = session_answers.get("answer")

    if not isinstance(session_answers, dict):
        return None

    total = 0.0
    any_numeric = False
    for v in session_answers.values():
        parsed = _parse_numeric_value(v)
        if parsed is not None:
            total += parsed
            any_numeric = True

    # Return total preserving precision (no rounding)
    return total if any_numeric else None


def _get_location_answer(session_answers) -> List[str]:
    """Extract location answer(s) from choice question."""
    if not session_answers:
        return []

    # Unwrap answer if needed
    if isinstance(session_answers, dict) and "answer" in session_answers:
        session_answers = session_answers.get("answer")

    if isinstance(session_answers, list):
        return [str(x) for x in session_answers]
    elif session_answers is not None:
        return [str(session_answers)]

    return []


def segment_sessions(
    sessions: Dict[str, Dict], segmentation_config: Dict, all_questions: List[Question]
) -> Dict[str, Set[str]]:
    """
    Segment sessions based on dynamic segmentation configuration.

    Args:
        sessions: Dictionary of session_id -> session_data
        segmentation_config: Dict with segmentation rules. Format:
            {
                'dimensions': [
                    {
                        'name': 'Staff Size',  # Segment dimension name
                        'question_id': 22,
                        'type': 'numeric_range',  # or 'choice_mapping'
                        'ranges': {'Very small': [null, 5], 'Small': [5, 10], ...}  # for numeric_range
                        # OR
                        'mapping': {'London': 'London & SE', 'South East': 'London & SE', ...}  # for choice_mapping
                    },
                    ...
                ]
            }
        all_questions: List of all questions for the survey

    Returns:
        Dictionary mapping segment_name -> set of session_ids that belong to this segment
    """
    segment_to_session_ids: Dict[str, Set[str]] = {}

    # Always include "All responses" segment
    all_session_ids = set(sessions.keys())
    segment_to_session_ids["All responses"] = all_session_ids

    # Build question ID to question mapping for quick lookup
    question_map = {q.id: q for q in all_questions}

    # Process each dimension in config
    dimensions = segmentation_config.get("dimensions", [])

    for dimension in dimensions:
        question_id = dimension.get("question_id")
        dim_type = dimension.get("type")

        if not question_id or not dim_type:
            continue

        question = question_map.get(question_id)
        if not question:
            continue

        if dim_type == "numeric_range":
            # Numeric range segmentation (e.g., staff size)
            ranges = dimension.get("ranges", {})
            if not ranges:
                continue

            # Normalize ranges
            norm_ranges = {}
            for seg_name, rng in ranges.items():
                if isinstance(rng, list) and len(rng) == 2:
                    mn = None if rng[0] is None else float(rng[0])
                    mx = None if rng[1] is None else float(rng[1])
                    norm_ranges[seg_name] = (mn, mx)

            if norm_ranges:
                # Initialize segment buckets
                for segment_name in norm_ranges.keys():
                    segment_to_session_ids.setdefault(segment_name, set())

                # Create "Unknown" segment for sessions without numeric values
                unknown_segment_name = "Unknown"
                segment_to_session_ids.setdefault(unknown_segment_name, set())

                # Assign sessions to segments based on numeric total
                for session_id, session_data in sessions.items():
                    answers = session_data.get("questions", {})
                    answer = answers.get(question_id)

                    # Get total from form_fields numeric question
                    if question.primary_type == "form" and question.secondary_type == "form_fields":
                        total = _get_total_fte_from_form_fields(answer)
                    else:
                        # Single numeric value
                        total = _parse_numeric_value(answer)

                    if total is None:
                        # No numeric value - assign to Unknown segment
                        segment_to_session_ids[unknown_segment_name].add(session_id)
                        continue

                    # Assign to matching segment(s) - exact value matching without rounding
                    matched = False
                    for segment_name, (min_val, max_val) in norm_ranges.items():
                        matches_min = min_val is None or total >= min_val
                        matches_max = max_val is None or total <= max_val
                        if matches_min and matches_max:
                            segment_to_session_ids[segment_name].add(session_id)
                            matched = True

                    # If no range matched, assign to Unknown
                    if not matched:
                        segment_to_session_ids[unknown_segment_name].add(session_id)

        elif dim_type == "choice_mapping":
            # Choice mapping segmentation (e.g., location)
            mapping = dimension.get("mapping", {})
            if not mapping:
                continue

            # Initialize segment buckets
            for segment_name in set(mapping.values()):
                segment_to_session_ids.setdefault(segment_name, set())

            # Create "Unknown" segment for sessions without answers
            unknown_segment_name = "Unknown"
            segment_to_session_ids.setdefault(unknown_segment_name, set())

            # Assign sessions to segments based on choice answer
            for session_id, session_data in sessions.items():
                answers = session_data.get("questions", {})
                answer = answers.get(question_id)

                # Extract answer values
                if (
                    question.primary_type == "form"
                    and question.secondary_type == "multiple_choices"
                ):
                    answer_values = _get_location_answer(answer)
                elif question.primary_type == "form" and question.secondary_type in [
                    "radio",
                    "dropdown",
                ]:
                    # Handle both wrapped and unwrapped answers
                    if isinstance(answer, dict) and "answer" in answer:
                        answer_value = answer.get("answer")
                    else:
                        answer_value = answer
                    answer_values = [str(answer_value)] if answer_value else []
                else:
                    if isinstance(answer, dict) and "answer" in answer:
                        answer_value = answer.get("answer")
                    else:
                        answer_value = answer
                    answer_values = [str(answer_value)] if answer_value else []

                # Track if no answer - assign to "Unknown" segment
                if not answer_values:
                    segment_to_session_ids[unknown_segment_name].add(session_id)
                    continue

                # Track if this session was matched to any segment
                matched = False

                # Map each answer value to its segment
                for raw_value in answer_values:
                    # Try exact match first
                    segment_name = mapping.get(raw_value)

                    # If no exact match, try case-insensitive and trimmed
                    if not segment_name:
                        raw_value_lower = raw_value.strip().lower()
                        for key, seg_name in mapping.items():
                            if key.strip().lower() == raw_value_lower:
                                segment_name = seg_name
                                break

                    if segment_name:
                        segment_to_session_ids[segment_name].add(session_id)
                        matched = True

                # If no match found, assign to Unknown segment
                if not matched:
                    segment_to_session_ids[unknown_segment_name].add(session_id)

    return segment_to_session_ids
