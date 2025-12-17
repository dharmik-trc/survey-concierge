"""
Analytics Calculation Utilities

This module handles calculating analytics statistics from survey responses.
"""

import statistics
from collections import defaultdict
from typing import Dict, List, Any, Optional, Union
import math


def _is_blank_value(value) -> bool:
    """Return True if the provided value should be treated as blank/empty."""
    if value is None:
        return True

    if isinstance(value, str):
        return value.strip() == ''

    if isinstance(value, (int, float)):
        return False

    if isinstance(value, list):
        return all(_is_blank_value(item) for item in value)

    if isinstance(value, dict):
        filtered_items = []
        for key, item in value.items():
            # Ignore comment-only keys when determining blankness
            if key in {'comment', 'comments'}:
                continue
            filtered_items.append(item)

        if not filtered_items:
            return True

        return all(_is_blank_value(item) for item in filtered_items)

    return False


def _is_effectively_blank_answer(answer) -> bool:
    """Determine whether an answer should count as skipped for analytics."""
    if isinstance(answer, dict) and 'answer' in answer:
        base_value = answer.get('answer')
        return _is_blank_value(base_value)

    return _is_blank_value(answer)


def calculate_analytics(sessions: Dict[str, Dict], questions: List, total_completed_responses: int, response_metadata: Dict) -> Dict[int, Dict[str, Any]]:
    """
    Calculate analytics for all questions based on session data.
    
    Args:
        sessions: Dict mapping session_id to session data with questions
        questions: List of Question objects
        total_completed_responses: Total number of completed survey responses
        response_metadata: Dict mapping session_id to response metadata (id, submitted_at)
    
    Returns:
        Dict mapping question_id to analytics data
    """
    analytics = {}
    
    for question in questions:
        question_id = question.id
        question_type = question.secondary_type
        primary_type = question.primary_type
        
        # Calculate answered/skipped for this question
        answered_count = 0
        for session_id, session_data in sessions.items():
            answer = session_data.get('questions', {}).get(question.id)
            if not _is_effectively_blank_answer(answer):
                answered_count += 1

        skipped_count = total_completed_responses - answered_count
        
        # Extract comments if question has comment box
        comments = []
        if question.has_comment_box:
            for session_id, session_data in sessions.items():
                answer = session_data.get('questions', {}).get(question.id)
                if answer is None:
                    continue
                
                # Extract comment from answer (can be in dict format with 'comment' key)
                comment_text = None
                if isinstance(answer, dict) and 'comment' in answer:
                    comment_text = answer.get('comment')
                    if comment_text and str(comment_text).strip():
                        metadata = response_metadata.get(session_id, {})
                        comments.append({
                            'response_id': str(metadata.get('response_id', session_id))[-12:],  # Last 12 chars
                            'submitted_at': metadata.get('submitted_at'),
                            'comment': str(comment_text).strip()
                        })
        
        if primary_type == 'grid':
            # Grid questions - special handling
            analytics[question_id] = calculate_grid_analytics(
                question, sessions, answered_count, skipped_count, comments
            )
        elif primary_type == 'form' and question_type == 'form_fields':
            # Form fields question - check if it has numeric subfields
            # Check subfield_validations for numeric types
            numeric_subfields = []
            if question.subfield_validations:
                for subfield_name, validation in question.subfield_validations.items():
                    field_type = validation.get('type', 'text')
                    # Include auto_calculate totals as numeric analytics too
                    if field_type in ['number', 'positive_number', 'negative_number', 'all_numbers', 'auto_calculate']:
                        numeric_subfields.append(subfield_name)
            # Fallback: if a "Total" subfield exists without explicit numeric validation, include it
            try:
                for candidate in ['Total', 'total', 'Sum', 'sum']:
                    if hasattr(question, 'subfields') and question.subfields and candidate in question.subfields:
                        if candidate not in numeric_subfields:
                            numeric_subfields.append(candidate)
            except Exception:
                pass
            
            if numeric_subfields:
                # Has numeric subfields - calculate analytics for each
                analytics[question_id] = calculate_form_fields_numeric_analytics(
                    question, sessions, answered_count, skipped_count, numeric_subfields
                )
            else:
                # Form fields without numeric subfields - treat as other
                analytics[question_id] = {
                    'type': 'other',
                    'question_text': question.question_text,
                    'answered_count': answered_count,
                    'skipped_count': skipped_count,
                    'comments': comments if question.has_comment_box else [],
                    'message': 'Analytics not available for this question type'
                }
        elif primary_type == 'form' and question_type in ['radio', 'multiple_choices', 'dropdown']:
            # Choice questions
            analytics[question_id] = calculate_choice_analytics(
                question, sessions, answered_count, skipped_count, comments
            )
        elif primary_type == 'open_text' and question_type in ['number', 'positive_number', 'negative_number']:
            # Numeric questions - Number, Positive Number, Negative Number
            numeric_result = calculate_numeric_analytics(
                question, sessions, answered_count, skipped_count
            )
            
            # Always ensure numeric type is set - calculate_numeric_analytics should always return a dict with 'type': 'numeric'
            if numeric_result and isinstance(numeric_result, dict) and numeric_result.get('type') == 'numeric':
                analytics[question_id] = numeric_result
            else:
                # Fallback: create proper numeric analytics dict even if calculation returned unexpected format
                analytics[question_id] = {
                    'type': 'numeric',
                    'question_text': question.question_text,
                    'count': numeric_result.get('count', 0) if numeric_result else 0,
                    'answered_count': answered_count,
                    'skipped_count': skipped_count,
                    'min': numeric_result.get('min', 'N/A') if numeric_result and numeric_result.get('count', 0) > 0 else 'N/A',
                    'q1': numeric_result.get('q1', 'N/A') if numeric_result and numeric_result.get('count', 0) > 0 else 'N/A',
                    'median': numeric_result.get('median', 'N/A') if numeric_result and numeric_result.get('count', 0) > 0 else 'N/A',
                    'q3': numeric_result.get('q3', 'N/A') if numeric_result and numeric_result.get('count', 0) > 0 else 'N/A',
                    'max': numeric_result.get('max', 'N/A') if numeric_result and numeric_result.get('count', 0) > 0 else 'N/A',
                    'average': numeric_result.get('average', 'N/A') if numeric_result and numeric_result.get('count', 0) > 0 else 'N/A',
                    'sum': numeric_result.get('sum', 'N/A') if numeric_result and numeric_result.get('count', 0) > 0 else 'N/A',
                }
        elif primary_type == 'open_text' and question_type in ['text', 'paragraph']:
            # Text questions - show message that analytics not available
            analytics[question_id] = {
                'type': 'other',
                'question_text': question.question_text,
                'answered_count': answered_count,
                'skipped_count': skipped_count,
                'comments': comments if question.has_comment_box else [],
                'message': 'Analytics not available for this question type'
            }
        else:
            # Other question types - still show answered/skipped
            analytics[question_id] = {
                'type': 'other',
                'question_text': question.question_text,
                'answered_count': answered_count,
                'skipped_count': skipped_count,
                'comments': comments if question.has_comment_box else [],
                'message': 'Analytics not available for this question type'
            }
    
    return analytics


