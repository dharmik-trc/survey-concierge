# Contributing to Survey Platform

Thank you for your interest in contributing to the Survey Platform! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites

- Docker and Docker Compose
- Git
- Basic knowledge of Next.js and Django

### Development Setup

1. **Fork and clone the repository**

   ```bash
   git clone https://github.com/your-username/survey_platform.git
   cd survey_platform
   ```

2. **Set up environment variables**

   ```bash
   cp frontend/.env.local.example frontend/.env.local
   cp backend/.env.example backend/.env
   ```

3. **Start the development environment**
   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

## 🔧 Development Workflow

### Branch Naming Convention

- `feature/description` - For new features
- `bugfix/description` - For bug fixes
- `hotfix/description` - For urgent fixes
- `docs/description` - For documentation updates

### Commit Message Convention

Use conventional commit messages:

```
type(scope): description

[optional body]

[optional footer]
```

Types:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:

```
feat(frontend): add Excel file upload component
fix(backend): resolve database connection issue
docs(readme): update installation instructions
```

### Pull Request Process

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**

   - Write clean, readable code
   - Add tests for new functionality
   - Update documentation if needed

3. **Test your changes**

   ```bash
   # Backend tests
   docker-compose -f docker-compose.dev.yml exec backend python manage.py test

   # Frontend tests
   docker-compose -f docker-compose.dev.yml exec frontend yarn test
   ```

4. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

5. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Provide a clear description of your changes
   - Reference any related issues
   - Include screenshots for UI changes

## 📋 Code Standards

### Frontend (Next.js)

- Use TypeScript for type safety
- Follow ESLint configuration
- Use Tailwind CSS for styling
- Write functional components with hooks
- Add proper error handling

### Backend (Django)

- Follow PEP 8 style guide
- Use Django REST framework for APIs
- Write docstrings for functions and classes
- Add proper validation and error handling
- Use Django's built-in security features

### General

- Write meaningful variable and function names
- Add comments for complex logic
- Keep functions small and focused
- Follow the existing code style

## 🧪 Testing

### Backend Testing

```bash
# Run all tests
docker-compose -f docker-compose.dev.yml exec backend python manage.py test

# Run specific app tests
docker-compose -f docker-compose.dev.yml exec backend python manage.py test survey

# Run with coverage
docker-compose -f docker-compose.dev.yml exec backend python manage.py test --coverage
```

### Frontend Testing

```bash
# Run tests
docker-compose -f docker-compose.dev.yml exec frontend yarn test

# Run tests in watch mode
docker-compose -f docker-compose.dev.yml exec frontend yarn test:watch
```

## 📝 Documentation

- Update README.md for significant changes
- Add inline comments for complex code
- Document API endpoints
- Update environment variable examples

## 🐛 Reporting Issues

When reporting issues, please include:

1. **Environment details**

   - Operating system
   - Docker version
   - Node.js version (if relevant)

2. **Steps to reproduce**

   - Clear, step-by-step instructions
   - Expected vs actual behavior

3. **Error messages**

   - Full error logs
   - Screenshots if applicable

4. **Additional context**
   - What you were trying to do
   - Any recent changes

## 🤝 Code Review

All contributions require review before merging. Reviewers will check for:

- Code quality and standards
- Test coverage
- Documentation updates
- Security considerations
- Performance impact

## 📄 License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

## 🆘 Getting Help

If you need help with contributing:

1. Check existing issues and pull requests
2. Read the documentation
3. Open a new issue for questions
4. Join our community discussions

Thank you for contributing to the Survey Platform! 🎉
