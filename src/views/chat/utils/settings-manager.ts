import * as vscode from 'vscode';
import { AIService, AISettings } from '../../../services/ai';
import { SettingsMessageStatus } from '../types';

/**
 * Chat paneli için ayarlar yöneticisi
 */
export class SettingsManager {
    constructor(
        private view: vscode.WebviewView | undefined,
        private aiService: AIService
    ) {}

    /**
     * WebView'e mevcut ayarları gönderir
     */
    public async sendSettingsToWebView(): Promise<void> {
        try {
            // Mevcut ayarları getir
            const settings = await this.aiService.getSettings();
            
            // WebView'e ayarları gönder
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'settingsUpdated',
                    settings: settings
                });
            }
        } catch (error: any) {
            console.error('Ayarlar yüklenirken hata oluştu:', error);
            // Hata durumunda WebView'e bildir
            this.sendSettingsError(`Ayarlar yüklenirken hata oluştu: ${error.message}`);
        }
    }

    /**
     * WebView'den gelen ayarları kaydeder
     */
    public async saveSettings(settings: AISettings): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('byte');
            
            try {
                // Varsayılan sağlayıcıyı kaydet
                await config.update('provider', settings.defaultProvider, vscode.ConfigurationTarget.Global);
            } catch (err: any) {
                console.error('Varsayılan sağlayıcı kaydedilirken hata oluştu:', err);
                this.sendSettingsError(`Varsayılan sağlayıcı ayarlanamadı: ${err.message}`);
                return;
            }
            
            // API anahtarlarını güvenli depolamaya kaydet
            try {
                if (settings.openai.apiKey) {
                    await this.aiService.setOpenAIApiKey(settings.openai.apiKey);
                }
                
                if (settings.gemini.apiKey) {
                    await this.aiService.setGeminiApiKey(settings.gemini.apiKey);
                }
                
                if (settings.anthropic.apiKey) {
                    await this.aiService.setAnthropicApiKey(settings.anthropic.apiKey);
                }
                
                // Ayarları güncelle
                await this.aiService.updateSettings(settings);
                
                // Mesaj göster
                this.sendSettingsMessage('success', 'Ayarlar başarıyla kaydedildi!');
                
                // Başarılı kayıt bilgisini ayrıca gönder
                if (this.view) {
                    this.view.webview.postMessage({
                        type: 'settingsSaved',
                        success: true
                    });
                }
            } catch (error: any) {
                this.sendSettingsError(`Ayarlar kaydedilirken hata oluştu: ${error.message}`);
                return;
            }
        } catch (error: any) {
            console.error('Ayarlar kaydedilirken genel hata oluştu:', error);
            this.sendSettingsError(`Ayarlar kaydedilirken hata oluştu: ${error.message}`);
            return;
        }
    }

    /**
     * Ayar hatası mesajını WebView'e gönderir
     */
    public sendSettingsError(errorMessage: string): void {
        if (this.view) {
            this.view.webview.postMessage({
                type: 'settingsError',
                error: errorMessage
            });
        }
    }

    /**
     * Ayarlar için durum mesajını gönderir
     */
    public sendSettingsMessage(status: SettingsMessageStatus, message: string): void {
        if (this.view) {
            this.view.webview.postMessage({
                type: 'settingsMessage',
                status,
                message
            });
        }
    }
} 