import * as vscode from 'vscode';
import { ChatPanel } from './chatPanel';
import { AIProvider, AIService } from './aiService';
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
                const prompt = `Analyze this code and create comprehensive documentation. The documentation should include:

1. An introduction explaining the general purpose and function of the code
2. For each function/method/class:
   - Its purpose and functionality
   - Complete description of parameters (type, format, required status)
   - Return value and format
   - Step-by-step explanations of important algorithms
   - Special cases, limitations, and points to note
3. Dependencies and relationships
4. Possible error situations and how they are handled
5. At least 2-3 example usage scenarios (simple and advanced examples)
6. Performance information (if applicable)

The documentation should be understandable for both end users and developers. Return it in Markdown format using appropriate heading levels.

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
                
                // Optimizasyon için prompt hazırla
                let optimizationPrompt = `Optimize the following code for ${optimizationType.label.toLowerCase()}. During optimization:

1. Fully preserve the existing functionality - the algorithm's behavior should not change
2. Improve the code's ${optimizationType.label === 'Performance Optimization' ? 'execution speed and resource efficiency' : 
    optimizationType.label === 'Memory Usage Optimization' ? 'memory usage and memory management' : 
    optimizationType.label === 'Code Size Reduction' ? 'code size and complexity' : 
    'readability and maintainability'}
3. Explain the purpose and impact of each change you make
4. If possible, express the impact of the improvement in measurable terms`;

                // Optimizasyon türüne göre özel talimatlar ekle
                if (optimizationType.label === 'Performance Optimization') {
                    optimizationPrompt += `
For performance optimization, pay special attention to:
- Reducing time complexity (O(n²) -> O(n log n) or better)
- Eliminating unnecessary calculations
- Optimizing or consolidating loops where possible
- Using more efficient data structures
- Finding opportunities for asynchronous operations, parallel processing, or lazy evaluation
- Implementing caching strategies where possible
- Considering micro-optimizations in critical paths`;
                } else if (optimizationType.label === 'Memory Usage Optimization') {
                    optimizationPrompt += `
For memory optimization, pay special attention to:
- Detecting and eliminating memory leaks
- Optimizing large data structures
- Avoiding unnecessary copies
- Implementing memory pooling or sharing techniques
- Evaluating opportunities for passing by reference instead of by value
- Implementing early memory release
- Eliminating unnecessary intermediate variables`;
                } else if (optimizationType.label === 'Code Size Reduction') {
                    optimizationPrompt += `
