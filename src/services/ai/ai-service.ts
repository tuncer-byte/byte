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
 * AI Servisleri ile entegrasyonu sağlayan sınıf
 */
export class AIService {
    private currentProvider: AIProvider;
    private context: vscode.ExtensionContext;
    private messages: Message[] = [];
    private logger: AILogger;
    private providerSelector: ProviderSelector;
    private _settings: AISettings = DEFAULT_AI_SETTINGS;
    
    // Provider sınıfları
    private openAIProvider: OpenAIProvider;
    private geminiProvider: GeminiProvider;
    private localProvider: LocalProvider;
    private anthropicProvider: AnthropicProvider;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.logger = new AILogger();
        this.providerSelector = new ProviderSelector();
        
        // Provider'ları başlat
        this.openAIProvider = new OpenAIProvider(context);
        this.geminiProvider = new GeminiProvider(context);
        this.localProvider = new LocalProvider();
        this.anthropicProvider = new AnthropicProvider(context);
        
        // Kayıtlı yapılandırmayı yükle
        const config = vscode.workspace.getConfiguration('byte');
        this.currentProvider = config.get<AIProvider>('provider') || AIProvider.OpenAI;
        
        // Kayıtlı tüm mesajları yükle (isteğe bağlı)
        const savedState = context.workspaceState.get<AIServiceState>('aiServiceState');
        if (savedState) {
            this.currentProvider = savedState.provider;
            this.messages = savedState.messages;
        }
        
        this.logger.log(`AI Servisi başlatıldı. Aktif sağlayıcı: ${this.currentProvider}`);
    }

    /**
     * Mesaj geçmişini temizler
     */
    public clearMessages(): void {
        this.messages = [];
        this.saveState();
    }

    /**
     * Mevcut durumu kaydeder
     */
    private saveState(): void {
        const state: AIServiceState = {
            provider: this.currentProvider,
            messages: this.messages
        };
        this.context.workspaceState.update('aiServiceState', state);
    }

    /**
     * AI Servis sağlayıcısını değiştirir
     */
    public setProvider(provider: AIProvider): void {
        this.currentProvider = provider;
        this.logger.log(`AI sağlayıcı değiştirildi: ${provider}`);
        
        // Yapılandırmayı güncelle
        vscode.workspace.getConfiguration('byte').update('provider', provider, vscode.ConfigurationTarget.Global);
        
        this.saveState();
    }

    /**
     * Mevcut sağlayıcıyı döndürür
     */
    public getProvider(): AIProvider {
        return this.currentProvider;
    }

    /**
     * Mevcut sohbet geçmişini döndürür
     */
    public getMessages(): Message[] {
        return [...this.messages];
    }

    /**
     * AI servisine bir istek gönderir
     */
    public async sendMessage(userMessage: string): Promise<string> {
        try {
            // Mesaj karmaşıklığını hesapla (basit bir metrik)
            const taskComplexity = userMessage.length / 100; // 0-1 arası bir değer

            // Optimal sağlayıcıyı seç
            const optimalProvider = await this.providerSelector.selectOptimalProvider(
                this.currentProvider,
                this._settings,
                this.context,
                taskComplexity
            );
            
            if (optimalProvider !== this.currentProvider) {
                this.logger.log(`Otomatik geçiş: ${this.currentProvider} -> ${optimalProvider}`);
                this.setProvider(optimalProvider);
            }

            // Kullanıcı mesajını geçmişe ekle
            this.messages.push({ role: 'user', content: userMessage });
            
            let response: string;
            
            // Seçili sağlayıcıya göre istek gönder
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
                    throw new Error('Desteklenmeyen AI sağlayıcı');
            }
            
            // Maliyeti güncelle
            this.providerSelector.updateCost(
                this.currentProvider,
                userMessage.length,
                response.length
            );

            // AI yanıtını geçmişe ekle
            this.messages.push({ role: 'assistant', content: response });
            
            // Durumu kaydet
            this.saveState();
            
            return response;
        } catch (error: any) {
            this.logger.log(`Hata: ${error.message}`, true);
            throw error;
        }
    }

    /**
     * Kod açıklama istekleri için özel prompt
     */
    public async explainCode(code: string): Promise<string> {
        const prompt = `Aşağıdaki kodu satır satır açıkla ve ne yaptığını detaylı olarak anlat:\n\n\`\`\`\n${code}\n\`\`\``;
        return this.sendMessage(prompt);
    }

    /**
     * Kod refaktör istekleri için özel prompt
     */
    public async refactorCode(code: string): Promise<string> {
        const prompt = `Aşağıdaki kodu daha okunabilir, verimli ve iyi pratiklere uygun olacak şekilde refaktör et. Açıklamalar ve iyileştirme nedenleri ekle:\n\n\`\`\`\n${code}\n\`\`\``;
        return this.sendMessage(prompt);
    }

    /**
     * Mesaj geçmişine göre AI yanıtı alır
     * @param messages Mesaj geçmişi
     * @returns AI yanıtı
     */
    public async getResponse(messages: {role: string, content: string}[]): Promise<string> {
        try {
            // Son kullanıcı mesajını al
            const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || '';
            
            // Mevcut mesaj geçmişinin bir kopyasını oluştur
            const currentMessages = this.getMessages();
            
            // Sistem mesajını ilet
            const systemMessage = messages.find(m => m.role === 'system')?.content;
            if (systemMessage) {
                currentMessages.unshift({
                    role: 'system',
                    content: systemMessage
                });
            }
            
            // Yanıtı al
            const response = await this.sendMessage(lastUserMessage);
            return response;
        } catch (error: any) {
            console.error('AI yanıtı alınamadı:', error);
            throw new Error(`AI yanıtı alınırken hata oluştu: ${error.message}`);
        }
    }

    /**
     * Mevcut ayarları döndürür
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

    // Ayarları güncelle
    public async updateSettings(settings: AISettings): Promise<void> {
        this._settings = settings;
    }
    
    // API Anahtarlarını set etme yardımcı metodları
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