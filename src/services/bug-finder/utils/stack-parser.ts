/**
 * Stack trace ayrıştırıcı
 * Hata stack izinden dosya adları ve satır numaralarını çıkarır
 */

/**
 * Bir stack trace satırı için ayrıştırılmış sonuç
 */
export interface ParsedStackFrame {
    fileName: string;
    lineNumber?: number;
    columnNumber?: number;
    functionName?: string;
}

/**
 * Stack trace metnini ayrıştırarak dosya adları ve satır numaralarını çıkarır
 * Farklı hata formatlarını destekler
 * 
 * @param stackTrace Stack trace metni
 * @returns Ayrıştırılan dosya adları ve satır numaraları
 */
export function parse(stackTrace: string): ParsedStackFrame[] {
    if (!stackTrace) {
        return [];
    }
    
    const frames: ParsedStackFrame[] = [];
    const lines = stackTrace.split('\n');
    
    // JavaScript/TypeScript stack trace formatı
    // at functionName (/path/to/file.js:lineNumber:columnNumber)
    const jsRegex = /at\s+(?:(.+?)\s+\()?(?:(.+?):(\d+)(?::(\d+))?|([^)]+))\)?/;
    
    // Python stack trace formatı
    // File "/path/to/file.py", line 10, in function_name
    const pythonRegex = /File\s+"([^"]+)",\s+line\s+(\d+)(?:,\s+in\s+(.+))?/;
    
    // Java/JVM stack trace formatı
    // at package.Class.method(File.java:lineNumber)
    const javaRegex = /at\s+(?:(.+?)(?:\.(.+))?)\((?:([^:]+):(\d+))?.*?\)/;
    
    // Ruby stack trace formatı
    // from /path/to/file.rb:10:in `method'
    const rubyRegex = /from\s+([^:]+):(\d+)(?::in\s+`(.+?)')?/;
    
    // Genel URL ve dosya yolu formatları
    const filePathRegex = /((?:\/[\w\.-]+)+\.[\w]+):(\d+)(?::(\d+))?/;
    
    for (const line of lines) {
        // JavaScript/TypeScript
        let match = line.match(jsRegex);
        if (match) {
            const [, functionName, fileName, lineNumber, columnNumber] = match;
            frames.push({
                fileName: fileName || '',
                lineNumber: lineNumber ? parseInt(lineNumber, 10) : undefined,
                columnNumber: columnNumber ? parseInt(columnNumber, 10) : undefined,
                functionName
            });
            continue;
        }
        
        // Python
        match = line.match(pythonRegex);
        if (match) {
            const [, fileName, lineNumber, functionName] = match;
            frames.push({
                fileName,
                lineNumber: parseInt(lineNumber, 10),
                functionName
            });
            continue;
        }
        
        // Java
        match = line.match(javaRegex);
        if (match) {
            const [, classWithPackage, methodName, fileName, lineNumber] = match;
            frames.push({
                fileName: fileName || '',
                lineNumber: lineNumber ? parseInt(lineNumber, 10) : undefined,
                functionName: methodName || classWithPackage
            });
            continue;
        }
        
        // Ruby
        match = line.match(rubyRegex);
        if (match) {
            const [, fileName, lineNumber, functionName] = match;
            frames.push({
                fileName,
                lineNumber: parseInt(lineNumber, 10),
                functionName
            });
            continue;
        }
        
        // Genel dosya yolu formatı
        match = line.match(filePathRegex);
        if (match) {
            const [, fileName, lineNumber, columnNumber] = match;
            frames.push({
                fileName,
                lineNumber: lineNumber ? parseInt(lineNumber, 10) : undefined,
                columnNumber: columnNumber ? parseInt(columnNumber, 10) : undefined
            });
        }
    }
    
    return frames;
} 