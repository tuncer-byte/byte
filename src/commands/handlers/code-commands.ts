import * as vscode from 'vscode';
import { AIService } from '../../services/ai';
import { CodeCommandOptions, CodeCommandParams, CodeCommandResult, CommandHandler } from '../types';
import { getSelectedCode, withProgressNotification } from '../utils/common';

/**
 * Kod açıklama komutu işleyicisi
 */
export class ExplainCodeHandler implements CommandHandler {
    constructor(private aiService: AIService) {}
    
    async execute(): Promise<void> {
        const codeParams = await getSelectedCode();
        if (!codeParams) {
            return;
        }
        
        await withProgressNotification("Kod analiz ediliyor...", async (progress) => {
            try {
                progress.report({ message: "Yapay zeka modeline istek gönderiliyor..." });
                
                const explanation = await this.aiService.explainCode(codeParams.code);
                
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
}

/**
 * Kod iyileştirme komutu işleyicisi
 */
export class RefactorCodeHandler implements CommandHandler {
    constructor(private aiService: AIService) {}
    
    async execute(): Promise<void> {
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
        await withProgressNotification("Kod yeniden düzenleniyor...", async (progress) => {
            try {
                progress.report({ message: "Yapay zeka modeline istek gönderiliyor..." });
                
                const refactoredCode = await this.aiService.refactorCode(code);
                
                // İki seçenek sun: 1) Mevcut kodu değiştir, 2) Yeni dosyada göster
                const result: CodeCommandResult = {
                    success: true,
                    content: refactoredCode
                };
                
                // Kullanıcı seçeneklerini göster
                await this.handleResult(result, editor, selection);
                
                progress.report({ message: "Tamamlandı", increment: 100 });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Kod yeniden düzenleme başarısız: ${error.message}`);
            }
        });
    }
    
    private async handleResult(
        result: CodeCommandResult, 
        editor: vscode.TextEditor, 
        selection: vscode.Selection
    ): Promise<void> {
        if (!result.success || !result.content) {
            vscode.window.showErrorMessage(result.error || 'İşlem sırasında bir hata oluştu.');
            return;
        }

        // Kullanıcıya sonucu ne yapacağını sor
        const action = await vscode.window.showInformationMessage(
            'Kod yeniden düzenlendi. Ne yapmak istersiniz?',
            'Mevcut Kodu Değiştir',
            'Yeni Dosyada Göster'
        );
        
        if (action === 'Mevcut Kodu Değiştir') {
            // Seçili kodu düzenlenmiş kod ile değiştir
            const cleanedCode = this.extractCodeFromResponse(result.content);
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, cleanedCode);
            });
            
            vscode.window.showInformationMessage('Kod başarıyla güncellendi.');
        } else if (action === 'Yeni Dosyada Göster') {
            // Yeni dosyada göster
            const doc = await vscode.workspace.openTextDocument({
                content: result.content,
                language: editor.document.languageId
            });
            
            await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
        }
    }
    
    /**
     * Yanıttan kod parçasını çıkarır
     */
    private extractCodeFromResponse(response: string): string {
        // Markdown kod blokları içindeki kodu çıkarma
        const codeBlockRegex = /```(?:\w+)?\s*\n([\s\S]*?)\n```/g;
        const matches = [...response.matchAll(codeBlockRegex)];
        
        if (matches.length > 0) {
            // İlk kod bloğunu alıyoruz
            return matches[0][1].trim();
        }
        
        // Kod bloğu bulunamadıysa, yanıtın kendisini döndür
        return response.trim();
    }
}

/**
 * Dokümantasyon oluşturma işleyicisi
 */
export class GenerateDocsHandler implements CommandHandler {
    constructor(private aiService: AIService) {}
    
    async execute(): Promise<void> {
        const codeParams = await getSelectedCode();
        if (!codeParams) {
            return;
        }
        
        await withProgressNotification("Dokümantasyon oluşturuluyor...", async (progress) => {
            try {
                progress.report({ message: "Yapay zeka modeline istek gönderiliyor..." });
                
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
${codeParams.code}
\`\`\``;
                
                // Dokümantasyon oluşturma isteğini gönderin
                const documentation = await this.aiService.sendMessage(docPrompt);
                
                // Açıklama paneli açarak sonucu göster
                const doc = await vscode.workspace.openTextDocument({
                    content: documentation,
                    language: 'markdown'
                });
                
                await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
                
                progress.report({ message: "Tamamlandı", increment: 100 });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Dokümantasyon oluşturulamadı: ${error.message}`);
            }
        });
    }
} 