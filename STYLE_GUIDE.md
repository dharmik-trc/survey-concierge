# Style Guide & Code Quality

This document outlines the style checks and formatting rules for the codebase.

## Frontend (TypeScript/React/Next.js)

### Linting
- **ESLint**: Configured with Next.js and TypeScript rules
- Run: `npm run lint`
- Auto-fix: `npm run lint:fix`

### Formatting
- **Prettier**: Code formatter
- Run: `npm run format`
- Check: `npm run format:check`

### Combined Checks
- Run all style checks: `npm run style:check`

### Key Rules
- Maximum line length: 100 characters
- Use semicolons
- Double quotes for strings
- 2-space indentation
- Trailing commas in ES5 style
- No console.log in production code (warn allowed)

## Backend (Python/Django)

### Formatting
- **Black**: Code formatter (line length: 100)
- **isort**: Import sorter (compatible with black)
- Format: `make format` or `black . && isort .`
- Check: `make format-check` or `black --check . && isort --check-only .`

### Linting
- **flake8**: Style guide enforcement
- Run: `make lint` or `flake8 .`

### Combined Checks
- Run all style checks: `make style-check`

### Key Rules
- Maximum line length: 100 characters
- Black formatting style
- Imports sorted with isort
- Type hints recommended for function signatures

## Pre-commit Recommendations

Before committing:
1. Frontend: `npm run style:check`
2. Backend: `make style-check`
3. Fix any issues automatically:
   - Frontend: `npm run lint:fix && npm run format`
   - Backend: `make format`

## Installation

### Frontend
```bash
cd frontend
npm install --save-dev prettier
```

### Backend
```bash
pip install black isort flake8
```

Or install from requirements.txt (development dependencies are included):
```bash
pip install -r requirements.txt
```

Development dependencies (black, isort, flake8) are at the bottom of requirements.txt and are optional.

