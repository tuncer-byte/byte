import * as vscode from 'vscode';
import { AIProvider, AIService } from '../../../services/ai';
import { WebViewMessage } from '../types';
import { SettingsManager } from '../utils/settings-manager';
import { cleanCodeForApply, sendOllamaRequest } from '../utils/helpers';
import { processSlashCommand } from './slash-commands';

/**
 * WebView mesajlarını işleyen sınıf
 */
export class MessageHandler {
    private settingsManager: SettingsManager;
    
    constructor(
        private view: vscode.WebviewView | undefined,
        private aiService: AIService,
        private commandManager: any,
        private agentEnabled: boolean = true,
        private currentFile: string = ''
    ) {
        this.settingsManager = new SettingsManager(view, aiService);
    }
    
    /**
     * WebView'den gelen mesajları işler
     */
    public async handleMessage(message: WebViewMessage): Promise<void> {
        try {
            switch (message.type) {
                case 'webviewReady':
                    // WebView hazır olduğunda mevcut durumu gönder
                    this.updateView();
                    break;
                
                case 'sendMessage':
                    // Kullanıcı mesajını AI servisine iletir
                    await this.handleUserMessage(message);
                    break;
                
                case 'changeProvider':
                    // Kullanıcı AI sağlayıcısını değiştirdiğinde
                    await this.changeProvider(message.provider as AIProvider);
                    break;
                
                case 'agentStatusChanged':
                    // Agent özelliğinin durumunu güncelle
                    this.agentEnabled = message.enabled;
                    break;
                
                case 'sendFile':
                    // Mevcut dosyayı AI'ya gönder
                    await this.sendFileToAI('');
                    break;
                
                case 'selectFile':
                    // Dosya seçici diyaloğunu aç
                    await this.openFileSelector();
                    break;

                case 'getSettings':
                    // WebView'e mevcut ayarları gönder
                    await this.settingsManager.sendSettingsToWebView();
                    break;
                
                case 'saveSettings':
                    // Ayarları kaydet ve güncelle
                    await this.settingsManager.saveSettings(message.settings);
                    break;
                    
                case 'runTerminalCommand':
                    // Terminal komutunu çalıştır
                    if (message.command) {
                        // VS Code terminali oluştur ve komutu çalıştır
                        vscode.commands.executeCommand('byte.runInTerminal', message.command);
                    }
                    break;
                    
                case 'applyCode':
                    // Kodu aktif editöre uygula
                    await this.applyCodeToEditor(message.code);
                    break;
            }
        } catch (error: any) {
            // Hata durumunu WebView'e ilet
            this.sendErrorToWebView(`Mesaj işlenirken hata oluştu: ${error.message}`);
        }
    }
    
    /**
     * WebView'ı güncel durum ile yeniler
     */
    public updateView(): void {
        if (!this.view) {
            return;
        }
        
        // Mevcut AI sağlayıcısını, mesaj geçmişini, agent durumunu ve dosya bilgisini gönder
        this.view.webview.postMessage({
            type: 'init',
            provider: this.aiService.getProvider(),
            messages: this.aiService.getMessages(),
            agentEnabled: this.agentEnabled,
            currentFile: this.currentFile
        });
    }
    
