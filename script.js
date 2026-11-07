// Sources Headline Diagnosis & Comparison Engine
// Preserved target verification code
const TARGET_TEXT = 'איזנקוט';

function verifyTargetText(text) {
  if (!text || typeof text !== 'string') return false;
  return text.includes(TARGET_TEXT);
}

// Stores the last diagnosed main headlines from Source 1 and Source 2
const lastExtractedHeadlines = { 1: '', 2: '' };

// Global logger entries
const scrapingLogEntries = [];

function addInspectionLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌', scroll: '📜', engine: '⚙️' };
  const prefix = icons[type] || '•';
  const line = `[${timestamp}] ${prefix} ${message}`;
  scrapingLogEntries.push(line);
  console.log(line);

  const logContent = document.getElementById('scraping-log-content');
  if (logContent) {
    logContent.textContent = scrapingLogEntries.join('\n');
    logContent.scrollTop = logContent.scrollHeight;
  }
}

function resetInspectionLogs() {
  scrapingLogEntries.length = 0;
  const logContent = document.getElementById('scraping-log-content');
  if (logContent) logContent.textContent = '';
  setInspectionBotBadge('Ready', 'neutral');
}

function setInspectionBotBadge(text, state) {
  const badge = document.getElementById('bot-shield-status');
  if (!badge) return;
  badge.textContent = text;
  badge.className = `bot-badge badge-${state}`;
}

function toggleInspectionLog() {
  const panel = document.getElementById('scraping-log-panel');
  const btn = document.getElementById('toggle-log-btn');
  if (!panel) return;
  panel.classList.toggle('hidden');
  if (btn) {
    btn.textContent = panel.classList.contains('hidden') ? 'Inspection Log' : 'Hide Log';
  }
}

// Quick Test Helpers
function loadSampleArticles() {
  const s1 = document.getElementById('source-input-1');
  const s2 = document.getElementById('source-input-2');
  if (s1) {
    s1.value = 
`# מבזק מדיני: המגעים להסדרה אזורית נכנסים לשלב מכריע
השליח המיוחד הגיע לסבב שיחות בביירות ובירושלים. גורמים ביטחוניים מעריכים כי ישנה התקדמות משמעותית.
## תנאי המפתח להסכם על פי מערכת הביטחון
- [דרישה לחופש פעולה מבצעי במקרה של הפרת ההסכם](https://example.com/item1)
- [פריסת כוחות בינלאומיים לאורך קו הגבול](https://example.com/item2)`;
  }
  if (s2) {
    s2.value = 
`# סקירת שוק ההון: מדדי המניות ננעלו בעליות שערים
המסחר בבורסה ננעל במגמה חיובית על רקע יציבות שער החליפין ודוחות החברות המובילות.
## המניות והענפים הבולטים של יום המסחר
- [סקטור הבנקים הוביל את העליות במחזורים ערים](https://example.com/stock1)
- [מניות הטכנולוגיה רשמו התאוששות לאחר שבועות של ירידות](https://example.com/stock2)`;
  }
  showStatusMessage('Sample articles loaded into Source 1 and Source 2. Click "Check Sources" to run!', 'info');
}

function loadSampleUrls() {
  const s1 = document.getElementById('source-input-1');
  const s2 = document.getElementById('source-input-2');
  if (s1) s1.value = 'https://he.wikipedia.org/wiki/גדי_איזנקוט';
  if (s2) s2.value = 'https://example.com';
  showStatusMessage('Sample URLs loaded. Click "Check Sources" to scrape and diagnose!', 'info');
}

function clearAllSources() {
  const s1 = document.getElementById('source-input-1');
  const s2 = document.getElementById('source-input-2');
  const o1 = document.getElementById('headlines-output-1');
  const o2 = document.getElementById('headlines-output-2');
  const c1 = document.getElementById('headlines-count-1');
  const c2 = document.getElementById('headlines-count-2');
  if (s1) s1.value = '';
  if (s2) s2.value = '';
  if (o1) o1.value = '';
  if (o2) o2.value = '';
  if (c1) { c1.textContent = ''; c1.classList.add('hidden'); }
  if (c2) { c2.textContent = ''; c2.classList.add('hidden'); }
  lastExtractedHeadlines[1] = '';
  lastExtractedHeadlines[2] = '';
  clearComparisonFields();
  hideStatusMessage();
  resetInspectionLogs();
}

