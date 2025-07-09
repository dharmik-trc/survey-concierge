from rest_framework import serializers
from django.core.validators import EmailValidator
from django.core.exceptions import ValidationError
import re
from .models import Survey, Question, SurveyResponse, QuestionResponse

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ['id', 'question_text', 'question_type', 'is_required', 'order', 'options']

class SurveySerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Survey
        fields = ['id', 'title', 'description', 'created_at', 'updated_at', 'is_active', 'questions']

class SurveyListSerializer(serializers.ModelSerializer):
    question_count = serializers.SerializerMethodField()
    
    class Meta:
        model = Survey
        fields = ['id', 'title', 'description', 'created_at', 'question_count', 'is_active']
    
    def get_question_count(self, obj):
        return obj.questions.count()

class QuestionResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionResponse
        fields = ['question', 'answer_text', 'answer_rating', 'answer_choices']
    
    def validate(self, data):
        question = data.get('question')
        answer_text = data.get('answer_text', '')
        answer_rating = data.get('answer_rating')
        answer_choices = data.get('answer_choices')
        
        if not question:
            raise serializers.ValidationError("Question is required")
        
        # Validate based on question type
        if question.question_type == 'email':
            if answer_text and not self._is_valid_email(answer_text):
                raise serializers.ValidationError("Please enter a valid email address")
        
        elif question.question_type == 'number':
            if answer_text and not self._is_valid_number(answer_text):
                raise serializers.ValidationError("Please enter a valid number")
        
        elif question.question_type == 'rating':
            if answer_rating is not None and (answer_rating < 1 or answer_rating > 5):
                raise serializers.ValidationError("Rating must be between 1 and 5")
        
        elif question.question_type in ['multiple_choice', 'checkbox']:
            if question.options and answer_choices:
                if isinstance(answer_choices, list):
                    for choice in answer_choices:
                        if choice not in question.options:
                            raise serializers.ValidationError(f"Invalid choice: {choice}")
                else:
                    if answer_choices not in question.options:
                        raise serializers.ValidationError(f"Invalid choice: {answer_choices}")
        
        # Check required fields
        if question.is_required:
            if question.question_type == 'rating':
                if answer_rating is None:
                    raise serializers.ValidationError("This field is required")
            elif question.question_type in ['multiple_choice', 'checkbox']:
                if not answer_choices or (isinstance(answer_choices, list) and len(answer_choices) == 0):
                    raise serializers.ValidationError("This field is required")
            else:
                if not answer_text or answer_text.strip() == '':
                    raise serializers.ValidationError("This field is required")
        
        return data
    
    def _is_valid_email(self, email):
        """Validate email format"""
        email_validator = EmailValidator()
        try:
            email_validator(email)
            return True
        except ValidationError:
            return False
    
    def _is_valid_number(self, value):
        """Validate number format"""
        try:
            float(value)
            return True
        except (ValueError, TypeError):
            return False

class SurveyResponseSerializer(serializers.ModelSerializer):
    question_responses = QuestionResponseSerializer(many=True)
    
    class Meta:
        model = SurveyResponse
        fields = ['id', 'survey', 'question_responses', 'submitted_at', 'ip_address', 'user_agent']
        read_only_fields = ['id', 'submitted_at']
    
    def validate(self, data):
        survey = data.get('survey')
        question_responses = data.get('question_responses', [])
        
        if not survey:
            raise serializers.ValidationError("Survey is required")
        
        # Check if all required questions are answered
        survey_questions = survey.questions.all()
        answered_question_ids = [qr.get('question').id for qr in question_responses if qr.get('question')]
        
        for question in survey_questions:
            if question.is_required and question.id not in answered_question_ids:
                raise serializers.ValidationError(f"Required question '{question.question_text}' is not answered")
        
        return data
    
    def create(self, validated_data):
        question_responses_data = validated_data.pop('question_responses')
        survey_response = SurveyResponse.objects.create(**validated_data)
        
        for response_data in question_responses_data:
            QuestionResponse.objects.create(
                survey_response=survey_response,
                **response_data
            )
        
        return survey_response 