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
    headlinesOutput.value = '🔍 Diagnosing source and extracting all headlines... Please wait.';

    try {
      let content = '';

      // Fetch page content if input is a URL
      if (looksLikeUrl(rawInput)) {
        content = await fetchPageContent(rawInput);
      } else {
        content = rawInput;
      }

      setLoadingState(false);

      // Perform deep headline diagnosis
      const diagnosed = diagnoseHeadlines(content || rawInput, rawInput);
      renderDiagnosedHeadlines(diagnosed);

      // Check for target text "איזנקוט" across input, fetched content, and diagnosed headlines
      const combinedSearchSpace = `${rawInput}\n${content}\n${diagnosed.allHeadlines.join('\n')}`;
      const isFound = combinedSearchSpace.includes(TARGET_TEXT);

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
      headlinesOutput.value = `❌ Could not diagnose headlines: ${err.message || 'Verification failed.'}\n\nTip: You can copy and paste the article text or headlines directly into the source box above.`;
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

  // ==========================================
  // Comprehensive Headline Diagnosis Engine
  // ==========================================
  function diagnoseHeadlines(rawContent, originalInput) {
    if (!rawContent || typeof rawContent !== 'string') {
      return { mainHeadline: '', subHeadline: '', allHeadlines: [], totalCount: 0 };
    }

    let mainHeadline = '';
    let subHeadline = '';
    const collectedHeadlines = [];
    const seenKeys = new Set();

    // Helper: decode HTML entities and clean text thoroughly
    function decodeEntities(str) {
      if (!str) return '';
      const txt = document.createElement('textarea');
      txt.innerHTML = str;
      return txt.value;
    }

    function cleanString(str) {
      if (!str) return '';
      let cleaned = decodeEntities(str)
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // unwrap markdown links [text](url) -> text
        .replace(/[*_`~]/g, '')                   // remove markdown formatting
        .replace(/<[^>]*>/g, '')                  // strip any html tags
        .replace(/[\u200E\u200F\u202A-\u202E]/g, '') // remove invisible directional marks
        .replace(/^[\s#*>\-–—:•\d.]+\s*/, '')     // remove leading numbers, bullets, hashes
        .replace(/\s+/g, ' ')                     // collapse whitespace
        .trim();

      // Trim outer quotes if present
      cleaned = cleaned.replace(/^["'״׳«»“”]+|["'״׳«»“”]+$/g, '').trim();
      return cleaned;
    }

    function isBoilerplateOrNav(text) {
      if (!text || text.length < 4) return true;
      const lower = text.toLowerCase();

      const blockedPhrases = [
        'navigation', 'main menu', 'search', 'skip to content', 'advertisement',
        'share this', 'comments', 'footer', 'header', 'cookie policy', 'privacy policy',
        'terms of service', 'all rights reserved', 'subscribe', 'sign in', 'log in',
        'read more', 'continue reading', 'related stories', 'recommended for you',
        'תפריט', 'ניווט', 'חיפוש', 'שיתוף', 'תגובות', 'פרסומת', 'דלג לתוכן',
        'עקבו אחרינו', 'הרשמה לניוזלטר', 'התחברות', 'כל הזכויות שמורות', 'קרא עוד',
        'כתבות נוספות', 'אולי יעניין אותך', 'מבזקים', 'שירות לקוחות'
      ];

      return blockedPhrases.some(phrase => lower === phrase || lower.startsWith(phrase + ' '));
    }

    function registerHeadline(text, type = 'general') {
      const cleaned = cleanString(text);
      if (!cleaned || isBoilerplateOrNav(cleaned)) return;

      // Deduplication key (case-insensitive, ignoring punctuation)
      const key = cleaned.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
      if (!key || key.length < 3) return;

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        collectedHeadlines.push(cleaned);

        if (type === 'main' && !mainHeadline) {
          mainHeadline = cleaned;
        } else if (type === 'sub' && !subHeadline) {
          subHeadline = cleaned;
        }
      }
    }

    const isHtmlContent = /<(h[1-6]|title|meta|script|header|article|body|div)/i.test(rawContent);

    // ------------------------------------------
    // 1. HTML Diagnosis: Meta, JSON-LD, Semantics
    // ------------------------------------------
    if (isHtmlContent) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawContent, 'text/html');

        // A. JSON-LD Structured Data (Highest precision for news articles)
        const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
        jsonLdScripts.forEach((script) => {
          try {
            const data = JSON.parse(script.textContent);
            const items = Array.isArray(data) ? data : (data['@graph'] ? data['@graph'] : [data]);

            items.forEach((item) => {
              if (item && (typeof item === 'object')) {
                if (item.headline) registerHeadline(item.headline, 'main');
                if (item.alternativeHeadline) registerHeadline(item.alternativeHeadline, 'sub');
                if (item.description && typeof item.description === 'string' && item.description.length > 20) {
                  registerHeadline(item.description, 'sub');
                }
              }
            });
          } catch (_) {}
        });

        // B. OpenGraph & Twitter Meta tags
        const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
        if (ogTitle) registerHeadline(ogTitle, 'main');

        const ogDesc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content');
        if (ogDesc && ogDesc.length > 25) registerHeadline(ogDesc, 'sub');

        const twitterTitle = doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content');
        if (twitterTitle) registerHeadline(twitterTitle, 'main');

        const twitterDesc = doc.querySelector('meta[name="twitter:description"]')?.getAttribute('content');
        if (twitterDesc && twitterDesc.length > 25) registerHeadline(twitterDesc, 'sub');

        // C. Document Title
        if (doc.title) {
          // Clean typical publisher suffix: "Headline - Ynet" -> "Headline"
          let titleCleaned = doc.title.replace(/\s*[-–|:]\s*(ynet|וואלה|חדשות 12|mako|הארץ|מעריב|ישראל היום|bbc|cnn|reuters|the marker|n12).*$/i, '');
          registerHeadline(titleCleaned, 'main');
        }

        // D. Primary Headings (h1, h2, h3, h4)
        doc.querySelectorAll('h1').forEach(el => registerHeadline(el.textContent, 'main'));
        doc.querySelectorAll('h2').forEach(el => registerHeadline(el.textContent, 'sub'));
        doc.querySelectorAll('h3, h4').forEach(el => registerHeadline(el.textContent, 'general'));

        // E. Semantic Headline Classes (Ynet, Walla, Mako, Haaretz, Maariv, etc.)
        const newsSelector = [
          '[class*="mainTitle" i]',
          '[class*="subTitle" i]',
          '[class*="slotTitle" i]',
          '[class*="headline" i]',
          '[class*="article-title" i]',
          '[class*="entry-title" i]',
          '[data-mrf-title]',
          '[data-qa="headline"]',
          '[data-qa="sub-headline"]'
        ].join(', ');

        doc.querySelectorAll(newsSelector).forEach(el => {
          registerHeadline(el.textContent, 'general');
        });

        // F. Article links (Headlines inside news feed links)
        doc.querySelectorAll('article a, [class*="slot" i] a, [class*="news" i] a, [class*="item" i] a').forEach(a => {
          const text = a.textContent.trim();
          // Headline links typically have at least 4 words or 18+ characters
          if (text.length >= 18 && text.length <= 250 && text.includes(' ')) {
            registerHeadline(text, 'general');
          }
        });
      } catch (_) {}
    }

    // ------------------------------------------
    // 2. Markdown / Jina Reader Diagnosis
    // ------------------------------------------
    const lines = rawContent.split(/\r?\n/);
    let foundFirstHeading = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Jina "Title: ..."
      if (/^Title:\s*(.+)$/i.test(line)) {
        const m = line.match(/^Title:\s*(.+)$/i);
        if (m && m[1]) registerHeadline(m[1], 'main');
        continue;
      }

      // Markdown Headings (# H1, ## H2, ### H3, #### H4)
      const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (hMatch) {
        const level = hMatch[1].length;
        const text = hMatch[2];
        if (level === 1) {
          registerHeadline(text, 'main');
          foundFirstHeading = true;
          // Check if immediate next non-empty line is a subtitle/lead paragraph
          for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
            const nextLine = lines[j].trim();
            if (nextLine && !nextLine.startsWith('#') && !nextLine.startsWith('!') && !nextLine.startsWith('[')) {
              if (nextLine.length >= 25 && nextLine.length <= 400) {
                registerHeadline(nextLine, 'sub');
              }
              break;
            }
          }
        } else if (level === 2) {
          registerHeadline(text, 'sub');
        } else {
          registerHeadline(text, 'general');
        }
        continue;
      }

      // Markdown Links with headline text: [Headline text](url) or - [Headline text](url)
      const linkMatch = line.match(/^(?:[-*•\d.]+\s*)?\[([^\]]{15,300})\]\(https?:\/\/[^)]+\)/);
      if (linkMatch && linkMatch[1]) {
        registerHeadline(linkMatch[1], 'general');
        continue;
      }

      // Bold standalone headline lines: **Headline Text**
      const boldMatch = line.match(/^\s*\*\*([^*\n]{15,300})\*\*\s*$/);
      if (boldMatch && boldMatch[1]) {
        registerHeadline(boldMatch[1], 'general');
        continue;
      }
    }

    // ------------------------------------------
    // 3. Fallback for Plain Text Inputs
    // ------------------------------------------
    if (collectedHeadlines.length === 0) {
      const nonEmptyLines = lines.map(l => l.trim()).filter(l => l.length > 5);
      if (nonEmptyLines.length > 0) {
        registerHeadline(nonEmptyLines[0], 'main');
        if (nonEmptyLines.length > 1 && nonEmptyLines[1].length > 10) {
          registerHeadline(nonEmptyLines[1], 'sub');
        }
        for (let i = 2; i < Math.min(nonEmptyLines.length, 12); i++) {
          registerHeadline(nonEmptyLines[i], 'general');
        }
      }
    }

    // Ensure mainHeadline exists if any headlines were detected
    if (!mainHeadline && collectedHeadlines.length > 0) {
      mainHeadline = collectedHeadlines[0];
    }

    return {
      mainHeadline,
      subHeadline,
      allHeadlines: collectedHeadlines,
      totalCount: collectedHeadlines.length
    };
  }

  // Render the diagnosed headlines fully and structured in the textarea
  function renderDiagnosedHeadlines(diagnosed) {
    if (!diagnosed || diagnosed.allHeadlines.length === 0) {
      headlinesOutput.value = 'No headlines were detected in this source.\n\nTip: You can copy and paste the text of the article directly into the input box above.';
      headlinesCount.textContent = '';
      headlinesCount.classList.add('hidden');
      return;
    }

    const sections = [];

    // 1. Main Headline
    if (diagnosed.mainHeadline) {
      sections.push(`📌 כותרת ראשית (Main Headline):\n${diagnosed.mainHeadline}`);
    }

    // 2. Sub-Headline / Summary (if distinct from main headline)
    if (diagnosed.subHeadline && diagnosed.subHeadline !== diagnosed.mainHeadline) {
      sections.push(`📝 כותרת משנה / תקציר (Sub-Headline):\n${diagnosed.subHeadline}`);
    }

    // 3. All Diagnosed Headlines List
    const listLines = diagnosed.allHeadlines.map((h, index) => `${index + 1}. ${h}`);
    sections.push(`📰 כל הכותרות שאובחנו מהמקור (${diagnosed.totalCount}):\n${listLines.join('\n\n')}`);

    headlinesOutput.value = sections.join('\n\n========================================\n\n');

    // Update the counter pill
    headlinesCount.textContent = `${diagnosed.totalCount} headlines diagnosed`;
    headlinesCount.classList.remove('hidden');
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
