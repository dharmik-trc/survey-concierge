from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import openpyxl
import io

# Create your views here.

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
