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