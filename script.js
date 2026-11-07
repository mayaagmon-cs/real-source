document.addEventListener('DOMContentLoaded', () => {
  const enterSourceBtn = document.getElementById('enter-source-btn');
  const initialView = document.getElementById('initial-view');
  const inputView = document.getElementById('input-view');
  const checkSourceBtn = document.getElementById('check-source-btn');
  const sourceInput = document.getElementById('source-input');
  const inputBadge = document.getElementById('input-badge');
  const buttonBadge = document.getElementById('button-badge');
  const statusMessage = document.getElementById('status-message');
  const headlinesOutput = document.getElementById('headlines-output');
  const headlinesCount = document.getElementById('headlines-count');

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
    resetHeadlines();

    if (!rawInput) {
      showStatus('Please enter a source URL or paste text to check.', 'error');
      showErrorBadges();
      headlinesOutput.value = '';
      sourceInput.focus();
      return;
    }

    setLoadingState(true);
    headlinesOutput.value = 'Fetching source and extracting headlines...';

    try {
      let isFound = false;
      let content = '';

      // 1. Direct text check: Check if entered string contains the target word
      if (rawInput.includes(TARGET_TEXT)) {
        isFound = true;
      }

      // 2. Fetch page content if input is a URL
      if (looksLikeUrl(rawInput)) {
        content = await fetchPageContent(rawInput);
        if (content && content.includes(TARGET_TEXT)) {
          isFound = true;
        }
      } else {
        content = rawInput;
      }

      setLoadingState(false);

      // 3. Extract and display all headlines
      const headlines = extractHeadlines(content || rawInput);
      displayHeadlines(headlines);

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
      headlinesOutput.value = `Could not extract headlines: ${err.message || 'Verification failed.'}`;
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

  // Extract headlines from HTML, Markdown, or plain text
  function extractHeadlines(rawContent) {
    if (!rawContent || typeof rawContent !== 'string') return [];

    const headlines = [];
    const seen = new Set();

    function addHeadline(text) {
      if (!text) return;
      let cleaned = text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // remove markdown links [title](url)
        .replace(/[*_`~]/g, '')                   // remove markdown formatting
        .replace(/<[^>]*>/g, '')                  // strip inline html tags
        .replace(/^[\s#*>\-–—:•\d.]+\s*/, '')     // remove leading numbers, bullets, hashes
        .trim();

      if (cleaned.length < 3 || cleaned.length > 300) return;

      // Filter out typical non-headline navigational text
      const lower = cleaned.toLowerCase();
      const commonUi = [
        'navigation', 'menu', 'search', 'skip to content', 'advertisement', 'share',
        'comments', 'footer', 'header', 'cookie policy', 'privacy policy', 'terms of service',
        'תפריט', 'ניווט', 'חיפוש', 'שיתוף', 'תגובות', 'פרסומת', 'דלג לתוכן', 'עקבו אחרינו'
      ];
      if (commonUi.includes(lower)) return;

      const dedupeKey = lower.replace(/\s+/g, ' ');
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        headlines.push(cleaned);
      }
    }

    // 1. If content contains HTML tags, parse with DOMParser
    if (/<(h[1-6]|title|header|article)/i.test(rawContent)) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawContent, 'text/html');

        if (doc.title) {
          addHeadline(doc.title);
        }

        const headingElements = doc.querySelectorAll('h1, h2, h3, h4, .headline, [class*="headline"], [class*="Headline"], [class*="title"]');
        headingElements.forEach((el) => {
          addHeadline(el.textContent);
        });
      } catch (_) {
        // Fallback to text parsing
      }
    }

    // 2. Extract Markdown / Jina Reader titles
    const lines = rawContent.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Jina "Title: ..."
      if (/^Title:\s*(.+)$/i.test(trimmed)) {
        const match = trimmed.match(/^Title:\s*(.+)$/i);
        if (match && match[1]) addHeadline(match[1]);
      }
      // Markdown headings (#, ##, ###, ####)
      else if (/^#{1,4}\s+(.+)$/.test(trimmed)) {
        const match = trimmed.match(/^#{1,4}\s+(.+)$/);
        if (match && match[1]) addHeadline(match[1]);
      }
    }

    // 3. Fallback: if no headings were found and user pasted raw text lines
    if (headlines.length === 0) {
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 5 && trimmed.length < 200) {
          addHeadline(trimmed);
          if (headlines.length >= 6) break;
        }
      }
    }

    return headlines;
  }

  function displayHeadlines(headlines) {
    if (headlines && headlines.length > 0) {
      headlinesOutput.value = headlines
        .map((item, idx) => `${idx + 1}. ${item}`)
        .join('\n\n');
      headlinesCount.textContent = `${headlines.length} headlines`;
      headlinesCount.classList.remove('hidden');
    } else {
      headlinesOutput.value = 'No headlines were detected in this source.';
      headlinesCount.classList.add('hidden');
    }
  }

  function resetHeadlines() {
    headlinesOutput.value = '';
    headlinesCount.textContent = '';
    headlinesCount.classList.add('hidden');
  }

  // Multi-strategy fetch engine with Jina Reader as primary
  async function fetchPageContent(inputUrl) {
    let url = inputUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    const strategies = [
      // 1. Jina Reader: Renders modern JS news sites and bypasses cloudflare/bot-shields
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
        // Continue to next fallback
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
      showStatus('Fetching source and analyzing headlines...', 'info');
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

  // Reset status and headlines when input is changed or cleared
  sourceInput.addEventListener('input', () => {
    resetBadges();
    hideStatus();
    if (!sourceInput.value.trim()) {
      resetHeadlines();
    }
  });
});
