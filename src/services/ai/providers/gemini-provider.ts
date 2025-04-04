import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { Message, CachedContent } from '../types';
import { AILogger } from '../utils/logger';
import { CacheManager } from '../utils/cache-manager';
import { BASE_SYSTEM_PROMPT } from '../utils/base-prompts';

/**
 * Provider class that communicates with Google Gemini service
 */
export class GeminiProvider {
    private logger: AILogger;
    
    constructor(private context: vscode.ExtensionContext) {
        this.logger = new AILogger();
    }
    
    /**
     * Sends a request to Google Gemini API
     */
    public async callGemini(userMessage: string, messages: Message[]): Promise<string> {
        // Get API key
        let apiKey = await this.getApiKey();
        
        if (!apiKey) {
            throw new Error('Google Gemini API key not found. Please configure it.');
        }
        
        // Get model name from configuration, use gemini-1.5-flash as default
        const config = vscode.workspace.getConfiguration('byte');
        const modelName = config.get<string>('gemini.model') || 'gemini-1.5-flash';
        
        this.logger.log(`Sending Gemini API request (model: ${modelName})...`);
        
        try {
            // Gemini API endpoint - dynamically set the model name
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            
            // Format messages for the API request
            const formattedMessages = this.formatMessagesForAPI(messages, userMessage);
            
            // API isteği için gövde
            const requestBody: any = {
                contents: formattedMessages,
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 2048,
                    topP: 0.95,
                    topK: 40
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            };
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                this.logger.log(`Gemini API response error: ${JSON.stringify(errorData)}`, true);
                
                // If model not found error, show supported models
                if (errorData.error && errorData.error.code === 404) {
                    throw new Error(`Gemini API Error: Model "${modelName}" not found. Please use a valid model like gemini-1.5-flash or gemini-1.5-pro.`);
                }
                
                throw new Error(`Gemini API Error: ${response.status} - ${JSON.stringify(errorData)}`);
            }
            
            const data = await response.json();
            const assistantResponse = data.candidates[0].content.parts[0].text;
            
            this.logger.log('Received Gemini API response');
            return assistantResponse;
        } catch (error: any) {
            this.logger.log(`Gemini API Error: ${error.message}`, true);
            throw new Error(`Gemini API request failed: ${error.message}`);
        }
    }
    
    /**
     * Formats messages for the Gemini API in the new format
     */
    private formatMessagesForAPI(messages: Message[], currentUserMessage: string): any[] {
        const formattedContents = [];
        
        // Add system message as the first message
        formattedContents.push({
            role: "user",
            parts: [{
                text: BASE_SYSTEM_PROMPT
            }]
        });
        
        formattedContents.push({
            role: "model",
            parts: [{
                text: "Merhaba! Ben Byte, kodlama asistanınız. Programlama sorularınızda size yardımcı olmak için buradayım. Nasıl yardımcı olabilirim?"
            }]
        });
        
        // Add conversation history (last 10 messages)
        const recentMessages = messages.slice(-10);
        
        recentMessages.forEach(message => {
            formattedContents.push({
                role: message.role === 'user' ? 'user' : 'model',
                parts: [{ text: message.content }]
            });
        });
        
        // Add current user message
        formattedContents.push({
            role: 'user',
            parts: [{ text: currentUserMessage }]
        });
        
        return formattedContents;
    }
    
    /**
     * Gets Google Gemini API key from secure storage
     */
    public async getApiKey(): Promise<string | undefined> {
        // First try to get the key from secret storage
        let apiKey = await this.context.secrets.get('byte.gemini.apiKey');
        
        // If not in secret storage, get from settings
        if (!apiKey) {
            const config = vscode.workspace.getConfiguration('byte');
            apiKey = config.get<string>('gemini.apiKey');
        }
        
        return apiKey;
    }
    
    /**
     * Saves Google Gemini API key to secure storage
     */
    public async setApiKey(apiKey: string): Promise<void> {
        await this.context.secrets.store('byte.gemini.apiKey', apiKey);
        this.logger.log('Gemini API key saved to secure storage');
    }
}