
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import ChatMessage from './components/ChatMessage';
import ChatInput from './components/ChatInput';
import SettingsModal from './components/SettingsModal';
import HistorySidebar from './components/HistorySidebar';
import { Message, Sender, Settings, ChatSession } from './types';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from './constants';
import { translateText } from './services/geminiService';
import { useSpeech } from './hooks/useSpeech';

const SESSIONS_STORAGE_KEY = 'urdu_eng_sessions';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { isListening, error: speechError, startListening, stopListening, speak } = useSpeech();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Computed: current active messages
  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  // Initial Data Load
  useEffect(() => {
    // Load Settings
    const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (savedSettings) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
      } catch (e) { console.error(e); }
    }

    // Load Sessions
    const savedSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        if (parsed && parsed.length > 0) {
          setSessions(parsed);
          setCurrentSessionId(parsed[0].id);
        } else {
          createNewSession();
        }
      } catch (e) { 
        console.error("Error loading sessions:", e);
        createNewSession();
      }
    } else {
      createNewSession();
    }
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  useEffect(() => {
    if (sessions.length >= 0) {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
    }
    // Only scroll to bottom if the last message is new
    scrollToBottom();
  }, [sessions]);

  const createNewSession = useCallback(() => {
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
  }, []);

  const scrollToBottom = () => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const addMessageToCurrentSession = useCallback((text: string, sender: Sender, originalText?: string) => {
    setSessions(prev => prev.map(session => {
      if (session.id === currentSessionId) {
        const newMessage: Message = {
          id: Date.now().toString(),
          text,
          originalText,
          sender,
          timestamp: Date.now(),
        };
        const updatedMessages = [...session.messages, newMessage];
        
        let newTitle = session.title;
        if (session.messages.length === 0 && sender === Sender.USER) {
          newTitle = text.length > 30 ? text.substring(0, 30) + "..." : text;
        }

        return {
          ...session,
          messages: updatedMessages,
          title: newTitle,
          updatedAt: Date.now()
        };
      }
      return session;
    }));
  }, [currentSessionId]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    addMessageToCurrentSession(text, Sender.USER);
    setIsLoading(true);

    try {
      const translated = await translateText(text);
      addMessageToCurrentSession(translated, Sender.AI, text);

      if (settings.voiceEnabled) {
        const isUrdu = /[\u0600-\u06FF]/.test(translated);
        speak(translated, isUrdu ? 'ur-PK' : 'en-US');
      }
    } catch (error) {
      console.error(error);
      addMessageToCurrentSession("Error processing request. Please check your internet connection.", Sender.AI);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteSession = (id: string) => {
    if (window.confirm("Delete this conversation?")) {
      setSessions(prev => {
        const remaining = prev.filter(s => s.id !== id);
        if (currentSessionId === id) {
          if (remaining.length > 0) {
            setCurrentSessionId(remaining[0].id);
          } else {
            const newId = Date.now().toString();
            const empty = [{
              id: newId,
              title: 'New Conversation',
              messages: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
            }];
            setCurrentSessionId(newId);
            return empty;
          }
        }
        return remaining;
      });
    }
  };

  const clearHistory = () => {
    if (window.confirm("Clear ALL chat history?")) {
      localStorage.removeItem(SESSIONS_STORAGE_KEY);
      setSessions([]);
      createNewSession();
      setIsSettingsOpen(false);
    }
  };

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${settings.darkMode ? 'dark bg-slate-900' : 'bg-slate-50'}`}>
      <Header 
        onOpenSettings={() => setIsSettingsOpen(true)} 
        onToggleHistory={() => setIsHistoryOpen(true)}
        onNewChat={createNewSession}
        isDarkMode={settings.darkMode} 
      />

      <div className="flex flex-grow overflow-hidden relative">
        <HistorySidebar 
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={(id) => {
            setCurrentSessionId(id);
            setIsHistoryOpen(false);
          }}
          onDeleteSession={deleteSession}
        />

        {/* This main area is the scrollable container */}
        <main className="flex-grow overflow-y-auto transition-colors p-4 flex flex-col scroll-smooth">
          <div className="max-w-4xl mx-auto w-full min-h-full flex flex-col">
            {/* 
                This flex-grow div acts as a spacer. 
                When there are few messages, it takes up the space at the top.
                When there are many, it shrinks to 0 and allows natural scrolling.
            */}
            <div className="flex-grow" />
            
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 my-auto">
                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl flex items-center justify-center text-indigo-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">Ready to Translate</h3>
                <p className="text-slate-400 text-sm max-w-xs">Start typing or use the microphone to speak in Urdu.</p>
              </div>
            ) : (
              <div className="flex flex-col pt-4">
                {messages.map((msg) => (
                  <ChatMessage 
                    key={msg.id} 
                    message={msg} 
                    animationsEnabled={settings.animationsEnabled} 
                  />
                ))}
              </div>
            )}
            <div ref={chatEndRef} className="h-4 w-full flex-shrink-0" />
          </div>
        </main>
      </div>

      <ChatInput 
        onSendMessage={handleSendMessage}
        onStartVoice={() => startListening(handleSendMessage)}
        onStopVoice={stopListening}
        isListening={isListening}
        isLoading={isLoading}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        updateSettings={(ns) => setSettings(prev => ({ ...prev, ...ns }))}
        onClearHistory={clearHistory}
        messages={messages}
      />

      {speechError && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold z-50 animate-bounce">
          {speechError}
        </div>
      )}
    </div>
  );
};

export default App;