For code size optimization, pay special attention to:
- Eliminating code duplication, applying the DRY (Don't Repeat Yourself) principle
- Extracting common functionality into helper functions
- Using more concise and shorter coding techniques
- Eliminating unnecessary conditions and branches
- Identifying and cleaning up dead code
- Creating smaller, focused functions
- Reducing excessive comments and unnecessary documentation`;
                } else { // Readability Enhancement
                    optimizationPrompt += `
For readability optimization, pay special attention to:
- Making variable and function names meaningful and consistent
- Breaking complex logic into smaller, understandable functions
- Making the code flow more linear and traceable
- Using modern language features to make the code more clear
- Adding comments strategically, explaining not just "what" but "why"
- Simplifying nested conditions and using guard clauses
- Improving overall code organization and formatting`;
                }

                optimizationPrompt += `

Code to optimize:
\`\`\`
${code}
\`\`\`

Return the optimized code and then explain the changes made, the optimization strategy, and the expected benefits.`;
                
                const optimizedResult = await this.aiService.sendMessage(optimizationPrompt);
                
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
                const prompt = `Create comprehensive ${framework} unit tests for the following code. The tests should meet these criteria:

1. Include test scenarios for each function and every important logic flow
2. Test coverage should include:
   - Main functionality tests (happy path)
   - Boundary values
   - Empty/null/undefined values
   - Invalid input validation
   - Error handling cases
   - Edge cases
3. Each test should have a clear description and purpose
4. Tests should include mocking/stubbing to replace dependencies (if any)
5. Test setup and teardown procedures should be properly implemented
6. Follow the recommended best practices for the ${framework} framework
7. The tests themselves should be understandable and maintainable

Code to test:
\`\`\`
${code}
\`\`\`

Return well-structured tests with explanatory comments, ready to run.`;
                
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
                const prompt = `Add ${commentStyle.label.toLowerCase()} style explanatory comments to the following code.

The added comments should have these characteristics:
${commentStyle.label === 'Documentation Style' ? `
- Fully adhere to JSDoc/TSDoc standards
- Include complete documentation comments for every function, class, and method
- Document all parameters, return values, and possible errors
- Use appropriate tags such as @param, @returns, @throws
- Include additional explanations for complex logic` : ''}
${commentStyle.label === 'Comprehensive' ? `
- Include detailed explanations for each logical section
- Explain complex algorithms step by step
- Indicate the purpose and usage of variables
- Focus on the "why" question - explain why the code is written this way
- Include notes that will help future development` : ''}
${commentStyle.label === 'Concise' ? `
- Add short and concise comments only to complex or non-obvious sections
- Keep comments minimal enough not to affect code readability
- Use only where necessary
- Each comment should be a single sentence or short paragraph
- Avoid excessive documentation` : ''}

Code:
\`\`\`
${code}
\`\`\`

Return the same code with appropriate comments added. Don't make any other changes, just add suitable comments.`;
                
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
                const prompt = `Analyze the following code in detail for ${issueTypes.label.toLowerCase()}. For each issue you find:

1. Specify the exact location and line range of the issue
2. Classify the type of issue (Performance, Security, Maintenance, Design, etc.)
3. Indicate the severity of the issue (Critical, High, Medium, Low)
4. Technically explain why it's a problem
5. Provide solution suggestions - both quick fix and long-term solution
6. If possible, include an improved code example

${issueTypes.label === 'Performance Issues' ? `Focus specifically on these performance issues:
- O(n²) or worse time complexity
- Unnecessary loops or calculations
- Memory leaks
- Inefficient data structures
- Blocked operations
- Opportunities for asynchronous processing` : ''}

${issueTypes.label === 'Security Vulnerabilities' ? `Focus specifically on these security vulnerabilities:
- Injection (SQL, XSS, command, etc.)
- Authentication or authorization weaknesses
- Sensitive data exposure
- Insecure deserialization
- Use of untrusted input without validation
- Weak encryption implementations
- Missing access control` : ''}

${issueTypes.label === 'Code Smells' ? `Focus specifically on these code smells:
- Code duplication (DRY violations)
- Excessively long functions or classes
- Overly complex conditional expressions
- Dead code or unused variables
- Magic numbers or strings
- Inadequate naming
- Violations of SOLID principles` : ''}

${issueTypes.label === 'Bugs and Logic Errors' ? `Focus specifically on these errors:
- Logic errors
- Null/undefined references
- Out-of-bounds access
- Deadlock or race condition potential
- Flawed condition checks
- Validation deficiencies
- Edge cases` : ''}

Code to analyze:
\`\`\`
${code}
\`\`\`

Structure your response in Markdown format and detail each issue under headings. Provide clear and actionable solutions for each issue.`;
                
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
                    
                    const fixPrompt = `Create an improved version of the code by fixing the issues identified in the previous analysis. When fixing, ensure that:

1. All identified bugs, security vulnerabilities, and code smells are resolved
2. Code readability and maintainability are improved
3. Performance improvements are implemented
4. Modern coding practices are used
5. Overall code quality is enhanced
6. Code functionality is preserved - same API and behavior should remain
7. Each change targets the issue without substantially changing the existing code

Original code:
\`\`\`
${code}
\`\`\`

Please return only the fixed code without explanations. You may leave brief comments in the code for important points.`;
                    
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