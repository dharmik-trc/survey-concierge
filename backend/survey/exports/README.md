# Survey Response Export Module

This module handles exporting survey responses to various formats (currently Excel, with potential for CSV, PDF, etc. in the future).

## 📁 Structure

```
exports/
├── __init__.py           # Package initialization, exports main functions
├── README.md            # This file - documentation
├── views.py             # Main API endpoint for downloading responses
├── data_collector.py    # Data collection and analysis utilities
├── excel_builder.py     # Excel workbook building and formatting
└── excel_styles.py      # Styling constants and utilities
```

## 📄 File Descriptions

### `views.py`

**Purpose**: Main API endpoint  
**Key Function**: `export_survey_responses(request, survey_id)`

- Orchestrates the entire export process
- Returns Excel file with 3 tabs: Partial, Completed, All
- Handles error responses and edge cases

### `data_collector.py`

**Purpose**: Data collection and organization  
**Key Functions**:

- `collect_session_data(survey)` - Gather partial responses by session
- `merge_completed_responses(...)` - Merge complete survey submissions
- `analyze_question_subfields(sessions)` - Identify questions needing sub-columns
- `filter_sessions_by_completion(sessions)` - Split partial vs completed

**Use Cases**:

- When you need to add new data sources
- When modifying how sessions are grouped
- When changing completion logic

### `excel_builder.py`

**Purpose**: Excel workbook construction  
**Key Functions**:

- `create_worksheet_with_data(...)` - Main worksheet creation orchestrator
- `build_excel_headers(...)` - Create two-row header structure
- `write_data_rows(...)` - Populate worksheet with session data
- `write_complex_answer(...)` - Handle multi-column questions
- `format_worksheet(...)` - Apply formatting (widths, freeze panes, etc.)

**Use Cases**:

- When modifying Excel layout or styling
- When adding new column types
- When changing header structure

### `excel_styles.py`

**Purpose**: Styling utilities and constants  
**Key Function**: `create_excel_styles()`

Returns dict with:

- `header_fill` - Dark indigo for main headers
- `subheader_fill` - Light indigo for sub-headers
- `header_font` - Bold white text
- `completed_fill` - Light green for completed responses
- `incomplete_fill` - Light yellow for partial responses

**Use Cases**:

- When updating colors or fonts
- When adding new style types
- When reusing styles in other export formats

## 🚀 Usage Example

### As an API Endpoint

```python
# Already configured in urls.py
GET /api/survey/surveys/{survey_id}/responses/export/
```

### Programmatically

```python
from survey.exports import export_survey_responses

# Use in another view or management command
response = export_survey_responses(request, survey_id)
```

## 🔧 Adding New Export Formats

To add a new export format (e.g., CSV, PDF):

1. **Create new builder file**: `csv_builder.py` or `pdf_builder.py`
2. **Add format-specific functions**: Follow same pattern as `excel_builder.py`
3. **Create new view function**: In `views.py` or separate file
4. **Update `__init__.py`**: Export the new function
5. **Add URL pattern**: In `urls.py`

Example structure:

```python
# csv_builder.py
def create_csv_response(sessions, questions):
    # Build CSV content
    pass

# views.py
@api_view(['GET'])
def export_csv_responses(request, survey_id):
    # Use data_collector functions
    sessions, _ = collect_session_data(survey)
    # Use csv_builder
    return create_csv_response(sessions, questions)
```

## 🎯 Key Features

1. **Three Tab Structure**

   - Partial Responses: Incomplete sessions only
   - Completed Responses: Finished sessions only
   - All Responses: Everything combined

2. **Smart Column Handling**

   - Automatically detects complex questions (forms, grids)
   - Creates sub-columns for dictionary/object answers
   - Two-row header: Main question + sub-fields

3. **Sequential Question Numbering**

   - Questions numbered Q1, Q2, Q3... regardless of database IDs
   - Consistent across all tabs

4. **Color Coding**

   - Green fill for completed sessions
   - Yellow fill for partial sessions

5. **Professional Formatting**
   - Frozen headers for easy scrolling
   - Text wrapping enabled
   - Proper column widths

## 🧪 Testing Checklist

When modifying this module, test:

- [ ] Empty survey (no responses)
- [ ] Only partial responses
- [ ] Only completed responses
- [ ] Mix of partial and completed
- [ ] Questions with sub-fields (forms, grids)
- [ ] Questions with simple answers (text, single choice)
- [ ] Large datasets (100+ sessions)
- [ ] Special characters in answers
- [ ] Empty/null answers

## 📝 Code Style Guidelines

1. **Function Naming**

   - Public functions: `function_name()`
   - Private helpers: `_helper_function()`

2. **Documentation**

   - All functions have docstrings
   - Complex logic has inline comments
   - Args and Returns documented

3. **Error Handling**
   - Try-except blocks in main endpoints
   - Detailed error messages with tracebacks
   - Graceful degradation when possible

## 🔍 Common Maintenance Tasks

### Changing Colors

Edit `excel_styles.py` → `create_excel_styles()`

### Adding New Column

1. Modify `build_excel_headers()` in `excel_builder.py`
2. Update `write_data_rows()` to populate new column

### Changing Completion Logic

Edit `filter_sessions_by_completion()` in `data_collector.py`

### Modifying Question Numbering

Edit the loop in `build_excel_headers()` where `question_num` is incremented

## 🐛 Debugging Tips

1. **Enable detailed logging**:

   ```python
   import logging
   logger = logging.getLogger(__name__)
   logger.debug(f"Session data: {sessions}")
   ```

2. **Test with sample data**:

   ```python
   from django.test import TestCase
   from survey.exports.data_collector import collect_session_data
   ```

3. **Check intermediate results**:
   - After data collection: Print `sessions` dict
   - After analysis: Print `question_subfields` dict
   - Before Excel generation: Verify data structure

## 📚 Related Documentation

- Django REST Framework: https://www.django-rest-framework.org/
- OpenPyXL: https://openpyxl.readthedocs.io/
- Main Survey Models: `../models.py`
- API Documentation: `../../API_DOCUMENTATION.md`

## 👥 Contributing

When adding features:

1. Follow existing patterns and structure
2. Add docstrings to all new functions
3. Update this README with new functionality
4. Test thoroughly with various data scenarios
5. Consider backward compatibility

---

**Last Updated**: October 2025  
**Maintainer**: Survey Platform Team