function showStatusMessage(text, type = 'info') {
  const el = document.getElementById('status-message');
  if (!el) return;
  el.textContent = text;
  el.className = `status-message ${type}`;
  el.classList.remove('hidden');
}

function hideStatusMessage() {
  const el = document.getElementById('status-message');
  if (!el) return;
  el.classList.add('hidden');
  el.textContent = '';
}

function looksLikeUrl(text) {
  if (!text || text.includes('\n')) return false;
  return /^https?:\/\//i.test(text) || (!text.includes(' ') && /^[a-z0-9-]+(\.[a-z]{2,})+/i.test(text));
}

// =========================================================================
// Main "Check Sources" Action Handler (Directly exposed on window)
// =========================================================================
async function handleCheckSources() {
  console.log('⚡ Check Sources triggered');

  const s1El = document.getElementById('source-input-1');
  const s2El = document.getElementById('source-input-2');
  const o1El = document.getElementById('headlines-output-1');
  const o2El = document.getElementById('headlines-output-2');
  const c1El = document.getElementById('headlines-count-1');
  const c2El = document.getElementById('headlines-count-2');
  const btn = document.getElementById('check-source-btn');

  const in1 = s1El ? s1El.value.trim() : '';
  const in2 = s2El ? s2El.value.trim() : '';

  hideStatusMessage();
  resetInspectionLogs();

  if (!in1 && !in2) {
    showStatusMessage('Please enter a source URL or paste text into Source 1 or Source 2.', 'error');
    if (o1El) o1El.value = 'Please enter a source URL or paste article text into Source 1 above.';
    if (o2El) o2El.value = 'Please enter a source URL or paste article text into Source 2 above.';
    if (s1El) s1El.focus();
    return;
  }

  // Update button state immediately
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ Checking Sources...';
  }
  showStatusMessage('Scraping and diagnosing sources... Please wait.', 'info');
  addInspectionLog('Starting diagnosis across provided sources...', 'engine');

  const tasks = [];

  // Source 1
  if (in1) {
    if (o1El) o1El.value = '⏳ Scraping and diagnosing Source 1... Please wait.';
    tasks.push(processSingleSource(in1, 1, o1El, c1El));
  } else {
    if (o1El) o1El.value = 'No source entered for Source 1.';
    if (c1El) c1El.classList.add('hidden');
  }

  // Source 2
  if (in2) {
    if (o2El) o2El.value = '⏳ Scraping and diagnosing Source 2... Please wait.';
    tasks.push(processSingleSource(in2, 2, o2El, c2El));
  } else {
    if (o2El) o2El.value = 'No source entered for Source 2.';
    if (c2El) c2El.classList.add('hidden');
  }

  try {
    await Promise.allSettled(tasks);
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Check Sources';
    }
    showStatusMessage('Source headlines diagnosed and displayed successfully!', 'success');
    addInspectionLog('All source diagnosis tasks completed.', 'success');
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Check Sources';
    }
    showStatusMessage(`Diagnosis finished with notice: ${err.message}`, 'error');
    addInspectionLog(`Error: ${err.message}`, 'error');
  }
}

