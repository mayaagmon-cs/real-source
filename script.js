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
    headlinesOutput.value = '🔍 Analyzing source and diagnosing headlines with multi-tiered extraction... Please wait.';

    try {
      let content = '';

      // Fetch page content if input is a URL
      if (looksLikeUrl(rawInput)) {
        content = await fetchPageContent(rawInput);
      } else {
        content = rawInput;
      }

      setLoadingState(false);

      // Perform robust cascading headline diagnosis
      const diagnosed = extractHeadlinesCascading(content || rawInput, rawInput);
      renderDiagnosedHeadlines(diagnosed);

      // Check for target text "איזנקוט" across input, content, and all diagnosed headlines
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

  // =========================================================================
  // Robust Multi-Tiered Headline Extraction & Diagnosis Engine
  // =========================================================================
  function extractHeadlinesCascading(rawContent, originalInput) {
    if (!rawContent || typeof rawContent !== 'string') {
      return { mainHeadline: '', subHeadline: '', allHeadlines: [], totalCount: 0 };
    }

    let mainHeadline = '';
    let subHeadline = '';
    const collected = [];
    const seenMap = new Map(); // normalizedKey -> originalText

    // -------------------------------------------------------------
    // Helper: Text Cleansing, Entity Decoding, and Normalization
    // -------------------------------------------------------------
    function decodeEntities(str) {
      if (!str) return '';
      const txt = document.createElement('textarea');
      txt.innerHTML = str;
      return txt.value;
    }

    function cleanString(str) {
      if (!str) return '';
      let cleaned = decodeEntities(str)
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')     // unwrap markdown links [text](url) -> text
        .replace(/[*_`~#]/g, '')                      // remove markdown formatting & hashes
        .replace(/<[^>]*>/g, '')                      // strip inline html tags
        .replace(/[\u200E\u200F\u202A-\u202E]/g, '') // remove bidirectional formatting marks
        .replace(/^[\s*>\-–—:•\d.]+\s*/, '')         // remove leading bullets, numbers, dashes
        .replace(/\s+/g, ' ')                         // collapse consecutive whitespace
        .trim();

      // Trim outer quotes
      cleaned = cleaned.replace(/^["'״׳«»“”]+|["'״׳«»“”]+$/g, '').trim();
      return cleaned;
    }

    // Filter out common non-article noise, navigation, and boilerplate
    function isBoilerplateOrNav(text) {
      if (!text || text.length < 5) return true;
      const lower = text.toLowerCase();

      const blockedPhrases = [
        'navigation', 'main menu', 'search', 'skip to content', 'advertisement', 'sponsored',
        'share this', 'comments', 'footer', 'header', 'cookie policy', 'privacy policy',
        'terms of service', 'terms of use', 'all rights reserved', 'subscribe', 'sign in',
        'log in', 'read more', 'continue reading', 'related stories', 'recommended for you',
        'popular stories', 'trending now', 'follow us', 'latest news', 'contact us',
        'תפריט', 'ניווט', 'חיפוש', 'שיתוף', 'תגובות', 'פרסומת', 'תוכן מקודם', 'דלג לתוכן',
        'עקבו אחרינו', 'הרשמה לניוזלטר', 'התחברות', 'כל הזכויות שמורות', 'קרא עוד',
        'כתבות נוספות', 'אולי יעניין אותך', 'מבזקים', 'שירות לקוחות', 'צור קשר',
        'תנאי שימוש', 'מדיניות פרטיות', 'דף הבית'
      ];

      return blockedPhrases.some(phrase => lower === phrase || lower.startsWith(phrase + ' ') || lower.endsWith(' ' + phrase));
    }

    function normalizeKey(str) {
      return str.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    }

    // Deduplicator that retains the most complete version of a headline
    function registerHeadline(text, category = 'general') {
      const cleaned = cleanString(text);
      if (!cleaned || isBoilerplateOrNav(cleaned)) return;

      // Discard single isolated words unless very descriptive
      if (!cleaned.includes(' ') && cleaned.length < 12) return;

      const key = normalizeKey(cleaned);
      if (!key || key.length < 4) return;

      // Check for existing duplicates or near-duplicates
      let existingIndex = -1;
      for (let i = 0; i < collected.length; i++) {
        const existingKey = normalizeKey(collected[i]);
        if (existingKey === key) {
          existingIndex = i;
          break;
        }
        // Substring enhancement: If one headline is a complete substring of another
        if (key.length > existingKey.length && key.includes(existingKey) && (existingKey.length / key.length) > 0.6) {
          // Replace shorter with more complete headline
          collected[i] = cleaned;
          existingIndex = i;
          break;
        } else if (existingKey.length > key.length && existingKey.includes(key) && (key.length / existingKey.length) > 0.6) {
          // Keep the existing longer one
          existingIndex = i;
          break;
        }
      }

      if (existingIndex === -1) {
        collected.push(cleaned);
        seenMap.set(key, cleaned);

        if (category === 'main' && !mainHeadline) {
          mainHeadline = cleaned;
        } else if (category === 'sub' && !subHeadline) {
          subHeadline = cleaned;
        }
      }
    }

    const isHtmlContent = /<(html|head|body|article|main|section|div|p|h[1-6]|script|meta)/i.test(rawContent);

    // =========================================================================
    // Tier 4: Metadata Fallbacks & Structured Schema (Extract early as reference)
    // =========================================================================
    if (isHtmlContent) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawContent, 'text/html');

        // A. JSON-LD Article Schema (NewsArticle, Article, BlogPosting, ListItem)
        const ldScripts = doc.querySelectorAll('script[type="application/ld+json"]');
        ldScripts.forEach((script) => {
          try {
            const data = JSON.parse(script.textContent);
            const items = Array.isArray(data) ? data : (data['@graph'] ? data['@graph'] : [data]);

            items.forEach((item) => {
              if (item && typeof item === 'object') {
                if (item.headline) registerHeadline(item.headline, 'main');
                if (item.alternativeHeadline) registerHeadline(item.alternativeHeadline, 'sub');
                if (item.description && typeof item.description === 'string' && item.description.length > 20) {
                  registerHeadline(item.description, 'sub');
                }
                // Handle ItemList / Carousel schema (news carousels & feeds)
                if (Array.isArray(item.itemListElement)) {
                  item.itemListElement.forEach((entry) => {
                    if (entry?.name) registerHeadline(entry.name, 'general');
                    if (entry?.item?.headline) registerHeadline(entry.item.headline, 'general');
                    if (entry?.item?.name) registerHeadline(entry.item.name, 'general');
                  });
                }
              }
            });
          } catch (_) {}
        });

        // B. OpenGraph & Twitter Meta Tags
        const ogTitle = doc.querySelector('meta[property="og:title"], meta[name="og:title"], meta[property="og:headline"]')?.getAttribute('content');
        if (ogTitle) registerHeadline(ogTitle, 'main');

        const ogDesc = doc.querySelector('meta[property="og:description"], meta[name="og:description"]')?.getAttribute('content');
        if (ogDesc && ogDesc.length > 20) registerHeadline(ogDesc, 'sub');

        const twTitle = doc.querySelector('meta[name="twitter:title"], meta[property="twitter:title"]')?.getAttribute('content');
        if (twTitle) registerHeadline(twTitle, 'main');

        const twDesc = doc.querySelector('meta[name="twitter:description"], meta[property="twitter:description"]')?.getAttribute('content');
        if (twDesc && twDesc.length > 20) registerHeadline(twDesc, 'sub');

        // C. Document Title (cleaned of site suffix)
        if (doc.title) {
          const cleanedTitle = doc.title.replace(/\s*[-–|:]\s*(ynet|וואלה|חדשות 12|mako|הארץ|מעריב|ישראל היום|the marker|n12|cnn|bbc|reuters|ap news|guardian).*$/i, '');
          registerHeadline(cleanedTitle, 'main');
        }

        // =======================================================================
        // Tier 5: DOM Noise Filtering (Remove non-article elements before parsing)
        // =======================================================================
        const noiseSelectors = [
          'nav', 'footer', 'aside',
          'header:not(article header):not(main header)',
          '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
          '[role="dialog"]', '[role="alertdialog"]',
          '[class*="cookie" i]', '[class*="consent" i]', '[id*="cookie" i]',
          '[class*="modal" i]', '[class*="popup" i]',
          '[class*="sidebar" i]', '[id*="sidebar" i]',
          '[class*="social" i]', '[class*="share" i]',
          '[class*="comment" i]', '[class*="newsletter" i]',
          '[class*="advertisement" i]', '[class*="banner-ad" i]',
          'script', 'style', 'noscript', 'svg'
        ];

        const cleanedDoc = doc.cloneNode(true);
        cleanedDoc.querySelectorAll(noiseSelectors.join(', ')).forEach((node) => {
          try { node.remove(); } catch (_) {}
        });

        // =======================================================================
        // Tier 1: Target Semantic Containers First (<article>, <main>, <section>)
        // =======================================================================
        const semanticContainerSelectors = [
          'article',
          '[role="article"]',
          'main',
          '[role="main"]',
          '.main-content',
          '#main-content',
          '.content-area',
          '.entry-content',
          '.post-content',
          '.story-body',
          'section[class*="article" i]',
          'section[class*="story" i]',
          'section[class*="post" i]',
          'section[class*="content" i]',
          'section'
        ];

        const foundContainers = cleanedDoc.querySelectorAll(semanticContainerSelectors.join(', '));

        // Common CMS Pattern Selectors (Tier 3)
        const cmsHeadlineSelectors = [
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6', '[role="heading"]',
          '[class*="headline" i]',
          '[class*="post-title" i]',
          '[class*="entry-title" i]',
          '[class*="card-title" i]',
          '[class*="article-title" i]',
          '[class*="article-header" i]',
          '[class*="story-headline" i]',
          '[class*="news-title" i]',
          '[class*="mainTitle" i]',
          '[class*="subTitle" i]',
          '[class*="slotTitle" i]',
          '[class*="teaser-title" i]',
          '[class*="feed-title" i]',
          '[id*="headline" i]',
          '[id*="post-title" i]',
          '[id*="article-title" i]',
          '[data-qa="headline"]',
          '[data-qa="sub-headline"]',
          '[data-mrf-title]',
          '[itemprop="headline"]',
          '[itemprop="name"]',
          '[itemprop="alternativeHeadline"]'
        ];

        // Tier 2: Broaden Element & Wrapper Coverage inside containers
        const wrapperSelectors = [
          ...cmsHeadlineSelectors,
          'p[class*="sub" i]', 'div[class*="sub" i]',
          'p[class*="lead" i]', 'div[class*="lead" i]',
          'p[class*="kicker" i]', 'span[class*="kicker" i]',
          'a[class*="title" i]', 'a[class*="headline" i]', 'a[class*="link" i]'
        ];

        if (foundContainers.length > 0) {
          foundContainers.forEach((container) => {
            // Find headings and CMS headline wrappers inside this semantic container
            const elements = container.querySelectorAll(wrapperSelectors.join(', '));
            elements.forEach((el) => {
              const tag = el.tagName.toLowerCase();
              const category = (tag === 'h1' || el.matches('[class*="mainTitle" i]'))
                ? 'main'
                : (tag === 'h2' || el.matches('[class*="subTitle" i], p[class*="lead" i]'))
                  ? 'sub'
                  : 'general';

              registerHeadline(el.textContent, category);
            });

            // Also check for direct article link headlines inside article containers
            container.querySelectorAll('a').forEach((link) => {
              const linkText = link.textContent.trim();
              if (linkText.length >= 18 && linkText.length <= 250 && linkText.includes(' ')) {
                registerHeadline(linkText, 'general');
              }
            });
          });
        }

        // =======================================================================
        // Fallback: Scan Cleaned Body if Containers Were Insufficient
        // =======================================================================
        if (collected.length < 3) {
          cleanedDoc.querySelectorAll(wrapperSelectors.join(', ')).forEach((el) => {
            const tag = el.tagName.toLowerCase();
            const category = (tag === 'h1') ? 'main' : (tag === 'h2') ? 'sub' : 'general';
            registerHeadline(el.textContent, category);
          });
        }
      } catch (_) {}
    }

    // =========================================================================
    // Markdown & Jina Reader Handling (For JS-heavy/proxy feeds)
    // =========================================================================
    const lines = rawContent.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Jina "Title: ..."
      if (/^Title:\s*(.+)$/i.test(line)) {
        const m = line.match(/^Title:\s*(.+)$/i);
        if (m && m[1]) registerHeadline(m[1], 'main');
        continue;
      }

      // Markdown Headings: # H1, ## H2, ### H3, #### H4
      const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (hMatch) {
        const level = hMatch[1].length;
        const text = hMatch[2];
        if (level === 1) {
          registerHeadline(text, 'main');
          // Check subsequent line for lead paragraph / sub-headline
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

      // Feed / Story links: [Headline Text](url) or - [Headline Text](url) or * [Headline Text](url)
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

    // =========================================================================
    // Plain Text Fallback (When raw text is pasted directly)
    // =========================================================================
    if (collected.length === 0) {
      const candidateLines = lines
        .map(l => l.trim())
        .filter(l => l.length >= 8 && !isBoilerplateOrNav(l));

      if (candidateLines.length > 0) {
        registerHeadline(candidateLines[0], 'main');
        if (candidateLines.length > 1 && candidateLines[1].length >= 15) {
          registerHeadline(candidateLines[1], 'sub');
        }
        for (let i = 2; i < Math.min(candidateLines.length, 12); i++) {
          registerHeadline(candidateLines[i], 'general');
        }
      }
    }

    // Default main headline if missing
    if (!mainHeadline && collected.length > 0) {
      mainHeadline = collected[0];
    }

    return {
      mainHeadline,
      subHeadline,
      allHeadlines: collected,
      totalCount: collected.length
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
