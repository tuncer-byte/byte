import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * HTML şablonlarını yüklemek ve işlemek için yardımcı sınıf
 */
export class TemplateLoader {
    /**
     * Şablon dosyasını yükler ve değişkenleri değerlerle değiştirir
     * @param templateName Şablon dosya adı
     * @param variables Değişkenler ve değerleri
     * @returns İşlenmiş şablon içeriği
     */
    public static loadTemplate(templateName: string, variables: Record<string, string>): string {
        try {
            // Eklenti dizinini al
            // NOT: tuncerbyte.byte yerine daha genel bir yaklaşım ile eklenti ID'sini almaya çalışalım
            let extensionPath = '';
            
            // Tüm aktif uzantıları kontrol et
            const extensions = vscode.extensions.all;
            for (const ext of extensions) {
                if (ext.id.toLowerCase().includes('byte') || ext.id.toLowerCase().includes('tuncerbyte')) {
                    extensionPath = ext.extensionPath;
                    break;
                }
            }
            
            // Eğer eklenti yolu bulunamadıysa, alternatif yol kullan
            if (!extensionPath) {
                // Çalıştırma ortamındaki mevcut dosya yolundan türet
                extensionPath = path.join(__dirname, '../../../../');
                console.log('Eklenti yolu dinamik olarak hesaplandı:', extensionPath);
            }
            
            if (!extensionPath) {
                throw new Error('Eklenti dizini bulunamadı');
            }
            
            // CSS dosyasının yolunu oluştur ve değişkenlere ekle
            if (!variables.cssPath) {
                const cssPath = this.getUri(path.join(extensionPath, 'media', 'bug-finder', 'styles.css'))?.toString() || '';
                variables.cssPath = cssPath;
            }
            
            // Şablon dosyasının tam yolunu oluştur
            const templatePath = path.join(extensionPath, 'media', 'bug-finder', templateName);
            console.log('Şablon yolu:', templatePath);
            
            // Dosya var mı kontrol et
            if (!fs.existsSync(templatePath)) {
                throw new Error(`Şablon dosyası bulunamadı: ${templatePath}`);
            }
            
            // Şablon içeriğini oku
            let templateContent = fs.readFileSync(templatePath, 'utf-8');
            
            // Değişkenleri değiştir
            for (const [key, value] of Object.entries(variables)) {
                const placeholder = new RegExp(`{{${key}}}`, 'g');
                templateContent = templateContent.replace(placeholder, value || '');
            }
            
            return templateContent;
        } catch (error) {
            console.error('Şablon yüklenirken hata oluştu:', error);
            
            // Hata durumunda satır içi HTML kullan
            return TemplateLoader.getInlineTemplate(templateName, variables);
        }
    }
    
    /**
     * Ana şablona ek şablonları ekler
     * @param mainTemplate Ana şablon
     * @param templates Eklenecek şablonlar ve yer işaretleri
     * @returns Birleştirilmiş şablon
     */
    public static injectTemplates(mainTemplate: string, templates: Record<string, string>): string {
        let result = mainTemplate;
        
        // Her bir şablonu yer işaretine ekle
        for (const [placeholder, content] of Object.entries(templates)) {
            const placeholderRegex = new RegExp(`{{${placeholder}}}`, 'g');
            result = result.replace(placeholderRegex, content || '');
        }
        
        // Kalan yer işaretlerini temizle
        result = result.replace(/{{[^}]+}}/g, '');
        
