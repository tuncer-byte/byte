import * as vscode from 'vscode';
import * as path from 'path';
import { AIService } from '../ai';
import { 
    DetectedError, 
    ErrorType, 
    SolutionType, 
    ErrorSolution,
    BugFinderState
} from './types';
import { parse as parseStackTrace } from './utils/stack-parser';
import { identifyErrorType } from './utils/error-identifier';
import { generatePrompt } from './utils/prompt-generator';

/**
 * Terminal hatalarını yakalayıp AI ile çözümler üreten servis
 */
export class BugFinderService {
    private terminalDataListener: vscode.Disposable | undefined;
    private state: BugFinderState = {
        lastErrors: [],
        errorHistory: [],
        isMonitoring: false
    };
    private statusBarItem: vscode.StatusBarItem;
    
    constructor(
        private context: vscode.ExtensionContext,
        private aiService: AIService
    ) {
        // Durum çubuğu öğesi oluştur
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'byte.stopErrorMonitoring'; // Tıklandığında izlemeyi durdur
        this.context.subscriptions.push(this.statusBarItem);
        
        this.loadState();
        
        // Eğer önceki oturumdan izleme aktifse, durum göstergesini güncelle
        if (this.state.isMonitoring) {
            this.updateStatusBarItem(true);
        }
    }
    
    /**
     * Durum çubuğu öğesini günceller
     */
    private updateStatusBarItem(monitoring: boolean): void {
        if (monitoring) {
            this.statusBarItem.text = '$(bug) Byte AI: Hata İzleme Aktif';
            this.statusBarItem.tooltip = 'Terminal hata izleme aktif. Tıklayarak durdurabilirsiniz.';
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
            this.statusBarItem.show();
        } else {
            this.statusBarItem.hide();
        }
    }
    
    /**
     * Durumu yükler
     */
    private loadState(): void {
        const savedState = this.context.workspaceState.get<BugFinderState>('bugFinderState');
        if (savedState) {
            this.state = savedState;
        }
    }
    
    /**
     * Durumu kaydeder
     */
    private saveState(): void {
        this.context.workspaceState.update('bugFinderState', this.state);
    }
    
    /**
     * Terminal izlemeyi başlatır
     */
    public startMonitoring(): void {
        if (this.state.isMonitoring) {
            vscode.window.showInformationMessage('Byte AI: Terminal hata izleme zaten aktif durumda.');
            return;
        }
        
        // Terminal API'lerini kullanmak için uzantı API'sini aktifleştir
        const terminalWriteEvent = (vscode.window as any).onDidWriteTerminalData;
        
        if (terminalWriteEvent) {
            // Tüm terminallerde veri değişikliklerini dinle
            this.terminalDataListener = terminalWriteEvent((e: { terminal: vscode.Terminal, data: string }) => {
                this.processTerminalData(e.terminal.name, e.data);
            });
            
            this.state.isMonitoring = true;
            this.saveState();
            
            // Durum çubuğunu güncelle
            this.updateStatusBarItem(true);
            
            // Daha görünür bir başlangıç bildirimi göster
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Byte AI: Terminal Hata İzleme",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 100, message: "Hata izleme başlatıldı! Artık terminaldeki hatalar otomatik olarak tespit edilecek." });
                await new Promise(resolve => setTimeout(resolve, 3000)); // Bildirimi 3 saniye göster
                return;
            });
            
