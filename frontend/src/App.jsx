import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  ArrowUp, 
  Settings, 
  FileText, 
  Image as ImageIcon, 
  Paperclip, 
  Wrench,
  ChevronRight,
  Copy,
  Info,
  X,
  Play,
  Command,
  Search,
  History as HistoryIcon,
  Sparkles,
  Compass,
  Library,
  Loader2,
  Globe,
  Menu,
  Zap,
  LogIn,
  Rabbit
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { twMerge } from 'tailwind-merge';

const API_BASE = "http://localhost:3000";

const BunnyIcon = ({ size = 28 }) => (
  <div 
    className="flex items-center justify-center bg-purple-500 rounded-full shadow-lg shadow-purple-500/50 overflow-hidden" 
    style={{ width: size, height: size }}
  >
    <Rabbit size={size * 0.6} className="text-white fill-white" />
  </div>
);

const App = () => {
  const [view, setView] = useState('landing'); 
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const [sources, setSources] = useState([]);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('lore_token'));
  const [authMode, setAuthMode] = useState(null);
  const [history, setHistory] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);

  // Auth Inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const suggestions = [
    "Bun vs Node.js",
    "Quantum computing hardware",
    "Minimalist web design",
    "Search engine architecture"
  ];

  useEffect(() => {
    if (token) fetchHistory();
    const handleResize = () => setSidebarOpen(window.innerWidth > 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [token]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE}/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      }
    } catch (e) { console.error("History fetch failed"); }
  };

  const handleAuth = async (e) => {
    if (e) e.preventDefault();
    setError(null);
    const endpoint = authMode === 'signup' ? '/signup' : '/signin';
    const body = authMode === 'signup' ? { email, password, name } : { email, password };
    
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('lore_token', data.token);
        setAuthMode(null);
        setEmail(''); setPassword(''); setName('');
        fetchHistory();
      } else { setError(data.error || "Authentication failed"); }
    } catch (err) { setError("Lore engine is currently unreachable"); }
  };

  const handleSearch = async (e, customQuery = null) => {
    if (e) e.preventDefault();
    const finalQuery = (customQuery || query || "").trim();
    if (!finalQuery) return;
    
    if (!token) { 
      setAuthMode('signup'); 
      setQuery(finalQuery); 
      return; 
    }
    
    setQuery(finalQuery);
    setView('results');
    setIsLoading(true);
    setStreamedText('');
    setSources([]);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/conversation`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ query: finalQuery, stream: true })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Connection failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      setIsLoading(false);

      let fullAnswer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === "sources") setSources(data.sources || []);
              if (data.type === "answer") {
                fullAnswer += data.delta;
                setStreamedText(fullAnswer);
              }
              if (data.type === "error") setError(data.message);
            } catch (e) { console.error("Parse error", e); }
          }
        }
      }
      fetchHistory();
    } catch (err) {
      setIsLoading(false);
      setError(err.message || "Lore research engine is offline.");
    }
  };

  return (
    <div className="flex h-screen bg-[#05020a] overflow-hidden relative selection:bg-purple-500/30">
      
      {/* --- Sidebar --- */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside 
            initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
            className="fixed lg:relative w-64 h-full border-r border-white/5 flex flex-col p-5 gap-6 shrink-0 glass-dark z-[70]"
          >
            <div className="flex items-center gap-3">
              <BunnyIcon size={24} />
              <span className="font-bold text-base tracking-tight text-white italic">lore.</span>
            </div>

            <button 
              onClick={() => { setView('landing'); setQuery(''); if (window.innerWidth < 1024) setSidebarOpen(false); }}
              className="flex items-center justify-between w-full px-4 py-2 border border-purple-500/20 rounded-xl text-zinc-400 hover:text-white hover:bg-purple-500/5 transition-all group"
            >
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                <Plus size={14} /><span>New thread</span>
              </div>
            </button>

            <div className="flex-1 flex flex-col gap-6 overflow-y-auto scrollbar-hide">
              <div>
                <h3 className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-bold mb-3 px-1">Library</h3>
                <nav className="flex flex-col gap-0.5">
                   <div onClick={() => { setView('landing'); if (window.innerWidth < 1024) setSidebarOpen(false); }} className={twMerge("flex items-center gap-3 px-3 py-1.5 rounded-lg transition-all cursor-pointer", view === 'landing' ? "bg-purple-500/10 text-purple-200" : "text-zinc-500 hover:text-zinc-300")}>
                      <Search size={14} /><span className="text-xs">Threads</span>
                   </div>
                   <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-zinc-500 opacity-20 cursor-not-allowed group">
                      <Compass size={14} /><span className="text-xs">Discover</span>
                      <span className="ml-auto text-[8px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">Beta</span>
                   </div>
                </nav>
              </div>

              <div>
                <h3 className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-bold mb-3 px-1">History</h3>
                <div className="flex flex-col gap-0.5">
                  {(history || []).map(item => (
                    <div key={item.id} onClick={() => { setQuery(item.title); setView('results'); handleSearch(null, item.title); if (window.innerWidth < 1024) setSidebarOpen(false); }} className="text-[12px] text-zinc-500 hover:text-zinc-200 cursor-pointer truncate py-1.5 px-3 rounded-lg hover:bg-purple-500/5 transition-all">
                      {item.title}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-auto pt-4 border-t border-white/5">
               <div className="flex items-center gap-3 p-1.5 hover:bg-white/5 rounded-xl cursor-pointer group transition-all" onClick={() => !token && setAuthMode('signup')}>
                  <div className="w-7 h-7 rounded-full bg-purple-500 flex items-center justify-center text-white text-[10px] font-black">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-white truncate">{user?.name || 'Join Lore'}</p>
                    <p className="text-[9px] text-zinc-600 truncate uppercase tracking-widest font-bold">Free Plan</p>
                  </div>
               </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="px-6 py-4 flex justify-between items-center z-40">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 glass rounded-lg hover:text-white transition-all text-zinc-500">
            {sidebarOpen ? <X size={14}/> : <Menu size={14} />}
          </button>
          <div className="flex items-center gap-2 text-[9px] font-black text-zinc-800 uppercase tracking-widest">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500/40" />
            <span>Lore Engine v1.0</span>
          </div>
          <div className="flex items-center gap-4">
            {!token && (
              <div className="flex items-center gap-2">
                <button onClick={() => setAuthMode('login')} className="px-4 py-1.5 text-zinc-500 hover:text-white font-bold text-[10px] transition-all uppercase tracking-widest">Sign In</button>
                <button onClick={() => setAuthMode('signup')} className="px-4 py-1.5 bg-purple-600 text-white rounded-full font-black text-[10px] hover:bg-purple-500 transition-all shadow-lg shadow-purple-500/20 uppercase tracking-widest">Sign Up</button>
              </div>
            )}
            <button className="text-zinc-800 hover:text-white transition-all"><Settings size={14} /></button>
          </div>
        </header>

        <main className="flex-1 flex flex-col relative overflow-y-auto scrollbar-hide">
          <AnimatePresence mode="wait">
            {view === 'landing' ? (
              <motion.div 
                key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.99 }}
                className="min-h-full flex flex-col items-center justify-center p-6 gap-8 pb-32"
              >
                <div className="w-full max-w-2xl flex flex-col gap-10">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <motion.h1 initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-serif text-3xl sm:text-5xl leading-tight text-white tracking-tight">
                      Hello, {user?.name?.split(' ')[0] || 'there'}.<br />
                      <span className="opacity-40 font-sans font-light">What's on your mind?</span>
                    </motion.h1>
                  </div>

                  <div className="w-full flex flex-col gap-6">
                    {/* Magical Search Bar */}
                    <div className="energy-border glass-dark rounded-full px-2 py-2 flex items-center gap-4 shadow-2xl relative">
                      <div className="pl-2">
                        <BunnyIcon size={42} />
                      </div>
                      <form onSubmit={handleSearch} className="flex-1 flex items-center">
                        <input 
                          type="text"
                          value={query} onChange={(e) => setQuery(e.target.value)}
                          placeholder="Ask Lore anything..."
                          className="w-full bg-transparent px-2 py-4 focus:outline-none placeholder:text-zinc-700 text-white text-lg"
                        />
                        <button type="submit" className={twMerge("w-12 h-12 rounded-full flex items-center justify-center transition-all mr-2", query.trim() ? "bg-purple-600 text-white shadow-lg shadow-purple-500/40" : "bg-zinc-800 text-zinc-600")}>
                          <ArrowUp size={24} />
                        </button>
                      </form>
                    </div>

                    <div className="flex flex-wrap justify-center gap-2">
                      {suggestions.map((s, i) => (
                        <button 
                          key={i} 
                          onClick={() => { setQuery(s); handleSearch(null, s); }}
                          className="px-4 py-1.5 glass rounded-full text-[11px] text-zinc-500 hover:text-purple-300 hover:border-purple-500/30 transition-all flex items-center gap-2 group"
                        >
                          <Zap size={10} className="text-zinc-700 group-hover:text-purple-500 transition-colors" />
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-4xl mx-auto p-6 sm:p-16 pb-32"
              >
                <div className="flex flex-col gap-10">
                   <div className="flex items-start gap-4">
                      <BunnyIcon size={40} />
                      <h2 className="font-serif text-3xl sm:text-4xl text-white leading-tight tracking-tight pt-1">{query}</h2>
                   </div>

                   <div className="pl-0 sm:pl-14 flex flex-col gap-8 mt-4">
                      {error && (
                        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center">
                          {error}
                        </div>
                      )}
                      {isLoading ? (
                        <div className="flex flex-col gap-6 opacity-30">
                          <div className="space-y-3">
                            <div className="h-4 w-3/4 bg-zinc-800 rounded-full animate-pulse"></div>
                            <div className="h-4 w-full bg-zinc-800 rounded-full animate-pulse"></div>
                          </div>
                          <div className="text-[10px] uppercase tracking-[0.2em] text-purple-500 font-black flex items-center gap-2">
                             <Loader2 className="animate-spin" size={12} />Grounding...
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-10">
                           <div className="prose prose-invert max-w-none text-zinc-300 text-lg sm:text-xl leading-relaxed font-light space-y-8 animate-in fade-in duration-700">
                              {streamedText.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
                           </div>

                           {sources.length > 0 && (
                             <div className="pt-10 border-t border-white/5">
                                <h3 className="text-[9px] uppercase tracking-[0.2em] text-zinc-700 font-black mb-6 px-1">Sources</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                   {sources.map((s, i) => (
                                     <a key={i} href={s.url} target="_blank" className="p-5 glass-dark rounded-2xl border border-white/5 hover:border-purple-500/30 transition-all group">
                                        <div className="flex flex-col gap-2">
                                           <span className="text-[8px] text-zinc-700 uppercase tracking-widest font-black block">{new URL(s.url).hostname}</span>
                                           <p className="text-[13px] text-zinc-400 font-bold group-hover:text-white line-clamp-1 leading-snug">{s.title}</p>
                                        </div>
                                     </a>
                                   ))}
                                </div>
                             </div>
                           )}
                        </div>
                      )}
                   </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* --- Auth Modal --- */}
      <AnimatePresence>
        {authMode && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setAuthMode(null)} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
             <motion.div initial={{ opacity: 0, scale: 0.98, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 10 }} className="relative w-full max-w-[380px] bg-[#0A0A0A] border border-white/5 rounded-[32px] p-10 shadow-2xl">
               <button onClick={() => setAuthMode(null)} className="absolute top-6 right-6 text-zinc-600 hover:text-white transition-colors"><X size={20}/></button>
               <div className="text-center mb-8">
                  <div className="flex justify-center mb-5"><BunnyIcon size={48} /></div>
                  <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">{authMode === 'signup' ? 'Join Lore' : 'Welcome Back'}</h2>
                  <p className="text-[13px] text-zinc-500 font-medium">Research history synced.</p>
               </div>
               <form onSubmit={handleAuth} className="flex flex-col gap-3">
                  {authMode === 'signup' && (
                    <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl p-4 text-[14px] focus:outline-none focus:border-purple-500/50 text-white transition-all" />
                  )}
                  <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl p-4 text-[14px] focus:outline-none focus:border-purple-500/50 text-white transition-all" />
                  <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-white/5 border border-white/5 rounded-xl p-4 text-[14px] focus:outline-none focus:border-purple-500/50 text-white transition-all" />
                  {error && <p className="text-[11px] text-red-500 mt-1 text-center font-bold">{error}</p>}
                  <button type="submit" className="w-full py-4 bg-purple-600 text-white rounded-xl text-[14px] font-black hover:bg-purple-500 transition-all mt-4">
                     {authMode === 'signup' ? 'Create Account' : 'Sign In'}
                  </button>
               </form>
               <button onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setError(null); }} className="w-full text-center text-[11px] text-zinc-600 hover:text-white mt-8 transition-colors font-bold uppercase tracking-widest">
                  {authMode === 'login' ? "Switch to Sign Up" : "Switch to Sign In"}
               </button>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App; 
