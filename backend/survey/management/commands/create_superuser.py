from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
import os

class Command(BaseCommand):
    help = 'Create a superuser for admin access'

    def handle(self, *args, **options):
        username = os.getenv('ADMIN_USERNAME', 'admin')
        email = os.getenv('ADMIN_EMAIL', 'admin@example.com')
        password = os.getenv('ADMIN_PASSWORD', '123')
        
        self.stdout.write(f'Creating superuser with username: {username}')
        self.stdout.write(f'Email: {email}')
        self.stdout.write(f'Password set: {"Yes" if password else "No"}')
        
        if User.objects.filter(username=username).exists():
            self.stdout.write(
                self.style.WARNING(f'Superuser "{username}" already exists')
            )
            # Update password for existing user
            user = User.objects.get(username=username)
            user.set_password(password)
            user.save()
            self.stdout.write(
                self.style.SUCCESS(f'Updated password for existing superuser "{username}"')
            )
        else:
            User.objects.create_superuser(username, email, password)
            self.stdout.write(
                self.style.SUCCESS(f'Successfully created superuser "{username}"')
            )