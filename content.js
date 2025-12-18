// Create overlay once. Uses pointer-events:none so it never captures the mouse.
if (!window.__HH_INSTALLED__) {
  window.__HH_INSTALLED__ = true;

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    border: '3px solid #00d4ff',
    boxShadow: '0 0 10px rgba(0, 212, 255, 0.5)',
    pointerEvents: 'none',
    zIndex: '2147483647',
    top: '0px', left: '0px', width: '0px', height: '0px',
    display: 'none',
    cursor: 'pointer'
  });
  document.documentElement.appendChild(overlay);

  const label = document.createElement('div');
  Object.assign(label.style, {
    position: 'fixed',
    font: '12px/1.6 system-ui, sans-serif',
    background: 'rgba(0, 212, 255, 0.95)',
    color: '#fff',
    padding: '4px 8px',
    borderRadius: '4px',
    pointerEvents: 'none',
    zIndex: '2147483647',
    display: 'none'
  });
  document.documentElement.appendChild(label);

  // Create persistent stop button
  const stopButton = document.createElement('button');
  Object.assign(stopButton.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '12px 16px',
    background: '#ff3b30',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    zIndex: '2147483646',
    boxShadow: '0 4px 12px rgba(255, 59, 48, 0.3)',
    display: 'none',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  });
  stopButton.textContent = '⊘ Stop Download Mode';
  stopButton.addEventListener('mouseover', () => {
    stopButton.style.background = '#e63029';
    stopButton.style.boxShadow = '0 6px 16px rgba(255, 59, 48, 0.4)';
  });
  stopButton.addEventListener('mouseout', () => {
    stopButton.style.background = '#ff3b30';
    stopButton.style.boxShadow = '0 4px 12px rgba(255, 59, 48, 0.3)';
  });
  stopButton.addEventListener('click', () => {
    cleanup();
  });
  document.documentElement.appendChild(stopButton);


  let enabled = false;
  let rafId = null;
  let currentImageEl = null;

  // Cleanup function
  function cleanup() {
    enabled = false;
    overlay.style.display = 'none';
    label.style.display = 'none';
    stopButton.style.display = 'none';
    document.removeEventListener('mousemove', onMove);
    window.removeEventListener('scroll', onScrollOrResize);
    window.removeEventListener('resize', onScrollOrResize);
  }

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
      currentImageEl = null;
      return;
    }
    const { left, top, width, height } = rectOf(el);
    overlay.style.display = 'block';
    overlay.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    overlay.style.width = `${Math.round(width)}px`;
    overlay.style.height = `${Math.round(height)}px`;

    currentImageEl = el;
    label.textContent = el.tagName === 'IMG' ? 'Click to download' : 'Click to open';
    label.style.display = 'block';
    const lx = Math.round(left);
    const ly = Math.round(top - 20);
    label.style.transform = `translate(${lx}px, ${Math.max(0, ly)}px)`;
  }

  function isImage(el) {
    // SVG image elements (Google Slides uses these!)
    if (el.tagName === 'image' && el.namespaceURI === 'http://www.w3.org/2000/svg') {
      const href = el.getAttribute('xlink:href') || el.getAttribute('href');
      return href && href.startsWith('filesystem:');
    }
    
    // HTML IMG tags
    if (el.tagName === 'IMG') return true;
    
    return false;
  }

  function targetFromPoint(x, y) {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) {
      if ((el !== overlay && el !== label) && isImage(el)) {
        return el;
      }
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

  // Add click handler for image downloads
  document.addEventListener('click', (e) => {
    if (!enabled || !currentImageEl) return;
    
    // Check if we clicked on the current image element
    if (e.target === currentImageEl) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      const url = getImageUrl(currentImageEl);
      if (url) {
        downloadImage(url, 'slide-image.jpg');
      }
    }
  }, true);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'TOGGLE') {
      enabled = !enabled;
      if (enabled) {
        stopButton.style.display = 'block';
      } else {
        stopButton.style.display = 'none';
        overlay.style.display = 'none';
        label.style.display = 'none';
      }
    } else if (msg?.type === 'CLEANUP') {
      cleanup();
    }
  });

  function getImageUrl(el) {
    // SVG image elements (Google Slides)
    if (el.tagName === 'image' && el.namespaceURI === 'http://www.w3.org/2000/svg') {
      return el.getAttribute('xlink:href') || el.getAttribute('href');
    }
    
    // HTML IMG src
    if (el.tagName === 'IMG') {
      return el.src || el.dataset.src;
    }
    
    return null;
  }

  function downloadImage(url, filename) {
    if (!url) {
      console.error('Could not extract image URL');
      return;
    }
    
    // For filesystem URLs, create a temporary link and click it
    if (url.startsWith('filesystem:')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || 'slide-image.jpg';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      // For regular URLs, use the service worker
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_IMAGE',
        url: url,
        filename: filename || 'slide-image.jpg'
      }, (response) => {
        if (response && response.success) {
          console.log('Download initiated');
        }
      });
    }
  }

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
