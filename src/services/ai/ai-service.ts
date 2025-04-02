import * as vscode from 'vscode';
import { 
    AIProvider, 
    AISettings,
    AIServiceState, 
    Message
} from './types';
import { 
    OpenAIProvider, 
    GeminiProvider, 
    LocalProvider, 
    AnthropicProvider 
} from './providers';
import { AILogger } from './utils/logger';
import { ProviderSelector } from './utils/provider-selector';
import { DEFAULT_AI_SETTINGS } from './utils/constants';

/**
 * Class that provides integration with AI Services
 */
export class AIService {
    private currentProvider: AIProvider;
    private context: vscode.ExtensionContext;
    private messages: Message[] = [];
    private logger: AILogger;
    private providerSelector: ProviderSelector;
    private _settings: AISettings = DEFAULT_AI_SETTINGS;
    
    // Provider classes
    private openAIProvider: OpenAIProvider;
    private geminiProvider: GeminiProvider;
    private localProvider: LocalProvider;
    private anthropicProvider: AnthropicProvider;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.logger = new AILogger();
        this.providerSelector = new ProviderSelector();
        
        // Initialize providers
        this.openAIProvider = new OpenAIProvider(context);
        this.geminiProvider = new GeminiProvider(context);
        this.localProvider = new LocalProvider();
        this.anthropicProvider = new AnthropicProvider(context);
        
        // Load saved configuration
        const config = vscode.workspace.getConfiguration('byte');
        this.currentProvider = config.get<AIProvider>('provider') || AIProvider.OpenAI;
        
        // Load all saved messages (optional)
        const savedState = context.workspaceState.get<AIServiceState>('aiServiceState');
        if (savedState) {
            this.currentProvider = savedState.provider;
            this.messages = savedState.messages;
        }
        
