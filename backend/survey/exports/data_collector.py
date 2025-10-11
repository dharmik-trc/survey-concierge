"""
Data Collection Utilities

This module handles collecting and organizing survey response data for export.
"""

from ..models import PartialSurveyResponse, SurveyResponse, QuestionResponse


def collect_session_data(survey):
    """
    Collect and organize partial response data by session.
    
    Args:
        survey: Survey instance
    
    Returns:
        tuple: (sessions dict, completed_sessions_info dict)
            - sessions: Dict mapping session_id to session data with questions, timestamps, completion status
            - completed_sessions_info: Dict mapping session_id to IP and timestamp for completed sessions
    """
    partial_responses = PartialSurveyResponse.objects.filter(
        survey=survey
    ).select_related('question').order_by('session_id', 'created_at')
    
    sessions = {}
    completed_sessions_info = {}
    
    for response in partial_responses:
        session_id = response.session_id or 'unknown'
        
        # Initialize session if not exists
        if session_id not in sessions:
            sessions[session_id] = {
                'ip_address': response.ip_address or 'unknown',
                'is_completed': response.is_completed,
                'last_activity': response.updated_at,
                'first_activity': response.created_at,
                'questions': {}
            }
        
        # Store question response
        sessions[session_id]['questions'][response.question.id] = response.answer
        
        # Track completed sessions
        if response.is_completed:
            sessions[session_id]['is_completed'] = True
            if session_id not in completed_sessions_info:
                completed_sessions_info[session_id] = {
                    'ip': response.ip_address,
                    'updated_at': response.updated_at
                }
        
        # Update timestamps
        if response.created_at < sessions[session_id]['first_activity']:
            sessions[session_id]['first_activity'] = response.created_at
        if response.updated_at > sessions[session_id]['last_activity']:
            sessions[session_id]['last_activity'] = response.updated_at
    
    return sessions, completed_sessions_info


def merge_completed_responses(survey, sessions, completed_sessions_info):
    """
    Fetch and merge complete survey responses for completed sessions.
    
    This function looks up complete survey submissions and merges their answers
    into the session data, ensuring we have all answers even if they weren't
    stored in the partial response table.
    
    Args:
        survey: Survey instance
        sessions: Dict of session data (will be modified in place)
        completed_sessions_info: Dict mapping session_id to IP/timestamp info
    """
    for session_id, info in completed_sessions_info.items():
        # Find the most recent complete survey response by IP
        survey_response = SurveyResponse.objects.filter(
            survey=survey,
            ip_address=info['ip']
        ).prefetch_related('question_responses__question').order_by('-submitted_at').first()
        
        if survey_response:
            # Get all answers from the complete submission
            question_responses = QuestionResponse.objects.filter(
                survey_response=survey_response
            ).select_related('question')
            
            # Merge complete answers into session data
            for qr in question_responses:
                sessions[session_id]['questions'][qr.question.id] = qr.answer
            
            # Update last activity timestamp
            sessions[session_id]['last_activity'] = survey_response.submitted_at


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
                none_text = question.none_option_text if question.none_option_text else 'None of the Above'
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

