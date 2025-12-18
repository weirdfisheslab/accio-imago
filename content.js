// Create overlay once. Uses pointer-events:none so it never captures the mouse.
if (!window.__HH_INSTALLED__) {
  window.__HH_INSTALLED__ = true;

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    border: '2px solid #ff3b30',
    boxShadow: '0 0 0 9999px rgba(0,0,0,0)',
    pointerEvents: 'none',
    zIndex: '2147483647',
    top: '0px', left: '0px', width: '0px', height: '0px',
    display: 'none'
  });
  document.documentElement.appendChild(overlay);

  const label = document.createElement('div');
  Object.assign(label.style, {
    position: 'fixed',
    font: '12px/1.6 system-ui, sans-serif',
    background: 'rgba(255,59,48,0.9)',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '4px',
    pointerEvents: 'none',
    zIndex: '2147483647',
    display: 'none'
  });
  document.documentElement.appendChild(label);

  let enabled = true;
  let rafId = null;

  function rectOf(el) {
    const r = el.getBoundingClientRect();
    const left = Math.min(r.left, r.right);
    const top = Math.min(r.top, r.bottom);
    const width = Math.abs(r.width);
    const height = Math.abs(r.height);
    return { left, top, width, height };
  }

  function updateOverlay(el) {
    if (!el || el === document.documentElement || el === document.body) {
      overlay.style.display = 'none';
      label.style.display = 'none';
      return;
    }
    const { left, top, width, height } = rectOf(el);
    overlay.style.display = 'block';
    overlay.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    overlay.style.width = `${Math.round(width)}px`;
    overlay.style.height = `${Math.round(height)}px`;

    const cls = el.className ? '.' + String(el.className).trim().replace(/\s+/g,'.') : '';
    label.textContent = `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${cls}>`;
    label.style.display = 'block';
    const lx = Math.round(left);
    const ly = Math.round(top - 18);
    label.style.transform = `translate(${lx}px, ${Math.max(0, ly)}px)`;
  }

  function targetFromPoint(x, y) {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      if (el !== overlay && el !== label) return el;
    }
    return null;
  }

  function onMove(e) {
    if (!enabled) return;
    if (rafId) cancelAnimationFrame(rafId);
    const x = e.clientX;
    const y = e.clientY;
    rafId = requestAnimationFrame(() => {
      updateOverlay(targetFromPoint(x, y));
    });
  }

  function onScrollOrResize() {
    if (!enabled) return;
    overlay.style.display = 'none';
    label.style.display = 'none';
  }

  document.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== 'TOGGLE') return;
    enabled = !enabled;
    if (!enabled) {
      overlay.style.display = 'none';
      label.style.display = 'none';
    }
  });

  window.addEventListener('message', (e) => {
    if (e?.data?.type === 'HH_TOGGLE') {
      enabled = !enabled;
      if (!enabled) {
        overlay.style.display = 'none';
        label.style.display = 'none';
      }
    }
  });
}
