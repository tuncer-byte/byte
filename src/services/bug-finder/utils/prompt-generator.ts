import { DetectedError, ErrorType } from '../types';

/**
 * AI için context-aware prompt oluşturur
 * @param error Tespit edilen hata
 * @param fileContents İlgili dosya içerikleri
 * @returns AI'ya gönderilecek prompt
 */
export function generatePrompt(error: DetectedError, fileContents: Record<string, string> = {}): string {
    // Temek prompt
    let prompt = `Terminal'de aşağıdaki hata mesajı görüldü. Lütfen bu hatayı analiz et ve çözüm öner:

HATA MESAJI:
\`\`\`
${error.message}
\`\`\`

${error.stack ? `STACK TRACE:
\`\`\`
${error.stack}
\`\`\`
` : ''}

Hata tipi: ${getErrorTypeDescription(error.errorType)}
`;

    // İlgili dosya içeriklerini ekle
    if (Object.keys(fileContents).length > 0) {
        prompt += `\nİLGİLİ DOSYA İÇERİKLERİ:\n`;
        
        for (const [file, content] of Object.entries(fileContents)) {
            const extension = file.split('.').pop() || '';
            prompt += `\n\`\`\`${getLanguageFromExtension(extension)}:${file}\n${content}\n\`\`\`\n`;
        }
    }
    
    // Hata tipine özel talimatlar
    prompt += getErrorSpecificInstructions(error.errorType);
    
    // Yanıt formatı talimatlari
    prompt += `
Lütfen aşağıdaki gibi detaylı bir yanıt ver:
1. Hatanın kök nedeni (what): Hatanın sebebini açıkla
2. Hatanın teknik açıklaması (why): Neden bu hatanın ortaya çıktığını açıkla
3. Çözüm adımları (how): Adım adım, net, uygulanabilir çözüm önerileri sun
4. Gelecekte önlemler: Bu tür hataları önlemek için öneriler

ÖNEMLİ: Çözüm içerisinde komut çalıştırmam gerekiyorsa, aşağıdaki formatta MUTLAKA yaz:

\`\`\`bash
senin_önerdiğin_komut parametre1 parametre2
\`\`\`

ÖNEMLİ: Kod değişikliği yapılması gerekiyorsa, aşağıdaki formatta MUTLAKA yaz:

\`\`\`dosya_dili:dosya_yolu
// Değiştirilecek içerik
\`\`\`

Yanıtını kısa, öz ve uygulanabilir çözümlere odakla. Aşırı teknik jargondan kaçın ve çözümleri türkçe olarak açıkla. Kodu açıklarken türkçe kullan.`;

    return prompt;
}

/**
 * Hata tipine göre açıklama metni
 */
function getErrorTypeDescription(errorType: ErrorType): string {
    switch (errorType) {
        case ErrorType.Syntax:
            return 'Sözdizimi Hatası (Syntax Error)';
        case ErrorType.Runtime:
            return 'Çalışma Zamanı Hatası (Runtime Error)';
        case ErrorType.Compilation:
            return 'Derleme Hatası (Compilation Error)';
        case ErrorType.Dependency:
            return 'Bağımlılık Hatası (Dependency Error)';
        case ErrorType.Configuration:
            return 'Konfigürasyon Hatası (Configuration Error)';
        case ErrorType.Unknown:
        default:
            return 'Bilinmeyen Hata (Unknown Error)';
    }
}

/**
 * Hata tipine özel talimatlar
 */
function getErrorSpecificInstructions(errorType: ErrorType): string {
    switch (errorType) {
        case ErrorType.Syntax:
            return `\nBu bir sözdizimi hatası. Lütfen kodda yanlış yazılmış, eksik veya fazla karakterler, parantezler, noktalı virgüller gibi sözdizimi sorunlarına odaklan. Kod düzeltme önerileri sun.`;
        
        case ErrorType.Runtime:
            return `\nBu bir çalışma zamanı hatası. Lütfen tip uyumsuzlukları, tanımsız değişkenler, null/undefined değerler, dizi sınırları gibi runtime sorunlarına odaklan. Savunmacı kod yazımı ve hata kontrolü önerileri sun.`;
        
        case ErrorType.Compilation:
            return `\nBu bir derleme hatası. Lütfen tip hataları, eksik modüller, yanlış import/export ifadeleri, derleme yapılandırması gibi sorunlara odaklan. Derleme yapılandırmasını veya kodu düzeltme önerileri sun.`;
        
        case ErrorType.Dependency:
            return `\nBu bir bağımlılık hatası. Lütfen eksik paketler, sürüm uyumsuzlukları, yanlış yapılandırılmış bağımlılıklar gibi sorunlara odaklan. Paket yöneticisi komutları ve bağımlılık düzeltme önerileri sun.`;
        
        case ErrorType.Configuration:
            return `\nBu bir konfigürasyon hatası. Lütfen yanlış yapılandırılmış ayarlar, eksik ortam değişkenleri, izin sorunları gibi yapılandırma sorunlarına odaklan. Yapılandırma dosyalarını düzeltme ve ortam ayarlama önerileri sun.`;
        
        case ErrorType.Unknown:
        default:
            return `\nBu hatanın belirli bir kategorisi yok. Lütfen kod kalitesi, mantıksal hatalar, performans sorunları gibi farklı açılardan analiz et. Geniş kapsamlı çözüm önerileri sun.`;
    }
}

/**
 * Dosya uzantısına göre dil belirleyici
 */
function getLanguageFromExtension(extension: string): string {
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
    
    return extensionMap[extension.toLowerCase()] || 'plaintext';
} 