def calculate_choice_analytics(question, sessions: Dict, answered_count: int, skipped_count: int, comments: List) -> Dict[str, Any]:
    """
    Calculate analytics for choice questions (radio, multiple_choices, dropdown).
    
    Returns count and percentage for each option, plus answered/skipped counts and comments.
    """
    option_counts = defaultdict(int)
    total_responses = 0

    def _extract_option_label(raw_option) -> str:
        if raw_option is None:
            return ''
        if isinstance(raw_option, dict):
            for key in ('label', 'name', 'value', 'text', 'option'):
                if raw_option.get(key):
                    return str(raw_option[key])
            return str(raw_option)
        return str(raw_option)

    def _normalize(label: str) -> str:
        return ' '.join(label.strip().lower().split())

    # Get all possible options preserving question order
    ordered_options: List[str] = []
    option_lookup: Dict[str, str] = {}

    if question.options:
        for raw_option in question.options:
            label = _extract_option_label(raw_option)
            if label:
                normalized = _normalize(label)
                if normalized not in option_lookup:
                    ordered_options.append(label)
                    option_lookup[normalized] = label

    # Add special options if they exist
    if question.has_other_option:
        label = 'Other'
        normalized = _normalize(label)
        if normalized not in option_lookup:
            ordered_options.append(label)
            option_lookup[normalized] = label

    if question.has_none_option:
        label = question.none_option_text or 'None of the above'
        normalized = _normalize(label)
        if normalized not in option_lookup:
            ordered_options.append(label)
            option_lookup[normalized] = label
 
    # Count responses
    for session_id, session_data in sessions.items():
        answer = session_data.get('questions', {}).get(question.id)
 
        if answer is None:
            continue
 
        # Extract selected options
        selected_options = []
 
        if isinstance(answer, list):
            selected_options = answer
        elif isinstance(answer, dict):
            if 'answer' in answer:
                inner_answer = answer.get('answer')
                if isinstance(inner_answer, list):
                    selected_options = inner_answer
                elif inner_answer:
                    selected_options = [inner_answer]
        elif answer:
            selected_options = [answer]
 
        # Skip if no selections were made (do not include in base)
        if not selected_options or (isinstance(selected_options, list) and len(selected_options) == 0):
            continue
 
        total_responses += 1
 
        # Count each selected option
        for selected in selected_options:
            # Handle "Other: custom text" format
            if isinstance(selected, str) and selected.startswith('Other:'):
                option_counts['Other'] += 1
            elif isinstance(selected, dict) and 'other' in selected:
                option_counts['Other'] += 1
            else:
                option_label = _extract_option_label(selected)
                normalized = _normalize(option_label)

                if normalized in option_lookup:
                    canonical_label = option_lookup[normalized]
                else:
                    # New option encountered (e.g. legacy data). Preserve label order of appearance.
                    canonical_label = option_label
                    if canonical_label:
                        option_lookup[normalized] = canonical_label
                        ordered_options.append(canonical_label)

                if canonical_label:
                    option_counts[canonical_label] += 1
 
    # Calculate percentages
    results = []
    for option in ordered_options:
        count = option_counts.get(option, 0)
        percentage = (count / total_responses * 100) if total_responses > 0 else 0
        results.append({
            'option': option,
            'count': count,
            'percentage': round(percentage, 2)
        })
    
    return {
        'type': 'choice',
        'question_text': question.question_text,
        'question_type': question.secondary_type,
        'total_responses': total_responses,
        'answered_count': answered_count,
        'skipped_count': skipped_count,
        'results': results,
        'comments': comments
    }


