# Byte AI Assistant

A powerful AI-powered coding assistant for VS Code.

<div align="center">
  <img src="media/icons/icon.png" alt="Byte AI Assistant" width="128">
</div>

<div align="center">
  <h2>Mimarı Yapı / Architecture</h2>
  <img src="public/modern-architecture.svg" alt="Byte AI Architecture" width="800">
</div>

## Features

- 🤖 **AI Chat**: Talk to AI models directly in VS Code
- 🔍 **Code Analysis**: Get explanations and insights about your code
- 🛠️ **Code Refactoring**: Improve your code with AI-powered suggestions
- 📝 **Documentation Generation**: Generate comprehensive documentation
- 🧪 **Test Generation**: Create unit tests for your code
- 🚀 **Performance Optimization**: Get suggestions to optimize your code
- 📊 **Code Issue Detection**: Find potential bugs and code smells
- 🐛 **Bug Finder**: Automatically detect and fix terminal errors with AI
  - Monitors terminal output for error messages
  - Provides AI-powered error analysis and solutions
  - Allows one-click application of suggested fixes
  - Includes permanent status bar indicator for monitoring status

## AI Providers

Byte supports the following AI providers:

- **OpenAI** (GPT models)
- **Google Gemini**
- **Anthropic Claude**
- **Local models** (via Ollama)

## Bug Finder

The Bug Finder feature automatically monitors your terminal for errors and provides AI-powered solutions.

### How to use Bug Finder

1. **Start Error Monitoring**
   - Use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
   - Select "Byte: Start Terminal Error Monitoring"
   - A notification will appear, and a status bar indicator will show monitoring is active

2. **Automatic Error Detection**
   - When an error occurs in the terminal, it's automatically detected
   - You'll receive a notification with the option to analyze the error with AI
   - Click "Analyze Error with AI" to get a solution

3. **Manual Error Analysis**
   - Use the command "Byte: Analyze Error Message" to manually analyze errors
   - Paste the error message when prompted
   - The AI will analyze the error and suggest solutions

4. **Solution Panel**
   - The AI solution is displayed in a panel showing:
     - Root cause of the error
     - Technical explanation
     - Step-by-step solution
     - Preventive measures for the future
   - You can apply suggested commands or code changes directly from the panel

5. **Stop Monitoring**
   - Use the command "Byte: Stop Terminal Error Monitoring" to stop
   - Or click on the status bar indicator to turn it off

### Keyboard Shortcuts

| Shortcut | Command | Description |
|----------|---------|-------------|
| `Ctrl+Alt+E` | Start Error Monitoring | Begin monitoring terminal for errors |
| `Ctrl+Alt+Shift+E` | Stop Error Monitoring | Stop the error monitoring process |
| `Ctrl+Alt+A` | Analyze Error | Manually analyze an error message |

### Using in Development Mode

To use the Bug Finder feature in development mode, you need to enable the proposed API:

```bash
code --enable-proposed-api byte.byte
```

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

### Bug Finder Commands

| Command | Description |
|---------|-------------|
| `Byte: Start Terminal Error Monitoring` | Begin monitoring terminal for errors |
| `Byte: Stop Terminal Error Monitoring` | Stop the error monitoring process |
| `Byte: Analyze Error Message` | Manually analyze an error message |

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
