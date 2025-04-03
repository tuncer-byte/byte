import * as vscode from 'vscode';
import { 
    AIProvider, 
    AISettings,
    AIServiceState, 
    Message,
    CacheSettings,
    CacheLookupResult,
    CacheOperationResult
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
import { CacheManager } from './utils/cache-manager';

/**
 * Class that provides integration with AI Services
 */
export class AIService {
    private openAIProvider: OpenAIProvider;
    private geminiProvider: GeminiProvider;
    private localProvider: LocalProvider;
    private anthropicProvider: AnthropicProvider;
    private providerSelector: ProviderSelector;
    private logger: AILogger;
    private messages: Message[] = [];
    private currentProvider: AIProvider;
    private _settings: AISettings = DEFAULT_AI_SETTINGS;

    constructor(private context: vscode.ExtensionContext) {
        this.logger = new AILogger();
        
        // Initialize all providers
        this.openAIProvider = new OpenAIProvider(context);
        this.geminiProvider = new GeminiProvider(context);
        this.localProvider = new LocalProvider();
        this.anthropicProvider = new AnthropicProvider(context);
        
        // Initialize provider selector for smart routing
        this.providerSelector = new ProviderSelector();
        
        // Set default provider from configuration
        const config = vscode.workspace.getConfiguration('byte');
        const defaultProvider = config.get<string>('ai.defaultProvider') || 'openai';
        
        // Convert string to enum
        this.currentProvider = AIProvider[defaultProvider as keyof typeof AIProvider] || AIProvider.OpenAI;
        
        // Load message history from state
        this.loadState();
        
        this.logger.log(`AI Service initialized with provider: ${this.currentProvider}`);
    }

    /**
     * Mevcut durumu yükler
     */
    private loadState(): void {
        const savedState = this.context.workspaceState.get<AIServiceState>('aiServiceState');
        if (savedState) {
            this.currentProvider = savedState.provider;
            this.messages = savedState.messages;
        }
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
                    // Gemini içim cacheleme özelliğini kullanma
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
     * Dosya içeriğini Byte AI için önbelleğe alır - Artık kullanılmıyor
     */
    public async cacheFileContent(fileContent: string, fileName: string): Promise<string | null> {
        // Bu özellik artık desteklenmiyor
        return null;
    }
    
    /**
     * Önbellek ayarlarını günceller - Artık kullanılmıyor
     */
    public updateCacheSettings(enabled: boolean): void {
        // Bu özellik artık desteklenmiyor
    }
    
    /**
     * Tüm önbelleği temizler - Artık kullanılmıyor
     */
    public clearAllCache(): void {
        // Bu özellik artık desteklenmiyor
    }
    
    /**
     * Önbelleği yeniler - Artık kullanılmıyor 
     */
    public refreshCache(): void {
        // Bu özellik artık desteklenmiyor
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
            saveHistory: config.get<boolean>('saveHistory') !== false,
            cache: {
                enabled: config.get<boolean>('cache.enabled') ?? true,
                defaultTtl: config.get<string>('cache.defaultTtl') ?? '3600s',
                maxCachedItems: config.get<number>('cache.maxCachedItems') ?? 50,
                automaticCaching: config.get<boolean>('cache.automaticCaching') ?? true
            }
        };
    }

    /**
     * Ayarları günceller
     */
    public async updateSettings(settings: Partial<AISettings>): Promise<void> {
        // Varsayılan sağlayıcıyı güncelle
        if (settings.defaultProvider) {
            // String değerini enum tipine dönüştür
            const provider = AIProvider[settings.defaultProvider as keyof typeof AIProvider];
            if (provider) {
                this.setProvider(provider);
            }
        }

        // Model ayarlarını güncelle (OpenAI için)
        if (settings.openai) {
            if (settings.openai.apiKey) {
                await this.openAIProvider.setApiKey(settings.openai.apiKey);
            }
        }
        
        // Gemini ayarlarını güncelle
        if (settings.gemini) {
            if (settings.gemini.apiKey) {
                await this.geminiProvider.setApiKey(settings.gemini.apiKey);
            }
        }
        
        // Anthropic ayarlarını güncelle
        if (settings.anthropic) {
            if (settings.anthropic.apiKey) {
                await this.anthropicProvider.setApiKey(settings.anthropic.apiKey);
            }
        }
        
        // Mevcut ayarları güncelle
        this._settings = { ...this._settings, ...settings };
        
        // Ayarları kaydet
        this.saveState();
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