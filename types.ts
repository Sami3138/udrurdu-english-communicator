
export enum Sender {
  USER = 'user',
  AI = 'ai'
}

export interface Message {
  id: string;
  text: string;
  originalText?: string;
  sender: Sender;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface Settings {
  darkMode: boolean;
  voiceEnabled: boolean;
  preferredVoice: 'en-US' | 'ur-PK';
  animationsEnabled: boolean;
}

export interface SpeechState {
  isListening: boolean;
  error: string | null;
}