def calculate_grid_analytics(question, sessions: Dict, answered_count: int, skipped_count: int, comments: List) -> Dict[str, Any]:
    """
    Calculate analytics for grid questions.
    
    For single select grids: treat as radio per row
    For multi select grids: count per row per column
    Also calculates weighted averages for percentage-based grids.
    """
    if not question.rows or not question.columns:
        return {
            'type': 'grid',
            'question_text': question.question_text,
            'answered_count': answered_count,
            'skipped_count': skipped_count,
            'comments': comments,
            'message': 'Grid structure not defined'
        }
    
    rows = question.rows
    columns = question.columns
    is_multi_select = question.secondary_type == 'grid_multi'
    
    row_results = {}
    
    # Count responses per row
    for row in rows:
        row_responses = {}  # column -> count
        total_row_responses = 0
        
        # Count responses for this row
        for session_id, session_data in sessions.items():
            answer = session_data.get('questions', {}).get(question.id)

            if answer is None:
                continue

            # Get answer for this row
            row_answer = None
            if isinstance(answer, dict):
                row_answer = answer.get(row)

            if row_answer is None:
                continue

            # Count selections for this row
            selected_columns = []

            if is_multi_select:
                # Multi-select: answer is a list
                if isinstance(row_answer, list):
                    selected_columns = row_answer
            else:
                # Single select: answer is a single value
                if row_answer:
                    selected_columns = [row_answer]

            # Count each column selection and check if any are valid
            valid_selections = 0
            for col in selected_columns:
                col_name = str(col)
                if col_name in columns:
                    row_responses[col_name] = row_responses.get(col_name, 0) + 1
                    valid_selections += 1

            # Only count as response if there are valid column selections
            if valid_selections > 0:
                total_row_responses += 1
        
        # Calculate percentages per column for this row
        column_stats = []
        for col in columns:
            count = row_responses.get(col, 0)
            percentage = (count / total_row_responses * 100) if total_row_responses > 0 else 0
            column_stats.append({
                'column': col,
                'count': count,
                'percentage': round(percentage, 2)
            })
        
        row_results[row] = {
            'total_responses': total_row_responses,
            'columns': column_stats
        }
    
    return {
        'type': 'grid',
        'question_text': question.question_text,
        'question_type': question.secondary_type,
        'answered_count': answered_count,
        'skipped_count': skipped_count,
        'rows': row_results,
        'comments': comments
    }


