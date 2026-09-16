import { useMutation } from '@tanstack/react-query';
import { Bot, RotateCcw, Send, Sparkles, UserRound } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { AuthRequired } from '../components/AuthRequired';
import { Button } from '../components/ui/Button';
import { api, hasAccessToken, subscribeToAccessToken, type AssistantResponse, type Product } from '../lib/api';
import { money } from '../lib/utils';

type ChatMessage = { role: 'user' | 'assistant'; content: string; products?: Product[]; suggestions?: string[] };
const greeting: ChatMessage = { role: 'assistant', content: 'Hi, I’m Nile Guide. Tell me what you’re shopping for, your budget, or what matters most, and I’ll find the best matches in the bazaar.', suggestions: ['A gift under EGP 1,000', 'Help me upgrade my workspace', 'Show me everyday fashion'] };

export function AssistantPage() {
  const authenticated = useSyncExternalStore(subscribeToAccessToken, hasAccessToken, () => false);
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const assistant = useMutation({
    mutationFn: (nextMessages: ChatMessage[]) => api<AssistantResponse>('/ai/assistant', { method: 'POST', body: JSON.stringify({ messages: nextMessages.slice(-12).map(({ role, content }) => ({ role, content })) }) }),
    onSuccess: (result) => setMessages((current) => [...current, { role: 'assistant', content: result.reply, products: result.products, suggestions: result.suggestions }]),
  });
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [messages, assistant.isPending]);
  if (!authenticated) return <AuthRequired title="Meet your AI shopping guide"/>;
  const send = (value: string) => {
    const content = value.trim();
    if (!content || assistant.isPending) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next); setInput(''); assistant.mutate(next);
  };
  return <main className="container-shell py-10 md:py-14"><div className="mx-auto max-w-5xl"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[.18em] text-nile"><Sparkles size={16}/>Gemini-powered</p><h1 className="mt-2 font-display text-5xl font-bold">Nile Guide</h1><p className="mt-3 max-w-2xl text-ink/55">Describe what you need naturally. Your guide compares the live catalog and recommends products that are actually available.</p></div><Button variant="outline" onClick={() => { setMessages([greeting]); setInput(''); assistant.reset(); }}><RotateCcw size={16}/>New conversation</Button></div>
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-ink/10 bg-white shadow-[0_20px_70px_rgba(19,33,27,.08)]"><div className="h-[58vh] min-h-[480px] overflow-y-auto bg-sand/35 p-4 sm:p-7"><div className="mx-auto flex max-w-3xl flex-col gap-6">{messages.map((message, index) => <div key={index} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>{message.role === 'assistant' && <span className="grid size-9 shrink-0 place-items-center rounded-full bg-nile text-white"><Bot size={18}/></span>}<div className={`max-w-[85%] ${message.role === 'user' ? 'rounded-2xl rounded-tr-sm bg-ink px-4 py-3 text-white' : 'min-w-0'}`}><p className={`text-sm leading-6 ${message.role === 'assistant' ? 'rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm' : ''}`}>{message.content}</p>{message.products && message.products.length > 0 && <div className="mt-3 grid gap-3 sm:grid-cols-2">{message.products.map((product) => <Link key={product.id} to={`/products/${product.slug}`} className="flex gap-3 rounded-2xl border border-ink/8 bg-white p-3 transition hover:border-nile/40 hover:shadow-md"><img src={product.imageUrl} alt="" className="size-20 shrink-0 rounded-xl object-cover"/><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-nile">{product.category.name}</p><h2 className="mt-1 line-clamp-2 text-sm font-semibold">{product.name}</h2><p className="mt-2 text-sm font-bold">{money(product.price)}</p></div></Link>)}</div>}{message.suggestions && message.suggestions.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{message.suggestions.map((suggestion) => <button key={suggestion} onClick={() => send(suggestion)} className="rounded-full border border-nile/20 bg-white px-3 py-2 text-left text-xs font-semibold text-nile hover:bg-nile-light">{suggestion}</button>)}</div>}</div>{message.role === 'user' && <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink/10"><UserRound size={17}/></span>}</div>)}{assistant.isPending && <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-nile text-white"><Bot size={18}/></span><div className="flex gap-1 rounded-2xl rounded-tl-sm bg-white px-4 py-4 shadow-sm" aria-label="Nile Guide is thinking"><span className="size-2 animate-bounce rounded-full bg-nile/40"/><span className="size-2 animate-bounce rounded-full bg-nile/60 [animation-delay:120ms]"/><span className="size-2 animate-bounce rounded-full bg-nile [animation-delay:240ms]"/></div></div>}{assistant.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{assistant.error instanceof Error ? assistant.error.message : 'Nile Guide could not respond. Please try again.'}</p>}<div ref={endRef}/></div></div>
      <form className="flex gap-3 border-t border-ink/10 bg-white p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); send(input); }}><input value={input} onChange={(event) => setInput(event.target.value)} maxLength={800} placeholder="Example: I need a useful gift under EGP 800…" aria-label="Message Nile Guide" className="min-w-0 flex-1 rounded-full border border-ink/12 px-5 py-3 outline-none focus:border-nile"/><Button type="submit" size="icon" className="size-12 shrink-0" disabled={!input.trim() || assistant.isPending} aria-label="Send message"><Send size={18}/></Button></form></section>
    <p className="mt-3 text-center text-xs text-ink/40">AI can make mistakes. Check product details before purchasing.</p></div></main>;
}
