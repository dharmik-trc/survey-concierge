from django.contrib import admin
from django import forms
from django.utils.safestring import mark_safe
import json
from .models import Survey, Question, SurveyResponse, QuestionResponse, QUESTION_HIERARCHY

class SubfieldValidationWidget(forms.Widget):
    """User-friendly widget for editing subfield validations with dropdowns and buttons."""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.attrs.update({'class': 'subfield-validation-widget'})
    
    def render(self, name, value, attrs=None, renderer=None):
        if attrs is None:
            attrs = {}
        
        # Parse current value
        current_validations = {}
        if value:
            try:
                if isinstance(value, str):
                    current_validations = json.loads(value) if value.strip() else {}
                elif isinstance(value, dict):
                    current_validations = value
                else:
                    current_validations = {}
            except (json.JSONDecodeError, TypeError):
                current_validations = {}
        
        # Build the HTML for the widget
        widget_html = f'''
        <div class="subfield-validation-container" style="border: 1px solid #ddd; padding: 15px; background: #000000; border-radius: 4px;">
            <h4 style="margin-top: 0; color: white;">Subfield Validation Rules</h4>
            <p style="color: white; font-size: 12px; margin-bottom: 15px;">
                Configure validation for each input field. Only applies to Form Fields questions with subfields.
            </p>
            
            <div id="validation-rules-container">
                <!-- Existing rules will be populated here by JavaScript -->
            </div>
            
            <div style="margin-top: 10px;">
                <button type="button" id="add-validation-rule" class="button" style="padding: 10px; border-radius: 5px; background: #28a745; border-color: #28a745;">
                    Add Validation Rule
                </button>
                <button type="button" id="auto-populate-fields" class="button" style="margin-left: 10px; background: #28a745; border-color: #28a745; padding: 10px; border-radius: 5px;">
                    Auto-Populate from Subfields
                </button>
                <button type="button" id="clear-all-rules" class="button" style="margin-left: 10px; background: #dc3545; border-color: #dc3545; padding: 10px; border-radius: 5px;">
                    Clear All Rules
                </button>
            </div>
            
            <input type="hidden" name="{name}" id="id_{name}" value='{json.dumps(current_validations)}' />
        </div>
        
        <script type="text/javascript">
        (function() {{
            const container = document.getElementById('validation-rules-container');
            const hiddenInput = document.getElementById('id_{name}');
            const addButton = document.getElementById('add-validation-rule');
            const autoPopulateButton = document.getElementById('auto-populate-fields');
            const clearAllButton = document.getElementById('clear-all-rules');
            
            const validationTypes = [
                ['positive_number', 'Positive Numbers Only (e.g., 100, 25.5)'],
                ['negative_number', 'Negative Numbers Only (e.g., -50, -10.2)'],
                ['all_numbers', 'Any Numbers (positive, negative, or zero)'],
                ['email', 'Email Address'],
                ['text', 'Text (any input)'],
                ['auto_calculate', 'Auto-Calculate (read-only field)']
            ];
            
            let ruleCounter = 0;
            
            function updateHiddenInput() {{
                const rules = {{}};
                container.querySelectorAll('.validation-rule-row').forEach(row => {{
                    const fieldName = row.querySelector('.field-name').value.trim();
                    const fieldType = row.querySelector('.field-type').value;
                    const isRequired = row.querySelector('.field-required').checked;
                    
                    if (fieldName && fieldType) {{
                        rules[fieldName] = {{
                            type: fieldType,
                            required: isRequired
                        }};
                        
                        if (fieldType === 'auto_calculate') {{
                            rules[fieldName].formula = 'sum_all_previous';
                        }}
                    }}
                }});
                hiddenInput.value = JSON.stringify(rules);
            }}
            
            function createRuleRow(fieldName = '', fieldType = 'text', isRequired = true) {{
                const row = document.createElement('div');
                row.className = 'validation-rule-row';
                row.style.cssText = 'display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding: 10px; background: black; border: 1px solid #ddd; border-radius: 4px;';
                
                const typeOptions = validationTypes.map(([value, label]) => 
                    `<option value="${{value}}" ${{fieldType === value ? 'selected' : ''}}>${{label}}</option>`
                ).join('');
                
                row.innerHTML = `
                    <div style="flex: 2; margin-right: 10px;">
                        <label style="display: block; font-weight: bold; margin-bottom: 3px; font-size: 11px;">Field Name:</label>
                        <input type="text" class="field-name" value="${{fieldName}}" placeholder="Enter field name..." 
                               style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px;" />
                    </div>
                    <div style="flex: 2;">
                        <label style="display: block; font-weight: bold; margin-bottom: 3px; font-size: 11px;">Validation Type:</label>
                        <select class="field-type" style="width: 100%; padding: 4px; border: 1px solid #ccc; border-radius: 3px;">
                            ${{typeOptions}}
                        </select>
                    </div>
                    <div style="flex: 1;">
                        <label style="display: block; font-weight: bold; margin-bottom: 3px; font-size: 11px;">Required:</label>
                        <input type="checkbox" class="field-required" ${{isRequired ? 'checked' : ''}} 
                               style="transform: scale(1.2); margin-top: 8px;" />
                    </div>
                    <div style="flex: 0;">
                        <button type="button" class="remove-rule" style="background: #dc3545; color: white; border: none; padding: 6px 10px; border-radius: 3px; cursor: pointer; margin-top: 18px;">
                            Remove
                        </button>
                    </div>
                `;
                
                // Add event listeners
                row.querySelector('.field-name').addEventListener('input', updateHiddenInput);
                row.querySelector('.field-type').addEventListener('change', function() {{
                    updateHiddenInput();
                    // If auto-calculate is selected, uncheck required
                    if (this.value === 'auto_calculate') {{
                        row.querySelector('.field-required').checked = false;
                        row.querySelector('.field-required').disabled = true;
                    }} else {{
                        row.querySelector('.field-required').disabled = false;
                    }}
                }});
                row.querySelector('.field-required').addEventListener('change', updateHiddenInput);
                row.querySelector('.remove-rule').addEventListener('click', function() {{
                    row.remove();
                    updateHiddenInput();
                }});
                
                return row;
            }}
            
            // Add button click handler
            addButton.addEventListener('click', function() {{
                const row = createRuleRow();
                container.appendChild(row);
            }});
            
            // Auto-populate button handler
            autoPopulateButton.addEventListener('click', function() {{
                // Get subfields from the subfields textarea
                const subfieldsTextarea = document.querySelector('textarea[name="subfields"]');
                if (!subfieldsTextarea || !subfieldsTextarea.value.trim()) {{
                    alert('Please first add subfields to the "Subfields" field above, then use this auto-populate feature.');
                    return;
                }}
                
                try {{
                    const subfields = JSON.parse(subfieldsTextarea.value);
                    if (!Array.isArray(subfields)) {{
                        alert('Subfields must be a JSON array format like: ["Field 1", "Field 2", "Field 3"]');
                        return;
                    }}
                    
                    // Clear existing rules
                    container.innerHTML = '';
                    
                    // Add a rule for each subfield with smart defaults
                    subfields.forEach(fieldName => {{
                        let defaultType = 'text';
                        let isRequired = true;
                        
                        // Smart defaults based on field name
                        const lowerName = fieldName.toLowerCase();
                        if (lowerName.includes('email')) {{
                            defaultType = 'email';
                        }} else if (lowerName.includes('total') || lowerName.includes('sum')) {{
                            defaultType = 'auto_calculate';
                            isRequired = false;
                        }} else if (lowerName.includes('number') || lowerName.includes('count') || lowerName.includes('amount')) {{
                            defaultType = 'positive_number';
                        }} else if (lowerName.includes('less') || lowerName.includes('minus') || lowerName.includes('deduct')) {{
                            defaultType = 'negative_number';
                        }} else if (lowerName.includes('age') || lowerName.includes('year') || lowerName.includes('score')) {{
                            defaultType = 'all_numbers';
                        }}
                        
                        const row = createRuleRow(fieldName, defaultType, isRequired);
                        container.appendChild(row);
                    }});
                    
                    updateHiddenInput();
                    alert(`Successfully created validation rules for ${{subfields.length}} fields with smart defaults!`);
                }} catch (e) {{
                    alert('Error parsing subfields. Please ensure they are in valid JSON array format like: ["Field 1", "Field 2"]');
                }}
            }});
            
            // Clear all button handler
            clearAllButton.addEventListener('click', function() {{
                if (confirm('Are you sure you want to remove all validation rules?')) {{
                    container.innerHTML = '';
                    updateHiddenInput();
                }}
            }});
            
            // Load existing rules
            const existingRules = {json.dumps(current_validations)};
            Object.entries(existingRules).forEach(([fieldName, validation]) => {{
                const row = createRuleRow(
                    fieldName, 
                    validation.type || 'text', 
                    validation.required !== false
                );
                container.appendChild(row);
            }});
            
            // If no existing rules, add one empty row as example
            if (Object.keys(existingRules).length === 0) {{
                const exampleRow = createRuleRow('', 'text', true);
                container.appendChild(exampleRow);
            }}
        }})();
        </script>
        '''
        
        return mark_safe(widget_html)
    
    def value_from_datadict(self, data, files, name):
        value = data.get(name, '{}')
        try:
            # If it's already a string, return it as-is (Django JSONField expects a string)
            if isinstance(value, str):
                # Validate that it's proper JSON by parsing and re-serializing
                parsed = json.loads(value)
                return json.dumps(parsed)
            # If it's a dict, convert to JSON string
            elif isinstance(value, dict):
                return json.dumps(value)
            else:
                return '{}'
        except (json.JSONDecodeError, TypeError):
            return '{}'

