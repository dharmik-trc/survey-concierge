"""
Excel Building Utilities

This module contains functions for building and formatting Excel workbooks.
"""

import json
import openpyxl
from openpyxl.styles import Alignment

from .excel_styles import create_excel_styles


def build_excel_headers(ws, all_questions, question_subfields, styles):
    """
    Build two-row header structure for Excel worksheet.
    
    Creates a professional two-row header where:
    - Row 1: Main question headers (merged across sub-columns if applicable)
    - Row 2: Sub-column headers for questions with multiple fields
    
    Args:
        ws: Worksheet object
        all_questions: QuerySet or list of Question objects
        question_subfields: Dict mapping question_id to list of subfield names
        styles: Dict of style objects from create_excel_styles()
    
    Returns:
        tuple: (question_column_map, is_completed_col, last_activity_col)
            - question_column_map: Dict mapping question IDs to column indices
            - is_completed_col: Column index for "Is Completed" field
            - last_activity_col: Column index for "Last Activity" field
    """
    question_column_map = {}
    col_num = 2  # Start at column 2 (column 1 is for session number)
    question_num = 0
    
    # Number column header (spans both rows)
    ws.merge_cells(start_row=1, start_column=1, end_row=2, end_column=1)
    cell = ws.cell(row=1, column=1)
    cell.value = "#"
    cell.fill = styles['header_fill']
    cell.font = styles['header_font']
    cell.alignment = styles['header_alignment']
    ws.cell(row=2, column=1).fill = styles['header_fill']
    
    # Question columns
    for question in all_questions:
        question_num += 1
        question_text = question.question_text
        
        if question.id in question_subfields:
            # Question with sub-columns
            subfields = question_subfields[question.id]
            start_col = col_num
            end_col = col_num + len(subfields) - 1
            question_column_map[question.id] = {}
            
            # Row 1: Merged main question header
            ws.merge_cells(start_row=1, start_column=start_col, end_row=1, end_column=end_col)
            main_cell = ws.cell(row=1, column=start_col)
            main_cell.value = f"Q{question_num}: {question_text}"
            main_cell.fill = styles['header_fill']
            main_cell.font = styles['header_font']
            main_cell.alignment = styles['header_alignment']
            
            # Style all merged cells
            for col in range(start_col, end_col + 1):
                ws.cell(row=1, column=col).fill = styles['header_fill']
            
            # Row 2: Sub-column headers
            for subfield in subfields:
                subfield_display = subfield.replace('_', ' ').title()
                cell = ws.cell(row=2, column=col_num)
                cell.value = subfield_display
                cell.fill = styles['subheader_fill']
                cell.font = styles['subheader_font']
                cell.alignment = styles['header_alignment']
                question_column_map[question.id][subfield] = col_num
                col_num += 1
        else:
            # Simple question - single column spanning both rows
            ws.merge_cells(start_row=1, start_column=col_num, end_row=2, end_column=col_num)
            cell = ws.cell(row=1, column=col_num)
            cell.value = f"Q{question_num}: {question_text}"
            cell.fill = styles['header_fill']
            cell.font = styles['header_font']
            cell.alignment = styles['header_alignment']
            ws.cell(row=2, column=col_num).fill = styles['header_fill']
            question_column_map[question.id] = {'_main': col_num}
            col_num += 1
    
    # Status columns
    is_completed_col = col_num
    last_activity_col = col_num + 1
    
    # Is Completed column
    ws.merge_cells(start_row=1, start_column=is_completed_col, end_row=2, end_column=is_completed_col)
    cell = ws.cell(row=1, column=is_completed_col)
    cell.value = "Is Completed"
    cell.fill = styles['header_fill']
    cell.font = styles['header_font']
    cell.alignment = styles['header_alignment']
    ws.cell(row=2, column=is_completed_col).fill = styles['header_fill']
    
    # Last Activity column
    ws.merge_cells(start_row=1, start_column=last_activity_col, end_row=2, end_column=last_activity_col)
    cell = ws.cell(row=1, column=last_activity_col)
    cell.value = "Last Activity"
    cell.fill = styles['header_fill']
    cell.font = styles['header_font']
    cell.alignment = styles['header_alignment']
    ws.cell(row=2, column=last_activity_col).fill = styles['header_fill']
    
    return question_column_map, is_completed_col, last_activity_col


def write_answer_to_cell(ws, row_num, col_idx, value, alignment):
    """
    Write a value to a cell with proper formatting.
    
    Handles conversion of various data types (lists, dicts, primitives) to string format.
    
    Args:
        ws: Worksheet object
        row_num: Row number to write to
        col_idx: Column index to write to
        value: Value to write (can be list, dict, string, number, etc.)
        alignment: Alignment object for the cell
    
    Returns:
        Cell: The modified cell object
    """
    if isinstance(value, list):
        value_str = ', '.join([str(item) for item in value])
    elif isinstance(value, dict):
        value_str = json.dumps(value, ensure_ascii=False)
    else:
        value_str = str(value)
    
    cell = ws.cell(row=row_num, column=col_idx, value=value_str)
    cell.alignment = alignment
    return cell


