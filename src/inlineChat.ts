import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getNonce } from './utils';
import { ByteAIClient } from './client';

/**
 * Inline Chat WebView Panel sınıfı
 */
export class InlineChatPanel {
    public static readonly viewType = 'byteAIInlineChat';
    private static instance: InlineChatPanel | undefined;

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
    public static createOrShow(extensionUri: vscode.Uri, client: ByteAIClient): InlineChatPanel {
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
                await this._processUserMessage('Kodu düzelt ve iyileştir');
                break;
                
            case 'optimizeCode':
                await this._processUserMessage('Kodu optimize et');
                break;
                
            case 'testCode':
                await this._processUserMessage('Bu kod için unit testler oluştur');
                break;
                
            case 'explainCode':
                await this._processUserMessage('Bu kodu açıkla');
                break;
                
            case 'ready':
                this._isReady = true;
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

            // AI yanıtını WebView'a gönder
            this._panel.webview.postMessage({
                command: 'addMessage',
                text: response.text,
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