// Process an individual source independently
async function processSingleSource(rawInput, sourceNum, outputEl, countEl) {
  try {
    addInspectionLog(`[Source ${sourceNum}] Initializing extraction...`);
    let content = rawInput;
    let fetchReport = { provider: 'direct', isBotShielded: false, httpStatus: 200, antiBotNote: '' };

    if (looksLikeUrl(rawInput)) {
      addInspectionLog(`[Source ${sourceNum}] Target URL: ${rawInput}`);
      addInspectionLog(`[Source ${sourceNum}] Fetching via dynamic scraper...`, 'engine');
      const res = await fetchSourceUrl(rawInput, sourceNum);
      content = res.content;
      fetchReport = res.report;
    } else {
      addInspectionLog(`[Source ${sourceNum}] Direct text/HTML detected. Bypassing network fetch.`);
    }

    addInspectionLog(`[Source ${sourceNum}] Running headline extraction engine...`, 'engine');
    const diagnosed = extractHeadlinesFromContent(content || rawInput, sourceNum);
    renderHeadlinesOutput(diagnosed, outputEl, countEl, sourceNum);

    if (diagnosed.mainHeadline) {
      lastExtractedHeadlines[sourceNum] = diagnosed.mainHeadline;
      const targetInput = document.getElementById(sourceNum === 1 ? 'first-headline-input' : 'second-headline-input');
      if (targetInput && !targetInput.value.trim()) {
        targetInput.value = diagnosed.mainHeadline;
      }
    }

    if (fetchReport.isBotShielded) {
      setInspectionBotBadge('Shield Detected', 'error');
      addInspectionLog(`[Source ${sourceNum}] Notice: Remote site returned bot challenge (${fetchReport.antiBotNote})`, 'warning');
    } else if (diagnosed.totalCount === 0) {
      addInspectionLog(`[Source ${sourceNum}] Notice: 0 headlines found in this source.`, 'warning');
    } else {
      setInspectionBotBadge('Clean Render', 'success');
      addInspectionLog(`[Source ${sourceNum}] Succeeded: ${diagnosed.totalCount} headlines extracted.`, 'success');
    }
  } catch (err) {
    if (outputEl) {
      outputEl.value = `❌ Source ${sourceNum} Notice: ${err.message || 'Extraction failed.'}\n\nTip: You can copy and paste the article text or HTML directly into the box above.`;
    }
    if (countEl) countEl.classList.add('hidden');
    addInspectionLog(`[Source ${sourceNum}] Scraping error: ${err.message}`, 'error');
  }
}

// =========================================================================
// Fast, CORS-Safe Fetch Engine (Standard headers only to prevent CORS preflight freezes)
// =========================================================================
async function fetchSourceUrl(inputUrl, sourceNum = 1) {
  let url = inputUrl.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  const report = {
    provider: '',
    isBotShielded: false,
    httpStatus: 200,
    antiBotNote: ''
  };

  function checkShield(text) {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase();
    if (lower.includes('attention required! | cloudflare') || lower.includes('cf-browser-verification')) {
      return 'Cloudflare Verification Challenge';
    }
    if (lower.includes('just a moment...') && lower.includes('cloudflare')) {
      return 'Cloudflare Under Attack Mode';
    }
    if (lower.includes('incapsula incident id') || lower.includes('powered by imperva')) {
      return 'Imperva / Incapsula Bot Shield';
    }
    if (lower.includes('access denied') && lower.includes('403 forbidden')) {
      return 'HTTP 403 Forbidden - Access Denied';
    }
    return null;
  }

  // 1. Primary: Headless Jina Engine (standard Accept header only)
  try {
    addInspectionLog(`[Source ${sourceNum}] Requesting via headless reader...`);
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 9000);

    const res = await fetch(`https://r.jina.ai/${url}`, {
      signal: controller.signal,
      headers: { 'Accept': 'text/plain, text/html' }
    });
    clearTimeout(tId);

    if (res.ok) {
      const text = await res.text();
      const shield = checkShield(text);
      if (shield) {
        report.isBotShielded = true;
        report.antiBotNote = shield;
      }
      if (text && text.length > 40) {
        report.provider = 'Jina Reader Engine';
        addInspectionLog(`[Source ${sourceNum}] Headless render received (${text.length} chars).`, 'success');
        return { content: text, report };
      }
    }
  } catch (e) {
    addInspectionLog(`[Source ${sourceNum}] Reader fallback: ${e.message}`, 'warning');
  }

  // 2. Secondary: Fast Raw Proxy via AllOrigins
  try {
    addInspectionLog(`[Source ${sourceNum}] Requesting via raw CORS gateway...`);
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`, {
      signal: controller.signal
    });
    clearTimeout(tId);

    if (res.ok) {
      const text = await res.text();
      const shield = checkShield(text);
      if (shield) {
        report.isBotShielded = true;
        report.antiBotNote = shield;
      }
      if (text && text.length > 50) {
        report.provider = 'AllOrigins Raw Proxy';
        addInspectionLog(`[Source ${sourceNum}] Raw gateway content received.`, 'info');
        return { content: text, report };
      }
    }
  } catch (e) {
    addInspectionLog(`[Source ${sourceNum}] Raw gateway fallback: ${e.message}`, 'warning');
  }

  // 3. Tertiary: CodeTabs Gateway
  try {
    addInspectionLog(`[Source ${sourceNum}] Requesting via secondary proxy...`);
    const controller = new AbortController();
    const tId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`, {
      signal: controller.signal
    });
    clearTimeout(tId);

    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 50) {
        report.provider = 'CodeTabs Proxy';
        addInspectionLog(`[Source ${sourceNum}] Secondary gateway content received.`, 'info');
        return { content: text, report };
      }
    }
  } catch (e) {
    addInspectionLog(`[Source ${sourceNum}] Secondary proxy failed: ${e.message}`, 'warning');
  }

  if (report.isBotShielded) {
    throw new Error(`Target site blocked automated requests (${report.antiBotNote}).`);
  }

  throw new Error('Could not fetch URL content. Please check the URL or paste the article text directly.');
}

