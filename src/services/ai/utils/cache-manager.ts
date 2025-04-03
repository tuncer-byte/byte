import * as vscode from 'vscode';
import {
    CachedContent,
    CacheOperationResult,
    CacheLookupResult,
    CacheSettings,
    Content,
    Message,
    Tool
} from '../types';

/**
 * Önbellek yöneticisi sınıfı
 * Gemini API'nin önbelleğe alma özelliğini kullanarak 
 * içerikleri önbelleğe almayı ve yönetmeyi sağlar
 */
export class CacheManager {
    private context: vscode.ExtensionContext;
    private settings: CacheSettings;
    private cacheMap: Map<string, CachedContent>;
    
    // Önbellek için saklama anahtarı
    private static readonly CACHE_STORAGE_KEY = 'geminiApiCache';
    
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.cacheMap = new Map<string, CachedContent>();
        
        // Varsayılan önbellek ayarlarını yükle
        this.settings = this.loadSettings();
        
        // Kaydedilmiş önbellek içeriklerini yükle
        this.loadCachedContents();
    }
    
    /**
     * Varsayılan önbellek ayarlarını yükler
     */
    private loadSettings(): CacheSettings {
        const config = vscode.workspace.getConfiguration('byte');
        return {
            enabled: config.get<boolean>('cache.enabled') ?? true,
            defaultTtl: config.get<string>('cache.defaultTtl') ?? '3600s', // 1 saat varsayılan
            maxCachedItems: config.get<number>('cache.maxCachedItems') ?? 50,
            automaticCaching: config.get<boolean>('cache.automaticCaching') ?? true
        };
    }
    
    /**
     * Kaydedilmiş önbellek içeriklerini yükler
     */
    private async loadCachedContents(): Promise<void> {
        try {
            const cachedData = this.context.globalState.get<{[key: string]: CachedContent}>(
                CacheManager.CACHE_STORAGE_KEY, 
                {}
            );
            
            // Önbellek verisini Map'e dönüştür
            this.cacheMap.clear();
            Object.entries(cachedData).forEach(([key, value]) => {
                // TTL kontrolü yap - süresi dolmuş önbellekleri atlat
                if (value.expiration?.expireTime && new Date(value.expiration.expireTime) < new Date()) {
                    return;
                }
                this.cacheMap.set(key, value);
            });
            
            // Eğer maksimum önbellek öğesi sayısını aşıyorsak, en eskiden başlayarak sil
            if (this.cacheMap.size > this.settings.maxCachedItems) {
                const sortedEntries = [...this.cacheMap.entries()]
                    .sort((a, b) => {
                        const aDate = a[1].createdAt ? new Date(a[1].createdAt) : new Date(0);
                        const bDate = b[1].createdAt ? new Date(b[1].createdAt) : new Date(0);
                        return aDate.getTime() - bDate.getTime();
                    });
                
                const entriesToRemove = sortedEntries.slice(0, this.cacheMap.size - this.settings.maxCachedItems);
                entriesToRemove.forEach(([key]) => this.cacheMap.delete(key));
            }
        } catch (error) {
            console.error('Önbellek verisi yüklenirken hata oluştu:', error);
            // Hata durumunda boş bir önbellek ile devam et
            this.cacheMap.clear();
        }
    }
    
    /**
     * Mevcut önbellek içeriklerini kaydeder
     */
    private async saveCachedContents(): Promise<void> {
        try {
            // Map'i nesneye dönüştür
            const cacheObject: {[key: string]: CachedContent} = {};
            this.cacheMap.forEach((value, key) => {
                cacheObject[key] = value;
            });
            
            await this.context.globalState.update(
                CacheManager.CACHE_STORAGE_KEY, 
                cacheObject
            );
        } catch (error) {
            console.error('Önbellek verisi kaydedilirken hata oluştu:', error);
        }
    }
    
    /**
     * Yeni bir önbellek içeriği oluşturur
     * @param modelName Model adı
     * @param contents İçerikler
     * @param systemInstruction Sistem talimatı
     * @param ttl Geçerlilik süresi (örn: "3600s" - 1 saat)
     * @param displayName Görünen ad
     * @param tools Araçlar
     */
    public async createCache(
        modelName: string, 
        contents: Content[], 
        systemInstruction?: Content,
        ttl?: string,
        displayName?: string,
        tools?: Tool[]
    ): Promise<CacheOperationResult> {
        if (!this.settings.enabled) {
            return {
                success: false,
                message: 'Önbelleğe alma özelliği devre dışı bırakılmış.'
            };
        }
        
        try {
            // Benzersiz bir ID oluştur
            const cacheId = `cache_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const formattedModelName = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
            
            // Son kullanma zamanını hesapla
            const ttlValue = ttl || this.settings.defaultTtl;
            const expirationTime = this.calculateExpirationTime(ttlValue);
            
            // Önbellek içeriği oluştur
            const cachedContent: CachedContent = {
                name: `cachedContents/${cacheId}`,
                displayName: displayName || `Cache ${new Date().toISOString()}`,
                model: formattedModelName,
                contents,
                systemInstruction,
                tools,
                expiration: {
                    expireTime: expirationTime.toISOString(),
                    ttl: ttlValue
                },
                createdAt: new Date().toISOString()
            };
            
            // Önbelleğe ekle
            this.cacheMap.set(cacheId, cachedContent);
            await this.saveCachedContents();
            
            return {
                success: true,
                message: 'Önbellek başarıyla oluşturuldu.',
                cacheId
            };
        } catch (error) {
            console.error('Önbellek oluşturulurken hata oluştu:', error);
            return {
                success: false,
                message: 'Önbellek oluşturulurken bir hata oluştu.',
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }
    
    /**
     * TTL değerine göre son kullanma zamanını hesaplar
     * @param ttl TTL değeri (örn: "3600s")
     */
    private calculateExpirationTime(ttl: string): Date {
        const ttlMatch = ttl.match(/^(\d+(\.\d+)?)s$/);
        if (!ttlMatch) {
            throw new Error('Geçersiz TTL formatı. Örnek: "3600s"');
        }
        
        const ttlSeconds = parseFloat(ttlMatch[1]);
        const expirationTime = new Date();
        expirationTime.setSeconds(expirationTime.getSeconds() + ttlSeconds);
        
        return expirationTime;
    }
    
    /**
     * Belirli bir önbelleği ID'ye göre getirir
     * @param cacheId Önbellek ID'si
     */
    public getCache(cacheId: string): CacheLookupResult {
        const cachedContent = this.cacheMap.get(cacheId);
        
        if (!cachedContent) {
            return { found: false };
        }
        
        // Süre kontrolü yap
        if (cachedContent.expiration?.expireTime) {
            const expireTime = new Date(cachedContent.expiration.expireTime);
            if (expireTime < new Date()) {
                // Süresi dolmuş, önbellekten kaldır
                this.cacheMap.delete(cacheId);
                this.saveCachedContents();
                return { found: false };
            }
        }
        
        return {
            found: true,
            cachedContent,
            tokensSaved: cachedContent.usageMetadata?.totalTokenCount || 0
        };
    }
    
    /**
     * Belirli bir önbelleği siler
     * @param cacheId Önbellek ID'si
     */
    public async deleteCache(cacheId: string): Promise<CacheOperationResult> {
        if (!this.cacheMap.has(cacheId)) {
            return {
                success: false,
                message: 'Belirtilen önbellek bulunamadı.'
            };
        }
        
        try {
            this.cacheMap.delete(cacheId);
            await this.saveCachedContents();
            
            return {
                success: true,
                message: 'Önbellek başarıyla silindi.'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Önbellek silinirken bir hata oluştu.',
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }
    
    /**
     * Tüm önbellekleri temizler
     */
    public async clearAllCaches(): Promise<CacheOperationResult> {
        try {
            this.cacheMap.clear();
            await this.saveCachedContents();
            
            return {
                success: true,
                message: 'Tüm önbellekler başarıyla temizlendi.'
            };
        } catch (error) {
            return {
                success: false,
                message: 'Önbellekler temizlenirken bir hata oluştu.',
                error: error instanceof Error ? error : new Error(String(error))
            };
        }
    }
    
    /**
     * Gemini API için mesajları içerik formatına dönüştürür
     * @param messages Mesaj dizisi
     */
    public convertMessagesToContents(messages: Message[]): Content[] {
        return messages.map(message => ({
            role: message.role,
            parts: [{ text: message.content }]
        }));
    }
    
    /**
     * İçeriğe göre uygun bir önbellek arar
     * @param content İçerik metni
     * @param modelName Model adı
     */
    public findCacheByContent(content: string, modelName: string): CacheLookupResult {
        // Bu basit bir arama implementasyonu. 
        // Gerçek uygulamalarda daha karmaşık içerik karşılaştırması yapılabilir.
        for (const [id, cache] of this.cacheMap.entries()) {
            if (cache.model.includes(modelName)) {
                const matchingContent = cache.contents?.some(item => 
                    item.parts?.some(part => 
                        part.text && part.text.includes(content)
                    )
                );
                
                if (matchingContent) {
                    return {
                        found: true,
                        cachedContent: cache,
                        tokensSaved: cache.usageMetadata?.totalTokenCount || 0
                    };
                }
            }
        }
        
        return { found: false };
    }
    
    /**
     * Önbellek ayarlarını günceller
     * @param settings Yeni ayarlar
     */
    public async updateSettings(settings: Partial<CacheSettings>): Promise<void> {
        this.settings = { ...this.settings, ...settings };
        
        // Yapılandırmayı güncelle
        const config = vscode.workspace.getConfiguration('byte');
        await config.update('cache.enabled', this.settings.enabled, vscode.ConfigurationTarget.Global);
        await config.update('cache.defaultTtl', this.settings.defaultTtl, vscode.ConfigurationTarget.Global);
        await config.update('cache.maxCachedItems', this.settings.maxCachedItems, vscode.ConfigurationTarget.Global);
        await config.update('cache.automaticCaching', this.settings.automaticCaching, vscode.ConfigurationTarget.Global);
    }
    
    /**
     * Önbellek istatistiklerini getirir
     */
    public getCacheStats() {
        return {
            totalCaches: this.cacheMap.size,
            enabled: this.settings.enabled,
            automaticCaching: this.settings.automaticCaching,
            defaultTtl: this.settings.defaultTtl,
            maxCachedItems: this.settings.maxCachedItems
        };
    }
} 