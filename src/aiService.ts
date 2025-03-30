import * as vscode from 'vscode';
import fetch from 'node-fetch';

// AI Provider türleri
export enum AIProvider {
    OpenAI = 'openai',
    Gemini = 'gemini',
    Local = 'local'
}

// Mesaj tipi tanımlaması
export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

// Yapılandırma durumu için arayüz
export interface AIServiceState {
    provider: AIProvider;
    messages: Message[];
}

/**
 * AI Servisleri ile entegrasyonu sağlayan sınıf
 */
export class AIService {
    private currentProvider: AIProvider;
    private context: vscode.ExtensionContext;
    private messages: Message[] = [];
    private outputChannel: vscode.OutputChannel;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel("Byte AI");
        
        // Kayıtlı yapılandırmayı yükle
        const config = vscode.workspace.getConfiguration('byte');
        this.currentProvider = config.get<AIProvider>('provider') || AIProvider.OpenAI;
        
        // Kayıtlı tüm mesajları yükle (isteğe bağlı)
        const savedState = context.workspaceState.get<AIServiceState>('aiServiceState');
        if (savedState) {
            this.currentProvider = savedState.provider;
            this.messages = savedState.messages;
        }
        
        this.log(`AI Servisi başlatıldı. Aktif sağlayıcı: ${this.currentProvider}`);
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
        this.log(`AI sağlayıcı değiştirildi: ${provider}`);
        
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
            // Kullanıcı mesajını geçmişe ekle
            this.messages.push({ role: 'user', content: userMessage });
            
            let response: string;
            
            // Seçili sağlayıcıya göre istek gönder
            switch (this.currentProvider) {
                case AIProvider.OpenAI:
                    response = await this.callOpenAI(userMessage);
                    break;
                case AIProvider.Gemini:
                    response = await this.callGemini(userMessage);
                    break;
                case AIProvider.Local:
                    response = await this.callLocalModel(userMessage);
                    break;
                default:
                    throw new Error('Desteklenmeyen AI sağlayıcı');
            }
            
            // AI yanıtını geçmişe ekle
            this.messages.push({ role: 'assistant', content: response });
            
            // Durumu kaydet
            this.saveState();
            
