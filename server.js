const express = require('express'), fs = require('fs'), path = require('path');
const app = express();
const DB = path.join(__dirname, 'data', 'projects.json');
const MSG = path.join(__dirname, 'data', 'messages.json');
const KEY = process.env.ADMIN_KEY || 'change-me';
const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return []; } };
const write = (f, d) => fs.writeFileSync(f, JSON.stringify(d, null, 2));
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const slugify = s => str(s, 80).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hex = (v, d) => /^#[0-9a-f]{6}$/i.test(v) ? v : d;
const clean = (b, old = {}) => ({
  slug: old.slug || slugify(b.title),
  title: str(b.title, 80), category: str(b.category, 60), year: str(b.year, 10),
  role: str(b.role, 80), summary: str(b.summary, 1500),
  bg: hex(b.bg, '#222222'), fg: hex(b.fg, '#ffffff'),
  image: str(b.image, 500),
  gallery: (Array.isArray(b.gallery) ? b.gallery : []).map(u => str(u, 500)).filter(Boolean).slice(0, 30),
  order: Number.isFinite(+b.order) ? +b.order : (old.order ?? 99)
});
const auth = (req, res, next) =>
  req.get('x-admin-key') === KEY ? next() : res.status(401).json({ error: 'Wrong admin key.' });

app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/projects', (q, s) => s.json(read(DB).sort((a, b) => a.order - b.order)));
app.get('/api/projects/:slug', (q, s) => {
  const p = read(DB).find(x => x.slug === q.params.slug);
  p ? s.json(p) : s.status(404).json({ error: 'Project not found.' });
});
app.post('/api/projects', auth, (q, s) => {
  const list = read(DB), p = clean(q.body);
  if (!p.title || !p.slug) return s.status(400).json({ error: 'Title is required.' });
  if (list.some(x => x.slug === p.slug)) return s.status(409).json({ error: 'A project with this title already exists.' });
  list.push(p); write(DB, list); s.status(201).json(p);
});
app.put('/api/projects/:slug', auth, (q, s) => {
  const list = read(DB), i = list.findIndex(x => x.slug === q.params.slug);
  if (i < 0) return s.status(404).json({ error: 'Project not found.' });
  list[i] = clean(q.body, list[i]); write(DB, list); s.json(list[i]);
});
app.delete('/api/projects/:slug', auth, (q, s) => {
  write(DB, read(DB).filter(x => x.slug !== q.params.slug)); s.json({ ok: true });
});

const hits = new Map();
app.post('/api/contact', (q, s) => {
  const now = Date.now(), recent = (hits.get(q.ip) || []).filter(t => now - t < 3600e3);
  if (recent.length >= 5) return s.status(429).json({ error: 'Too many messages. Try again in an hour.' });
  const { name, email, message, website } = q.body || {};
  if (website) return s.json({ ok: true }); // honeypot
  if (!str(name, 80) || !/^\S+@\S+\.\S+$/.test(str(email, 120)) || str(message, 3000).length < 10)
    return s.status(400).json({ error: 'Add your name, a valid email and a message of at least 10 characters.' });
  hits.set(q.ip, [...recent, now]);
  const all = read(MSG);
  all.push({ name: str(name, 80), email: str(email, 120), message: str(message, 3000), at: new Date().toISOString() });
  write(MSG, all); s.json({ ok: true });
});
app.get('/api/messages', auth, (q, s) => s.json(read(MSG).reverse()));

app.listen(process.env.PORT || 3000, () => console.log('Portfolio running on http://localhost:' + (process.env.PORT || 3000)));
