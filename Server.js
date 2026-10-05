import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Rime già scritte: si usano quando il server non ha la chiave API
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

const GEN = [
  'Hai detto «W»? Ti rispondo sul beat|la mia rima è un tuono, sei di troppo qui',
  '«W» è un buon inizio, ma sono più veloce|io spezzo il ritmo e tu perdi la voce',
  'Con «W» non mi fai paura|il mio flow è una scarica, la tua barra è scura'
];

function lastWord(t) {
  const w = t.toLowerCase().replace(/[^a-zàèéìòù\s']/g, '').trim().split(/\s+/);
  return w[w.length - 1] || '';
}

function localReply(text, level) {
  const w = lastWord(text);
  let pick = null;
  for (const [end, bar] of BANK) {
    if (w.length > 2 && w.endsWith(end) && w !== end) { pick = bar; break; }
  }
  if (!pick) pick = GEN[Math.floor(Math.random() * GEN.length)].replace('W', w || 'questo');
  const p = pick.split('|');
  if (level === 1) return p[0];
  if (level === 2) return p.join('\n');
  return p.join('\n') + `\nCon «${w || 'beat'}» ti faccio un bis: lo prendo, lo spezzo, ora tocca a te`;
}


const app = express();
app.use(express.json({ limit: '20kb' }));
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL || 'claude-haiku-4-5-20251001';

const BASE = `Sei un rapper italiano che fa freestyle con l'utente.
Rispondi SOLO con le barre, in italiano, una per riga, senza spiegazioni, senza virgolette e senza emoji.
Rima con l'ultima parola o l'ultimo concetto dell'utente e restagli in tema.
Tono di sfida giocosa e ritmica: niente insulti pesanti, niente odio.`;

const LEVELS = {
  1: 'Livello Principiante: 1 sola barra corta, rime semplici e baciate, flow tranquillo.',
  2: 'Livello Rapper: 2 barre in rima baciata, qualche gioco di parole semplice.',
  3: 'Livello Boss: 4 barre con rime interne e multisillabiche, incastri, punchline finale, flow veloce.'
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
  if (limited(req.ip)) return res.status(429).json({ error: 'Troppe richieste, aspetta un attimo' });

  const level = [1, 2, 3].includes(Number(req.body.level)) ? Number(req.body.level) : 2;
  const messages = cleanHistory(req.body.history);
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Messaggio mancante' });
  }

  // senza chiave API: usa le rime già scritte (gratis)
  if (!API_KEY) {
    return res.json({ text: localReply(messages[messages.length - 1].content, level), mode: 'locale' });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 220,
        system: BASE + '\n' + LEVELS[level],
        messages
      })
    });
    const data = await r.json();
    if (!r.ok) {
      console.error('Errore API:', data);
      return res.status(502).json({ error: 'Errore dal modello' });
    }
    const text = (data.content || []).map(b => b.text || '').join('').trim();
    res.json({ text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Errore del server' });
  }
});

app.get('/health', (_req, res) => res.send('ok'));
app.set('trust proxy', 1);
app.listen(process.env.PORT || 3000, () => console.log('Freestyle Wall attivo'));
