/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GARGANTUA — Parameter Panel (GUI)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * DOM-asosli boshqaruv paneli — simulyatsiya parametrlarini
 * real-time o'zgartirish uchun.
 *
 * Bog'liqliklar: yo'q (sof DOM)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export default class ParameterPanel {

  constructor(options = {}) {
    this._container = options.container || document.body;
    this._autoHide = options.autoHide !== false;
    this._autoHideDelay = options.autoHideDelay || 4000;
    this._visible = options.startVisible !== false;

    this._onChangeCallbacks = [];
    this._panel = null;
    this._sections = new Map();
    this._controls = new Map();
    this._autoHideTimer = null;

    this._build();
  }

  /** @private */
  _build() {
    this._panel = document.createElement('div');
    this._panel.id = 'gargantua-panel';
    this._injectStyles();

    const header = document.createElement('div');
    header.className = 'gp-header';
    header.innerHTML = `<span class="gp-title">GARGANTUA</span><span class="gp-close">&times;</span>`;
    header.querySelector('.gp-close').addEventListener('click', () => this.toggle());
    this._panel.appendChild(header);

    this._scrollContainer = document.createElement('div');
    this._scrollContainer.className = 'gp-scroll';
    this._panel.appendChild(this._scrollContainer);

    this._container.appendChild(this._panel);

    if (this._autoHide) {
      this._panel.addEventListener('mouseenter', () => this._cancelAutoHide());
      this._panel.addEventListener('mouseleave', () => this._startAutoHide());
    }
    this._panel.style.display = this._visible ? 'block' : 'none';
  }

  /** @private */
  _injectStyles() {
    if (document.getElementById('gp-styles')) return;
    const s = document.createElement('style');
    s.id = 'gp-styles';
    s.textContent = `
      #gargantua-panel{position:fixed;top:20px;right:20px;width:260px;max-height:calc(100vh - 40px);background:rgba(0,0,0,.82);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.06);border-radius:12px;font-family:'Rajdhani','Segoe UI',sans-serif;font-size:12px;color:rgba(255,255,255,.7);z-index:1000;overflow:hidden;user-select:none;transition:opacity .4s,transform .3s}
      #gargantua-panel.hidden{opacity:0;pointer-events:none;transform:translateX(20px)}
      .gp-header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px 10px;border-bottom:1px solid rgba(255,255,255,.06)}
      .gp-title{font-family:'Orbitron',monospace;font-size:10px;letter-spacing:3px;color:rgba(255,170,80,.7)}
      .gp-close{cursor:pointer;font-size:18px;color:rgba(255,255,255,.3);line-height:1}
      .gp-close:hover{color:rgba(255,255,255,.7)}
      .gp-scroll{max-height:calc(100vh - 100px);overflow-y:auto;padding:4px 0;scrollbar-width:thin;scrollbar-color:rgba(255,170,80,.2) transparent}
      .gp-section{border-bottom:1px solid rgba(255,255,255,.04)}
      .gp-section-header{display:flex;justify-content:space-between;align-items:center;padding:10px 16px 8px;cursor:pointer;font-size:10px;letter-spacing:2px;color:rgba(255,255,255,.4);text-transform:uppercase}
      .gp-section-header:hover{color:rgba(255,255,255,.6)}
      .gp-section-arrow{transition:transform .2s;font-size:10px}
      .gp-section.collapsed .gp-section-body{display:none}
      .gp-section.collapsed .gp-section-arrow{transform:rotate(-90deg)}
      .gp-section-body{padding:0 16px 10px}
      .gp-control{margin-bottom:10px}
      .gp-label{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;font-size:11px;color:rgba(255,255,255,.5)}
      .gp-value{color:rgba(255,170,80,.8);font-family:'Rajdhani',monospace;font-size:11px}
      .gp-slider{width:100%;height:4px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,.08);border-radius:2px;outline:none;cursor:pointer}
      .gp-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:rgba(255,170,80,.8);border:2px solid rgba(0,0,0,.5);cursor:grab}
      .gp-slider::-webkit-slider-thumb:active{cursor:grabbing}
      .gp-toggle{position:relative;width:36px;height:18px;background:rgba(255,255,255,.1);border-radius:9px;cursor:pointer;transition:background .2s;display:inline-block;vertical-align:middle}
      .gp-toggle.active{background:rgba(255,170,80,.5)}
      .gp-toggle-knob{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .2s}
      .gp-toggle.active .gp-toggle-knob{transform:translateX(18px)}
      .gp-btn{padding:5px 10px;border:1px solid rgba(255,255,255,.1);border-radius:4px;background:rgba(255,255,255,.04);color:rgba(255,255,255,.6);font-size:10px;letter-spacing:1px;cursor:pointer;transition:all .2s;margin:2px}
      .gp-btn:hover{background:rgba(255,170,80,.15);border-color:rgba(255,170,80,.3);color:rgba(255,255,255,.9)}
      .gp-btn.active{background:rgba(255,170,80,.25);border-color:rgba(255,170,80,.5);color:#fff}
      .gp-btn-row{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
      .gp-select{width:100%;padding:4px 8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:4px;color:rgba(255,255,255,.7);font-size:11px;outline:none;cursor:pointer}
      .gp-divider{height:1px;background:rgba(255,255,255,.04);margin:6px 0}
    `;
    document.head.appendChild(s);
  }

  // ── Kontrol elementlari ──

  addSection(id, label, collapsed = false) {
    const sec = document.createElement('div');
    sec.className = 'gp-section' + (collapsed ? ' collapsed' : '');
    const hdr = document.createElement('div');
    hdr.className = 'gp-section-header';
    hdr.innerHTML = `<span>${label}</span><span class="gp-section-arrow">▼</span>`;
    hdr.addEventListener('click', () => sec.classList.toggle('collapsed'));
    const body = document.createElement('div');
    body.className = 'gp-section-body';
    sec.appendChild(hdr); sec.appendChild(body);
    this._scrollContainer.appendChild(sec);
    this._sections.set(id, { element: sec, body });
    return this;
  }

  addSlider(sectionId, id, label, min, max, value, step = 0.01, formatter) {
    const sec = this._sections.get(sectionId);
    if (!sec) return this;
    const fmt = formatter || (v => v.toFixed(step < 0.01 ? 4 : step < 1 ? 2 : 0));
    const c = document.createElement('div'); c.className = 'gp-control';
    c.innerHTML = `<div class="gp-label"><span>${label}</span><span class="gp-value">${fmt(value)}</span></div><input type="range" class="gp-slider" min="${min}" max="${max}" value="${value}" step="${step}">`;
    const sl = c.querySelector('.gp-slider'), vd = c.querySelector('.gp-value');
    sl.addEventListener('input', () => { const v = parseFloat(sl.value); vd.textContent = fmt(v); this._emitChange(id, v); });
    sec.body.appendChild(c);
    this._controls.set(id, { type:'slider', element:sl, valueDisplay:vd, fmt, setValue:(v) => { sl.value=v; vd.textContent=fmt(v); } });
    return this;
  }

  addToggle(sectionId, id, label, value = true) {
    const sec = this._sections.get(sectionId);
    if (!sec) return this;
    const c = document.createElement('div'); c.className = 'gp-control';
    c.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
    const lb = document.createElement('span'); lb.style.cssText = 'font-size:11px;color:rgba(255,255,255,.5);'; lb.textContent = label;
    const tg = document.createElement('div'); tg.className = 'gp-toggle' + (value ? ' active' : ''); tg.innerHTML = '<div class="gp-toggle-knob"></div>';
    tg.addEventListener('click', () => { tg.classList.toggle('active'); this._emitChange(id, tg.classList.contains('active')); });
    c.appendChild(lb); c.appendChild(tg); sec.body.appendChild(c);
    this._controls.set(id, { type:'toggle', element:tg, setValue:(v)=>tg.classList.toggle('active',v) });
    return this;
  }

  addButtonRow(sectionId, id, buttons) {
    const sec = this._sections.get(sectionId);
    if (!sec) return this;
    const row = document.createElement('div'); row.className = 'gp-btn-row';
    buttons.forEach(btn => {
      const b = document.createElement('button'); b.className = 'gp-btn'; b.textContent = btn.label;
      b.addEventListener('click', () => { row.querySelectorAll('.gp-btn').forEach(x=>x.classList.remove('active')); b.classList.add('active'); this._emitChange(id, btn.value); });
      row.appendChild(b);
    });
    sec.body.appendChild(row);
    this._controls.set(id, { type:'buttonRow', element:row, setValue:(val) => row.querySelectorAll('.gp-btn').forEach(b=>b.classList.toggle('active',b.textContent===val)) });
    return this;
  }

  addSelect(sectionId, id, label, options, value) {
    const sec = this._sections.get(sectionId);
    if (!sec) return this;
    const c = document.createElement('div'); c.className = 'gp-control';
    const lb = document.createElement('div'); lb.className = 'gp-label'; lb.textContent = label;
    const sel = document.createElement('select'); sel.className = 'gp-select';
    options.forEach(o => { const op = document.createElement('option'); op.value = o.value; op.textContent = o.label; if(o.value===value) op.selected=true; sel.appendChild(op); });
    sel.addEventListener('change', () => this._emitChange(id, sel.value));
    c.appendChild(lb); c.appendChild(sel); sec.body.appendChild(c);
    this._controls.set(id, { type:'select', element:sel, setValue:(v)=>{sel.value=v;} });
    return this;
  }

  addButton(sectionId, id, label, onClick) {
    const sec = this._sections.get(sectionId);
    if (!sec) return this;
    const b = document.createElement('button'); b.className = 'gp-btn'; b.style.cssText = 'width:100%;margin-top:4px;'; b.textContent = label;
    b.addEventListener('click', () => { if(onClick) onClick(); this._emitChange(id, true); });
    sec.body.appendChild(b);
    this._controls.set(id, { type:'button', element:b });
    return this;
  }

  addDivider(sectionId) {
    const sec = this._sections.get(sectionId);
    if (!sec) return this;
    const d = document.createElement('div'); d.className = 'gp-divider'; sec.body.appendChild(d);
    return this;
  }

  // ── Qiymat ──
  setValue(cid, v) { const c = this._controls.get(cid); if(c&&c.setValue) c.setValue(v); return this; }
  getValue(cid) { const c = this._controls.get(cid); if(!c) return; if(c.type==='slider') return parseFloat(c.element.value); if(c.type==='toggle') return c.element.classList.contains('active'); if(c.type==='select') return c.element.value; }

  // ── Event / Ko'rinish ──
  onChange(cb) { this._onChangeCallbacks.push(cb); return this; }
  _emitChange(id, v) { for(const cb of this._onChangeCallbacks) cb(id, v); }

  show() { this._visible=true; this._panel.style.display='block'; this._panel.classList.remove('hidden'); if(this._autoHide) this._startAutoHide(); return this; }
  hide() { this._panel.classList.add('hidden'); this._visible=false; return this; }
  toggle() { this._visible ? this.hide() : this.show(); return this; }

  _startAutoHide() { this._cancelAutoHide(); this._autoHideTimer = setTimeout(()=>this._panel.classList.add('hidden'), this._autoHideDelay); }
  _cancelAutoHide() { if(this._autoHideTimer){clearTimeout(this._autoHideTimer);this._autoHideTimer=null;} this._panel.classList.remove('hidden'); }

  get visible() { return this._visible; }

  dispose() {
    this._cancelAutoHide();
    if(this._panel&&this._panel.parentNode) this._panel.parentNode.removeChild(this._panel);
    this._sections.clear(); this._controls.clear(); this._onChangeCallbacks.length = 0;
  }
}