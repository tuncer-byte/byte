import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { Message } from '../types';
import { AILogger } from '../utils/logger';
import { BASE_SYSTEM_PROMPT } from '../utils/base-prompts';

/**
 * Provider class that communicates with local models (Ollama)
 */
export class LocalProvider {
    private logger: AILogger;
    
    constructor() {
        this.logger = new AILogger();
    }
    
    /**
     * Sends a request to the Ollama model
     */
    public async callLocalModel(userMessage: string, messages: Message[]): Promise<string> {
        // Ollama model endpoint
        const config = vscode.workspace.getConfiguration('byte');
        const endpoint = config.get<string>('local.endpoint') || 'http://localhost:11434/api/generate';
        const model = config.get<string>('local.model') || 'llama3';
        
        this.logger.log(`Sending Ollama request (${endpoint}, model: ${model})...`);
        
        try {
            // Combine message history
            const prompt = this.formatMessages(messages) + "\n\nUser: " + userMessage + "\n\nAssistant: ";
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    prompt: prompt,
                    stream: false
                })
            });
            
            if (!response.ok) {
                throw new Error(`Ollama API Error: ${response.status}`);
            }
            
            const data = await response.json();
            // Extract response based on Ollama response format
            const assistantResponse = data.response || "I'm sorry, I couldn't generate a response.";
            
            this.logger.log('Received Ollama response');
            return assistantResponse;
        } catch (error: any) {
            this.logger.log(`Ollama API Error: ${error.message}`, true);
            throw new Error(`Ollama request failed: ${error.message}`);
        }
    }
    
    /**
     * Format messages for Ollama model
     */
    private formatMessages(messages: Message[]): string {
        // System instructions with enhanced prompt engineering
        let result = BASE_SYSTEM_PROMPT + "\n\n";
        
        // Include last 8 messages (increased from 5 for better context)
        const recentMessages = messages.slice(-8);
        
        recentMessages.forEach(message => {
            if (message.role === 'user') {
                result += `User: ${message.content}\n\n`;
            } else {
                result += `Assistant: ${message.content}\n\n`;
            }
        });
        
        return result;
    }
} 