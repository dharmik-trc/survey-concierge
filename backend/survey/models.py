from django.db import models
import uuid

# Create your models here.

class Survey(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return self.title

class Question(models.Model):
    QUESTION_TYPES = [
        ('text', 'Text'),
        ('multiple_choice', 'Multiple Choice'),
        ('checkbox', 'Checkbox'),
        ('rating', 'Rating'),
        ('email', 'Email'),
        ('number', 'Number'),
        ('matrix', 'Matrix'),  # New type for composite/matrix questions
        ('cross_matrix', 'Cross Matrix'),  # Cross-matrix radio question
        ('cross_matrix_checkbox', 'Cross Matrix Checkbox'),  # Cross-matrix checkbox question
    ]
    
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='questions')
    question_text = models.TextField()
    question_type = models.CharField(max_length=100, choices=QUESTION_TYPES, default='text')
    is_required = models.BooleanField(default=True)
    order = models.IntegerField(default=0)
    options = models.JSONField(blank=True, null=True)  # For multiple choice/checkbox questions
    section_title = models.CharField(max_length=200, blank=True, null=True)  # For grouping questions into sections
    subfields = models.JSONField(blank=True, null=True)  # For matrix questions: list of subfield names
    rows = models.JSONField(blank=True, null=True)  # For matrix_radio: list of row labels
    columns = models.JSONField(blank=True, null=True)  # For matrix_radio: list of column labels
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['order', 'created_at']
    
    def __str__(self):
        return f"{self.survey.title} - {self.question_text[:50]}"

class SurveyResponse(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='responses')
    submitted_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True)
    
    def __str__(self):
        return f"Response to {self.survey.title} - {self.submitted_at}"

class QuestionResponse(models.Model):
    survey_response = models.ForeignKey(SurveyResponse, on_delete=models.CASCADE, related_name='question_responses')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    answer = models.JSONField()  # Store any type of answer as JSON
    answer_type = models.CharField(max_length=100)  # e.g., 'text', 'number', 'choices', etc.
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['survey_response', 'question']

    def __str__(self):
        return f"Response to {self.question.question_text[:30]} ({self.answer_type})"
