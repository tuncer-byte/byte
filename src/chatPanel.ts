import * as vscode from 'vscode';
import * as path from 'path';
import { AIService, AIProvider, Message } from './aiService';

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
    
    constructor(
        private readonly _extensionUri: vscode.Uri,
        aiService: AIService
    ) {
        this._aiService = aiService;
        
        // Aktif editörü izle
        this._registerActiveEditorListener();
    }
    
    /**
     * Aktif editör değişikliklerini dinleyen metod
     */
    private _registerActiveEditorListener() {
        // Mevcut aktif editörü kontrol et
        if (vscode.window.activeTextEditor) {
            this._updateCurrentFile(vscode.window.activeTextEditor.document.uri.fsPath);
        }
        
        // Aktif editör değiştiğinde olayı dinle
        this._activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this._updateCurrentFile(editor.document.uri.fsPath);
            }
        });
    }
    
    /**
     * Mevcut dosya bilgisini günceller ve WebView'e bildirir
     */
    private _updateCurrentFile(filePath: string) {
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
        
        // WebView güvenlik ayarları
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };
        
        // WebView içeriğini ayarla
        webviewView.webview.html = this._getWebviewContent(webviewView.webview);
        
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
        switch (message.type) {
            case 'webviewReady':
                // WebView hazır olduğunda mevcut durumu gönder
                this._updateView();
                break;
                
            case 'sendMessage':
                // Kullanıcı mesajını AI servisine iletir
                try {
                    // Yükleniyor göstergesi başlat
                    const response = await this._aiService.sendMessage(message.message);
                    
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
                
            case 'configureAI':
                // Kullanıcı AI sağlayıcısını yapılandırmak istediğinde
                this._configureAIProvider(message.provider);
                break;
                
            case 'agentStatusChanged':
                // Agent durumu değiştiğinde
                this._agentEnabled = message.enabled;
                // Burada agent durumuna göre ek işlemler yapılabilir
                break;
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
        switch (provider) {
            case AIProvider.OpenAI:
                const openaiKey = await vscode.window.showInputBox({
                    prompt: 'OpenAI API anahtarınızı girin',
                    password: true,
                    ignoreFocusOut: true,
                    placeHolder: 'sk-...'
                });
                
                if (openaiKey) {
                    await this._aiService.setOpenAIApiKey(openaiKey);
                    vscode.window.showInformationMessage('OpenAI API anahtarı başarıyla kaydedildi.');
                }
                break;
                
            case AIProvider.Gemini:
                const geminiKey = await vscode.window.showInputBox({
                    prompt: 'Google Gemini API anahtarınızı girin',
                    password: true,
                    ignoreFocusOut: true
                });
                
                if (geminiKey) {
                    await this._aiService.setGeminiApiKey(geminiKey);
                    vscode.window.showInformationMessage('Gemini API anahtarı başarıyla kaydedildi.');
                }
                break;
                
            case AIProvider.Local:
                const localEndpoint = await vscode.window.showInputBox({
                    prompt: 'Yerel AI servis endpoint URL\'inizi girin',
                    value: vscode.workspace.getConfiguration('byte').get<string>('local.endpoint') || 'http://localhost:8000/v1/completions',
                    ignoreFocusOut: true
                });
                
                if (localEndpoint) {
                    await vscode.workspace.getConfiguration('byte').update('local.endpoint', localEndpoint, vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('Yerel endpoint başarıyla kaydedildi.');
                }
                break;
        }
    }
    
    /**
     * Sohbeti temizler
     */
    public clearChat() {
        if (!this._view) {
            return;
        }
        
        // Mesaj geçmişini temizle
        this._aiService.clearMessages();
        
        // WebView'e bildir
        this._view.webview.postMessage({
            type: 'clearChat'
        });
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
                                    
                                    <div class="coffee-mode">
                                        <h3>Coffee mode</h3>
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
                                    <span>Agent</span>
                                    <input type="checkbox" id="agentToggle" checked>
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
}