class QuestionAdminForm(forms.ModelForm):
    # Override secondary_type to be a ChoiceField with all possible choices
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        
        # Collect all possible secondary choices from all primary types for the dropdown
        all_secondary_choices = [('', '---------')]
        for primary_type, choices in QUESTION_HIERARCHY.items():
            for choice in choices:
                if choice not in all_secondary_choices:
                    all_secondary_choices.append(choice)
        
        # Replace the CharField with a ChoiceField
        self.fields['secondary_type'] = forms.ChoiceField(
            choices=all_secondary_choices,
            required=False,
            help_text=(
                "Choose a secondary type that matches your selected primary type. "
                "Open Text: text, paragraph, number, email, date, time. "
                "Form: multiple_choices, radio, dropdown, form_fields, fields, yes_no. "
                "Grid: grid_radio, grid_multi, ranking."
            )
        )
        
        # Add custom widget for subfield validations
        if 'subfield_validations' in self.fields:
            self.fields['subfield_validations'].widget = SubfieldValidationWidget()
            self.fields['subfield_validations'].help_text = mark_safe(
                "<strong>Easy Form Builder:</strong> Use the form below to set validation rules for each field. "
                "No technical knowledge required!"
            )
        
    
    class Meta:
        model = Question
        fields = '__all__'
    
    def clean(self):
        cleaned_data = super().clean()
        primary_type = cleaned_data.get('primary_type')
        secondary_type = cleaned_data.get('secondary_type')
        subfield_validations = cleaned_data.get('subfield_validations')
        
        if primary_type and secondary_type:
            valid_secondaries = QUESTION_HIERARCHY.get(primary_type, [])
            valid_secondary_keys = [s[0] for s in valid_secondaries]
            valid_secondary_labels = [f"{s[0]} ({s[1]})" for s in valid_secondaries]
            
            if secondary_type not in valid_secondary_keys:
                primary_labels = {
                    'open_text': 'Open Text',
                    'form': 'Form', 
                    'grid': 'Grid'
                }
                primary_label = primary_labels.get(primary_type, primary_type)
                
                raise forms.ValidationError({
                    'secondary_type': f"The secondary type '{secondary_type}' is not valid for primary type '{primary_label}'. "
                                    f"Valid options for '{primary_label}' are: {', '.join(valid_secondary_labels)}."
                })
        
        # Validate subfield_validations JSON format
        if subfield_validations:
            try:
                if isinstance(subfield_validations, str):
                    parsed = json.loads(subfield_validations)
                else:
                    parsed = subfield_validations
                
                # Validate structure (simplified validation - the widget handles most of this)
                valid_types = ['positive_number', 'negative_number', 'all_numbers', 'email', 'text', 'auto_calculate']
                for field_name, validation in parsed.items():
                    if not isinstance(validation, dict):
                        raise forms.ValidationError({
                            'subfield_validations': f"There's an issue with the validation rule for '{field_name}'. Please use the form builder above."
                        })
                    
                    field_type = validation.get('type')
                    if field_type and field_type not in valid_types:
                        raise forms.ValidationError({
                            'subfield_validations': f"The validation type '{field_type}' for field '{field_name}' is not supported. Please use the dropdown options in the form builder."
                        })
                        
            except json.JSONDecodeError as e:
                raise forms.ValidationError({
                    'subfield_validations': f"Invalid JSON format: {str(e)}"
                })
        
        return cleaned_data

