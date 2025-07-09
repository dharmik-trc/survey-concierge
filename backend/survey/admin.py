from django.contrib import admin
from .models import Survey, Question, SurveyResponse, QuestionResponse

@admin.register(Survey)
class SurveyAdmin(admin.ModelAdmin):
    list_display = ['title', 'created_at', 'updated_at', 'is_active']
    list_filter = ['is_active', 'created_at']
    search_fields = ['title', 'description']
    readonly_fields = ['created_at', 'updated_at']

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['question_text', 'survey', 'question_type', 'is_required', 'order']
    list_filter = ['question_type', 'is_required', 'survey']
    search_fields = ['question_text', 'survey__title']
    ordering = ['survey', 'order']

class QuestionResponseInline(admin.TabularInline):
    model = QuestionResponse
    readonly_fields = ['question', 'answer_text', 'answer_rating', 'answer_choices', 'created_at']
    extra = 0
    can_delete = False

@admin.register(SurveyResponse)
class SurveyResponseAdmin(admin.ModelAdmin):
    list_display = ['survey', 'get_email', 'submitted_at', 'ip_address']
    list_filter = ['submitted_at', 'survey']
    search_fields = ['survey__title', 'question_responses__answer_text']
    readonly_fields = ['submitted_at', 'ip_address', 'user_agent']
    inlines = [QuestionResponseInline]
    list_per_page = 25
    
    def get_email(self, obj):
        """Extract email from question responses"""
        email_response = obj.question_responses.filter(
            question__question_type='email'
        ).first()
        if email_response and email_response.answer_text:
            return email_response.answer_text
        return "No email"
    get_email.short_description = 'Email'
    get_email.admin_order_field = 'question_responses__answer_text'
    
    def get_name(self, obj):
        """Extract name from question responses (assuming first text question might be name)"""
        # Look for a text question that might be a name field
        name_response = obj.question_responses.filter(
            question__question_type='text'
        ).first()
        if name_response and name_response.answer_text:
            # Truncate if too long
            name = name_response.answer_text.strip()
            return name[:30] + '...' if len(name) > 30 else name
        return "No name"
    get_name.short_description = 'Name'
    
    def get_queryset(self, request):
        """Optimize queryset to reduce database queries"""
        return super().get_queryset(request).prefetch_related(
            'question_responses__question'
        )
    
    def has_add_permission(self, request):
        return False  # Responses should only be created via API

@admin.register(QuestionResponse)
class QuestionResponseAdmin(admin.ModelAdmin):
    list_display = ['question', 'survey_response', 'get_answer_display', 'created_at']
    list_filter = ['question__question_type', 'created_at']
    search_fields = ['question__question_text', 'answer_text']
    readonly_fields = ['survey_response', 'question', 'answer_text', 'answer_rating', 'answer_choices', 'created_at']
    
    def get_answer_display(self, obj):
        if obj.answer_text:
            return obj.answer_text[:50] + '...' if len(obj.answer_text) > 50 else obj.answer_text
        elif obj.answer_rating:
            return f"Rating: {obj.answer_rating}"
        elif obj.answer_choices:
            return f"Choices: {', '.join(obj.answer_choices)}"
        return "No answer"
    get_answer_display.short_description = 'Answer'
    
    def has_add_permission(self, request):
        return False  # Responses should only be created via API
