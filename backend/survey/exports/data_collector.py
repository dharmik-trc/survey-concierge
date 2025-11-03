"""
Data Collection Utilities

This module handles collecting and organizing survey response data for export.
Uses centralized counting logic to ensure consistency with serializer counts.
"""

from ..models import PartialSurveyResponse, SurveyResponse, QuestionResponse
from ..count_utils import count_partial_responses, count_completed_responses


def collect_session_data(survey):
    """
    Collect and organize partial response data by session_id.
    
    Uses the same filtering logic as count_partial_responses to ensure consistency:
    - Only includes partial responses with is_completed=False
    - Groups by session_id
    
    Args:
        survey: Survey instance
    
    Returns:
        tuple: (sessions dict, completed_session_ids set)
            - sessions: Dict mapping session_id to session data with questions, timestamps, completion status
            - completed_session_ids: Set of session_ids that are marked as completed
    """
    # Use same filter as count_partial_responses for consistency
    partial_responses = PartialSurveyResponse.objects.filter(
        survey=survey,
        is_completed=False  # Only get incomplete partial responses
    ).select_related('question').order_by('session_id')
    
    sessions = {}
    completed_session_ids = set()
    
    for response in partial_responses:
        session_id = response.session_id or 'unknown'
        
        # Initialize session if not exists
        if session_id not in sessions:
            sessions[session_id] = {
                'ip_address': response.ip_address or 'unknown',
                'is_completed': False,  # All are incomplete by filter
                'last_activity': response.updated_at,
                'first_activity': response.created_at,
                'session_id': str(session_id),  # Store session_id for Respondent ID (partial responses)
                'questions': {}
            }
        
        # Store question response
        sessions[session_id]['questions'][response.question.id] = response.answer
        
        # Update timestamps
        if response.created_at < sessions[session_id]['first_activity']:
            sessions[session_id]['first_activity'] = response.created_at
        if response.updated_at > sessions[session_id]['last_activity']:
            sessions[session_id]['last_activity'] = response.updated_at
    
    # Note: completed_session_ids will be empty since we only fetched incomplete ones
    # Completed responses come from SurveyResponse table via merge_completed_responses
    return sessions, completed_session_ids


def merge_completed_responses(survey, sessions, completed_session_ids):
    """
    Fetch and add complete survey responses from SurveyResponse -> QuestionResponse.
    
    Adds all completed responses from SurveyResponse table as separate sessions.
    Uses the same logic as count_completed_responses to ensure consistency.
    
    Args:
        survey: Survey instance
        sessions: Dict of session data (will be modified in place - adds completed responses)
        completed_session_ids: Set (unused, kept for compatibility)
    """
    # Step 1: Get all SurveyResponse IDs for this survey (same as count_completed_responses)
    survey_response_ids = SurveyResponse.objects.filter(
        survey=survey
    ).values_list('id', flat=True)
    
    if not survey_response_ids:
        return
    
    # Step 2: Get all QuestionResponse records for these survey responses
    question_responses = QuestionResponse.objects.filter(
        survey_response_id__in=survey_response_ids
    ).select_related('question', 'survey_response')
    
    # Step 3: Group by survey_response and add to sessions
    by_response = {}
    for qr in question_responses:
        response_id = qr.survey_response_id
        if response_id not in by_response:
            by_response[response_id] = {
                'survey_response': qr.survey_response,
                'question_responses': []
            }
        by_response[response_id]['question_responses'].append(qr)
    
    # Step 4: Add each completed response as a session (using response_id as session_id)
    for response_id, data in by_response.items():
        session_id = f"completed_{response_id}"  # Use prefix to avoid conflicts
        
        sessions[session_id] = {
            'ip_address': data['survey_response'].ip_address or 'unknown',
            'is_completed': True,
            'last_activity': data['survey_response'].submitted_at,
            'first_activity': data['survey_response'].submitted_at,
            'survey_response_id': str(response_id).split('-')[-1],  # Store the UUID for Respondent ID
            'questions': {}
        }
        
        # Add all question responses
        for qr in data['question_responses']:
            sessions[session_id]['questions'][qr.question.id] = qr.answer


def get_subfields_for_answer(answer, question=None):
    """
    Detect if an answer contains sub-fields (dict structure).
    
    This is used to determine if a question needs multiple columns in the Excel export.
    For example, form-type questions or grid questions have multiple sub-fields.
    
    Args:
        answer: The answer value (could be string, dict, list, etc.)
        question: Optional Question object to check for multi-select type
    
    Returns:
        list: List of subfield names if answer is a dict, None otherwise
    """
    if not isinstance(answer, dict):
        return None
    
    # Check for comment+answer structure
    if 'answer' in answer and 'comment' in answer:
        inner_answer = answer.get('answer')
        if isinstance(inner_answer, dict):
            return list(inner_answer.keys()) + ['comment']
        else:
            return ['answer', 'comment']
    
    # Regular dict structure
    return list(answer.keys())


