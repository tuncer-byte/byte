import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { Message } from '../types';
import { AILogger } from '../utils/logger';

/**
 * Provider class that communicates with OpenAI service
 */
export class OpenAIProvider {
    private logger: AILogger;
    
    constructor(private context: vscode.ExtensionContext) {
        this.logger = new AILogger();
    }
    
    /**
     * Sends a request to OpenAI API
     */
    public async callOpenAI(userMessage: string, messages: Message[]): Promise<string> {
        // Get API key from secret storage
        let apiKey = await this.getApiKey();
        
        if (!apiKey) {
            throw new Error('OpenAI API key not found. Please configure it.');
        }
        
        // Create message history in OpenAI chat format
        const formattedMessages = this.formatMessages(messages);
        formattedMessages.push({ role: 'user', content: userMessage });
        
        this.logger.log('Sending OpenAI API request...');
        
        try {
            const config = vscode.workspace.getConfiguration('byte');
            const model = config.get<string>('openai.model') || 'gpt-3.5-turbo';
            
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: formattedMessages,
                    temperature: 0.7
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI API Error: ${response.status} - ${JSON.stringify(errorData)}`);
            }
            
            const data = await response.json();
            const assistantResponse = data.choices[0].message.content;
            
            this.logger.log('OpenAI API response received');
            return assistantResponse;
        } catch (error: any) {
            this.logger.log(`OpenAI API Error: ${error.message}`, true);
            throw new Error(`OpenAI API request failed: ${error.message}`);
        }
    }
    
    /**
     * Converts messages to OpenAI API format
     */
    private formatMessages(messages: Message[]): any[] {
        // Add system message with enhanced prompt
        const formattedMessages = [
            { 
                role: 'system', 
                content: `You are Byte, an advanced coding assistant designed to help developers with programming tasks.

CAPABILITIES:
- Provide clear, concise explanations of programming concepts
- Generate high-quality code examples with detailed comments
- Debug and troubleshoot code issues with step-by-step analysis
- Suggest best practices and optimization techniques
- Explain complex algorithms and data structures

GUIDELINES:
- Always respond in Turkish, following proper grammar and clarity
- Prioritize modern, maintainable coding practices
- Include code examples when relevant to illustrate concepts
- Break down complex topics into understandable components
- Provide context and explanations alongside code solutions
- When appropriate, suggest alternative approaches with pros/cons

Your primary goal is to help users become better programmers through thoughtful, educational responses that address their specific needs.`
            }
        ];
        
        // Add last 10 messages (limit)
        const recentMessages = messages.slice(-10);
        recentMessages.forEach(message => {
            formattedMessages.push({
                role: message.role,
                content: message.content
            });
        });
        
        return formattedMessages;
    }
    
    /**
     * Gets OpenAI API key from secure storage
     */
    public async getApiKey(): Promise<string | undefined> {
        // First try to get the key from secret storage
        let apiKey = await this.context.secrets.get('byte.openai.apiKey');
        
        // If not in secret storage, get from settings
        if (!apiKey) {
            const config = vscode.workspace.getConfiguration('byte');
            apiKey = config.get<string>('openai.apiKey');
        }
        
        return apiKey;
    }
    
    /**
     * Saves OpenAI API key to secure storage
     */
    public async setApiKey(apiKey: string): Promise<void> {
        await this.context.secrets.store('byte.openai.apiKey', apiKey);
        this.logger.log('OpenAI API key saved to secure storage');
    }
}