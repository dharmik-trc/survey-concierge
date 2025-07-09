from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Creates a superuser with predefined credentials'

    def handle(self, *args, **options):
        username = 'admin'
        email = 'admin@gmail.com'
        password = '123'
        
        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.WARNING(f'Superuser "{username}" already exists.')
            )
            return
        
        user = User.objects.create_superuser(username, email, password)
        self.stdout.write(
            self.style.SUCCESS(f'Superuser "{username}" created successfully!')
        )
        self.stdout.write(f'Username: {username}')
        self.stdout.write(f'Password: {password}')
        self.stdout.write(f'Email: {email}')
        self.stdout.write(
            self.style.SUCCESS('You can now login at http://localhost:9000/admin/')
        ) 