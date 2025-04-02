import * as vscode from 'vscode';
import * as path from 'path';
import { AIService, AIProvider, Message, OllamaResponse, AISettings } from './aiService';
import { CommandManager } from './commands';

/**
 * Sohbet paneli WebView için yönetici sınıf
 */
export class ChatPanel implements vscode.WebviewViewProvider {
    public static readonly viewType = 'byteChatView';
    
    private _view?: vscode.WebviewView;
    private _aiService: AIService;
    private _agentEnabled: boolean = true;
    private _currentFile: string = '';
    private _activeEditorDisposable?: vscode.Disposable;
    private _commandManager?: CommandManager;
    
    constructor(
        private readonly _extensionUri: vscode.Uri,
        aiService: AIService
    ) {
        this._aiService = aiService;
        
        // Aktif editörü izle
        this._registerActiveEditorListener();
    }
    
    /**
     * Command Manager'ı ayarlar
     */
    public setCommandManager(commandManager: CommandManager) {
        this._commandManager = commandManager;
    }
    
    /**
     * Aktif editör değişikliklerini dinleyen metod
     */
    private _registerActiveEditorListener() {
        // Mevcut aktif editörü kontrol et
        if (vscode.window.activeTextEditor) {
            this._updateCurrentFile(vscode.window.activeTextEditor.document.uri.fsPath);
        } else {
            this._updateCurrentFile(null);
        }
        
        // Aktif editör değiştiğinde olayı dinle
        this._activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this._updateCurrentFile(editor.document.uri.fsPath);
            } else {
                this._updateCurrentFile(null);
            }
        });
    }
    
    /**
     * Mevcut dosya bilgisini günceller ve WebView'e bildirir
     */
    private _updateCurrentFile(filePath: string | null) {
        if (filePath) {
            // Dosya adını al (yoldan ayır)
            const fileName = filePath.split(/[\\/]/).pop() || '';
            this._currentFile = fileName;
            
            // WebView'e bildir
            if (this._view && this._view.visible) {
                this._view.webview.postMessage({
                    type: 'currentFileChanged',
                    filePath: filePath
                });
            }
        } else {
            this._currentFile = '';
            
            // WebView'e bildir
            if (this._view && this._view.visible) {
                this._view.webview.postMessage({
                    type: 'currentFileChanged',
                    filePath: null
                });
            }
        }
    }
    
    /**
     * WebView oluşturulduğunda çağrılır
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;
        
        // WebView genişliğini artır
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };
        
        // Panel genişliğini ayarla - minimum genişlik 400px
        webviewView.webview.html = this._getWebviewContent(webviewView.webview);
        
        // CSS ile içeriğin genişliğini artır
        this._view.onDidChangeVisibility(() => {
            setTimeout(() => {
                if (this._view && this._view.visible) {
                    const minWidth = 400; // Minimum genişlik 400px
                    // Extension'ın genişliğini ayarla
                    this._view.webview.postMessage({
                        type: 'setWidth',
                        width: minWidth
                    });
                }
            }, 100);
        });
        
        // WebView ile mesajlaşma
        webviewView.webview.onDidReceiveMessage(
            this._handleMessage,
            this,
            []
        );
        
        // WebView hazır olduğunda çağrılacak
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                this._updateView();
            }
        });
    }
    
    /**
     * WebView'ı güncel durum ile yeniler
     */
    private _updateView() {
        if (!this._view) {
            return;
        }
        
        // Mevcut AI sağlayıcısını, mesaj geçmişini, agent durumunu ve dosya bilgisini gönder
        this._view.webview.postMessage({
            type: 'init',
            provider: this._aiService.getProvider(),
            messages: this._aiService.getMessages(),
            agentEnabled: this._agentEnabled,
            currentFile: this._currentFile
        });
    }
    
    /**
     * WebView'den gelen mesajları işler
     */
    private _handleMessage = async (message: any) => {
        try {
            switch (message.type) {
                case 'webviewReady':
                    // WebView hazır olduğunda mevcut durumu gönder
                    this._updateView();
                    break;
                
                case 'sendMessage':
                    // Kullanıcı mesajını AI servisine iletir
                    try {
                        // Slash komutlarını kontrol et
                        if (this._commandManager && message.message.startsWith('/')) {
                            // Komutu işleyebilirsek mesajı değiştirme
                            if (await this._processSlashCommand(message.message)) {
                                return;
                            }
                        }

                        let finalMessage = message.message;
                        
                        // Eğer current file dahil edilecekse
                        if (message.includeCurrentFile && this._currentFile) {
                            const editor = vscode.window.activeTextEditor;
                            if (editor) {
                                const fileContent = editor.document.getText();
                                finalMessage = `Current file (${this._currentFile}):\n\`\`\`\n${fileContent}\n\`\`\`\n\nUser message:\n${message.message}`;
                            }
                        }
                        
                        if (message.provider === 'local') {
                            const settings = await this._aiService.getSettings();
                            const response = await this._sendOllamaRequest(finalMessage, settings.local.model);
                            // Yanıtı webview'a gönder
                            this._view?.webview.postMessage({ 
                                type: 'response', 
                                content: response 
                            });
                        } else {
                            // Yükleniyor göstergesi başlat
                            const response = await this._aiService.sendMessage(finalMessage);
                            
                            // Yanıtı WebView'e gönder
                            if (this._view) {
                                this._view.webview.postMessage({
                                    type: 'response',
                                    content: response
                                });
                            }
                        }
                    } catch (error: any) {
                        // Hata durumunda WebView'e bildir
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'error',
                                content: error.message
                            });
                        }
                    }
                    break;
                
                case 'changeProvider':
                    // Kullanıcı AI sağlayıcısını değiştirdiğinde
                    try {
                        this._aiService.setProvider(message.provider as AIProvider);
                        
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'providerChanged',
                                provider: message.provider
                            });
                        }
                    } catch (error: any) {
                        // Hata durumunda WebView'e bildir
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'error',
                                content: error.message
                            });
                        }
                    }
                    break;
                
                case 'agentStatusChanged':
                    // Agent özelliğinin durumunu güncelle
                    this._agentEnabled = message.enabled;
                    break;
                
                case 'sendFile':
                    // Mevcut dosyayı AI'ya gönder
                    await this._sendFileToAI('');
                    break;
                
                case 'selectFile':
                    // Dosya seçici diyaloğunu aç
                    await this._openFileSelector();
                    break;

                case 'getSettings':
                    // WebView'e mevcut ayarları gönder
                    await this._sendSettingsToWebView();
                    break;
                
                case 'saveSettings':
                    // Ayarları kaydet ve güncelle
                    await this._saveSettings(message.settings);
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
                    if (message.code) {
                        const editor = vscode.window.activeTextEditor;
                        if (editor) {
                            // Kodu temizle - AI'nin yorum satırlarını temizle
                            const cleanCode = this._cleanCodeForApply(message.code);
                            
                            // Editörde değişiklik yap
                            editor.edit(editBuilder => {
                                // Eğer seçili alan varsa, onu değiştir
                                if (!editor.selection.isEmpty) {
                                    editBuilder.replace(editor.selection, cleanCode);
                                } else {
                                    // Seçili alan yoksa, imlecin olduğu yere ekle
                                    editBuilder.insert(editor.selection.active, cleanCode);
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
                            
                            if (this._view) {
                                this._view.webview.postMessage({
                                    type: 'error',
                                    content: 'Kodu uygulamak için açık bir editör gerekli. Lütfen bir dosya açın.'
                                });
                            }
                        }
                    }
                    break;
            }
        } catch (error: any) {
            // Hata durumunu WebView'e ilet
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'error',
                    content: `Mesaj işlenirken hata oluştu: ${error.message}`
                });
            }
        }
    }
    
    /**
     * Agent durumunu döndürür
     */
    public isAgentEnabled(): boolean {
        return this._agentEnabled;
    }
    
    /**
     * AI sağlayıcısını yapılandırma için UI gösterir
     */
    private async _configureAIProvider(provider: AIProvider) {
        try {
            if (provider === 'local') {
                // Ollama API'sini kontrol et
                const ollamaAvailable = await this._checkOllamaAvailability();
                if (!ollamaAvailable) {
                    throw new Error('Ollama API bağlantısı kurulamadı. Lütfen Ollama servisinin çalıştığından emin olun.');
                }
            }
            
            // Diğer provider kontrolleri...
            // ... existing code ...
        } catch (error) {
            // ... existing code ...
        }
    }
    
    // Ollama API'sinin kullanılabilirliğini kontrol et
    private async _checkOllamaAvailability(): Promise<boolean> {
        try {
            const response = await fetch('http://localhost:11434/api/tags');
            return response.ok;
        } catch {
            return false;
        }
    }

    // Ollama API'sine istek gönder
    private async _sendOllamaRequest(message: string, model: string): Promise<string> {
        try {
            const response = await fetch('http://localhost:11434/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model,
                    prompt: message,
                    stream: false
                })
            });

            if (!response.ok) {
                throw new Error('Ollama API yanıt vermedi');
            }

            const data = await response.json() as OllamaResponse;
            return data.response;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu';
            throw new Error(`Ollama API hatası: ${errorMessage}`);
        }
    }
    
    /**
     * Sohbeti temizler ve yeni bir sohbet başlatır
     */
    private async _clearChat() {
        if (!this._view) {
            return;
        }
        
        try {
            // Mesaj geçmişini temizle
            this._aiService.clearMessages();
            
            // WebView'e bildir - yeni bir sohbet başlat
            this._view.webview.postMessage({
                type: 'clearChat'
            });
            
            // Bildirim göster
            vscode.window.showInformationMessage('Yeni bir sohbet başlatıldı');
        } catch (error: any) {
            vscode.window.showErrorMessage(`Sohbet temizlenirken hata oluştu: ${error.message}`);
        }
    }
    
    /**
     * Uzantı devre dışı bırakıldığında kaynakları temizle
     */
    public dispose() {
        if (this._activeEditorDisposable) {
            this._activeEditorDisposable.dispose();
        }
    }
    
    /**
     * WebView HTML içeriğini oluşturur
     */
    private _getWebviewContent(webview: vscode.Webview): string {
        // WebView kaynaklarına erişim için URI'lar
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js')
        );
        
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'style.css')
        );
        
        // HTML şablonunu oku
        const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'index.html');
        let htmlContent = '';
        
        try {
            // Dosyayı okuma işlemini yap (async değil)
            const fileUri = htmlPath.fsPath;
            const fs = require('fs');
            htmlContent = fs.readFileSync(fileUri, 'utf8');
            
            // Dosya içindeki placeholder'ları değiştir
            htmlContent = htmlContent
                .replace(/\{\{scriptUri\}\}/g, scriptUri.toString())
                .replace(/\{\{styleUri\}\}/g, styleUri.toString());
                
        } catch (error) {
            // Hata durumunda basit bir HTML oluştur
            htmlContent = `
            <!DOCTYPE html>
            <html lang="tr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Byte AI Asistanı</title>
                <link rel="stylesheet" href="${styleUri}">
            </head>
            <body>
                <div class="chat-container">
                    <div class="chat-header">
                        <h1>Byte</h1>
                        <div class="provider-selector">
                            <select id="aiProvider">
                                <option value="openai">OpenAI</option>
                                <option value="gemini">Google Gemini</option>
                                <option value="local">Yerel Model</option>
                            </select>
                            <button id="configureButton" class="icon-button" title="Yapılandır">⚙️</button>
                        </div>
                    </div>
                    
                    <div class="messages-container" id="messagesContainer">
                        <div class="welcome-message">
                            <div class="assistant-message">
                                <div class="message-content">
                                    <h2>Welcome to Byte</h2>
                                    <ul class="welcome-list">
                                        <li>Configure plugin settings</li>
                                        <li>Explore shortcuts</li>
                                        <li>Provide instructions for AI</li>
                                    </ul>
                                    
                                    <div class="assistant-intro">
                                        <div class="assistant-icon">🔥</div>
                                        <p>Ask Byte anything to help you with your coding tasks or to learn something new.</p>
                                    </div>
                                    
                                    <div class="quick-commands">
                                        <h3>Quick commands</h3>
                                        <ul>
                                            <li><span class="command">/code</span> to generate new feature or fix bug</li>
                                            <li><span class="command">/explain</span> file or selected code</li>
                                            <li><span class="command">/review</span> code to recommend improvements</li>
                                            <li><span class="command">/unittests</span> to generate unit tests</li>
                                        </ul>
                                    </div>
                                    
                                    <div class="chill-mode">
                                        <h3>Chill mode</h3>
                                        <p>Enable to automatically apply changes and run safe commands</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="input-container">
                        <div class="context-info">
                            <span class="new-chat">New chat</span>
                            <span class="context-separator">|</span>
                            <span class="current-file" id="currentFile">package.json</span>
                            <div class="context-controls">
                                <label class="agent-toggle">
                                    <span>Chill</span>
                                    <input type="checkbox" id="agentToggle" checked disabled>
                                    <span class="toggle-slider"></span>
                                </label>
                            </div>
                        </div>
                        <div class="input-wrapper">
                            <textarea id="userInput" placeholder="Ask Byte..." rows="1"></textarea>
                            <button id="sendButton" class="send-button" title="Gönder">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" fill="currentColor"/>
                                </svg>
                            </button>
                        </div>
                        <div class="loading-indicator" id="loadingIndicator">
                            <div class="typing-indicator">
                                <span></span>
                                <span></span>
                                <span></span>
                            </div>
                        </div>
                    </div>
                </div>
                <script src="${scriptUri}"></script>
            </body>
            </html>
            `;
        }
        
        return htmlContent;
    }
    
    /**
     * Dosya içeriğini okuyup AI'ya gönderir
     */
    private async _sendFileToAI(filePath: string) {
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
            const response = await this._aiService.sendMessage(message);
            
            // Yanıtı WebView'e gönder
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'response',
                    content: response
                });
            }
        } catch (error: any) {
            // Hata durumunda WebView'e bildir
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'error',
                    content: error.message
                });
            }
        }
    }
    
    /**
     * Dosya seçici diyaloğu açar
     */
    private async _openFileSelector() {
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
                if (this._view) {
                    this._view.webview.postMessage({
                        type: 'fileSelected',
                        filePath: filePath,
                        fileName: fileName
                    });
                    
                    // Seçilen dosyayı AI'ya gönder
                    await this._sendFileToAI(filePath);
                }
            }
        } catch (error: any) {
            // Hata durumunda WebView'e bildir
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'error',
                    content: error.message
                });
            }
        }
    }
    
    /**
     * Slash komutlarını işler
     * @returns true: komut işlendi, false: komut işlenmedi
     */
    private async _processSlashCommand(message: string): Promise<boolean> {
        // Komut ve içeriği ayır
        const parts = message.trim().split(/\s+/);
        const command = parts[0].toLowerCase();
        
        // Eğer aktif bir text editor yoksa
        const editor = vscode.window.activeTextEditor;
        
        // Aktif bir editör yoksa, kullanıcıya bilgi ver
        if (!editor) {
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'error',
                    content: 'Bir dosya açık olmalı. Lütfen düzenlemek istediğiniz dosyayı açın.'
                });
            }
            return true;
        }
        
        // Mevcut seçili metni alın
        let selectedText = '';
        if (editor.selection && !editor.selection.isEmpty) {
            selectedText = editor.document.getText(editor.selection);
        } else {
            // Eğer bir kod parçası seçili değilse, mesajın kendisini kod olarak düşün (komut hariç)
            if (parts.length > 1) {
                selectedText = message.substring(command.length).trim();
            }
            
            // Eğer hala metin yoksa, kullanıcıya bilgi ver
            if (!selectedText) {
                if (this._view) {
                    this._view.webview.postMessage({
                        type: 'error',
                        content: 'Lütfen bir kod parçası seçin veya komutu takiben kodu yazın. Örnek: /explain function myFunc() { ... }'
                    });
                }
                return true;
            }
        }

        // Komutları işle
        try {
            switch (command) {
                case '/explain':
                    // Kod açıklama komutunu işle
                    if (this._commandManager) {
                        // WebView'e kullanıcı mesajını ekleyin
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'userMessage',
                                content: message
                            });
                            
                            // Yükleniyor göstergesini açın
                            this._view.webview.postMessage({
                                type: 'loadingStart'
                            });
                        }
                        
                        // Açıklama isteğini gönderin ve sonucu alın
                        const explanation = await this._aiService.explainCode(selectedText);
                        
                        // Yanıtı WebView'e gönderin
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'response',
                                content: explanation
                            });
                        }
                    }
                    return true;
                
                case '/review':
                case '/refactor':
                    // Kod iyileştirme komutunu işle
                    if (this._commandManager) {
                        // WebView'e kullanıcı mesajını ekleyin
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'userMessage',
                                content: message
                            });
                            
                            // Yükleniyor göstergesini açın
                            this._view.webview.postMessage({
                                type: 'loadingStart'
                            });
                        }
                        
                        // Refactoring isteğini gönderin ve sonucu alın
                        const refactoredCode = await this._aiService.refactorCode(selectedText);
                        
                        // Yanıtı WebView'e gönderin
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'response',
                                content: refactoredCode
                            });
                        }
                    }
                    return true;
                
                case '/docs':
                case '/generate-docs':
                case '/documentation':
                    // Dokümantasyon oluşturma komutunu işle
                    if (this._commandManager) {
                        // WebView'e kullanıcı mesajını ekleyin
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'userMessage',
                                content: message
                            });
                            
                            // Yükleniyor göstergesini açın
                            this._view.webview.postMessage({
                                type: 'loadingStart'
                            });
                        }
                        
                        // Prompt hazırlama
                        const docPrompt = `Please generate comprehensive documentation for the following code. Include:
                        
1. Overview of what the code does
2. Function/method descriptions
3. Parameter explanations
4. Return value descriptions
5. Usage examples
6. Any edge cases or important notes

Code:
\`\`\`
${selectedText}
\`\`\``;
                        
                        // Dokümantasyon oluşturma isteğini gönderin
                        const documentation = await this._aiService.sendMessage(docPrompt);
                        
                        // Yanıtı WebView'e gönderin
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'response',
                                content: documentation
                            });
                        }
                    }
                    return true;
                
                case '/optimize':
                    // Kod optimizasyonu komutunu işle
                    if (this._commandManager) {
                        // WebView'e kullanıcı mesajını ekleyin
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'userMessage',
                                content: message
                            });
                            
                            // Yükleniyor göstergesini açın
                            this._view.webview.postMessage({
                                type: 'loadingStart'
                            });
                        }
                        
                        // Optimize edilecek kısmı belirle
                        const optimizeType = parts.length > 1 ? parts[1].toLowerCase() : 'performance';
                        let optimizePrompt = '';
                        
                        // Optimizasyon türünü belirle
                        switch (optimizeType) {
                            case 'performance':
                            case 'speed':
                                optimizePrompt = 'performance optimization (improve execution speed)';
                                break;
                            case 'memory':
                                optimizePrompt = 'memory usage optimization (reduce memory consumption)';
                                break;
                            case 'size':
                                optimizePrompt = 'code size reduction (make code more concise)';
                                break;
                            case 'readability':
                                optimizePrompt = 'readability enhancement (improve code clarity)';
                                break;
                            default:
                                optimizePrompt = 'general optimization (improve both performance and readability)';
                        }
                        
                        // Prompt hazırlama
                        const prompt = `Please optimize the following code for ${optimizePrompt}. 
Provide a clear explanation of the changes made and why they improve the code.

Original code:
\`\`\`
${selectedText}
\`\`\`

Please return the optimized code along with a detailed explanation of the improvements.`;
                        
                        // Optimizasyon isteğini gönderin
                        const optimizedResult = await this._aiService.sendMessage(prompt);
                        
                        // Yanıtı WebView'e gönderin
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'response',
                                content: optimizedResult
                            });
                        }
                    }
                    return true;
                
                case '/comments':
                case '/add-comments':
                    // Açıklama satırları ekleme komutunu işle
                    if (this._commandManager) {
                        // WebView'e kullanıcı mesajını ekleyin
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'userMessage',
                                content: message
                            });
                            
                            // Yükleniyor göstergesini açın
                            this._view.webview.postMessage({
                                type: 'loadingStart'
                            });
                        }
                        
                        // Yorum stili belirle
                        const commentStyle = parts.length > 1 ? parts[1].toLowerCase() : 'comprehensive';
                        let commentPrompt = '';
                        
                        // Yorum stiline göre prompt oluştur
                        switch (commentStyle) {
                            case 'brief':
                            case 'concise':
                                commentPrompt = 'concise comments (brief comments for key sections only)';
                                break;
                            case 'doc':
                            case 'jsdoc':
                            case 'documentation':
                                commentPrompt = 'documentation style comments (JSDoc/TSDoc style documentation)';
                                break;
                            default:
                                commentPrompt = 'comprehensive comments (detailed explanations for each code block)';
                        }
                        
                        // Prompt hazırlama
                        const commentRequest = `Please add ${commentPrompt} to the following code. 
Return the same code with appropriate comments added.

Code:
\`\`\`
${selectedText}
\`\`\``;
                        
                        // Açıklama ekleme isteğini gönderin
                        const commentedCode = await this._aiService.sendMessage(commentRequest);
                        
                        // Yanıtı WebView'e gönderin
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'response',
                                content: commentedCode
                            });
                        }
                    }
                    return true;
                
                case '/issues':
                case '/analyze':
                case '/find-issues':
                    // Kod sorunlarını bulma komutunu işle
                    if (this._commandManager) {
                        // WebView'e kullanıcı mesajını ekleyin
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'userMessage',
                                content: message
                            });
                            
                            // Yükleniyor göstergesini açın
                            this._view.webview.postMessage({
                                type: 'loadingStart'
                            });
                        }
                        
                        // Sorun türünü belirle
                        const issueType = parts.length > 1 ? parts[1].toLowerCase() : 'all';
                        let issuePrompt = '';
                        
                        // Sorun türüne göre prompt oluştur
                        switch (issueType) {
                            case 'performance':
                                issuePrompt = 'performance issues (focus on performance bottlenecks)';
                                break;
                            case 'security':
                                issuePrompt = 'security vulnerabilities (check for security problems)';
                                break;
                            case 'smells':
                            case 'code-smells':
                                issuePrompt = 'code smells (identify design problems and anti-patterns)';
                                break;
                            case 'bugs':
                            case 'logic':
                                issuePrompt = 'bugs and logic errors (find potential bugs and logic issues)';
                                break;
                            default:
                                issuePrompt = 'all issues (find all types of problems in the code)';
                        }
                        
                        // Prompt hazırlama
                        const issueRequest = `Please analyze this code for ${issuePrompt} and provide detailed feedback.
For each issue you find:
1. Clearly identify the location and nature of the problem
2. Explain why it's an issue
3. Provide a specific solution or code fix
4. Rate the severity (Critical, Major, Minor)

Code to analyze:
\`\`\`
${selectedText}
\`\`\`

Return a comprehensive analysis with code examples of how to fix the issues.`;
                        
                        // Sorun analizi isteğini gönderin
                        const analysis = await this._aiService.sendMessage(issueRequest);
                        
                        // Yanıtı WebView'e gönderin
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'response',
                                content: analysis
                            });
                        }
                    }
                    return true;
                
                case '/tests':
                case '/test':
                case '/unittests':
                    // Birim testler oluşturma komutunu işle
                    if (this._commandManager) {
                        // WebView'e kullanıcı mesajını ekleyin
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'userMessage',
                                content: message
                            });
                            
                            // Yükleniyor göstergesini açın
                            this._view.webview.postMessage({
                                type: 'loadingStart'
                            });
                        }
                        
                        // Test framework belirle
                        const framework = parts.length > 1 ? parts[1].toLowerCase() : this._detectFramework(editor.document.languageId);
                        
                        // Prompt hazırlama
                        const testRequest = `Please generate comprehensive unit tests for the following code using the ${framework} testing framework.
Include a variety of test cases covering:
1. Happy path scenarios
2. Edge cases
3. Error handling
4. Input validation

Code to test:
\`\`\`
${selectedText}
\`\`\`

Return well-structured tests with explanatory comments.`;
                        
                        // Test oluşturma isteğini gönderin
                        const testCode = await this._aiService.sendMessage(testRequest);
                        
                        // Yanıtı WebView'e gönderin
                        if (this._view) {
                            this._view.webview.postMessage({
                                type: 'response',
                                content: testCode
                            });
                        }
                    }
                    return true;
                    
                case '/help':
                    // Yardım mesajını göster
                    if (this._view) {
                        const helpMessage = `### Byte AI Assistant Commands
                        
Here are the available commands:

- **/explain** - Explain selected code (example: /explain or select code first)
- **/review** or **/refactor** - Improve selected code
- **/docs** - Generate documentation for code
- **/optimize [type]** - Optimize code (types: performance, memory, size, readability)
- **/comments [style]** - Add comments to code (styles: comprehensive, concise, doc)
- **/issues [type]** - Find issues in code (types: all, performance, security, smells, bugs)
- **/tests [framework]** - Generate unit tests (framework: auto-detected if not specified)
- **/help** - Show this help message

For all commands, you can either:
1. Select code in the editor first, then use the command
2. Type the command followed by your code

Example: \`/explain function sum(a, b) { return a + b; }\`
                        `;
                        
                        // Yanıtı WebView'e gönderin
                        this._view.webview.postMessage({
                            type: 'response',
                            content: helpMessage
                        });
                    }
                    return true;
                    
                default:
                    // Bilinmeyen komut - işlenmeyen komutlar için false döndür
                    return false;
            }
        } catch (error: any) {
            // Hata durumunu WebView'e ilet
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'error',
                    content: `Komut işlenirken hata oluştu: ${error.message}`
                });
            }
            return true;
        }
    }
    
    /**
     * Dil ID'sine göre test framework belirler
     */
    private _detectFramework(languageId: string): string {
        switch (languageId) {
            case 'javascript':
            case 'typescript':
            case 'typescriptreact':
            case 'javascriptreact':
                return 'Jest';
            case 'python':
                return 'Pytest';
            case 'java':
                return 'JUnit';
            case 'csharp':
                return 'NUnit';
            case 'ruby':
                return 'RSpec';
            default:
                return 'appropriate';
        }
    }

    /**
     * WebView'e mevcut ayarları gönderir
     */
    private async _sendSettingsToWebView() {
        try {
            // API anahtarlarını al (güvenli depolama alanından)
            const openaiApiKey = await this._aiService.getOpenAIApiKey();
            const geminiApiKey = await this._aiService.getGeminiApiKey();
            
            // Yapılandırma ayarlarını al
            const config = vscode.workspace.getConfiguration('byte');
            const defaultProvider = config.get<string>('provider') || 'openai';
            const openaiModel = config.get<string>('openai.model') || 'gpt-3.5-turbo';
            const geminiModel = config.get<string>('gemini.model') || 'gemini-1.5-flash';
            const localEndpoint = config.get<string>('local.endpoint') || 'http://localhost:11434/api/generate';
            const localModel = config.get<string>('local.model') || 'llama3';
            const saveHistory = config.get<boolean>('saveHistory') !== false;
            
            // Ayarları bir nesne olarak yapılandır
            const settings = {
                defaultProvider,
                openai: {
                    apiKey: openaiApiKey || '',
                    model: openaiModel
                },
                gemini: {
                    apiKey: geminiApiKey || '',
                    model: geminiModel
                },
                local: {
                    endpoint: localEndpoint,
                    model: localModel
                },
                saveHistory
            };
            
            // WebView'e gönder
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'settingsUpdated',
                    settings
                });
            }
        } catch (error: any) {
            console.error('Ayarlar yüklenirken hata oluştu:', error);
            // Hata durumunda WebView'e bildir
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'error',
                    content: `Ayarlar yüklenirken hata oluştu: ${error.message}`
                });
            }
        }
    }

    /**
     * WebView'den gelen ayarları kaydeder
     */
    private async _saveSettings(settings: any) {
        try {
            const config = vscode.workspace.getConfiguration('byte');
            
            try {
                // Varsayılan sağlayıcıyı kaydet
                await config.update('provider', settings.defaultProvider, vscode.ConfigurationTarget.Global);
            } catch (err: any) {
                console.error('Varsayılan sağlayıcı kaydedilirken hata oluştu:', err);
                this._sendSettingsError(`Varsayılan sağlayıcı ayarlanamadı: ${err.message}`);
                return;
            }
            
            // OpenAI API anahtarını güvenli alana kaydet
            if (settings.openai.apiKey) {
                try {
                    await this._aiService.setOpenAIApiKey(settings.openai.apiKey);
                } catch (err: any) {
                    console.error('OpenAI API anahtarı kaydedilirken hata oluştu:', err);
                    this._sendSettingsError(`OpenAI API anahtarı kaydedilemedi: ${err.message}`);
                    return;
                }
            }
            
            // Gemini API anahtarını güvenli alana kaydet
            if (settings.gemini.apiKey) {
                try {
                    await this._aiService.setGeminiApiKey(settings.gemini.apiKey);
                } catch (err: any) {
                    console.error('Gemini API anahtarı kaydedilirken hata oluştu:', err);
                    this._sendSettingsError(`Gemini API anahtarı kaydedilemedi: ${err.message}`);
                    return;
                }
            }
            
            // Model ayarlarını ayrı ayrı kaydet ve hata kontrolü yap
            try {
                await config.update('openai.model', settings.openai.model, vscode.ConfigurationTarget.Global);
            } catch (err: any) {
                // Model ayarını kaydetmeye devam eder ama kullanıcıyı bilgilendiririz
                console.warn('openai.model ayarı kaydedilemedi, devam ediliyor', err);
            }
            
            try {
                await config.update('gemini.model', settings.gemini.model, vscode.ConfigurationTarget.Global);
            } catch (err: any) {
                console.warn('gemini.model ayarı kaydedilemedi, devam ediliyor', err);
            }
            
            // Yerel API ayarlarını kaydet
            try {
                await config.update('local.endpoint', settings.local.endpoint, vscode.ConfigurationTarget.Global);
                await config.update('local.model', settings.local.model, vscode.ConfigurationTarget.Global);
            } catch (err: any) {
                console.warn('Yerel model ayarları kaydedilemedi, devam ediliyor', err);
            }
            
            // Geçmiş kaydetme ayarını güncelle
            try {
                await config.update('saveHistory', settings.saveHistory, vscode.ConfigurationTarget.Global);
            } catch (err: any) {
                console.warn('saveHistory ayarı kaydedilemedi, devam ediliyor', err);
            }
            
            // Başarılı mesajını WebView'e gönder
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'settingsSaved',
                    success: true
                });
            }
            
            // Sağlayıcı değiştiyse, AI servisini de güncelle
            if (settings.defaultProvider !== this._aiService.getProvider()) {
                this._aiService.setProvider(settings.defaultProvider as AIProvider);
            }
        } catch (error: any) {
            console.error('Ayarlar kaydedilirken genel hata oluştu:', error);
            this._sendSettingsError(`Ayarlar kaydedilirken hata oluştu: ${error.message}`);
        }
    }

    /**
     * Ayar hatası mesajını WebView'e gönderir
     */
    private _sendSettingsError(errorMessage: string) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'settingsError',
                error: errorMessage
            });
        }
    }

    private _cleanCodeForApply(code: string): string {
        // Yorum satırlarını temizleme
        // 1. /* ... */ çok satırlı yorumları temizle
        // 2. // ... tek satırlı yorumları temizle
        let cleanCode = code
            .replace(/\/\*[\s\S]*?\*\//g, '') // Çok satırlı yorumları kaldır
            .replace(/\/\/.*?($|\n)/g, '$1'); // Tek satırlı yorumları kaldır

        // Kod bloğunun yorum satırları olmadan da çalışır olduğundan emin ol
        // Örneğin, ardışık boş satırları tek boş satıra düşür
        cleanCode = cleanCode.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        return cleanCode;
    }
}