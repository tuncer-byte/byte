import * as vscode from 'vscode';
import { AIService } from '../../services/ai';

/**
 * Mesaj rolü tipi
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'error';

/**
 * Mesaj yapısı
 */
export interface Message {
    role: MessageRole;
    content: string;
}

/**
 * Kod içeriği ve bağlam bilgileri
 */
export interface CodeContext {
    code: string;
    fileName: string;
    languageId: string;
    lineCount: number;
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
export interface InlineCodeChatProvider extends vscode.Disposable {
    /**
     * Seçili kodu analiz eder
     */
    analyzeSelectedCode(): Promise<void>;
    
    /**
     * Seçili kod hakkında soru sorar
     */
    askQuestionAboutCode(): Promise<void>;
}

/**
 * InlineCodeChat mesaj işleyici arayüzü
 */
export interface InlineMessageHandlerProvider {
    /**
     * Mesaj işler
     */
    handleMessage(text: string, codeContext: CodeContext): Promise<void>;
} 