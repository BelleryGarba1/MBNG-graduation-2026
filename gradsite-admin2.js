/* Admin dashboard. Edits a DRAFT on the server; "Publish" makes it live for visitors. */
(function () {
  'use strict';
  const app = document.getElementById('app');
  const toastEl = document.getElementById('toast');
  let content = null, dirty = false, tab = 'general', saving = false;

  /* ---------- helpers ---------- */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
    return e;
  }
  const uid = () => Math.random().toString(36).slice(2, 9);
  let toastTimer;
  function toast(msg, bad) {
    toastEl.textContent = msg; toastEl.className = 'toast show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 3200);
  }
  const CFG = window.SITE_CONFIG || {};
  const configured = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY) && !/YOUR/.test(CFG.SUPABASE_URL);
  const sb = configured && window.supabase ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;
  const friendly = (err) => /row-level security|permission|not authorized|403/i.test(err.message || '')
    ? 'This account is not allowed to edit the site. Check the email in supabase-setup.sql.' : (err.message || 'Something went wrong.');
  async function dbGet(id) {
    const { data, error } = await sb.from('site_content').select('data').eq('id', id).maybeSingle();
    if (error) throw new Error(friendly(error));
    return data ? data.data : null;
  }
  async function dbSet(id, value) {
    const { error } = await sb.from('site_content').upsert({ id, data: value, updated_at: new Date().toISOString() });
    if (error) throw new Error(friendly(error));
  }
  function markDirty() { dirty = true; const s = document.getElementById('status'); if (s) { s.textContent = 'Unsaved changes'; s.className = 'status dirty'; } }
  window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- reusable field components ---------- */
  function text(label, obj, key, hint) {
    return h('label', { class: 'field' }, h('span', null, label),
      h('input', { type: 'text', value: obj[key] || '', oninput: (e) => { obj[key] = e.target.value; markDirty(); } }), hint ? h('small', null, hint) : null);
  }
  function area(label, obj, key, rows, hint) {
    return h('label', { class: 'field' }, h('span', null, label),
      h('textarea', { rows: rows || 4, value: obj[key] || '', oninput: (e) => { obj[key] = e.target.value; markDirty(); } }), hint ? h('small', null, hint) : null);
  }
  /* A list of paragraphs edited in one box; a blank line starts a new paragraph */
  function paragraphs(label, obj, key, hint) {
    return h('label', { class: 'field' }, h('span', null, label),
      h('textarea', { rows: 9, value: (obj[key] || []).join('\n\n'), oninput: (e) => { obj[key] = e.target.value.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean); markDirty(); } }),
      h('small', null, hint || 'Leave a blank line between paragraphs.'));
  }

  /* Downscale big phone photos before uploading so the site stays fast */
  async function prepareImage(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    try {
      const bmp = await createImageBitmap(file);
      const max = 1800, scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(bmp.width * scale); cv.height = Math.round(bmp.height * scale);
      cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
      const blob = await new Promise((res) => cv.toBlob(res, 'image/jpeg', 0.86));
      return blob && blob.size < file.size ? blob : file;
    } catch (_) { return file; }
  }
  async function uploadFile(file) {
    const prepared = await prepareImage(file);
    if (prepared.size > 5 * 1024 * 1024) throw new Error('That photo is too large (max 5 MB).');
    const type = prepared.type || 'image/jpeg';
    const ext = type === 'image/jpeg' ? 'jpg' : type.split('/')[1] || 'jpg';
    const path = Date.now() + '-' + uid() + '.' + ext;
    const { error } = await sb.storage.from('photos').upload(path, prepared, { contentType: type, cacheControl: '31536000', upsert: false });
    if (error) throw new Error(friendly(error));
    return sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
  }

  /* One optional photo: choose, replace or remove */
  function photo(label, obj, key, hint) {
    const box = h('div', { class: 'photo-field' });
    function draw() {
      const input = h('input', { type: 'file', accept: 'image/*', id: 'f' + uid(), onchange: async (e) => {
        const f = e.target.files[0]; if (!f) return;
        try { toast('Uploading…'); obj[key] = await uploadFile(f); markDirty(); toast('Photo added'); draw(); } catch (err) { toast(err.message, true); }
      } });
      box.replaceChildren(
        obj[key] ? h('img', { class: 'thumb', src: obj[key], alt: '' }) : h('div', { class: 'thumb' }, 'No photo'),
        h('div', null, h('strong', null, label), hint ? h('div', { class: 'hint' }, hint) : null,
          h('div', { class: 'photo-actions' },
            h('label', { class: 'btn small green', for: input.id }, obj[key] ? 'Change photo' : 'Add photo'), input,
            obj[key] ? h('button', { type: 'button', class: 'btn small danger', onclick: () => { obj[key] = ''; markDirty(); draw(); } }, 'Remove photo') : null)));
    }
    draw(); return box;
  }

  /* Editable list with add / remove / reorder */
  function list(arr, opts) {
    const box = h('div');
    function draw() {
      box.replaceChildren(
        ...arr.map((item, i) => h('div', { class: 'group' },
          h('div', { class: 'group-head' }, h('strong', null, opts.title(item, i) || opts.empty || 'New item'),
            h('div', { class: 'row-actions' },
              i > 0 ? h('button', { type: 'button', class: 'btn small', 'aria-label': 'Move up', onclick: () => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; markDirty(); draw(); } }, '↑') : null,
              i < arr.length - 1 ? h('button', { type: 'button', class: 'btn small', 'aria-label': 'Move down', onclick: () => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; markDirty(); draw(); } }, '↓') : null,
              h('button', { type: 'button', class: 'btn small danger', onclick: () => { if (confirm('Remove this item?')) { arr.splice(i, 1); markDirty(); draw(); } } }, 'Remove'))),
          opts.fields(item))),
        h('button', { type: 'button', class: 'btn green', onclick: () => { arr.push(opts.blank()); markDirty(); draw(); } }, opts.add || 'Add'));
    }
    draw(); return box;
  }

  /* ---------- tabs ---------- */
  const TABS = [
    ['general', 'Home & Site', () => [
      h('p', { class: 'hint' }, 'The top of your website. Add a graduation photo for the arch frame; a placeholder shows until you do.'),
      text('Browser tab title', content.site, 'title'), text('Motto (shown in footer)', content.site, 'motto'),
      area('Short description for Google and WhatsApp previews', content.site, 'description', 3),
      photo('Hero graduation photo', content.hero, 'photo', 'Portrait photos work best.'),
      text('Name', content.hero, 'name'), text('Qualification', content.hero, 'degree'), text('University', content.hero, 'school'), text('Year', content.hero, 'year'),
      area('Main headline', content.hero, 'headline', 3), area('Subheading', content.hero, 'subheading', 4), text('Button text', content.hero, 'button')]],
    ['about', 'About Me', () => [
      area('Biography', content.bio, 'paragraph', 9, 'Leave a blank line between paragraphs.'),
      photo('Biography photo (optional)', content.bio, 'photo'),
      h('h3', null, 'Quick facts'),
      list(content.bio.facts, { title: (f) => f.label, add: 'Add a fact', blank: () => ({ label: '', value: '' }), fields: (f) => [text('Label', f, 'label'), text('Value', f, 'value')] })]],
    ['achievements', 'Achievements', () => [
      h('p', { class: 'hint' }, 'Use the category "Academic" or "Leadership" so items are grouped on the site. Any other category creates a new group.'),
      list(content.achievements, { title: (a) => a.title, add: 'Add an achievement', blank: () => ({ id: uid(), category: 'Academic', title: '', text: '' }),
        fields: (a) => [text('Category', a, 'category'), text('Title', a, 'title'), area('Details', a, 'text', 3)] })]],
    ['skills', 'Skills & Goals', () => [
      h('h3', null, 'Skills and interests'),
      (() => { const wrap = h('div'); const items = content.skills.map((s) => ({ v: s }));
        const sync = () => { content.skills = items.map((i) => i.v).filter((v) => v.trim()); markDirty(); };
        const l = list(items, { title: (i) => i.v, add: 'Add a skill', blank: () => ({ v: '' }), fields: (i) => [h('label', { class: 'field' }, h('span', null, 'Skill'), h('input', { type: 'text', value: i.v, oninput: (e) => { i.v = e.target.value; sync(); } }))] });
        l.addEventListener('click', () => setTimeout(sync, 0)); wrap.append(l); return wrap; })(),
      area('Future goals', content, 'goals', 5)]],
    ['timeline', 'Journey', () => [
      list(content.timeline, { title: (t) => (t.year || '') + ' — ' + (t.title || ''), add: 'Add a milestone', blank: () => ({ year: '', title: '', text: '' }),
        fields: (t) => [text('Year', t, 'year'), text('Title', t, 'title'), area('Description', t, 'text', 3)] })]],
    ['gallery', 'Gallery', () => [galleryPanel()]],
    ['appreciation', 'Appreciation', () => [
      text('Section title', content.appreciation, 'title'),
      paragraphs('Opening passage', content.appreciation, 'intro'),
      h('h3', null, 'Appreciation cards'),
      list(content.appreciation.categories, { title: (c) => c.title, add: 'Add a card', blank: () => ({ id: uid(), title: '', text: '' }), fields: (c) => [text('Title', c, 'title'), area('Message', c, 'text', 4)] }),
      h('h3', null, 'Special individuals'),
      h('p', { class: 'hint' }, 'A photo is completely optional. Without one, the card shows only the name and message.'),
      text('Heading for this group', content.appreciation, 'peopleTitle'),
      list(content.appreciation.people, { title: (p) => p.name, empty: 'New person', add: 'Add a person', blank: () => ({ id: uid(), name: '', relation: '', message: '', prayer: '', photo: '' }),
        fields: (p) => [text('Full name', p, 'name'), text('Relationship or title', p, 'relation'), area('Appreciation message', p, 'message', 5), area('Short prayer (optional)', p, 'prayer', 2), photo('Photo (optional)', p, 'photo')] })]],
    ['messages', 'Messages', () => messagesPanel()],
    ['thanks', 'Thank You', () => [text('Title', content.thanks, 'title'), paragraphs('Message', content.thanks, 'paragraphs')]],
    ['quotes', 'Quotes', () => [area('Main quote', content.quotes, 'main', 3), area('Additional quote', content.quotes, 'extra', 3)]],
    ['social', 'Social & Footer', () => [
      h('p', { class: 'hint' }, 'Leave a link empty to hide its icon. Use full links starting with https://. For WhatsApp you can type a phone number with country code, e.g. 2348012345678.'),
      text('Facebook', content.social, 'facebook'), text('Instagram', content.social, 'instagram'), text('WhatsApp', content.social, 'whatsapp'),
      text('LinkedIn', content.social, 'linkedin'), text('GitHub', content.social, 'github'), text('Email address', content.social, 'email'),
      h('h3', null, 'Footer text'), text('Copyright line', content.footer, 'copyright'), text('Second line', content.footer, 'line2'), text('Closing line', content.footer, 'closing')]]
  ];

  /* Visitor messages: approve before they appear on the site (approvals take effect immediately) */
  function messagesPanel() {
    content.messages = content.messages || { title: 'Leave Me a Message', intro: '' };
    const listBox = h('div', null, h('p', { class: 'hint' }, 'Loading messages…'));
    async function drawList() {
      const { data, error } = await sb.from('messages').select('*').order('created_at', { ascending: false });
      if (error) { listBox.replaceChildren(h('p', { class: 'err' }, 'Could not load messages. Have you run supabase-messages.sql in Supabase?')); return; }
      const pending = data.filter((m) => !m.approved).length;
      const act = async (promise) => { const { error: e } = await promise; if (e) toast(friendly(e), true); else drawList(); };
      listBox.replaceChildren(
        h('h3', null, pending ? pending + ' waiting for your approval' : 'No messages waiting'),
        ...data.map((m) => h('div', { class: 'group' },
          h('div', { class: 'group-head' }, h('strong', null, m.name + (m.approved ? ' (showing on site)' : ' (hidden, waiting)')),
            h('div', { class: 'row-actions' },
              h('button', { type: 'button', class: 'btn small ' + (m.approved ? '' : 'green'), onclick: () => act(sb.from('messages').update({ approved: !m.approved }).eq('id', m.id)) }, m.approved ? 'Hide' : 'Approve'),
              h('button', { type: 'button', class: 'btn small danger', onclick: () => { if (confirm('Delete this message for good?')) act(sb.from('messages').delete().eq('id', m.id)); } }, 'Delete'))),
          h('p', { class: 'msg-body' }, m.message))),
        data.length ? null : h('p', { class: 'hint' }, 'Messages from visitors will appear here.'));
    }
    drawList();
    return [h('h3', null, 'Section text'), h('p', { class: 'hint' }, 'These two boxes are part of your draft. Save and Publish to change them on the site.'),
      text('Section title', content.messages, 'title'), area('Short intro', content.messages, 'intro', 3), listBox];
  }

  function galleryPanel() {
    const wrap = h('div'), grid = h('div', { class: 'gallery-admin' });
    function draw() {
      grid.replaceChildren(...content.gallery.map((g, i) => h('div', { class: 'group' },
        g.src ? h('img', { class: 'thumb', src: g.src, alt: '' }) : h('div', { class: 'thumb' }, 'Placeholder'),
        text('Caption (optional)', g, 'caption'),
        h('div', { class: 'row-actions' },
          i > 0 ? h('button', { type: 'button', class: 'btn small', 'aria-label': 'Move earlier', onclick: () => { [content.gallery[i - 1], content.gallery[i]] = [content.gallery[i], content.gallery[i - 1]]; markDirty(); draw(); } }, '←') : null,
          i < content.gallery.length - 1 ? h('button', { type: 'button', class: 'btn small', 'aria-label': 'Move later', onclick: () => { [content.gallery[i + 1], content.gallery[i]] = [content.gallery[i], content.gallery[i + 1]]; markDirty(); draw(); } }, '→') : null,
          h('button', { type: 'button', class: 'btn small danger', onclick: () => { if (confirm('Remove this photo from the gallery?')) { content.gallery.splice(i, 1); markDirty(); draw(); } } }, 'Remove')))));
    }
    const input = h('input', { type: 'file', accept: 'image/*', multiple: true, id: 'gal-up', onchange: async (e) => {
      const files = [...e.target.files]; if (!files.length) return;
      // replace placeholder slots first so the grid doesn't fill with empty cards
      let n = 0;
      for (const f of files) {
        try {
          toast('Uploading ' + (++n) + ' of ' + files.length + '…');
          const url = await uploadFile(f);
          const empty = content.gallery.find((g) => !g.src);
          if (empty) { empty.src = url; if (/^(Graduation portrait|With my|In the gown|On campus|Celebrating)/.test(empty.caption || '')) empty.caption = ''; }
          else content.gallery.push({ id: uid(), src: url, caption: '' });
          markDirty();
        } catch (err) { toast(err.message, true); }
      }
      toast('Photos added. Remember to Save and Publish.'); draw(); e.target.value = '';
    } });
    wrap.append(h('p', { class: 'hint' }, 'Select several photos at once. The grey placeholder cards are replaced first. Large photos are resized automatically.'),
      h('div', { class: 'photo-actions' }, h('label', { class: 'btn green', for: 'gal-up' }, 'Upload photos'), input,
        h('button', { type: 'button', class: 'btn', onclick: () => { content.gallery.push({ id: uid(), src: '', caption: '' }); markDirty(); draw(); } }, 'Add empty slot')),
      h('p'), grid);
    draw(); return wrap;
  }

  /* ---------- screens ---------- */
  function showSetupHelp() {
    app.replaceChildren(h('div', { class: 'login' }, h('div', { class: 'card-box' },
      h('h1', null, 'Almost there'), h('p', null, 'Open config.js and paste your Supabase URL and anon key, then upload it again. The README has the step-by-step guide.'))));
  }
  function showLogin() {
    dirty = false;
    const err = h('p', { class: 'err', role: 'alert' });
    const email = h('input', { type: 'text', id: 'em', autocomplete: 'username', required: true, inputmode: 'email' });
    const pw = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true });
    app.replaceChildren(h('div', { class: 'login' }, h('form', { onsubmit: async (e) => {
      e.preventDefault(); err.textContent = '';
      const { error } = await sb.auth.signInWithPassword({ email: email.value.trim(), password: pw.value });
      if (error) { err.textContent = 'Incorrect email or password.'; return; }
      try { await load(); } catch (ex) { err.textContent = ex.message; }
    } }, h('h1', null, 'Dashboard'), h('p', null, 'Sign in to edit your graduation website.'),
      h('label', { class: 'field' }, h('span', null, 'Email'), email), h('label', { class: 'field' }, h('span', null, 'Password'), pw), err,
      h('button', { class: 'btn green', type: 'submit' }, 'Sign in'))));
    email.focus();
  }

  function render() {
    const status = h('span', { id: 'status', class: 'status' }, dirty ? 'Unsaved changes' : 'All changes saved');
    if (dirty) status.className = 'status dirty';
    const panel = h('div', { class: 'panel', role: 'tabpanel' }, ...TABS.find((t) => t[0] === tab)[2]());
    app.replaceChildren(
      h('div', { class: 'bar' }, h('h1', null, 'Graduation website'),
        h('div', { class: 'actions' }, status,
          h('button', { class: 'btn', onclick: () => save().then((ok) => ok && window.open('index.html?preview=1', '_blank')) }, 'Preview'),
          h('button', { class: 'btn', onclick: () => save(true) }, 'Save draft'),
          h('button', { class: 'btn primary', onclick: publish }, 'Publish'),
          h('button', { class: 'btn ghost small', onclick: discard }, 'Discard changes'),
          h('button', { class: 'btn ghost small', onclick: async () => { await sb.auth.signOut(); showLogin(); } }, 'Sign out'))),
      h('div', { class: 'tabs', role: 'tablist' }, TABS.map(([id, label]) => h('button', { class: 'tab', role: 'tab', 'aria-selected': String(id === tab), onclick: () => { tab = id; render(); window.scrollTo(0, 0); } }, label))),
      panel);
  }

  async function save(announce) {
    if (saving) return false; saving = true;
    try { await dbSet('draft', content); dirty = false; const s = document.getElementById('status'); if (s) { s.textContent = 'All changes saved'; s.className = 'status'; } if (announce) toast('Draft saved'); return true; }
    catch (e) { toast(e.message, true); return false; } finally { saving = false; }
  }
  async function publish() {
    if (!confirm('Publish now? Everyone who visits the website will see these changes.')) return;
    if (!(await save())) return;
    try { await dbSet('published', content); toast('Published! Your website is updated.'); } catch (e) { toast(e.message, true); }
  }
  async function discard() {
    if (!confirm('Throw away all unpublished changes and go back to the live version?')) return;
    try {
      const pub = (await dbGet('published')) || JSON.parse(JSON.stringify(window.DEFAULT_CONTENT));
      await dbSet('draft', pub); content = pub; dirty = false; render(); toast('Back to the published version');
    } catch (e) { toast(e.message, true); }
  }
  async function load() {
    const draft = (await dbGet('draft')) || (await dbGet('published')) || JSON.parse(JSON.stringify(window.DEFAULT_CONTENT));
    content = Object.assign({}, window.DEFAULT_CONTENT, draft); dirty = false; render();
  }

  if (!sb) showSetupHelp();
  else sb.auth.getSession().then(({ data }) => (data.session ? load().catch(showLogin) : showLogin()));
})();
