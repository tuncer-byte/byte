# Media Directory Structure

This directory contains all the UI-related assets for the Byte AI Assistant extension.

## Directory Structure

```
media/
├── chat/               # Chat panel UI assets
│   ├── chat-panel.html # Main HTML template for chat panel
│   ├── chat-panel.js   # JavaScript for chat panel functionality
│   └── chat-panel.css  # Styling for the chat panel
│
├── inline-chat/        # Inline code chat UI assets
│   ├── inline-chat.html # HTML template for inline code chat
│   ├── inline-chat.js   # JavaScript for inline code chat
│   └── inline-chat.css  # Styling for inline code chat
│
└── icons/             # Extension icons and graphics
    └── icon.png       # Main extension icon
```

## UI Components

### Chat Panel

The Chat Panel is the main interface for interacting with the AI assistant. It's displayed in the VS Code sidebar and provides a chat-like interface for asking questions and viewing responses.

### Inline Code Chat

The Inline Code Chat is displayed when analyzing selected code or asking questions about specific code blocks. It provides a focused interface for code-specific interactions.

## Asset Naming Conventions

- HTML templates: `feature-name.html`
- JavaScript files: `feature-name.js`
- CSS files: `feature-name.css`
- Icons: Descriptive names (e.g., `icon.png`, `logo.png`)

## UI Design Guidelines

- Use native VS Code styling and theme variables
- Support both light and dark themes
- Responsive layouts that adapt to different panel sizes
- Clear visual hierarchy for user messages vs AI responses
- Accessible design with proper contrast and keyboard navigation 