import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getNonce, extractCodeBlocks, getLanguageFromFileName } from './utils';
import { ByteAIClient } from './client';
import { 
    CODE_EXPLANATION_PROMPT, 
    CODE_REFACTORING_PROMPT, 
    CODE_OPTIMIZATION_PROMPT, 
    UNIT_TEST_PROMPT 
} from './services/ai/utils/base-prompts';

/**
 * Inline Chat WebView Panel sınıfı
 */
export class InlineChatPanel {
    public static readonly viewType = 'byteAIInlineChat';
    private static instance: InlineChatPanel | undefined;
    private static panelWidth: number = 600; // Varsayılan genişlik değeri

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _client: ByteAIClient;
    private _disposables: vscode.Disposable[] = [];
    private _currentCode: string = '';
    private _currentLanguage: string = '';
    private _currentFileName: string = '';
    private _isReady: boolean = false;

    /**
     * InlineChatPanel sınıfını döndürür, yoksa oluşturur
     */
    public static createOrShow(extensionUri: vscode.Uri, client: ByteAIClient, width: number = 600): InlineChatPanel {
        // Genişlik değerini kaydet
        InlineChatPanel.panelWidth = width;
        
        const column = vscode.window.activeTextEditor 
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Eğer panel zaten varsa, göster
        if (InlineChatPanel.instance) {
            InlineChatPanel.instance._panel.reveal(column);
            return InlineChatPanel.instance;
        }

        // Yoksa yeni panel oluştur
        const panel = vscode.window.createWebviewPanel(
            InlineChatPanel.viewType,
            'Byte AI Inline Chat',
            column || vscode.ViewColumn.Beside,
            getWebviewOptions(extensionUri)
        );

        InlineChatPanel.instance = new InlineChatPanel(panel, extensionUri, client);
        return InlineChatPanel.instance;
    }

