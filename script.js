document.addEventListener('DOMContentLoaded', () => {
  const enterSourceBtn = document.getElementById('enter-source-btn');
  const initialView = document.getElementById('initial-view');
  const inputView = document.getElementById('input-view');
  const checkSourceBtn = document.getElementById('check-source-btn');

  // Dual Source Inputs
  const sourceInput1 = document.getElementById('source-input-1');
  const sourceInput2 = document.getElementById('source-input-2');

  // Dual HeadLines Outputs & Counters
  const headlinesOutput1 = document.getElementById('headlines-output-1');
  const headlinesOutput2 = document.getElementById('headlines-output-2');
  const headlinesCount1 = document.getElementById('headlines-count-1');
  const headlinesCount2 = document.getElementById('headlines-count-2');

  // Status and Inspection Logs
  const statusMessage = document.getElementById('status-message');
  const toggleLogBtn = document.getElementById('toggle-log-btn');
  const scrapingLogPanel = document.getElementById('scraping-log-panel');
  const scrapingLogContent = document.getElementById('scraping-log-content');
  const botShieldStatus = document.getElementById('bot-shield-status');

  // Preserved badges for target verification
  const inputBadge1 = document.getElementById('input-badge-1');
  const inputBadge2 = document.getElementById('input-badge-2');
  const buttonBadge = document.getElementById('button-badge');

  // =========================================================================
  // Target Word Verification Logic (Preserved as requested, not active on click)
  // =========================================================================
  const TARGET_TEXT = 'איזנקוט';

  function verifyTargetText(text) {
    if (!text || typeof text !== 'string') return false;
    return text.includes(TARGET_TEXT);
  }

  function showSuccessBadge(badgeEl) {
    if (!badgeEl) return;
    badgeEl.className = 'result-badge badge-success';
    badgeEl.innerHTML = '&#10004;';
    badgeEl.classList.remove('hidden');
  }

  function showErrorBadge(badgeEl) {
    if (!badgeEl) return;
    badgeEl.className = 'result-badge badge-error';
    badgeEl.innerHTML = '&#10006;';
    badgeEl.classList.remove('hidden');
  }

  function resetBadges() {
    [inputBadge1, inputBadge2, buttonBadge].forEach(b => {
      if (b) {
        b.className = 'result-badge hidden';
        b.innerHTML = '';
      }
    });
  }

  // Toggle log panel visibility
  toggleLogBtn.addEventListener('click', () => {
    scrapingLogPanel.classList.toggle('hidden');
    toggleLogBtn.textContent = scrapingLogPanel.classList.contains('hidden') ? 'Inspection Log' : 'Hide Log';
  });

  // Toggle from initial button to input form
  enterSourceBtn.addEventListener('click', () => {
    initialView.classList.add('hidden');
    inputView.classList.remove('hidden');
    sourceInput1.focus();
  });

  // Logger helpers
  const logEntries = [];
  function addLog(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌', scroll: '📜', engine: '⚙️' };
    const prefix = icons[type] || '•';
    const line = `[${timestamp}] ${prefix} ${message}`;
    logEntries.push(line);
    if (scrapingLogContent) {
      scrapingLogContent.textContent = logEntries.join('\n');
      scrapingLogContent.scrollTop = scrapingLogContent.scrollHeight;
    }
  }

  function resetLogs() {
    logEntries.length = 0;
    if (scrapingLogContent) scrapingLogContent.textContent = '';
    setBotBadge('Ready', 'neutral');
  }

  function setBotBadge(text, state) {
    if (!botShieldStatus) return;
    botShieldStatus.textContent = text;
    botShieldStatus.className = `bot-badge badge-${state}`;
  }

  // =========================================================================
  // Dual Source Check Action ("Check Sources")
  // =========================================================================
  const handleCheckSources = async () => {
    const input1 = sourceInput1.value.trim();
    const input2 = sourceInput2.value.trim();

    resetBadges();
    hideStatus();
    resetHeadlines();
    resetLogs();

    if (!input1 && !input2) {
      showStatus('Please enter at least one source URL or text to check.', 'error');
      sourceInput1.focus();
      return;
    }

    setLoadingState(true);
    addLog('Scraping engine initialized for multi-source inspection.', 'engine');

    const tasks = [];

    // Process Source 1
    if (input1) {
      headlinesOutput1.value = '🔍 Scraping & diagnosing Source 1... Please wait.';
      tasks.push(processSingleSource(input1, 1, headlinesOutput1, headlinesCount1));
    } else {
      headlinesOutput1.value = 'No source entered for Source 1.';
      headlinesCount1.classList.add('hidden');
    }

    // Process Source 2
    if (input2) {
      headlinesOutput2.value = '🔍 Scraping & diagnosing Source 2... Please wait.';
      tasks.push(processSingleSource(input2, 2, headlinesOutput2, headlinesCount2));
    } else {
      headlinesOutput2.value = 'No source entered for Source 2.';
      headlinesCount2.classList.add('hidden');
    }

    try {
      await Promise.allSettled(tasks);
      setLoadingState(false);
      showStatus('Source headlines diagnosed and displayed successfully!', 'success');
      addLog('All source diagnosis tasks completed.', 'success');
    } catch (e) {
      setLoadingState(false);
      showStatus(`Diagnosis completed with warnings: ${e.message}`, 'error');
    }
  };

  // Process an individual source independently
  async function processSingleSource(rawInput, sourceNum, outputEl, countEl) {
    try {
      addLog(`[Source ${sourceNum}] Initializing diagnosis for source...`);
      let content = rawInput;
      let fetchReport = { provider: 'direct', isBotShielded: false, httpStatus: 200, antiBotNote: '' };

      if (looksLikeUrl(rawInput)) {
        addLog(`[Source ${sourceNum}] Target URL: ${rawInput}`);
        addLog(`[Source ${sourceNum}] Executing dynamic headless scraper with network-idle wait...`, 'engine');
        addLog(`[Source ${sourceNum}] Simulating auto-scroll trigger for lazy-loaded items...`, 'scroll');
        const res = await fetchPageContentDynamic(rawInput, sourceNum);
        content = res.content;
        fetchReport = res.report;
      } else {
        addLog(`[Source ${sourceNum}] Input is raw text/HTML snippet. Bypassing network fetch.`);
      }

      addLog(`[Source ${sourceNum}] Running multi-tiered extraction pipeline...`, 'engine');
      const diagnosed = extractHeadlinesUpgraded(content || rawInput, rawInput, fetchReport, sourceNum);
      renderDiagnosedHeadlines(diagnosed, outputEl, countEl, sourceNum);

      if (fetchReport.isBotShielded) {
        setBotBadge('Shield Detected', 'error');
        addLog(`[Source ${sourceNum}] Anti-bot challenge flagged: ${fetchReport.antiBotNote}`, 'error');
      } else if (diagnosed.totalCount === 0) {
        addLog(`[Source ${sourceNum}] Warning: 0 headlines found.`, 'warning');
      } else {
        setBotBadge('Clean Render', 'success');
        addLog(`[Source ${sourceNum}] Extraction succeeded: ${diagnosed.totalCount} headlines diagnosed.`, 'success');
      }
    } catch (err) {
      outputEl.value = `❌ Source ${sourceNum} Error: ${err.message || 'Diagnosis failed.'}\n\nTip: You can copy and paste the article text or HTML directly into the box.`;
      countEl.classList.add('hidden');
      addLog(`[Source ${sourceNum}] Scraping error: ${err.message}`, 'error');
    }
  }

  function looksLikeUrl(text) {
    if (text.includes('\n')) return false;
    return /^https?:\/\//i.test(text) || (!text.includes(' ') && /^[a-z0-9-]+(\.[a-z]{2,})+/i.test(text));
  }

  // =========================================================================
  // Dynamic Scraping Engine with Headless SPA Support & Anti-Bot Inspection
  // =========================================================================
  async function fetchPageContentDynamic(inputUrl, sourceNum = 1) {
    let url = inputUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    const report = {
      provider: '',
      isBotShielded: false,
      httpStatus: 200,
      antiBotNote: '',
      emptyContainerDetected: false
    };

    function detectBotShields(text) {
      if (!text || typeof text !== 'string') return null;
      const lower = text.toLowerCase();

      if (lower.includes('attention required! | cloudflare') || lower.includes('cf-browser-verification')) {
        return 'Cloudflare Security Challenge / Browser Verification';
      }
      if (lower.includes('just a moment...') && lower.includes('cloudflare')) {
        return 'Cloudflare "Just a moment..." Under Attack Mode';
      }
      if (lower.includes('incapsula incident id') || lower.includes('powered by imperva')) {
        return 'Imperva / Incapsula Bot Shield';
      }
      if (lower.includes('access denied') && lower.includes('403 forbidden')) {
        return 'HTTP 403 Forbidden - Access Denied by WAF';
      }
      if (lower.includes('challenge-platform') || lower.includes('captcha-delivery')) {
        return 'Automated CAPTCHA Delivery Detected';
      }
      return null;
    }

    // 1. Primary: Headless Chromium SPA Render via Jina Reader
    try {
      addLog(`[Source ${sourceNum}] Connecting to headless browser engine...`);
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(`https://r.jina.ai/${url}`, {
        signal: controller.signal,
        headers: {
          'Accept': 'text/plain, text/html',
          'X-Wait-For-Selector': 'article, main, [role="main"], h1',
          'X-Timeout': '15',
          'X-With-Generated-Alt': 'true'
        }
      });
      clearTimeout(tId);

      report.httpStatus = res.status;

      if (res.ok) {
        const text = await res.text();
        const shield = detectBotShields(text);

        if (shield) {
          report.isBotShielded = true;
          report.antiBotNote = shield;
          addLog(`[Source ${sourceNum}] Headless provider flagged anti-bot challenge: ${shield}`, 'warning');
        } else if (text && text.length > 40) {
          report.provider = 'Jina Headless Browser Engine (Rendered DOM & JS executed)';
          addLog(`[Source ${sourceNum}] Dynamic rendering succeeded: headless browser rendered DOM.`, 'success');
          return { content: text, report };
        }
      } else if (res.status === 403 || res.status === 401) {
        report.isBotShielded = true;
        report.antiBotNote = `HTTP ${res.status} Forbidden returned by target server.`;
        addLog(`[Source ${sourceNum}] Headless provider returned status ${res.status}: Access Denied.`, 'warning');
      }
    } catch (e) {
      addLog(`[Source ${sourceNum}] Headless rendering connection failed or timed out: ${e.message}. Attempting proxy fallback...`, 'warning');
    }

    // 2. Secondary: Raw HTML Proxy via AllOrigins
    try {
      addLog(`[Source ${sourceNum}] Falling back to proxy extraction...`);
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, {
        signal: controller.signal
      });
      clearTimeout(tId);

      if (res.ok) {
        const json = await res.json();
        const httpCode = json?.status?.http_code || 200;
        report.httpStatus = httpCode;
        const rawHtml = json.contents || '';

        const shield = detectBotShields(rawHtml);
        if (shield || httpCode === 403) {
          report.isBotShielded = true;
          report.antiBotNote = shield || `Target server returned HTTP ${httpCode} Forbidden.`;
          addLog(`[Source ${sourceNum}] Proxy inspection: ${report.antiBotNote}`, 'error');
        }

        if (rawHtml && rawHtml.length > 50) {
          report.provider = 'AllOrigins Raw HTML Proxy';
          addLog(`[Source ${sourceNum}] Raw HTML proxy response received.`, 'info');
          return { content: rawHtml, report };
        }
      }
    } catch (e) {
      addLog(`[Source ${sourceNum}] Proxy fallback failed: ${e.message}`, 'warning');
    }

    // 3. Tertiary: CodeTabs Proxy Gateway
    try {
      addLog(`[Source ${sourceNum}] Falling back to secondary CORS gateway...`);
      const controller = new AbortController();
      const tId = setTimeout(() => controller.abort(), 9000);

      const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, {
        signal: controller.signal
      });
      clearTimeout(tId);

      if (res.ok) {
        const txt = await res.text();
        const shield = detectBotShields(txt);
        if (shield) {
          report.isBotShielded = true;
          report.antiBotNote = shield;
        }
        if (txt && txt.length > 50) {
          report.provider = 'CodeTabs Gateway';
          addLog(`[Source ${sourceNum}] Secondary CORS gateway response received.`, 'info');
          return { content: txt, report };
        }
      }
    } catch (e) {
      addLog(`[Source ${sourceNum}] Secondary CORS gateway failed: ${e.message}`, 'warning');
    }

    if (report.isBotShielded) {
      throw new Error(`Target website blocked access with an anti-bot shield (${report.antiBotNote}).`);
    }

    throw new Error('Unable to retrieve content: all dynamic renderers and proxy gateways failed.');
  }

  // =========================================================================
  // Upgraded Multi-Tiered Headline Extraction with Broadened Selectors & SPA State
  // =========================================================================
  function extractHeadlinesUpgraded(rawContent, originalInput, fetchReport, sourceNum = 1) {
    if (!rawContent || typeof rawContent !== 'string') {
      return { mainHeadline: '', subHeadline: '', allHeadlines: [], totalCount: 0 };
    }

    let mainHeadline = '';
    let subHeadline = '';
    const collected = [];
    const seenMap = new Map();

    function decodeEntities(str) {
      if (!str) return '';
      const txt = document.createElement('textarea');
      txt.innerHTML = str;
      return txt.value;
    }

    function cleanString(str) {
      if (!str) return '';
      let cleaned = decodeEntities(str)
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')     // unwrap markdown links
        .replace(/[*_`~#]/g, '')                      // strip markdown symbols & hashes
        .replace(/<[^>]*>/g, '')                      // strip HTML tags
        .replace(/[\u200E\u200F\u202A-\u202E]/g, '') // remove bidirectional formatting
        .replace(/^[\s*>\-–—:•\d.]+\s*/, '')         // remove leading bullets & dashes
        .replace(/\s+/g, ' ')                         // collapse whitespace
        .trim();

      cleaned = cleaned.replace(/^["'״׳«»“”]+|["'״׳«»“”]+$/g, '').trim();
      return cleaned;
    }

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

      return blockedPhrases.some(p => lower === p || lower.startsWith(p + ' ') || lower.endsWith(' ' + p));
    }

    function normalizeKey(str) {
      return str.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    }

    function registerHeadline(text, category = 'general') {
      const cleaned = cleanString(text);
      if (!cleaned || isBoilerplateOrNav(cleaned)) return;
      if (!cleaned.includes(' ') && cleaned.length < 12) return;

      const key = normalizeKey(cleaned);
      if (!key || key.length < 4) return;

      let existingIndex = -1;
      for (let i = 0; i < collected.length; i++) {
        const existingKey = normalizeKey(collected[i]);
        if (existingKey === key) {
          existingIndex = i;
          break;
        }
        if (key.length > existingKey.length && key.includes(existingKey) && (existingKey.length / key.length) > 0.6) {
          collected[i] = cleaned;
          existingIndex = i;
          break;
        } else if (existingKey.length > key.length && existingKey.includes(key) && (key.length / existingKey.length) > 0.6) {
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
    // Tier 1 & 4: Metadata, Microdata & Hydration State Extraction
    // =========================================================================
    if (isHtmlContent) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawContent, 'text/html');

        // A. Next.js / Nuxt.js Client-Side SPA Hydration State
        const nextDataScript = doc.getElementById('__NEXT_DATA__');
        if (nextDataScript) {
          try {
            const nextJson = JSON.parse(nextDataScript.textContent);
            addLog(`[Source ${sourceNum}] Discovered Next.js client SPA state (__NEXT_DATA__).`, 'info');
            extractFromJsonObject(nextJson);
          } catch (_) {}
        }

        const nuxtDataScript = doc.getElementById('__NUXT_DATA__');
        if (nuxtDataScript) {
          try {
            const nuxtJson = JSON.parse(nuxtDataScript.textContent);
            addLog(`[Source ${sourceNum}] Discovered Nuxt.js client SPA state (__NUXT_DATA__).`, 'info');
            extractFromJsonObject(nuxtJson);
          } catch (_) {}
        }

        function extractFromJsonObject(obj, depth = 0) {
          if (!obj || depth > 8 || typeof obj !== 'object') return;
          if (Array.isArray(obj)) {
            obj.forEach(item => extractFromJsonObject(item, depth + 1));
            return;
          }
          for (const [k, v] of Object.entries(obj)) {
            const keyLower = k.toLowerCase();
            if (typeof v === 'string') {
              if (keyLower === 'headline' || keyLower === 'title' || keyLower === 'post_title' || keyLower === 'articletitle') {
                registerHeadline(v, 'general');
              } else if (keyLower === 'subtitle' || keyLower === 'description' || keyLower === 'summary') {
                if (v.length > 25 && v.length < 350) registerHeadline(v, 'sub');
              }
            } else if (typeof v === 'object') {
              extractFromJsonObject(v, depth + 1);
            }
          }
        }

        // B. JSON-LD Article Schema
        const ldScripts = doc.querySelectorAll('script[type="application/ld+json"]');
        let ldCount = 0;
        ldScripts.forEach((script) => {
          try {
            const data = JSON.parse(script.textContent);
            const items = Array.isArray(data) ? data : (data['@graph'] ? data['@graph'] : [data]);

            items.forEach((item) => {
              if (item && typeof item === 'object') {
                if (item.headline) { registerHeadline(item.headline, 'main'); ldCount++; }
                if (item.alternativeHeadline) { registerHeadline(item.alternativeHeadline, 'sub'); ldCount++; }
                if (item.description && typeof item.description === 'string' && item.description.length > 20) {
                  registerHeadline(item.description, 'sub');
                }
                if (Array.isArray(item.itemListElement)) {
                  item.itemListElement.forEach((entry) => {
                    if (entry?.name) { registerHeadline(entry.name, 'general'); ldCount++; }
                    if (entry?.item?.headline) { registerHeadline(entry.item.headline, 'general'); ldCount++; }
                    if (entry?.item?.name) { registerHeadline(entry.item.name, 'general'); ldCount++; }
                  });
                }
              }
            });
          } catch (_) {}
        });
        if (ldCount > 0) addLog(`[Source ${sourceNum}] Extracted ${ldCount} headline(s) from JSON-LD schema metadata.`, 'info');

        // C. OpenGraph & Twitter Meta Tags
        const ogTitle = doc.querySelector('meta[property="og:title"], meta[name="og:title"], meta[property="og:headline"]')?.getAttribute('content');
        if (ogTitle) registerHeadline(ogTitle, 'main');

        const ogDesc = doc.querySelector('meta[property="og:description"], meta[name="og:description"]')?.getAttribute('content');
        if (ogDesc && ogDesc.length > 20) registerHeadline(ogDesc, 'sub');

        const twTitle = doc.querySelector('meta[name="twitter:title"], meta[property="twitter:title"]')?.getAttribute('content');
        if (twTitle) registerHeadline(twTitle, 'main');

        const twDesc = doc.querySelector('meta[name="twitter:description"], meta[property="twitter:description"]')?.getAttribute('content');
        if (twDesc && twDesc.length > 20) registerHeadline(twDesc, 'sub');

        // D. Microdata
        doc.querySelectorAll('[itemprop="headline"], [itemprop="name"], [itemprop="alternativeHeadline"]').forEach(el => {
          registerHeadline(el.textContent, 'general');
        });

        // E. Document Title
        if (doc.title) {
          const cleanedTitle = doc.title.replace(/\s*[-–|:]\s*(ynet|וואלה|חדשות 12|mako|הארץ|מעריב|ישראל היום|the marker|n12|cnn|bbc|reuters|ap news|guardian).*$/i, '');
          registerHeadline(cleanedTitle, 'main');
        }

        // =====================================================================
        // Noise Removal before DOM Extraction
        // =====================================================================
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
          'style', 'noscript', 'svg'
        ];

        const cleanedDoc = doc.cloneNode(true);
        cleanedDoc.querySelectorAll(noiseSelectors.join(', ')).forEach((node) => {
          try { node.remove(); } catch (_) {}
        });

        // =====================================================================
        // Broadened CSS Selectors (ARIA roles, substring patterns, article links)
        // =====================================================================
        const broadenedSelectors = [
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          '[role="heading"]', '[aria-level]',
          '[class*="title" i]', '[id*="title" i]',
          '[class*="headline" i]', '[id*="headline" i]',
          '[class*="card-title" i]', '[id*="card-title" i]',
          '[class*="post-title" i]', '[id*="post-title" i]',
          '[class*="entry-title" i]', '[id*="entry-title" i]',
          '[class*="article-title" i]', '[id*="article-title" i]',
          '[class*="story-title" i]', '[id*="story-title" i]',
          '[class*="mainTitle" i]', '[class*="subTitle" i]', '[class*="slotTitle" i]',
          '[class*="teaser-title" i]', '[class*="feed-title" i]',
          '[data-qa*="headline" i]', '[data-mrf-title]'
        ];

        const semanticContainers = cleanedDoc.querySelectorAll('article, [role="article"], main, [role="main"], section[class*="article" i], section[class*="content" i]');

        if (semanticContainers.length > 0) {
          semanticContainers.forEach((container) => {
            container.querySelectorAll(broadenedSelectors.join(', ')).forEach((el) => {
              const tag = el.tagName.toLowerCase();
              const cat = (tag === 'h1' || el.matches('[class*="mainTitle" i]')) ? 'main' : (tag === 'h2' || el.matches('[class*="subTitle" i]')) ? 'sub' : 'general';
              registerHeadline(el.textContent, cat);
            });

            container.querySelectorAll('a').forEach((link) => {
              const linkText = link.textContent.trim();
              if (linkText.length >= 18 && linkText.length <= 250 && linkText.includes(' ')) {
                registerHeadline(linkText, 'general');
              }
            });
          });
        }

        if (collected.length < 4) {
          cleanedDoc.querySelectorAll(broadenedSelectors.join(', ')).forEach((el) => {
            const tag = el.tagName.toLowerCase();
            const cat = (tag === 'h1') ? 'main' : 'general';
            registerHeadline(el.textContent, cat);
          });

          cleanedDoc.querySelectorAll('article a, main a').forEach((link) => {
            const linkText = link.textContent.trim();
            if (linkText.length >= 18 && linkText.length <= 250 && linkText.includes(' ')) {
              registerHeadline(linkText, 'general');
            }
          });
        }
      } catch (_) {}
    }

    // =========================================================================
    // Markdown & Jina Reader Handling
    // =========================================================================
    const lines = rawContent.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (/^Title:\s*(.+)$/i.test(line)) {
        const m = line.match(/^Title:\s*(.+)$/i);
        if (m && m[1]) registerHeadline(m[1], 'main');
        continue;
      }

      const hMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (hMatch) {
        const level = hMatch[1].length;
        const text = hMatch[2];
        if (level === 1) {
          registerHeadline(text, 'main');
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

      const linkMatch = line.match(/^(?:[-*•\d.]+\s*)?\[([^\]]{15,300})\]\(https?:\/\/[^)]+\)/);
      if (linkMatch && linkMatch[1]) {
        registerHeadline(linkMatch[1], 'general');
        continue;
      }

      const boldMatch = line.match(/^\s*\*\*([^*\n]{15,300})\*\*\s*$/);
      if (boldMatch && boldMatch[1]) {
        registerHeadline(boldMatch[1], 'general');
        continue;
      }
    }

    // Plain text fallback
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

  // Render the diagnosed headlines for an individual source output box
  function renderDiagnosedHeadlines(diagnosed, outputEl, countEl, sourceNum) {
    if (!diagnosed || diagnosed.allHeadlines.length === 0) {
      outputEl.value = `No headlines were detected in Source ${sourceNum}.\n\nTip: You can copy and paste the text or HTML of the article directly into the input box above.`;
      countEl.textContent = '';
      countEl.classList.add('hidden');
      return;
    }

    const sections = [];

    // 1. Main Headline
    if (diagnosed.mainHeadline) {
      sections.push(`📌 כותרת ראשית (Main Headline):\n${diagnosed.mainHeadline}`);
    }

    // 2. Sub-Headline / Summary
    if (diagnosed.subHeadline && diagnosed.subHeadline !== diagnosed.mainHeadline) {
      sections.push(`📝 כותרת משנה / תקציר (Sub-Headline):\n${diagnosed.subHeadline}`);
    }

    // 3. All Diagnosed Headlines List
    const listLines = diagnosed.allHeadlines.map((h, index) => `${index + 1}. ${h}`);
    sections.push(`📰 כל הכותרות שאובחנו ממקור ${sourceNum} (${diagnosed.totalCount}):\n${listLines.join('\n\n')}`);

    outputEl.value = sections.join('\n\n========================================\n\n');

    countEl.textContent = `${diagnosed.totalCount} headlines`;
    countEl.classList.remove('hidden');
  }

  function resetHeadlines() {
    headlinesOutput1.value = '';
    headlinesOutput2.value = '';
    headlinesCount1.textContent = '';
    headlinesCount2.textContent = '';
    headlinesCount1.classList.add('hidden');
    headlinesCount2.classList.add('hidden');
  }

  function setLoadingState(isLoading) {
    if (isLoading) {
      checkSourceBtn.disabled = true;
      checkSourceBtn.textContent = 'Checking Sources...';
    } else {
      checkSourceBtn.disabled = false;
      checkSourceBtn.textContent = 'Check Sources';
    }
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

  checkSourceBtn.addEventListener('click', handleCheckSources);

  // Trigger check on Enter (without Shift) from either source input
  [sourceInput1, sourceInput2].forEach(input => {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleCheckSources();
      }
    });

    input.addEventListener('input', () => {
      hideStatus();
      if (!sourceInput1.value.trim() && !sourceInput2.value.trim()) {
        resetHeadlines();
        resetLogs();
      }
    });
  });
});
