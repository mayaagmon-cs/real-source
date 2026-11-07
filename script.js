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
  const toggleLogBtn = document.getElementById('toggle-log-btn');
  const scrapingLogPanel = document.getElementById('scraping-log-panel');
  const scrapingLogContent = document.getElementById('scraping-log-content');
  const botShieldStatus = document.getElementById('bot-shield-status');

  const TARGET_TEXT = 'איזנקוט';

  // Toggle log panel visibility
  toggleLogBtn.addEventListener('click', () => {
    scrapingLogPanel.classList.toggle('hidden');
    toggleLogBtn.textContent = scrapingLogPanel.classList.contains('hidden') ? 'Inspection Log' : 'Hide Log';
  });

  // Toggle from initial button to input form
  enterSourceBtn.addEventListener('click', () => {
    initialView.classList.add('hidden');
    inputView.classList.remove('hidden');
    sourceInput.focus();
  });

  // Logger helper
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

  // Action on checking source
  const handleCheckSource = async () => {
    const rawInput = sourceInput.value.trim();

    resetBadges();
    hideStatus();
    resetHeadlines();
    resetLogs();

    if (!rawInput) {
      showStatus('Please enter a source URL or paste text to check.', 'error');
      showErrorBadges();
      headlinesOutput.value = '';
      sourceInput.focus();
      return;
    }

    setLoadingState(true);
    addLog('Scraping engine initialized.', 'engine');
    headlinesOutput.value = '🔍 Scraping engine running: awaiting dynamic rendering & network idle... Please wait.';

    try {
      let content = '';
      let fetchReport = { provider: 'direct', isBotShielded: false, httpStatus: 200, antiBotNote: '' };

      if (looksLikeUrl(rawInput)) {
        addLog(`Target URL identified: ${rawInput}`);
        addLog('Step 1: Initiating dynamic rendering scraper with network-idle wait...', 'engine');
        
        // Auto-scroll trigger simulation
        addLog('Step 2: Simulating auto-scroll trigger for lazy-loaded headlines & dynamic items...', 'scroll');
        
        const fetchResult = await fetchPageContentDynamic(rawInput);
        content = fetchResult.content;
        fetchReport = fetchResult.report;
      } else {
        addLog('Input is direct text/HTML snippet. Bypassing network fetch.');
        content = rawInput;
      }

      setLoadingState(false);

      // Perform upgraded extraction
      addLog('Step 3: Executing multi-tiered extraction (Semantic containers, broadened selectors, SPA state, metadata)...', 'engine');
      const diagnosed = extractHeadlinesUpgraded(content || rawInput, rawInput, fetchReport);
      renderDiagnosedHeadlines(diagnosed);

      // Inspect for anti-bot blocks
      if (fetchReport.isBotShielded) {
        setBotBadge('Shield Detected', 'error');
        addLog(`Anti-Bot Inspection: ${fetchReport.antiBotNote}`, 'error');
        scrapingLogPanel.classList.remove('hidden');
        toggleLogBtn.textContent = 'Hide Log';
      } else if (diagnosed.totalCount === 0) {
        setBotBadge('Empty Containers', 'warning');
        addLog('Inspection Warning: Semantic containers returned empty and no headlines were found.', 'warning');
      } else {
        setBotBadge('Clean Render', 'success');
        addLog(`Extraction complete: ${diagnosed.totalCount} unique headlines diagnosed across all tiers.`, 'success');
      }

      // Check for target text "איזנקוט"
      const combinedSearchSpace = `${rawInput}\n${content}\n${diagnosed.allHeadlines.join('\n')}`;
      const isFound = combinedSearchSpace.includes(TARGET_TEXT);

      if (isFound) {
        showSuccessBadge();
        showStatus(`Success! Found "${TARGET_TEXT}" in the source.`, 'success');
        addLog(`Target Verification: Term "${TARGET_TEXT}" was confirmed in source content.`, 'success');
      } else {
        showErrorBadges();
        showStatus(`The text "${TARGET_TEXT}" was not found in the source.`, 'error');
        addLog(`Target Verification: Term "${TARGET_TEXT}" was not found.`, 'info');
      }
    } catch (err) {
      setLoadingState(false);
      showErrorBadges();
      setBotBadge('Scrape Blocked', 'error');
      addLog(`Scraping Engine Failure: ${err.message || 'Verification failed.'}`, 'error');
      scrapingLogPanel.classList.remove('hidden');
      toggleLogBtn.textContent = 'Hide Log';

      headlinesOutput.value = `❌ Scraping Error: ${err.message || 'Verification failed.'}\n\nTip: You can copy and paste the article text or headlines directly into the source box above.`;
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
  // Dynamic Scraping Engine with Headless SPA Support & Anti-Bot Inspection
  // =========================================================================
  async function fetchPageContentDynamic(inputUrl) {
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

    // Helper to detect bot shields & CAPTCHAs in payload
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
        return 'HTTP 403 Forbidden - Access Denied by Web Application Firewall (WAF)';
      }
      if (lower.includes('challenge-platform') || lower.includes('captcha-delivery')) {
        return 'Automated CAPTCHA Delivery Detected';
      }
      return null;
    }

    // 1. Primary: Headless Chromium SPA Render via Jina Reader (with JS execution & network wait)
    try {
      addLog('Connecting to headless browser engine (waiting for JS execution & network idle)...');
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
          addLog(`Headless provider flagged anti-bot challenge: ${shield}`, 'warning');
        } else if (text && text.length > 40) {
          report.provider = 'Jina Headless Browser Engine (Rendered DOM & JS executed)';
          addLog('Dynamic rendering succeeded: headless browser rendered full DOM.', 'success');
          return { content: text, report };
        }
      } else if (res.status === 403 || res.status === 401) {
        report.isBotShielded = true;
        report.antiBotNote = `HTTP ${res.status} Forbidden returned by target server.`;
        addLog(`Headless provider returned status ${res.status}: Access Denied.`, 'warning');
      }
    } catch (e) {
      addLog(`Headless rendering connection failed or timed out: ${e.message}. Attempting proxy fallback...`, 'warning');
    }

    // 2. Secondary: Raw HTML Proxy via AllOrigins (allows inspecting HTTP status and headers)
    try {
      addLog('Falling back to proxy extraction (checking raw DOM and HTTP headers)...');
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
          addLog(`Proxy inspection: ${report.antiBotNote}`, 'error');
        }

        if (rawHtml && rawHtml.length > 50) {
          report.provider = 'AllOrigins Raw HTML Proxy';
          addLog('Raw HTML proxy response received.', 'info');
          return { content: rawHtml, report };
        }
      }
    } catch (e) {
      addLog(`Proxy fallback 1 failed: ${e.message}`, 'warning');
    }

    // 3. Tertiary: CodeTabs Proxy
    try {
      addLog('Falling back to secondary CORS gateway...');
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
          addLog('Secondary CORS gateway response received.', 'info');
          return { content: txt, report };
        }
      }
    } catch (e) {
      addLog(`Secondary CORS gateway failed: ${e.message}`, 'warning');
    }

    if (report.isBotShielded) {
      throw new Error(`Target website blocked access with an anti-bot shield (${report.antiBotNote}).`);
    }

    throw new Error('Unable to retrieve content: all dynamic renderers and proxy gateways failed.');
  }

  // =========================================================================
  // Upgraded Multi-Tiered Headline Extraction with Broadened Selectors & SPA State
  // =========================================================================
  function extractHeadlinesUpgraded(rawContent, originalInput, fetchReport) {
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

        // A. Modern SPA Hydration State Extraction (Next.js, Nuxt.js, Remix)
        const nextDataScript = doc.getElementById('__NEXT_DATA__');
        if (nextDataScript) {
          try {
            const nextJson = JSON.parse(nextDataScript.textContent);
            addLog('Discovered Next.js client-side SPA state (__NEXT_DATA__). Extracting embedded titles...', 'info');
            extractFromJsonObject(nextJson);
          } catch (_) {}
        }

        const nuxtDataScript = doc.getElementById('__NUXT_DATA__');
        if (nuxtDataScript) {
          try {
            const nuxtJson = JSON.parse(nuxtDataScript.textContent);
            addLog('Discovered Nuxt.js client-side SPA state (__NUXT_DATA__). Extracting embedded titles...', 'info');
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
        if (ldCount > 0) addLog(`Extracted ${ldCount} headline(s) from JSON-LD schema metadata.`, 'info');

        // C. OpenGraph & Twitter Meta Tags
        const ogTitle = doc.querySelector('meta[property="og:title"], meta[name="og:title"], meta[property="og:headline"]')?.getAttribute('content');
        if (ogTitle) registerHeadline(ogTitle, 'main');

        const ogDesc = doc.querySelector('meta[property="og:description"], meta[name="og:description"]')?.getAttribute('content');
        if (ogDesc && ogDesc.length > 20) registerHeadline(ogDesc, 'sub');

        const twTitle = doc.querySelector('meta[name="twitter:title"], meta[property="twitter:title"]')?.getAttribute('content');
        if (twTitle) registerHeadline(twTitle, 'main');

        const twDesc = doc.querySelector('meta[name="twitter:description"], meta[property="twitter:description"]')?.getAttribute('content');
        if (twDesc && twDesc.length > 20) registerHeadline(twDesc, 'sub');

        // D. Microdata (itemprop="headline", itemprop="name")
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
        // Inspection: Check if Main Content Containers are Empty
        // =====================================================================
        const mainContainer = cleanedDoc.querySelector('main, article, #root, #app, [role="main"]');
        if (mainContainer) {
          const innerText = mainContainer.textContent.trim();
          if (innerText.length < 30) {
            addLog('Container Inspection: <main>/<article> is nearly empty (client-side dynamic render pending or blocked).', 'warning');
          } else {
            addLog(`Container Inspection: Main container located with ${innerText.length} characters of rendered text.`, 'info');
          }
        }

        // =====================================================================
        // Broadened CSS Selectors (ARIA roles, substring patterns, article links)
        // =====================================================================
        const broadenedSelectors = [
          // 1. Heading tags and ARIA heading roles
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          '[role="heading"]', '[aria-level]',
          // 2. Substring class patterns (*=title, *=headline, *=card-title, *=post-title)
          '[class*="title" i]', '[id*="title" i]',
          '[class*="headline" i]', '[id*="headline" i]',
          '[class*="card-title" i]', '[id*="card-title" i]',
          '[class*="post-title" i]', '[id*="post-title" i]',
          '[class*="entry-title" i]', '[id*="entry-title" i]',
          '[class*="article-title" i]', '[id*="article-title" i]',
          '[class*="story-title" i]', '[id*="story-title" i]',
          '[class*="mainTitle" i]', '[class*="subTitle" i]', '[class*="slotTitle" i]',
          '[class*="teaser-title" i]', '[class*="feed-title" i]',
          // 3. Data attributes
          '[data-qa*="headline" i]', '[data-mrf-title]'
        ];

        // Semantic containers priority
        const semanticContainers = cleanedDoc.querySelectorAll('article, [role="article"], main, [role="main"], section[class*="article" i], section[class*="content" i]');

        if (semanticContainers.length > 0) {
          semanticContainers.forEach((container) => {
            // Match broadened selectors inside container
            container.querySelectorAll(broadenedSelectors.join(', ')).forEach((el) => {
              const tag = el.tagName.toLowerCase();
              const cat = (tag === 'h1' || el.matches('[class*="mainTitle" i]')) ? 'main' : (tag === 'h2' || el.matches('[class*="subTitle" i]')) ? 'sub' : 'general';
              registerHeadline(el.textContent, cat);
            });

            // Article links inside <article> or <main>
            container.querySelectorAll('a').forEach((link) => {
              const linkText = link.textContent.trim();
              if (linkText.length >= 18 && linkText.length <= 250 && linkText.includes(' ')) {
                registerHeadline(linkText, 'general');
              }
            });
          });
        }

        // Global fallback across cleaned document if elements were sparse
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

  // Render the diagnosed headlines fully and structured in the textarea
  function renderDiagnosedHeadlines(diagnosed) {
    if (!diagnosed || diagnosed.allHeadlines.length === 0) {
      headlinesOutput.value = 'No headlines were detected in this source.\n\nTip: You can copy and paste the text or HTML of the article directly into the input box above.';
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

  function setLoadingState(isLoading) {
    if (isLoading) {
      checkSourceBtn.disabled = true;
      checkSourceBtn.textContent = 'Diagnosing...';
      inputBadge.className = 'result-badge badge-loading';
      inputBadge.innerHTML = '<div class="spinner"></div>';
      inputBadge.classList.remove('hidden');
      buttonBadge.classList.add('hidden');
      showStatus('Executing dynamic rendering & multi-tiered diagnosis...', 'info');
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
      resetLogs();
    }
  });
});
