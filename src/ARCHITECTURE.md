# Byte AI Assistant Architecture

This document provides an overview of the codebase structure and architecture of the Byte AI Assistant VSCode extension.

## Directory Structure

```
src/
├── commands/              # Command handling and management
│   ├── handlers/          # Command handler implementations
│   ├── utils/             # Command-related utilities
│   ├── index.ts           # CommandManager that registers all commands
│   └── types.ts           # Command-related type definitions
│
├── services/              # Core services
│   ├── ai.ts              # AI service for interacting with AI providers
│   └── storage.ts         # Storage service for persisting data
│
├── views/                 # UI components and panels
│   ├── chat/              # Main chat panel implementation
│   │   ├── handlers/      # Message and command handlers
│   │   ├── utils/         # Chat-related utilities
│   │   └── index.ts       # ChatPanel implementation
│   │
│   └── inline-chat/       # Inline code chat functionality
│       ├── handlers/      # Message handlers for inline chat
│       ├── utils/         # Inline chat utilities
│       ├── index.ts       # InlineCodeChat implementation
│       └── types.ts       # Type definitions for inline chat
│
├── utils/                 # Shared utility functions
│
├── extension.ts           # Main extension entry point
└── test/                  # Test related files
```

## Component Descriptions

### Commands (`/src/commands`)

The commands module handles all command registrations and executions. It follows a modular architecture where each command is implemented as a separate handler class.

- **handlers/**: Contains command handler implementations divided by category:
  - `code-commands.ts`: Handles code-related commands (explain, refactor, generate docs)
  - `advanced-code-commands.ts`: Handles advanced code processing (optimize, add comments, find issues, generate tests)
  - `config-commands.ts`: Handles AI configuration commands

- **utils/**: Contains utility functions used by command handlers
- **types.ts**: Defines interfaces and types for command handlers
- **index.ts**: Exports the CommandManager class that registers all commands with VSCode

### Services (`/src/services`)

Core services that provide functionality to other components:

- **ai.ts**: Service for interacting with AI providers (OpenAI, Anthropic, Gemini, Local)
- **storage.ts**: Service for persistent storage of user settings, API keys, and other data

### Views (`/src/views`)

UI components that provide the visual interface for the extension:

#### Chat Panel (`/src/views/chat`)

The main chat panel visible in the sidebar:

- **handlers/**: Message and command handlers for the chat panel
  - `message-handler.ts`: Processes incoming/outgoing messages
  - `slash-commands.ts`: Handles slash commands in the chat
- **utils/**: Utility functions for the chat panel
  - `helpers.ts`: Helper functions for message formatting
  - `settings-manager.ts`: Manages chat settings

#### Inline Code Chat (`/src/views/inline-chat`)

The inline code chat feature that provides analysis and Q&A for selected code:

- **handlers/**: Message handlers for the inline chat
  - `message-handler.ts`: Processes messages in the inline chat
- **utils/**: Utility functions for the inline chat
  - `webview-helper.ts`: Functions for creating WebView content
- **types.ts**: Type definitions specific to inline chat
- **index.ts**: Main implementation of the InlineCodeChat class

### Extension Entry Point (`/src/extension.ts`)

The main entry point for the extension:

- Activates the extension and initializes all components
- Registers commands, webviews, and other extension points
- Handles extension lifecycle events

## Interaction Flow

1. User opens the extension or triggers a command
2. The command is routed through the CommandManager
3. CommandManager delegates to the appropriate command handler
4. Command handler interacts with services (AI, Storage) as needed
5. Results are displayed to the user through the appropriate view

## Design Principles

- **Modularity**: Each component is self-contained with well-defined interfaces
- **Separation of Concerns**: Clear separation between UI, business logic, and data handling
- **Type Safety**: Strong typing throughout the codebase
- **Progressive Enhancement**: Core functionality works with minimal setup, advanced features available as needed 