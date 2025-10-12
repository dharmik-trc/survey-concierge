# Generated manually for slider/scale question type

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('survey', '0026_alter_question_comment_box_label_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='question',
            name='scale_min',
            field=models.IntegerField(default=0, help_text='Minimum value for slider/scale (e.g., 0 for NPS)'),
        ),
        migrations.AddField(
            model_name='question',
            name='scale_max',
            field=models.IntegerField(default=10, help_text='Maximum value for slider/scale (e.g., 10 for NPS)'),
        ),
        migrations.AddField(
            model_name='question',
            name='scale_step',
            field=models.IntegerField(default=1, help_text='Step increment for slider (e.g., 1 for whole numbers)'),
        ),
        migrations.AddField(
            model_name='question',
            name='scale_min_label',
            field=models.CharField(blank=True, help_text='Label for minimum value (e.g., "Not at all likely")', max_length=100, null=True),
        ),
        migrations.AddField(
            model_name='question',
            name='scale_max_label',
            field=models.CharField(blank=True, help_text='Label for maximum value (e.g., "Extremely likely")', max_length=100, null=True),
        ),
    ]