            return response;
        } catch (error: any) {
            this.log(`Hata: ${error.message}`, true);
            throw error;
        }
    }

    /**
     * OpenAI API'sine istek gönderir
     */
    private async callOpenAI(userMessage: string): Promise<string> {
        // API anahtarını secret storage'dan al
        let apiKey = await this.getOpenAIApiKey();
        
        if (!apiKey) {
            throw new Error('OpenAI API anahtarı bulunamadı. Lütfen yapılandırın.');
        }
        
        // OpenAI chat formatındaki mesaj geçmişini oluştur
        const messages = this.formatMessagesForOpenAI();
        messages.push({ role: 'user', content: userMessage });
        
        this.log('OpenAI API isteği gönderiliyor...');
        
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: messages,
                    temperature: 0.7
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`OpenAI API Hatası: ${response.status} - ${JSON.stringify(errorData)}`);
            }
            
            const data = await response.json();
            const assistantResponse = data.choices[0].message.content;
            
            this.log('OpenAI API yanıtı alındı');
            return assistantResponse;
        } catch (error: any) {
            this.log(`OpenAI API Hatası: ${error.message}`, true);
            throw new Error(`OpenAI API isteği başarısız: ${error.message}`);
        }
    }

    /**
     * Google Gemini API'sine istek gönderir
     */
    private async callGemini(userMessage: string): Promise<string> {
        // API anahtarını al
        let apiKey = await this.getGeminiApiKey();
        
        if (!apiKey) {
            throw new Error('Google Gemini API anahtarı bulunamadı. Lütfen yapılandırın.');
        }
        
        // Yapılandırmadan model adını al, varsayılan olarak gemini-1.5-flash kullan
        const config = vscode.workspace.getConfiguration('byte');
        const modelName = config.get<string>('gemini.model') || 'gemini-1.5-flash';
        
        this.log(`Gemini API isteği gönderiliyor (model: ${modelName})...`);
        
        try {
            // Gemini API endpoint'i - model adını dinamik olarak ayarla
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            
            // Kullanıcı mesajını ve geçmiş sohbeti birleştir
            const promptText = this.formatMessagesForGemini() + "\n\nKullanıcı: " + userMessage;
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                { text: promptText }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.7
                    }
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                this.log(`Gemini API yanıt hatası: ${JSON.stringify(errorData)}`, true);
                
                // Eğer model bulunamadı hatası alındıysa, desteklenen modelleri göster
                if (errorData.error && errorData.error.code === 404) {
                    throw new Error(`Gemini API Hatası: Model "${modelName}" bulunamadı. Lütfen gemini-1.5-flash veya gemini-1.0-pro gibi geçerli bir model kullanın.`);
                }
                
                throw new Error(`Gemini API Hatası: ${response.status} - ${JSON.stringify(errorData)}`);
            }
            
            const data = await response.json();
            const assistantResponse = data.candidates[0].content.parts[0].text;
            
            this.log('Gemini API yanıtı alındı');
            return assistantResponse;
        } catch (error: any) {
            this.log(`Gemini API Hatası: ${error.message}`, true);
            throw new Error(`Gemini API isteği başarısız: ${error.message}`);
        }
    }

    /**
     * Yerel modele istek gönderir
     */
    private async callLocalModel(userMessage: string): Promise<string> {
        // Yerel model endpoint'i
        const config = vscode.workspace.getConfiguration('byte');
        const endpoint = config.get<string>('local.endpoint') || 'http://localhost:8000/v1/completions';
        
        this.log(`Yerel model isteği gönderiliyor (${endpoint})...`);
        
        try {
            // Mesaj geçmişini birleştir
            const prompt = this.formatMessagesForLocal() + "\n\nKullanıcı: " + userMessage + "\n\nAsistan: ";
            
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: prompt,
                    max_tokens: 1000,
                    temperature: 0.7
                })
            });
            
            if (!response.ok) {
                throw new Error(`Yerel model API Hatası: ${response.status}`);
            }
            
            const data = await response.json();
            // API yanıt formatına göre çıkarımı uyarla
            const assistantResponse = data.choices ? data.choices[0].text : data.response;
            
            this.log('Yerel model yanıtı alındı');
            return assistantResponse;
        } catch (error: any) {
            this.log(`Yerel model API Hatası: ${error.message}`, true);
            throw new Error(`Yerel model isteği başarısız: ${error.message}`);
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
     * OpenAI API mesaj formatına dönüştürme
     */
    private formatMessagesForOpenAI(): any[] {
        // Sistem mesajı ekle
        const formattedMessages = [
            { 
                role: 'system', 
                content: 'Sen Byte adlı bir kodlama asistanısın. Kullanıcıların programlama sorularına yardımcı ol. Yanıtlarında Türkçe dil kurallarına uy ve net, anlaşılır olarak cevap ver. Kod örnekleri ve açıklamalar ekleyebilirsin.'
            }
        ];
        
        // Son 10 mesajı ekle (limit)
        const recentMessages = this.messages.slice(-10);
        recentMessages.forEach(message => {
            formattedMessages.push({
                role: message.role,
                content: message.content
            });
        });
        
        return formattedMessages;
    }

    /**
     * Gemini API için mesaj formatına dönüştürme
     */
    private formatMessagesForGemini(): string {
        // Sistem yönergeleri
        let result = "Sen Byte adlı bir kodlama asistanısın. Kullanıcıların programlama sorularına yardımcı ol. Yanıtlarında Türkçe dil kurallarına uy ve net, anlaşılır olarak cevap ver.\n\n";
        
        // Son 5 mesajı ekle (limit)
        const recentMessages = this.messages.slice(-5);
        
        recentMessages.forEach(message => {
            if (message.role === 'user') {
                result += `Kullanıcı: ${message.content}\n\n`;
            } else {
                result += `Asistan: ${message.content}\n\n`;
            }
        });
        
        return result;
    }

    /**
     * Yerel model için mesaj formatına dönüştürme
     */
    private formatMessagesForLocal(): string {
        // Sistem yönergeleri
        let result = "Sen Byte adlı bir kodlama asistanısın. Kullanıcıların programlama sorularına yardımcı ol. Yanıtlarında Türkçe dil kurallarına uy ve net, anlaşılır olarak cevap ver.\n\n";
        
        // Son 5 mesajı ekle (limit)
        const recentMessages = this.messages.slice(-5);
        
        recentMessages.forEach(message => {
            if (message.role === 'user') {
                result += `Kullanıcı: ${message.content}\n\n`;
            } else {
                result += `Asistan: ${message.content}\n\n`;
            }
        });
        
        return result;
    }

    /**
     * OpenAI API anahtarını güvenli depodan alır
     */
    private async getOpenAIApiKey(): Promise<string | undefined> {
        // Önce secret storage'dan anahtarı almayı dene
        let apiKey = await this.context.secrets.get('openai-api-key');
        
        // Secret storage'da yoksa, ayarlardan al
        if (!apiKey) {
            const config = vscode.workspace.getConfiguration('byte');
            apiKey = config.get<string>('openai.apiKey');
        }
        
        return apiKey;
    }

    /**
     * Google Gemini API anahtarını güvenli depodan alır
     */
    private async getGeminiApiKey(): Promise<string | undefined> {
        // Önce secret storage'dan anahtarı almayı dene
        let apiKey = await this.context.secrets.get('gemini-api-key');
        
        // Secret storage'da yoksa, ayarlardan al
        if (!apiKey) {
            const config = vscode.workspace.getConfiguration('byte');
            apiKey = config.get<string>('gemini.apiKey');
        }
        
        return apiKey;
    }

    /**
     * OpenAI API anahtarını güvenli depoya kaydeder
     */
    public async setOpenAIApiKey(apiKey: string): Promise<void> {
        await this.context.secrets.store('openai-api-key', apiKey);
        this.log('OpenAI API anahtarı güvenli depoya kaydedildi');
    }

    /**
     * Google Gemini API anahtarını güvenli depoya kaydeder
     */
    public async setGeminiApiKey(apiKey: string): Promise<void> {
        await this.context.secrets.store('gemini-api-key', apiKey);
        this.log('Gemini API anahtarı güvenli depoya kaydedildi');
    }

    /**
     * Loglama fonksiyonu
     */
    private log(message: string, error: boolean = false): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}`;
        
        this.outputChannel.appendLine(logMessage);
        
        if (error) {
            console.error(logMessage);
        } else {
            console.log(logMessage);
        }
    }
}