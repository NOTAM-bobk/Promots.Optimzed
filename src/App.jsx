import React, { useState, useEffect, useRef } from 'react';

// --- CONFIGURATION ---
const getApiKey = () => {
  try { const k = import.meta.env.VITE_GROQ_API_KEY; if (k) return k; } catch (e) {}
  try { if (typeof process !== 'undefined' && process.env) return process.env.REACT_APP_GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || ""; } catch (e) {}
  return "";
};

const GROQ_API_KEY = getApiKey();
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_WORDS = 300;

// --- USE CASE DEFINITIONS ---
const USE_CASES = [
  { id: 'automatic',  label: 'Automatic',       icon: '◈', desc: 'Let the AI decide the best structure for your prompt.' },
  { id: 'code',       label: 'Code',             icon: '⌨', desc: 'Optimized for programming, debugging, and technical tasks.' },
  { id: 'reasoning',  label: 'Reasoning',        icon: '◎', desc: 'Best for logic, analysis, research, and problem-solving.' },
  { id: 'creative',   label: 'Creative',         icon: '✦', desc: 'Tuned for storytelling, writing, and creative generation.' },
  { id: 'strict',     label: 'Strictest Output', icon: '▣', desc: 'Maximum constraints — zero ambiguity, rigid format mandates.' },
];

const USE_CASE_ADDITIONS = {
  automatic: '',
  code: '\n\n## USE CASE: CODE\nPrioritize technical precision. Include language specification, edge case handling, error handling requirements, and expected I/O format. Format code blocks with proper syntax specification.',
  reasoning: '\n\n## USE CASE: REASONING\nStructure for step-by-step analytical thinking. Require the model to show its reasoning chain, validate assumptions, and present a final synthesized conclusion.',
  creative: '\n\n## USE CASE: CREATIVE\nEmphasize tone, voice, narrative arc, emotional resonance, and stylistic freedom. Include mood descriptors and allow model latitude on structure.',
  strict: '\n\n## USE CASE: STRICTEST OUTPUT\nApply absolute maximum constraint density. Explicit DO and DO NOT lists. Hard character/word counts. Exact section names. Failure conditions explicitly stated. Zero creative interpretation allowed.',
};

const OUTPUT_LENGTH_TOKENS = { compact: 512, standard: 1024, detailed: 2048, exhaustive: 4096 };

const buildSystemPrompt = (style, strictness, useCase) => `
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
${USE_CASE_ADDITIONS[useCase] || ''}

## OUTPUT RULES (NON-NEGOTIABLE)
- Output ONLY the final optimized prompt — no preamble, no meta-commentary, no explanation
- Use clean Markdown: headers (##), bold (**key terms**), bullet lists for constraints, code blocks for format specs
- Every line must earn its place — cut filler, maximize signal density
- The prompt must be self-contained: a model with zero prior context should execute it flawlessly
`.trim();

