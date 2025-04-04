/**
 * Webview için güvenli bir nonce oluşturur.
 * Nonce, güvenlik politikalarında kullanılır.
 */
export function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

/**
 * Verilen metni doğrudan HTML olarak kullanmak için güvenli hale getirir
 */
export function escapeHtml(unsafe: string): string {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Uzun metni belirli bir sınırla keser ve sonuna "..." ekler
 */
export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
        return text;
    }
    return text.slice(0, maxLength) + '...';
}

/**
 * Bilinen dosya uzantılarına göre dil belirler
 */
export function getLanguageFromExtension(fileName: string): string {
    if (!fileName) {
        return 'plaintext';
    }

    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    // Yaygın diller için extension-to-language mapping
    const extensionMap: {[key: string]: string} = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'py': 'python',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'json': 'json',
        'md': 'markdown',
        'c': 'c',
        'cpp': 'cpp',
        'cs': 'csharp',
        'java': 'java',
        'php': 'php',
        'rb': 'ruby',
        'rs': 'rust',
        'go': 'go',
        'sh': 'shell',
        'bash': 'shell',
        'sql': 'sql',
        'xml': 'xml',
        'yaml': 'yaml',
        'yml': 'yaml',
        'txt': 'plaintext'
    };
    
    return extensionMap[extension] || 'plaintext';
}

/**
 * AI yanıtından kod bloklarını ve dosya adlarını ayıklar
 * @param text AI yanıtı
 * @returns Kod bloklarını ve ilgili dosya adlarını içeren dizi
 */
export function extractCodeBlocks(text: string): Array<{code: string, fileName: string | null}> {
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
 * Dosya adına göre uzantı türünü belirler
 * @param fileName Dosya adı
 * @returns Dil tanımlayıcısı
 */
export function getLanguageFromFileName(fileName: string): string {
    if (!fileName) return 'plaintext';
    
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    switch (extension) {
        case 'js':
            return 'javascript';
        case 'ts':
            return 'typescript';
        case 'jsx':
            return 'javascriptreact';
        case 'tsx':
            return 'typescriptreact';
        case 'py':
            return 'python';
        case 'html':
            return 'html';
        case 'css':
            return 'css';
        case 'json':
            return 'json';
        case 'md':
            return 'markdown';
        case 'java':
            return 'java';
        case 'cpp':
        case 'cc':
            return 'cpp';
        case 'c':
            return 'c';
        case 'cs':
            return 'csharp';
        case 'php':
            return 'php';
        case 'rb':
            return 'ruby';
        case 'go':
            return 'go';
        case 'rs':
            return 'rust';
        case 'swift':
            return 'swift';
        case 'kt':
        case 'kts':
            return 'kotlin';
        case 'sql':
            return 'sql';
        case 'sh':
            return 'shellscript';
        default:
            return 'plaintext';
    }
} 