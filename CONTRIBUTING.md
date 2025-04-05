# Contributing to Byte AI Assistant

Thank you for your interest in contributing to Byte AI Assistant! This document provides guidelines and instructions to help you contribute effectively.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Guidelines](#coding-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

- Ensure the bug hasn't already been reported by searching GitHub Issues
- If you can't find an existing issue, create a new one with:
  - A clear title
  - Detailed steps to reproduce the bug
  - Expected vs actual behavior
  - Screenshots if applicable
  - Your environment information (VS Code version, OS, etc.)

### Suggesting Features

- First, check if your idea has already been suggested
- Create a new issue with the "enhancement" label, including:
  - A clear title describing the suggestion
  - Detailed explanation of the feature and why it would be valuable
  - Any implementation ideas you have

### Code Contributions

1. Find an issue to work on or create a new one
2. Comment on the issue to let others know you're working on it
3. Fork the repository
4. Create a feature branch
5. Make your changes
6. Submit a pull request

## Development Setup

### Prerequisites

- Node.js (v16 or later)
- npm or yarn
- VS Code

### Setup Steps

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/byte.git
   cd byte
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a new branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
5. Build the extension:
   ```bash
   npm run build
   ```
6. Launch the extension in debug mode:
   ```bash
   npm run watch
   ```
7. Press F5 in VS Code to launch the extension in development mode

## Pull Request Process

1. Update the README.md or documentation with details of changes if needed
2. Make sure your code follows the project's coding guidelines
3. Ensure all tests pass
4. Make sure your commits follow commit message guidelines
5. Submit your pull request with a clear description of the changes
6. Wait for feedback or approval from maintainers

## Coding Guidelines

- Follow the existing code style in the project
- Use TypeScript for all new code
- Write clear, descriptive variable and function names
- Include comments for complex logic
- Write unit tests for new functionality
- Keep code modular and maintainable

### Code Structure

Follow the project's architecture:
- Put new commands in `src/commands/handlers/`
- Put new services in `src/services/`
- Put UI components in `src/views/`
- Add utility functions to `src/utils/`

## Commit Message Guidelines

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short summary>
```

Types include:
- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, missing semicolons, etc)
- **refactor**: Code changes that neither fix bugs nor add features
- **perf**: Performance improvements
- **test**: Adding or correcting tests
- **chore**: Changes to the build process or auxiliary tools

Example commit messages:
- `feat(ai-service): add support for Claude 3 models`
- `fix(bug-finder): resolve issue with error detection in PowerShell`
- `docs: update installation instructions`

## License

By contributing to Byte AI Assistant, you agree that your contributions will be licensed under the project's MIT License. 