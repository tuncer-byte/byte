import * as vscode from 'vscode';
import * as path from 'path';
import { AIService } from '../../services/ai';
import { CommandManager } from '../../commands';
import { ChatPanelProvider } from './types';
import { getWebviewContent } from './utils/helpers';
import { MessageHandler } from './handlers/message-handler';

/**
 * Sohbet paneli WebView için yönetici sınıf
 */
export class ChatPanel implements ChatPanelProvider {
    public static readonly viewType = 'byteChatView';
    
    private view?: vscode.WebviewView;
    private messageHandler: MessageHandler;
    private activeEditorDisposable?: vscode.Disposable;
    
    constructor(
        private readonly extensionUri: vscode.Uri,
        private aiService: AIService
    ) {
        // MessageHandler sınıfını oluştur
        this.messageHandler = new MessageHandler(undefined, aiService, undefined, true, '');
        
        // Aktif editörü izle
        this._registerActiveEditorListener();
    }
    
    /**
     * Command Manager'ı ayarlar
     */
    public setCommandManager(commandManager: CommandManager): void {
        this.messageHandler.setCommandManager(commandManager);
    }
    
    /**
     * Aktif editör değişikliklerini dinleyen metod
     */
    private _registerActiveEditorListener(): void {
        // Mevcut aktif editörü kontrol et
        if (vscode.window.activeTextEditor) {
            this.messageHandler.updateCurrentFile(vscode.window.activeTextEditor.document.uri.fsPath);
        } else {
            this.messageHandler.updateCurrentFile('');
        }
        
        // Aktif editör değiştiğinde olayı dinle
        this.activeEditorDisposable = vscode.Disposable.from(
            // Aktif editör değişimini dinle
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor) {
                    this.messageHandler.updateCurrentFile(editor.document.uri.fsPath);
                } else {
                    this.messageHandler.updateCurrentFile('');
                }
            }),
            
            // Dosya içeriği değiştiğinde 
            vscode.workspace.onDidChangeTextDocument(event => {
                // Sadece aktif editör dosyası değiştiyse güncelle
                if (vscode.window.activeTextEditor && 
                    event.document === vscode.window.activeTextEditor.document) {
                    // Dosya içeriği değiştiğini bildir - mevcut file path'i kullan
                    this.messageHandler.updateCurrentFile(event.document.uri.fsPath);
                }
            }),
            
            // Yeni dosya açıldığında
            vscode.workspace.onDidOpenTextDocument(document => {
                if (vscode.window.activeTextEditor && 
                    document === vscode.window.activeTextEditor.document) {
                    this.messageHandler.updateCurrentFile(document.uri.fsPath);
                }
            }),
            
            // Dosya kaydetme olayı
            vscode.workspace.onDidSaveTextDocument(document => {
                if (vscode.window.activeTextEditor && 
                    document === vscode.window.activeTextEditor.document) {
                    this.messageHandler.updateCurrentFile(document.uri.fsPath);
                }
            })
        );
    }
    
    /**
     * WebView oluşturulduğunda çağrılır
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this.view = webviewView;
        
        // MessageHandler'a view'i aktar
        this.messageHandler = new MessageHandler(
            webviewView, 
            this.aiService, 
            undefined, 
            this.messageHandler.isAgentEnabled(),
            ''
        );
        
        // WebView genişliğini artır
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this.extensionUri
            ]
        };
        
        // Panel genişliğini ayarla - minimum genişlik 400px
        webviewView.webview.html = getWebviewContent(this.extensionUri, webviewView.webview);
        
        // CSS ile içeriğin genişliğini artır
        this.view.onDidChangeVisibility(() => {
            setTimeout(() => {
                if (this.view && this.view.visible) {
                    const minWidth = 400; // Minimum genişlik 400px
                    // Extension'ın genişliğini ayarla
                    this.view.webview.postMessage({
                        type: 'setWidth',
                        width: minWidth
                    });
                    
                    // Önbellek durum bilgisini gönder
                    this.updateCacheStats();
                }
            }, 100);
        });
        
        // WebView ile mesajlaşma
        webviewView.webview.onDidReceiveMessage(
            async (message) => {
                // Mesajı MessageHandler sınıfına ilet
                if (message.type === 'clearCache') {
                    // Önbellek temizleme isteği
                    this.aiService.clearAllCache();
                    webviewView.webview.postMessage({
                        type: 'cacheCleared',
                        success: true,
                        message: "Önbellek başarıyla temizlendi."
                    });
                    this.updateCacheStats();
                } else if (message.type === 'updateCacheSettings') {
                    // Önbellek ayarlarını güncelleme isteği
                    await this.aiService.updateCacheSettings(message.settings.enabled);
                    this.updateCacheStats();
                } else {
                    // Diğer mesajları mevcut işleyiciye ilet
                    await this.messageHandler.handleMessage(message);
                }
            },
            this,
            []
        );
        
        // WebView hazır olduğunda çağrılacak
        webviewView.onDidChangeVisibility(() => {
            if (webviewView.visible) {
                // MessageHandler üzerinden view güncellemesi yap
                this.messageHandler.updateView();
            }
        });
    }
    
    /**
     * Önbellek istatistiklerini gönderir
     */
    private async updateCacheStats(): Promise<void> {
        if (!this.view || !this.view.visible) {
            return;
        }
        
        // Cacheleme devre dışı olduğu için boş istatistik gönder
        const stats = {
            totalCached: 0,
            totalTokensSaved: 0,
            enabled: false,
            lastUpdated: new Date().toISOString()
        };
        
        this.view.webview.postMessage({
            type: 'cacheStats',
            stats
        });
    }
    
    /**
     * Agent durumunu döndürür
     */
    public isAgentEnabled(): boolean {
        return this.messageHandler.isAgentEnabled();
    }
    
    /**
     * Uzantı devre dışı bırakıldığında kaynakları temizle
     */
    public dispose(): void {
        if (this.activeEditorDisposable) {
            this.activeEditorDisposable.dispose();
        }
    }
} 