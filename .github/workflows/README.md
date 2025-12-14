# GitHub Actions Workflows

This directory contains CI/CD workflows for the Survey Platform project.

## Workflows

### `lint.yml`
Runs linting and style checks for both frontend and backend separately.

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Jobs:**
1. **frontend-lint**: Checks ESLint and Prettier formatting
2. **backend-lint**: Checks Black, isort, and flake8

### `ci.yml`
Alternative workflow using a matrix strategy to run frontend and backend checks in parallel.

**Features:**
- Uses matrix strategy for parallel execution
- Same triggers as `lint.yml`
- Runs `npm run style:check` for frontend
- Runs `make style-check` for backend

## Usage

These workflows run automatically on push/PR. To run locally:

```bash
# Frontend
cd frontend && npm run style:check

# Backend
cd backend && make style-check
```

## Status Badge

Add this to your README.md to show CI status:

```markdown
![Lint Status](https://github.com/dharmik-trc/survey-concierge/workflows/Lint%20and%20Style%20Check/badge.svg)
```

Replace `YOUR_USERNAME` and `YOUR_REPO` with your GitHub username and repository name.

