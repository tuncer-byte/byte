import * as vscode from 'vscode';
import { AIService } from '../../../services/ai';
import { SlashCommandHandler } from '../types';
import { detectTestFramework } from '../utils/helpers';

/**
 * /explain komutunu işleyen handler
 */
export const explainCommandHandler: SlashCommandHandler = async (
    command, parts, selectedText, aiService, view
) => {
    // WebView'e kullanıcı mesajını ekle
    if (view) {
        view.webview.postMessage({
            type: 'userMessage',
            content: command
        });
        
        // Yükleniyor göstergesini aç
        view.webview.postMessage({
            type: 'loadingStart'
        });
    }
    
    // Eğer kullanıcı komutla birlikte ek açıklama yazdıysa
    const extraInstruction = command.substring(parts[0].length).trim();
    
    // Açıklama isteğini oluştur
    let prompt = '';
    if (extraInstruction) {
        prompt = `Lütfen aşağıdaki kodu açıkla ve özellikle şu konuya odaklan: ${extraInstruction}\n\n${selectedText}`;
    } else {
        prompt = `Lütfen aşağıdaki kodu detaylı bir şekilde açıkla:\n\n${selectedText}`;
    }
    
    // Açıklama isteğini gönder ve sonucu al
    const explanation = await aiService.sendMessage(prompt);
    
    // Yanıtı WebView'e gönder
    if (view) {
        view.webview.postMessage({
            type: 'response',
            content: explanation
        });
    }
    
    return true;
};

/**
 * /review veya /refactor komutunu işleyen handler
 */
export const refactorCommandHandler: SlashCommandHandler = async (
    command, parts, selectedText, aiService, view
) => {
    // WebView'e kullanıcı mesajını ekle
    if (view) {
        view.webview.postMessage({
            type: 'userMessage',
            content: command
        });
        
        // Yükleniyor göstergesini aç
        view.webview.postMessage({
            type: 'loadingStart'
        });
    }
    
    // Eğer kullanıcı komutla birlikte ek açıklama yazdıysa
    const extraInstruction = command.substring(parts[0].length).trim();
    
    // İstek promtunu oluştur
    let prompt = '';
    if (extraInstruction) {
        prompt = `Lütfen aşağıdaki kodu ${parts[0] === '/review' ? 'incele' : 'yeniden düzenle'} ve özellikle şu konuya odaklan: ${extraInstruction}\n\n${selectedText}`;
    } else {
        prompt = `Lütfen aşağıdaki kodu ${parts[0] === '/review' ? 'kapsamlı bir şekilde incele' : 'daha iyi hale gelecek şekilde yeniden düzenle'}:\n\n${selectedText}`;
    }
    
    // Refactoring isteğini gönder ve sonucu al
    const refactoredCode = await aiService.sendMessage(prompt);
    
    // Yanıtı WebView'e gönder
    if (view) {
        view.webview.postMessage({
            type: 'response',
            content: refactoredCode
        });
    }
    
    return true;
};

/**
 * /docs, /generate-docs veya /documentation komutunu işleyen handler
 */
export const docsCommandHandler: SlashCommandHandler = async (
    command, parts, selectedText, aiService, view
) => {
    // WebView'e kullanıcı mesajını ekle
    if (view) {
        view.webview.postMessage({
            type: 'userMessage',
            content: command
        });
        
        // Yükleniyor göstergesini aç
        view.webview.postMessage({
            type: 'loadingStart'
        });
    }
    
    // Eğer kullanıcı komutla birlikte ek açıklama yazdıysa
    const extraInstruction = command.substring(parts[0].length).trim();
    
    // Prompt hazırlama
    let docPrompt = `Please generate comprehensive documentation for the following code. Include:
    
1. Overview of what the code does
2. Function/method descriptions
3. Parameter explanations
4. Return value descriptions
5. Usage examples
6. Any edge cases or important notes`;

    if (extraInstruction) {
        docPrompt += `\n7. Specific focus on: ${extraInstruction}`;
    }
    
    docPrompt += `\n\nCode:
\`\`\`
${selectedText}
\`\`\``;
    
    // Dokümantasyon oluşturma isteğini gönder
    const documentation = await aiService.sendMessage(docPrompt);
    
    // Yanıtı WebView'e gönder
    if (view) {
        view.webview.postMessage({
            type: 'response',
            content: documentation
        });
    }
    
    return true;
};

