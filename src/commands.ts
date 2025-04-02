import * as vscode from 'vscode';
import { ChatPanel } from './chatPanel';
import { AIProvider, AIService } from './services/ai';
import * as fs from 'fs';
import * as path from 'path';

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
        
        // Seçili kodu açıklama komutuP
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
        
        // Yeni komutlar
        // Seçili kod için dokümantasyon oluşturma komutu
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.generateDocs', async () => {
                await this.generateDocumentation();
            })
        );
        
        // Seçili kodu optimizasyon komutu
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.optimizeCode', async () => {
                await this.optimizeSelectedCode();
            })
        );
        
        // Seçili kod için unit test oluşturma komutu
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.generateTests', async () => {
                await this.generateUnitTests();
            })
        );
        
        // Seçili kodu açıklama satırlarıyla zenginleştirme komutu
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.addComments', async () => {
                await this.addCommentsToCode();
            })
        );
        
        // Kod problemlerini bulma ve düzeltme önerileri sunma komutu
        context.subscriptions.push(
            vscode.commands.registerCommand('byte.findIssues', async () => {
                await this.findCodeIssues();
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
    
    /**
     * Seçili kod için dokümantasyon oluşturur
     */
    private async generateDocumentation(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Please select the code to generate documentation for.');
            return;
        }
        
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Please select the code to generate documentation for.');
            return;
        }
        
        const code = editor.document.getText(selection);
        if (!code.trim()) {
            vscode.window.showWarningMessage('The selected code appears to be empty.');
            return;
        }
        
        // Dokümantasyon oluşturma işlemi için ilerleme göster
        const progressOptions = {
            location: vscode.ProgressLocation.Notification,
            title: "Generating documentation...",
            cancellable: false
        };
        
        await vscode.window.withProgress(progressOptions, async (progress) => {
            try {
                progress.report({ message: "Sending request to AI model..." });
                
                // Dokümantasyon oluşturmak için özel prompt hazırla
                const prompt = `Please generate comprehensive documentation for the following code. Include:
                
1. Overview of what the code does
2. Function/method descriptions
3. Parameter explanations
4. Return value descriptions
5. Usage examples
6. Any edge cases or important notes

Code:
\`\`\`
${code}
\`\`\``;
                
                const documentation = await this.aiService.sendMessage(prompt);
                
                // Dokümantasyon formatları için seçenekler sun
                const docFormat = await vscode.window.showQuickPick(
                    [
                        { label: 'Markdown (.md)', description: 'Standard documentation format' },
                        { label: 'JSDoc/TSDoc Comments', description: 'Add directly to your code' },
                        { label: 'HTML', description: 'For web documentation' },
                        { label: 'Plain Text', description: 'Simple text format' }
                    ],
                    {
                        placeHolder: 'Select documentation format',
                        ignoreFocusOut: true
                    }
                );
                
                if (!docFormat) {
                    return;
                }
                
                let formattedDoc = documentation;
                let fileExt = '.md';
                let language = 'markdown';
                
                // Seçilen formata göre dokümantasyonu biçimlendir
                switch(docFormat.label) {
                    case 'JSDoc/TSDoc Comments':
                        formattedDoc = this.formatAsJSDoc(documentation);
                        fileExt = editor.document.languageId === 'typescript' ? '.ts' : '.js';
                        language = editor.document.languageId;
                        break;
                    case 'HTML':
                        formattedDoc = this.formatAsHTML(documentation);
                        fileExt = '.html';
                        language = 'html';
                        break;
                    case 'Plain Text':
                        formattedDoc = this.formatAsPlainText(documentation);
                        fileExt = '.txt';
                        language = 'plaintext';
                        break;
                }
                
                // Dokümantasyon dosyasını göster
                const doc = await vscode.workspace.openTextDocument({
                    content: formattedDoc,
                    language: language
                });
                
                await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
                
                // Dosyayı kaydetmek isteyip istemediğini sor
                const saveAction = await vscode.window.showInformationMessage(
                    'Do you want to save this documentation?',
                    'Save',
                    'Don\'t Save'
                );
                
                if (saveAction === 'Save') {
                    // Aktivitedeki dosyanın adını al ve ona uygun bir dokümantasyon ismi öner
                    const activeFileName = path.basename(editor.document.fileName, path.extname(editor.document.fileName));
                    const suggestedFileName = `${activeFileName}.docs${fileExt}`;
                    
                    const uri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file(path.join(path.dirname(editor.document.fileName), suggestedFileName)),
                        filters: {
                            'Documentation': [fileExt.replace('.', '')]
                        }
                    });
                    
                    if (uri) {
                        fs.writeFileSync(uri.fsPath, formattedDoc);
                        vscode.window.showInformationMessage(`Documentation saved to ${uri.fsPath}`);
                    }
                }
                
                progress.report({ message: "Completed", increment: 100 });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Documentation generation failed: ${error.message}`);
            }
        });
    }
    
    /**
     * Markdown formatındaki dokümantasyonu JSDoc formatına dönüştürür
     */
    private formatAsJSDoc(markdown: string): string {
        // Basit bir dönüşüm işlemi, gerçek uygulamada daha karmaşık olabilir
        let jsdoc = "/**\n";
        
        // Markdown satırlarını JSDoc'a dönüştür
        const lines = markdown.split('\n');
        for (const line of lines) {
            // Başlıkları tespit et
            if (line.startsWith('# ')) {
                jsdoc += ` * @module ${line.substring(2)}\n`;
            } else if (line.startsWith('## ')) {
                jsdoc += ` * @description ${line.substring(3)}\n`;
            } else if (line.startsWith('- ')) {
                jsdoc += ` * - ${line.substring(2)}\n`;
            } else {
                jsdoc += line ? ` * ${line}\n` : ` *\n`;
            }
        }
        
        jsdoc += " */\n\n";
        return jsdoc;
    }
    
    /**
     * Markdown formatındaki dokümantasyonu HTML formatına dönüştürür
     */
    private formatAsHTML(markdown: string): string {
        // Basit HTML dönüşümü
        let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Documentation</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0 auto; max-width: 800px; padding: 20px; }
        pre { background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 3px; padding: 10px; overflow: auto; }
        code { background-color: #f5f5f5; border-radius: 3px; padding: 2px 5px; font-family: monospace; }
        h1, h2, h3 { color: #333; }
        .container { border-left: 3px solid #2196F3; padding-left: 15px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
`;
        
        // Markdown'ı basit HTML'e dönüştür
        const lines = markdown.split('\n');
        for (const line of lines) {
            if (line.startsWith('# ')) {
                html += `        <h1>${line.substring(2)}</h1>\n`;
            } else if (line.startsWith('## ')) {
                html += `        <h2>${line.substring(3)}</h2>\n`;
            } else if (line.startsWith('### ')) {
                html += `        <h3>${line.substring(4)}</h3>\n`;
            } else if (line.startsWith('- ')) {
                html += `        <ul><li>${line.substring(2)}</li></ul>\n`;
            } else if (line.startsWith('```')) {
                if (html.endsWith('```\n')) {
                    html += '        </pre>\n';
                } else {
                    html += '        <pre><code>\n';
                }
            } else {
                html += line ? `        <p>${line}</p>\n` : '<br>\n';
            }
        }
        
        html += `    </div>
</body>
</html>`;
        
        return html;
    }
    
    /**
     * Markdown formatındaki dokümantasyonu düz metin formatına dönüştürür
     */
    private formatAsPlainText(markdown: string): string {
        // Markdown biçimlendirmelerini kaldır
        return markdown
            .replace(/#{1,6}\s/g, '') // Başlıkları kaldır
            .replace(/\*\*(.*?)\*\*/g, '$1') // Kalın yazıları kaldır
            .replace(/\*(.*?)\*/g, '$1') // İtalik yazıları kaldır
            .replace(/```[\s\S]*?```/g, (match) => { // Kod bloklarını düzenle
                return match.replace(/```[\w]*\n/, '').replace(/```/, '');
            })
            .replace(/- /g, '* '); // Liste öğelerini dönüştür
    }
    
    /**
     * Seçili kodu optimize eder
     */
    private async optimizeSelectedCode(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Please select code to optimize.');
            return;
        }
        
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Please select code to optimize.');
            return;
        }
        
        const code = editor.document.getText(selection);
        if (!code.trim()) {
            vscode.window.showWarningMessage('The selected code appears to be empty.');
            return;
        }
        
        // Optimizasyon seçenekleri için hızlı seçim göster
        const optimizationType = await vscode.window.showQuickPick(
            [
                { label: 'Performance Optimization', description: 'Improve code execution speed' },
                { label: 'Memory Usage Optimization', description: 'Reduce memory consumption' },
                { label: 'Code Size Reduction', description: 'Make code more concise' },
                { label: 'Readability Enhancement', description: 'Improve code clarity without changing functionality' }
            ],
            {
                placeHolder: 'Select optimization type',
                ignoreFocusOut: true
            }
        );
        
        if (!optimizationType) {
            return;
        }
        
        // Optimizasyon işlemi için ilerleme göster
        const progressOptions = {
            location: vscode.ProgressLocation.Notification,
            title: `Optimizing code for ${optimizationType.label}...`,
            cancellable: false
        };
        
        await vscode.window.withProgress(progressOptions, async (progress) => {
            try {
                progress.report({ message: "Sending request to AI model..." });
                
                // Optimizasyon için özel prompt hazırla
                const prompt = `Please optimize the following code for ${optimizationType.label.toLowerCase()}. 
Provide a clear explanation of the changes made and why they improve the code.

Original code:
\`\`\`
${code}
\`\`\`

Please return the optimized code along with a detailed explanation of the improvements.`;
                
                const optimizedResult = await this.aiService.sendMessage(prompt);
                
                // İki seçenek sun: 1) Mevcut kodu değiştir, 2) Yeni dosyada göster
                const action = await vscode.window.showInformationMessage(
                    'Code has been optimized. What would you like to do?',
                    'Replace Current Code',
                    'View in New Document',
                    'View Side by Side'
                );
                
                if (action === 'Replace Current Code') {
                    // Seçili kodu düzenlenmiş kod ile değiştir
                    await editor.edit(editBuilder => {
                        editBuilder.replace(selection, this.extractCodeFromResponse(optimizedResult));
                    });
                    
                    vscode.window.showInformationMessage('Code successfully updated with optimized version.');
                } else if (action === 'View in New Document') {
                    // Yeni dosyada göster
                    const doc = await vscode.workspace.openTextDocument({
                        content: optimizedResult,
                        language: editor.document.languageId
                    });
                    
                    await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
                } else if (action === 'View Side by Side') {
                    // Yeni dosyada sadece kodu göster
                    const optimizedCode = this.extractCodeFromResponse(optimizedResult);
                    const doc = await vscode.workspace.openTextDocument({
                        content: optimizedCode,
                        language: editor.document.languageId
                    });
                    
                    await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
                }
                
                progress.report({ message: "Completed", increment: 100 });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Code optimization failed: ${error.message}`);
            }
        });
    }
    
    /**
     * Seçili kod için unit test oluşturur
     */
    private async generateUnitTests(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Please select code to generate tests for.');
            return;
        }
        
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Please select code to generate tests for.');
            return;
        }
        
        const code = editor.document.getText(selection);
        if (!code.trim()) {
            vscode.window.showWarningMessage('The selected code appears to be empty.');
            return;
        }
        
        // Test framework seçimi için hızlı seçim göster
        const testFramework = await vscode.window.showQuickPick(
            [
                { label: 'Jest', description: 'Popular JavaScript testing framework' },
                { label: 'Mocha', description: 'Flexible JavaScript test framework' },
                { label: 'Jasmine', description: 'Behavior-driven development framework' },
                { label: 'AVA', description: 'Test runner for Node.js' },
                { label: 'Pytest', description: 'Python testing framework' },
                { label: 'JUnit', description: 'Java testing framework' },
                { label: 'Other', description: 'Specify another testing framework' }
            ],
            {
                placeHolder: 'Select test framework',
                ignoreFocusOut: true
            }
        );
        
        if (!testFramework) {
            return;
        }
        
        let framework = testFramework.label;
        
        if (framework === 'Other') {
            const customFramework = await vscode.window.showInputBox({
                prompt: 'Enter the name of the testing framework',
                ignoreFocusOut: true
            });
            
            if (!customFramework) {
                return;
            }
            
            framework = customFramework;
        }
        
        // Test oluşturma işlemi için ilerleme göster
        const progressOptions = {
            location: vscode.ProgressLocation.Notification,
            title: `Generating ${framework} tests...`,
            cancellable: false
        };
        
        await vscode.window.withProgress(progressOptions, async (progress) => {
            try {
                progress.report({ message: "Sending request to AI model..." });
                
                // Test oluşturmak için özel prompt hazırla
                const prompt = `Please generate comprehensive unit tests for the following code using the ${framework} testing framework.
Include a variety of test cases covering:
1. Happy path scenarios
2. Edge cases
3. Error handling
4. Input validation

Code to test:
\`\`\`
${code}
\`\`\`

Return well-structured tests with explanatory comments.`;
                
                const testCode = await this.aiService.sendMessage(prompt);
                
                // Dosya oluşturma seçenekleri
                const fileAction = await vscode.window.showInformationMessage(
                    'Test code has been generated. What would you like to do?',
                    'Open in New File',
                    'Save to Test File',
                    'Copy to Clipboard'
                );
                
                if (fileAction === 'Open in New File') {
                    // Yeni dosyada göster
                    const doc = await vscode.workspace.openTextDocument({
                        content: testCode,
                        language: this.getLanguageForFramework(framework, editor.document.languageId)
                    });
                    
                    await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
                } else if (fileAction === 'Save to Test File') {
                    // Activitedeki dosyanın adını al ve test dosya adı öner
                    const activeFileName = path.basename(editor.document.fileName, path.extname(editor.document.fileName));
                    let suggestedFileName = '';
                    
                    switch (framework.toLowerCase()) {
                        case 'jest':
                        case 'jasmine':
                            suggestedFileName = `${activeFileName}.test${path.extname(editor.document.fileName)}`;
                            break;
                        case 'mocha':
                            suggestedFileName = `${activeFileName}.spec${path.extname(editor.document.fileName)}`;
                            break;
                        case 'pytest':
                            suggestedFileName = `test_${activeFileName}${path.extname(editor.document.fileName)}`;
                            break;
                        case 'junit':
                            suggestedFileName = `${activeFileName}Test${path.extname(editor.document.fileName)}`;
                            break;
                        default:
                            suggestedFileName = `${activeFileName}.test${path.extname(editor.document.fileName)}`;
                    }
                    
                    const uri = await vscode.window.showSaveDialog({
                        defaultUri: vscode.Uri.file(path.join(path.dirname(editor.document.fileName), suggestedFileName)),
                        filters: {
                            'Test Files': [path.extname(editor.document.fileName).replace('.', '')]
                        }
                    });
                    
                    if (uri) {
                        // Dosyadaki kod bloklarını çıkar ve dosyaya kaydet
                        const testCodeContent = this.extractCodeFromResponse(testCode);
                        fs.writeFileSync(uri.fsPath, testCodeContent);
                        
                        // Dosyayı aç
                        const doc = await vscode.workspace.openTextDocument(uri);
                        await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
                        
                        vscode.window.showInformationMessage(`Test file saved to ${uri.fsPath}`);
                    }
                } else if (fileAction === 'Copy to Clipboard') {
                    // Panoya kopyala
                    const testCodeContent = this.extractCodeFromResponse(testCode);
                    vscode.env.clipboard.writeText(testCodeContent);
                    vscode.window.showInformationMessage('Test code copied to clipboard');
                }
                
                progress.report({ message: "Completed", increment: 100 });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Test generation failed: ${error.message}`);
            }
        });
    }
    
    /**
     * Test framework'ü için uygun dil tanımlayıcısını döndürür
     */
    private getLanguageForFramework(framework: string, defaultLanguage: string): string {
        switch (framework.toLowerCase()) {
            case 'jest':
            case 'mocha':
            case 'jasmine':
            case 'ava':
                return defaultLanguage === 'typescript' ? 'typescript' : 'javascript';
            case 'pytest':
                return 'python';
            case 'junit':
                return 'java';
            default:
                return defaultLanguage;
        }
    }
    
    /**
     * Seçili koda açıklama satırları ekler
     */
    private async addCommentsToCode(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Please select code to add comments to.');
            return;
        }
        
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Please select code to add comments to.');
            return;
        }
        
        const code = editor.document.getText(selection);
        if (!code.trim()) {
            vscode.window.showWarningMessage('The selected code appears to be empty.');
            return;
        }
        
        // Yorum stili seçimi için hızlı seçim göster
        const commentStyle = await vscode.window.showQuickPick(
            [
                { label: 'Comprehensive', description: 'Detailed explanations for each code block' },
                { label: 'Concise', description: 'Brief comments for key sections only' },
                { label: 'Documentation Style', description: 'JSDoc/TSDoc style documentation comments' }
            ],
            {
                placeHolder: 'Select comment style',
                ignoreFocusOut: true
            }
        );
        
        if (!commentStyle) {
            return;
        }
        
        // Yorum ekleme işlemi için ilerleme göster
        const progressOptions = {
            location: vscode.ProgressLocation.Notification,
            title: "Adding comments to code...",
            cancellable: false
        };
        
        await vscode.window.withProgress(progressOptions, async (progress) => {
            try {
                progress.report({ message: "Sending request to AI model..." });
                
                // Yorum eklemek için özel prompt hazırla
                const prompt = `Please add ${commentStyle.label.toLowerCase()} comments to the following code. 
${commentStyle.label === 'Documentation Style' ? 'Use JSDoc/TSDoc style comments for functions, classes, and methods.' : ''}
${commentStyle.label === 'Comprehensive' ? 'Explain the purpose and functionality of each significant section.' : ''}
${commentStyle.label === 'Concise' ? 'Add minimal comments only for complex or non-obvious parts.' : ''}

Code:
\`\`\`
${code}
\`\`\`

Return the same code with appropriate comments added.`;
                
                const commentedCode = await this.aiService.sendMessage(prompt);
                
                // İki seçenek sun: 1) Mevcut kodu değiştir, 2) Yeni dosyada göster
                const action = await vscode.window.showInformationMessage(
                    'Comments have been added to the code. What would you like to do?',
                    'Replace Current Code',
                    'View in New Document'
                );
                
                if (action === 'Replace Current Code') {
                    // Seçili kodu yorumlu kod ile değiştir
                    await editor.edit(editBuilder => {
                        editBuilder.replace(selection, this.extractCodeFromResponse(commentedCode));
                    });
                    
                    vscode.window.showInformationMessage('Code successfully updated with comments.');
                } else if (action === 'View in New Document') {
                    // Yeni dosyada göster
                    const doc = await vscode.workspace.openTextDocument({
                        content: this.extractCodeFromResponse(commentedCode),
                        language: editor.document.languageId
                    });
                    
                    await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
                }
                
                progress.report({ message: "Completed", increment: 100 });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Adding comments failed: ${error.message}`);
            }
        });
    }
    
    /**
     * Seçili koddaki potansiyel problemleri bulur ve çözüm önerileri sunar
     */
    private async findCodeIssues(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('Please select code to analyze for issues.');
            return;
        }
        
        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showWarningMessage('Please select code to analyze for issues.');
            return;
        }
        
        const code = editor.document.getText(selection);
        if (!code.trim()) {
            vscode.window.showWarningMessage('The selected code appears to be empty.');
            return;
        }
        
        // İssue türleri seçimi için hızlı seçim göster
        const issueTypes = await vscode.window.showQuickPick(
            [
                { label: 'All Issues', description: 'Find all types of problems in the code' },
                { label: 'Performance Issues', description: 'Focus on performance bottlenecks' },
                { label: 'Security Vulnerabilities', description: 'Check for security problems' },
                { label: 'Code Smells', description: 'Identify design problems and anti-patterns' },
                { label: 'Bugs and Logic Errors', description: 'Find potential bugs and logic issues' }
            ],
            {
                placeHolder: 'Select issues to look for',
                ignoreFocusOut: true
            }
        );
        
        if (!issueTypes) {
            return;
        }
        
        // Problem bulma işlemi için ilerleme göster
        const progressOptions = {
            location: vscode.ProgressLocation.Notification,
            title: `Analyzing code for ${issueTypes.label.toLowerCase()}...`,
            cancellable: false
        };
        
        await vscode.window.withProgress(progressOptions, async (progress) => {
            try {
                progress.report({ message: "Sending request to AI model..." });
                
                // Problem bulmak için özel prompt hazırla
                const prompt = `Please analyze this code for ${issueTypes.label.toLowerCase()} and provide detailed feedback.
For each issue you find:
1. Clearly identify the location and nature of the problem
2. Explain why it's an issue
3. Provide a specific solution or code fix
4. Rate the severity (Critical, Major, Minor)

Code to analyze:
\`\`\`
${code}
\`\`\`

Return a comprehensive analysis with code examples of how to fix the issues.`;
                
                const analysis = await this.aiService.sendMessage(prompt);
                
                // Analiz sonuçlarını göster
                const doc = await vscode.workspace.openTextDocument({
                    content: analysis,
                    language: 'markdown'
                });
                
                await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Beside });
                
                // Hataları düzeltme seçeneği sun
                const fixAction = await vscode.window.showInformationMessage(
                    'Would you like to fix the issues automatically?',
                    'Fix Issues',
                    'Fix Individual Issues',
                    'Skip'
                );
                
                if (fixAction === 'Fix Issues') {
                    // Tüm sorunları düzeltme isteği gönder
                    progress.report({ message: "Generating fixed version..." });
                    
                    const fixPrompt = `Given the issues identified in the previous analysis, please provide a fixed version of the code with all issues resolved.
Original code:
\`\`\`
${code}
\`\`\`

Please return only the fixed code without explanations.`;
                    
                    const fixedCode = await this.aiService.sendMessage(fixPrompt);
                    
                    // Düzeltilmiş kodu göster
                    await editor.edit(editBuilder => {
                        editBuilder.replace(selection, this.extractCodeFromResponse(fixedCode));
                    });
                    
                    vscode.window.showInformationMessage('Code has been updated with fixes.');
                } else if (fixAction === 'Fix Individual Issues') {
                    // TODO: Bireysel hataların düzeltilmesi için arayüz oluştur
                    vscode.window.showInformationMessage('Individual issue fixing is not implemented yet.');
                }
                
                progress.report({ message: "Completed", increment: 100 });
            } catch (error: any) {
                vscode.window.showErrorMessage(`Code analysis failed: ${error.message}`);
            }
        });
    }
}