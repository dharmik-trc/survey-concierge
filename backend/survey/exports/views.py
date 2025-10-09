"""
Export Views

This module contains the main API endpoints for exporting survey responses.
"""

import io
import openpyxl
from datetime import datetime
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from ..models import Survey, Question
from .data_collector import (
    collect_session_data,
    merge_completed_responses,
    analyze_question_subfields,
    filter_sessions_by_completion
)
from .excel_builder import (
    create_excel_styles,
    create_worksheet_with_data,
    create_empty_sheet
)


def _create_empty_workbook(survey, survey_id):
    """
    Create an empty workbook when there are no sessions.
    
    Args:
        survey: Survey instance
        survey_id: UUID of the survey
    
    Returns:
        HttpResponse: Excel file response with a message indicating no data
    """
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Partial Responses"
    
    styles = create_excel_styles()
    
    ws.cell(row=1, column=1, value="No partial responses found")
    ws.cell(row=1, column=1).fill = styles['header_fill']
    ws.cell(row=1, column=1).font = styles['header_font']
    ws.cell(row=1, column=1).alignment = styles['header_alignment']
    
    output = io.BytesIO()
    wb.save(output)
    output.seek(0)
    
    response = HttpResponse(
        output.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    current_datetime = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    survey_name = survey.title.replace(' ', '_')
    filename = f"{survey_name}_{current_datetime}.xlsx"
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response


@api_view(['GET'])
@permission_classes([AllowAny])
def export_survey_responses(request, survey_id):
    """
    Export all survey responses as an Excel file with 3 tabs grouped by session.
    
    This endpoint provides a comprehensive export of all survey responses organized
    into three tabs for easy analysis:
    
    Tabs created:
    1. **Partial Responses** - Only incomplete sessions
    2. **Completed Responses** - Only complete sessions  
    3. **All Responses** - Everything combined
    
    Process Steps:
    - Step 1: Collect session data from partial responses table
    - Step 2: Merge complete responses from survey responses table
    - Step 3: Handle empty case (no data)
    - Step 4: Filter sessions by completion status
    - Step 5: Analyze sub-columns needed for complex questions
    - Step 6: Create workbook with 3 tabs
    - Step 7: Return Excel file
    
    Features:
    - Two-row header with main questions and sub-columns
    - Sequential question numbering starting from 1 (Q1, Q2, Q3...)
    - Color coding for completion status (green=completed, yellow=partial)
    - Proper formatting with frozen headers and wrapped text
    - Sub-columns for complex questions (forms, grids, etc.)
    
    Args:
        request: Django request object
        survey_id: UUID of the survey
    
    Returns:
        HttpResponse: Excel file download or error response
    """
    try:
        # Get survey and questions
        survey = get_object_or_404(Survey, id=survey_id, is_active=True)
        all_questions = Question.objects.filter(survey=survey).order_by('order', 'created_at')
        
        # Step 1: Collect session data from partial responses
        sessions, completed_sessions_info = collect_session_data(survey)
        
        # Step 2: Merge complete responses for finished sessions
        merge_completed_responses(survey, sessions, completed_sessions_info)
        
        # Step 3: Handle empty case
        if not sessions:
            return _create_empty_workbook(survey, survey_id)
        
        # Step 4: Filter sessions by completion status
        partial_sessions, completed_sessions = filter_sessions_by_completion(sessions)
        
        # Step 5: Analyze questions to identify sub-columns (using all sessions)
        question_subfields = analyze_question_subfields(sessions)
        
        # Step 6: Create Excel workbook with 3 tabs
        wb = openpyxl.Workbook()
        styles = create_excel_styles()
        
        # Remove the default sheet created by openpyxl
        if 'Sheet' in wb.sheetnames:
            wb.remove(wb['Sheet'])
        
        # Tab 1: Partial Responses
        if partial_sessions:
            create_worksheet_with_data(
                wb, "Partial Responses", partial_sessions,
                all_questions, question_subfields, styles
            )
        else:
            create_empty_sheet(wb, "Partial Responses", "No partial responses found")
        
        # Tab 2: Completed Responses
        if completed_sessions:
            create_worksheet_with_data(
                wb, "Completed Responses", completed_sessions,
                all_questions, question_subfields, styles
            )
        else:
            create_empty_sheet(wb, "Completed Responses", "No completed responses found")
        
        # Tab 3: All Responses
        create_worksheet_with_data(
            wb, "All Responses", sessions,
            all_questions, question_subfields, styles
        )
        
        # Set "All Responses" as the active sheet (first tab user sees)
        wb.active = wb["All Responses"]
        
        # Step 7: Generate and return Excel file
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        
        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        current_datetime = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
        survey_name = survey.title.replace(' ', '_')
        filename = f"{survey_name}_{current_datetime}.xlsx"
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        
        return response
        
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        print(f"Error exporting survey responses: {str(e)}")
        print(f"Traceback: {error_traceback}")
        return Response({
            'error': 'Failed to export survey responses',
            'details': str(e),
            'traceback': error_traceback
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

