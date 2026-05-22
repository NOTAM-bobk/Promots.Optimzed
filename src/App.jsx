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

// ── PRODUCTION-GRADE SYSTEM PROMPT ──────────────────────────────────────────
const buildSystemPrompt = (style, strictness) => `
You are a world-class Prompt Architect — a specialist who transforms vague user instructions into precision-engineered prompts used by Fortune 500 AI teams and leading researchers. Your rewrites are deployed in production systems that demand zero ambiguity, maximal model compliance, and consistently elite output.

## YOUR OBJECTIVE
Transform the user's raw input into a fully structured, production-ready prompt using the "${style}" framework at ${strictness}% constraint strength.

## FRAMEWORK SPECIFICATIONS

### "Structured" → Role / Context / Task / Constraints / Output Format
- Open with a clear ROLE declaration that primes the model's persona and expertise level
- Provide rich CONTEXT: domain, audience, tone register, and any implicit assumptions made explicit
- State the TASK with surgical precision — one primary directive, zero ambiguity
- List hard CONSTRAINTS (what to include, what to exclude, length, format, style, language level)
- Define the exact OUTPUT FORMAT the model should produce (sections, length, structure, examples if needed)

### "Conversational" → Chain-of-Thought Scaffolding
- Instruct the model to reason step-by-step before producing any output
- Break the task into numbered reasoning phases
- Include explicit checkpoints ("Before answering, verify that…")
- End with a synthesis directive to consolidate the chain into a final answer

### "Few-Shot" → In-Context Learning with Dynamic Placeholders
- Include 2–3 concise input→output example pairs that demonstrate the desired pattern
- Use [PLACEHOLDER] tokens to mark dynamic injection points
- Make the pattern and variance between examples instructive, not redundant
- End with the actual task formatted to match the demonstrated pattern

## CONSTRAINT CALIBRATION (${strictness}% strictness)
${strictness >= 80
  ? '- Apply maximum constraint density: explicit DO and DO NOT directives, hard word/section limits, format mandates, and failure conditions'
  : strictness >= 50
  ? '- Apply moderate constraints: clear boundaries with room for model judgment on stylistic choices'
  : '- Apply light-touch guidance: directional constraints only, preserve model creative latitude'}

## OUTPUT RULES (NON-NEGOTIABLE)
- Output ONLY the final optimized prompt — no preamble, no meta-commentary, no explanation
- Use clean Markdown: headers (##), bold (**key terms**), bullet lists for constraints, code blocks for format specs
- Every line must earn its place — cut filler, maximize signal density
- The prompt must be self-contained: a model with zero prior context should execute it flawlessly
- Aim for the quality bar of prompts used in OpenAI's system cards and Anthropic's red-teaming evaluations
`.trim();

