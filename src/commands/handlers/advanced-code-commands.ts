import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { AIService } from '../../services/ai';
import { CodeCommandResult, CommandHandler } from '../types';
import { getSelectedCode, withProgressNotification } from '../utils/common';

/**
 * Kod optimizasyon işleyicisi
 */
export class OptimizeCodeHandler implements CommandHandler {
    constructor(private aiService: AIService) {}
    
    async execute(): Promise<void> {
        const codeParams = await getSelectedCode();
        if (!codeParams) {
            return;
        }
        
        // Optimize türü seçimi için Quick Pick
        const optimizeType = await vscode.window.showQuickPick(
            [
                { label: 'Performance', description: 'Kodon çalışma hızını iyileştir' },
                { label: 'Memory', description: 'Hafıza kullanımını optimize et' },
                { label: 'Size', description: 'Kod boyutunu küçült' },
                { label: 'Readability', description: 'Kodun okunabilirliğini artır' }
            ],
            {
                placeHolder: 'Optimizasyon türünü seçin',
                ignoreFocusOut: true
            }
        );
        
        if (!optimizeType) {
            return;
        }
        
        await withProgressNotification("Kod optimize ediliyor...", async (progress) => {
            try {
                progress.report({ message: "Yapay zeka modeline istek gönderiliyor..." });
                
                // Optimizasyon türüne göre prompt hazırla
                let optimizePrompt = '';
                
                switch (optimizeType.label.toLowerCase()) {
                    case 'performance':
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
${codeParams.code}
\`\`\`

Please return the optimized code along with a detailed explanation of the improvements.`;
                
                const optimizedResult = await this.aiService.sendMessage(prompt);
                
                // Açıklama paneli açarak sonucu göster
                const doc = await vscode.workspace.openTextDocument({
                    content: optimizedResult,
                    language: 'markdown'
                });
                
                await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
                
                progress.report({ message: "Tamamlandı", increment: 100 });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Kod optimizasyonu başarısız: ${error.message}`);
            }
        });
    }
}

/**
 * Kod yorumlama işleyicisi
 */
export class AddCommentsHandler implements CommandHandler {
    constructor(private aiService: AIService) {}
    
    async execute(): Promise<void> {
        const codeParams = await getSelectedCode();
        if (!codeParams) {
            return;
        }
        
        // Yorum stili seçimi için Quick Pick
        const commentStyle = await vscode.window.showQuickPick(
            [
                { label: 'Comprehensive', description: 'Detaylı açıklamalar' },
                { label: 'Concise', description: 'Kısa ve öz yorumlar' },
                { label: 'Documentation', description: 'JSDoc/TSDoc tarzı dokümantasyon' }
            ],
            {
                placeHolder: 'Yorum stilini seçin',
                ignoreFocusOut: true
            }
        );
        
        if (!commentStyle) {
            return;
        }
        
        await withProgressNotification("Kodlara açıklama ekleniyor...", async (progress) => {
            try {
                progress.report({ message: "Yapay zeka modeline istek gönderiliyor..." });
                
                // Yorum stiline göre prompt oluştur
                let commentPrompt = '';
                
                switch (commentStyle.label.toLowerCase()) {
                    case 'concise':
                        commentPrompt = 'concise comments (brief comments for key sections only)';
                        break;
                    case 'documentation':
                        commentPrompt = 'documentation style comments (JSDoc/TSDoc style documentation)';
                        break;
                    default:
                        commentPrompt = 'comprehensive comments (detailed explanations for each code block)';
                }
                
                // Prompt hazırlama
                const prompt = `Please add ${commentPrompt} to the following code. 
Return the same code with appropriate comments added.

Code:
\`\`\`
${codeParams.code}
\`\`\``;
                
                const commentedCode = await this.aiService.sendMessage(prompt);
                
                // Seçenekler sun
                const editor = vscode.window.activeTextEditor!;
                const selection = editor.selection;
                
                const result: CodeCommandResult = {
                    success: true,
                    content: commentedCode
                };
                
                // Kullanıcı seçeneklerini göster
                const action = await vscode.window.showInformationMessage(
                    'Kod yorumları eklendi. Ne yapmak istersiniz?',
                    'Mevcut Kodu Değiştir',
                    'Yeni Dosyada Göster'
                );
                
                if (action === 'Mevcut Kodu Değiştir') {
                    // Seçili kodu düzenlenmiş kod ile değiştir
                    const cleanedCode = this.extractCodeFromResponse(commentedCode);
                    await editor.edit(editBuilder => {
                        editBuilder.replace(selection, cleanedCode);
                    });
                    
                    vscode.window.showInformationMessage('Kod başarıyla güncellendi.');
                } else if (action === 'Yeni Dosyada Göster') {
                    // Yeni dosyada göster
                    const doc = await vscode.workspace.openTextDocument({
                        content: commentedCode,
                        language: editor.document.languageId
                    });
                    
                    await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
                }
                
                progress.report({ message: "Tamamlandı", increment: 100 });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Açıklama ekleme başarısız: ${error.message}`);
            }
        });
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
 * Kod sorun tespit işleyicisi
 */
export class FindIssuesHandler implements CommandHandler {
    constructor(private aiService: AIService) {}
    
    async execute(): Promise<void> {
        const codeParams = await getSelectedCode();
        if (!codeParams) {
            return;
        }
        
        // Sorun türü seçimi için Quick Pick
        const issueType = await vscode.window.showQuickPick(
            [
                { label: 'All', description: 'Tüm sorun tiplerini tespit et' },
                { label: 'Performance', description: 'Performans sorunları' },
                { label: 'Security', description: 'Güvenlik açıkları' },
                { label: 'Code Smells', description: 'Kötü kod kalıpları' },
                { label: 'Bugs', description: 'Mantık hataları ve olası hatalar' }
            ],
            {
                placeHolder: 'Sorun türünü seçin',
                ignoreFocusOut: true
            }
        );
        
        if (!issueType) {
            return;
        }
        
        await withProgressNotification("Kod sorunları tespit ediliyor...", async (progress) => {
            try {
                progress.report({ message: "Yapay zeka modeline istek gönderiliyor..." });
                
                // Sorun türüne göre prompt oluştur
                let issuePrompt = '';
                
                switch (issueType.label.toLowerCase()) {
                    case 'performance':
                        issuePrompt = 'performance issues (focus on performance bottlenecks)';
                        break;
                    case 'security':
                        issuePrompt = 'security vulnerabilities (check for security problems)';
                        break;
                    case 'code smells':
                        issuePrompt = 'code smells (identify design problems and anti-patterns)';
                        break;
                    case 'bugs':
                        issuePrompt = 'bugs and logic errors (find potential bugs and logic issues)';
                        break;
                    default:
                        issuePrompt = 'all issues (find all types of problems in the code)';
                }
                
                // Prompt hazırlama
                const prompt = `Please analyze this code for ${issuePrompt} and provide detailed feedback.
For each issue you find:
1. Clearly identify the location and nature of the problem
2. Explain why it's an issue
3. Provide a specific solution or code fix
4. Rate the severity (Critical, Major, Minor)

Code to analyze:
\`\`\`
${codeParams.code}
\`\`\`

Return a comprehensive analysis with code examples of how to fix the issues.`;
                
                const analysis = await this.aiService.sendMessage(prompt);
                
                // Açıklama paneli açarak sonucu göster
                const doc = await vscode.workspace.openTextDocument({
                    content: analysis,
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
 * Unit test oluşturma işleyicisi
 */
export class GenerateTestsHandler implements CommandHandler {
    constructor(private aiService: AIService) {}
    
    async execute(): Promise<void> {
        const codeParams = await getSelectedCode();
        if (!codeParams) {
            return;
        }
        
        // Dil ID'sine göre test framework belirle
        const defaultFramework = this.detectFramework(codeParams.languageId);
        
        // Test framework seçimi için sorma (opsiyonel)
        const promptText = `Test framework seçin (otomatik tespit: ${defaultFramework})`;
        const framework = await vscode.window.showInputBox({
            prompt: promptText,
            placeHolder: defaultFramework
        });
        
        const finalFramework = framework || defaultFramework;
        
        await withProgressNotification("Unit testler oluşturuluyor...", async (progress) => {
            try {
                progress.report({ message: "Yapay zeka modeline istek gönderiliyor..." });
                
                // Prompt hazırlama
                const prompt = `Please generate comprehensive unit tests for the following code using the ${finalFramework} testing framework.
Include a variety of test cases covering:
1. Happy path scenarios
2. Edge cases
3. Error handling
4. Input validation

Code to test:
\`\`\`
${codeParams.code}
\`\`\`

Return well-structured tests with explanatory comments.`;
                
                const testCode = await this.aiService.sendMessage(prompt);
                
                // Açıklama paneli açarak sonucu göster
                const doc = await vscode.workspace.openTextDocument({
                    content: testCode,
                    language: codeParams.languageId
                });
                
                await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
                
                progress.report({ message: "Tamamlandı", increment: 100 });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Test oluşturma başarısız: ${error.message}`);
            }
        });
    }
    
    /**
     * Dil ID'sine göre test framework belirler
     */
    private detectFramework(languageId: string): string {
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
} 