            // Kalıcı bilgi durumu göster
            vscode.window.setStatusBarMessage('$(bug) Byte AI: Hata izleme aktif', 5000);
            
        } else {
            vscode.window.showErrorMessage('Terminal veri izleme API\'si bu VS Code sürümünde desteklenmiyor.');
        }
    }
    
    /**
     * Terminal izlemeyi durdurur
     */
    public stopMonitoring(): void {
        if (!this.state.isMonitoring) {
            vscode.window.showInformationMessage('Byte AI: Terminal hata izleme zaten durdurulmuş durumda.');
            return;
        }
        
        if (this.terminalDataListener) {
            this.terminalDataListener.dispose();
            this.terminalDataListener = undefined;
        }
        
        this.state.isMonitoring = false;
        this.saveState();
        
        // Durum çubuğunu güncelle
        this.updateStatusBarItem(false);
        
        // Daha görünür bir durdurma bildirimi göster
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Byte AI: Terminal Hata İzleme",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 100, message: "Hata izleme durduruldu. Artık terminaldeki hatalar izlenmeyecek." });
            await new Promise(resolve => setTimeout(resolve, 3000)); // Bildirimi 3 saniye göster
            return;
        });
        
        // Durumu göster
        vscode.window.setStatusBarMessage('$(stop) Byte AI: Hata izleme durduruldu', 5000);
    }
    
    /**
     * Terminal verilerini işler ve hata olup olmadığını kontrol eder
     */
    private processTerminalData(terminalName: string, data: string): void {
        // Veriyi satırlara böl
        const lines = data.split('\n');
        
        // Hata mesajı olabilecek satırları kontrol et
        const errorLines = lines.filter(line => 
            line.includes('Error:') || 
            line.includes('Exception:') || 
            line.includes('Failed:') ||
            line.includes('error:') ||
            line.includes('fail:') ||
            line.includes('TypeError:') ||
            line.includes('SyntaxError:') ||
            line.includes('ReferenceError:')
        );
        
        if (errorLines.length > 0) {
            // Potansiyel bir hata tespit edildi
            const errorMessage = errorLines.join('\n');
            
            // Stack trace'i bul (hata sonrası satırlar genellikle stack trace içerir)
            const errorIndex = lines.findIndex(line => errorLines.includes(line));
            const stackTrace = errorIndex !== -1 ? 
                lines.slice(errorIndex, Math.min(errorIndex + 10, lines.length)).join('\n') : 
                '';
            
            // Hata tipi belirleme
            const errorType = identifyErrorType(errorMessage);
            
            // İlgili dosyaları bul
            const relatedFiles = parseStackTrace(stackTrace);
            
            // Hata objesini oluştur
            const error: DetectedError = {
                message: errorMessage,
                errorType,
                stack: stackTrace,
                relatedFiles: relatedFiles.map(file => file.fileName),
                source: terminalName
            };
            
            // Hata geçmişine ekle
            this.state.lastErrors.unshift(error);
            if (this.state.lastErrors.length > 5) {
                this.state.lastErrors.pop();
            }
            
            this.state.errorHistory.unshift({
                timestamp: Date.now(),
                error
            });
            
            this.saveState();
            
            // Kullanıcıya bildir
            this.notifyUser(error);
        }
    }
    
    /**
     * Kullanıcıya hata hakkında bildirim gösterir
     */
    private notifyUser(error: DetectedError): void {
        const analyzeAction = 'Hatayı AI ile Analiz Et';
        const ignoreAction = 'Yoksay';
        
        vscode.window.showErrorMessage(
            `Byte AI: Terminal hatası tespit edildi: ${error.message.substring(0, 50)}...`,
            analyzeAction,
            ignoreAction
        ).then(selection => {
            if (selection === analyzeAction) {
                this.analyzeErrorWithAI(error);
            }
        });
    }
    
    /**
     * Geçmiş hatalardan birini analiz eder
     */
    public async analyzeHistoricalError(index: number): Promise<void> {
        if (index < 0 || index >= this.state.errorHistory.length) {
            vscode.window.showErrorMessage('Geçersiz hata indeksi');
            return;
        }
        
        const errorEntry = this.state.errorHistory[index];
        await this.analyzeErrorWithAI(errorEntry.error);
    }
    
    /**
     * Hata mesajını AI ile analiz eder ve çözüm önerileri sunar
     */
    public async analyzeErrorWithAI(error: DetectedError): Promise<void> {
        try {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Hata analiz ediliyor...",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Bağlam toplanıyor..." });
                
                // İlgili dosya içeriklerini al
                const fileContents: Record<string, string> = {};
                if (error.relatedFiles && error.relatedFiles.length > 0) {
                    for (const file of error.relatedFiles) {
                        try {
                            const document = await vscode.workspace.openTextDocument(file);
                            fileContents[file] = document.getText();
                        } catch (e) {
                            console.error(`Dosya okunamadı: ${file}`, e);
                        }
                    }
                }
                
                progress.report({ increment: 30, message: "AI tarafından analiz ediliyor..." });
                
                // AI için prompt oluştur
                const prompt = generatePrompt(error, fileContents);
                
                // AI'dan yanıt al
                const aiResponse = await this.aiService.sendMessage(prompt);
                
                progress.report({ increment: 70, message: "Çözüm önerileri hazırlanıyor..." });
                
                // AI yanıtını işle ve çözüm önerileri oluştur
                const solution = this.parseSolution(aiResponse, error);
                
                // Çözümü hata geçmişine kaydet
                const historyIndex = this.state.errorHistory.findIndex(entry => 
                    entry.error.message === error.message && 
                    entry.error.stack === error.stack
                );
                
                if (historyIndex !== -1) {
                    this.state.errorHistory[historyIndex].solution = solution;
                    this.saveState();
                }
                
                // Çözümü göster
                this.showSolution(error, solution);
                
                return;
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Hata analiz edilirken bir sorun oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
        }
    }
    
    /**
     * AI yanıtını işleyerek yapılandırılmış bir çözüm objesi oluşturur
     */
    private parseSolution(aiResponse: string, error: DetectedError): ErrorSolution {
        // Varsayılan çözüm
        const defaultSolution: ErrorSolution = {
            type: SolutionType.Explanation,
            description: aiResponse
        };
        
        try {
            // AI yanıtında komut önerisi var mı kontrol et
            const commandMatch = aiResponse.match(/```(bash|sh|cmd|terminal|shell)\n(.*?)\n```/s);
            if (commandMatch && commandMatch[2]) {
                defaultSolution.commandToRun = commandMatch[2].trim();
                defaultSolution.type = SolutionType.Installation;
            }
            
            // Kod değişiklikleri var mı kontrol et
            const codeBlocks = this.extractCodeBlocks(aiResponse);
            if (codeBlocks.length > 0) {
                defaultSolution.codeChanges = [];
                defaultSolution.type = SolutionType.CodeChange;
                
                for (const block of codeBlocks) {
                    if (block.fileName && block.code) {
                        // Dosya değişikliği önerisi tespit edildi
                        defaultSolution.codeChanges.push({
                            fileName: block.fileName,
                            changes: [{
                                range: new vscode.Range(0, 0, 1000000, 0), // Tam dosyayı kapsayan range
                                replacementText: block.code
                            }]
                        });
                    }
                }
            }
            
            return defaultSolution;
        } catch (e) {
            console.error('Çözüm ayrıştırılırken hata oluştu:', e);
            return defaultSolution;
        }
    }
    
    /**
     * AI yanıtından kod bloklarını ve dosya adlarını çıkarır
     */
    private extractCodeBlocks(text: string): Array<{code: string, fileName: string | null}> {
        const codeBlocks: Array<{code: string, fileName: string | null}> = [];
        
        // Dosya adı ile birlikte kod bloğu formatını kontrol et
        // Format: ```language:path/to/file.ext veya ```language (dosya adı yok)
        const regex = /```([\w-]+)(?::([^\n]+))?\n([\s\S]*?)```/g;
        
        let match;
        while ((match = regex.exec(text)) !== null) {
            const language = match[1] || '';
            const fileName = match[2] || null; // Dosya adı belirtilmemişse null
            const code = match[3] || '';
            
            codeBlocks.push({
                code: code.trim(),
                fileName: fileName
            });
        }
        
        return codeBlocks;
    }
    
    /**
     * Çözümü kullanıcıya gösterir ve uygulama seçenekleri sunar
     */
    private showSolution(error: DetectedError, solution: ErrorSolution): void {
        // Çözüm panelini göster
        const panel = vscode.window.createWebviewPanel(
            'bugFinderSolution',
            'Hata Çözümü',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        
        // Panel içeriğini oluştur
        panel.webview.html = this.getSolutionHtml(panel.webview, error, solution);
        
        // Panel mesajlarını dinle
        panel.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'applyCommand':
                    // Terminalde komut çalıştır
                    if (solution.commandToRun) {
                        vscode.commands.executeCommand('byte.runInTerminal', solution.commandToRun);
                    }
                    break;
                    
                case 'applyCodeChanges':
                    // Kod değişikliklerini uygula
                    if (solution.codeChanges && solution.codeChanges.length > 0) {
                        await this.applyCodeChanges(solution.codeChanges);
                    }
                    break;
                    
                case 'dismiss':
                    panel.dispose();
                    break;
            }
        });
    }
    
    /**
     * Çözüm için HTML içeriği oluşturur
     */
    private getSolutionHtml(webview: vscode.Webview, error: DetectedError, solution: ErrorSolution): string {
        const nonce = this.getNonce();
        
        return `<!DOCTYPE html>
        <html lang="tr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
            <title>Hata Çözümü</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                    padding: 16px;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    line-height: 1.5;
                }
                h1 {
                    color: var(--vscode-editor-foreground);
                    font-size: 18px;
                    margin-bottom: 16px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--vscode-input-border);
                }
                h2 {
                    color: var(--vscode-editor-foreground);
                    font-size: 16px;
                    margin-top: 24px;
                    margin-bottom: 8px;
                }
                h3 {
                    color: var(--vscode-editor-foreground);
                    font-size: 14px;
                    margin-top: 16px;
                    margin-bottom: 8px;
                }
                .error-box {
                    background-color: var(--vscode-inputValidation-errorBackground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                    border-radius: 4px;
                    padding: 12px;
                    margin-bottom: 20px;
                    white-space: pre-wrap;
                    overflow-wrap: break-word;
                    max-height: 200px;
                    overflow-y: auto;
                }
                .solution-box {
                    background-color: var(--vscode-editor-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    padding: 16px;
                    margin-bottom: 20px;
                    overflow-wrap: break-word;
                }
                p {
                    margin: 8px 0;
                    line-height: 1.6;
                }
                pre.code-block {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    padding: 10px;
                    border-radius: 4px;
                    overflow-x: auto;
                    margin: 12px 0;
                    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
                }
                code.inline-code {
                    font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    padding: 2px 5px;
                    border-radius: 3px;
                    font-size: 0.9em;
                }
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 8px;
                    margin-top: 10px;
                    font-size: 13px;
                    transition: background-color 0.2s;
                }
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .file-name {
                    font-weight: bold;
                    margin-top: 16px;
                    margin-bottom: 4px;
                    color: var(--vscode-textLink-foreground);
                    background-color: var(--vscode-textBlockQuote-background);
                    padding: 4px 8px;
                    border-top-left-radius: 4px;
                    border-top-right-radius: 4px;
                    border-left: 3px solid var(--vscode-textLink-activeForeground);
                }
                .action-container {
                    margin-top: 20px;
                    display: flex;
                    gap: 8px;
                }
                a.markdown-link {
                    color: var(--vscode-textLink-foreground);
                    text-decoration: none;
                }
                a.markdown-link:hover {
                    text-decoration: underline;
                }
                ul, ol {
                    padding-left: 20px;
                    margin: 8px 0;
                }
                li {
                    margin: 4px 0;
                }
                strong {
                    color: var(--vscode-editorMarkerNavigationInfo-headerBackground);
                }
                hr {
                    border: none;
                    height: 1px;
                    background-color: var(--vscode-input-border);
                    margin: 16px 0;
                }
                .solution-nav {
                    display: flex;
                    margin-bottom: 12px;
                    border-bottom: 1px solid var(--vscode-input-border);
                    padding-bottom: 8px;
                }
                .solution-nav-item {
                    padding: 6px 12px;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    margin-right: 8px;
                }
                .solution-nav-item.active {
                    border-bottom: 2px solid var(--vscode-textLink-activeForeground);
                    font-weight: bold;
                }
                .solution-section {
                    display: none;
                }
                .solution-section.active {
                    display: block;
                }
            </style>
        </head>
        <body>
            <h1>Hata Tespiti ve Çözümü</h1>
            
            <h2>Tespit Edilen Hata</h2>
            <div class="error-box">
                ${this.escapeHtml(error.message)}
                ${error.stack ? `<hr>${this.escapeHtml(error.stack)}` : ''}
            </div>
            
            <h2>AI Tarafından Önerilen Çözüm</h2>
            <div class="solution-nav">
                <div class="solution-nav-item active" data-section="cozum">Çözüm</div>
                <div class="solution-nav-item" data-section="aciklama">Açıklama</div>
                ${solution.commandToRun ? `<div class="solution-nav-item" data-section="komut">Komut</div>` : ''}
                ${solution.codeChanges && solution.codeChanges.length > 0 ? `<div class="solution-nav-item" data-section="kod">Kod Değişiklikleri</div>` : ''}
            </div>
            
            <div class="solution-section active" id="cozum-section">
                <div class="solution-box">
                    ${this.markdownToHtml(solution.description)}
                </div>
            </div>
            
            <div class="solution-section" id="aciklama-section">
                <div class="solution-box">
                    <h3>Hata Analizi</h3>
                    <p>Bu hatanın kök nedeni genellikle şu gibi faktörlerden kaynaklanır:</p>
                    <ul>
                        <li>Kod sözdizimi veya mantık hataları</li>
                        <li>Eksik veya hatalı yapılandırma</li>
                        <li>Eksik bağımlılıklar veya çakışan kütüphaneler</li>
                        <li>Sistem izinleri veya çevresel faktörler</li>
                    </ul>
                    <p>AI, hatayı kontekst içinde analiz ederek en olası çözümü sunmaya çalışır.</p>
                </div>
            </div>
            
            ${solution.commandToRun ? `
            <div class="solution-section" id="komut-section">
                <div class="solution-box">
                    <h3>Çalıştırılacak Komut</h3>
                    <pre class="code-block"><code class="language-bash">${this.escapeHtml(solution.commandToRun)}</code></pre>
                    <p>Bu komutu çalıştırmak için "Komutu Çalıştır" butonunu kullanabilirsiniz.</p>
                </div>
            </div>
            ` : ''}
            
            ${solution.codeChanges && solution.codeChanges.length > 0 ? `
            <div class="solution-section" id="kod-section">
                <div class="solution-box">
                    <h3>Önerilen Kod Değişiklikleri</h3>
                    ${solution.codeChanges.map(change => `
                        <div class="file-name">${this.escapeHtml(change.fileName)}</div>
                        <pre class="code-block"><code>${this.escapeHtml(change.changes[0].replacementText)}</code></pre>
                    `).join('')}
                    <p>Bu değişiklikleri uygulamak için "Kod Değişikliklerini Uygula" butonunu kullanabilirsiniz.</p>
                </div>
            </div>
            ` : ''}
            
            <div class="action-container">
                ${solution.commandToRun ? `<button id="apply-command">Komutu Çalıştır</button>` : ''}
                ${solution.codeChanges && solution.codeChanges.length > 0 ? `<button id="apply-code">Kod Değişikliklerini Uygula</button>` : ''}
                <button id="dismiss">Kapat</button>
            </div>
            
            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                
                // Tab navigation
                document.querySelectorAll('.solution-nav-item').forEach(item => {
                    item.addEventListener('click', () => {
                        // Remove active class from all tabs and sections
                        document.querySelectorAll('.solution-nav-item').forEach(i => i.classList.remove('active'));
                        document.querySelectorAll('.solution-section').forEach(s => s.classList.remove('active'));
                        
                        // Add active class to clicked tab
                        item.classList.add('active');
                        
                        // Show corresponding section
                        const sectionId = item.getAttribute('data-section') + '-section';
                        document.getElementById(sectionId).classList.add('active');
                    });
                });
                
                document.getElementById('dismiss')?.addEventListener('click', () => {
                    vscode.postMessage({ command: 'dismiss' });
                });
                
                ${solution.commandToRun ? `
                document.getElementById('apply-command')?.addEventListener('click', () => {
                    vscode.postMessage({ command: 'applyCommand' });
                });
                ` : ''}
                
                ${solution.codeChanges && solution.codeChanges.length > 0 ? `
                document.getElementById('apply-code')?.addEventListener('click', () => {
                    vscode.postMessage({ command: 'applyCodeChanges' });
                });
                ` : ''}
            </script>
        </body>
        </html>`;
    }
    
    /**
     * Güvenli bir nonce oluşturur
     */
    private getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
    
    /**
     * Metni doğrudan HTML olarak kullanmak için güvenli hale getirir
     */
    private escapeHtml(unsafe: string): string {
        return unsafe
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    
    /**
     * Markdown metinini HTML'e dönüştürür (gelişmiş implementasyon)
     */
    private markdownToHtml(markdown: string): string {
        if (!markdown) {
            return '';
        }
        
        // Önce sabit kod bloklarını işaretlerle değiştirelim ki onları koruyalım
        const codeBlocks: string[] = [];
        let codeBlockIndex = 0;
        
        // Kod bloklarını işle
        let processedMarkdown = markdown.replace(/```([\w-]+)(?::([^\n]+))?\n([\s\S]*?)```/g, (match, language, fileName, code) => {
            const placeholder = `___CODE_BLOCK_${codeBlockIndex}___`;
            
            let header = '';
            if (fileName) {
                header = `<div class="file-name">${this.escapeHtml(fileName)}</div>`;
            }
            
            const codeHtml = `${header}<pre class="code-block"><code class="language-${language}">${this.escapeHtml(code)}</code></pre>`;
            codeBlocks.push(codeHtml);
            codeBlockIndex++;
            
            return placeholder;
        });
        
        // Inline kod
        processedMarkdown = processedMarkdown.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        
        // Başlıklar
        processedMarkdown = processedMarkdown.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        processedMarkdown = processedMarkdown.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        processedMarkdown = processedMarkdown.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        
        // Linkler
        processedMarkdown = processedMarkdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="markdown-link">$1</a>');
        
        // Güçlü metin ve italik
        processedMarkdown = processedMarkdown.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        processedMarkdown = processedMarkdown.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        processedMarkdown = processedMarkdown.replace(/_([^_]+)_/g, '<em>$1</em>');
        
        // Düzenli sıralı liste elemanları
        processedMarkdown = processedMarkdown.replace(/^\s*(\d+\.) (.*$)/gm, (match, number, content) => {
            // Önceki satır liste elemanı değilse, liste başlıyor
            const prevLine = match.split('\n')[0]?.trim() || '';
            const isNewList = !prevLine.match(/^\d+\./);
            
            if (isNewList) {
                return `<ol><li>${content}</li>`;
            }
            return `<li>${content}</li>`;
        });
        
        // Düzenli sıralı olmayan liste elemanları
        processedMarkdown = processedMarkdown.replace(/^\s*[\*\-] (.*$)/gm, (match, content) => {
            // Önceki satır liste elemanı değilse, liste başlıyor
            const prevLine = match.split('\n')[0]?.trim() || '';
            const isNewList = !prevLine.match(/^\s*[\*\-]/);
            
            if (isNewList) {
                return `<ul><li>${content}</li>`;
            }
            return `<li>${content}</li>`;
        });
        
        // Listeleri kapat
        processedMarkdown = processedMarkdown.replace(/(<\/li>)(\s*)(?!<li>)/g, '$1</ul>');
        processedMarkdown = processedMarkdown.replace(/(<\/li>)(\s*)(?!<li>)/g, '$1</ol>');
        
        // Horizontal rule
        processedMarkdown = processedMarkdown.replace(/^\s*---\s*$/gm, '<hr>');
        
        // Paragraflar
        processedMarkdown = processedMarkdown.replace(/\n\s*\n/g, '</p><p>');
        
        // Yeni satırlar
        processedMarkdown = processedMarkdown.replace(/\n(?![<])/g, '<br>');
        
        // Kod bloklarını geri koy
        codeBlocks.forEach((block, index) => {
            processedMarkdown = processedMarkdown.replace(`___CODE_BLOCK_${index}___`, block);
        });
        
        // Tam sayfayı paragraf etiketleriyle sarmala
        if (!processedMarkdown.startsWith('<p>')) {
            processedMarkdown = `<p>${processedMarkdown}`;
        }
        if (!processedMarkdown.endsWith('</p>')) {
            processedMarkdown = `${processedMarkdown}</p>`;
        }
        
        return processedMarkdown;
    }
    
    /**
     * Kod değişikliklerini belirtilen dosyalara uygular
     */
    private async applyCodeChanges(codeChanges: Array<{
        fileName: string, 
        changes: Array<{
            range: vscode.Range,
            replacementText: string
        }>
    }>): Promise<void> {
        const workspaceEdit = new vscode.WorkspaceEdit();
        
        for (const fileChange of codeChanges) {
            const fileName = fileChange.fileName;
            
            // VS Code URI'sini oluştur
            let uri: vscode.Uri;
            try {
                // Tam yol verilmişse direkt kullan
                if (path.isAbsolute(fileName)) {
                    uri = vscode.Uri.file(fileName);
                } else {
                    // Göreli yol verilmişse, workspace'e göre yolu oluştur
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
                    if (!workspaceFolder) {
                        throw new Error('Çalışma alanı bulunamadı');
                    }
                    uri = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
                }
                
                // Dosyanın var olup olmadığını kontrol et
                try {
                    await vscode.workspace.fs.stat(uri);
                    
                    // Dosya mevcutsa, değişiklikleri uygula
                    for (const change of fileChange.changes) {
                        workspaceEdit.replace(uri, change.range, change.replacementText);
                    }
                } catch (fileError) {
                    // Dosya yoksa, oluştur
                    const createOption = 'Dosyayı Oluştur';
                    const selection = await vscode.window.showWarningMessage(
                        `${fileName} dosyası mevcut değil. Oluşturmak ister misiniz?`,
                        { modal: true },
                        createOption
                    );
                    
                    if (selection === createOption) {
                        // Dosya yolundaki klasörleri oluştur
                        const dirname = path.dirname(fileName);
                        if (dirname && dirname !== '.') {
                            const dirPath = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, dirname);
                            try {
                                await vscode.workspace.fs.stat(dirPath);
                            } catch {
                                // Klasör yoksa oluştur
                                await vscode.workspace.fs.createDirectory(dirPath);
                            }
                        }
                        
                        // Yeni dosya oluştur ve içeriği yaz
                        const encoder = new TextEncoder();
                        await vscode.workspace.fs.writeFile(
                            uri, 
                            encoder.encode(fileChange.changes[0].replacementText)
                        );
                        
                        // Başarı mesajı göster
                        vscode.window.showInformationMessage(`Dosya oluşturuldu ve kod uygulandı: ${fileName}`);
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage(`${fileName} dosyasına değişiklikler uygulanırken hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
            }
        }
        
        // Değişiklikleri uygula
        if (workspaceEdit.size > 0) {
            const success = await vscode.workspace.applyEdit(workspaceEdit);
            if (success) {
                vscode.window.showInformationMessage('Kod değişiklikleri başarıyla uygulandı.');
            } else {
                vscode.window.showErrorMessage('Kod değişiklikleri uygulanırken bir sorun oluştu.');
            }
        }
    }
} 