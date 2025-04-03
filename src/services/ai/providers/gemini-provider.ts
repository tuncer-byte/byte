import * as vscode from 'vscode';
import fetch from 'node-fetch';
import { Message, CachedContent } from '../types';
import { AILogger } from '../utils/logger';
import { CacheManager } from '../utils/cache-manager';

/**
 * Provider class that communicates with Google Gemini service
 */
export class GeminiProvider {
    private logger: AILogger;
    private cacheManager: CacheManager | null = null;
    
    constructor(private context: vscode.ExtensionContext) {
        this.logger = new AILogger();
    }
    
    /**
     * Önbellek yöneticisini ayarlar
     */
    public setCacheManager(cacheManager: CacheManager): void {
        this.cacheManager = cacheManager;
    }
    
    /**
     * Sends a request to Google Gemini API
     */
    public async callGemini(userMessage: string, messages: Message[], cacheId?: string): Promise<string> {
        // Get API key
        let apiKey = await this.getApiKey();
        
        if (!apiKey) {
            throw new Error('Google Gemini API key not found. Please configure it.');
        }
        
        // Get model name from configuration, use gemini-1.5-flash as default
        const config = vscode.workspace.getConfiguration('byte');
        const modelName = config.get<string>('gemini.model') || 'gemini-1.5-flash';
        
        this.logger.log(`Sending Gemini API request (model: ${modelName})...`);
        
        // Önbellek etkin ve bir önbellek yöneticisi var mı kontrol et
        const cacheEnabled = config.get<boolean>('cache.enabled') ?? true;
        const automaticCaching = config.get<boolean>('cache.automaticCaching') ?? true;
        
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
            
            // Önbelleği kullan (belirtilmişse)
            if (cacheEnabled && this.cacheManager && cacheId) {
                const cacheResult = this.cacheManager.getCache(cacheId);
                if (cacheResult.found && cacheResult.cachedContent) {
                    this.logger.log(`Using cached content (ID: ${cacheId}, saved tokens: ${cacheResult.tokensSaved || 0})`);
                    requestBody.cachedContent = cacheResult.cachedContent.name;
                }
            }
            // Otomatik önbellekleme yapılıyorsa ve içerik benzersem önbellek ara
            else if (cacheEnabled && automaticCaching && this.cacheManager) {
                const cacheResult = this.cacheManager.findCacheByContent(userMessage, modelName);
                if (cacheResult.found && cacheResult.cachedContent) {
                    this.logger.log(`Found matching cached content (saved tokens: ${cacheResult.tokensSaved || 0})`);
                    requestBody.cachedContent = cacheResult.cachedContent.name;
                }
            }
            
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
            
            // Otomatik önbellekleme yapılıyorsa yeni bir önbellek oluştur
            if (cacheEnabled && automaticCaching && this.cacheManager 
                && !requestBody.cachedContent // Zaten önbellek kullanmadıysa
                && messages.length > 2 // En az birkaç mesaj olsun
            ) {
                const cacheableContents = this.cacheManager.convertMessagesToContents(messages);
                
                // Sistem talimatını hazırla
                const systemInstruction = {
                    role: "system",
                    parts: [{
                        text: "You are Byte, an intelligent coding assistant."
                    }]
                };
                
                try {
                    const cacheResult = await this.cacheManager.createCache(
                        modelName,
                        cacheableContents,
                        systemInstruction
                    );
                    
                    if (cacheResult.success) {
                        this.logger.log(`Automatically created cache (ID: ${cacheResult.cacheId})`);
                    }
                } catch (error) {
                    this.logger.log(`Failed to create cache: ${error}`, true);
                    // İşlemi kesme, sadece kaydet
                }
            }
            
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
                text: `You are Byte, an intelligent coding assistant. You help users with programming questions and provide clear, concise explanations. 
                
Guidelines:
- Always respond in Turkish with proper grammar and clear explanations
- Provide code examples when relevant
- Explain complex concepts in simple terms
- When showing code, include comments to explain key parts
- Format your responses with markdown for readability
- If you're unsure about something, acknowledge it rather than guessing
- Focus on being helpful, accurate, and educational
                
Now, please assist the user with their programming questions.`
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
     * Dosya içeriğini Gemini API için önbelleğe alır
     * @param fileContent Dosya içeriği
     * @param fileName Dosya adı
     * @param mimeType MIME tipi
     * @param modelName Model adı
     * @returns Önbellek işlemi sonucu
     */
    public async cacheFileContent(
        fileContent: string, 
        fileName: string,
        mimeType: string = "text/plain",
        modelName?: string
    ): Promise<string | null> {
        if (!this.cacheManager) {
            return null;
        }
        
        const config = vscode.workspace.getConfiguration('byte');
        const model = modelName || config.get<string>('gemini.model') || 'gemini-1.5-flash';
        
        try {
            // Dosya içeriğini content formatına dönüştür
            const fileContentObj = {
                role: "user",
                parts: [{
                    text: fileContent
                }]
            };
            
            // Sistem talimatını hazırla
            const systemInstruction = {
                role: "system",
                parts: [{
                    text: `This is a file named "${fileName}" with content type "${mimeType}". Analyze and process it as needed.`
                }]
            };
            
            const result = await this.cacheManager.createCache(
                model,
                [fileContentObj],
                systemInstruction,
                undefined, // varsayılan TTL
                `File: ${fileName}`
            );
            
            if (result.success && result.cacheId) {
                this.logger.log(`File cached successfully: ${fileName} (cache ID: ${result.cacheId})`);
                return result.cacheId;
            }
            
            return null;
        } catch (error) {
            this.logger.log(`Failed to cache file: ${error}`, true);
            return null;
        }
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