/**
 * /optimize komutunu işleyen handler
 */
export const optimizeCommandHandler: SlashCommandHandler = async (
    command, parts, selectedText, aiService, view
) => {
    // WebView'e kullanıcı mesajını ekle
    if (view) {
        view.webview.postMessage({
            type: 'userMessage',
            content: command
        });
        
        // Yükleniyor göstergesini aç
        view.webview.postMessage({
            type: 'loadingStart'
        });
    }
    
    // Optimize edilecek kısmı belirle
    const optimizeType = parts.length > 1 ? parts[1].toLowerCase() : 'performance';
    let optimizePrompt = '';
    
    // Optimizasyon türünü belirle
    switch (optimizeType) {
        case 'performance':
        case 'speed':
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
    
    // Eğer kullanıcı komutla birlikte ek açıklama yazdıysa
    const extraParts = parts.slice(optimizeType !== 'performance' ? 2 : 1).join(' ').trim();
    
    // Prompt hazırlama
    let prompt = `Please optimize the following code for ${optimizePrompt}.`;
    
    if (extraParts) {
        prompt += ` Additionally, focus on this specific aspect: ${extraParts}.`;
    }
    
    prompt += `
Provide a clear explanation of the changes made and why they improve the code.

Original code:
\`\`\`
${selectedText}
\`\`\`

Please return the optimized code along with a detailed explanation of the improvements.`;
    
    // Optimizasyon isteğini gönder
    const optimizedResult = await aiService.sendMessage(prompt);
    
    // Yanıtı WebView'e gönder
    if (view) {
        view.webview.postMessage({
            type: 'response',
            content: optimizedResult
        });
    }
    
    return true;
};

/**
 * /comments veya /add-comments komutunu işleyen handler
 */
export const commentsCommandHandler: SlashCommandHandler = async (
    command, parts, selectedText, aiService, view
) => {
    // WebView'e kullanıcı mesajını ekle
    if (view) {
        view.webview.postMessage({
            type: 'userMessage',
            content: command
        });
        
        // Yükleniyor göstergesini aç
        view.webview.postMessage({
            type: 'loadingStart'
        });
    }
    
    // Yorum stili belirle
    const commentStyle = parts.length > 1 ? parts[1].toLowerCase() : 'comprehensive';
    let commentPrompt = '';
    
    // Yorum stiline göre prompt oluştur
    switch (commentStyle) {
        case 'brief':
        case 'concise':
            commentPrompt = 'concise comments (brief comments for key sections only)';
            break;
        case 'doc':
        case 'jsdoc':
        case 'documentation':
            commentPrompt = 'documentation style comments (JSDoc/TSDoc style documentation)';
            break;
        default:
            commentPrompt = 'comprehensive comments (detailed explanations for each code block)';
    }
    
    // Eğer kullanıcı komutla birlikte ek açıklama yazdıysa
    const extraParts = parts.slice(commentStyle !== 'comprehensive' ? 2 : 1).join(' ').trim();
    
    // Prompt hazırlama
    let commentRequest = `Please add ${commentPrompt} to the following code.`;
    
    if (extraParts) {
        commentRequest += ` Follow these specific instructions: ${extraParts}.`;
    }
    
    commentRequest += ` 
Return the same code with appropriate comments added.

Code:
\`\`\`
${selectedText}
\`\`\``;
    
    // Açıklama ekleme isteğini gönder
    const commentedCode = await aiService.sendMessage(commentRequest);
    
    // Yanıtı WebView'e gönder
    if (view) {
        view.webview.postMessage({
            type: 'response',
            content: commentedCode
        });
    }
    
    return true;
};

/**
 * /issues, /analyze veya /find-issues komutunu işleyen handler
 */
export const issuesCommandHandler: SlashCommandHandler = async (
    command, parts, selectedText, aiService, view
) => {
    // WebView'e kullanıcı mesajını ekle
    if (view) {
        view.webview.postMessage({
            type: 'userMessage',
            content: command
        });
        
        // Yükleniyor göstergesini aç
        view.webview.postMessage({
            type: 'loadingStart'
        });
    }
    
    // Sorun türünü belirle
    const issueType = parts.length > 1 ? parts[1].toLowerCase() : 'all';
    let issuePrompt = '';
    
    // Sorun türüne göre prompt oluştur
    switch (issueType) {
        case 'performance':
            issuePrompt = 'performance issues (focus on performance bottlenecks)';
            break;
        case 'security':
            issuePrompt = 'security vulnerabilities (check for security problems)';
            break;
        case 'smells':
        case 'code-smells':
            issuePrompt = 'code smells (identify design problems and anti-patterns)';
            break;
        case 'bugs':
        case 'logic':
            issuePrompt = 'bugs and logic errors (find potential bugs and logic issues)';
            break;
        default:
            issuePrompt = 'all issues (find all types of problems in the code)';
    }
    
    // Eğer kullanıcı komutla birlikte ek açıklama yazdıysa
    const extraParts = parts.slice(issueType !== 'all' ? 2 : 1).join(' ').trim();
    
    // Prompt hazırlama
    let issueRequest = `Please analyze this code for ${issuePrompt} and provide detailed feedback.`;
    
    if (extraParts) {
        issueRequest += ` Specifically, focus on: ${extraParts}.`;
    }
    
    issueRequest += `
For each issue you find:
1. Clearly identify the location and nature of the problem
2. Explain why it's an issue
3. Provide a specific solution or code fix
4. Rate the severity (Critical, Major, Minor)

Code to analyze:
\`\`\`
${selectedText}
\`\`\`

Return a comprehensive analysis with code examples of how to fix the issues.`;
    
    // Sorun analizi isteğini gönder
    const analysis = await aiService.sendMessage(issueRequest);
    
    // Yanıtı WebView'e gönder
    if (view) {
        view.webview.postMessage({
            type: 'response',
            content: analysis
        });
    }
    
    return true;
};

/**
 * /tests, /test veya /unittests komutunu işleyen handler
 */
export const testsCommandHandler: SlashCommandHandler = async (
    command, parts, selectedText, aiService, view
) => {
    // WebView'e kullanıcı mesajını ekle
    if (view) {
        view.webview.postMessage({
            type: 'userMessage',
            content: command
        });
        
        // Yükleniyor göstergesini aç
        view.webview.postMessage({
            type: 'loadingStart'
        });
    }
    
    // Editor dilini al
    const editor = vscode.window.activeTextEditor;
    const languageId = editor ? editor.document.languageId : 'javascript';
    
    // Test framework belirle
    const framework = parts.length > 1 ? parts[1].toLowerCase() : detectTestFramework(languageId);
    
    // Eğer kullanıcı komutla birlikte ek açıklama yazdıysa
    const extraParts = parts.slice(framework !== detectTestFramework(languageId) ? 2 : 1).join(' ').trim();
    
    // Prompt hazırlama
    let testRequest = `Please generate comprehensive unit tests for the following code using the ${framework} testing framework.
Include a variety of test cases covering:
1. Happy path scenarios
2. Edge cases
3. Error handling
4. Input validation`;

    if (extraParts) {
        testRequest += `\n5. Focus specifically on: ${extraParts}`;
    }
    
    testRequest += `\n\nCode to test:
\`\`\`
${selectedText}
\`\`\`

Return well-structured tests with explanatory comments.`;
    
    // Test oluşturma isteğini gönder
    const testCode = await aiService.sendMessage(testRequest);
    
    // Yanıtı WebView'e gönder
    if (view) {
        view.webview.postMessage({
            type: 'response',
            content: testCode
        });
    }
    
    return true;
};

/**
 * /help komutunu işleyen handler
 */
export const helpCommandHandler: SlashCommandHandler = async (
    command, parts, selectedText, aiService, view
) => {
    const helpMessage = `### Byte AI Assistant Commands
    
Here are the available commands:

- **/explain** - Açık dosyayı veya seçili kodu açıkla (örnek: /explain veya /explain for döngüsünün amacını açıkla)
- **/review** veya **/refactor** - Kodu incele veya iyileştir
- **/docs** - Kod için dokümantasyon oluştur
- **/optimize [type]** - Kodu optimize et (türler: performance, memory, size, readability)
- **/comments [style]** - Koda yorum ekle (stiller: comprehensive, concise, doc)
- **/issues [type]** - Koddaki sorunları bul (türler: all, performance, security, smells, bugs)
- **/tests [framework]** - Unit testler oluştur (framework belirtilmezse otomatik algılanır)
- **/help** - Bu yardım mesajını göster

Tüm komutlar için:
1. İlk olarak bir dosyayı dahil edin veya editörde kod seçin
2. Slash komutunu yazın ve isteğe bağlı olarak ek açıklamalar ekleyin

Örnek: \`/explain bu fonksiyonun ne yaptığını ve neden bu şekilde yazıldığını açıkla\`
    `;
    
    // Yanıtı WebView'e gönder
    if (view) {
        view.webview.postMessage({
            type: 'response',
            content: helpMessage
        });
    }
    
    return true;
};

/**
 * Slash komutlarını işleyen ana fonksiyon
 */
export async function processSlashCommand(
    message: string,
    aiService: AIService,
    view?: vscode.WebviewView
): Promise<boolean> {
    // Komut ve içeriği ayır
    const parts = message.trim().split(/\s+/);
    const command = parts[0].toLowerCase();
    
    // Eğer aktif bir text editor yoksa
    const editor = vscode.window.activeTextEditor;
    
    // Aktif bir editör yoksa, kullanıcıya bilgi ver
    if (!editor) {
        if (view) {
            view.webview.postMessage({
                type: 'error',
                content: 'Bir dosya açık olmalı. Lütfen düzenlemek istediğiniz dosyayı açın.'
            });
        }
        return true;
    }
    
    // Mevcut seçili metni veya tüm dosya içeriğini alın
    let selectedText = '';
    if (editor.selection && !editor.selection.isEmpty) {
        selectedText = editor.document.getText(editor.selection);
    } else {
        // Eğer bir kod parçası seçili değilse, tüm dosya içeriğini al
        selectedText = editor.document.getText();
        
        // Eğer hala metin yoksa, kullanıcıya bilgi ver
        if (!selectedText) {
            if (view) {
                view.webview.postMessage({
                    type: 'error',
                    content: 'Dosya içeriği bulunamadı. Lütfen geçerli bir dosya açın.'
                });
            }
            return true;
        }
    }

    // Komutları işle
    try {
        switch (command) {
            case '/explain':
                return await explainCommandHandler(command, parts, selectedText, aiService, view);
                
            case '/review':
            case '/refactor':
                return await refactorCommandHandler(command, parts, selectedText, aiService, view);
                
            case '/docs':
            case '/generate-docs':
            case '/documentation':
                return await docsCommandHandler(command, parts, selectedText, aiService, view);
                
            case '/optimize':
                return await optimizeCommandHandler(command, parts, selectedText, aiService, view);
                
            case '/comments':
            case '/add-comments':
                return await commentsCommandHandler(command, parts, selectedText, aiService, view);
                
            case '/issues':
            case '/analyze':
            case '/find-issues':
                return await issuesCommandHandler(command, parts, selectedText, aiService, view);
                
            case '/tests':
            case '/test':
            case '/unittests':
                return await testsCommandHandler(command, parts, selectedText, aiService, view);
                
            case '/help':
                return await helpCommandHandler(command, parts, selectedText, aiService, view);
                
            default:
                // Bilinmeyen komut - işlenmeyen komutlar için false döndür
                return false;
        }
    } catch (error: any) {
        // Hata durumunu WebView'e ilet
        if (view) {
            view.webview.postMessage({
                type: 'error',
                content: `Komut işlenirken hata oluştu: ${error.message}`
            });
        }
        return true;
    }
} 