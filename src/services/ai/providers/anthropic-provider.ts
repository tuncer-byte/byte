import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { Message } from '../types';
import { AILogger } from '../utils/logger';

/**
 * Provider class that communicates with the Anthropic Claude service
 */
export class AnthropicProvider {
    private logger: AILogger;
    
    constructor(private context: vscode.ExtensionContext) {
        this.logger = new AILogger();
    }
    
    /**
     * Sends a request to the Anthropic Claude API
     */
    public async callAnthropic(userMessage: string, messages: Message[]): Promise<string> {
        const apiKey = await this.getApiKey();
        
        if (!apiKey) {
            throw new Error('Anthropic API key not found. Please configure it.');
        }

        const config = vscode.workspace.getConfiguration('byte');
        const model = config.get<string>('anthropic.model') || 'claude-3-sonnet';

        this.logger.log(`Sending Anthropic API request (model: ${model})...`);

        try {
            // Format messages for Claude
            const claudeMessages = this.formatMessages(messages, userMessage);
            
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: model,
                    messages: claudeMessages,
                    max_tokens: 4000,
                    temperature: 0.7,
                    top_p: 0.95,
                    top_k: 40
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Anthropic API Error: ${response.status} - ${JSON.stringify(errorData)}`);
            }

            const data = await response.json();
            return data.content[0].text;
        } catch (error: any) {
            this.logger.log(`Anthropic API Error: ${error.message}`, true);
            throw new Error(`Anthropic API request failed: ${error.message}`);
        }
    }
    
    /**
     * Converts messages to Claude API format
     */
    private formatMessages(messages: Message[], currentUserMessage: string): any[] {
        // Create system message with enhanced prompt
        const systemMessage = {
            role: 'system',
            content: `You are Byte, an advanced coding assistant designed to help developers write better code.

Key responsibilities:
- Provide clear, accurate, and helpful responses to programming questions
- Explain complex concepts in simple terms with relevant examples
- Debug code issues with detailed explanations
- Suggest optimizations and best practices
- Adapt your responses to the user's skill level

Guidelines:
- Prioritize clarity and correctness in your explanations
- Include code examples when relevant
- Explain your reasoning step by step
- When appropriate, suggest alternative approaches
- Respond in Turkish unless specifically asked to use another language
- Format code blocks properly with appropriate syntax highlighting
- Be concise but thorough in your explanations

Remember that your goal is to help the user become a better programmer through thoughtful guidance and education.`
        };
        
        // Convert existing messages to Claude format
        const claudeMessages = [];
        
        // Add system message
        claudeMessages.push(systemMessage);
        
        // Add last 15 messages (increased from 10)
        const recentMessages = messages.slice(-15);
        recentMessages.forEach(message => {
            claudeMessages.push({
                role: message.role === 'assistant' ? 'assistant' : 'user',
                content: message.content
            });
        });
        
        // Add current user message with context enhancement
        claudeMessages.push({
            role: 'user',
            content: currentUserMessage
        });
        
        return claudeMessages;
    }
    
    /**
     * Gets the Anthropic API key from secure storage
     */
    public async getApiKey(): Promise<string | undefined> {
        const config = vscode.workspace.getConfiguration('byte');
        return await this.context.secrets.get('byte.anthropic.apiKey') || config.get('anthropic.apiKey');
    }
    
    /**
     * Saves the Anthropic API key to secure storage
     */
    public async setApiKey(apiKey: string): Promise<void> {
        await this.context.secrets.store('byte.anthropic.apiKey', apiKey);
        this.logger.log('Anthropic API key saved to secure storage');
    }
} 