        return result;
    }
    
    /**
     * Acil durum için yedek olarak satır içi şablon döndürür
     * Şablonlar yüklenemediğinde bu kullanılır
     */
    private static getInlineTemplate(templateName: string, variables: Record<string, string>): string {
        // Şablon adına göre farklı içerikler döndür
        switch (templateName) {
            case 'solution-template.html':
                return `<!DOCTYPE html>
                <html lang="tr">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${variables.cspSource || ''} 'unsafe-inline'; script-src 'nonce-${variables.nonce || ''}';">
                    <title>Hata Çözümü</title>
                    <style>
                        :root {
                            --byte-primary: #007ACC;
                            --byte-secondary: #0098FF;
                            --byte-accent: #FF6D00;
                            --byte-success: #3FB950;
                            --byte-error: #F85149;
                            --byte-warning: #F7B93E;
                        }
                        
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
                            padding: 16px;
                            color: var(--vscode-foreground);
                            background-color: var(--vscode-editor-background);
                            line-height: 1.5;
                        }
                        h1 {
                            color: var(--byte-primary);
                            font-size: 18px;
                            margin-bottom: 16px;
                            padding-bottom: 8px;
                            border-bottom: 1px solid var(--byte-primary);
                        }
                        h2 {
                            color: var(--byte-primary);
                            font-size: 16px;
                            margin-top: 24px;
                            margin-bottom: 8px;
                        }
                        h3 {
                            color: var(--byte-secondary);
                            font-size: 14px;
                            margin-top: 16px;
                            margin-bottom: 8px;
                        }
                        .error-box {
                            background-color: rgba(248, 81, 73, 0.1);
                            border: 1px solid var(--byte-error);
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
                            border: 1px solid var(--byte-primary);
                            border-left: 4px solid var(--byte-primary);
                            border-radius: 4px;
                            padding: 16px;
                            margin-bottom: 20px;
                            overflow-wrap: break-word;
                        }
                        .code-block {
                            background-color: rgba(0, 122, 204, 0.1);
                            padding: 10px;
                            border-radius: 4px;
                            overflow-x: auto;
                            margin: 12px 0;
                            font-family: monospace;
                            border-left: 3px solid var(--byte-secondary);
                        }
                        button {
                            background-color: var(--byte-primary);
                            color: white;
                            border: none;
                            padding: 8px 16px;
                            border-radius: 4px;
                            cursor: pointer;
                            margin-right: 8px;
                            margin-top: 10px;
                        }
                        button:hover {
                            background-color: var(--byte-secondary);
                        }
                    </style>
                </head>
                <body>
                    <h1>Byte AI Hata Çözümü</h1>
                    <div class="error-box">${variables.errorMessage || ''}</div>
                    <h2>Çözüm</h2>
                    <div class="solution-box">${variables.solutionDescription || ''}</div>
                    <div>
                        {{commandSection}}
                        {{codeSection}}
                        <button id="dismiss">Kapat</button>
                    </div>
                    <script nonce="${variables.nonce || ''}">
                        const vscode = acquireVsCodeApi();
                        document.getElementById('dismiss').addEventListener('click', () => {
                            vscode.postMessage({ command: 'dismiss' });
                        });
                        {{commandScript}}
                        {{codeScript}}
                    </script>
                </body>
                </html>`;
                
            case 'command-section.html':
                return `<div>
                    <h3>Çalıştırılacak Komut</h3>
                    <pre class="code-block">${variables.commandToRun || ''}</pre>
                    <button id="apply-command">Komutu Çalıştır</button>
                </div>`;
                
            case 'code-section.html':
                return `<div>
                    <h3>Kod Değişiklikleri</h3>
                    ${variables.codeChangesList || ''}
                    <button id="apply-code">Kod Değişikliklerini Uygula</button>
                </div>`;
                
            case 'file-template.html':
                return `<div>
                    <div style="font-weight:bold;">${variables.fileName || ''}</div>
                    <pre class="code-block">${variables.fileContent || ''}</pre>
                </div>`;
                
            case 'tabs-template.html':
                // Bu sadece parçalar halinde kullanılıyor, tam şablon döndürmeye gerek yok
                return `<div class="solution-nav-item" data-section="komut">Komut</div>
                <div class="solution-nav-item" data-section="kod">Kod Değişiklikleri</div>
                <button id="apply-command">Komutu Çalıştır</button>
                <button id="apply-code">Kod Değişikliklerini Uygula</button>
                document.getElementById('apply-command')?.addEventListener('click', () => {
                    vscode.postMessage({ command: 'applyCommand' });
                });
                document.getElementById('apply-code')?.addEventListener('click', () => {
                    vscode.postMessage({ command: 'applyCodeChanges' });
                });`;
                
            default:
                return `<div>Şablon yüklenemedi: ${templateName}</div>`;
        }
    }

    /**
     * Dosya yolundan webview URI'si oluşturur
     * @param filePath Dosya yolu
     * @returns WebView URI
     */
    private static getUri(filePath: string): vscode.Uri | undefined {
        try {
            const uri = vscode.Uri.file(filePath);
            return uri;
        } catch (error) {
            console.error('URI oluşturulurken hata oluştu:', error);
            return undefined;
        }
    }
}