document.addEventListener('DOMContentLoaded', () => {
  const enterSourceBtn = document.getElementById('enter-source-btn');
  const initialView = document.getElementById('initial-view');
  const inputView = document.getElementById('input-view');
  const checkSourceBtn = document.getElementById('check-source-btn');
  const sourceInput = document.getElementById('source-input');
  const inputBadge = document.getElementById('input-badge');
  const buttonBadge = document.getElementById('button-badge');
  const statusMessage = document.getElementById('status-message');

  const TARGET_TEXT = 'איזנקוט';

  // Toggle from initial button to input form
  enterSourceBtn.addEventListener('click', () => {
    initialView.classList.add('hidden');
    inputView.classList.remove('hidden');
    sourceInput.focus();
  });

  // Action on checking source
  const handleCheckSource = async () => {
    const rawInput = sourceInput.value.trim();

    resetBadges();
    hideStatus();

    if (!rawInput) {
      showStatus('Please enter a source URL or paste text to check.', 'error');
      showErrorBadges();
      sourceInput.focus();
      return;
    }

    setLoadingState(true);

    try {
      let isFound = false;

      // 1. Direct text check: If user typed or pasted text containing the target
      if (rawInput.includes(TARGET_TEXT)) {
        isFound = true;
      } else if (looksLikeUrl(rawInput)) {
        // 2. If it's a URL, fetch content using multi-proxy fallback
        const content = await fetchPageContent(rawInput);
        if (content && content.includes(TARGET_TEXT)) {
          isFound = true;
        }
      }

      setLoadingState(false);

      if (isFound) {
        showSuccessBadge();
        showStatus(`Success! Found "${TARGET_TEXT}" in the source.`, 'success');
      } else {
        showErrorBadges();
        showStatus(`The text "${TARGET_TEXT}" was not found in the source.`, 'error');
      }
    } catch (err) {
      setLoadingState(false);
      showErrorBadges();
      showStatus(
        `${err.message || 'Verification failed.'} Tip: You can also copy and paste the article text directly into the box.`,
        'error'
      );
    }
  };

  function looksLikeUrl(text) {
    if (text.includes('\n')) return false;
    return /^https?:\/\//i.test(text) || (!text.includes(' ') && /^[a-z0-9-]+(\.[a-z]{2,})+/i.test(text));
  }

  // Robust multi-strategy fetch engine with Jina Reader as primary
  async function fetchPageContent(inputUrl) {
    let url = inputUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    // List of scrapers/proxies to attempt in order
    const strategies = [
      // 1. Jina Reader: Bypasses Cloudflare & Bot-shields, renders JS sites (e.g. Ynet, Walla, etc.)
      async (target) => {
        const controller = new AbortController();
        const tId = setTimeout(() => controller.abort(), 12000);
        try {
          const res = await fetch(`https://r.jina.ai/${target}`, {
            signal: controller.signal,
            headers: { 'Accept': 'text/plain' }
          });
          clearTimeout(tId);
          if (res.ok) {
            const txt = await res.text();
            if (txt && txt.length > 30) return txt;
          }
        } catch (e) {
          clearTimeout(tId);
        }
        return null;
      },

      // 2. AllOrigins raw proxy fallback
      async (target) => {
        const controller = new AbortController();
        const tId = setTimeout(() => controller.abort(), 8000);
        try {
          const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`, {
            signal: controller.signal
          });
          clearTimeout(tId);
          if (res.ok) {
            const txt = await res.text();
            if (txt && txt.length > 30) return txt;
          }
        } catch (e) {
          clearTimeout(tId);
        }
        return null;
      },

      // 3. CodeTabs proxy fallback
      async (target) => {
        const controller = new AbortController();
        const tId = setTimeout(() => controller.abort(), 8000);
        try {
          const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`, {
            signal: controller.signal
          });
          clearTimeout(tId);
          if (res.ok) {
            const txt = await res.text();
            if (txt && txt.length > 30) return txt;
          }
        } catch (e) {
          clearTimeout(tId);
        }
        return null;
      }
    ];

    for (const strategy of strategies) {
      try {
        const content = await strategy(url);
        if (content) {
          return content;
        }
      } catch (_) {
        // Try next fallback
      }
    }

    throw new Error('This website blocks automated cross-origin readers.');
  }

  function setLoadingState(isLoading) {
    if (isLoading) {
      checkSourceBtn.disabled = true;
      checkSourceBtn.textContent = 'Checking source...';
      inputBadge.className = 'result-badge badge-loading';
      inputBadge.innerHTML = '<div class="spinner"></div>';
      inputBadge.classList.remove('hidden');
      buttonBadge.classList.add('hidden');
      showStatus('Fetching and analyzing source (this may take a few seconds)...', 'info');
    } else {
      checkSourceBtn.disabled = false;
      checkSourceBtn.textContent = 'Check source';
    }
  }

  function showSuccessBadge() {
    inputBadge.className = 'result-badge badge-success';
    inputBadge.innerHTML = '&#10004;'; // ✔
    inputBadge.classList.remove('hidden');
    buttonBadge.classList.add('hidden');
  }

  function showErrorBadges() {
    inputBadge.className = 'result-badge badge-error';
    inputBadge.innerHTML = '&#10006;'; // ✖
    inputBadge.classList.remove('hidden');

    buttonBadge.className = 'result-badge badge-error';
    buttonBadge.innerHTML = '&#10006;'; // ✖
    buttonBadge.classList.remove('hidden');
  }

  function resetBadges() {
    inputBadge.className = 'result-badge hidden';
    inputBadge.innerHTML = '';
    buttonBadge.className = 'result-badge hidden';
    buttonBadge.innerHTML = '';
  }

  function showStatus(text, type) {
    statusMessage.textContent = text;
    statusMessage.className = `status-message ${type}`;
    statusMessage.classList.remove('hidden');
  }

  function hideStatus() {
    statusMessage.classList.add('hidden');
    statusMessage.textContent = '';
  }

  checkSourceBtn.addEventListener('click', handleCheckSource);

  // Trigger check on Enter (without Shift)
  sourceInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleCheckSource();
    }
  });

  // Reset status when user changes input
  sourceInput.addEventListener('input', () => {
    resetBadges();
    hideStatus();
  });
});
