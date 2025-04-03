import * as vscode from 'vscode';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Inline Chat istek tipi
 */
export interface InlineRequest {
    code: string;
    language: string;
    fileName: string;
    query: string;
}

/**
 * AI yanıt tipi
 */
export interface AIResponse {
    text: string;
    suggestedEdits?: {
        range: {
            startLine: number;
            startColumn: number;
            endLine: number;
            endColumn: number;
        };
        newText: string;
    }[];
}

/**
 * Byte AI ile iletişim kuracak client sınıfı
 */
export class ByteAIClient {
    private readonly _apiClient: AxiosInstance;
    private readonly _apiKey: string;
    private readonly _apiEndpoint: string;
    
    /**
     * ByteAIClient constructor
     */
    constructor() {
        // API ayarlarını config'den al
        const config = vscode.workspace.getConfiguration('byteAI');
        this._apiKey = config.get<string>('apiKey') || '';
        this._apiEndpoint = config.get<string>('apiEndpoint') || 'https://api.byteai.app/v1';
        
        // Axios istemcisini oluştur
        this._apiClient = axios.create({
            baseURL: this._apiEndpoint,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this._apiKey}`
            }
        });
    }
    
    /**
     * API anahtarı ve API endpoint'in varlığını doğrular
     */
    public validateCredentials(): boolean {
        return !!this._apiKey && !!this._apiEndpoint;
    }
    
    /**
     * API anahtarını günceller
     */
    public updateApiKey(apiKey: string): void {
        const config = vscode.workspace.getConfiguration('byteAI');
        config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
        
        // Header'ı güncelle
        this._apiClient.defaults.headers.common['Authorization'] = `Bearer ${apiKey}`;
    }
    
    /**
     * Inline chat isteği gönderir ve AI'dan yanıt alır
     */
    public async sendInlineRequest(request: InlineRequest): Promise<AIResponse> {
        try {
            // API anahtarını doğrula
            if (!this.validateCredentials()) {
                throw new Error('API anahtarı veya endpoint tanımlanmamış. Ayarlar üzerinden yapılandırın.');
            }
            
            // API isteği gönder
            const response: AxiosResponse = await this._apiClient.post('/inline-chat', {
                code: request.code,
                language: request.language,
                fileName: request.fileName,
                query: request.query
            });
            
            // Yanıtı döndür
            return {
                text: response.data.text || 'Yanıt alınamadı.',
                suggestedEdits: response.data.suggestedEdits
            };
        } catch (error: any) {
            console.error('AI istek hatası:', error);
            
            // HTTP hatası mı?
            if (error.response) {
                const status = error.response.status;
                let errorMessage = error.response.data?.error || 'Bilinmeyen hata';
                
                if (status === 401) {
                    throw new Error('API anahtarı geçersiz. Lütfen geçerli bir API anahtarı girin.');
                } else if (status === 403) {
                    // 403 hataları - İzin reddedildi
                    errorMessage = (
                        error.response.data.includes('rate limit') || 
                        error.response.data.includes('quota')
                    ) 
                        ? 'API kotası aşıldı. Lütfen daha sonra tekrar deneyin.'
                        : 'Erişim reddedildi. API anahtarınızı kontrol edin veya yöneticinize başvurun.';
                    throw new Error(errorMessage);
                } else if (status === 429) {
                    throw new Error('İstek limiti aşıldı. Lütfen daha sonra tekrar deneyin.');
                } else {
                    throw new Error(`Sunucu hatası (${status}): ${errorMessage}`);
                }
            }
            
            // Ağ hatası mı?
            if (error.request) {
                throw new Error('Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.');
            }
            
            // Diğer hatalar
            throw new Error(`Hata: ${error.message || 'Bilinmeyen bir hata oluştu'}`);
        }
    }
} 