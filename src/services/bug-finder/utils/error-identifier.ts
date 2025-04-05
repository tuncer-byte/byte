import { ErrorType } from '../types';

/**
 * Hata mesajını analiz ederek hata tipini belirler
 * 
 * @param errorMessage Hata mesajı
 * @returns Belirlenen hata tipi
 */
export function identifyErrorType(errorMessage: string): ErrorType {
    if (!errorMessage) {
        return ErrorType.Unknown;
    }
    
    const lowerCaseError = errorMessage.toLowerCase();
    
    // Syntax hatası belirteçleri
    const syntaxPatterns = [
        'syntaxerror', 
        'syntax error', 
        'unexpected token', 
        'unexpected identifier',
        'unexpected end of input',
        'missing', 
        'expected',
        'unterminated string',
        'invalid syntax',
        'parsing error'
    ];
    
    // Runtime hatası belirteçleri
    const runtimePatterns = [
        'typeerror',
        'type error',
        'referenceerror',
        'reference error',
        'rangeerror',
        'range error',
        'nullptr',
        'null reference',
        'undefined is not a function',
        'cannot read property',
        'is not defined',
        'is not a function',
        'is not iterable',
        'indexerror',
        'index error',
        'index out of range',
        'array index out of bounds'
    ];
    
    // Derleme hatası belirteçleri
    const compilationPatterns = [
        'compiler error',
        'compilation failed',
        'build failed',
        'cannot compile',
        'cannot build',
        'build error',
        'compilation error',
        'failed to compile'
    ];
    
    // Bağımlılık hatası belirteçleri
    const dependencyPatterns = [
        'module not found',
        'cannot find module',
        'dependency not found',
        'no such module',
        'unable to resolve dependency',
        'unresolved dependency',
        'missing dependency',
        'package not found',
        'npm err',
        'pip err',
        'gem not found',
        'library not loaded',
        'unable to locate package'
    ];
    
    // Konfigürasyon hatası belirteçleri
    const configPatterns = [
        'configuration error',
        'config error',
        'invalid configuration',
        'no such option',
        'unknown option',
        'env:',
        'environment variable',
        'permission denied',
        'access denied',
        '.env',
        'config file',
        'configuration file'
    ];
    
    // Her bir pattern setini kontrol et
    if (syntaxPatterns.some(pattern => lowerCaseError.includes(pattern))) {
        return ErrorType.Syntax;
    }
    
    if (runtimePatterns.some(pattern => lowerCaseError.includes(pattern))) {
        return ErrorType.Runtime;
    }
    
    if (compilationPatterns.some(pattern => lowerCaseError.includes(pattern))) {
        return ErrorType.Compilation;
    }
    
    if (dependencyPatterns.some(pattern => lowerCaseError.includes(pattern))) {
        return ErrorType.Dependency;
    }
    
    if (configPatterns.some(pattern => lowerCaseError.includes(pattern))) {
        return ErrorType.Configuration;
    }
    
    // Varsayılan olarak bilinmeyen tip
    return ErrorType.Unknown;
} 