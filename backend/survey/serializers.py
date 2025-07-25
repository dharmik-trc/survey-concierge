from rest_framework import serializers
from django.core.validators import EmailValidator
from django.core.exceptions import ValidationError
import re
from .models import Survey, Question, SurveyResponse, QuestionResponse

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ['id', 'question_text', 'question_type', 'is_required', 'order', 'options', 'section_title', 'subfields', 'rows', 'columns']

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
        fields = ['question', 'answer', 'answer_type']

    def validate(self, data):
        question = data.get('question')
        answer = data.get('answer')
        answer_type = data.get('answer_type')

        if not question:
            raise serializers.ValidationError("Question is required")
        if not answer_type:
            raise serializers.ValidationError("Answer type is required")

        # Validate based on question type
        if question.question_type == 'email':
            if answer and not self._is_valid_email(answer):
                raise serializers.ValidationError("Please enter a valid email address")
        elif question.question_type == 'number':
            if answer and not self._is_valid_number(answer):
                raise serializers.ValidationError("Please enter a valid number")
        elif question.question_type == 'rating':
            if answer is not None and (int(answer) < 1 or int(answer) > 5):
                raise serializers.ValidationError("Rating must be between 1 and 5")
        elif question.question_type in ['multiple_choice', 'checkbox']:
            if question.options and answer:
                def is_valid_choice(choice):
                    if isinstance(choice, dict) and 'other' in choice:
                        # Accept structured 'Other' answers if 'Other' option is present
                        return any(opt.lower().startswith('other') for opt in question.options)
                    if choice in question.options:
                        return True
                    # Allow custom 'Other' values for 'Other, please specify' (legacy string format)
                    if any(opt.lower().startswith('other') for opt in question.options) and str(choice).startswith('Other:'):
                        return True
                    return False

                if isinstance(answer, list):
                    for choice in answer:
                        if not is_valid_choice(choice):
                            raise serializers.ValidationError(f"Invalid choice: {choice}")
                else:
                    if not is_valid_choice(answer):
                        raise serializers.ValidationError(f"Invalid choice: {answer}")
        elif question.question_type == 'matrix':
            # Matrix: answer must be a dict with all subfields as numbers
            if not isinstance(answer, dict):
                raise serializers.ValidationError("Matrix answer must be an object with subfields.")
            if question.subfields:
                for subfield in question.subfields:
                    if subfield not in answer:
                        raise serializers.ValidationError(f"Missing subfield: {subfield}")
                    if not self._is_valid_number(answer[subfield]):
                        raise serializers.ValidationError(f"Subfield '{subfield}' must be a number.")
        elif question.question_type == 'cross_matrix':
            # Cross matrix: answer must be a dict mapping each row to a valid column
            if not isinstance(answer, dict):
                raise serializers.ValidationError("Cross matrix answer must be an object mapping rows to columns.")
            if question.rows and question.columns:
                for row in question.rows:
                    if row not in answer:
                        raise serializers.ValidationError(f"Missing row: {row}")
                    if answer[row] not in question.columns:
                        raise serializers.ValidationError(f"Invalid column for row '{row}': {answer[row]}")
        elif question.question_type == 'cross_matrix_checkbox':
            # Cross matrix checkbox: answer must be a dict mapping each row to an array of valid columns
            if not isinstance(answer, dict):
                raise serializers.ValidationError("Cross matrix checkbox answer must be an object mapping rows to arrays of columns.")
            if question.rows and question.columns:
                for row in question.rows:
                    if row not in answer:
                        raise serializers.ValidationError(f"Missing row: {row}")
                    if not isinstance(answer[row], list):
                        raise serializers.ValidationError(f"Row '{row}' must be an array of selected columns.")
                    for col in answer[row]:
                        if col not in question.columns:
                            raise serializers.ValidationError(f"Invalid column for row '{row}': {col}")
            if question.is_required and question.rows:
                for row in question.rows:
                    if not answer[row] or len(answer[row]) == 0:
                        raise serializers.ValidationError(f"At least one column must be selected for row '{row}'")
        # Check required fields
        if question.is_required:
            if question.question_type == 'rating':
                if answer is None:
                    raise serializers.ValidationError("This field is required")
            elif question.question_type in ['multiple_choice', 'checkbox']:
                if not answer or (isinstance(answer, list) and len(answer) == 0):
                    raise serializers.ValidationError("This field is required")
            elif question.question_type == 'matrix':
                if not answer or not isinstance(answer, dict) or any(
                    (v == '' or v is None) for v in answer.values()
                ):
                    raise serializers.ValidationError("All subfields are required.")
            else:
                if not answer or (isinstance(answer, str) and answer.strip() == ''):
                    raise serializers.ValidationError("This field is required")
        return data

    def _is_valid_email(self, email):
        email_validator = EmailValidator()
        try:
            email_validator(email)
            return True
        except ValidationError:
            return False

    def _is_valid_number(self, value):
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