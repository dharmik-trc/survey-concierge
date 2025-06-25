# Survey Platform

A full-stack survey platform built with Next.js frontend and Django backend, featuring Excel file upload and dynamic survey creation.

## 🚀 Features

- **Excel Upload**: Upload Excel files to automatically generate survey questions
- **Dynamic Surveys**: Create surveys from Excel data
- **Modern UI**: Built with Next.js and Tailwind CSS
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
│   ├── Dockerfile.dev       # Development Dockerfile
│   ├── Dockerfile.prod      # Production Dockerfile
│   └── .env.local.example   # Frontend environment variables
├── backend/                  # Django backend application
│   ├── survey/              # Survey app with API endpoints
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

2. **Set up environment variables**

   ```bash
   # Copy example files
   cp frontend/.env.local.example frontend/.env.local
   cp backend/.env.example backend/.env

   # Edit the files with your configuration
   ```

3. **Start development environment**

   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

4. **Access the applications**
   - Frontend: http://localhost:4545
   - Backend API: http://localhost:9000
   - Django Admin: http://localhost:9000/admin/

### Database Setup

The development environment automatically sets up PostgreSQL. For production, update the `DATABASE_URL` in your environment variables.

## 🔧 Development

### Running in Development Mode

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up --build

# Run migrations (first time only)
docker-compose -f docker-compose.dev.yml exec backend python manage.py migrate

# Create superuser (first time only)
docker-compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser
```

### Running in Production Mode

```bash
# Start production environment
docker-compose -f docker-compose.prod.yml up --build
```

## 📡 API Endpoints

### Survey API

- **POST** `/api/survey/upload_excel/`
  - Upload Excel file to create survey questions
  - Accepts multipart form data with `file` field
  - Returns JSON with parsed questions

### Example Usage

```bash
curl -X POST http://localhost:9000/api/survey/upload_excel/ \
  -F "file=@your_survey.xlsx"
```

## 🗄️ Database

### Development

- **Type**: PostgreSQL
- **Host**: localhost
- **Port**: 5432
- **Database**: survey_db
- **Username**: survey_user
- **Password**: survey_password

### Production

Update the `DATABASE_URL` environment variable with your production database credentials.

## 🔒 Environment Variables

### Frontend (.env.local)

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:9000
```

### Backend (.env)

```
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=True
DATABASE_URL=postgresql://survey_user:survey_password@localhost:5432/survey_db
```

## 🐳 Docker Commands

### Development

```bash
# Start services
docker-compose -f docker-compose.dev.yml up --build

# Stop services
docker-compose -f docker-compose.dev.yml down

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Execute commands in containers
docker-compose -f docker-compose.dev.yml exec backend python manage.py shell
docker-compose -f docker-compose.dev.yml exec frontend yarn add package-name
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

For support and questions, please open an issue in the GitHub repository.
