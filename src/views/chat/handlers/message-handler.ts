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
                    
                case 'newChat':
                    // Yeni sohbet başlatıldığında mesaj geçmişini temizle
                    this.aiService.clearMessages();
                    
                    // WebView'e mesaj geçmişinin temizlendiğini bildir
                    if (this.view) {
                        this.view.webview.postMessage({
                            type: 'chatCleared',
                            success: true
                        });
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
            
            // Seçilmiş dosyaları ekle
            if (message.selectedFiles && message.selectedFiles.length > 0) {
                let filesContent = `\n\nSelected files:\n`;
                
                for (const file of message.selectedFiles) {
                    const fileExtension = file.fileName.split('.').pop() || '';
                    const language = this.getLanguageFromExtension(fileExtension);
                    
                    filesContent += `\n**${file.fileName}:**\n\`\`\`${language}\n${file.fileContent}\n\`\`\`\n`;
                }
                
                finalMessage = `${filesContent}\n\nUser message:\n${message.message}`;
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
            // Önce dosyaları al ve gruplandır
            const workspaceFiles = await this.getWorkspaceFiles();
            
            // Özelleştirilmiş QuickPick ile dosyaları göster
            const quickPick = vscode.window.createQuickPick();
            quickPick.title = 'Dosya Seçici';
            quickPick.placeholder = 'Sohbete eklemek için dosya ara ve seç (maksimum 3 dosya)';
            quickPick.canSelectMany = true;
            
            // Dosyaları gruplandır ve QuickPick öğelerini oluştur
            const items: vscode.QuickPickItem[] = workspaceFiles.map(file => {
                return {
                    label: `$(${this.getFileIconName(file.label.split('.').pop()?.toLowerCase() || '')}) ${file.label}`,
                    description: file.description,
                    detail: this.getCategoryForFile(file.label),
                    alwaysShow: false // Kategoride popüler olanları göster
                };
            });
            
            quickPick.items = items;
            
            // Seçilen öğeleri takip et
            const selectedFilesData: Array<{fileName: string, filePath: string, fileContent: string}> = [];
            
            // Seçim değiştiğinde kontrol et
            quickPick.onDidChangeSelection((selectedItems) => {
                // Maksimum 3 dosya seçimine izin ver
                if (selectedItems.length > 3) {
                    // Kullanıcıyı uyar ve fazla seçimleri kaldır
                    vscode.window.showWarningMessage('Maksimum 3 dosya seçebilirsiniz!');
                    
                    // İlk 3 dosyayı seç
                    const first3Items = selectedItems.slice(0, 3);
                    quickPick.selectedItems = first3Items;
                }
            });
            
            // Dosya seçildiğinde işlem yap
            quickPick.onDidAccept(async () => {
                const selectedItems = quickPick.selectedItems;
                
                if (selectedItems.length > 0) {
                    // Yükleniyor göstergesi
                    quickPick.busy = true;
                    quickPick.placeholder = 'Dosyalar okunuyor...';
                    
                    // Seçilen dosyaları temizle
                    selectedFilesData.length = 0;
                    
                    // Dosya URI'larını bul
                    for (const item of selectedItems) {
                        // Dosya etiketinden dosya adını çıkar (ikonları kaldır)
                        const cleanFileName = item.label.replace(/\$\([a-z\-]+\)\s+/, '');
                        
                        // Dosya URI'sını bul (dosya adını ve göreli yolu kullanarak)
                        const matchingFile = workspaceFiles.find(f => 
                            f.label === cleanFileName && 
                            f.description === item.description
                        );
                        
                        if (matchingFile) {
                            try {
                                const document = await vscode.workspace.openTextDocument(matchingFile.uri);
                                const fileContent = document.getText();
                                
                                selectedFilesData.push({
                                    fileName: cleanFileName,
                                    filePath: matchingFile.uri.fsPath,
                                    fileContent: fileContent
                                });
                            } catch (error) {
                                console.error(`Dosya okuma hatası: ${error}`);
                            }
                        }
                    }
                    
                    // Dosya bilgilerini WebView'e gönder
                    if (this.view && selectedFilesData.length > 0) {
                        this.view.webview.postMessage({
                            type: 'selectedFilesChanged',
                            files: selectedFilesData
                        });
                        
                        vscode.window.showInformationMessage(
                            `${selectedFilesData.length} dosya sohbete eklendi.`
                        );
                    }
                    
                    // QuickPick'i kapat
                    quickPick.hide();
                }
            });
            
            // İptal edilirse kapat
            quickPick.onDidHide(() => {
                quickPick.dispose();
            });
            
            // QuickPick'i göster
            quickPick.show();
            
        } catch (error: any) {
            // Hata durumunda WebView'e bildir
            this.sendErrorToWebView(`Dosya seçilirken hata oluştu: ${error.message}`);
            vscode.window.showErrorMessage(`Dosya seçici açılırken hata oluştu: ${error.message}`);
        }
    }
    
    /**
     * Dosya uzantısına göre VS Code ikon adı döndürür
     * VS Code yerleşik codicon adlarını kullanır
     */
    private getFileIconName(fileExtension: string): string {
        switch (fileExtension.toLowerCase()) {
            case 'js':
            case 'jsx':
                return 'symbol-method';
            case 'ts':
            case 'tsx':
                return 'symbol-class';
            case 'py':
                return 'symbol-namespace';
            case 'java':
                return 'symbol-constructor';
            case 'c':
            case 'cpp':
            case 'h':
                return 'symbol-constant';
            case 'cs':
                return 'symbol-field';
            case 'go':
                return 'symbol-enum';
            case 'rs':
                return 'symbol-operator';
            case 'rb':
                return 'symbol-variable';
            case 'php':
                return 'symbol-property';
            case 'html':
                return 'symbol-enum-member';
            case 'css':
            case 'scss':
            case 'less':
                return 'symbol-key';
            case 'json':
                return 'json';
            case 'md':
                return 'markdown';
            case 'xml':
            case 'svg':
                return 'symbol-file';
            case 'yaml':
            case 'yml':
                return 'list-flat';
            default:
                return 'file-code';
        }
    }
    
    /**
     * Dosya türüne göre kategori döndürür
     */
    private getCategoryForFile(fileName: string): string {
        const extension = fileName.split('.').pop()?.toLowerCase() || '';
        
        if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
            return 'JavaScript/TypeScript';
        } else if (['py'].includes(extension)) {
            return 'Python';
        } else if (['java'].includes(extension)) {
            return 'Java';
        } else if (['c', 'cpp', 'h', 'hpp'].includes(extension)) {
            return 'C/C++';
        } else if (['cs'].includes(extension)) {
            return 'C#';
        } else if (['html', 'css', 'scss', 'less'].includes(extension)) {
            return 'Web';
        } else if (['json', 'xml', 'yaml', 'yml'].includes(extension)) {
            return 'Veri/Konfigürasyon';
        } else if (['md'].includes(extension)) {
            return 'Dokümantasyon';
        } else if (['go'].includes(extension)) {
            return 'Go';
        } else if (['rs'].includes(extension)) {
            return 'Rust';
        } else if (['rb'].includes(extension)) {
            return 'Ruby';
        } else if (['php'].includes(extension)) {
            return 'PHP';
        } else {
            return 'Diğer';
        }
    }
    
    /**
     * Dosya uzantısına göre dil belirler
     */
    private getLanguageFromExtension(fileExtension: string): string {
        switch (fileExtension.toLowerCase()) {
            case 'js': return 'javascript';
            case 'jsx': return 'jsx';
            case 'ts': return 'typescript';
            case 'tsx': return 'tsx';
            case 'py': return 'python';
            case 'java': return 'java';
            case 'c': case 'cpp': case 'h': return 'cpp';
            case 'cs': return 'csharp';
            case 'go': return 'go';
            case 'rs': return 'rust';
            case 'rb': return 'ruby';
            case 'php': return 'php';
            case 'html': return 'html';
            case 'css': case 'scss': case 'less': return 'css';
            case 'json': return 'json';
            case 'md': return 'markdown';
            case 'xml': case 'svg': return 'xml';
            case 'yaml': case 'yml': return 'yaml';
            default: return '';
        }
    }
    
    /**
     * Workspace içindeki tüm dosyaları getirir
     */
    private async getWorkspaceFiles(): Promise<Array<{label: string; description: string; uri: vscode.Uri; iconPath?: vscode.ThemeIcon}>> {
        console.log("getWorkspaceFiles metodu çağrıldı");
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            console.log("Workspace klasörleri bulunamadı");
            return [];
        }
        
        const files: Array<{label: string; description: string; uri: vscode.Uri; iconPath?: vscode.ThemeIcon}> = [];
        
        // Hariç tutulacak dosya ve klasör desenleri
        const excludePatterns = [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/coverage/**',
            '**/.git/**',
            '**/package-lock.json',
            '**/yarn.lock',
            '**/.DS_Store',
            '**/thumbs.db',
            '**/*.log',
            '**/*.lock',
            '**/*.min.js',
            '**/*.min.css'
        ];
        
        // Desteklenen dosya türleri
        const includePatterns = [
            '**/*.js',
            '**/*.ts',
            '**/*.jsx',
            '**/*.tsx',
            '**/*.py',
            '**/*.java',
            '**/*.c',
            '**/*.cpp',
            '**/*.h',
            '**/*.cs',
            '**/*.go',
            '**/*.rs',
            '**/*.rb',
            '**/*.php',
            '**/*.html',
            '**/*.css',
            '**/*.scss',
            '**/*.json',
            '**/*.md',
            '**/*.xml',
            '**/*.yml',
            '**/*.yaml',
            '**/*.svg'
        ];
        
        for (const folder of workspaceFolders) {
            console.log(`Klasör işleniyor: ${folder.name}`);
            try {
                // VS Code API ile dosyaları bul - sadece kod dosyalarını göster ve belirlenen klasörleri hariç tut
                const fileUris = await vscode.workspace.findFiles(
                    `{${includePatterns.join(',')}}`,
                    `{${excludePatterns.join(',')}}`
                );
                
                console.log(`Bulunan dosya sayısı: ${fileUris.length}`);
                
                for (const uri of fileUris) {
                    // Dosya adını al
                    const fileName = uri.path.split('/').pop() || '';
                    // Workspace klasörüne göre göreceli yolu al
                    const relativePath = vscode.workspace.asRelativePath(uri);
                    
                    // Dosya türüne göre ikon belirleme
                    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
                    const iconPath = this.getFileIcon(fileExtension);
                    
                    files.push({
                        label: fileName,
                        description: relativePath,
                        uri: uri,
                        iconPath: iconPath
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
     * Dosya uzantısına göre ikon döndürür
     */
    private getFileIcon(fileExtension: string): vscode.ThemeIcon {
        switch (fileExtension.toLowerCase()) {
            case 'js':
            case 'jsx':
                return new vscode.ThemeIcon('javascript');
            case 'ts':
            case 'tsx':
                return new vscode.ThemeIcon('typescript');
            case 'py':
                return new vscode.ThemeIcon('python');
            case 'java':
                return new vscode.ThemeIcon('java');
            case 'c':
            case 'cpp':
            case 'h':
                return new vscode.ThemeIcon('cpp');
            case 'cs':
                return new vscode.ThemeIcon('csharp');
            case 'go':
                return new vscode.ThemeIcon('go');
            case 'rs':
                return new vscode.ThemeIcon('rust');
            case 'rb':
                return new vscode.ThemeIcon('ruby');
            case 'php':
                return new vscode.ThemeIcon('php');
            case 'html':
                return new vscode.ThemeIcon('html');
            case 'css':
            case 'scss':
            case 'less':
                return new vscode.ThemeIcon('css');
            case 'json':
                return new vscode.ThemeIcon('json');
            case 'md':
                return new vscode.ThemeIcon('markdown');
            case 'xml':
            case 'svg':
                return new vscode.ThemeIcon('xml');
            case 'yaml':
            case 'yml':
                return new vscode.ThemeIcon('yaml');
            default:
                return new vscode.ThemeIcon('file-code');
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