def _parse_numeric_value(v):
    """Parse a value to float if possible, return None otherwise.
    
    Excludes blank/empty values - returns None for empty strings, None, etc.
    """
    if v is None:
        return None
    
    if isinstance(v, (int, float)):
        # Allow 0 as a valid numeric value (distinguish from blanks)
        return float(v)
    elif isinstance(v, str):
        # Skip blank strings
        cleaned = v.strip()
        if not cleaned or cleaned == '':
            return None
        
        # Try to parse as number (handle negative, decimals)
        try:
            return float(cleaned)
        except:
            # Check if it's a numeric string (handles cases like "123", "45.6", "-10")
            cleaned_no_commas = cleaned.replace(',', '')  # Remove commas
            if cleaned_no_commas and cleaned_no_commas.replace('.', '').replace('-', '').isdigit():
                try:
                    return float(cleaned_no_commas)
                except:
                    pass
    return None


def _calculate_excel_quartile(data: List[float], quartile: int) -> float:
    """
    Calculate quartile using Excel's QUARTILE/QUARTILE.INC function algorithm.
    
    Excel's QUARTILE/QUARTILE.INC uses method='inclusive' which matches
    Python's statistics.quantiles with method='inclusive'.
    
    Formula: position = (n-1) * p + 1, where p is the percentile
    - For Q1 (quartile=1): p = 0.25
    - For Q2 (quartile=2): p = 0.50 (median)
    - For Q3 (quartile=3): p = 0.75
    
    Args:
        data: List of numeric values (will be sorted)
        quartile: Quartile number (1, 2, or 3)
    
    Returns:
        Quartile value matching Excel QUARTILE/QUARTILE.INC
    """
    if not data:
        return 0.0
    
    if len(data) == 1:
        return float(data[0])
    
    # Use Python's statistics.quantiles with method='inclusive' which matches Excel QUARTILE.INC
    quartiles = statistics.quantiles(data, n=4, method='inclusive')
    # quartiles[0] = Q1, quartiles[1] = Q2 (median), quartiles[2] = Q3
    if quartile == 1:
        return float(quartiles[0])
    elif quartile == 2:
        return float(statistics.median(data))
    elif quartile == 3:
        return float(quartiles[2])
    else:
        return 0.0


