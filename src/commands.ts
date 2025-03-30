import * as vscode from 'vscode';
import { ChatPanel } from './chatPanel';
import { AIProvider, AIService } from './aiService';

/**
 * Eklenti komutlarını yöneten sınıf
 */
export class CommandManager {
    constructor(
        private chatPanel: ChatPanel,
        private aiService: AIService
    ) {}
    
    /**
     * Tüm komutları kaydeder
     */
    public registerCommands(context: vscode.ExtensionContext): void {
        // Sohbet panelini açma komutu
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.openChat', () => {
                vscode.commands.executeCommand('workbench.view.extension.ai-assistant');
            })
        );
        
        // Seçili kodu açıklama komutu
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.explainCode', async () => {
                await this.explainSelectedCode();
            })
        );
        
        // Seçili kodu iyileştirme komutu
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.refactorCode', async () => {
                await this.refactorSelectedCode();
            })
        );
        
        // AI servisini yapılandırma komutu
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.configureAI', async () => {
                await this.configureAI();
            })
        );
    }
    
    /**
     * Seçili kodu açıklar
     */
    private async explainSelectedCode(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Lütfen açıklamak istediğiniz kodu seçin.');
            return;
        }
        
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Lütfen açıklamak istediğiniz kodu seçin.');
            return;
        }
        
        const code = editor.document.getText(selection);
        if (!code.trim()) {
            vscode.window.showWarningMessage('Seçili kod boş görünüyor.');
            return;
        }
        
        // Analiz panelini göstererek ilerleme durumunu bildir
        const progressOptions = {
            location: vscode.ProgressLocation.Notification,
            title: "Kod analiz ediliyor...",
            cancellable: false
        };
        
        // AI servisine kodu gönder ve açıklama al
        await vscode.window.withProgress(progressOptions, async (progress) => {
            try {
                progress.report({ message: "Yapay zeka modeline istek gönderiliyor..." });
                
                const explanation = await this.aiService.explainCode(code);
                
                // Açıklama paneli açarak sonucu göster
                const doc = await vscode.workspace.openTextDocument({
                    content: explanation,
                    language: 'markdown'
                });
                
                await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
                
                progress.report({ message: "Tamamlandı", increment: 100 });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Kod analizi başarısız: ${error.message}`);
            }
        });
    }
    
    /**
     * Seçili kodu yeniden yapılandırır
     */
    private async refactorSelectedCode(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Lütfen yeniden düzenlemek istediğiniz kodu seçin.');
            return;
        }
        
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Lütfen yeniden düzenlemek istediğiniz kodu seçin.');
            return;
        }
        
        const code = editor.document.getText(selection);
        if (!code.trim()) {
            vscode.window.showWarningMessage('Seçili kod boş görünüyor.');
            return;
        }
        
        // Yeniden yapılandırma işlemi için ilerleme göster
        const progressOptions = {
            location: vscode.ProgressLocation.Notification,
            title: "Kod yeniden düzenleniyor...",
            cancellable: false
        };
        
        // AI servisine kodu gönder ve refactor et
        await vscode.window.withProgress(progressOptions, async (progress) => {
            try {
                progress.report({ message: "Yapay zeka modeline istek gönderiliyor..." });
                
                const refactoredCode = await this.aiService.refactorCode(code);
                
                // İki seçenek sun: 1) Mevcut kodu değiştir, 2) Yeni dosyada göster
                const action = await vscode.window.showInformationMessage(
                    'Kod yeniden düzenlendi. Ne yapmak istersiniz?',
                    'Mevcut Kodu Değiştir',
                    'Yeni Dosyada Göster'
                );
                
                if (action === 'Mevcut Kodu Değiştir') {
                    // Seçili kodu düzenlenmiş kod ile değiştir
                    await editor.edit(editBuilder => {
                        editBuilder.replace(selection, this.extractCodeFromResponse(refactoredCode));
                    });
                    
                    vscode.window.showInformationMessage('Kod başarıyla güncellendi.');
                } else if (action === 'Yeni Dosyada Göster') {
                    // Yeni dosyada göster
                    const doc = await vscode.workspace.openTextDocument({
                        content: refactoredCode,
                        language: editor.document.languageId
                    });
                    
                    await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
                }
                
                progress.report({ message: "Tamamlandı", increment: 100 });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Kod yeniden düzenleme başarısız: ${error.message}`);
            }
        });
    }
    
    /**
     * AI yanıtından kod bloğu çıkarma yardımcı fonksiyonu
     */
    private extractCodeFromResponse(response: string): string {
        // Eğer yanıt bir Markdown kod bloğu içeriyorsa sadece kod kısmını çıkar
        const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
        const matches = [...response.matchAll(codeBlockRegex)];
        
        if (matches.length > 0) {
            // İlk kod bloğunu al
            return matches[0][1].trim();
        }
        
        // Kod bloğu yoksa tüm yanıtı döndür
        return response;
    }
    
    /**
     * AI servisini yapılandırır
     */
    private async configureAI(): Promise<void> {
        // AI sağlayıcı seçimi için Quick Pick
        const provider = await vscode.window.showQuickPick(
            [
                { label: 'OpenAI', description: 'GPT modelleri ile güçlü AI yanıtları' },
                { label: 'Google Gemini', description: 'Google\'ın Gemini AI modelleri' },
                { label: 'Yerel Model', description: 'Kendi sunucunuzda çalışan özel AI modeli' }
            ],
            {
                placeHolder: 'AI sağlayıcısını seçin',
                ignoreFocusOut: true
            }
        );
        
        if (!provider) {
            return;
        }
        
        // Seçilen sağlayıcıya göre yapılandırma penceresi göster
        switch (provider.label) {
            case 'OpenAI':
                const openaiKey = await vscode.window.showInputBox({
                    prompt: 'OpenAI API anahtarınızı girin',
                    password: true,
                    ignoreFocusOut: true,
                    placeHolder: 'sk-...'
                });
                
                if (openaiKey) {
                    await this.aiService.setOpenAIApiKey(openaiKey);
                        this.aiService.setProvider(AIProvider.OpenAI);
                    vscode.window.showInformationMessage('OpenAI yapılandırması tamamlandı.');
                }
                break;
                
            case 'Google Gemini':
                const geminiKey = await vscode.window.showInputBox({
                    prompt: 'Google Gemini API anahtarınızı girin',
                    password: true,
                    ignoreFocusOut: true
                });
                
                if (geminiKey) {
                    await this.aiService.setGeminiApiKey(geminiKey);
                    this.aiService.setProvider(AIProvider.Gemini);
                    vscode.window.showInformationMessage('Google Gemini yapılandırması tamamlandı.');
                }
                break;
                
            case 'Yerel Model':
                const localEndpoint = await vscode.window.showInputBox({
                    prompt: 'Yerel AI servis endpoint URL\'inizi girin',
                    value: vscode.workspace.getConfiguration('byte').get<string>('local.endpoint') || 'http://localhost:8000/v1/completions',
                    ignoreFocusOut: true
                });
                
                if (localEndpoint) {
                    await vscode.workspace.getConfiguration('byte').update('local.endpoint', localEndpoint, vscode.ConfigurationTarget.Global);
                    this.aiService.setProvider(AIProvider.Local);
                    vscode.window.showInformationMessage('Yerel model yapılandırması tamamlandı.');
                }
                break;
        }
    }
} 