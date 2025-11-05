from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_http_methods
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
import openpyxl
import io

from .models import Survey, Question, PartialSurveyResponse
from .serializers import (
    SurveySerializer, 
    SurveyListSerializer, 
    QuestionSerializer, 
    SurveyResponseSerializer, 
    PartialSurveyResponseSerializer
)

# Create your views here.

def get_client_ip(request):
    """Get the client's real IP address"""
    # Check for forwarded headers first (common in Docker/proxy setups)
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        # X-Forwarded-For can contain multiple IPs, take the first one
        ip = x_forwarded_for.split(',')[0].strip()
        return ip
    
    # Check for other common proxy headers
    x_real_ip = request.META.get('HTTP_X_REAL_IP')
    if x_real_ip:
        return x_real_ip
    
    # Fall back to REMOTE_ADDR
    return request.META.get('REMOTE_ADDR', 'Unknown')

@csrf_exempt
@require_http_methods(["GET"])
def health_check(request):
    """Simple health check endpoint"""
    return JsonResponse({
        'status': 'ok',
        'message': 'Django is running',
        'admin_url': '/admin/',
    })

@csrf_exempt
@require_POST
def upload_excel(request):
    if 'file' not in request.FILES:
        return JsonResponse({'error': 'No file uploaded'}, status=400)
    excel_file = request.FILES['file']
    try:
        wb = openpyxl.load_workbook(filename=io.BytesIO(excel_file.read()))
        sheet = wb.active
        questions = []
        for row in sheet.iter_rows(min_row=2, values_only=True):
            if row[0]:
                questions.append({'question': row[0]})
        return JsonResponse({'questions': questions})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)

