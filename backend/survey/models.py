from django.db import models
import uuid

# Create your models here.
# Once you change this, you need to change question_admin.js
QUESTION_HIERARCHY = {
    "open_text": [
        ("text", "Short Text"),
        ("paragraph", "Paragraph / Long Text"),
        ("number", "Number"),
        ("email", "Email"),
        ("date", "Date"),
        ("time", "Time"),
    ],
    "form": [
        ("multiple_choices", "Multiple Choices (Multi Select)"),
        ("radio", "Radio (Single Select)"),
        ("dropdown", "Dropdown"),
        ("form_fields", "Form Fields (Multiple Inputs with Validation)"),
        ("fields", "Custom Fields (Name, Address, etc.)"),
        ("yes_no", "Yes / No"),
    ],
    "scale": [
        ("slider", "Slider / Rating Scale (0-10 default, fully customizable)"),
    ],
    "grid": [
        ("grid_radio", "Grid (Single Select per row)"),
        ("grid_multi", "Grid (Multi Select per row)"),
    ],
}


class Survey(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    logo_url = models.CharField(blank=True, null=True, help_text="URL to the logo for this survey", max_length=200)
    concierge_logo_url = models.URLField(blank=True, null=True, help_text="URL to the Survey Concierge logo for this survey")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)
    store_basic_details = models.BooleanField(default=False, help_text="Enable storing basic details (like email) when users click Next on specific questions")
    
    def __str__(self):
        return self.title

class Question(models.Model):
    PRIMARY_TYPES = [
        ("open_text", "Open Text"),
        ("form", "Form"),
        ("scale", "Scale/Rating"),
        ("grid", "Grid"),
    ]

    # Character limits for different field types
    MAX_TEXT_LENGTH = 99999
    MAX_EMAIL_LENGTH = 254
    MAX_NUMBER_LENGTH = 50
    MAX_CHOICE_LENGTH = 1000

    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name="questions")
    question_text = models.TextField()

    primary_type = models.CharField(max_length=50, choices=PRIMARY_TYPES, default="open_text")
    secondary_type = models.CharField(max_length=50, default="text")

    # Common fields
    is_required = models.BooleanField(default=True)
    order = models.IntegerField(default=0)
    randomize_options = models.BooleanField(default=False)
    
    # Special option controls
    has_none_option = models.BooleanField(default=False, help_text='Add "None of the Above" option (always appears last)')
    none_option_text = models.CharField(max_length=999, blank=True, null=True, help_text='Custom text for "None of the Above" option (defaults to "None of the Above" if empty)')
    has_other_option = models.BooleanField(default=False, help_text='Add "Other (please specify)" option with text input')
    
    # Grid-specific controls
    exclusive_column = models.CharField(max_length=999, blank=True, null=True, help_text='Column name that should be exclusive (only one option can be selected per row)')
    
    # Comment box (separate from Other option)
    has_comment_box = models.BooleanField(default=False, help_text='Add a separate comment box for additional notes')
    comment_box_rows = models.IntegerField(default=3, help_text='Number of rows for comment box (1-10)')
    comment_box_label = models.CharField(max_length=999, blank=True, null=True, help_text='Custom label for comment box (e.g., "Additional comments")')
    
    # Basic details storage
    store_on_next = models.BooleanField(default=False, help_text='Store this question\'s answer when user clicks Next (only works if survey has store_basic_details enabled)')
    
    row_count = models.IntegerField(default=1, help_text='Number of rows for text questions')
    
    # Slider/Scale specific fields
    scale_min = models.IntegerField(default=0, help_text='Minimum value for slider/scale (e.g., 0 for NPS)')
    scale_max = models.IntegerField(default=10, help_text='Maximum value for slider/scale (e.g., 10 for NPS)')
    scale_step = models.IntegerField(default=1, help_text='Step increment for slider (e.g., 1 for whole numbers)')
    scale_min_label = models.CharField(max_length=100, default='Not at all likely', blank=True, help_text='Label for minimum value')
    scale_max_label = models.CharField(max_length=100, default='Extremely likely', blank=True, help_text='Label for maximum value')

    # Options
    options = models.JSONField(blank=True, null=True)

    # Extra structures
    section_title = models.CharField(max_length=999, blank=True, null=True)
    subfields = models.JSONField(blank=True, null=True)
    subfield_validations = models.JSONField(blank=True, null=True, help_text='Validation rules for each subfield: {"field_name": {"type": "positive_number|negative_number|email|text", "required": true}}')
    rows = models.JSONField(blank=True, null=True)
    columns = models.JSONField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "created_at"]

    @property
    def question_type(self):
        """Backward compatibility property that returns secondary_type"""
        return self.secondary_type

    def clean(self):
        from django.core.exceptions import ValidationError

        valid_secondaries = dict(QUESTION_HIERARCHY).get(self.primary_type, [])
        valid_secondary_keys = [s[0] for s in valid_secondaries]

        if self.secondary_type not in valid_secondary_keys:
            raise ValidationError(
                f"Invalid secondary type '{self.secondary_type}' for primary type '{self.primary_type}'. "
                f"Valid options are: {valid_secondary_keys}"
            )

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
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    survey_response = models.ForeignKey(SurveyResponse, on_delete=models.CASCADE, related_name='question_responses')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    answer = models.JSONField()  # Store any type of answer as JSON
    answer_type = models.CharField(max_length=100)  # e.g., 'text', 'number', 'choices', etc.
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['survey_response', 'question']

    def __str__(self):
        return f"Response to {self.question.question_text[:30]} ({self.answer_type})"


class PartialSurveyResponse(models.Model):
    """Store partial responses for surveys that have store_basic_details enabled"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    survey = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='partial_responses')
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    answer = models.JSONField()  # Store the answer as JSON
    answer_type = models.CharField(max_length=100)  # e.g., 'text', 'email', 'number', etc.
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True)
    session_id = models.CharField(max_length=100, blank=True, null=True, help_text="Browser session ID to track user")
    is_completed = models.BooleanField(default=False, help_text="True if this partial response was converted to a complete survey response")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['survey', 'question', 'ip_address', 'session_id']
        indexes = [
            models.Index(fields=['survey', 'ip_address']),
            models.Index(fields=['survey', 'session_id']),
            models.Index(fields=['created_at']),
            models.Index(fields=['is_completed']),
        ]

    def __str__(self):
        return f"Partial response to {self.question.question_text[:30]} from {self.ip_address}"
