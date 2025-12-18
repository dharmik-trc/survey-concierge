from django.core.management.base import BaseCommand
from survey.models import Survey, Question

class Command(BaseCommand):
    help = 'Create sample survey data for testing'

    def handle(self, *args, **options):
        # Create a sample survey
        survey, created = Survey.objects.get_or_create(
            title="Customer Satisfaction Survey",
            defaults={
                'description': 'A comprehensive survey to gather customer feedback about our products and services.',
                'is_active': True
            }
        )
        
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created survey: {survey.title}'))
        else:
            self.stdout.write(self.style.WARNING(f'Survey already exists: {survey.title}'))

        # Create sample questions
        questions_data = [
            {
                'question_text': 'How satisfied are you with our product?',
                'question_type': 'rating',
                'is_required': True,
                'order': 1
            },
            {
                'question_text': 'What is your age group?',
                'question_type': 'multiple_choice',
                'is_required': True,
                'order': 2,
                'options': ['18-25', '26-35', '36-45', '46-55', '55+']
            },
            {
                'question_text': 'Which features do you use most often? (Select all that apply)',
                'question_type': 'checkbox',
                'is_required': False,
                'order': 3,
                'options': ['Feature A', 'Feature B', 'Feature C', 'Feature D', 'Feature E']
            },
            {
                'question_text': 'Please provide any additional comments or suggestions:',
                'question_type': 'text',
                'is_required': False,
                'order': 4
            },
            {
                'question_text': 'What is your email address for follow-up?',
                'question_type': 'email',
                'is_required': False,
                'order': 5
            },
            {
                'question_text': 'How many times have you used our service in the past month?',
                'question_type': 'number',
                'is_required': True,
                'order': 6
            },
            {
                'question_text': 'Revenue of your association in GBP based on your latest approved financial statements:',
                'question_type': 'form_fields',
                'is_required': True,
                'order': 7,
                'subfields': [
                    'Membership subscriptions',
                    'Sponsorship/partnership',
                    'Training/accreditations',
                    'Other',
                    'TOTAL REVENUE'
                ]
            },
            {
                'question_text': 'Which of the following membership benefits does your association offer to its members? Please select all that apply.',
                'question_type': 'checkbox',
                'is_required': True,
                'order': 8,
                'options': [
                    'Events and conferences',
                    'Access to supplier directory',
                    'Awards',
                    'Newsletter/publication',
                    'Research and insights',
                    'Legal support',
                    'Other, please specify',
                    'Insurance',
                    'Policy and lobbying',
                    'Mentoring and career support',
                    'Discounts/referral with approved suppliers/partners'
                ]
            },
            {
                'question_text': 'By what percent(%) were salary increases awarded or budgeted for the following in 2024?',
                'question_type': 'cross_matrix',
                'is_required': True,
                'order': 30,
                'rows': [
                    'CEO or similar',
                    'Level 1 - Director or Senior Executive',
                    'Level 2 - Senior Management',
                    'Level 3 - Middle Management',
                    'Level 4 - Junior Management',
                    'Level 5 - Team Administrator'
                ],
                'columns': [
                    '0 to 2.5%',
                    '2.6 to 5%',
                    '5.1 to 7.5%',
                    '7.6 to 10%',
                    '>10%',
                    "Unsure/don't know",
                    'No salary increases'
                ]
            },
            {
                'question_text': 'Which benefits apply to each job level? (Select all that apply)',
                'question_type': 'cross_matrix_checkbox',
                'is_required': True,
                'order': 31,
                'rows': [
                    'CEO or similar',
                    'Level 1 - Director or Senior Executive',
                    'Level 2 - Senior Management',
                    'Level 3 - Middle Management',
                    'Level 4 - Junior Management',
                    'Level 5 - Team Administrator'
                ],
                'columns': [
                    'Private healthcare',
                    'Company car',
                    'Bonus',
                    'Flexible working',
                    'Remote work',
                    'Other'
                ]
            },
        ]

        for question_data in questions_data:
            question, created = Question.objects.get_or_create(
                survey=survey,
                question_text=question_data['question_text'],
                defaults=question_data
            )
            
            if created:
                self.stdout.write(self.style.SUCCESS(f'Created question: {question.question_text[:50]}...'))
            else:
                self.stdout.write(self.style.WARNING(f'Question already exists: {question.question_text[:50]}...'))

        self.stdout.write(self.style.SUCCESS('Sample survey data created successfully!')) 