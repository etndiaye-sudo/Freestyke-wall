import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NAMES = { it: 'Italian', en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese' };

// Rime già scritte, usate quando il server non ha la chiave API
const BANK = [
  ['ore', 'Ho il flow nel sangue e il fuoco nel cuore|rimo sempre e non perdo il valore'],
  ['ata', 'Entro nel beat, serata infuocata|la tua rima è già finita, spacciata'],
  ['ia', 'Il microfono è la mia magia|ti seguo un attimo e poi ti porto via'],
  ['ento', 'Rimo veloce come il vento|ti rispondo in un momento'],
  ['one', 'Sono il re di ogni canzone|tu mi sfidi? Sei un pallone'],
  ['ino', 'Rimo dal mattino al tavolino|il mio flow è sempre più fino'],
  ['ale', 'Il mio flow è fuori dal normale|ogni barra è un colpo mortale'],
  ['are', 'Con il beat mi metto a rappare|nessun rapper mi può fermare'],
  ['ere', 'Scrivo rime e prendo il potere|tu mi ascolti e resti a tacere'],
  ['ita', 'Metto in rima tutta la mia vita|la mia penna è una salita infinita'],
  ['ato', 'Il mio flow è sempre affilato|tu rimani lì, spiazzato'],
  ['à', 'Rimo forte in questa città|il mio flow non si fermerà'],
  ['ano', 'Microfono in mano, flow sovrano|il palco è mio e tu sei lontano'],
  ['ura', 'Rimo senza nessuna paura|la mia barra è dura'],
  ['oco', "Dentro al microfono c'è un fuoco|tu sei freddo, vieni a fare poco"]
];

const GEN = {
  it: ['Hai detto «{w}»? Ti rispondo sul beat|la mia rima è un tuono, sei di troppo qui',
       '«{w}» è un buon inizio, ma sono più veloce|io spezzo il ritmo e tu perdi la voce',
       'Con «{w}» non mi fai paura|il mio flow è una scarica, la tua barra è scura'],
  en: ["You said «{w}»? I'll answer on the beat|my rhyme is thunder, you can't compete",
       "«{w}» is a decent start, but I'm quicker, I'm told|I break the rhythm and the stage is mine to hold",
       "With «{w}» you can't scare me|my flow hits harder, just wait and see"],
  es: ['¿Dijiste «{w}»? Te respondo al compás|mi rima es un trueno, no me alcanzarás',
       '«{w}» es un buen inicio, pero voy más veloz|rompo el ritmo y te quedas sin voz',
       'Con «{w}» no me das miedo|mi flow pega fuerte, no me quedo quieto'],
  fr: ['Tu dis «{w}» ? Je réponds dans l\'instant|ma rime est un orage, mon flow est puissant',
       '«{w}» c\'est un bon début, mais moi je vais plus vite|je casse le rythme et toi tu prends la fuite',
       'Avec «{w}» tu ne me fais pas peur|mon flow tape fort, c\'est ma couleur'],
  de: ['Du sagst «{w}»? Ich antworte im Takt|mein Reim ist Donner, der dich packt',
       '«{w}» ist okay, doch ich bin schneller und klar|mein Flow trifft hart, das ist ja wohl wahr',
       'Mit «{w}» machst du mir keine Angst|mein Flow ist Feuer, wenn du nur wankst'],
  pt: ['Disse «{w}»? Respondo no compasso|minha rima é um trovão, não te dou espaço',
       '«{w}» é um bom começo, mas eu sou mais veloz|quebro o ritmo e você perde a voz',
       'Com «{w}» você não me assusta|meu flow é pesado e a minha rima é justa']
};

const BIS = {
  it: 'Con «{w}» ti faccio un bis: lo prendo, lo spezzo, ora tocca a te',
  en: "I'll take «{w}», break it, and run it back: your turn",
  es: 'Tomo «{w}», lo rompo y lo devuelvo: ahora te toca',
  fr: 'Je prends «{w}», je le brise et je le rends : à toi',
  de: "Ich nehm «{w}», brech es auf und gib's zurück: du bist dran",
  pt: 'Pego «{w}», quebro e devolvo: agora é a sua vez'
};

function lastWord(t) {
  const w = t.toLowerCase().replace(/[^\p{L}\s']/gu, '').trim().split(/\s+/);
  return w[w.length - 1] || '';
}

function localReply(text, level, lang) {
  const w = lastWord(text) || '…';
  let pick = null;
  if (lang === 'it') {
    for (const [end, bar] of BANK) {
      if (w.length > 2 && w.endsWith(end) && w !== end) { pick = bar; break; }
    }
  }
  if (!pick) {
    const g = GEN[lang];
    pick = g[Math.floor(Math.random() * g.length)].replace('{w}', w);
  }
  const p = pick.split('|');
  if (level === 1) return p[0];
  if (level === 2) return p.join('\n');
  return p.join('\n') + '\n' + BIS[lang].replace('{w}', w);
}

const app = express();
app.use(express.json({ limit: '20kb' }));
// la pagina è divisa in 3 parti, il server le unisce
const PARTS = ['p1.html', 'p2.html', 'p3.html'];
app.get('/', (_req, res) => {
  try {
    const html = PARTS.map(f => fs.readFileSync(path.join(__dirname, f), 'utf8')).join('');
    res.type('html').send(html);
  } catch (e) {
    console.error(e);
    res.status(500).send('Pagina non trovata');
  }
});

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || 'claude-haiku-4-5-20251001';

function system(lang, level) {
  return `You are a rapper doing freestyle with the user.
Reply ONLY with the bars, one per line, in ${NAMES[lang]}, with no explanations, no quotation marks and no emoji.
Rhyme with the user's last word or last idea and stay on topic.
Playful, rhythmic tone: no heavy insults, no hate.
` + LEVELS[level];
}

const LEVELS = {
  1: 'Level Beginner: 1 short bar, simple coupled rhymes, relaxed flow.',
  2: 'Level Rapper: 2 bars in coupled rhyme, some simple wordplay.',
  3: 'Level Boss: 4 bars with internal and multisyllabic rhymes, clever links, a final punchline, fast flow.'
};

// limite semplice per proteggere la chiave: 20 richieste al minuto per IP
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 20;
}

function cleanHistory(h) {
  if (!Array.isArray(h)) return [];
  const out = h
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 300) }))
    .slice(-8);
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

app.post('/api/rap', async (req, res) => {
  if (limited(req.ip)) return res.status(429).json({ error: 'Too many requests' });

  const level = [1, 2, 3].includes(Number(req.body.level)) ? Number(req.body.level) : 2;
  const lang = NAMES[req.body.lang] ? req.body.lang : 'en';
  const messages = cleanHistory(req.body.history);
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Missing message' });
  }

  // senza chiave API: rime già scritte (gratis)
  if (!API_KEY) {
    return res.json({ text: localReply(messages[messages.length - 1].content, level, lang), mode: 'local' });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: MODEL, max_tokens: 220, system: system(lang, level), messages })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('API error:', data);
      return res.status(502).json({ error: 'Model error' });
    }
    const text = (data.content || []).map(b => b.text || '').join('').trim();
    res.json({ text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/health', (_req, res) => res.send('ok'));
app.set('trust proxy', 1);
app.listen(process.env.PORT || 3000, () => console.log('Freestyle Wall running'));
