from django.urls import path
from .views import (
    upload_excel, 
    survey_list, 
    survey_detail, 
    questions_by_survey, 
    question_detail,
    submit_survey_response
)

urlpatterns = [
    path('upload_excel/', upload_excel, name='upload_excel'),
    path('surveys/', survey_list, name='survey_list'),
    path('surveys/<uuid:survey_id>/', survey_detail, name='survey_detail'),
    path('surveys/<uuid:survey_id>/questions/', questions_by_survey, name='questions_by_survey'),
    path('surveys/<uuid:survey_id>/questions/<int:question_id>/', question_detail, name='question_detail'),
    path('surveys/<uuid:survey_id>/submit/', submit_survey_response, name='submit_survey_response'),
] 