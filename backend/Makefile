.PHONY: format format-check lint lint-check style-check

# Format code with black and isort
format:
	black .
	isort .

# Check formatting without making changes
format-check:
	black --check .
	isort --check-only .

# Run flake8 linter
lint:
	flake8 .

# Run all style checks
style-check: format-check lint
	@echo "✅ All style checks passed!"