// =========================================================================
// Headline Extraction Pipeline
// =========================================================================
function extractHeadlinesFromContent(rawContent, sourceNum = 1) {
  if (!rawContent || typeof rawContent !== 'string') {
    return { mainHeadline: '', subHeadline: '', allHeadlines: [], totalCount: 0 };
  }

  let mainHeadline = '';
  let subHeadline = '';
  const collected = [];
  const seenKeys = new Set();

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
      .replace(/[*_`~#]/g, '')                      // strip markdown symbols
      .replace(/<[^>]*>/g, '')                      // strip HTML tags
      .replace(/[\u200E\u200F\u202A-\u202E]/g, '') // remove bidirectional marks
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
      'תפריט', 'ניווט', 'חיפוש', 'שיתוף', 'תגובות', 'פרסומת', 'תוכן מקודם', 'דלג לתוכן',
      'עקבו אחרינו', 'הרשמה לניוזלטר', 'התחברות', 'כל הזכויות שמורות', 'קרא עוד',
      'כתבות נוספות', 'אולי יעניין אותך', 'מבזקים', 'שירות לקוחות', 'צור קשר'
    ];
    return blockedPhrases.some((p) => lower === p || lower.startsWith(p + ' ') || lower.endsWith(' ' + p));
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
      seenKeys.add(key);

      if (category === 'main' && !mainHeadline) {
        mainHeadline = cleaned;
      } else if (category === 'sub' && !subHeadline) {
        subHeadline = cleaned;
      }
    }
  }

  const isHtml = /<(html|head|body|article|main|section|div|p|h[1-6]|script|meta)/i.test(rawContent);

  if (isHtml) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawContent, 'text/html');

      // Next.js & Nuxt SPA state
      const nextData = doc.getElementById('__NEXT_DATA__');
      if (nextData) {
        try {
          const parsed = JSON.parse(nextData.textContent);
          function walk(obj, depth = 0) {
            if (!obj || depth > 8 || typeof obj !== 'object') return;
            if (Array.isArray(obj)) { obj.forEach((it) => walk(it, depth + 1)); return; }
            for (const [k, v] of Object.entries(obj)) {
              const kl = k.toLowerCase();
              if (typeof v === 'string') {
                if (kl === 'headline' || kl === 'title' || kl === 'post_title') registerHeadline(v, 'general');
                else if (kl === 'subtitle' || kl === 'description') {
                  if (v.length > 25 && v.length < 350) registerHeadline(v, 'sub');
                }
              } else if (typeof v === 'object') walk(v, depth + 1);
            }
          }
          walk(parsed);
        } catch (_) {}
      }

      // JSON-LD
      doc.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
        try {
          const data = JSON.parse(script.textContent);
          const items = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
          items.forEach((item) => {
            if (item && typeof item === 'object') {
              if (item.headline) registerHeadline(item.headline, 'main');
              if (item.alternativeHeadline) registerHeadline(item.alternativeHeadline, 'sub');
              if (item.description && typeof item.description === 'string' && item.description.length > 20) {
                registerHeadline(item.description, 'sub');
              }
              if (Array.isArray(item.itemListElement)) {
                item.itemListElement.forEach((entry) => {
                  if (entry?.name) registerHeadline(entry.name, 'general');
                  if (entry?.item?.headline) registerHeadline(entry.item.headline, 'general');
                });
              }
            }
          });
        } catch (_) {}
      });

      // OpenGraph & Meta
      const ogTitle = doc.querySelector('meta[property="og:title"], meta[name="og:title"], meta[property="og:headline"]')?.getAttribute('content');
      if (ogTitle) registerHeadline(ogTitle, 'main');
      const ogDesc = doc.querySelector('meta[property="og:description"], meta[name="og:description"]')?.getAttribute('content');
      if (ogDesc && ogDesc.length > 20) registerHeadline(ogDesc, 'sub');

      if (doc.title) {
        registerHeadline(doc.title.replace(/\s*[-–|:]\s*(ynet|וואלה|חדשות 12|mako|הארץ|מעריב|ישראל היום|the marker|n12|cnn|bbc|reuters).*$/i, ''), 'main');
      }

      // Noise cleaning
      const noise = ['nav', 'footer', 'aside', '[role="navigation"]', '[class*="cookie" i]', '[class*="modal" i]', 'style', 'noscript'];
      const cleanedDoc = doc.cloneNode(true);
      cleanedDoc.querySelectorAll(noise.join(', ')).forEach((n) => { try { n.remove(); } catch (_) {} });

      const broadened = [
        'h1', 'h2', 'h3', 'h4', '[role="heading"]',
        '[class*="title" i]', '[class*="headline" i]', '[class*="card-title" i]',
        '[class*="post-title" i]', '[class*="mainTitle" i]', '[class*="subTitle" i]',
        '[data-qa*="headline" i]', '[data-mrf-title]'
      ];

      const containers = cleanedDoc.querySelectorAll('article, [role="article"], main, [role="main"], section');
      if (containers.length > 0) {
        containers.forEach((container) => {
          container.querySelectorAll(broadened.join(', ')).forEach((el) => {
            const tag = el.tagName.toLowerCase();
            const cat = tag === 'h1' || el.matches('[class*="mainTitle" i]') ? 'main' : tag === 'h2' || el.matches('[class*="subTitle" i]') ? 'sub' : 'general';
            registerHeadline(el.textContent, cat);
          });
          container.querySelectorAll('a').forEach((link) => {
            const t = link.textContent.trim();
            if (t.length >= 18 && t.length <= 250 && t.includes(' ')) registerHeadline(t, 'general');
          });
        });
      }

      if (collected.length < 4) {
        cleanedDoc.querySelectorAll(broadened.join(', ')).forEach((el) => {
          registerHeadline(el.textContent, el.tagName.toLowerCase() === 'h1' ? 'main' : 'general');
        });
      }
    } catch (_) {}
  }

  // Markdown lines
  const lines = rawContent.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (/^Title:\s*(.+)$/i.test(line)) {
      const m = line.match(/^Title:\s*(.+)$/i);
      if (m && m[1]) registerHeadline(m[1], 'main');
    } else if (/^#{1,4}\s+(.+)$/.test(line)) {
      const m = line.match(/^(#{1,4})\s+(.+)$/);
      if (m && m[2]) {
        registerHeadline(m[2], m[1].length === 1 ? 'main' : 'general');
        if (m[1].length === 1 && i + 1 < lines.length) {
          const next = lines[i + 1].trim();
          if (next && !next.startsWith('#') && next.length >= 25 && next.length <= 350) {
            registerHeadline(next, 'sub');
          }
        }
      }
    } else if (/^(?:[-*•\d.]+\s*)?\[([^\]]{15,300})\]\(https?:\/\/[^)]+\)/.test(line)) {
      const m = line.match(/^(?:[-*•\d.]+\s*)?\[([^\]]{15,300})\]\(https?:\/\/[^)]+\)/);
      if (m && m[1]) registerHeadline(m[1], 'general');
    } else if (/^\s*\*\*([^*\n]{15,300})\*\*\s*$/.test(line)) {
      const m = line.match(/^\s*\*\*([^*\n]{15,300})\*\*\s*$/);
      if (m && m[1]) registerHeadline(m[1], 'general');
    }
  }

  // Plain text fallback
  if (collected.length === 0) {
    const candidates = lines.map((l) => l.trim()).filter((l) => l.length >= 8 && !isBoilerplateOrNav(l));
    if (candidates.length > 0) {
      registerHeadline(candidates[0], 'main');
      if (candidates.length > 1 && candidates[1].length >= 15) registerHeadline(candidates[1], 'sub');
      for (let i = 2; i < Math.min(candidates.length, 12); i++) registerHeadline(candidates[i], 'general');
    }
  }

  if (!mainHeadline && collected.length > 0) mainHeadline = collected[0];

  return {
    mainHeadline,
    subHeadline,
    allHeadlines: collected,
    totalCount: collected.length
  };
}

// Render headlines in the output textarea
function renderHeadlinesOutput(diagnosed, outputEl, countEl, sourceNum) {
  if (!outputEl) return;
  if (!diagnosed || diagnosed.allHeadlines.length === 0) {
    outputEl.value = `No headlines were detected in Source ${sourceNum}.\n\nTip: You can copy and paste the text or HTML of the article directly into the box above.`;
    if (countEl) {
      countEl.textContent = '';
      countEl.classList.add('hidden');
    }
    return;
  }

  const sections = [];

  if (diagnosed.mainHeadline) {
    sections.push(`📌 כותרת ראשית (Main Headline):\n${diagnosed.mainHeadline}`);
  }

  if (diagnosed.subHeadline && diagnosed.subHeadline !== diagnosed.mainHeadline) {
    sections.push(`📝 כותרת משנה / תקציר:\n${diagnosed.subHeadline}`);
  }

  const list = diagnosed.allHeadlines.map((h, i) => `${i + 1}. ${h}`);
  sections.push(`📰 כל הכותרות שנמצאו במקור ${sourceNum} (${diagnosed.totalCount}):\n${list.join('\n\n')}`);

  outputEl.value = sections.join('\n\n========================================\n\n');

  if (countEl) {
    countEl.textContent = `${diagnosed.totalCount} headlines`;
    countEl.classList.remove('hidden');
  }
}

// =========================================================================
// Headline Comparison Engine
// =========================================================================
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function compareTwoHeadlines(str1, str2) {
  if (!str1 || !str2) {
    return {
      score: 0,
      category: 'low',
      verdict: 'Please enter both headlines to compare.',
      sharedWords: [],
      unique1: [],
      unique2: []
    };
  }

  const s1 = str1.trim();
  const s2 = str2.trim();

  // Stop words in Hebrew & English
  const stopWords = new Set([
    'של', 'על', 'את', 'עם', 'זה', 'זו', 'כי', 'אם', 'גם', 'רק', 'כל', 'לא', 'כן',
    'הוא', 'היא', 'הם', 'הן', 'או', 'בין', 'אל', 'עד', 'כדי', 'כפי', 'אך', 'אבל',
    'מאת', 'עלפי', 'לפי', 'בשל', 'עקב', 'תוך', 'עוד', 'כבר', 'אשר', 'כמו', 'היה', 'היתה', 'היו',
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'of', 'to',
    'for', 'and', 'or', 'by', 'with', 'from', 'that', 'this', 'as', 'it', 'be', 'has', 'have'
  ]);

  function getTokens(text) {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length >= 2 && !stopWords.has(w));
  }

  function getBigrams(text) {
    const clean = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    const grams = [];
    for (let i = 0; i < clean.length - 1; i++) {
      grams.push(clean.substring(i, i + 2));
    }
    return grams;
  }

  const tokens1 = getTokens(s1);
  const tokens2 = getTokens(s2);

  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);

  // Exact word overlap
  const sharedWords = [];
  set1.forEach(word => {
    if (set2.has(word)) {
      sharedWords.push(word);
    }
  });

  // Fuzzy word matching for Hebrew prefixes (e.g. "המגעים" ~ "מגעים", "בביירות" ~ "ביירות")
  set1.forEach(w1 => {
    if (!set2.has(w1)) {
      set2.forEach(w2 => {
        if (!set1.has(w2) && !sharedWords.includes(w1) && !sharedWords.includes(w2)) {
          if (w1.length >= 4 && w2.length >= 4) {
            if (w1.includes(w2) || w2.includes(w1)) {
              sharedWords.push(`${w1} ≈ ${w2}`);
            }
          }
        }
      });
    }
  });

  const unique1 = tokens1.filter(w => !set2.has(w) && !sharedWords.some(sw => sw.includes(w)));
  const unique2 = tokens2.filter(w => !set1.has(w) && !sharedWords.some(sw => sw.includes(w)));

  // Word overlap ratio
  const totalTokens = (tokens1.length + tokens2.length) || 1;
  const wordOverlapRatio = (sharedWords.length * 2) / totalTokens;

  // Character bigrams Sørensen-Dice coefficient
  const bg1 = getBigrams(s1);
  const bg2 = getBigrams(s2);
  let bgMatch = 0;
  const bg2Copy = [...bg2];
  bg1.forEach(gram => {
    const idx = bg2Copy.indexOf(gram);
    if (idx !== -1) {
      bgMatch++;
      bg2Copy.splice(idx, 1);
    }
  });
  const totalBg = (bg1.length + bg2.length) || 1;
  const bigramRatio = (bgMatch * 2) / totalBg;

  // Composite score (0 - 100)
  let score = Math.round((wordOverlapRatio * 0.65 + bigramRatio * 0.35) * 100);
  if (s1.toLowerCase() === s2.toLowerCase()) {
    score = 100;
  }
  score = Math.min(100, Math.max(0, score));

  let category = 'low';
  let verdict = 'Different Topics — Minimal or no topical correlation between headlines';

  if (score >= 70) {
    category = 'high';
    verdict = 'High Similarity — Both headlines cover the same event or topic with strong keyword overlap';
  } else if (score >= 40) {
    category = 'medium';
    verdict = 'Moderate Similarity — Related topics with overlapping themes or differing emphasis';
  } else if (score >= 18) {
    category = 'low';
    verdict = 'Low Similarity — Slight thematic overlap or incidental shared phrasing';
  }

  return {
    score,
    category,
    verdict,
    sharedWords: [...new Set(sharedWords)],
    unique1: [...new Set(unique1)],
    unique2: [...new Set(unique2)]
  };
}

function handleCompareHeadlines() {
  const h1El = document.getElementById('first-headline-input');
  const h2El = document.getElementById('second-headline-input');
  const resEl = document.getElementById('compare-result');

  const text1 = h1El ? h1El.value.trim() : '';
  const text2 = h2El ? h2El.value.trim() : '';

  if (!resEl) return;

  if (!text1 || !text2) {
    resEl.className = 'compare-result';
    resEl.innerHTML = `
      <div class="status-message error" style="margin: 0;">
        ⚠️ Please provide both <strong>First Headline</strong> and <strong>Second Headline</strong> to perform a comparison.
      </div>
    `;
    resEl.classList.remove('hidden');
    if (!text1 && h1El) h1El.focus();
    else if (!text2 && h2El) h2El.focus();
    return;
  }

  const comparison = compareTwoHeadlines(text1, text2);
  const fillColors = {
    high: '#10b981',
    medium: '#f59e0b',
    low: '#ef4444'
  };
  const fillColor = fillColors[comparison.category] || '#3b82f6';

  const sharedHtml = comparison.sharedWords.length > 0
    ? comparison.sharedWords.map(w => `<span class="compare-chip shared">✨ ${escapeHtml(w)}</span>`).join('')
    : '<span class="compare-chip-empty">No direct keyword overlap detected</span>';

  const u1Html = comparison.unique1.length > 0
    ? comparison.unique1.map(w => `<span class="compare-chip unique-1">${escapeHtml(w)}</span>`).join('')
    : '<span class="compare-chip-empty">None</span>';

  const u2Html = comparison.unique2.length > 0
    ? comparison.unique2.map(w => `<span class="compare-chip unique-2">${escapeHtml(w)}</span>`).join('')
    : '<span class="compare-chip-empty">None</span>';

  resEl.className = 'compare-result';
  resEl.innerHTML = `
    <div class="compare-result-header">
      <div class="compare-score-badge match-${comparison.category}">
        <span>🎯 Similarity: ${comparison.score}%</span>
      </div>
      <div class="compare-verdict">${escapeHtml(comparison.verdict)}</div>
    </div>

    <div class="compare-progress-track">
      <div class="compare-progress-fill" style="width: ${comparison.score}%; background-color: ${fillColor};"></div>
    </div>

    <div class="compare-tags-section">
      <div class="compare-tags-title">Shared Terms & Overlap (${comparison.sharedWords.length})</div>
      <div class="compare-chips-list">${sharedHtml}</div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-top: 4px;">
      <div class="compare-tags-section">
        <div class="compare-tags-title">Unique to First Headline (${comparison.unique1.length})</div>
        <div class="compare-chips-list">${u1Html}</div>
      </div>
      <div class="compare-tags-section">
        <div class="compare-tags-title">Unique to Second Headline (${comparison.unique2.length})</div>
        <div class="compare-chips-list">${u2Html}</div>
      </div>
    </div>
  `;
  resEl.classList.remove('hidden');
}

function populateMainHeadlinesForComparison() {
  const h1El = document.getElementById('first-headline-input');
  const h2El = document.getElementById('second-headline-input');
  const resEl = document.getElementById('compare-result');

  let loaded = false;
  if (h1El && lastExtractedHeadlines[1]) {
    h1El.value = lastExtractedHeadlines[1];
    loaded = true;
  }
  if (h2El && lastExtractedHeadlines[2]) {
    h2El.value = lastExtractedHeadlines[2];
    loaded = true;
  }

  if (loaded) {
    if (resEl) resEl.classList.add('hidden');
    handleCompareHeadlines();
  } else {
    showStatusMessage('No extracted headlines yet. Run "Check Sources" first or enter headlines manually.', 'warning');
  }
}

function clearComparisonFields() {
  const h1El = document.getElementById('first-headline-input');
  const h2El = document.getElementById('second-headline-input');
  const resEl = document.getElementById('compare-result');
  if (h1El) h1El.value = '';
  if (h2El) h2El.value = '';
  if (resEl) {
    resEl.innerHTML = '';
    resEl.classList.add('hidden');
  }
}

// Attach event listeners when DOM is loaded
function setupListeners() {
  const checkBtn = document.getElementById('check-source-btn');
  if (checkBtn) {
    checkBtn.addEventListener('click', handleCheckSources);
  }

  const compareBtn = document.getElementById('compare-btn');
  if (compareBtn) {
    compareBtn.addEventListener('click', handleCompareHeadlines);
  }

  const s1 = document.getElementById('source-input-1');
  const s2 = document.getElementById('source-input-2');

  [s1, s2].forEach((input) => {
    if (!input) return;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleCheckSources();
      }
    });
  });

  const h1 = document.getElementById('first-headline-input');
  const h2 = document.getElementById('second-headline-input');

  [h1, h2].forEach((input) => {
    if (!input) return;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleCompareHeadlines();
      }
    });
  });
}

// Expose functions on global window
window.handleCheckSources = handleCheckSources;
window.loadSampleArticles = loadSampleArticles;
window.loadSampleUrls = loadSampleUrls;
window.clearAllSources = clearAllSources;
window.toggleInspectionLog = toggleInspectionLog;
window.handleCompareHeadlines = handleCompareHeadlines;
window.populateMainHeadlinesForComparison = populateMainHeadlinesForComparison;
window.clearComparisonFields = clearComparisonFields;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupListeners);
} else {
  setupListeners();
}
