# Generated by Django 4.2.23 on 2025-07-22 20:13

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('survey', '0005_alter_question_question_type'),
    ]

    operations = [
        migrations.AlterField(
            model_name='questionresponse',
            name='answer_type',
            field=models.CharField(max_length=100),
        ),
    ]