    /**
     * Kullanıcı mesajını işler
     */
    private async handleUserMessage(message: WebViewMessage): Promise<void> {
        try {
            // Önce kullanıcının mesajını webview'e gönder - sadece bir kez yapılacak
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'userMessage',
                    content: message.message,
                    isCommand: message.message.startsWith('/')
                });
            }
            
            // Slash komutlarını kontrol et
            if (this.commandManager && message.message.startsWith('/')) {
                // Yükleniyor göstergesini aç (slash komut yanıtı beklerken)
                if (this.view) {
                    this.view.webview.postMessage({
                        type: 'loadingStart'
                    });
                }
                
                // Komutu işleyebilirsek mesajı değiştirme
                if (await processSlashCommand(message.message, this.aiService, this.view)) {
                    return;
                }
            }

            let finalMessage = message.message;
            
            // Eğer current file dahil edilecekse
            if (message.includeCurrentFile && this.currentFile) {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    const fileContent = editor.document.getText();
                    finalMessage = `Current file (${this.currentFile}):\n\`\`\`\n${fileContent}\n\`\`\`\n\nUser message:\n${message.message}`;
                }
            }
            
            // Yükleniyor göstergesini aç
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'loadingStart'
                });
            }
            
            if (message.provider === 'local') {
                const settings = await this.aiService.getSettings();
                const response = await sendOllamaRequest(finalMessage, settings.local.model);
                // Yanıtı webview'a gönder
                if (this.view) {
                    this.view.webview.postMessage({ 
                        type: 'response', 
                        content: response 
                    });
                }
            } else {
                // Yanıtı al
                const response = await this.aiService.sendMessage(finalMessage);
                
                // Yanıtı WebView'e gönder
                if (this.view) {
                    this.view.webview.postMessage({
                        type: 'response',
                        content: response
                    });
                }
            }
        } catch (error: any) {
            // Hata durumunda WebView'e bildir
            this.sendErrorToWebView(error.message);
        }
    }
    
    /**
     * AI sağlayıcısını değiştirir
     */
    private async changeProvider(provider: AIProvider): Promise<void> {
        try {
            this.aiService.setProvider(provider);
            
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'providerChanged',
                    provider: provider
                });
            }
        } catch (error: any) {
            // Hata durumunda WebView'e bildir
            this.sendErrorToWebView(error.message);
        }
    }
    
    /**
     * Dosya içeriğini okuyup AI'ya gönderir
     */
    private async sendFileToAI(filePath: string): Promise<void> {
        try {
            if (!filePath) {
                filePath = vscode.window.activeTextEditor?.document.uri.fsPath || '';
                
                if (!filePath) {
                    throw new Error('Gönderilecek dosya bulunamadı.');
                }
            }
            
            // Dosyayı oku
            const fs = require('fs');
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const fileName = filePath.split(/[\\/]/).pop() || '';
            
            // Dosya içeriğini formatla
            const message = `Aşağıdaki '${fileName}' dosyasını inceleyip analiz eder misin?\n\n\`\`\`\n${fileContent}\n\`\`\``;
            
            // AI'ya gönder
            const response = await this.aiService.sendMessage(message);
            
            // Yanıtı WebView'e gönder
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'response',
                    content: response
                });
            }
        } catch (error: any) {
            // Hata durumunda WebView'e bildir
            this.sendErrorToWebView(error.message);
        }
    }
    
    /**
     * Dosya seçici diyaloğu açar
     */
    private async openFileSelector(): Promise<void> {
        try {
            // Dosya seçim diyaloğunu aç
            const fileUri = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Dosya Seç',
                filters: {
                    'Tüm Dosyalar': ['*']
                }
            });
            
            if (fileUri && fileUri.length > 0) {
                const filePath = fileUri[0].fsPath;
                const fileName = filePath.split(/[\\/]/).pop() || '';
                
                // Dosya bilgilerini güncelle
                if (this.view) {
                    this.view.webview.postMessage({
                        type: 'fileSelected',
                        filePath: filePath,
                        fileName: fileName
                    });
                    
                    // Seçilen dosyayı AI'ya gönder
                    await this.sendFileToAI(filePath);
                }
            }
        } catch (error: any) {
            // Hata durumunda WebView'e bildir
            this.sendErrorToWebView(error.message);
        }
    }
    
    /**
     * Kodu aktif editöre uygular
     */
    private async applyCodeToEditor(code: string): Promise<void> {
        if (!code) {
            return;
        }
        
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            // Kodu temizle - AI'nin yorum satırlarını temizle ve kod bloğu belirteçlerini kaldır
            const cleanCode = cleanCodeForApply(code);
            
            // Editörde değişiklik yap
            editor.edit(editBuilder => {
                if (!editor.selection.isEmpty) {
                    // Eğer seçili alan varsa, onu değiştir
                    editBuilder.replace(editor.selection, cleanCode);
                } else {
                    // Seçili alan yoksa, tam kod bloğunu ekle - imlecin olduğu satırın başına
                    const position = editor.selection.active;
                    const lineStart = position.with(position.line, 0);
                    editBuilder.insert(lineStart, cleanCode + '\n');
                }
            }).then(success => {
                if (success) {
                    vscode.window.showInformationMessage(`Kod başarıyla uygulandı.`);
                } else {
                    vscode.window.showErrorMessage('Kod uygulanırken bir hata oluştu.');
                }
            });
        } else {
            // Açık bir editör yoksa hata mesajı göster
            vscode.window.showErrorMessage('Kodu uygulamak için açık bir editör gereklidir.');
            
            this.sendErrorToWebView('Kodu uygulamak için açık bir editör gerekli. Lütfen bir dosya açın.');
        }
    }
    
    /**
     * WebView'e hata mesajı gönderir
     */
    private sendErrorToWebView(errorMessage: string): void {
        if (this.view) {
            this.view.webview.postMessage({
                type: 'error',
                content: errorMessage
            });
            
            // Yükleniyor göstergesini kapat
            this.view.webview.postMessage({
                type: 'loadingStop'
            });
        }
    }
    
    /**
     * Agent durumunu döndürür
     */
    public isAgentEnabled(): boolean {
        return this.agentEnabled;
    }
    
    /**
     * CommandManager'ı ayarlar
     */
    public setCommandManager(commandManager: any): void {
        this.commandManager = commandManager;
    }
    
    /**
     * Dosya yolunu günceller
     * @param filePath 
     */
    public updateCurrentFile(filePath: string | null): void {
        if (filePath) {
            // Dosya adını al (yoldan ayır)
            const fileName = filePath.split(/[\\/]/).pop() || '';
            this.currentFile = fileName;
            
            // WebView'e bildir
            if (this.view && this.view.visible) {
                this.view.webview.postMessage({
                    type: 'currentFileChanged',
                    filePath: filePath
                });
            }
        } else {
            this.currentFile = '';
            
            // WebView'e bildir
            if (this.view && this.view.visible) {
                this.view.webview.postMessage({
                    type: 'currentFileChanged',
                    filePath: null
                });
            }
        }
    }
} 