@api_view(['GET'])
@permission_classes([AllowAny])
def survey_list(request):
    """Get list of surveys. By default returns only active; add include_inactive=true to include all."""
    include_inactive = request.GET.get('include_inactive', 'false').lower() in ['1', 'true', 'yes']
    if include_inactive:
        surveys = Survey.objects.all()
    else:
        surveys = Survey.objects.filter(is_active=True)
    serializer = SurveyListSerializer(surveys, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([AllowAny])
def survey_detail(request, survey_id):
    """Get a specific survey with all its questions

    By default returns only active surveys. If include_inactive=true is provided and
    the survey exists but is inactive, return minimal metadata indicating inactive status.
    """
    include_inactive = request.GET.get('include_inactive', 'false').lower() in ['1', 'true', 'yes']

    if include_inactive:
        # Try to get survey regardless of active flag
        survey = get_object_or_404(Survey, id=survey_id)
        if not survey.is_active:
            # Return minimal meta so clients can show a friendly "closed" message
            return Response({
                'id': str(survey.id),
                'title': survey.title,
                'description': survey.description,
                'is_active': survey.is_active
            })
        # If active, fall through to normal serializer with questions
        serializer = SurveySerializer(survey)
        return Response(serializer.data)

    # Default behaviour: only active surveys are accessible
    survey = get_object_or_404(Survey, id=survey_id, is_active=True)
    serializer = SurveySerializer(survey)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([AllowAny])
def questions_by_survey(request, survey_id):
    """Get all questions for a specific survey. By default returns only for active surveys; add include_inactive=true to include questions for inactive surveys."""
    include_inactive = request.GET.get('include_inactive', 'false').lower() in ['1', 'true', 'yes']
    
    if include_inactive:
        survey = get_object_or_404(Survey, id=survey_id)
    else:
        survey = get_object_or_404(Survey, id=survey_id, is_active=True)
    
    questions = survey.questions.all()
    serializer = QuestionSerializer(questions, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([AllowAny])
def question_detail(request, survey_id, question_id):
    """Get a specific question from a survey"""
    question = get_object_or_404(Question, id=question_id, survey_id=survey_id, survey__is_active=True)
    serializer = QuestionSerializer(question)
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([AllowAny])
def submit_survey_response(request, survey_id):
    """Submit a survey response"""
    try:
        survey = get_object_or_404(Survey, id=survey_id, is_active=True)
        
        # Get client information using improved IP detection
        ip_address = get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        
        # Prepare the data for serializer
        response_data = {
            'survey': survey.id,
            'ip_address': ip_address,
            'user_agent': user_agent,
            'question_responses': []
        }
        
        # Process the responses from request data
        responses = request.data.get('responses', {})
        
        # First pass: collect comment responses
        comment_responses = {}
        for question_id, answer in responses.items():
            if isinstance(question_id, str) and question_id.endswith('_comment'):
                parent_question_id = question_id.replace('_comment', '')
                try:
                    parent_question_id = int(parent_question_id)
                    comment_responses[parent_question_id] = answer
                except ValueError:
                    continue
        
        # Second pass: process regular question responses and combine with comments
        for question_id, answer in responses.items():
            # Skip comment fields - they're handled separately
            if isinstance(question_id, str) and question_id.endswith('_comment'):
                continue
            
            # Handle regular question responses
            try:
                question_id_int = int(question_id)
            except (ValueError, TypeError):
                continue  # Skip invalid question IDs
            
            question = get_object_or_404(Question, id=question_id_int, survey=survey)
            
            # Combine main answer with comment if it exists
            combined_answer = answer
            if question_id_int in comment_responses:
                comment_text = comment_responses[question_id_int]
                if comment_text and comment_text.strip():
                    # Store as an object with both answer and comment
                    combined_answer = {
                        'answer': answer,
                        'comment': comment_text
                    }
            
            question_response = {
                'question': question.id,
                'answer': combined_answer,
                'answer_type': question.question_type
            }
            response_data['question_responses'].append(question_response)
        
        # Create the survey response
        serializer = SurveyResponseSerializer(data=response_data)
        if not serializer.is_valid():
            print(f"Serializer errors: {serializer.errors}")
            
        if serializer.is_valid():
            survey_response = serializer.save()
            
            # Clean up partial responses for this survey and IP after successful submission
            session_id = request.data.get('session_id', '')
            if session_id:
                # Mark partial responses as completed instead of deleting them
                PartialSurveyResponse.objects.filter(
                    survey=survey,
                    ip_address=ip_address,
                    session_id=session_id,
                    is_completed=False
                ).update(is_completed=True)
            
            return Response({
                'message': 'Survey response submitted successfully',
                'response_id': survey_response.id
            }, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        return Response({
            'error': 'Failed to submit survey response',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([AllowAny])
def save_partial_response(request, survey_id, question_id):
    """Save a partial response when user clicks Next on a specific question"""
    try:
        survey = get_object_or_404(Survey, id=survey_id, is_active=True)
        question = get_object_or_404(Question, id=question_id, survey=survey)
        
        # Get client information
        ip_address = get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        session_id = request.data.get('session_id', '')  # Get session ID from frontend
        
        # Get the answer from request data
        answer = request.data.get('answer')
        if not answer:
            return Response({
                'error': 'Answer is required'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Prepare the data for serializer
        response_data = {
            'survey': survey.id,
            'question': question.id,
            'answer': answer,
            'answer_type': question.question_type,
            'ip_address': ip_address,
            'user_agent': user_agent,
            'session_id': session_id
        }
        
        # Create or update the partial response
        serializer = PartialSurveyResponseSerializer(data=response_data)
        
        if serializer.is_valid():
            # Check if a partial response already exists for this survey, question, IP, and session
            existing_response = PartialSurveyResponse.objects.filter(
                survey=survey,
                question=question,
                ip_address=ip_address,
                session_id=session_id,
                is_completed=False  # Only update incomplete responses
            ).first()
            
            if existing_response:
                # Update existing response
                existing_response.answer = answer
                existing_response.user_agent = user_agent
                existing_response.save()
                partial_response = existing_response
            else:
                # Create new response
                partial_response = serializer.save()
            
            return Response({
                'message': 'Partial response saved successfully',
                'response_id': partial_response.id,
                'question_id': question.id,
                'answer': answer,
                'session_id': session_id
            }, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
    except Exception as e:
        return Response({
            'error': 'Failed to save partial response',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

