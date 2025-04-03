/**
 * Önbellek (cache) için tip tanımlamaları
 * Google Gemini API önbellek özelliğiyle uyumlu
 * @see https://ai.google.dev/api/caching?hl=tr
 */

// Önbellek içeriği için arabirim
export interface CachedContent {
    name: string;
    displayName?: string;
    model: string;
    contents?: Content[];
    tools?: Tool[];
    systemInstruction?: Content;
    toolConfig?: ToolConfig;
    expiration?: {
        expireTime?: string;
        ttl?: string;
    };
    usageMetadata?: UsageMetadata;
    createdAt?: string;
}

// Gemini API'de kullanılan içerik tipi
export interface Content {
    parts?: Part[];
    role?: string;
}

// İçerik parçası tipi
export interface Part {
    text?: string;
    fileData?: {
        mimeType: string;
        fileUri: string;
    };
    inlineData?: {
        mimeType: string;
        data: string;
    };
    functionCall?: {
        name: string;
        args: any;
    };
    functionResponse?: {
        name: string;
        response: any;
    };
}

// Araç tanımlaması
export interface Tool {
    functionDeclarations?: FunctionDeclaration[];
    googleSearchRetrieval?: Record<string, never>;
    codeExecution?: Record<string, never>;
}

// Fonksiyon tanımlaması
export interface FunctionDeclaration {
    name: string;
    description?: string;
    parameters?: {
        type: string;
        properties?: Record<string, any>;
        required?: string[];
    };
}

// Araç konfigürasyon tipi
export interface ToolConfig {
    functionCallingConfig?: {
        mode?: 'AUTO' | 'ANY' | 'NONE';
        allowedFunctionNames?: string[];
    };
}

// Kullanım meta verileri
export interface UsageMetadata {
    totalTokenCount: number;
}

// Önbellek yöneticisi için ayarlar
export interface CacheSettings {
    enabled: boolean;
    defaultTtl: string; // Örn: "3600s" (1 saat)
    maxCachedItems: number;
    automaticCaching: boolean;
}

// Önbellek işlemleri için dönüş tipi
export interface CacheOperationResult {
    success: boolean;
    message: string;
    cacheId?: string;
    error?: Error;
}

// Önbellek arama sonucu
export interface CacheLookupResult {
    found: boolean;
    cachedContent?: CachedContent;
    tokensSaved?: number;
} 