def calculate_numeric_analytics(question, sessions: Dict, answered_count: int, skipped_count: int) -> Dict[str, Any]:
    """
    Calculate statistics for numeric questions.
    
    Returns: min, Q1, median (Q2), Q3, max, average, sum, count
    Plus answered/skipped counts.
    
    Note: Excludes blank answers and zeros that come from blank fields.
    """
    numeric_values = []
    
    # Extract numeric values from responses
    for session_id, session_data in sessions.items():
        answer = session_data.get('questions', {}).get(question.id)
        
        # Skip blank answers entirely - don't try to parse them
        if _is_effectively_blank_answer(answer):
            continue
        
        # Extract numeric value(s)
        values_found = []
        
        if isinstance(answer, dict):
            # Check for answer/comment structure
            if 'answer' in answer and 'comment' in answer:
                inner_answer = answer.get('answer')
                # Skip if inner answer is blank
                if _is_blank_value(inner_answer):
                    continue
                    
                if isinstance(inner_answer, dict):
                    # Form fields - extract all numeric values
                    for v in inner_answer.values():
                        # Skip blank subfield values
                        if _is_blank_value(v):
                            continue
                        parsed = _parse_numeric_value(v)
                        # Exclude zeros that come from blanks (if parsed as 0 but was blank, skip)
                        if parsed is not None and parsed != 0:
                            values_found.append(parsed)
                else:
                    # Single answer value
                    parsed = _parse_numeric_value(inner_answer)
                    # Exclude zeros from blanks
                    if parsed is not None and parsed != 0:
                        values_found.append(parsed)
            else:
                # Regular dict - try all values (excluding comments)
                for key, v in answer.items():
                    if key in {'comment', 'comments'}:
                        continue
                    # Skip blank values
                    if _is_blank_value(v):
                        continue
                    parsed = _parse_numeric_value(v)
                    # Exclude zeros from blanks
                    if parsed is not None and parsed != 0:
                        values_found.append(parsed)
        else:
            # Direct value - already checked for blank above
            parsed = _parse_numeric_value(answer)
            # Exclude zeros from blanks
            if parsed is not None and parsed != 0:
                values_found.append(parsed)
        
        # Add all found numeric values (excluding zeros from blanks)
        numeric_values.extend(values_found)
    
    if not numeric_values:
        return {
            'type': 'numeric',
            'question_text': question.question_text,
            'count': 0,
            'answered_count': answered_count,
            'skipped_count': skipped_count,
            'message': 'No valid numeric responses'
        }
    
    # Calculate statistics
    numeric_values_sorted = sorted(numeric_values)
    count = len(numeric_values)
    
    # Quartiles using Excel's QUARTILE function algorithm for exact matching
    if count >= 2:
        # Use Excel's exact quartile calculation method
        q1 = _calculate_excel_quartile(numeric_values_sorted, 1)
        median = statistics.median(numeric_values)  # Q2
        q3 = _calculate_excel_quartile(numeric_values_sorted, 3)
    elif count == 1:
        # Single value: use it for all quartiles
        q1 = numeric_values[0]
        median = numeric_values[0]
        q3 = numeric_values[0]
    else:
        # No values
        q1 = 0
        median = 0
        q3 = 0
    
    return {
        'type': 'numeric',
        'question_text': question.question_text,
        'count': count,
        'answered_count': answered_count,
        'skipped_count': skipped_count,
        'min': min(numeric_values) if numeric_values else 0,
        'q1': round(q1, 2),
        'median': round(median, 2),
        'q3': round(q3, 2),
        'max': max(numeric_values) if numeric_values else 0,
        'average': round(statistics.mean(numeric_values), 2) if numeric_values else 0,
        'sum': round(sum(numeric_values), 2) if numeric_values else 0
    }


