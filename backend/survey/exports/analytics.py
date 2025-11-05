"""
Analytics Calculation Utilities

This module handles calculating analytics statistics from survey responses.
"""

import statistics
from collections import defaultdict
from typing import Dict, List, Any, Optional, Union


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
            if answer is not None:
                # Check if answer is empty (empty string, empty dict, empty list, None)
                if answer == '' or answer == {} or answer == []:
                    continue
                # For dict answers, check if it's not just empty structure
                if isinstance(answer, dict) and not any(answer.values()):
                    continue
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
    
    # Get all possible options
    all_options = question.options.copy() if question.options else []
    if question.has_other_option:
        all_options.append('Other')
    if question.has_none_option:
        none_text = question.none_option_text or 'None of the above'
        all_options.append(none_text)
    
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
                option_name = str(selected)
                if option_name in all_options:
                    option_counts[option_name] += 1
    
    # Calculate percentages
    results = []
    for option in all_options:
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
            
            total_row_responses += 1
            
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
            
            # Count each column selection
            for col in selected_columns:
                col_name = str(col)
                if col_name in columns:
                    row_responses[col_name] = row_responses.get(col_name, 0) + 1
        
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
    """Parse a value to float if possible, return None otherwise."""
    if isinstance(v, (int, float)):
        return float(v)
    elif isinstance(v, str):
        # Try to parse as number (handle negative, decimals)
        try:
            return float(v)
        except:
            # Check if it's a numeric string (handles cases like "123", "45.6", "-10")
            cleaned = v.strip().replace(',', '')  # Remove commas
            if cleaned.replace('.', '').replace('-', '').isdigit():
                try:
                    return float(cleaned)
                except:
                    pass
    return None


def calculate_numeric_analytics(question, sessions: Dict, answered_count: int, skipped_count: int) -> Dict[str, Any]:
    """
    Calculate statistics for numeric questions.
    
    Returns: min, Q1, median (Q2), Q3, max, average, sum, count
    Plus answered/skipped counts.
    """
    numeric_values = []
    
    # Extract numeric values from responses
    for session_id, session_data in sessions.items():
        answer = session_data.get('questions', {}).get(question.id)
        
        if answer is None:
            continue
        
        # Extract numeric value(s)
        values_found = []
        
        if isinstance(answer, dict):
            # Check for answer/comment structure
            if 'answer' in answer and 'comment' in answer:
                inner_answer = answer.get('answer')
                if isinstance(inner_answer, dict):
                    # Form fields - extract all numeric values
                    for v in inner_answer.values():
                        parsed = _parse_numeric_value(v)
                        if parsed is not None:
                            values_found.append(parsed)
                else:
                    # Single answer value
                    parsed = _parse_numeric_value(inner_answer)
                    if parsed is not None:
                        values_found.append(parsed)
            else:
                # Regular dict - try all values
                for v in answer.values():
                    parsed = _parse_numeric_value(v)
                    if parsed is not None:
                        values_found.append(parsed)
        else:
            # Direct value
            parsed = _parse_numeric_value(answer)
            if parsed is not None:
                values_found.append(parsed)
        
        # Add all found numeric values
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
    
    # Quartiles
    q1 = statistics.quantiles(numeric_values, n=4)[0] if count > 0 else 0
    median = statistics.median(numeric_values)
    q3 = statistics.quantiles(numeric_values, n=4)[2] if count > 0 else 0
    
    return {
        'type': 'numeric',
        'question_text': question.question_text,
        'count': count,
        'answered_count': answered_count,
        'skipped_count': skipped_count,
        'min': min(numeric_values),
        'q1': round(q1, 2),
        'median': round(median, 2),
        'q3': round(q3, 2),
        'max': max(numeric_values),
        'average': round(statistics.mean(numeric_values), 2),
        'sum': round(sum(numeric_values), 2)
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

        # Extract answer from dict if needed
        if isinstance(answer, dict) and 'answer' in answer:
            answer = answer.get('answer')

        if not isinstance(answer, dict):
            continue

        # Parse numeric values for this respondent
        parsed_map: Dict[str, float] = {}
        any_numeric_present = False
        for subfield_name in numeric_subfields:
            raw_val = answer.get(subfield_name)
            parsed = _parse_numeric_value(raw_val)
            if parsed is not None:
                parsed_map[subfield_name] = float(parsed)
                any_numeric_present = True

        # Exclude respondents with ALL blanks across numeric subfields
        if not any_numeric_present:
            continue

        # For missing subfields, treat as zero to keep consistent base
        for subfield_name in numeric_subfields:
            if subfield_name not in parsed_map:
                parsed_map[subfield_name] = 0.0

        respondent_values.append(parsed_map)

    base_count = len(respondent_values)

    # Build values per subfield with zero-filled base
    subfield_values: Dict[str, List[float]] = {sf: [] for sf in numeric_subfields}
    for rv in respondent_values:
        for sf in numeric_subfields:
            subfield_values[sf].append(rv.get(sf, 0.0))

    # Calculate analytics for each subfield using the same base
    subfield_analytics: Dict[str, Any] = {}
    for subfield_name in numeric_subfields:
        values = subfield_values[subfield_name]

        if base_count == 0:
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
            count = base_count
            # Quartiles with zeros included
            q1 = statistics.quantiles(values, n=4)[0] if count > 0 else 0
            median = statistics.median(values)
            q3 = statistics.quantiles(values, n=4)[2] if count > 0 else 0

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

    return {
        'type': 'form_fields_numeric',
        'question_text': question.question_text,
        'answered_count': answered_count,
        'skipped_count': skipped_count,
        'base_count': base_count,
        'subfields': subfield_analytics
    }