@admin.register(Survey)
class SurveyAdmin(admin.ModelAdmin):
    list_display = ['title', 'created_at', 'updated_at', 'is_active']
    list_filter = ['is_active', 'created_at']
    search_fields = ['title', 'description']
    readonly_fields = ['created_at', 'updated_at']

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    form = QuestionAdminForm
    list_display = ['question_text', 'survey', 'primary_type', 'secondary_type', 'is_required', 'has_none_option', 'has_other_option', 'order']
    list_filter = ['primary_type', 'secondary_type', 'is_required', 'has_none_option', 'has_other_option', 'survey']
    search_fields = ['question_text', 'survey__title']
    ordering = ['survey', 'order']
    
    class Media:
        js = ('admin/js/question_admin.js',)

class QuestionResponseInline(admin.TabularInline):
    model = QuestionResponse
    readonly_fields = ['question', 'answer', 'answer_type', 'created_at']
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
            question__secondary_type='email'
        ).first()
        if email_response and email_response.answer_type == 'email':
            return email_response.answer
        return "No email"
    get_email.short_description = 'Email'
    get_email.admin_order_field = 'question_responses__answer'
    
    def get_name(self, obj):
        """Extract name from question responses (assuming first text question might be name)"""
        name_response = obj.question_responses.filter(
            question__secondary_type='text'
        ).first()
        if name_response and name_response.answer_type == 'text':
            name = str(name_response.answer).strip()
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
    list_display = ['question', 'survey_response', 'get_answer_display', 'answer_type', 'created_at']
    list_filter = ['question__primary_type', 'question__secondary_type', 'created_at']
    search_fields = ['question__question_text', 'answer']
    readonly_fields = ['survey_response', 'question', 'answer', 'answer_type', 'created_at']
    
    def get_answer_display(self, obj):
        if obj.answer_type in ['text', 'email', 'number']:
            return str(obj.answer)[:50] + '...' if len(str(obj.answer)) > 50 else str(obj.answer)
        elif obj.answer_type == 'rating':
            return f"Rating: {obj.answer}"
        elif obj.answer_type in ['multiple_choice', 'checkbox']:
            if isinstance(obj.answer, list):
                return f"Choices: {', '.join(map(str, obj.answer))}"
            return f"Choice: {obj.answer}"
        return "No answer"
    get_answer_display.short_description = 'Answer'
    
    def has_add_permission(self, request):
        return False  # Responses should only be created via API