def calculate_form_fields_numeric_analytics(question, sessions: Dict, answered_count: int, skipped_count: int, numeric_subfields: List[str]) -> Dict[str, Any]:
    """
    Calculate statistics for form_fields questions with numeric subfields.

    For total-sum style questions (numeric form_fields):
    - Treat blank/missing subfield values as 0 for respondents who answered at least one numeric subfield
    - Exclude respondents who left ALL numeric subfields blank (do not contribute to base)
    - Use the same base (respondent count) across all subfields to avoid overstated averages
    """
    # Collect per-respondent parsed values for numeric subfields
    respondent_values: List[Dict[str, float]] = []

    for session_id, session_data in sessions.items():
        answer = session_data.get('questions', {}).get(question.id)

        if answer is None:
            continue

        if isinstance(answer, dict) and 'answer' in answer:
            answer = answer.get('answer')

        if not isinstance(answer, dict):
            continue

        # Parse numeric values for this respondent
        parsed_map: Dict[str, float] = {}
        has_any_value = False
        for subfield_name in numeric_subfields:
            raw_val = answer.get(subfield_name)
            # Skip blank subfield values entirely
            if _is_blank_value(raw_val):
                continue
            
            # If not blank, try to parse it
            parsed = _parse_numeric_value(raw_val)
            if parsed is not None:
                # Include the value (including 0 if it was explicitly entered)
                # We know it's not blank because we checked _is_blank_value above
                parsed_map[subfield_name] = float(parsed)
                has_any_value = True

        # Exclude respondents with ALL blanks across numeric subfields
        # (but include if they have at least one numeric value, even if it's 0)
        if not has_any_value:
            continue

        respondent_values.append(parsed_map)

    base_count = len(respondent_values)
    
    # Debug logging for form_fields base_count calculation
    if question.id == 32:  # Q32 specific logging
        print(f"DEBUG Q32 base_count: question_id={question.id}, base_count={base_count}, initial_answered_count={answered_count}, total_sessions={len(sessions)}")
        print(f"DEBUG Q32: respondent_values count={len(respondent_values)}")

    # Build values per subfield
    subfield_values: Dict[str, List[float]] = {sf: [] for sf in numeric_subfields}
    for rv in respondent_values:
        for sf, val in rv.items():
            if sf in subfield_values:
                subfield_values[sf].append(val)

    # Calculate analytics for each subfield using collected values
    subfield_analytics: Dict[str, Any] = {}
    for subfield_name in numeric_subfields:
        values = subfield_values[subfield_name]

        if not values:
            subfield_analytics[subfield_name] = {
                'count': 0,
                'min': 'N/A',
                'q1': 'N/A',
                'median': 'N/A',
                'q3': 'N/A',
                'max': 'N/A',
                'average': 'N/A',
                'sum': 'N/A',
            }
        else:
            count = len(values)
            if len(values) >= 2:
                # Use Excel's exact quartile calculation method for form fields too
                sorted_values = sorted(values)
                q1 = _calculate_excel_quartile(sorted_values, 1)
                q3 = _calculate_excel_quartile(sorted_values, 3)
            else:
                q1 = values[0]
                q3 = values[0]

            median = statistics.median(values)

            subfield_analytics[subfield_name] = {
                'count': count,
                'min': min(values),
                'q1': round(q1, 2),
                'median': round(median, 2),
                'q3': round(q3, 2),
                'max': max(values),
                'average': round(statistics.mean(values), 2),
                'sum': round(sum(values), 2),
            }

    # For form_fields numeric, answered_count should equal base_count
    # (only respondents with at least one valid numeric value count as answered)
    # Update skipped_count accordingly
    actual_answered_count = base_count
    actual_skipped_count = answered_count + skipped_count - base_count
    
    return {
        'type': 'form_fields_numeric',
        'question_text': question.question_text,
        'answered_count': actual_answered_count,
        'skipped_count': actual_skipped_count,
        'base_count': base_count,
        'subfields': subfield_analytics
    }

