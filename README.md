- combine all the answer one field and type of answer as different field
- hit the api on every next button click
- salary questions in the survey
- Give soft reminder to the user when total sum is 0 (for form numeric questions, example: 27 - salary)

# Survey Concierge - Professional Survey Platform

A modern, full-stack survey platform built with Next.js frontend and Django backend, featuring step-by-step survey forms, real-time validation, and comprehensive response tracking. Survey Concierge provides a professional solution for creating, managing, and analyzing surveys with a beautiful, branded interface.

## 🎨 Branding

Survey Concierge features a modern, professional design with:

- **Brand Colors**: Indigo to Purple gradient theme
- **Modern UI**: Clean, responsive design with smooth animations
- **Professional Logo**: Custom SVG icon with gradient branding
- **Consistent Styling**: Unified design language across all components
- **Accessibility**: WCAG compliant with proper focus states and contrast

## 🚀 Features

- **Step-by-Step Surveys**: One question at a time with progress tracking
- **Real-time Validation**: Email, number, and required field validation
- **Multiple Question Types**: Text, email, number, rating, multiple choice, checkbox
- **Response Tracking**: IP address, location, user agent tracking
- **Admin Panel**: Comprehensive response management with email display
- **Modern UI**: Built with Next.js 15 and Tailwind CSS
- **Professional Branding**: Custom Survey Concierge branding with gradient themes
- **Responsive Design**: Mobile-first approach with beautiful animations
- **RESTful API**: Django backend with PostgreSQL database
- **Docker Support**: Easy deployment with Docker and Docker Compose

## 🏗️ Architecture

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Backend**: Django 4.2 with REST API
- **Database**: PostgreSQL (development) / Configurable (production)
- **Containerization**: Docker with separate dev/prod configurations

## 📁 Project Structure

```
survey_platform/
├── frontend/                 # Next.js frontend application
│   ├── src/
│   │   ├── app/             # Next.js 15 app router
│   │   │   ├── survey/[id]/ # Dynamic survey pages
│   │   │   └── page.tsx     # Survey list page
│   │   └── lib/
│   │       └── api.ts       # API service
│   ├── Dockerfile.dev       # Development Dockerfile
│   ├── Dockerfile.prod      # Production Dockerfile
│   └── .env.local.example   # Frontend environment variables
├── backend/                  # Django backend application
│   ├── survey/              # Survey app with models and API
│   │   ├── models.py        # Survey, Question, SurveyResponse models
│   │   ├── views.py         # API endpoints
│   │   ├── serializers.py   # Data serialization
│   │   ├── admin.py         # Django admin configuration
│   │   └── management/      # Custom management commands
│   ├── Dockerfile.dev       # Development Dockerfile
│   ├── Dockerfile.prod      # Production Dockerfile
│   └── .env.example         # Backend environment variables
├── docker-compose.dev.yml   # Development environment
├── docker-compose.prod.yml  # Production environment
└── README.md               # This file
```

## 🛠️ Setup Instructions

### Prerequisites

- Docker and Docker Compose
- Git

### Quick Start

1. **Clone the repository**

   ```bash
   git clone <your-repo-url>
   cd survey_platform
   ```

2. **Start development environment**

   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

3. **Set up database and admin user**

   ```bash
   # Run migrations
   docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate

   # Create superuser (admin/123)
   docker-compose -f docker-compose.dev.yml exec backend python manage.py create_superuser
   ```

4. **Access the applications**
   - Frontend: http://localhost:4545
   - Backend API: http://localhost:9000
   - Django Admin: http://localhost:9000/admin/

## 🧪 Testing the Survey Platform

### 1. **View Available Surveys**

- Go to http://localhost:4545
- You'll see a list of all active surveys

### 2. **Take a Survey**

- Click on any survey from the list
- Or use direct URL: `http://localhost:4545/survey/{survey-id}`
- Answer questions one by one using Next/Previous navigation
- Submit the survey when complete

### 3. **Test Different Question Types**

- **Text**: Enter any text response
- **Email**: Must be valid email format (e.g., `test@example.com`)
- **Number**: Must be numeric values
- **Rating**: Click on 1-5 rating buttons
- **Multiple Choice**: Select one option
- **Checkbox**: Select multiple options

### 4. **Test Validation**

- Try submitting without answering required questions
- Enter invalid email formats
- Enter non-numeric values in number fields
- Test navigation between questions

### 5. **View Responses in Admin**

- Go to http://localhost:9000/admin/
- Login with: `admin` / `123`
- Click on "Survey responses"
- View submitted responses with email addresses and IP information

## 🔧 Development Commands

### Database Management

```bash
# Run migrations
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate

# Create superuser
docker-compose -f docker-compose.dev.yml exec backend python manage.py create_superuser

# Reset database (WARNING: Deletes all data)
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate
docker-compose -f docker-compose.dev.yml exec backend python manage.py create_superuser
```

### Django Management Commands

```bash
# Django shell
docker-compose -f docker-compose.dev.yml exec backend python manage.py shell

# Create sample survey
docker-compose -f docker-compose.dev.yml exec backend python manage.py create_sample_survey

# List all surveys
docker-compose -f docker-compose.dev.yml exec backend python manage.py shell -c "
from survey.models import Survey
for s in Survey.objects.all():
    print(f'ID: {s.id}, Title: {s.title}, Active: {s.is_active}')
"
```