    /**
     * Özel constructor
     */
    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, client: ByteAIClient) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._client = client;

        // WebView içeriğini ayarla
        this._initializeWebview();
        
        // WebView'dan gelen mesajları dinle
        this._panel.webview.onDidReceiveMessage(
            this._handleWebviewMessage,
            this,
            this._disposables
        );

        // Panel kapatıldığında instance'ı temizle
        this._panel.onDidDispose(
            () => this.dispose(),
            null,
            this._disposables
        );
        
        // Editor değişikliklerini dinle
        vscode.window.onDidChangeActiveTextEditor(
            editor => {
                if (editor) {
                    this._updateCodeFromEditor(editor);
                }
            },
            null,
            this._disposables
        );
        
        // Başlangıçta açık editörden kodu al
        if (vscode.window.activeTextEditor) {
            this._updateCodeFromEditor(vscode.window.activeTextEditor);
        }
    }

    /**
     * WebView içeriğini oluşturur
     */
    private _initializeWebview() {
        // WebView içeriğini ayarla
        this._panel.webview.html = this._getHtmlForWebview();
        
        // WebView hazır olduğunda editor içeriğini gönder
        this._panel.webview.onDidReceiveMessage(
            message => {
                if (message.command === 'ready') {
                    this._isReady = true;
                    if (vscode.window.activeTextEditor) {
                        this._updateCodeFromEditor(vscode.window.activeTextEditor);
                    }
                }
            },
            this,
            this._disposables
        );
    }

    /**
     * WebView'dan gelen mesajları işler
     */
    private async _handleWebviewMessage(message: any) {
        switch (message.command) {
            case 'sendMessage':
                await this._processUserMessage(message.text);
                break;
                
            case 'fixCode':
                await this._processUserMessage(CODE_REFACTORING_PROMPT);
                break;
                
            case 'optimizeCode':
                await this._processUserMessage(CODE_OPTIMIZATION_PROMPT);
                break;
                
            case 'testCode':
                await this._processUserMessage(UNIT_TEST_PROMPT);
                break;
                
            case 'explainCode':
                await this._processUserMessage(CODE_EXPLANATION_PROMPT);
                break;
                
            case 'applyCode':
                await this._applyCode(message.fileName, message.code);
                break;
                
            case 'ready':
                this._isReady = true;
                // Panel genişliğini ayarla
                this._panel.webview.postMessage({
                    command: 'setWidth',
                    width: InlineChatPanel.panelWidth
                });
                // Editör içeriğini güncelle
                if (vscode.window.activeTextEditor) {
                    this._updateCodeFromEditor(vscode.window.activeTextEditor);
                }
                break;
        }
    }

    /**
     * Kullanıcı mesajını işler ve AI'dan yanıt alır
     */
    private async _processUserMessage(text: string) {
        // Yükleniyor durumuna geç
        this._panel.webview.postMessage({
            command: 'setLoading',
            isLoading: true
        });

        try {
            // AI'a kodu ve soruyu gönder
            const response = await this._client.sendInlineRequest({
                code: this._currentCode,
                language: this._currentLanguage,
                fileName: this._currentFileName,
                query: text
            });

            // Yanıttaki kod bloklarını işle
            const processedText = this._processCodeBlocksInResponse(response.text);

            // AI yanıtını WebView'a gönder
            this._panel.webview.postMessage({
                command: 'addMessage',
                text: processedText,
                role: 'assistant'
            });
        } catch (error) {
            // Hata durumunda
            console.error('AI yanıt hatası:', error);
            
            // Hata mesajını WebView'a gönder
            this._panel.webview.postMessage({
                command: 'error',
                message: error instanceof Error 
                    ? `Hata: ${error.message}` 
                    : 'Bilinmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
            });
        } finally {
            // Yükleniyor durumunu kapat
            this._panel.webview.postMessage({
                command: 'setLoading',
                isLoading: false
            });
        }
    }

    /**
     * AI yanıtındaki kod bloklarını işleyip dosya adlarıyla birlikte formatlar
     * @param text AI yanıtı
     * @returns İşlenmiş yanıt
     */
    private _processCodeBlocksInResponse(text: string): string {
        const codeBlocks = extractCodeBlocks(text);
        
        if (codeBlocks.length === 0) {
            return text; // Kod bloğu yoksa yanıtı olduğu gibi döndür
        }
        
        let processedText = text;
        
        // Her kod bloğunu işle
        for (let i = 0; i < codeBlocks.length; i++) {
            const { code, fileName } = codeBlocks[i];
            
            if (!fileName) {
                continue; // Dosya adı yoksa işleme
            }
            
            // Orijinal kod bloğunu bul
            const language = getLanguageFromFileName(fileName);
            const codeBlockRegex = new RegExp('```[\\w-]+(?::' + this._escapeRegExp(fileName) + ')?\\n[\\s\\S]*?```', 'g');
            
            // Yeni formatlanmış kod bloğunu oluştur
            const formattedBlock = this._createFormattedCodeBlock(code, fileName, language);
            
            // İlk eşleşmeyi değiştir
            const match = codeBlockRegex.exec(processedText);
            if (match) {
                processedText = processedText.replace(match[0], formattedBlock);
            }
        }
        
        return processedText;
    }
    
    /**
     * Formatlanmış kod bloğu oluşturur (dosya adı ve uygulama butonu ile)
     */
    private _createFormattedCodeBlock(code: string, fileName: string, language: string): string {
        const uniqueId = this._generateId();
        
        // Kod bloğunu oluştur
        return `<div class="code-block-container">
    <div class="code-block-header">
        <span class="code-filename">${fileName}</span>
        <button class="apply-code-btn" data-code="${this._escapeHtml(code)}" data-filename="${this._escapeHtml(fileName)}" id="apply-${uniqueId}">Apply Code</button>
    </div>
    <pre><code class="language-${language}">${this._escapeHtml(code)}</code></pre>
</div>`;
    }
    
    /**
     * Regex için özel karakterleri escape eder
     */
    private _escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    /**
     * HTML için özel karakterleri escape eder
     */
    private _escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    /**
     * Benzersiz ID oluşturur
     */
    private _generateId(): string {
        return Math.random().toString(36).substring(2, 11);
    }

    /**
     * Editörden kodu alıp WebView'a gönderir
     */
    private _updateCodeFromEditor(editor: vscode.TextEditor) {
        if (!this._isReady) {
            return;
        }
        
        // Belge dil tipi
        const languageId = editor.document.languageId;
        const fileName = path.basename(editor.document.fileName);
        
        // Editörden tüm metni al
        const code = editor.document.getText();
        
        // Seçilen metin varsa onu al, yoksa tüm metni kullan
        const selection = editor.selection;
        const selectedCode = selection && !selection.isEmpty
            ? editor.document.getText(selection)
            : code;
            
        // Satır bilgisini hazırla
        let lineInfo = '';
        if (selection && !selection.isEmpty) {
            lineInfo = `Satır ${selection.start.line + 1}-${selection.end.line + 1}`;
        }
        
        // Durum değişkenlerini güncelle
        this._currentCode = selectedCode;
        this._currentLanguage = languageId;
        this._currentFileName = fileName;
        
        // WebView'a kodu gönder
        this._panel.webview.postMessage({
            command: 'setCode',
            code: selectedCode,
            language: languageId,
            fileName: fileName,
            lineInfo: lineInfo
        });
    }

    /**
     * WebView için HTML içeriğini oluşturur
     */
    private _getHtmlForWebview() {
        // path ve webview için yardımcı değişkenler
        const webview = this._panel.webview;
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'inline-chat', 'inline-chat.js')
        );
        const styleMainUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'inline-chat', 'prism.css')
        );
        const inlineChatCssUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'inline-chat', 'inline-chat.css')
        );
        const prismScriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'inline-chat', 'prism.js')
        );

        // Use a nonce to whitelist scripts
        const nonce = getNonce();

        try {
            // HTML dosyasını doğrudan oku
            const htmlFilePath = path.join(
                this._extensionUri.fsPath, 
                'media', 
                'inline-chat', 
                'inline-chat.html'
            );
            
            let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
            
            // Dosya yollarını ve nonce'yi değiştir
            htmlContent = htmlContent
                .replace('<link rel="stylesheet" href="./prism.css">', 
                         `<link rel="stylesheet" href="${styleMainUri}" nonce="${nonce}">`)
                .replace('<link rel="stylesheet" href="./inline-chat.css">', 
                         `<link rel="stylesheet" href="${inlineChatCssUri}" nonce="${nonce}">`)
                .replace('<script src="./prism.js"></script>', 
                         `<script src="${prismScriptUri}" nonce="${nonce}"></script>`)
                .replace('<script src="./inline-chat.js"></script>', 
                         `<script src="${scriptUri}" nonce="${nonce}"></script>`);
                         
            // CSP'yi ekle
            const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:;">`;
            htmlContent = htmlContent.replace('</head>', `${cspMeta}\n</head>`);
            
            return htmlContent;
        } catch (error) {
            console.error('HTML dosyası okunurken hata oluştu:', error);
            
            // Fallback HTML template
            return `<!DOCTYPE html>
                <html lang="tr">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Byte AI Inline Chat</title>
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
                    <link href="${styleMainUri}" rel="stylesheet" nonce="${nonce}">
                    <link href="${inlineChatCssUri}" rel="stylesheet" nonce="${nonce}">
                </head>
                <body>
                    <div class="container">
                        <div class="error-message">
                            HTML şablonu yüklenemedi. Lütfen uzantıyı yeniden yükleyin.
                        </div>
                    </div>
                    <script nonce="${nonce}" src="${prismScriptUri}"></script>
                    <script nonce="${nonce}" src="${scriptUri}"></script>
                </body>
                </html>`;
        }
    }

    /**
     * Kodu belirtilen dosyaya uygular
     */
    private async _applyCode(fileName: string, code: string): Promise<void> {
        try {
            // byte.applyCode komutunu çağır
            await vscode.commands.executeCommand('byte.applyCode', fileName, code);
            
            // Başarılı sonucu WebView'a bildir
            this._panel.webview.postMessage({
                command: 'applyCodeResult',
                success: true,
                fileName: fileName
            });
        } catch (error) {
            console.error('Kod uygulama hatası:', error);
            
            // Hata durumunu WebView'a bildir
            this._panel.webview.postMessage({
                command: 'applyCodeResult',
                success: false,
                fileName: fileName,
                error: error instanceof Error ? error.message : 'Bilinmeyen hata'
            });
        }
    }

    /**
     * Panel kapatıldığında kaynakları temizle
     */
    public dispose() {
        InlineChatPanel.instance = undefined;

        // Paneli temizle
        this._panel.dispose();

        // Disposable'ları temizle
        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}

/**
 * WebView için ayarları oluşturur
 */
function getWebviewOptions(extensionUri: vscode.Uri): vscode.WebviewOptions {
    return {
        // Webview'ın uyması gereken kısıtlamalar
        enableScripts: true,
        localResourceRoots: [
            vscode.Uri.joinPath(extensionUri, 'media')
        ]
    };
}