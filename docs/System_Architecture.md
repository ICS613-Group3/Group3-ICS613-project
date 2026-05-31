# System Architecture

## Overview
The system follows a classic N-Tier architecture designed for clear separation of concerns, testability, and scalability. The backend is strictly Object-Oriented (OOP) and implements the Repository and Service patterns.

## Architecture Tiers

### 1. Presentation Tier (Client)
- **Framework**: React / Next.js (or similar frontend framework depending on final team decision)
- **Responsibility**: Handles user interface, client-side routing, and rendering.
- **Communication**: Communicates with the backend via RESTful HTTP APIs.

### 2. Application Tier (Backend)
- **Framework**: FastAPI (Python)
- **Architecture Style**: N-Tier, Object-Oriented, RESTful API
- **Responsibility**: Business logic, request validation, authentication, and orchestration.

**Internal Backend Layers:**
- **Controllers / Routers**: FastAPI endpoints that receive HTTP requests, validate input (via Pydantic), and route to the appropriate Service.
- **Service Layer**: Contains core business logic. Encapsulates business rules and coordinates between different repositories. Strictly Object-Oriented.
- **Repository Layer**: Abstracts data access. Provides an object-oriented interface to query and manipulate the underlying database. Isolates the Service layer from database-specific implementation details (SQLAlchemy).
- **Domain Models**: Pydantic models for data validation/transfer (DTOs) and SQLAlchemy ORM models for database representation.

### 3. Data Tier
- **Database**: PostgreSQL
- **Hosting**: Containerized via Docker (`docker-compose`)
- **Responsibility**: Persistent storage of application data.

## Key Design Patterns & Principles
- **Repository Pattern**: Centralizes data access logic, making the code easier to maintain and test (allows easy mocking of database calls).
- **Service Pattern**: Keeps controllers thin and business logic reusable and independent of HTTP specific details.
- **Dependency Injection**: FastAPI's dependency injection system is used to provide services and repositories to endpoints, promoting loose coupling and easier unit testing.
- **Behavior-Driven Development (BDD)**: Architecture supports clear isolation to facilitate BDD testing frameworks (e.g., Behave or pytest-bdd) at the service and controller levels.

## Infrastructure
- **Containerization**: Docker & Docker Compose for consistent development and deployment environments.
- **Environment Management**: `.env` files for configuration isolation.
