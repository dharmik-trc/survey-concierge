from setuptools import find_packages, setup

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="survey-concierge-backend",
    version="1.0.0",
    author="Survey Concierge Team",
    author_email="team@surveyconcierge.com",
    description="Survey Concierge - Professional Survey Platform Backend API",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/survey-concierge/platform",
    project_urls={
        "Bug Reports": "https://github.com/survey-concierge/platform/issues",
        "Source": "https://github.com/survey-concierge/platform",
        "Documentation": "https://docs.surveyconcierge.com",
    },
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: Science/Research",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Internet :: WWW/HTTP :: Dynamic Content",
        "Topic :: Scientific/Engineering :: Information Analysis",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    python_requires=">=3.8",
    install_requires=[
        "Django>=4.2.0,<5.0.0",
        "djangorestframework>=3.14.0,<4.0.0",
        "django-cors-headers>=4.3.0,<5.0.0",
        "openpyxl>=3.1.0,<4.0.0",
        "python-dotenv>=1.0.0,<2.0.0",
        "gunicorn>=21.0.0,<22.0.0",
        "psycopg2-binary>=2.9.0,<3.0.0",
        "dj-database-url>=2.1.0,<3.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-django>=4.5.0",
            "black>=23.0.0",
            "flake8>=6.0.0",
            "isort>=5.12.0",
        ],
    },
    keywords=[
        "survey",
        "questionnaire",
        "feedback",
        "data-collection",
        "research",
        "poll",
        "form",
        "django",
        "rest-api",
        "python",
    ],
)