def analyze_question_subfields(sessions, questions):
    """
    Analyze all session responses to determine which questions have sub-columns.
    
    This function scans all answers across all sessions to identify questions
    that return dictionary/object answers and need multiple sub-columns in Excel.
    Also handles multi-select questions by creating a column for each option.
    
    Args:
        sessions: Dict of session data
        questions: QuerySet or list of Question objects
    
    Returns:
        tuple: (question_subfields, multi_select_questions)
            - question_subfields: Dict mapping question_id to sorted list of subfield names
            - multi_select_questions: Dict mapping question_id to list of options
    """
    question_subfields = {}
    multi_select_questions = {}
    
    # Create a map of question_id to question object for quick lookup
    question_map = {q.id: q for q in questions}
    
    # First, identify multi-select questions and their options
    for question in questions:
        if question.secondary_type == 'multiple_choices' and question.options:
            # Store all options for this multi-select question
            options = question.options.copy()
            
            # Add special options if they exist
            if question.has_other_option:
                options.append('Other')
            if question.has_none_option:
                none_text = question.none_option_text if question.none_option_text else 'None of the above'
                options.append(none_text)
            
            multi_select_questions[question.id] = options
    
    # Then analyze answers for other subfield types (forms, grids, etc.)
    for session_id, session_data in sessions.items():
        for question_id, answer in session_data['questions'].items():
            # Skip multi-select questions - they're handled separately
            if question_id in multi_select_questions:
                continue
                
            if answer is not None:
                question = question_map.get(question_id)
                subfields = get_subfields_for_answer(answer, question)
                if subfields:
                    if question_id not in question_subfields:
                        question_subfields[question_id] = set()
                    question_subfields[question_id].update(subfields)
    
    # Convert sets to sorted lists for consistent column ordering
    question_subfields = {
        qid: sorted(list(subfields))
        for qid, subfields in question_subfields.items()
    }
    
    return question_subfields, multi_select_questions


def filter_sessions_by_completion(sessions):
    """
    Split sessions into partial and completed categories.
    
    Args:
        sessions: Dict of all session data
    
    Returns:
        tuple: (partial_sessions, completed_sessions)
            - partial_sessions: Dict of incomplete sessions
            - completed_sessions: Dict of complete sessions
    """
    partial_sessions = {}
    completed_sessions = {}
    
    for session_id, session_data in sessions.items():
        if session_data['is_completed']:
            completed_sessions[session_id] = session_data
        else:
            partial_sessions[session_id] = session_data
    
    return partial_sessions, completed_sessions


def collect_completed_responses_only(survey):
    """
    Collect ONLY fully completed survey responses from SurveyResponse table.
    
    IMPORTANT: This function explicitly excludes ANY partial response data.
    It ONLY queries the SurveyResponse and QuestionResponse tables.
    No PartialSurveyResponse data is included.
    
    Used for analytics which must only analyze fully completed responses.
    
    Process:
    1. Get all SurveyResponse IDs for the survey (only fully submitted responses)
    2. Get all QuestionResponse records for those responses
    3. Aggregate by response_id -> question_id -> answer
    
    Args:
        survey: Survey instance
    
    Returns:
        dict: Sessions dict for analytics
            - Format: {response_id: {'questions': {question_id: answer}}}
            - Each response_id represents a fully completed SurveyResponse
            - No partial/incomplete data included
    """
    # Step 1: Get all fully completed survey response IDs
    # ONLY from SurveyResponse table - no partial responses
    survey_response_ids = SurveyResponse.objects.filter(
        survey=survey
    ).values_list('id', flat=True)
    
    if not survey_response_ids:
        return {}
    
    # Step 2: Get all question responses for these completed survey responses
    # ONLY from QuestionResponse table - no partial data
    question_responses = QuestionResponse.objects.filter(
        survey_response_id__in=survey_response_ids
    ).select_related('question', 'survey_response')
    
    # Step 3: Aggregate data by response
    # Each response_id is a fully completed survey submission
    # Also store metadata (response_id, submitted_at) for comment exports
    sessions = {}
    response_metadata = {}  # Map response_id to metadata
    
    for qr in question_responses:
        response_id = str(qr.survey_response_id)
        
        if response_id not in sessions:
            sessions[response_id] = {
                'questions': {}
            }
            # Store metadata for this response
            response_metadata[response_id] = {
                'response_id': qr.survey_response.id,
                'submitted_at': qr.survey_response.submitted_at
            }
        
        # Store answer for this question
        sessions[response_id]['questions'][qr.question.id] = qr.answer
    
    return sessions, response_metadata

