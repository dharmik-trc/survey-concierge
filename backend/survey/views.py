from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from django.shortcuts import get_object_or_404
import openpyxl
import io

from .models import Survey, Question, SurveyResponse, QuestionResponse
from .serializers import SurveySerializer, SurveyListSerializer, QuestionSerializer, SurveyResponseSerializer

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
    """Get list of all active surveys"""
    surveys = Survey.objects.filter(is_active=True)
    serializer = SurveyListSerializer(surveys, many=True)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([AllowAny])
def survey_detail(request, survey_id):
    """Get a specific survey with all its questions"""
    survey = get_object_or_404(Survey, id=survey_id, is_active=True)
    serializer = SurveySerializer(survey)
    return Response(serializer.data)

@api_view(['GET'])
@permission_classes([AllowAny])
def questions_by_survey(request, survey_id):
    """Get all questions for a specific survey"""
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
        
        print(f"Client IP detected: {ip_address}")
        print(f"User Agent: {user_agent}")
        
        # Prepare the data for serializer
        response_data = {
            'survey': survey.id,
            'ip_address': ip_address,
            'user_agent': user_agent,
            'question_responses': []
        }
        
        print(f"Response data being sent to serializer: {response_data}")
        
        # Process the responses from request data
        responses = request.data.get('responses', {})
        
        for question_id, answer in responses.items():
            question = get_object_or_404(Question, id=question_id, survey=survey)
            question_response = {
                'question': question.id,
                'answer': answer,
                'answer_type': question.question_type
            }
            response_data['question_responses'].append(question_response)
        
        # Create the survey response
        serializer = SurveyResponseSerializer(data=response_data)
        print(f"Serializer is valid: {serializer.is_valid()}")
        if not serializer.is_valid():
            print(f"Serializer errors: {serializer.errors}")
            
        if serializer.is_valid():
            survey_response = serializer.save()
            print(f"Survey response created with ID: {survey_response.id}")
            print(f"IP address saved: {survey_response.ip_address}")
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
