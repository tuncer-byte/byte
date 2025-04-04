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

                case 'openFilePicker':
                    // Dosya seçici diyaloğunu aç ve seçilen dosyayı sohbete ekle
                    await this.handleFilePicker();
                    break;

                case 'getSettings':
                    // WebView'e mevcut ayarları gönder
                    await this.settingsManager.sendSettingsToWebView();
                    break;
                
                case 'saveSettings':
                    // Ayarları kaydet ve güncelle
                    await this.settingsManager.saveSettings(message.settings);
                    
                    // Ayarların başarıyla kaydedildiğini WebView'e bildir
                    if (this.view) {
                        this.view.webview.postMessage({
                            type: 'settingsSaved',
                            success: true
                        });
                    }
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
                    
                case 'runCode':
                    // Terminal komutunu çalıştır
                    await this.runCodeInTerminal(message.code);
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
            // Mesajı işlemeden önce yükleniyor göstergesini etkinleştir
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'loadingStart'
                });
            }

            // Önemli: Mesajı WebView'e göndermiyoruz - bu işlem chat-panel.js tarafında yapılıyor
            // Bu sayede çift mesaj sorunu önlenmiş oluyor
            
            // Slash komutlarını kontrol et
            if (this.commandManager && message.message.startsWith('/')) {
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
     * Dosya seçiciden seçilen dosyayı sohbete ekler
     */
    private async handleFilePicker(): Promise<void> {
        try {
            // VS Code'un kendi yerleşik dosya seçicisini kullanarak workspace içindeki dosyaları göster
            const items = await vscode.window.showQuickPick(
                this.getWorkspaceFiles(),
                {
                    placeHolder: 'Sohbete eklemek için bir dosya seçin (maksimum 3 dosya eklenebilir)',
                    canPickMany: true // Birden fazla dosya seçimine izin ver
                }
            );
            
            // Kullanıcı dosya(lar) seçtiyse
            if (items && items.length > 0) {
                // Maksimum 3 dosya ile sınırla
                const selectedItems = items.slice(0, 3);
                const selectedFiles: Array<{fileName: string, filePath: string, fileContent: string}> = [];
                
                // Tüm seçilen dosyaları oku
                for (const item of selectedItems) {
                    const filePath = item.uri.fsPath;
                    const fileName = item.label;
                    
                    // Dosyayı oku
                    const document = await vscode.workspace.openTextDocument(item.uri);
                    const fileContent = document.getText();
                    
                    selectedFiles.push({
                        fileName,
                        filePath,
                        fileContent
                    });
                }
                
                // Dosya bilgilerini WebView'e gönder
                if (this.view) {
                    // Seçilen dosyaları current-file bölümünde göstermek için WebView'e bildir
                    this.view.webview.postMessage({
                        type: 'selectedFilesChanged',
                        files: selectedFiles.map(file => ({
                            fileName: file.fileName,
                            filePath: file.filePath
                        }))
                    });
                    
                
                    
                    // AI'ya dosyaları ilet (arka planda)
                    // Dosyaları markdown olarak formatla
                    let aiMessage = `Kullanıcı şu dosyaları paylaştı:\n\n`;
                    
                    for (const file of selectedFiles) {
                        const fileExtension = file.fileName.split('.').pop() || '';
                        const language = this.getLanguageFromExtension(fileExtension);
                        
                        // Her dosyayı ayrı kod bloğu içinde ekle
                        aiMessage += `**${file.fileName}:**\n\`\`\`${language}\n${file.fileContent}\n\`\`\`\n\n`;
                    }
                    
                    // Dosya içeriklerini AI'ya gönder - UI'da gösterme
                    // Mesajı AI geçmişine ekle
                    await this.aiService.sendMessage(aiMessage);
                    
                    // Dosya içeriklerini göstermeden AI yanıtını bekle
                    this.view.webview.postMessage({
                        type: 'loadingStart'
                    });
                }
            }
        } catch (error: any) {
            // Hata durumunda WebView'e bildir
            this.sendErrorToWebView(`Dosya seçilirken hata oluştu: ${error.message}`);
        }
    }
    
    /**
     * Dosya uzantısına göre dil belirler
     */
    private getLanguageFromExtension(fileExtension: string): string {
        switch (fileExtension.toLowerCase()) {
            case 'js': return 'javascript';
            case 'ts': return 'typescript';
            case 'tsx': return 'typescript';
            case 'jsx': case 'tsx': return 'tsx';
            case 'py': return 'python';
            case 'java': return 'java';
            case 'c': case 'cpp': case 'h': return 'cpp';
            case 'cs': return 'csharp';
            case 'go': return 'go';
            case 'rs': return 'rust';
            case 'rb': return 'ruby';
            case 'php': return 'php';
            case 'html': return 'html';
            case 'css': return 'css';
            case 'json': return 'json';
            case 'md': return 'markdown';
            default: return '';
        }
    }
    
    /**
     * Workspace içindeki tüm dosyaları getirir
     */
    private async getWorkspaceFiles(): Promise<Array<{label: string; description: string; uri: vscode.Uri}>> {
        console.log("getWorkspaceFiles metodu çağrıldı");
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            console.log("Workspace klasörleri bulunamadı");
            return [];
        }
        
        const files: Array<{label: string; description: string; uri: vscode.Uri}> = [];
        
        for (const folder of workspaceFolders) {
            console.log(`Klasör işleniyor: ${folder.name}`);
            try {
                // VS Code API ile dosyaları bul - sadece kod dosyalarını göster
                const fileUris = await vscode.workspace.findFiles(
                    '{**/*.js,**/*.ts,**/*.jsx,**/*.tsx,**/*.py,**/*.java,**/*.c,**/*.cpp,**/*.h,**/*.cs,**/*.go,**/*.rs,**/*.rb,**/*.php,**/*.html,**/*.css,**/*.json,**/*.md}',
                    '**/node_modules/**'
                );
                
                console.log(`Bulunan dosya sayısı: ${fileUris.length}`);
                
                for (const uri of fileUris) {
                    // Dosya adını al
                    const fileName = uri.path.split('/').pop() || '';
                    // Workspace klasörüne göre göreceli yolu al
                    const relativePath = vscode.workspace.asRelativePath(uri);
                    
                    files.push({
                        label: fileName,
                        description: relativePath,
                        uri: uri
                    });
                }
            } catch (error) {
                console.error(`Dosya arama hatası: ${error}`);
            }
        }
        
        console.log(`Toplam eklenen dosya sayısı: ${files.length}`);
        
        return Promise.resolve(files);
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
            
            // Editörde değişiklik yap - tüm içeriği yeni kodla değiştir
            editor.edit(editBuilder => {
                // Dosyanın tamamını kapsayan bir seçim oluştur
                const fullDocumentRange = new vscode.Range(
                    new vscode.Position(0, 0),
                    new vscode.Position(editor.document.lineCount - 1, editor.document.lineAt(editor.document.lineCount - 1).text.length)
                );
                
                // Tüm içeriği temizle ve yeni kodu yaz
                editBuilder.replace(fullDocumentRange, cleanCode);
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
     * Kodu terminalde çalıştırır
     */
    private async runCodeInTerminal(code: string): Promise<void> {
        if (!code) {
            return;
        }
        
        try {
            // VS Code terminali oluştur ve komutu çalıştır
            vscode.commands.executeCommand('byte.runInTerminal', code);
            
            // Başarı mesajı göster
            vscode.window.showInformationMessage('Komut terminalde çalıştırılıyor.');
        } catch (error: any) {
            // Hata durumunda WebView'e bildir
            this.sendErrorToWebView(`Komut çalıştırılırken hata oluştu: ${error.message}`);
            vscode.window.showErrorMessage(`Komut çalıştırılırken hata oluştu: ${error.message}`);
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
            this.currentFile = filePath; // Tam yolu saklıyoruz
            
            // WebView'e bildir
            if (this.view && this.view.visible) {
                this.view.webview.postMessage({
                    type: 'currentFileChanged',
                    filePath: filePath,
                    fileName: fileName
                });
            }
        } else {
            this.currentFile = '';
            
            // WebView'e bildir - boş dosya durumunda boş string gönder
            if (this.view && this.view.visible) {
                this.view.webview.postMessage({
                    type: 'currentFileChanged',
                    filePath: '',
                    fileName: ''
                });
            }
        }
    }
}