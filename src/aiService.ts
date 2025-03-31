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
        const prompt = `Analyze and explain the following code in detail. Please address these points:
1. What is the general purpose and function of the code?
2. What is the role of each function, method, or class?
3. Are there important algorithms or data structures? How do they work?
4. Are there any notable coding patterns or special techniques used?
5. What are potential areas for optimization or improvement?
6. What are the strengths and weaknesses of the code?

Make your explanations clear and comprehensive enough for both beginner and experienced developers to understand.

\`\`\`
${code}
\`\`\``;
        return this.sendMessage(prompt);
    }

    /**
     * Kod refaktör istekleri için özel prompt
     */
    public async refactorCode(code: string): Promise<string> {
        const prompt = `Refactor the following code to make it more readable, efficient, and aligned with modern coding practices. When refactoring:

1. Make changes that improve code quality (naming, structure, organization)
2. Suggest performance and efficiency improvements
3. Fix security vulnerabilities and bugs
4. Reduce code duplication and apply the DRY (Don't Repeat Yourself) principle
5. Increase adherence to SOLID principles
6. Use modern language features (if applicable)
7. Make changes that improve maintainability

Include brief explanations about the reason and benefits of each significant change. In your response, first provide the suggested code, then a section explaining the changes.

\`\`\`
${code}
\`\`\``;
        return this.sendMessage(prompt);
    }

    /**
     * Kod analizi istekleri için özel prompt
     */
    public async analyzeCode(code: string): Promise<string> {
        const prompt = `Perform a deep analysis of the following code and evaluate it in these categories:

1. Code Quality:
   - Code readability and complexity
   - Variable/function naming standards
   - Modularity and maintainability
   - Adherence to SOLID principles (if applicable)
   - Code duplication (DRY principle) check

2. Performance Analysis:
   - Algorithm efficiency and time complexity
   - Resource usage (memory, processing power)
   - Potential performance bottlenecks
   - Optimization suggestions

3. Security Assessment:
   - Potential security vulnerabilities
   - Input validation gaps
   - Authorization/authentication issues
   - Data exposure risks

4. Best Practices Compliance:
   - Proper use of language features
   - Use of modern programming techniques
   - Design pattern usage and evaluation
   - Testability

5. Potential Improvements:
   - Suggested changes and enhancements
   - Alternative approaches
   - Modern library or technology recommendations

While conducting this analysis, also highlight the code's strengths and provide a comprehensive, balanced assessment.

\`\`\`
${code}
\`\`\``;
        return this.sendMessage(prompt);
    }

    /**
     * Kod hata ayıklama istekleri için özel prompt
     */
    public async debugCode(code: string, errorMessage: string): Promise<string> {
        const prompt = `There's an error in the following code with this error message:

"${errorMessage}"

Please:
1. Identify and explain the exact cause of the error
2. Show where in the code the error occurs
3. Provide a step-by-step solution to fix the error
4. Suggest ways to prevent similar errors in the future

Errors may not just be syntax errors, but could be logical errors, performance issues, security vulnerabilities, or anti-patterns.

Carefully analyze the code and provide clear, actionable steps to resolve the issue.

\`\`\`
${code}
\`\`\``;
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
                content: `You are Byte, an advanced coding assistant designed to help software developers in their development processes.

Remember these key capabilities:
1. Provide well-designed, understandable, and efficient code examples.
2. Make suggestions to ensure code is not only functional but also readable and maintainable.
3. Carefully analyze user questions to provide responses appropriate to their experience level.
4. Follow proper language rules and be clear and concise in your answers.
5. Provide current information on coding standards, best practices, and security.
6. When explaining code or suggesting improvements, provide clear examples.
7. Break down complex questions into comprehensive responses when needed.
8. Stay informed about modern software development methodologies, tools, and libraries.

Fully understand users' questions and provide technically accurate and detailed answers. Ask for additional information when queries are ambiguous. Always recommend the most up-to-date and best coding practices.`
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
        let result = `You are Byte, an advanced coding assistant designed to help software developers in their development processes.

Remember these key capabilities:
1. Provide well-designed, understandable, and efficient code examples.
2. Make suggestions to ensure code is not only functional but also readable and maintainable.
3. Carefully analyze user questions to provide responses appropriate to their experience level.
4. Follow proper language rules and be clear and concise in your answers.
5. Provide current information on coding standards, best practices, and security.
6. When explaining code or suggesting improvements, provide clear examples.
7. Break down complex questions into comprehensive responses when needed.
8. Stay informed about modern software development methodologies, tools, and libraries.

Fully understand users' questions and provide technically accurate and detailed answers. Ask for additional information when queries are ambiguous. Always recommend the most up-to-date and best coding practices.\n\n`;
        
        // Son 5 mesajı ekle (limit)
        const recentMessages = this.messages.slice(-5);
        
        recentMessages.forEach(message => {
            if (message.role === 'user') {
                result += `User: ${message.content}\n\n`;
            } else {
                result += `Assistant: ${message.content}\n\n`;
            }
        });
        
        return result;
    }

    /**
     * Yerel model için mesaj formatına dönüştürme
     */
    private formatMessagesForLocal(): string {
        // Sistem yönergeleri
        let result = `You are Byte, an advanced coding assistant designed to help software developers in their development processes.

Remember these key capabilities:
1. Provide well-designed, understandable, and efficient code examples.
2. Make suggestions to ensure code is not only functional but also readable and maintainable.
3. Carefully analyze user questions to provide responses appropriate to their experience level.
4. Follow proper language rules and be clear and concise in your answers.
5. Provide current information on coding standards, best practices, and security.
6. When explaining code or suggesting improvements, provide clear examples.
7. Break down complex questions into comprehensive responses when needed.
8. Stay informed about modern software development methodologies, tools, and libraries.

Fully understand users' questions and provide technically accurate and detailed answers. Ask for additional information when queries are ambiguous. Always recommend the most up-to-date and best coding practices.\n\n`;
        
        // Son 5 mesajı ekle (limit)
        const recentMessages = this.messages.slice(-5);
        
        recentMessages.forEach(message => {
            if (message.role === 'user') {
                result += `User: ${message.content}\n\n`;
            } else {
                result += `Assistant: ${message.content}\n\n`;
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