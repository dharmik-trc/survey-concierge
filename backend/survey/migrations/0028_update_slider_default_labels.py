# Generated manually to update slider default labels

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('survey', '0027_add_slider_scale_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='question',
            name='scale_min_label',
            field=models.CharField(blank=True, default='Not at all likely', help_text='Label for minimum value', max_length=100),
        ),
        migrations.AlterField(
            model_name='question',
            name='scale_max_label',
            field=models.CharField(blank=True, default='Extremely likely', help_text='Label for maximum value', max_length=100),
        ),
    ]


