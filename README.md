# Byte AI Assistant

A powerful AI-powered coding assistant for VS Code.

<div align="center">
  <img src="media/icons/icon.png" alt="Byte AI Assistant" width="128">
</div>

## Features

- 🤖 **AI Chat**: Talk to AI models directly in VS Code
- 🔍 **Code Analysis**: Get explanations and insights about your code
- 🛠️ **Code Refactoring**: Improve your code with AI-powered suggestions
- 📝 **Documentation Generation**: Generate comprehensive documentation
- 🧪 **Test Generation**: Create unit tests for your code
- 🚀 **Performance Optimization**: Get suggestions to optimize your code
- 📊 **Code Issue Detection**: Find potential bugs and code smells

## AI Providers

Byte supports the following AI providers:

- **OpenAI** (GPT models)
- **Google Gemini**
- **Anthropic Claude**
- **Local models** (via Ollama)

## Getting Started

1. Install the extension from the VS Code marketplace
2. Configure your preferred AI provider via the `/configure` command
3. Start chatting with the AI via the Byte panel in the sidebar
4. Use slash commands like `/explain`, `/refactor`, `/docs` to process your code

## Commands

| Command | Description |
|---------|-------------|
| `/explain` | Explain the selected code |
| `/refactor` | Get suggestions to improve your code |
| `/docs` | Generate documentation for your code |
| `/optimize` | Get performance optimization suggestions |
| `/comments` | Add detailed comments to your code |
| `/issues` | Find potential bugs and code smells |
| `/tests` | Generate unit tests for your code |
| `/help` | See a list of all available commands |

## Code Analysis

Select any code in your editor and use the "Analyze Selected Code" command or right-click menu to get an instant analysis of your code:

- Explanation of how it works
- Potential issues and improvement suggestions
- Best practices recommendations

## Development

For development details, see [ARCHITECTURE.md](src/ARCHITECTURE.md) for information about the codebase structure.

### Building from Source

```bash
# Clone the repository
git clone https://github.com/tuncer-byte/byte.git

# Install dependencies
npm install

# Build the extension
npm run build

# Package the extension
npm run package
```

## License

MIT License

## Privacy

Your code is processed according to the privacy policy of the AI provider you choose. Code is sent only when you explicitly request analysis. No code is stored or logged by the extension itself.

## Feedback

We welcome feedback and contributions! Please open an issue on GitHub or use the "Provide Feedback" command in the extension.