### Container Management

```bash
# Start services
docker-compose -f docker-compose.dev.yml up --build

# Stop services
docker-compose -f docker-compose.dev.yml down

# Restart services
docker-compose -f docker-compose.dev.yml restart

# View logs
docker-compose -f docker-compose.dev.yml logs -f backend
docker-compose -f docker-compose.dev.yml logs -f frontend

# Execute commands in containers
docker-compose -f docker-compose.dev.yml exec backend python manage.py shell
docker-compose -f docker-compose.dev.yml exec frontend yarn add package-name
```

### Frontend Development

```bash
# Install new packages
docker-compose -f docker-compose.dev.yml exec frontend yarn add package-name

# Run frontend tests
docker-compose -f docker-compose.dev.yml exec frontend yarn test

# Build for production
docker-compose -f docker-compose.dev.yml exec frontend yarn build
```

## 📡 API Endpoints

### Survey API

- **GET** `/api/survey/surveys/` - List all active surveys
- **GET** `/api/survey/surveys/{id}/` - Get specific survey with questions
- **POST** `/api/survey/surveys/{id}/submit/` - Submit survey responses
- **GET** `/api/survey/surveys/{id}/questions/` - Get questions for a survey

### Example API Usage

```bash
# Get all surveys
curl http://localhost:9000/api/survey/surveys/

# Get specific survey
curl http://localhost:9000/api/survey/surveys/{survey-id}/

# Submit survey response
curl -X POST http://localhost:9000/api/survey/surveys/{survey-id}/submit/ \
  -H "Content-Type: application/json" \
  -d '{
    "responses": {
      "1": "John Doe",
      "2": "john@example.com",
      "3": 5
    }
  }'
```

## 🗄️ Database Schema

### Models

- **Survey**: Title, description, active status
- **Question**: Text, type, required status, options
- **SurveyResponse**: Links to survey, IP, user agent, location
- **QuestionResponse**: Individual answers to questions

### Question Types

- `text`: Free text input
- `email`: Email validation
- `number`: Numeric input
- `rating`: 1-5 rating scale
- `multiple_choice`: Single selection
- `checkbox`: Multiple selections

## 🔒 Environment Variables

### Frontend (.env.local)

```
NEXT_PUBLIC_API_URL=http://localhost:9000/api/survey
```

### Backend (.env)

```
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=True
DATABASE_URL=postgresql://survey_user:survey_password@postgres:5432/survey_db
USE_X_FORWARDED_HOST=True
USE_X_FORWARDED_PORT=True
```

## 🐳 Docker Commands

### Development

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up --build

# Start specific service
docker-compose -f docker-compose.dev.yml up backend

# View service status
docker-compose -f docker-compose.dev.yml ps

# Clean up (removes volumes)
docker-compose -f docker-compose.dev.yml down -v
```

### Production

```bash
# Start production services
docker-compose -f docker-compose.prod.yml up --build

# Stop production services
docker-compose -f docker-compose.prod.yml down
```

## 🧪 Testing

```bash
# Backend tests
docker-compose -f docker-compose.dev.yml exec backend python manage.py test

# Frontend tests
docker-compose -f docker-compose.dev.yml exec frontend yarn test

# Run specific test
docker-compose -f docker-compose.dev.yml exec backend python manage.py test survey.tests
```

## 📊 Admin Panel Features

### Survey Management

- View all surveys and their status
- Create new surveys manually
- Edit survey details and questions

### Response Tracking

- View all survey responses
- Filter by survey, date, IP address
- See email addresses for easy identification
- Export response data

### Question Management

- Add/edit/delete questions
- Set question types and validation rules
- Configure required/optional questions

## 🔍 Troubleshooting

### Common Issues

1. **Port already in use**

   ```bash
   # Check what's using the port
   lsof -i :9000
   lsof -i :4545

   # Kill the process or change ports in docker-compose.yml
   ```

2. **Database connection issues**

   ```bash
   # Restart database
   docker-compose -f docker-compose.dev.yml restart postgres

   # Reset database
   docker-compose -f docker-compose.dev.yml down -v
   docker-compose -f docker-compose.dev.yml up -d
   ```

3. **Frontend not loading**

   ```bash
   # Check frontend logs
   docker-compose -f docker-compose.dev.yml logs frontend

   # Rebuild frontend
   docker-compose -f docker-compose.dev.yml build frontend
   ```

4. **Backend API errors**

   ```bash
   # Check backend logs
   docker-compose -f docker-compose.dev.yml logs backend

   # Run migrations
   docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate
   ```

### Debug Mode

```bash
# Enable debug logging
docker-compose -f docker-compose.dev.yml exec backend python manage.py shell -c "
import logging
logging.basicConfig(level=logging.DEBUG)
"
```

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🤝 Support

For issues and questions:

1. Check the troubleshooting section
2. Review the logs: `docker-compose -f docker-compose.dev.yml logs`
3. Create an issue in the repository