export default function App() {
  const [activePage, setActivePage] = useState('home');
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [optimizedOutput, setOptimizedOutput] = useState('');
  const [history, setHistory] = useState([]);
  const [expandedHistoryIds, setExpandedHistoryIds] = useState(new Set());
  const [toast, setToast] = useState({ show: false, message: '', isError: false });
  const [inputFocused, setInputFocused] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedUseCase, setSelectedUseCase] = useState('automatic');
  const [outputLength, setOutputLength] = useState('standard');
  const [isDark, setIsDark] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  const [settings, setSettings] = useState({
    model: 'llama3-70b-8192',
    style: 'Structured',
    strictness: 85
  });

  const stateRef = useRef({ userInput, activePage, isGenerating, optimizedOutput });
  useEffect(() => {
    stateRef.current = { userInput, activePage, isGenerating, optimizedOutput };
  }, [userInput, activePage, isGenerating, optimizedOutput]);

  // Apply theme to root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  // Detect mobile
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 600);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const loadingSteps = [
    { label: 'Analyzing prompt structure...' },
    { label: 'Engineering constraints...' },
    { label: 'Calibrating output format...' },
    { label: 'Finalizing expert prompt...' },
  ];

  useEffect(() => {
    let interval;
    if (isGenerating) {
      setLoadingStep(0);
      interval = setInterval(() => setLoadingStep(prev => (prev + 1) % loadingSteps.length), 900);
    }
    return () => clearInterval(interval);
  }, [isGenerating]);

  const getWordCount = (str) => {
    const t = str.trim();
    return t === "" ? 0 : t.split(/\s+/).length;
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
      showToast("Copied to clipboard!");
    } catch { showToast("Failed to copy.", true); }
  };

  const downloadText = (text, ext) => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optimized-prompt.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded as .${ext}`);
  };

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
            { role: "system", content: buildSystemPrompt(settings.style, settings.strictness, selectedUseCase) },
            { role: "user", content: userInput.trim() }
          ],
          temperature: 0.7,
          max_tokens: OUTPUT_LENGTH_TOKENS[outputLength] || 1024,
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
        optWords,
        useCase: selectedUseCase,
        style: settings.style
      }, ...prev]);

      showToast("Prompt optimized!");
    } catch (error) {
      console.error("Groq API Error:", error);
      setOptimizedOutput("Error connecting to AI backend. Please check your API key setup on Vercel.");
      showToast("API connection failed", true);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === 'Enter') { e.preventDefault(); if (stateRef.current.activePage === 'home' && !stateRef.current.isGenerating) handleOptimize(); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); if (stateRef.current.activePage === 'home' && stateRef.current.optimizedOutput) copyText(stateRef.current.optimizedOutput); }
      if (mod && e.key === 'Backspace') { e.preventDefault(); if (stateRef.current.activePage === 'home') { setUserInput(''); showToast("Input cleared"); } }
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

  // Theme toggle button
  const ThemeToggle = ({ inSettings = false }) => (
    <button
      className={`theme-toggle${inSettings ? ' theme-toggle--settings' : ''}`}
      onClick={() => setIsDark(d => !d)}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      )}
    </button>
  );

  return (
    <div className="app-wrapper">
      <style>{globalCSS}</style>

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
          <a className={`icon_link ${activePage === 'blog' ? 'active' : ''}`} onClick={() => { setActivePage('blog'); window.scrollTo(0,0); }} title="Blog (Ctrl+4)">
            <svg viewBox="0 0 24 24"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          </a>
          <a className={`icon_link ${activePage === 'settings' ? 'active' : ''}`} onClick={() => { setActivePage('settings'); window.scrollTo(0,0); }} title="Settings (Ctrl+3)">
            <svg viewBox="0 0 24 24"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
          </a>
          {/* Theme toggle — desktop only in navbar */}
          {!isMobile && <ThemeToggle />}
        </div>
      </div>

      {/* ── HOME PAGE ── */}
      <main className={`page ${activePage === 'home' ? 'active' : ''}`}>
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

          {/* Advanced Options Toggle */}
          <button className="advanced-toggle" onClick={() => setAdvancedOpen(o => !o)}>
            <span className="advanced-toggle-left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9z"></path></svg>
              Advanced Options
            </span>
            <span className="advanced-toggle-right">
              {selectedUseCase !== 'automatic' && (
                <span className="advanced-badge">{USE_CASES.find(u => u.id === selectedUseCase)?.label}</span>
              )}
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transition: 'transform 0.3s ease', transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </button>

          {/* Advanced Panel */}
          <div className={`advanced-panel ${advancedOpen ? 'open' : ''}`}>
            <div className="advanced-panel-inner">
              {/* Use Case Selection */}
              <div className="adv-section">
                <div className="adv-section-label">Use Case</div>
                <div className="usecase-grid">
                  {USE_CASES.map(uc => (
                    <button
                      key={uc.id}
                      className={`usecase-chip ${selectedUseCase === uc.id ? 'selected' : ''}`}
                      onClick={() => setSelectedUseCase(uc.id)}
                      title={uc.desc}
                    >
                      <span className="usecase-icon">{uc.icon}</span>
                      <span>{uc.label}</span>
                    </button>
                  ))}
                </div>
                <p className="adv-hint">{USE_CASES.find(u => u.id === selectedUseCase)?.desc}</p>
              </div>

              {/* Output Length */}
              <div className="adv-section">
                <div className="adv-section-label">Output Length</div>
                <div className="length-grid">
                  {[
                    { id: 'compact', label: 'Compact', sub: '~512 tokens' },
                    { id: 'standard', label: 'Standard', sub: '~1024 tokens' },
                    { id: 'detailed', label: 'Detailed', sub: '~2048 tokens' },
                    { id: 'exhaustive', label: 'Exhaustive', sub: '~4096 tokens' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      className={`length-chip ${outputLength === opt.id ? 'selected' : ''}`}
                      onClick={() => setOutputLength(opt.id)}
                    >
                      <span className="length-label">{opt.label}</span>
                      <span className="length-sub">{opt.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
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
                <div className="loading-rings">
                  <div className="ring ring-1"></div>
                  <div className="ring ring-2"></div>
                  <div className="ring ring-3"></div>
                  <div className="ring-core">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D3B89A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
                  </div>
                </div>
                <div className="loading-text-block">
                  <div className="loading-step-label" key={loadingStep}>{loadingSteps[loadingStep].label}</div>
                  <div className="loading-progress-bar"><div className="loading-progress-fill"></div></div>
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
                  <div className="output-actions">
                    <div className="output-actions-label">Export</div>
                    <div className="output-actions-row">
                      <button className="btn-output-action" onClick={() => copyText(optimizedOutput)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copy
                      </button>
                      <button className="btn-output-action" onClick={() => downloadText(optimizedOutput, 'txt')}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        .txt
                      </button>
                      <button className="btn-output-action btn-output-action--accent" onClick={() => downloadText(optimizedOutput, 'md')}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        .md
                      </button>
                    </div>
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
          <button className="btn-clear" onClick={() => { setHistory([]); showToast("Cleared optimization logs."); }}>Clear Logs</button>
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
                    <div className="history-meta">
                      {item.useCase && item.useCase !== 'automatic' && (
                        <span className="history-usecase-tag">{item.useCase}</span>
                      )}
                      <span className="history-timestamp">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display:'inline-block', verticalAlign: 'middle', marginRight: '4px' }}><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        {item.timestamp}
                      </span>
                    </div>
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
                      <button className="btn-copy" onClick={(e) => { e.stopPropagation(); downloadText(item.optimized, 'md'); }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Download .md
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

        {/* Theme toggle — mobile only in settings */}
        {isMobile && (
          <div className="card" style={{ opacity: 1, transform: 'none' }}>
            <h2>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              APPEARANCE
            </h2>
            <div className="settings-container">
              <div className="settings-row" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottom: 'none', paddingBottom: 0 }}>
                <div>
                  <div className="settings-label"><span>Color Mode</span></div>
                  <p className="settings-desc">Switch between dark and light interface themes.</p>
                </div>
                <ThemeToggle inSettings={true} />
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z"></path></svg>
            AI MODEL ENGINE PREFERENCES
          </h2>
          <div className="settings-container">
            <div className="settings-row">
              <div className="settings-label"><span>Target Groq Model</span></div>
              <p className="settings-desc">Select the LLM routing you want to use for generation via Groq API.</p>
              <select className="select-input" value={settings.model} onChange={(e) => setSettings({...settings, model: e.target.value})}>
                <option value="llama3-70b-8192">llama3-70b-8192 (Groq Ultra-Fast Default)</option>
                <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (High Context Window)</option>
                <option value="openai/gpt-oss-120b">openai/gpt-oss-120b (Custom Configuration)</option>
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
              <input type="range" min="10" max="100" step="1" value={settings.strictness} onChange={(e) => setSettings({...settings, strictness: parseInt(e.target.value)})} className="slider-range" />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: '24px' }}>
          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            KEYBOARD SHORTCUTS
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

  /* ── THEME TOKENS ── */
  :root, [data-theme="dark"] {
    --bg-base: #06070a;
    --bg-card: rgba(255,255,255,0.02);
    --bg-card-hover: rgba(255,255,255,0.04);
    --bg-advanced: rgba(0,0,0,0.25);
    --bg-chip: rgba(255,255,255,0.05);
    --bg-chip-hover: rgba(255,255,255,0.1);
    --bg-chip-selected: rgba(255,255,255,0.12);
    --bg-output-action: rgba(255,255,255,0.08);
    --bg-output-action-hover: rgba(211,184,154,0.15);
    --bg-prompt-box: rgba(0,0,0,0.25);
    --bg-select: rgba(0,0,0,0.3);
    --bg-nav: rgba(255,255,255,0.03);
    --border-card: rgba(255,255,255,0.05);
    --border-card-hover: rgba(255,255,255,0.1);
    --border-chip: rgba(255,255,255,0.1);
    --border-chip-selected: rgba(211,184,154,0.6);
    --border-nav: rgba(255,255,255,0.08);
    --border-select: rgba(255,255,255,0.15);
    --border-advanced-toggle: rgba(255,255,255,0.06);
    --border-action-row: rgba(255,255,255,0.06);
    --text-primary: #f0f0f0;
    --text-secondary: rgba(255,255,255,0.6);
    --text-muted: rgba(255,255,255,0.35);
    --text-heading: #b5b5b5;
    --text-placeholder: rgba(255,255,255,0.3);
    --text-logo: #e0e0e0;
    --accent: #D3B89A;
    --accent-dim: rgba(211,184,154,0.6);
    --orb-opacity: 0.25;
    --toast-success-bg: rgba(140,155,129,0.95);
    --toast-success-color: #06070a;
    --shortcut-bg: rgba(255,255,255,0.1);
    --history-item-bg: rgba(255,255,255,0.02);
    --history-item-border: rgba(255,255,255,0.08);
    --word-count-bg: rgba(0,0,0,0.3);
    --word-count-border: rgba(255,255,255,0.08);
  }

  [data-theme="light"] {
    --bg-base: #f4f3ef;
    --bg-card: rgba(255,255,255,0.85);
    --bg-card-hover: rgba(255,255,255,0.95);
    --bg-advanced: rgba(0,0,0,0.04);
    --bg-chip: rgba(0,0,0,0.04);
    --bg-chip-hover: rgba(0,0,0,0.08);
    --bg-chip-selected: rgba(180,140,100,0.12);
    --bg-output-action: rgba(0,0,0,0.06);
    --bg-output-action-hover: rgba(180,140,100,0.15);
    --bg-prompt-box: rgba(0,0,0,0.04);
    --bg-select: rgba(255,255,255,0.9);
    --bg-nav: rgba(255,255,255,0.75);
    --border-card: rgba(0,0,0,0.07);
    --border-card-hover: rgba(0,0,0,0.14);
    --border-chip: rgba(0,0,0,0.12);
    --border-chip-selected: rgba(180,130,80,0.7);
    --border-nav: rgba(0,0,0,0.1);
    --border-select: rgba(0,0,0,0.18);
    --border-advanced-toggle: rgba(0,0,0,0.07);
    --border-action-row: rgba(0,0,0,0.07);
    --text-primary: #1a1a1a;
    --text-secondary: rgba(0,0,0,0.65);
    --text-muted: rgba(0,0,0,0.4);
    --text-heading: #555;
    --text-placeholder: rgba(0,0,0,0.3);
    --text-logo: #333;
    --accent: #a0712e;
    --accent-dim: rgba(160,113,46,0.7);
    --orb-opacity: 0.12;
    --toast-success-bg: rgba(90,130,95,0.95);
    --toast-success-color: #fff;
    --shortcut-bg: rgba(0,0,0,0.08);
    --history-item-bg: rgba(255,255,255,0.7);
    --history-item-border: rgba(0,0,0,0.09);
    --word-count-bg: rgba(0,0,0,0.06);
    --word-count-border: rgba(0,0,0,0.1);
  }

  html, body {
    margin: 0; padding: 0;
    width: 100%; min-height: 100vh;
    background: var(--bg-base);
    transition: background 0.35s ease;
  }
  * { box-sizing: border-box; }

  .app-wrapper {
    min-height: 100vh;
    background: var(--bg-base);
    overflow-x: hidden;
    font-family: 'Montserrat', sans-serif;
    color: var(--text-primary);
    user-select: none;
    display: flex;
    flex-direction: column;
    transition: background 0.35s ease, color 0.35s ease;
  }

  /* ── ORBS ── */
  .orb {
    position: fixed;
    border-radius: 50%;
    filter: blur(120px);
    z-index: 0;
    opacity: var(--orb-opacity);
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
  .orb-bottom-left {
    bottom: -180px; left: -180px;
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(220,220,255,0.4) 55%, transparent 100%);
    animation: floatOrbBottomLeft 14s infinite alternate ease-in-out;
  }
  @keyframes floatOrbLeft { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(60px,40px) scale(1.15); } 100% { transform: translate(-20px,80px) scale(0.9); } }
  @keyframes floatOrbRight { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(-80px,50px) scale(0.85); } 100% { transform: translate(30px,-30px) scale(1.1); } }
  @keyframes floatOrbBottomLeft { 0% { transform: translate(0,0) scale(1); } 50% { transform: translate(50px,-40px) scale(1.1); } 100% { transform: translate(-30px,20px) scale(0.92); } }

  /* ── NAVBAR ── */
  .header_container {
    position: fixed;
    top: 4%; left: 50%;
    transform: translate(-50%, -30px);
    width: 85%; max-width: 850px; min-width: 300px;
    height: 65px;
    background-color: var(--bg-nav);
    border-radius: 50px;
    backdrop-filter: blur(25px);
    -webkit-backdrop-filter: blur(25px);
    border: 1px solid var(--border-nav);
    box-shadow: 0 10px 40px 0 rgba(0,0,0,0.4);
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 35px;
    z-index: 1000;
    opacity: 0;
    animation: slideDownIn 1s cubic-bezier(0.16,1,0.3,1) forwards;
    animation-delay: 0.2s;
    transition: background 0.35s ease, border-color 0.35s ease;
  }
  .logo_part1 {
    color: var(--text-logo);
    font-family: 'Oswald', sans-serif;
    font-size: 14px; font-weight: 300; letter-spacing: 3px;
    white-space: nowrap; overflow: hidden;
    border-right: 2px solid rgba(255,255,255,0.75);
    width: 0;
    animation:
      typewriter 2s steps(20) 1.2s forwards,
      blinkCursor 0.8s infinite,
      removeCursor 0.1s forwards 3.2s;
  }
  .nav_icons { display: flex; gap: 22px; align-items: center; }
  .icon_link {
    color: var(--text-muted);
    display: flex; align-items: center; justify-content: center;
    text-decoration: none;
    transition: color 0.3s ease, transform 0.3s ease;
    cursor: pointer; position: relative;
  }
  .icon_link:hover, .icon_link.active { color: var(--accent); transform: translateY(-2px); }
  .icon_link.active::after {
    content: '';
    position: absolute; bottom: -8px;
    width: 12px; height: 2px;
    background-color: var(--accent);
    border-radius: 10px;
    box-shadow: 0 0 8px var(--accent);
  }
  .icon_link svg { width: 21px; height: 21px; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; fill: none; }

  /* ── THEME TOGGLE ── */
  .theme-toggle {
    background: var(--bg-chip);
    border: 1px solid var(--border-chip);
    color: var(--text-secondary);
    width: 36px; height: 36px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: background 0.25s ease, color 0.25s ease, transform 0.25s ease, border-color 0.25s ease;
    flex-shrink: 0;
  }
  .theme-toggle:hover { background: var(--bg-chip-hover); color: var(--accent); transform: translateY(-1px); }
  .theme-toggle svg { stroke: currentColor; }
  .theme-toggle--settings {
    width: 44px; height: 44px;
    border-radius: 12px;
  }

  @media (max-width: 600px) {
    .logo_part1 { display: none; }
    .header_container { justify-content: center; }
  }

  /* ── PAGES ── */
  .page {
    display: none;
    padding-top: 130px;
    width: 90%; max-width: 800px;
    margin-left: auto; margin-right: auto;
    z-index: 10; position: relative;
    flex: 1;
  }
  .page.active {
    display: flex; flex-direction: column; gap: 28px;
    animation: pageFadeUp 0.8s cubic-bezier(0.16,1,0.3,1) forwards;
  }

  /* ── HERO ── */
  .hero-header {
    text-align: center;
    font-size: 2.2rem; font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 10px;
    letter-spacing: -0.5px; line-height: 1.3;
  }
  .hero-word {
    display: inline-block;
    opacity: 0; filter: blur(12px); transform: translateY(-14px);
    animation: wordReveal 0.65s cubic-bezier(0.16,1,0.3,1) forwards;
  }
  .instantly-text { color: var(--text-muted); position: relative; }
  .underline-bar {
    position: absolute; left: 0; bottom: -3px;
    width: 100%; height: 3px;
    background: var(--text-muted);
    border-radius: 2px;
    transform: scaleX(0); transform-origin: left;
    animation: drawUnderline 0.6s ease-out 1.3s forwards;
  }
  @keyframes wordReveal { 0% { opacity:0; filter:blur(12px); transform:translateY(-14px); } 60% { filter:blur(2px); } 100% { opacity:1; filter:blur(0); transform:translateY(0); } }

  /* ── CARDS ── */
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border-card);
    border-radius: 24px; padding: 28px;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 15px 35px rgba(0,0,0,0.3);
    transition: border-color 0.4s ease, box-shadow 0.4s ease, background 0.35s ease;
    opacity: 0; transform: translateY(20px);
  }
  .page.active .card { animation: elementFadeUp 0.8s cubic-bezier(0.16,1,0.3,1) forwards; }
  .page.active .card:nth-child(2) { animation-delay: 0.15s; }
  .page.active .card:nth-child(3) { animation-delay: 0.3s; }
  .card:hover { border-color: var(--border-card-hover); box-shadow: 0 20px 45px rgba(0,0,0,0.4); }
  .card-header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
  .card h2 {
    margin: 0; font-size: 13px;
    font-family: 'Oswald', sans-serif; font-weight: 400;
    letter-spacing: 2px; color: var(--text-heading);
    display: flex; align-items: center; gap: 10px;
  }
  .card h2 svg { color: var(--accent); }

  .word-count {
    font-size: 11px; color: var(--text-muted); font-weight: 600;
    background: var(--word-count-bg); padding: 5px 12px;
    border-radius: 20px; border: 1px solid var(--word-count-border);
  }
  .word-count.limit-reached { color: #f87171; border-color: rgba(248,113,113,0.3); }

  /* ── TEXTAREA RING ── */
  .textarea-ring-wrapper { position: relative; border-radius: 14px; transition: box-shadow 0.35s ease; }
  .textarea-ring-wrapper.focused {
    box-shadow: 0 0 0 1.5px var(--accent-dim), 0 0 16px 2px rgba(211,184,154,0.12);
  }
  .prompt-input {
    width: 100%; height: 120px;
    background: transparent; border: none;
    color: var(--text-primary);
    font-family: 'Montserrat', sans-serif;
    font-size: 16px; line-height: 1.6;
    resize: none; outline: none; display: block;
  }
  .prompt-input::placeholder { color: var(--text-placeholder); transition: color 0.3s ease; }
  .prompt-input:focus::placeholder { color: var(--text-muted); }

  /* ── ADVANCED OPTIONS TOGGLE ── */
  .advanced-toggle {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; padding: 12px 0;
    background: transparent; border: none;
    border-top: 1px solid var(--border-advanced-toggle);
    color: var(--text-secondary);
    font-family: 'Montserrat', sans-serif;
    font-size: 12.5px; font-weight: 600;
    letter-spacing: 0.3px;
    cursor: pointer;
    transition: color 0.2s ease;
    margin-top: 14px;
  }
  .advanced-toggle:hover { color: var(--accent); }
  .advanced-toggle-left {
    display: flex; align-items: center; gap: 8px;
  }
  .advanced-toggle-right {
    display: flex; align-items: center; gap: 10px;
  }
  .advanced-badge {
    font-size: 10px; font-weight: 700;
    color: var(--accent); text-transform: uppercase; letter-spacing: 1px;
    background: rgba(211,184,154,0.12); border: 1px solid var(--accent-dim);
    padding: 3px 8px; border-radius: 10px;
  }
  [data-theme="light"] .advanced-badge { background: rgba(160,113,46,0.1); }

  /* ── ADVANCED PANEL ── */
  .advanced-panel {
    max-height: 0; overflow: hidden;
    transition: max-height 0.4s cubic-bezier(0.16,1,0.3,1);
  }
  .advanced-panel.open { max-height: 600px; }
  .advanced-panel-inner {
    background: var(--bg-advanced);
    border-radius: 16px;
    padding: 20px;
    margin-top: 4px;
    border: 1px solid var(--border-advanced-toggle);
    display: flex; flex-direction: column; gap: 22px;
  }
  .adv-section { display: flex; flex-direction: column; gap: 10px; }
  .adv-section-label {
    font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1.5px;
    color: var(--text-muted);
  }
  .adv-hint {
    font-size: 12px; color: var(--text-muted);
    margin: 0; line-height: 1.5;
    min-height: 18px;
    transition: opacity 0.2s ease;
  }

  /* ── USE CASE CHIPS ── */
  .usecase-grid {
    display: flex; flex-wrap: wrap; gap: 8px;
  }
  .usecase-chip {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 14px;
    background: var(--bg-chip);
    border: 1px solid var(--border-chip);
    border-radius: 30px;
    color: var(--text-secondary);
    font-family: 'Montserrat', sans-serif;
    font-size: 12.5px; font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }
  .usecase-chip:hover { background: var(--bg-chip-hover); color: var(--text-primary); }
  .usecase-chip.selected {
    background: var(--bg-chip-selected);
    border-color: var(--border-chip-selected);
    color: var(--accent);
    box-shadow: 0 0 12px rgba(211,184,154,0.1);
  }
  [data-theme="light"] .usecase-chip.selected { color: var(--accent); box-shadow: none; }
  .usecase-icon { font-size: 13px; opacity: 0.8; }

  /* ── LENGTH CHIPS ── */
  .length-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;
  }
  @media (max-width: 520px) { .length-grid { grid-template-columns: repeat(2, 1fr); } }
  .length-chip {
    display: flex; flex-direction: column; align-items: center;
    padding: 10px 8px;
    background: var(--bg-chip);
    border: 1px solid var(--border-chip);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'Montserrat', sans-serif;
  }
  .length-chip:hover { background: var(--bg-chip-hover); }
  .length-chip.selected {
    background: var(--bg-chip-selected);
    border-color: var(--border-chip-selected);
  }
  .length-label {
    font-size: 12.5px; font-weight: 700;
    color: var(--text-primary);
  }
  .length-chip.selected .length-label { color: var(--accent); }
  .length-sub { font-size: 10px; color: var(--text-muted); margin-top: 3px; }

  /* ── ACTION ROW ── */
  .action-row {
    display: flex; justify-content: flex-end; align-items: center;
    margin-top: 15px;
    border-top: 1px solid var(--border-action-row);
    padding-top: 15px;
  }
  .btn-optimize {
    background: var(--text-primary);
    color: var(--bg-base);
    border: none; padding: 12px 28px; border-radius: 30px;
    font-family: 'Montserrat', sans-serif;
    font-weight: 700; font-size: 13px; letter-spacing: 0.5px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.25,1,0.5,1);
    display: flex; align-items: center; gap: 8px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
  }
  .btn-optimize:hover { background: var(--accent); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(211,184,154,0.25); }
  .btn-optimize:active { transform: translateY(0); }

  /* ── LOADING ── */
  .loading-panel {
    display: flex; align-items: center; gap: 28px;
    padding: 24px 0 20px;
  }
  .loading-rings {
    position: relative; width: 56px; height: 56px;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .ring { position: absolute; border-radius: 50%; border: 1.5px solid transparent; animation: spinRing linear infinite; }
  .ring-1 { width: 56px; height: 56px; border-top-color: rgba(211,184,154,0.9); border-right-color: rgba(211,184,154,0.3); animation-duration: 1.1s; }
  .ring-2 { width: 40px; height: 40px; border-top-color: rgba(255,255,255,0.5); border-left-color: rgba(255,255,255,0.2); animation-duration: 0.8s; animation-direction: reverse; }
  .ring-3 { width: 26px; height: 26px; border-top-color: rgba(140,155,129,0.8); animation-duration: 1.5s; }
  .ring-core { position: absolute; display: flex; align-items: center; justify-content: center; animation: pulseCoreIcon 1.2s ease-in-out infinite; }
  .loading-text-block { flex: 1; display: flex; flex-direction: column; gap: 10px; }
  .loading-step-label { font-size: 13.5px; font-weight: 600; color: var(--accent); letter-spacing: 0.3px; animation: stepFadeIn 0.35s ease forwards; }
  .loading-progress-bar { width: 100%; height: 3px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; }
  .loading-progress-fill { height: 100%; width: 0%; background: linear-gradient(90deg, var(--accent-dim), var(--accent)); border-radius: 4px; animation: progressSweep 3.6s ease-in-out infinite; }
  .loading-model-tag { font-size: 11px; color: var(--text-muted); font-weight: 500; }
  @keyframes spinRing { to { transform: rotate(360deg); } }
  @keyframes pulseCoreIcon { 0%, 100% { opacity:0.7; transform:scale(1); } 50% { opacity:1; transform:scale(1.15); } }
  @keyframes stepFadeIn { from { opacity:0; transform:translateX(-6px); } to { opacity:1; transform:translateX(0); } }
  @keyframes progressSweep { 0% { width:0%; } 70% { width:85%; } 90% { width:92%; } 100% { width:98%; } }

  /* ── OUTPUT ── */
  .output-container { position: relative; }
  .output-text { min-height: 70px; color: var(--text-primary); font-size: 15.5px; line-height: 1.7; white-space: pre-wrap; }
  .output-placeholder { color: var(--text-placeholder); font-style: italic; }

  /* ── OUTPUT ACTIONS (DOWNLOAD) ── */
  .output-actions {
    margin-top: 18px;
    padding-top: 15px;
    border-top: 1px solid var(--border-action-row);
  }
  .output-actions-label {
    font-size: 10px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 1.5px;
    color: var(--text-muted); margin-bottom: 10px;
  }
  .output-actions-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .btn-output-action {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 16px;
    background: var(--bg-output-action);
    border: 1px solid var(--border-chip);
    color: var(--text-secondary);
    font-family: 'Montserrat', sans-serif;
    font-size: 12px; font-weight: 700;
    border-radius: 30px; cursor: pointer;
    transition: all 0.2s ease;
    letter-spacing: 0.3px;
  }
  .btn-output-action:hover { background: var(--bg-output-action-hover); border-color: var(--accent); color: var(--accent); }
  .btn-output-action--accent {
    border-color: var(--accent-dim);
    color: var(--accent);
  }
  .btn-output-action--accent:hover { background: rgba(211,184,154,0.18); }

  /* ── HISTORY ── */
  .history-controls { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 5px; }
  .history-title-section h1 { margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 1px; font-family: 'Oswald', sans-serif; color: var(--text-primary); }
  .history-title-section p { margin: 4px 0 0; font-size: 13.5px; color: var(--text-secondary); }
  .btn-clear {
    background: transparent;
    border: 1px solid var(--border-chip);
    color: var(--text-secondary);
    border-radius: 30px; padding: 8px 16px;
    font-size: 12px; font-weight: 600;
    cursor: pointer; transition: all 0.3s ease;
    font-family: 'Montserrat', sans-serif;
  }
  .btn-clear:hover { border-color: #f87171; color: #f87171; background: rgba(248,113,113,0.1); }

  .history-list { display: flex; flex-direction: column; gap: 16px; }
  .history-item {
    display: flex; flex-direction: column;
    background: var(--history-item-bg);
    border: 1px solid var(--history-item-border);
    border-radius: 20px; overflow: hidden;
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
  }
  .history-item:hover { border-color: var(--border-card-hover); box-shadow: 0 10px 25px rgba(0,0,0,0.15); }
  .history-item-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 20px 24px; cursor: pointer; user-select: none;
    transition: background 0.2s ease;
  }
  .history-item-header:hover { background: var(--bg-chip-hover); }
  .header-left-group { display: flex; align-items: center; gap: 14px; overflow: hidden; flex: 1; margin-right: 15px; }
  .chevron-icon { color: var(--text-muted); transition: transform 0.3s cubic-bezier(0.25,1,0.5,1), color 0.3s ease; flex-shrink: 0; display: flex; align-items: center; }
  .history-item.expanded .chevron-icon { transform: rotate(180deg); color: var(--accent); }
  .history-preview-text { font-size: 14.5px; font-weight: 500; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .history-meta { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .history-usecase-tag {
    font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
    color: var(--accent); background: rgba(211,184,154,0.1);
    border: 1px solid var(--accent-dim); padding: 3px 8px; border-radius: 10px;
  }
  [data-theme="light"] .history-usecase-tag { background: rgba(160,113,46,0.1); }
  .history-timestamp { font-size: 11.5px; color: var(--text-muted); font-weight: 600; white-space: nowrap; }
  .history-item-content {
    max-height: 0; opacity: 0; visibility: hidden;
    transition: max-height 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.3s ease, padding 0.3s ease;
    box-sizing: border-box; background: var(--bg-advanced);
  }
  .history-item.expanded .history-item-content {
    max-height: 2000px; opacity: 1; visibility: visible;
    padding: 0 24px 24px;
    border-top: 1px solid var(--border-advanced-toggle);
  }
  .history-subgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
  @media (max-width: 650px) { .history-subgrid { grid-template-columns: 1fr; } }
  .prompt-box { background: var(--bg-prompt-box); border-radius: 12px; padding: 18px; border: 1px solid var(--border-advanced-toggle); }
  .prompt-box-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
  .prompt-box-title { font-size: 11px; font-family: 'Oswald', sans-serif; letter-spacing: 1.5px; color: var(--text-muted); text-transform: uppercase; }
  .prompt-box-stats { font-size: 10px; color: var(--text-muted); background: var(--bg-chip); padding: 3px 8px; border-radius: 10px; font-weight: 600; }
  .prompt-box-content { font-size: 14.5px; line-height: 1.6; color: var(--text-primary); white-space: pre-wrap; }
  .history-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
  .btn-copy {
    background: var(--bg-output-action);
    border: 1px solid var(--border-chip);
    color: var(--text-secondary);
    font-size: 12px; font-weight: 600; padding: 8px 18px; border-radius: 30px;
    cursor: pointer; transition: all 0.2s ease;
    font-family: 'Montserrat', sans-serif;
    display: flex; align-items: center; gap: 6px;
  }
  .btn-copy:hover { background: var(--bg-output-action-hover); border-color: var(--accent); color: var(--accent); }

  /* ── SETTINGS ── */
  .settings-container { display: flex; flex-direction: column; gap: 24px; }
  .settings-row { display: flex; flex-direction: column; gap: 10px; padding-bottom: 20px; border-bottom: 1px solid var(--border-advanced-toggle); }
  .settings-row:last-child { border-bottom: none; padding-bottom: 0; }
  .settings-label { font-size: 13.5px; font-weight: 600; color: var(--text-primary); display: flex; justify-content: space-between; }
  .settings-label span.value { color: var(--accent); }
  .settings-desc { font-size: 12.5px; color: var(--text-secondary); margin: 0; }
  .shortcut-badge { background: var(--shortcut-bg); padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--accent); white-space: nowrap; margin-left: 15px; flex-shrink: 0; }
  .slider-range { -webkit-appearance: none; width: 100%; height: 6px; border-radius: 5px; background: var(--bg-chip-hover); outline: none; margin-top: 8px; }
  .slider-range::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--text-primary); cursor: pointer; transition: background 0.2s ease, transform 0.2s ease; border: 2px solid var(--bg-base); }
  .slider-range::-webkit-slider-thumb:hover { background: var(--accent); transform: scale(1.2); }
  .select-input { width: 100%; padding: 12px 14px; border-radius: 12px; background: var(--bg-select); border: 1px solid var(--border-select); color: var(--text-primary); font-family: 'Montserrat', sans-serif; font-size: 13.5px; outline: none; cursor: pointer; transition: border-color 0.3s ease; }
  .select-input:focus { border-color: var(--accent); }
  [data-theme="light"] .select-input option { background: #fff; color: #111; }

  /* ── BLOG ── */
  .blog-icon-wrap { width: 64px; height: 64px; background: rgba(211,184,154,0.08); border: 1px solid rgba(211,184,154,0.2); border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto; }

  /* ── NO HISTORY ── */
  .no-history-state { text-align: center; padding: 50px 28px; }
  .no-history-state p { color: var(--text-muted); font-size: 14px; }

  /* ── FOOTER ── */
  .app-footer { text-align: center; padding: 40px 20px; margin-top: 40px; border-top: 1px solid var(--border-advanced-toggle); }
  .footer-links { display: flex; justify-content: center; gap: 25px; flex-wrap: wrap; }
  .footer-links a { color: var(--text-muted); text-decoration: none; font-size: 12.5px; font-weight: 500; transition: color 0.2s ease; }
  .footer-links a:hover { color: var(--accent); }

  /* ── TOAST ── */
  .toast {
    position: fixed; bottom: 30px; left: 50%;
    transform: translate(-50%, 50px);
    background: var(--toast-success-bg);
    color: var(--toast-success-color);
    padding: 12px 24px; border-radius: 40px;
    font-size: 12px; font-weight: 700; letter-spacing: 0.5px;
    z-index: 2000; display: flex; align-items: center; gap: 10px;
    opacity: 0; pointer-events: none;
    transition: transform 0.3s cubic-bezier(0.175,0.885,0.32,1.275), opacity 0.3s ease;
    box-shadow: 0 10px 30px rgba(0,0,0,0.4);
  }
  .toast.error { background: rgba(248,113,113,0.95); color: #fff; }
  .toast.show { transform: translate(-50%, 0); opacity: 1; }

  /* ── KEYFRAMES ── */
  @keyframes slideDownIn { to { opacity:1; transform:translate(-50%,0); } }
  @keyframes typewriter { to { width: 180px; } }
  @keyframes blinkCursor { from, to { border-color: transparent; } 50% { border-color: rgba(255,255,255,0.75); } }
  @keyframes removeCursor { to { border-right: 2px solid transparent; } }
  @keyframes pageFadeUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
  @keyframes elementFadeUp { to { opacity:1; transform:translateY(0); } }
  @keyframes drawUnderline { to { transform: scaleX(1); } }
`;
