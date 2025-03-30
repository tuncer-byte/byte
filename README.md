# Byte - AI Coding Assistant

![Project Architecture and Flow](public/architect.png)

Byte is a powerful AI coding assistant Visual Studio Code extension that enhances your coding workflow with AI-powered assistance. It provides a seamless chat interface and powerful code-related commands to help you write, understand, refactor, and optimize your code.

## Features

### Multi-Provider AI Integration
Byte supports multiple AI providers, allowing you to choose the one that best suits your needs:
- **OpenAI** - Utilize OpenAI's powerful language models
- **Google Gemini** - Leverage Google's advanced Gemini AI models
- **Local Models** - Connect to your own locally-hosted AI models

### Intelligent Code Assistant
- **Code Explanation** - Get detailed explanations of any code snippet
- **Code Refactoring** - Receive suggestions to improve your code quality
- **Documentation Generation** - Automatically generate comprehensive documentation
- **Code Optimization** - Optimize code for performance, memory, or readability
- **Issue Detection** - Find potential bugs, security vulnerabilities, and code smells
- **Unit Test Generation** - Automatically create unit tests for your code

### Intuitive User Interface
- **Chat Panel** - Convenient sidebar chat interface
- **Slash Commands** - Quick access to specialized AI functions
- **Context-Aware Responses** - AI understands your current file and project context
- **Agent Mode** - Enable automatic code modifications and command execution

## Installation

1. Open VS Code extensions panel (Ctrl+Shift+X / Cmd+Shift+X)
2. Search for "Byte AI Assistant"
3. Click Install

## Quick Start

1. Open the Byte panel by clicking the Byte icon in the activity bar
2. Configure your preferred AI provider by clicking the ⚙️ button
3. Start chatting with Byte!

## Available Commands

Byte supports the following slash commands:

| Command | Description |
|---------|-------------|
| `/explain` | Explain selected code in detail |
| `/review` or `/refactor` | Get suggested improvements for your code |
| `/docs` | Generate documentation for your code |
| `/optimize [type]` | Optimize code (types: performance, memory, size, readability) |
| `/comments [style]` | Add comments to code (styles: comprehensive, concise, doc) |
| `/issues [type]` | Find issues in code (types: all, performance, security, smells, bugs) |
| `/tests [framework]` | Generate unit tests (auto-detects framework if not specified) |
| `/help` | Show help information about available commands |

## Extension Settings

This extension contributes the following settings:

* `byte.provider`: Set the default AI provider (openai, gemini, local)
* `byte.openai.apiKey`: Your OpenAI API key (stored securely)
* `byte.gemini.apiKey`: Your Google Gemini API key (stored securely)
* `byte.gemini.model`: The Gemini model to use (default: gemini-1.5-flash)
* `byte.local.endpoint`: URL endpoint for your local AI model (default: http://localhost:8000/v1/completions)

## Architecture

The extension follows a modular architecture:

1. **Extension Core** - Handles activation, command registration, and UI initialization
2. **AI Service** - Manages communication with AI providers and message history
3. **Chat Panel** - WebView-based UI for user interaction
4. **Command Manager** - Processes slash commands and extension commands

## Development

### Prerequisites
- Node.js and npm
- VS Code Extension Development environment

### Building
1. Clone the repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press F5 to start debugging

## Release Notes

### 1.0.0
- Initial release with support for OpenAI, Google Gemini, and local models
- Chat interface with slash commands
- Code explanation, refactoring, and optimization features

## License

This extension is licensed under the [MIT License](LICENSE).

## Privacy

Byte sends code snippets and queries to the configured AI provider. Please review the privacy policy of your chosen AI provider for details on how they handle your data.

**Enjoy using Byte AI Assistant!**
