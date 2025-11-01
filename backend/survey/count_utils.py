"""
Centralized counting utilities for survey responses.

This module provides consistent counting logic used by both serializers
and export functions to ensure they return the same numbers.
"""

from .models import PartialSurveyResponse, SurveyResponse


def count_partial_responses(survey):
    """
    Count partial responses that have not been completed yet.
    
    De-duplicates by session_id so multiple question rows for the same session
    don't inflate the count.
    
    Args:
        survey: Survey instance
    
    Returns:
        int: Count of distinct partial sessions (not completed)
    """
    return (
        PartialSurveyResponse.objects
        .filter(survey=survey, is_completed=False)
        .values('session_id')
        .distinct()
        .count()
    )


def count_completed_responses(survey):
    """
    Count completed survey responses.
    
    Args:
        survey: Survey instance
    
    Returns:
        int: Count of SurveyResponse objects for this survey
    """
    return SurveyResponse.objects.filter(survey=survey).count()


def count_all_responses(survey):
    """
    Count all responses (partial + completed).
    
    Args:
        survey: Survey instance
    
    Returns:
        int: Sum of partial and completed response counts
    """
    return count_partial_responses(survey) + count_completed_responses(survey)

