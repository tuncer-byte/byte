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
import { TemplateLoader } from './utils/template-loader';

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
            // AI yanıtında komut önerisi var mı kontrol et - regex'i iyileştirelim
            // Önceki regex: /```(bash|sh|cmd|terminal|shell)\n(.*?)\n```/s
            // Daha geniş bir eşleşme için değiştirildi
            const commandMatch = aiResponse.match(/```(bash|sh|cmd|terminal|shell)\n([\s\S]*?)```/s);
            
            if (commandMatch && commandMatch[2]) {
                const commandText = commandMatch[2].trim();
                console.log('Terminal komutu tespit edildi:', commandText);
                defaultSolution.commandToRun = commandText;
                defaultSolution.type = SolutionType.Installation;
            } else {
                // Alternatif bir arama daha yap, bazen dil belirtilmez
                const simpleCmdMatch = aiResponse.match(/```\n?(.*?)\n?```/s);
                if (simpleCmdMatch && simpleCmdMatch[1] && 
                    (simpleCmdMatch[1].includes('npm ') || 
                     simpleCmdMatch[1].includes('yarn ') || 
                     simpleCmdMatch[1].includes('apt ') ||
                     simpleCmdMatch[1].includes('pip ') ||
                     simpleCmdMatch[1].includes('brew ') ||
                     simpleCmdMatch[1].includes('git '))) {
                    const commandText = simpleCmdMatch[1].trim();
                    console.log('Basit terminal komutu tespit edildi:', commandText);
                    defaultSolution.commandToRun = commandText;
                    defaultSolution.type = SolutionType.Installation;
                }
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
        
        // Byte AI renk paleti
        const byteColors = {
            primary: '#007ACC',        // Ana mavi renk
            secondary: '#0098FF',      // Açık mavi vurgu
            accent: '#FF6D00',         // Turuncu vurgu rengi 
            success: '#3FB950',        // Yeşil başarı rengi
            error: '#F85149',          // Kırmızı hata rengi
            warning: '#F7B93E',        // Sarı uyarı rengi
        };
        
        // Eklenti yolunu al
        const extensionUri = this.getExtensionUri();
        if (!extensionUri) {
            console.error('Eklenti URI oluşturulamadı');
        }
        
        // CSS dosyasının yolunu hesapla ve webview için güvenli hale getir
        const cssUri = extensionUri ? webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'bug-finder', 'styles.css')) : '';
        
        // Ana değişkenleri hazırla
        const variables: Record<string, string> = {
            nonce: nonce,
            cspSource: webview.cspSource,
            primaryColor: byteColors.primary,
            errorType: error.errorType || 'Bilinmeyen',
            errorMessage: this.escapeHtml(error.message),
            errorStack: error.stack ? `<hr>${this.escapeHtml(error.stack)}` : '',
            solutionDescription: this.markdownToHtml(solution.description),
            cssPath: cssUri.toString()
        };
        
        // Ek şablon parçalarını hazırla
        const templates: Record<string, string> = {
            commandTab: '',
            codeTab: '',
            commandSection: '',
            codeSection: '',
            commandButton: '',
            codeButton: '',
            commandScript: '',
            codeScript: ''
        };
        
        // Komut varsa ilgili bölümleri ekle
        if (solution.commandToRun) {
            console.log('Komut var, bölümleri ekliyorum:', solution.commandToRun);
            // Tab için gereken HTML parçası
            templates.commandTab = `<div class="solution-nav-item" data-section="komut">Komut</div>`;
            
            // Komut bölümü
            templates.commandSection = TemplateLoader.loadTemplate('command-section.html', {
                commandToRun: this.escapeHtml(solution.commandToRun)
            });
            
            // Komut butonu
            templates.commandButton = `<button id="apply-command">Komutu Çalıştır</button>`;
            
            // Script kısmı
            templates.commandScript = `
                document.getElementById('apply-command')?.addEventListener('click', () => {
                    vscode.postMessage({ command: 'applyCommand' });
                });
            `;
        }
        
        // Kod değişiklikleri varsa ilgili bölümleri ekle
        if (solution.codeChanges && solution.codeChanges.length > 0) {
            console.log('Kod değişiklikleri var, bölümleri ekliyorum');
            // Tab için gereken HTML parçası
            templates.codeTab = `<div class="solution-nav-item" data-section="kod">Kod Değişiklikleri</div>`;
            
            // Kod değişiklik listesini oluştur
            const codeChangesList: string[] = [];
            for (const change of solution.codeChanges) {
                codeChangesList.push(TemplateLoader.loadTemplate('file-template.html', {
                    fileName: this.escapeHtml(change.fileName),
                    fileContent: this.escapeHtml(change.changes[0].replacementText)
                }));
            }
            
            templates.codeSection = TemplateLoader.loadTemplate('code-section.html', {
                codeChangesList: codeChangesList.join('\n')
            });
            
            // Kod butonu
            templates.codeButton = `<button id="apply-code">Kod Değişikliklerini Uygula</button>`;
            
            // Script kısmı
            templates.codeScript = `
                document.getElementById('apply-code')?.addEventListener('click', () => {
                    vscode.postMessage({ command: 'applyCodeChanges' });
                });
            `;
        }
        
        // Ana şablonu yükle ve tüm değişkenleri ekle
        let mainTemplate = TemplateLoader.loadTemplate('solution-template.html', variables);
        
        // Ek şablonları ana şablona ekle
        return TemplateLoader.injectTemplates(mainTemplate, templates);
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
    
    /**
     * Eklenti URI'sini alır
     */
    private getExtensionUri(): vscode.Uri | undefined {
        try {
            // Aktif uzantıları kontrol et
            for (const ext of vscode.extensions.all) {
                if (ext.id.toLowerCase().includes('byte') || ext.id.toLowerCase().includes('tuncerbyte')) {
                    return ext.extensionUri;
                }
            }
            
            return undefined;
        } catch (error) {
            console.error('Eklenti URI bulunamadı:', error);
            return undefined;
        }
    }
} 