def write_complex_answer(ws, row_num, answer, col_map, alignment):
    """
    Handle writing complex dict answers to multiple sub-columns.
    
    This function handles different types of complex answers:
    - Regular dict: Spread values across sub-columns
    - Comment+answer dict: Handle nested structure
    - Non-dict in dict columns: Put value in first column
    
    Args:
        ws: Worksheet object
        row_num: Row number to write to
        answer: The answer value (expected to be dict, but handles other types)
        col_map: Dict mapping subfield names to column indices
        alignment: Alignment object for cells
    """
    if not isinstance(answer, dict):
        # Answer is not a dict but question has sub-columns
        # Put entire answer in first sub-column
        first_col_idx = list(col_map.values())[0]
        write_answer_to_cell(ws, row_num, first_col_idx, answer, alignment)
        # Fill other columns with empty
        for i, col_idx in enumerate(col_map.values()):
            if i > 0:
                ws.cell(row=row_num, column=col_idx, value='')
    elif 'answer' in answer and 'comment' in answer:
        # Comment+answer structure (e.g., from comment box questions)
        inner_answer = answer.get('answer')
        comment = answer.get('comment', '')
        
        if isinstance(inner_answer, dict):
            for subfield, col_idx in col_map.items():
                value = comment if subfield == 'comment' else inner_answer.get(subfield, '')
                write_answer_to_cell(ws, row_num, col_idx, value if value else '', alignment)
        else:
            for subfield, col_idx in col_map.items():
                if subfield == 'answer':
                    value = inner_answer
                elif subfield == 'comment':
                    value = comment
                else:
                    value = ''
                write_answer_to_cell(ws, row_num, col_idx, value if value else '', alignment)
    else:
        # Regular dict answer (e.g., form fields, grid responses)
        for subfield, col_idx in col_map.items():
            value = answer.get(subfield, '')
            write_answer_to_cell(ws, row_num, col_idx, value if value else '', alignment)


def write_data_rows(ws, sessions, all_questions, question_column_map, is_completed_col, last_activity_col, styles):
    """
    Write all data rows to the worksheet.
    
    Args:
        ws: Worksheet object
        sessions: Dict of session data
        all_questions: List of Question objects
        question_column_map: Dict mapping question IDs to column indices
        is_completed_col: Column index for "Is Completed"
        last_activity_col: Column index for "Last Activity"
        styles: Dict of style objects
    """
    row_num = 3  # Start at row 3 (after two-row header)
    session_num = 0
    alignment = Alignment(wrap_text=True, vertical="top")
    
    for session_id, session_data in sessions.items():
        session_num += 1
        ws.cell(row=row_num, column=1, value=session_num)
        
        # Fill in answers for each question
        for question in all_questions:
            answer = session_data['questions'].get(question.id)
            col_map = question_column_map[question.id]
            
            if answer is not None:
                if '_main' in col_map:
                    # Simple question - single column
                    write_answer_to_cell(ws, row_num, col_map['_main'], answer, alignment)
                else:
                    # Complex question - multiple sub-columns
                    write_complex_answer(ws, row_num, answer, col_map, alignment)
            else:
                # Empty answer - fill with empty strings
                if '_main' in col_map:
                    ws.cell(row=row_num, column=col_map['_main'], value='')
                else:
                    for col_idx in col_map.values():
                        ws.cell(row=row_num, column=col_idx, value='')
        
        # Is Completed status with color coding
        is_completed_cell = ws.cell(row=row_num, column=is_completed_col)
        is_completed_cell.value = "Yes" if session_data['is_completed'] else "No"
        is_completed_cell.fill = styles['completed_fill'] if session_data['is_completed'] else styles['incomplete_fill']
        
        # Last Activity timestamp
        last_activity_cell = ws.cell(row=row_num, column=last_activity_col)
        last_activity_cell.value = session_data['last_activity'].strftime('%Y-%m-%d %H:%M:%S')
        
        row_num += 1


def format_worksheet(ws, last_activity_col):
    """
    Apply formatting to the worksheet (column widths, row heights, freeze panes).
    
    Args:
        ws: Worksheet object
        last_activity_col: Index of the last column with data
    """
    # Column widths
    ws.column_dimensions['A'].width = 8  # Number column (narrow)
    for col_idx in range(2, last_activity_col + 1):
        col_letter = openpyxl.utils.get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = 25
    
    # Row heights for headers
    ws.row_dimensions[1].height = 30  # Main header row
    ws.row_dimensions[2].height = 25  # Sub-header row
    
    # Freeze first two rows (headers) and first column (session numbers)
    ws.freeze_panes = 'A3'


def create_worksheet_with_data(wb, sheet_name, sessions, all_questions, question_subfields, styles):
    """
    Create a complete worksheet with headers, data, and formatting.
    
    This is the main orchestration function that combines all worksheet building steps.
    
    Args:
        wb: Workbook object
        sheet_name: Name for the worksheet
        sessions: Dict of session data to include
        all_questions: List of Question objects
        question_subfields: Dict mapping question IDs to subfield names
        styles: Dict of style objects
    
    Returns:
        Worksheet: The created and populated worksheet object
    """
    ws = wb.create_sheet(title=sheet_name)
    
    # Build headers
    question_column_map, is_completed_col, last_activity_col = build_excel_headers(
        ws, all_questions, question_subfields, styles
    )
    
    # Write data rows
    write_data_rows(ws, sessions, all_questions, question_column_map, 
                    is_completed_col, last_activity_col, styles)
    
    # Format worksheet
    format_worksheet(ws, last_activity_col)
    
    return ws


def create_empty_sheet(wb, sheet_name, message="No data found"):
    """
    Create an empty worksheet with a message.
    
    Args:
        wb: Workbook object
        sheet_name: Name for the worksheet
        message: Message to display in the sheet
    
    Returns:
        Worksheet: The created worksheet
    """
    ws = wb.create_sheet(title=sheet_name)
    styles = create_excel_styles()
    
    cell = ws.cell(row=1, column=1, value=message)
    cell.fill = styles['header_fill']
    cell.font = styles['header_font']
    cell.alignment = styles['header_alignment']
    ws.column_dimensions['A'].width = 40
    
    return ws

