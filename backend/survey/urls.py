from django.urls import path

from .exports import (
    export_analytics,
    export_filtered_analytics,
    export_segmented_analytics,
    export_survey_responses,
    preview_filtered_analytics,
    preview_segmented_analytics,
)
from .views import (
    health_check,
    question_detail,
    questions_by_survey,
    save_partial_response,
    submit_survey_response,
    survey_detail,
    survey_list,
    upload_excel,
)

urlpatterns = [
    path("health/", health_check, name="health_check"),
    path("upload_excel/", upload_excel, name="upload_excel"),
    path("surveys/", survey_list, name="survey_list"),
    path("surveys/<uuid:survey_id>/", survey_detail, name="survey_detail"),
    path("surveys/<uuid:survey_id>/questions/", questions_by_survey, name="questions_by_survey"),
    path(
        "surveys/<uuid:survey_id>/questions/<int:question_id>/",
        question_detail,
        name="question_detail",
    ),
    path("surveys/<uuid:survey_id>/submit/", submit_survey_response, name="submit_survey_response"),
    path(
        "surveys/<uuid:survey_id>/questions/<int:question_id>/save-partial/",
        save_partial_response,
        name="save_partial_response",
    ),
    path(
        "surveys/<uuid:survey_id>/responses/export/",
        export_survey_responses,
        name="export_survey_responses",
    ),
    path("surveys/<uuid:survey_id>/analytics/export/", export_analytics, name="export_analytics"),
    path(
        "surveys/<uuid:survey_id>/analytics/export-segmented/",
        export_segmented_analytics,
        name="export_segmented_analytics",
    ),
    path(
        "surveys/<uuid:survey_id>/analytics/preview-segmented/",
        preview_segmented_analytics,
        name="preview_segmented_analytics",
    ),
    path(
        "surveys/<uuid:survey_id>/analytics/export-filtered/",
        export_filtered_analytics,
        name="export_filtered_analytics",
    ),
    path(
        "surveys/<uuid:survey_id>/analytics/preview-filtered/",
        preview_filtered_analytics,
        name="preview_filtered_analytics",
    ),
]
