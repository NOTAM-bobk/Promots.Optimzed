import React, { useState, useEffect, useRef } from 'react';

// --- CONFIGURATION & SAFE ENV RETRIEVAL ---
const getApiKey = () => {
  try {
    const viteKey = import.meta.env.VITE_GROQ_API_KEY;
    if (viteKey) return viteKey;
  } catch (e) {}
  
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env.REACT_APP_GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || "";
    }
  } catch (e) {}
  
  return "";
};

const GROQ_API_KEY = getApiKey();
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_WORDS = 300;

export default function App() {
  // --- STATE MANAGEMENT ---
  const [activePage, setActivePage] = useState('home');
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [optimizedOutput, setOptimizedOutput] = useState('');
  const [history, setHistory] = useState([]);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState(new Set());
  const [toast, setToast] = useState({ show: false, message: '', isError: false });
  
  const [settings, setSettings] = useState({
    model: 'openai/gpt-oss-120b',
    style: 'Structured',
    strictness: 85
  });

  // --- REFS FOR SHORTCUTS ---
  const stateRef = useRef({ userInput, activePage, isGenerating, optimizedOutput });
  useEffect(() => {
    stateRef.current = { userInput, activePage, isGenerating, optimizedOutput };
  }, [userInput, activePage, isGenerating, optimizedOutput]);

  // --- HELPER FUNCTIONS ---
  const getWordCount = (str) => {
    const trimmed = str.trim();
    return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
  };

  const handleInputChange = (e) => {
    let text = e.target.value;
    const currentWords = getWordCount(text);
    
    if (currentWords > MAX_WORDS) {
      const wordsArray = text.trim().split(/\s+/);
      text = wordsArray.slice(0, MAX_WORDS).join(" ") + " ";
    }
    setUserInput(text);
  };

  const showToast = (message, isError = false) => {
    setToast({ show: true, message, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  const copyText = (text) => {
    try {
      const tempTextArea = document.createElement("textarea");
      tempTextArea.value = text;
      document.body.appendChild(tempTextArea);
      tempTextArea.select();
      document.execCommand("copy");
      document.body.removeChild(tempTextArea);
      showToast("Copied to Clipboard!");
    } catch (err) {
      showToast("Failed to copy.", true);
    }
  };

  // --- API LOGIC ---
  const handleOptimize = async () => {
    const { userInput, isGenerating } = stateRef.current;
    
    if (!GROQ_API_KEY) {
      showToast("API key is missing! Please add VITE_GROQ_API_KEY to your env variables.", true);
      return;
    }

    if (!userInput.trim()) {
      showToast("Please enter a basic prompt to optimize!", true);
      return;
    }
    if (isGenerating) return;

    setIsGenerating(true);
    setOptimizedOutput('');

    const systemPrompt = `You are an elite Prompt Engineer AI. The user will provide a raw, basic instruction. Your job is to rewrite it into a highly professional, structurally optimized, and highly constrained prompt template. 
    Parameters:
    - Style: ${settings.style}
    - Strictness Level: ${settings.strictness}%
    Provide ONLY the final optimized prompt text. Do not provide conversational filler, pleasantries, or meta-commentary. Use Markdown for styling the output.`;

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userInput.trim() }
          ],
          temperature: 1,
          max_tokens: 2048,
          top_p: 1
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP Status ${response.status}`);
      }

      const data = await response.json();
      const result = data.choices[0].message.content.trim();
      
      setOptimizedOutput(result);
      
      const origWords = getWordCount(userInput);
      const optWords = getWordCount(result);

      const timestampStr = new Date().toLocaleString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', hour12: true 
      });

      setHistory(prev => [{
        id: Date.now().toString(),
        timestamp: timestampStr,
        original: userInput.trim(),
        optimized: result,
        origWords,
        optWords
      }, ...prev]);

      showToast("Prompt Optimized via Groq API!");

    } catch (error) {
      console.error("Groq API Error:", error);
      setOptimizedOutput("Error connecting to AI backend. Please check your API key setup on Vercel.");
      showToast("API Connection Failed", true);
    } finally {
      setIsGenerating(false);
    }
  };

  // --- KEYBOARD SHORTCUTS ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      
      // Submit Prompt
      if (isCtrlOrCmd && e.key === 'Enter') {
        e.preventDefault();
        const state = stateRef.current;
        if (state.activePage === 'home' && !state.isGenerating) {
          handleOptimize();
        }
      }

      // Copy Optimized Output
      if (isCtrlOrCmd && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        const state = stateRef.current;
        if (state.activePage === 'home' && state.optimizedOutput) {
          copyText(state.optimizedOutput);
        }
      }
      
      // Clear Input
      if (isCtrlOrCmd && e.key === 'Backspace') {
        e.preventDefault();
        if (stateRef.current.activePage === 'home') {
          setUserInput('');
          showToast("Input Cleared");
        }
      }

      // Navigation Shortcuts
      if (isCtrlOrCmd && e.key === '1') { e.preventDefault(); setActivePage('home'); window.scrollTo(0,0); }
      if (isCtrlOrCmd && e.key === '2') { e.preventDefault(); setActivePage('history'); window.scrollTo(0,0); }
      if (isCtrlOrCmd && e.key === '3') { e.preventDefault(); setActivePage('settings'); window.scrollTo(0,0); }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- HISTORY TOGGLE ---
  const toggleHistoryItem = (id) => {
    setExpandedHistoryIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- RENDER HELPERS ---
  const inputWords = getWordCount(userInput);
  const optWords = getWordCount(optimizedOutput);

  return (
    <div className="app-wrapper">
      <style>{globalCSS}</style>

      {/* Animated Background Orbs */}
      <div className="orb orb-left"></div>
      <div className="orb orb-right"></div>

      {/* Dynamic Alert Toast */}
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.isError ? 'error' : ''}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>{toast.message}</span>
      </div>

      {/* Header / Navbar */}
      <div className="header_container">
        <div className="logo_part1">PROMPT OPTIMIZER</div>
        <div className="nav_icons">
          <a className={`icon_link ${activePage === 'home' ? 'active' : ''}`} onClick={() => { setActivePage('home'); window.scrollTo(0,0); }} title="Home (Ctrl+1)">
            <svg viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </a>
          <a className={`icon_link ${activePage === 'history' ? 'active' : ''}`} onClick={() => { setActivePage('history'); window.scrollTo(0,0); }} title="History (Ctrl+2)">
            <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l4 2"></path></svg>
          </a>
          <a className={`icon_link ${activePage === 'settings' ? 'active' : ''}`} onClick={() => { setActivePage('settings'); window.scrollTo(0,0); }} title="Settings (Ctrl+3)">
            <svg viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </a>
        </div>
      </div>

      {/* --- HOME PAGE --- */}
      <main className={`page ${activePage === 'home' ? 'active' : ''}`}>
        
        {/* NEW: Animated Hero Header */}
        <h1 className="hero-header">
          Write Better Prompts, <span className="instantly-text">instantly</span>
        </h1>

        <div className="card">
          <div className="card-header-flex">
            <h2>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              INPUT PROMPT
            </h2>
            <div className={`word-count ${inputWords >= MAX_WORDS ? 'limit-reached' : ''}`}>{inputWords} / {MAX_WORDS} words</div>
          </div>
          <textarea 
            value={userInput}
            onChange={handleInputChange}
            className="prompt-input" 
            placeholder="Type a simple prompt (e.g., 'Write a story about a brave astronaut' or 'Create a study outline of world history')..."
          />
          <div className="action-row">
            <button className="btn-optimize" onClick={handleOptimize} disabled={isGenerating} style={{ opacity: isGenerating ? 0.5 : 1 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
              {isGenerating ? 'Optimizing...' : 'Optimize'}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header-flex">
            <h2>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
              OPTIMIZED EXPERT VERSION
            </h2>
            {optimizedOutput && <div className="word-count">{optWords} words</div>}
          </div>
          
          <div className="output-container">
            {isGenerating && (
              <div className="loading-shimmer" style={{ display: 'flex' }}>
                <div className="spinner"></div>
                <span>Connecting to Groq API ({settings.model})...</span>
              </div>
            )}
            
            {!isGenerating && (
              <>
                <div className={`output-text ${!optimizedOutput ? 'output-placeholder' : ''}`}>
                  {optimizedOutput || "The AI's optimized prompt structure will output here dynamically..."}
                </div>
                
                {optimizedOutput && (
                  <div className="action-row" style={{ border: 'none', marginTop: '5px', paddingTop: 0 }}>
                    <button className="btn-copy" onClick={() => copyText(optimizedOutput)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      Copy Optimized Prompt
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* --- HISTORY PAGE --- */}
      <main className={`page ${activePage === 'history' ? 'active' : ''}`}>
        <div className="history-controls">
          <div className="history-title-section">
            <h1>Optimized History</h1>
            <p>Track, inspect, and copy your previous optimized outputs.</p>
          </div>
          <button className="btn-clear" onClick={() => { setHistory([]); showToast("Cleared Optimization Logs."); }}>Clear Logs</button>
        </div>

        <div className="history-list">
          {history.length === 0 ? (
            <div className="card no-history-state" style={{ opacity: 1, transform: 'none' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '10px', color: 'rgba(255,255,255,0.2)' }}><path d="M12 8v4l3 3"></path><circle cx="12" cy="12" r="9"></circle></svg>
              <p>No optimization logs found. Try building your first prompt on the Home screen!</p>
            </div>
          ) : (
            history.map(item => {
              const isExpanded = expandedHistoryIds.has(item.id);
              return (
                <div key={item.id} className={`history-item ${isExpanded ? 'expanded' : ''}`}>
                  <div className="history-item-header" onClick={() => toggleHistoryItem(item.id)}>
                    <div className="header-left-group">
                      <span className="chevron-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                      </span>
                      <span className="history-preview-text">{item.original}</span>
                    </div>
                    <span className="history-timestamp">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display:'inline-block', verticalAlign: 'middle', marginRight: '4px' }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                      {item.timestamp}
                    </span>
                  </div>

                  <div className="history-item-content">
                    <div className="history-subgrid">
                      <div className="prompt-box">
                        <div className="prompt-box-header">
                          <div className="prompt-box-title">Baseline Input</div>
                          <div className="prompt-box-stats">{item.origWords} Words</div>
                        </div>
                        <div className="prompt-box-content">{item.original}</div>
                      </div>
                      <div className="prompt-box" style={{ borderColor: 'rgba(211, 184, 154, 0.15)' }}>
                        <div className="prompt-box-header">
                          <div className="prompt-box-title" style={{ color: '#D3B89A' }}>Systemic Output Structure</div>
                          <div className="prompt-box-stats" style={{ color: '#D3B89A', background: 'rgba(211, 184, 154, 0.1)' }}>{item.optWords} Words</div>
                        </div>
                        <div className="prompt-box-content" style={{ color: '#e8e8e8' }}>{item.optimized}</div>
                      </div>
                    </div>
                    <div className="history-actions">
                      <button className="btn-copy" onClick={(e) => { e.stopPropagation(); copyText(item.optimized); }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copy Optimized Prompt
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>

      {/* --- SETTINGS PAGE --- */}
      <main className={`page ${activePage === 'settings' ? 'active' : ''}`}>
        <div className="history-controls">
          <div className="history-title-section">
            <h1>Optimization Settings</h1>
            <p>Configure model guidelines, formats, and systemic values.</p>
          </div>
        </div>

        <div className="card">
          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z"></path></svg>
            AI Model Engine Preferences
          </h2>
          <div className="settings-container">
            <div className="settings-row">
              <div className="settings-label"><span>Target Groq Model</span></div>
              <p className="settings-desc">Select the LLM routing you want to use for the generation via Groq API.</p>
              <select className="select-input" value={settings.model} onChange={(e) => setSettings({...settings, model: e.target.value})}>
                <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Requested Configuration)</option>
                <option value="llama3-70b-8192">llama3-70b-8192 (Groq Ultra-Fast Default)</option>
                <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (High Context Window)</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-label"><span>Optimization Framework Style</span></div>
              <p className="settings-desc font-normal">Controls how the structural system frameworks are shaped.</p>
              <select className="select-input" value={settings.style} onChange={(e) => setSettings({...settings, style: e.target.value})}>
                <option value="Structured">Role / Context / Constraints / Goal (Recommended)</option>
                <option value="Conversational">Step-by-Step Chain of Thought</option>
                <option value="Few-Shot">In-Context Learning (Adds dynamic placeholders)</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-label">
                <span>Prompt Strictness / Constraint Strength</span>
                <span className="value">{settings.strictness}%</span>
              </div>
              <p className="settings-desc">High strictness applies explicit formatting directives and rigid borders.</p>
              <input type="range" min="10" max="100" value={settings.strictness} onChange={(e) => setSettings({...settings, strictness: e.target.value})} className="slider-range" />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '24px' }}>
          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            Keyboard Shortcuts
          </h2>
          <div className="settings-container">
            <div className="settings-row" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="settings-label" style={{ display: 'block' }}>
                <span>Optimize Prompt</span>
                <p className="settings-desc" style={{ marginTop: '4px' }}>Quickly generate an optimized prompt while typing.</p>
              </div>
              <span className="shortcut-badge">Ctrl/Cmd + Enter</span>
            </div>
            <div className="settings-row" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="settings-label" style={{ display: 'block' }}>
                <span>Copy Output</span>
                <p className="settings-desc" style={{ marginTop: '4px' }}>Copy the latest generated prompt from the Home page.</p>
              </div>
              <span className="shortcut-badge">Ctrl/Cmd + Shift + C</span>
            </div>
            <div className="settings-row" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="settings-label" style={{ display: 'block' }}>
                <span>Clear Input Area</span>
                <p className="settings-desc" style={{ marginTop: '4px' }}>Instantly erase your current draft on the Home page.</p>
              </div>
              <span className="shortcut-badge">Ctrl/Cmd + Backspace</span>
            </div>
            <div className="settings-row" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'none', paddingBottom: 0 }}>
              <div className="settings-label" style={{ display: 'block' }}>
                <span>Quick Navigation</span>
                <p className="settings-desc" style={{ marginTop: '4px' }}>Switch between Home (1), History (2), and Settings (3).</p>
              </div>
              <span className="shortcut-badge">Ctrl/Cmd + 1 / 2 / 3</span>
            </div>
          </div>
        </div>
      </main>

      {/* NEW: App Footer */}
      <footer className="app-footer">
        <div className="footer-links">
          <a href="https://github.com/NOTAM-bobk/Promots.Optimzed/tree/main" target="_blank" rel="noreferrer">View Source Code</a>
          <a href="#">About</a>
          <a href="#">Prompts</a>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>
      </footer>

    </div>
  );
}

// ==========================================
// CSS STYLES (Injected directly into React)
// ==========================================
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Oswald:wght@200;300;400;500&display=swap');

  /* Fixing the white border issue across deployments */
  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    min-height: 100vh;
    background: #06070a;
  }
  
  * {
    box-sizing: border-box;
  }

  .app-wrapper {
    min-height: 100vh;
    background: #06070a; 
    overflow-x: hidden;
    font-family: 'Montserrat', sans-serif;
    color: #f0f0f0;
    user-select: none;
    display: flex;
    flex-direction: column;
  }

  /* --- ANIMATED WHITE/GOLD ORBS --- */
  .orb {
      position: fixed;
      border-radius: 50%;
      filter: blur(120px);
      z-index: 0;
      opacity: 0.25;
      pointer-events: none;
      transition: all 1s ease-in-out;
  }
  .orb-left {
      top: -150px;
      left: -150px;
      width: 550px;
      height: 550px;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.9) 0%, rgba(211, 184, 154, 0.3) 60%, rgba(0,0,0,0) 100%);
      animation: floatOrbLeft 12s infinite alternate ease-in-out;
  }
  .orb-right {
      top: -100px;
      right: -200px;
      width: 650px;
      height: 650px;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.7) 0%, rgba(140, 155, 129, 0.3) 60%, rgba(0,0,0,0) 100%);
      animation: floatOrbRight 16s infinite alternate ease-in-out;
  }
  
  @keyframes floatOrbLeft {
      0% { transform: translate(0, 0) scale(1); opacity: 0.25; }
      50% { transform: translate(60px, 40px) scale(1.15); opacity: 0.4; }
      100% { transform: translate(-20px, 80px) scale(0.9); opacity: 0.25; }
  }
  @keyframes floatOrbRight {
      0% { transform: translate(0, 0) scale(1); opacity: 0.3; }
      50% { transform: translate(-80px, 50px) scale(0.85); opacity: 0.2; }
      100% { transform: translate(30px, -30px) scale(1.1); opacity: 0.4; }
  }

  /* --- NAVIGATION BAR --- */
  .header_container {
      position: fixed;
      top: 4%;
      left: 50%;
      transform: translate(-50%, -30px);
      width: 85%;
      max-width: 850px;
      min-width: 300px;
      height: 65px;
      background-color: rgba(255, 255, 255, 0.03);
      border-radius: 50px;
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 10px 40px 0 rgba(0, 0, 0, 0.4);
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 35px;
      z-index: 1000;
      opacity: 0;
      animation: slideDownIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      animation-delay: 0.2s;
  }

  .logo_part1 {
      color: #e0e0e0;
      font-family: 'Oswald', sans-serif;
      font-size: 14px;
      font-weight: 300;
      letter-spacing: 3px;
      white-space: nowrap;
      overflow: hidden;
      border-right: 2px solid rgba(255, 255, 255, 0.75);
      width: 0;
      animation: 
          typewriter 2s steps(20) 1.2s forwards, 
          blinkCursor 0.8s infinite,
          removeCursor 0.1s forwards 3.2s; 
  }

  .nav_icons {
      display: flex;
      gap: 30px;
      align-items: center;
  }

  .icon_link {
      color: rgba(255, 255, 255, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      transition: color 0.3s cubic-bezier(0.25, 1, 0.5, 1), transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
      cursor: pointer;
      position: relative;
  }

  .icon_link:hover, .icon_link.active {
      color: #D3B89A;
      transform: translateY(-2px);
  }

  .icon_link.active::after {
      content: '';
      position: absolute;
      bottom: -8px;
      width: 12px;
      height: 2px;
      background-color: #D3B89A;
      border-radius: 10px;
      box-shadow: 0 0 8px #D3B89A;
  }

  .icon_link svg {
      width: 21px;
      height: 21px;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
  }

  @media (max-width: 520px) {
      .logo_part1 {
          display: none;
      }
      .header_container {
          justify-content: center;
      }
  }

  /* --- PAGES AND LAYOUT SYSTEM --- */
  .page {
      display: none;
      padding-top: 130px; /* Reduced slightly to fit header */
      width: 90%;
      max-width: 800px;
      margin-left: auto;
      margin-right: auto;
      z-index: 10;
      position: relative;
      flex: 1; /* Pushes footer down */
  }

  .page.active {
      display: flex;
      flex-direction: column;
      gap: 28px;
      animation: pageFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  /* --- HERO HEADER (NEW) --- */
  .hero-header {
      text-align: center;
      font-size: 2.2rem;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 10px 0;
      opacity: 0;
      animation: flyInBlur 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      letter-spacing: -0.5px;
  }

  .instantly-text {
      color: #9a9a9a;
      position: relative;
      display: inline-block;
  }

  .instantly-text::after {
      content: '';
      position: absolute;
      left: 0;
      bottom: -2px;
      width: 100%;
      height: 3px;
      background-color: #9a9a9a;
      border-radius: 2px;
      transform: scaleX(0);
      transform-origin: left;
      animation: drawUnderline 0.7s ease-out 1.2s forwards;
  }

  /* --- CARDS & PANELS --- */
  .card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 24px;
      padding: 28px;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.3);
      transition: border-color 0.4s ease, box-shadow 0.4s ease, transform 0.4s ease;
      opacity: 0;
      transform: translateY(20px);
  }

  .page.active .card {
      animation: elementFadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  .page.active .card:nth-child(2) { animation-delay: 0.15s; }
  .page.active .card:nth-child(3) { animation-delay: 0.3s; }

  .card:hover {
      border-color: rgba(255, 255, 255, 0.1);
      box-shadow: 0 20px 45px rgba(0, 0, 0, 0.4);
  }

  .card-header-flex {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
  }

  .card h2 {
      margin: 0;
      font-size: 13px;
      font-family: 'Oswald', sans-serif;
      font-weight: 400;
      letter-spacing: 2px;
      color: #b5b5b5;
      display: flex;
      align-items: center;
      gap: 10px;
  }

  .card h2 svg {
      color: #D3B89A;
  }

  /* --- WORD COUNTERS --- */
  .word-count {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.4);
      font-family: 'Montserrat', sans-serif;
      font-weight: 600;
      background: rgba(0, 0, 0, 0.3);
      padding: 5px 12px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.08);
  }
  
  .word-count.limit-reached {
      color: #f87171;
      border-color: rgba(248, 113, 113, 0.3);
  }

  /* --- FORM ELEMENTS (IMPROVED READABILITY) --- */
  .prompt-input {
      width: 100%;
      height: 120px;
      background: transparent;
      border: none;
      color: #ffffff; /* Brighter for readability */
      font-family: 'Montserrat', sans-serif;
      font-size: 16px; /* Increased font size */
      line-height: 1.6;
      resize: none;
      outline: none;
  }

  .prompt-input::placeholder {
      color: rgba(255, 255, 255, 0.3);
      transition: color 0.3s ease;
  }

  .prompt-input:focus::placeholder {
      color: rgba(255, 255, 255, 0.15);
  }

  .action-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 15px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      padding-top: 15px;
  }

  .btn-optimize {
      background: #ffffff;
      color: #06070a;
      border: none;
      padding: 12px 28px;
      border-radius: 30px;
      font-family: 'Montserrat', sans-serif;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 15px rgba(255, 255, 255, 0.15);
      margin-left: auto;
  }

  .btn-optimize:hover {
      background: #D3B89A;
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(211, 184, 154, 0.3);
  }

  .btn-optimize:active {
      transform: translateY(0);
  }

  .output-container {
      position: relative;
  }

  .output-text {
      min-height: 70px;
      color: #f0f0f0; /* Brighter for readability */
      font-size: 15.5px; /* Larger font */
      line-height: 1.7;
      white-space: pre-wrap;
      transition: color 0.3s ease;
  }

  .output-placeholder {
      color: rgba(255, 255, 255, 0.35);
      font-style: italic;
  }

  .loading-shimmer {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #D3B89A;
      font-weight: 600;
      font-size: 14px;
      padding: 20px 0;
  }

  .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(211, 184, 154, 0.2);
      border-top-color: #D3B89A;
      border-radius: 50%;
      animation: spin 0.8s infinite linear;
  }

  /* --- HISTORY VIEW UI --- */
  .history-controls {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 15px;
      margin-bottom: 5px;
  }

  .history-title-section h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      letter-spacing: 1px;
      font-family: 'Oswald', sans-serif;
      color: #ffffff;
  }

  .history-title-section p {
      margin: 4px 0 0 0;
      font-size: 13.5px;
      color: rgba(255,255,255,0.5);
  }

  .btn-clear {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.7);
      border-radius: 30px;
      padding: 8px 16px;
      font-size: 12px;
      font-family: 'Montserrat', sans-serif;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
  }

  .btn-clear:hover {
      border-color: #f87171;
      color: #f87171;
      background: rgba(248, 113, 113, 0.1);
  }

  .history-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
  }

  .history-item {
      display: flex;
      flex-direction: column;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      overflow: hidden;
      transition: border-color 0.3s ease, box-shadow 0.3s ease;
  }

  .history-item:hover {
      border-color: rgba(255, 255, 255, 0.15);
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.25);
  }

  .history-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      cursor: pointer;
      user-select: none;
      background: rgba(255, 255, 255, 0.01);
      transition: background 0.2s ease;
  }

  .history-item-header:hover {
      background: rgba(255, 255, 255, 0.04);
  }

  .header-left-group {
      display: flex;
      align-items: center;
      gap: 14px;
      overflow: hidden;
      flex: 1;
      margin-right: 15px;
  }

  .chevron-icon {
      color: rgba(255, 255, 255, 0.5);
      transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1), color 0.3s ease;
      flex-shrink: 0;
      display: flex;
      align-items: center;
  }

  .history-item.expanded .chevron-icon {
      transform: rotate(180deg);
      color: #D3B89A;
  }

  .history-preview-text {
      font-size: 14.5px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.9);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
  }

  .history-timestamp {
      font-size: 11.5px;
      color: rgba(255, 255, 255, 0.4);
      font-weight: 600;
      white-space: nowrap;
      flex-shrink: 0;
  }

  .history-item-content {
      max-height: 0;
      opacity: 0;
      visibility: hidden;
      transition: max-height 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease, padding 0.3s ease;
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.15);
  }

  .history-item.expanded .history-item-content {
      max-height: 2000px;
      opacity: 1;
      visibility: visible;
      padding: 0 24px 24px 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .history-subgrid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-top: 20px;
  }

  @media (max-width: 650px) {
      .history-subgrid {
          grid-template-columns: 1fr;
      }
  }

  .prompt-box {
      background: rgba(0, 0, 0, 0.25);
      border-radius: 12px;
      padding: 18px;
      border: 1px solid rgba(255,255,255,0.05);
      position: relative;
  }

  .prompt-box-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
  }

  .prompt-box-title {
      font-size: 11px;
      font-family: 'Oswald', sans-serif;
      letter-spacing: 1.5px;
      color: rgba(255, 255, 255, 0.5);
      text-transform: uppercase;
  }
  
  .prompt-box-stats {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.35);
      background: rgba(255,255,255,0.08);
      padding: 3px 8px;
      border-radius: 10px;
      font-weight: 600;
  }

  .prompt-box-content {
      font-size: 14.5px;
      line-height: 1.6;
      color: #e8e8e8; /* Increased readability */
      white-space: pre-wrap;
  }

  .history-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 18px;
  }

  .btn-copy {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 18px;
      border-radius: 30px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: 'Montserrat', sans-serif;
      display: flex;
      align-items: center;
      gap: 6px;
  }

  .btn-copy:hover {
      background: rgba(211, 184, 154, 0.15);
      border-color: #D3B89A;
      color: #D3B89A;
  }

  /* --- SETTINGS PAGE UI --- */
  .settings-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
  }

  .settings-row {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding-bottom: 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .settings-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
  }

  .settings-label {
      font-size: 13.5px;
      font-weight: 600;
      color: #f0f0f0;
      display: flex;
      justify-content: space-between;
  }

  .settings-label span.value {
      color: #D3B89A;
  }

  .settings-desc {
      font-size: 12.5px;
      color: rgba(255, 255, 255, 0.45);
      margin: 0;
  }

  .shortcut-badge {
      background: rgba(255,255,255,0.1);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #D3B89A;
      white-space: nowrap;
      margin-left: 15px;
  }

  .slider-range {
      -webkit-appearance: none;
      width: 100%;
      height: 6px;
      border-radius: 5px;
      background: rgba(255, 255, 255, 0.15);
      outline: none;
      margin-top: 8px;
  }

  .slider-range::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: #ffffff;
      cursor: pointer;
      transition: background 0.2s ease, transform 0.2s ease;
      border: 2px solid #06070a;
  }

  .slider-range::-webkit-slider-thumb:hover {
      background: #D3B89A;
      transform: scale(1.2);
  }

  .select-input {
      width: 100%;
      padding: 12px 14px;
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #ffffff;
      font-family: 'Montserrat', sans-serif;
      font-size: 13.5px;
      outline: none;
      cursor: pointer;
      transition: border-color 0.3s ease;
  }

  .select-input:focus {
      border-color: #D3B89A;
  }

  /* --- FOOTER (NEW) --- */
  .app-footer {
      text-align: center;
      padding: 40px 20px;
      margin-top: 40px;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
  }
  .footer-links {
      display: flex;
      justify-content: center;
      gap: 25px;
      flex-wrap: wrap;
  }
  .footer-links a {
      color: rgba(255, 255, 255, 0.35);
      text-decoration: none;
      font-size: 12.5px;
      font-weight: 500;
      transition: color 0.2s ease;
  }
  .footer-links a:hover {
      color: #D3B89A;
  }

  /* --- TOAST NOTIFICATIONS --- */
  .toast {
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translate(-50%, 50px);
      background: rgba(140, 155, 129, 0.95);
      color: #06070a;
      padding: 12px 24px;
      border-radius: 40px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      z-index: 2000;
      display: flex;
      align-items: center;
      gap: 10px;
      opacity: 0;
      pointer-events: none;
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }

  .toast.error {
      background: rgba(248, 113, 113, 0.95);
  }

  .toast.show {
      transform: translate(-50%, 0);
      opacity: 1;
  }

  /* --- KEYFRAMES --- */
  @keyframes slideDownIn { to { opacity: 1; transform: translate(-50%, 0); } }
  @keyframes typewriter { to { width: 180px; } }
  @keyframes blinkCursor { from, to { border-color: transparent } 50% { border-color: rgba(255, 255, 255, 0.75); } }
  @keyframes removeCursor { to { border-right: 2px solid transparent; } }
  @keyframes pageFadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes elementFadeUp { to { opacity: 1; transform: translateY(0); } }
  @keyframes flyInBlur {
    0% { transform: translateY(-30px); filter: blur(10px); opacity: 0; }
    100% { transform: translateY(0); filter: blur(0); opacity: 1; }
  }
  @keyframes drawUnderline { to { transform: scaleX(1); } }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
