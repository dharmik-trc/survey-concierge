from rest_framework import serializers
from django.core.validators import EmailValidator
from django.core.exceptions import ValidationError
import re
from .models import Survey, Question, SurveyResponse, QuestionResponse

# Utility functions for question handling (scale functions removed as no longer needed)

class QuestionSerializer(serializers.ModelSerializer):
    # Include question_type for backward compatibility (it's a property that returns secondary_type)
    question_type = serializers.ReadOnlyField()
    
    class Meta:
        model = Question
        fields = ['id', 'question_text', 'primary_type', 'secondary_type', 'question_type', 'is_required', 'order', 'randomize_options', 'has_none_option', 'has_other_option', 'options', 'section_title', 'subfields', 'subfield_validations', 'rows', 'columns']

class SurveySerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    
    class Meta:
        model = Survey
        fields = ['id', 'title', 'description', 'logo_url', 'concierge_logo_url', 'created_at', 'updated_at', 'is_active', 'questions']

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

        # Validate based on question type (using secondary_type)
        question_type = question.secondary_type
        if question_type == 'email':
            if answer and not self._is_valid_email(answer):
                raise serializers.ValidationError("Please enter a valid email address")
        elif question_type == 'number':
            if answer and not self._is_valid_number(answer):
                raise serializers.ValidationError("Please enter a valid number")
        elif question_type in ['multiple_choices', 'radio', 'dropdown', 'yes_no', 'fields']:
            if question.options and answer:
                def is_valid_choice(choice):
                    if isinstance(choice, dict) and 'other' in choice:
                        # Accept structured 'Other' answers if 'Other' option is present
                        return any(opt.lower().startswith('other') for opt in question.options)
                    if choice in question.options:
                        return True
                    # Allow custom 'Other' values for 'Other, please specify' (legacy string format)
                    if any(opt.lower().startswith('other') for opt in question.options) and str(choice).startswith('Other:'):
                        # Ensure the "Other:" response has actual content after the colon
                        other_content = str(choice)[6:].strip()  # Remove "Other:" prefix
                        if not other_content:
                            return False  # Invalid if no content after "Other:"
                        return True
                    return False

                if isinstance(answer, list):
                    for choice in answer:
                        if not is_valid_choice(choice):
                            # Check if it's an empty "Other:" response
                            if str(choice).startswith('Other:') and str(choice)[6:].strip() == '':
                                raise serializers.ValidationError("Please specify your 'Other' option")
                            raise serializers.ValidationError(f"Invalid choice: {choice}")
                else:
                    if not is_valid_choice(answer):
                        # Check if it's an empty "Other:" response
                        if str(answer).startswith('Other:') and str(answer)[6:].strip() == '':
                            raise serializers.ValidationError("Please specify your 'Other' option")
                        raise serializers.ValidationError(f"Invalid choice: {answer}")
        elif question_type in ['form_fields']:
            # Form fields: answer must be a dict with subfields, supports different data types
            if not isinstance(answer, dict):
                raise serializers.ValidationError("Form fields answer must be an object with subfields.")
            if question.subfields and question.subfield_validations and answer:
                # Validate each subfield based on its validation rules
                for subfield, value in answer.items():
                    if subfield in question.subfields and value is not None and value != '':
                        validation = question.subfield_validations.get(subfield, {})
                        validation_type = validation.get('type', 'text')
                        
                        # Skip validation for auto-calculated fields
                        if validation_type == 'auto_calculate':
                            continue
                            
                        # Validate based on type
                        if validation_type in ['positive_number', 'negative_number', 'all_numbers']:
                            if not self._is_valid_number(value):
                                raise serializers.ValidationError(f"Subfield '{subfield}' must be a number.")
                        elif validation_type == 'email':
                            import re
                            email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
                            if not re.match(email_regex, str(value)):
                                raise serializers.ValidationError(f"Subfield '{subfield}' must be a valid email address.")
        elif question_type in ['cross_matrix', 'grid_radio']:
            # Cross matrix (single select): answer must be a dict mapping rows to single columns
            if not isinstance(answer, dict):
                raise serializers.ValidationError("Cross matrix answer must be an object mapping rows to columns.")
            if question.rows and question.columns and answer:
                # Only validate rows that are actually provided
                for row, value in answer.items():
                    if row in question.rows and value is not None and value != '':
                        if value not in question.columns:
                            raise serializers.ValidationError(f"Invalid column for row '{row}': {value}")
        elif question_type in ['cross_matrix_checkbox', 'grid_multi', 'ranking']:
            # Cross matrix checkbox: answer must be a dict mapping rows to arrays of columns
            if not isinstance(answer, dict):
                raise serializers.ValidationError("Cross matrix checkbox answer must be an object mapping rows to arrays of columns.")
            if question.rows and question.columns and answer:
                # Only validate rows that are actually provided
                for row, value in answer.items():
                    if row in question.rows and value is not None:
                        if not isinstance(value, list):
                            raise serializers.ValidationError(f"Row '{row}' must be an array of selected columns.")
                        for col in value:
                            if col not in question.columns:
                                raise serializers.ValidationError(f"Invalid column for row '{row}': {col}")
            # Only check required validation if the question is actually required
            if question.is_required and question.rows and answer:
                for row in question.rows:
                    if row in answer and (not answer[row] or len(answer[row]) == 0):
                        raise serializers.ValidationError(f"At least one column must be selected for row '{row}'")
        # Check required fields
        if question.is_required:
            if question_type in ['multiple_choices', 'radio', 'dropdown', 'yes_no', 'fields']:
                if not answer or (isinstance(answer, list) and len(answer) == 0):
                    raise serializers.ValidationError("This field is required")
            elif question_type in ['form_fields']:
                if not answer or not isinstance(answer, dict) or not answer:
                    raise serializers.ValidationError("This field is required")
            elif question_type in ['grid_radio']:
                if not answer or not isinstance(answer, dict) or not answer:
                    raise serializers.ValidationError("This field is required")
                elif answer and isinstance(answer, dict):
                    # Check if any provided values are empty (only for required questions)
                    if any(
                        (v == '' or v is None) for v in answer.values() if v is not None
                    ):
                        raise serializers.ValidationError("All subfields must be filled for required questions.")
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