import * as vscode from 'vscode';
import { AIService } from '../../services/ai';

/**
 * Mesaj rolü tipi
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * Mesaj yapısı
 */
export interface Message {
    role: MessageRole;
    content: string;
}

/**
 * InlineCodeChat seçenekleri
 */
export interface InlineCodeChatOptions {
    code: string;
    fileName: string;
    languageId: string;
    title?: string;
}

/**
 * InlineCodeChat panel durumu
 */
export interface InlineCodeChatState {
    isProcessing: boolean;
    lastSelectedCode: string;
    lastFileName: string;
    lastLanguageId: string;
    messageHistory: Message[];
}

/**
 * InlineCodeChat sağlayıcısı arabirimi
 */
export interface InlineCodeChatProvider {
    /**
     * Seçili kodu analiz eder
     */
    analyzeSelectedCode(): Promise<void>;
    
    /**
     * Seçili kod hakkında soru sorma
     */
    askQuestionAboutCode(): Promise<void>;
    
    /**
     * Kaynakları temizler
     */
    dispose(): void;
} 