export default function App() {
  // --- STATE ---
  const [activePage, setActivePage] = useState('home');
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [optimizedOutput, setOptimizedOutput] = useState('');
  const [history, setHistory] = useState([]);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState(new Set());
  const [toast, setToast] = useState({ show: false, message: '', isError: false });
  const [inputFocused, setInputFocused] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  const [settings, setSettings] = useState({
    model: 'openai/gpt-oss-120b',
    style: 'Structured',
    strictness: 85
  });

  const stateRef = useRef({ userInput, activePage, isGenerating, optimizedOutput });
  useEffect(() => {
    stateRef.current = { userInput, activePage, isGenerating, optimizedOutput };
  }, [userInput, activePage, isGenerating, optimizedOutput]);

  // Loading steps cycle
  const loadingSteps = [
    { label: 'Analyzing prompt structure...', icon: '⟳' },
    { label: 'Engineering constraints...', icon: '◈' },
    { label: 'Calibrating output format...', icon: '◎' },
    { label: 'Finalizing expert prompt...', icon: '✦' },
  ];

  useEffect(() => {
    let interval;
    if (isGenerating) {
      setLoadingStep(0);
      interval = setInterval(() => {
        setLoadingStep(prev => (prev + 1) % loadingSteps.length);
      }, 900);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  // --- HELPERS ---
  const getWordCount = (str) => {
    const trimmed = str.trim();
    return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
  };

  const handleInputChange = (e) => {
    let text = e.target.value;
    if (getWordCount(text) > MAX_WORDS) {
      text = text.trim().split(/\s+/).slice(0, MAX_WORDS).join(" ") + " ";
    }
    setUserInput(text);
  };

  const showToast = (message, isError = false) => {
    setToast({ show: true, message, isError });
    setTimeout(() => setToast({ show: false, message: '', isError: false }), 3000);
  };

  const copyText = (text) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      showToast("Copied to Clipboard!");
    } catch {
      showToast("Failed to copy.", true);
    }
  };

  // --- API ---
  const handleOptimize = async () => {
    const { userInput, isGenerating } = stateRef.current;
    if (!GROQ_API_KEY) { showToast("API key missing! Add VITE_GROQ_API_KEY to Vercel env.", true); return; }
    if (!userInput.trim()) { showToast("Please enter a prompt to optimize!", true); return; }
    if (isGenerating) return;

    setIsGenerating(true);
    setOptimizedOutput('');

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: "system", content: buildSystemPrompt(settings.style, settings.strictness) },
            { role: "user", content: userInput.trim() }
          ],
          temperature: 0.7,
          max_tokens: 2048,
          top_p: 1
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || `HTTP ${response.status}`);
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

      showToast("Prompt Optimized!");
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
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'Enter') { e.preventDefault(); if (stateRef.current.activePage === 'home' && !stateRef.current.isGenerating) handleOptimize(); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); if (stateRef.current.activePage === 'home' && stateRef.current.optimizedOutput) copyText(stateRef.current.optimizedOutput); }
      if (mod && e.key === 'Backspace') { e.preventDefault(); if (stateRef.current.activePage === 'home') { setUserInput(''); showToast("Input Cleared"); } }
      if (mod && e.key === '1') { e.preventDefault(); setActivePage('home'); window.scrollTo(0,0); }
      if (mod && e.key === '2') { e.preventDefault(); setActivePage('history'); window.scrollTo(0,0); }
      if (mod && e.key === '3') { e.preventDefault(); setActivePage('settings'); window.scrollTo(0,0); }
      if (mod && e.key === '4') { e.preventDefault(); setActivePage('blog'); window.scrollTo(0,0); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleHistoryItem = (id) => {
    setExpandedHistoryIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const inputWords = getWordCount(userInput);
  const optWords = getWordCount(optimizedOutput);

  return (
    <div className="app-wrapper">
      <style>{globalCSS}</style>

      {/* Background Orbs */}
      <div className="orb orb-left"></div>
      <div className="orb orb-right"></div>
      <div className="orb orb-bottom-left"></div>

      {/* Toast */}
      <div className={`toast ${toast.show ? 'show' : ''} ${toast.isError ? 'error' : ''}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>{toast.message}</span>
      </div>

      {/* Navbar */}
      <div className="header_container">
        <div className="logo_part1">PROMPT OPTIMIZER</div>
        <div className="nav_icons">
          <a className={`icon_link ${activePage === 'home' ? 'active' : ''}`} onClick={() => { setActivePage('home'); window.scrollTo(0,0); }} title="Home (Ctrl+1)">
            <svg viewBox="0 0 24 24"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          </a>
          <a className={`icon_link ${activePage === 'history' ? 'active' : ''}`} onClick={() => { setActivePage('history'); window.scrollTo(0,0); }} title="History (Ctrl+2)">
            <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M12 7v5l4 2"></path></svg>
          </a>
          {/* Blog Icon */}
          <a className={`icon_link ${activePage === 'blog' ? 'active' : ''}`} onClick={() => { setActivePage('blog'); window.scrollTo(0,0); }} title="Blog (Ctrl+4)">
            <svg viewBox="0 0 24 24"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          </a>
          <a className={`icon_link ${activePage === 'settings' ? 'active' : ''}`} onClick={() => { setActivePage('settings'); window.scrollTo(0,0); }} title="Settings (Ctrl+3)">
            <svg viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </a>
        </div>
      </div>

      {/* ── HOME PAGE ── */}
      <main className={`page ${activePage === 'home' ? 'active' : ''}`}>

        {/* Sequenced word-blur hero */}
        <h1 className="hero-header" aria-label="Write Better Prompts, instantly">
          <span className="hero-word" style={{ animationDelay: '0.1s' }}>Write</span>
          {' '}
          <span className="hero-word" style={{ animationDelay: '0.25s' }}>Better</span>
          {' '}
          <span className="hero-word" style={{ animationDelay: '0.4s' }}>Prompts,</span>
          {' '}
          <span className="hero-word instantly-text" style={{ animationDelay: '0.58s' }}>
            instantly
            <span className="underline-bar"></span>
          </span>
        </h1>

        {/* Input Card */}
        <div className="card">
          <div className="card-header-flex">
            <h2>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              INPUT PROMPT
            </h2>
            <div className={`word-count ${inputWords >= MAX_WORDS ? 'limit-reached' : ''}`}>{inputWords} / {MAX_WORDS} words</div>
          </div>

          {/* Focused ring wrapper */}
          <div className={`textarea-ring-wrapper ${inputFocused ? 'focused' : ''}`}>
            <textarea
              value={userInput}
              onChange={handleInputChange}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              className="prompt-input"
              placeholder="Type a simple prompt (e.g., 'Write a story about a brave astronaut' or 'Create a study outline of world history')..."
            />
          </div>

          <div className="action-row">
            <button className="btn-optimize" onClick={handleOptimize} disabled={isGenerating} style={{ opacity: isGenerating ? 0.55 : 1 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
              {isGenerating ? 'Optimizing...' : 'Optimize'}
            </button>
          </div>
        </div>

        {/* Output Card */}
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
              <div className="loading-panel">
                {/* Animated rings */}
                <div className="loading-rings">
                  <div className="ring ring-1"></div>
                  <div className="ring ring-2"></div>
                  <div className="ring ring-3"></div>
                  <div className="ring-core">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D3B89A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                  </div>
                </div>
                <div className="loading-text-block">
                  <div className="loading-step-label" key={loadingStep}>
                    {loadingSteps[loadingStep].label}
                  </div>
                  <div className="loading-progress-bar">
                    <div className="loading-progress-fill"></div>
                  </div>
                  <div className="loading-model-tag">via {settings.model}</div>
                </div>
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

      {/* ── HISTORY PAGE ── */}
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

      {/* ── BLOG PAGE ── */}
      <main className={`page ${activePage === 'blog' ? 'active' : ''}`}>
        <div className="history-controls">
          <div className="history-title-section">
            <h1>The Prompt Lab</h1>
            <p>Insights, guides, and research on the art of prompt engineering.</p>
          </div>
        </div>

        <div className="blog-coming-soon card" style={{ opacity: 1, transform: 'none', textAlign: 'center', padding: '60px 28px' }}>
          <div className="blog-icon-wrap">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#D3B89A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          </div>
          <h2 style={{ color: '#fff', fontSize: '20px', fontFamily: "'Oswald', sans-serif", letterSpacing: '2px', fontWeight: 400, margin: '18px 0 10px' }}>CONTENT COMING SOON</h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', maxWidth: '360px', margin: '0 auto', lineHeight: 1.7 }}>
            We're crafting guides on advanced prompt patterns, model-specific techniques, and real-world use cases. Check back soon.
          </p>
        </div>
      </main>

      {/* ── SETTINGS PAGE ── */}
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
              <p className="settings-desc">Select the LLM routing you want to use for generation via Groq API.</p>
              <select className="select-input" value={settings.model} onChange={(e) => setSettings({...settings, model: e.target.value})}>
                <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Requested Configuration)</option>
                <option value="llama3-70b-8192">llama3-70b-8192 (Groq Ultra-Fast Default)</option>
                <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (High Context Window)</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-label"><span>Optimization Framework Style</span></div>
              <p className="settings-desc">Controls how the structural system frameworks are shaped.</p>
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
              <p className="settings-desc">High strictness applies explicit formatting directives and rigid constraint borders.</p>
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
            {[
              { label: 'Optimize Prompt', desc: 'Quickly generate an optimized prompt while typing.', key: 'Ctrl/Cmd + Enter' },
              { label: 'Copy Output', desc: 'Copy the latest generated prompt from the Home page.', key: 'Ctrl/Cmd + Shift + C' },
              { label: 'Clear Input Area', desc: 'Instantly erase your current draft on the Home page.', key: 'Ctrl/Cmd + Backspace' },
              { label: 'Quick Navigation', desc: 'Switch between Home (1), History (2), Blog (4), Settings (3).', key: 'Ctrl/Cmd + 1–4' },
            ].map((s, i, arr) => (
              <div key={s.label} className="settings-row" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...(i === arr.length - 1 ? { borderBottom: 'none', paddingBottom: 0 } : {}) }}>
                <div className="settings-label" style={{ display: 'block' }}>
                  <span>{s.label}</span>
                  <p className="settings-desc" style={{ marginTop: '4px' }}>{s.desc}</p>
                </div>
                <span className="shortcut-badge">{s.key}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-links">
          <a href="https://github.com/NOTAM-bobk/Promots.Optimzed/tree/main" target="_blank" rel="noreferrer">View Source Code</a>
          <a onClick={() => { setActivePage('blog'); window.scrollTo(0,0); }} style={{ cursor: 'pointer' }}>Blog</a>
          <a href="#">About</a>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>
      </footer>
    </div>
  );
}

// ── CSS ───────────────────────────────────────────────────────────────────────
const globalCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Oswald:wght@200;300;400;500&display=swap');

  html, body {
    margin: 0;
    padding: 0;
    width: 100%;
    min-height: 100vh;
    background: #06070a;
  }

  * { box-sizing: border-box; }

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

  /* ── ORBS ── */
  .orb {
    position: fixed;
    border-radius: 50%;
    filter: blur(120px);
    z-index: 0;
    opacity: 0.25;
    pointer-events: none;
  }
  .orb-left {
    top: -150px; left: -150px;
    width: 550px; height: 550px;
    background: radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(211,184,154,0.3) 60%, transparent 100%);
    animation: floatOrbLeft 12s infinite alternate ease-in-out;
  }
  .orb-right {
    top: -100px; right: -200px;
    width: 650px; height: 650px;
    background: radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(140,155,129,0.3) 60%, transparent 100%);
    animation: floatOrbRight 16s infinite alternate ease-in-out;
  }
  /* NEW: bottom-left white orb */
  .orb-bottom-left {
    bottom: -180px; left: -180px;
    width: 500px; height: 500px;
    opacity: 0.18;
    background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(220,220,255,0.4) 55%, transparent 100%);
    animation: floatOrbBottomLeft 14s infinite alternate ease-in-out;
  }

  @keyframes floatOrbLeft {
    0%   { transform: translate(0,0) scale(1); opacity: 0.25; }
    50%  { transform: translate(60px,40px) scale(1.15); opacity: 0.4; }
    100% { transform: translate(-20px,80px) scale(0.9); opacity: 0.25; }
  }
  @keyframes floatOrbRight {
    0%   { transform: translate(0,0) scale(1); opacity: 0.3; }
    50%  { transform: translate(-80px,50px) scale(0.85); opacity: 0.2; }
    100% { transform: translate(30px,-30px) scale(1.1); opacity: 0.4; }
  }
  @keyframes floatOrbBottomLeft {
    0%   { transform: translate(0,0) scale(1); opacity: 0.18; }
    50%  { transform: translate(50px,-40px) scale(1.1); opacity: 0.28; }
    100% { transform: translate(-30px,20px) scale(0.92); opacity: 0.15; }
  }

  /* ── NAVBAR ── */
  .header_container {
    position: fixed;
    top: 4%;
    left: 50%;
    transform: translate(-50%, -30px);
    width: 85%;
    max-width: 850px;
    min-width: 300px;
    height: 65px;
    background-color: rgba(255,255,255,0.03);
    border-radius: 50px;
    backdrop-filter: blur(25px);
    -webkit-backdrop-filter: blur(25px);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow: 0 10px 40px 0 rgba(0,0,0,0.4);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 35px;
    z-index: 1000;
    opacity: 0;
    animation: slideDownIn 1s cubic-bezier(0.16,1,0.3,1) forwards;
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
    border-right: 2px solid rgba(255,255,255,0.75);
    width: 0;
    animation:
      typewriter 2s steps(20) 1.2s forwards,
      blinkCursor 0.8s infinite,
      removeCursor 0.1s forwards 3.2s;
  }

  .nav_icons { display: flex; gap: 28px; align-items: center; }

  .icon_link {
    color: rgba(255,255,255,0.5);
    display: flex; align-items: center; justify-content: center;
    text-decoration: none;
    transition: color 0.3s ease, transform 0.3s ease;
    cursor: pointer;
    position: relative;
  }
  .icon_link:hover, .icon_link.active { color: #D3B89A; transform: translateY(-2px); }
  .icon_link.active::after {
    content: '';
    position: absolute;
    bottom: -8px;
    width: 12px; height: 2px;
    background-color: #D3B89A;
    border-radius: 10px;
    box-shadow: 0 0 8px #D3B89A;
  }
  .icon_link svg { width: 21px; height: 21px; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; fill: none; }

  @media (max-width: 520px) {
    .logo_part1 { display: none; }
    .header_container { justify-content: center; }
  }

  /* ── PAGES ── */
  .page {
    display: none;
    padding-top: 130px;
    width: 90%;
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
    z-index: 10;
    position: relative;
    flex: 1;
  }
  .page.active {
    display: flex;
    flex-direction: column;
    gap: 28px;
    animation: pageFadeUp 0.8s cubic-bezier(0.16,1,0.3,1) forwards;
  }

  /* ── HERO: SEQUENCED WORD BLUR-IN ── */
  .hero-header {
    text-align: center;
    font-size: 2.2rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 10px;
    letter-spacing: -0.5px;
    line-height: 1.3;
  }

  .hero-word {
    display: inline-block;
    opacity: 0;
    filter: blur(12px);
    transform: translateY(-14px);
    animation: wordReveal 0.65s cubic-bezier(0.16,1,0.3,1) forwards;
  }

  .instantly-text {
    color: #9a9a9a;
    position: relative;
  }

  .underline-bar {
    position: absolute;
    left: 0; bottom: -3px;
    width: 100%; height: 3px;
    background: #9a9a9a;
    border-radius: 2px;
    transform: scaleX(0);
    transform-origin: left;
    animation: drawUnderline 0.6s ease-out 1.3s forwards;
  }

  @keyframes wordReveal {
    0%   { opacity: 0; filter: blur(12px); transform: translateY(-14px); }
    60%  { filter: blur(2px); }
    100% { opacity: 1; filter: blur(0); transform: translateY(0); }
  }

  /* ── CARDS ── */
  .card {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 24px;
    padding: 28px;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 15px 35px rgba(0,0,0,0.3);
    transition: border-color 0.4s ease, box-shadow 0.4s ease;
    opacity: 0;
    transform: translateY(20px);
  }
  .page.active .card { animation: elementFadeUp 0.8s cubic-bezier(0.16,1,0.3,1) forwards; }
  .page.active .card:nth-child(2) { animation-delay: 0.15s; }
  .page.active .card:nth-child(3) { animation-delay: 0.3s; }
  .card:hover { border-color: rgba(255,255,255,0.1); box-shadow: 0 20px 45px rgba(0,0,0,0.4); }

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
  .card h2 svg { color: #D3B89A; }

  .word-count {
    font-size: 11px;
    color: rgba(255,255,255,0.4);
    font-weight: 600;
    background: rgba(0,0,0,0.3);
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.08);
  }
  .word-count.limit-reached { color: #f87171; border-color: rgba(248,113,113,0.3); }

  /* ── TEXTAREA RING LIGHTING ── */
  .textarea-ring-wrapper {
    position: relative;
    border-radius: 14px;
    transition: box-shadow 0.35s ease;
  }
  .textarea-ring-wrapper.focused {
    box-shadow:
      0 0 0 1.5px rgba(211,184,154,0.55),
      0 0 16px 2px rgba(211,184,154,0.18),
      0 0 40px 6px rgba(211,184,154,0.08);
  }
  .textarea-ring-wrapper.focused::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: 15px;
    padding: 1.5px;
    background: linear-gradient(135deg, rgba(211,184,154,0.7), rgba(140,155,129,0.4), rgba(255,255,255,0.2), rgba(211,184,154,0.5));
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: destination-out;
    mask-composite: exclude;
    pointer-events: none;
    animation: ringRotate 3s linear infinite;
  }

  @keyframes ringRotate {
    0%   { background-position: 0% 50%; }
    100% { background-position: 200% 50%; }
  }

  .prompt-input {
    width: 100%;
    height: 120px;
    background: transparent;
    border: none;
    color: #ffffff;
    font-family: 'Montserrat', sans-serif;
    font-size: 16px;
    line-height: 1.6;
    resize: none;
    outline: none;
    display: block;
  }
  .prompt-input::placeholder { color: rgba(255,255,255,0.3); transition: color 0.3s ease; }
  .prompt-input:focus::placeholder { color: rgba(255,255,255,0.15); }

  .action-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 15px;
    border-top: 1px solid rgba(255,255,255,0.06);
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
    transition: all 0.3s cubic-bezier(0.25,1,0.5,1);
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 15px rgba(255,255,255,0.15);
    margin-left: auto;
  }
  .btn-optimize:hover { background: #D3B89A; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(211,184,154,0.3); }
  .btn-optimize:active { transform: translateY(0); }

  /* ── LOADING PANEL (REDESIGNED) ── */
  .loading-panel {
    display: flex;
    align-items: center;
    gap: 28px;
    padding: 24px 0 20px;
  }

  .loading-rings {
    position: relative;
    width: 56px;
    height: 56px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ring {
    position: absolute;
    border-radius: 50%;
    border: 1.5px solid transparent;
    animation: spinRing linear infinite;
  }
  .ring-1 {
    width: 56px; height: 56px;
    border-top-color: rgba(211,184,154,0.9);
    border-right-color: rgba(211,184,154,0.3);
    animation-duration: 1.1s;
  }
  .ring-2 {
    width: 40px; height: 40px;
    border-top-color: rgba(255,255,255,0.5);
    border-left-color: rgba(255,255,255,0.2);
    animation-duration: 0.8s;
    animation-direction: reverse;
  }
  .ring-3 {
    width: 26px; height: 26px;
    border-top-color: rgba(140,155,129,0.8);
    animation-duration: 1.5s;
  }
  .ring-core {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulseCoreIcon 1.2s ease-in-out infinite;
  }

  .loading-text-block {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .loading-step-label {
    font-size: 13.5px;
    font-weight: 600;
    color: #D3B89A;
    letter-spacing: 0.3px;
    animation: stepFadeIn 0.35s ease forwards;
  }

  .loading-progress-bar {
    width: 100%;
    height: 3px;
    background: rgba(255,255,255,0.08);
    border-radius: 4px;
    overflow: hidden;
  }
  .loading-progress-fill {
    height: 100%;
    width: 0%;
    background: linear-gradient(90deg, rgba(211,184,154,0.6), #D3B89A, rgba(255,255,255,0.8));
    border-radius: 4px;
    animation: progressSweep 3.6s ease-in-out infinite;
  }

  .loading-model-tag {
    font-size: 11px;
    color: rgba(255,255,255,0.3);
    font-weight: 500;
  }

  @keyframes spinRing { to { transform: rotate(360deg); } }
  @keyframes pulseCoreIcon {
    0%, 100% { opacity: 0.7; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.15); }
  }
  @keyframes stepFadeIn {
    from { opacity: 0; transform: translateX(-6px); }
    to   { opacity: 1; transform: translateX(0); }
  }
  @keyframes progressSweep {
    0%   { width: 0%; opacity: 1; }
    70%  { width: 85%; opacity: 1; }
    90%  { width: 92%; opacity: 0.7; }
    100% { width: 98%; opacity: 0.5; }
  }

  /* ── OUTPUT ── */
  .output-container { position: relative; }
  .output-text {
    min-height: 70px;
    color: #f0f0f0;
    font-size: 15.5px;
    line-height: 1.7;
    white-space: pre-wrap;
  }
  .output-placeholder { color: rgba(255,255,255,0.35); font-style: italic; }

  /* ── HISTORY ── */
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
  .history-title-section p { margin: 4px 0 0; font-size: 13.5px; color: rgba(255,255,255,0.5); }

  .btn-clear {
    background: transparent;
    border: 1px solid rgba(255,255,255,0.2);
    color: rgba(255,255,255,0.7);
    border-radius: 30px;
    padding: 8px 16px;
    font-size: 12px;
    font-family: 'Montserrat', sans-serif;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
  }
  .btn-clear:hover { border-color: #f87171; color: #f87171; background: rgba(248,113,113,0.1); }

  .history-list { display: flex; flex-direction: column; gap: 16px; }

  .history-item {
    display: flex;
    flex-direction: column;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 20px;
    overflow: hidden;
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
  }
  .history-item:hover { border-color: rgba(255,255,255,0.15); box-shadow: 0 10px 25px rgba(0,0,0,0.25); }

  .history-item-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    cursor: pointer;
    user-select: none;
    background: rgba(255,255,255,0.01);
    transition: background 0.2s ease;
  }
  .history-item-header:hover { background: rgba(255,255,255,0.04); }

  .header-left-group {
    display: flex;
    align-items: center;
    gap: 14px;
    overflow: hidden;
    flex: 1;
    margin-right: 15px;
  }

  .chevron-icon {
    color: rgba(255,255,255,0.5);
    transition: transform 0.3s cubic-bezier(0.25,1,0.5,1), color 0.3s ease;
    flex-shrink: 0;
    display: flex; align-items: center;
  }
  .history-item.expanded .chevron-icon { transform: rotate(180deg); color: #D3B89A; }

  .history-preview-text {
    font-size: 14.5px;
    font-weight: 500;
    color: rgba(255,255,255,0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .history-timestamp { font-size: 11.5px; color: rgba(255,255,255,0.4); font-weight: 600; white-space: nowrap; flex-shrink: 0; }

  .history-item-content {
    max-height: 0;
    opacity: 0;
    visibility: hidden;
    transition: max-height 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease, padding 0.3s ease;
    box-sizing: border-box;
    background: rgba(0,0,0,0.15);
  }
  .history-item.expanded .history-item-content {
    max-height: 2000px;
    opacity: 1;
    visibility: visible;
    padding: 0 24px 24px;
    border-top: 1px solid rgba(255,255,255,0.06);
  }

  .history-subgrid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    margin-top: 20px;
  }
  @media (max-width: 650px) { .history-subgrid { grid-template-columns: 1fr; } }

  .prompt-box {
    background: rgba(0,0,0,0.25);
    border-radius: 12px;
    padding: 18px;
    border: 1px solid rgba(255,255,255,0.05);
  }
  .prompt-box-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .prompt-box-title { font-size: 11px; font-family: 'Oswald', sans-serif; letter-spacing: 1.5px; color: rgba(255,255,255,0.5); text-transform: uppercase; }
  .prompt-box-stats { font-size: 10px; color: rgba(255,255,255,0.35); background: rgba(255,255,255,0.08); padding: 3px 8px; border-radius: 10px; font-weight: 600; }
  .prompt-box-content { font-size: 14.5px; line-height: 1.6; color: #e8e8e8; white-space: pre-wrap; }

  .history-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; }

  .btn-copy {
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.15);
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
  .btn-copy:hover { background: rgba(211,184,154,0.15); border-color: #D3B89A; color: #D3B89A; }

  /* ── SETTINGS ── */
  .settings-container { display: flex; flex-direction: column; gap: 24px; }
  .settings-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-bottom: 20px;
    border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .settings-row:last-child { border-bottom: none; padding-bottom: 0; }
  .settings-label { font-size: 13.5px; font-weight: 600; color: #f0f0f0; display: flex; justify-content: space-between; }
  .settings-label span.value { color: #D3B89A; }
  .settings-desc { font-size: 12.5px; color: rgba(255,255,255,0.45); margin: 0; }

  .shortcut-badge {
    background: rgba(255,255,255,0.1);
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    color: #D3B89A;
    white-space: nowrap;
    margin-left: 15px;
    flex-shrink: 0;
  }

  .slider-range {
    -webkit-appearance: none;
    width: 100%;
    height: 6px;
    border-radius: 5px;
    background: rgba(255,255,255,0.15);
    outline: none;
    margin-top: 8px;
  }
  .slider-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px; height: 18px;
    border-radius: 50%;
    background: #ffffff;
    cursor: pointer;
    transition: background 0.2s ease, transform 0.2s ease;
    border: 2px solid #06070a;
  }
  .slider-range::-webkit-slider-thumb:hover { background: #D3B89A; transform: scale(1.2); }

  .select-input {
    width: 100%;
    padding: 12px 14px;
    border-radius: 12px;
    background: rgba(0,0,0,0.3);
    border: 1px solid rgba(255,255,255,0.15);
    color: #ffffff;
    font-family: 'Montserrat', sans-serif;
    font-size: 13.5px;
    outline: none;
    cursor: pointer;
    transition: border-color 0.3s ease;
  }
  .select-input:focus { border-color: #D3B89A; }

  /* ── BLOG ── */
  .blog-icon-wrap {
    width: 64px; height: 64px;
    background: rgba(211,184,154,0.08);
    border: 1px solid rgba(211,184,154,0.2);
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
  }

  /* ── FOOTER ── */
  .app-footer {
    text-align: center;
    padding: 40px 20px;
    margin-top: 40px;
    border-top: 1px solid rgba(255,255,255,0.05);
  }
  .footer-links { display: flex; justify-content: center; gap: 25px; flex-wrap: wrap; }
  .footer-links a {
    color: rgba(255,255,255,0.35);
    text-decoration: none;
    font-size: 12.5px;
    font-weight: 500;
    transition: color 0.2s ease;
  }
  .footer-links a:hover { color: #D3B89A; }

  /* ── TOAST ── */
  .toast {
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translate(-50%, 50px);
    background: rgba(140,155,129,0.95);
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
    transition: transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275), opacity 0.3s ease;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }
  .toast.error { background: rgba(248,113,113,0.95); }
  .toast.show { transform: translate(-50%, 0); opacity: 1; }

  /* ── KEYFRAMES ── */
  @keyframes slideDownIn { to { opacity: 1; transform: translate(-50%, 0); } }
  @keyframes typewriter { to { width: 180px; } }
  @keyframes blinkCursor { from, to { border-color: transparent; } 50% { border-color: rgba(255,255,255,0.75); } }
  @keyframes removeCursor { to { border-right: 2px solid transparent; } }
  @keyframes pageFadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes elementFadeUp { to { opacity: 1; transform: translateY(0); } }
  @keyframes drawUnderline { to { transform: scaleX(1); } }
  @keyframes spin { to { transform: rotate(360deg); } }
`;