        this.logger.log(`AI Service started. Active provider: ${this.currentProvider}`);
    }

    /**
     * Clears message history
     */
    public clearMessages(): void {
        this.messages = [];
        this.saveState();
    }

    /**
     * Saves current state
     */
    private saveState(): void {
        const state: AIServiceState = {
            provider: this.currentProvider,
            messages: this.messages
        };
        this.context.workspaceState.update('aiServiceState', state);
    }

    /**
     * Changes the AI Service provider
     */
    public setProvider(provider: AIProvider): void {
        this.currentProvider = provider;
        this.logger.log(`AI provider changed: ${provider}`);
        
        // Update configuration
        vscode.workspace.getConfiguration('byte').update('provider', provider, vscode.ConfigurationTarget.Global);
        
        this.saveState();
    }

    /**
     * Returns the current provider
     */
    public getProvider(): AIProvider {
        return this.currentProvider;
    }

    /**
     * Returns the current chat history
     */
    public getMessages(): Message[] {
        return [...this.messages];
    }

    /**
     * Sends a request to the AI service
     */
    public async sendMessage(userMessage: string): Promise<string> {
        try {
            // Calculate message complexity (simple metric)
            const taskComplexity = userMessage.length / 100; // Value between 0-1

            // Select optimal provider
            const optimalProvider = await this.providerSelector.selectOptimalProvider(
                this.currentProvider,
                this._settings,
                this.context,
                taskComplexity
            );
            
            if (optimalProvider !== this.currentProvider) {
                this.logger.log(`Automatic switch: ${this.currentProvider} -> ${optimalProvider}`);
                this.setProvider(optimalProvider);
            }

            // Add user message to history
            this.messages.push({ role: 'user', content: userMessage });
            
            let response: string;
            
            // Send request based on selected provider
            switch (this.currentProvider) {
                case AIProvider.OpenAI:
                    response = await this.openAIProvider.callOpenAI(userMessage, this.messages);
                    break;
                case AIProvider.Gemini:
                    response = await this.geminiProvider.callGemini(userMessage, this.messages);
                    break;
                case AIProvider.Local:
                    response = await this.localProvider.callLocalModel(userMessage, this.messages);
                    break;
                case AIProvider.Anthropic:
                    response = await this.anthropicProvider.callAnthropic(userMessage, this.messages);
                    break;
                default:
                    throw new Error('Unsupported AI provider');
            }
            
            // Update cost
            this.providerSelector.updateCost(
                this.currentProvider,
                userMessage.length,
                response.length
            );

            // Add AI response to history
            this.messages.push({ role: 'assistant', content: response });
            
            // Save state
            this.saveState();
            
            return response;
        } catch (error: any) {
            this.logger.log(`Error: ${error.message}`, true);
            throw error;
        }
    }

    /**
     * Special prompt for code explanation requests
     */
    public async explainCode(code: string): Promise<string> {
        const prompt = `Explain the following code line by line and describe in detail what it does:\n\n\`\`\`\n${code}\n\`\`\``;
        return this.sendMessage(prompt);
    }

    /**
     * Special prompt for code refactoring requests
     */
    public async refactorCode(code: string): Promise<string> {
        const prompt = `Refactor the following code to make it more readable, efficient, and compliant with best practices. Add explanations and reasons for improvements:\n\n\`\`\`\n${code}\n\`\`\``;
        return this.sendMessage(prompt);
    }

    /**
     * Gets AI response based on message history
     * @param messages Message history
     * @returns AI response
     */
    public async getResponse(messages: {role: string, content: string}[]): Promise<string> {
        try {
            // Get the last user message
            const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
            
            // Create a copy of the current message history
            const currentMessages = this.getMessages();
            
            // Forward system message
            const systemMessage = messages.find(m => m.role === 'system')?.content;
            if (systemMessage) {
                currentMessages.unshift({
                    role: 'system',
                    content: systemMessage
                });
            }
            
            // Get response
            const response = await this.sendMessage(lastUserMessage);
            return response;
        } catch (error: any) {
            console.error('Failed to get AI response:', error);
            throw new Error(`Error while getting AI response: ${error.message}`);
        }
    }

    /**
     * Returns current settings
     */
    public async getSettings(): Promise<AISettings> {
        const config = vscode.workspace.getConfiguration('byte');
        
        return {
            defaultProvider: config.get<string>('provider') || 'openai',
            openai: {
                apiKey: await this.openAIProvider.getApiKey() || '',
                model: config.get<string>('openai.model') || 'gpt-3.5-turbo'
            },
            gemini: {
                apiKey: await this.geminiProvider.getApiKey() || '',
                model: config.get<string>('gemini.model') || 'gemini-1.5-flash'
            },
            local: {
                endpoint: config.get<string>('local.endpoint') || 'http://localhost:11434/api/generate',
                model: config.get<string>('local.model') || 'llama2'
            },
            anthropic: {
                apiKey: await this.anthropicProvider.getApiKey() || '',
                model: config.get<string>('anthropic.model') || 'claude-3-sonnet'
            },
            autoSwitch: {
                enabled: config.get<boolean>('autoSwitch.enabled') !== false,
                maxCostPerDay: config.get<number>('autoSwitch.maxCostPerDay') || 1.0,
                preferredProvider: (config.get<string>('autoSwitch.preferredProvider') || 'most-accurate') as 'fastest' | 'cheapest' | 'most-accurate'
            },
            saveHistory: config.get<boolean>('saveHistory') !== false
        };
    }

    // Update settings
    public async updateSettings(settings: AISettings): Promise<void> {
        this._settings = settings;
    }
    
    // Helper methods for setting API keys
    public async setOpenAIApiKey(apiKey: string): Promise<void> {
        await this.openAIProvider.setApiKey(apiKey);
    }
    
    public async setGeminiApiKey(apiKey: string): Promise<void> {
        await this.geminiProvider.setApiKey(apiKey);
    }
    
    public async setAnthropicApiKey(apiKey: string): Promise<void> {
        await this.anthropicProvider.setApiKey(apiKey);
    }
} 