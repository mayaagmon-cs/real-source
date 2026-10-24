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

    // Reset badges & status
    resetBadges();
    hideStatus();

    if (!rawInput) {
      showStatus('Please enter a source URL or text to check.', 'error');
      showErrorBadges();
      sourceInput.focus();
      return;
    }

    // Set loading indicator
    setLoadingState(true);

    try {
      let isFound = false;

      // 1. Check if the entered text directly contains the target text
      if (rawInput.includes(TARGET_TEXT)) {
        isFound = true;
      } else {
        // 2. Fetch from the URL if it looks like a web address
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
      showStatus(`Could not inspect source: ${err.message || 'Verification failed.'}`, 'error');
    }
  };

  // Helper to fetch remote webpage content via CORS proxy
  async function fetchPageContent(inputUrl) {
    let url = inputUrl;
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    // Validate URL structure
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    // Use CORS proxy to bypass browser cross-origin restrictions
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Failed to load URL (status ${response.status})`);
      }

      const text = await response.text();
      return text;
    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        throw new Error('Connection timed out while loading the page.');
      }
      throw new Error('Network error or source page blocked cross-origin access.');
    }
  }

  function setLoadingState(isLoading) {
    if (isLoading) {
      checkSourceBtn.disabled = true;
      checkSourceBtn.textContent = 'Checking...';
      inputBadge.className = 'result-badge badge-loading';
      inputBadge.innerHTML = '<div class="spinner"></div>';
      inputBadge.classList.remove('hidden');
      buttonBadge.classList.add('hidden');
      showStatus('Fetching and analyzing source...', 'info');
    } else {
      checkSourceBtn.disabled = false;
      checkSourceBtn.textContent = 'Check source';
    }
  }

  function showSuccessBadge() {
    // Green V mark next to the text box
    inputBadge.className = 'result-badge badge-success';
    inputBadge.innerHTML = '&#10004;'; // Checkmark ✔
    inputBadge.classList.remove('hidden');

    // Hide error mark next to button
    buttonBadge.classList.add('hidden');
  }

  function showErrorBadges() {
    // Red X mark next to text box
    inputBadge.className = 'result-badge badge-error';
    inputBadge.innerHTML = '&#10006;'; // Heavy multiplication X ✖
    inputBadge.classList.remove('hidden');

    // Red X mark next to the button
    buttonBadge.className = 'result-badge badge-error';
    buttonBadge.innerHTML = '&#10006;'; // Heavy multiplication X ✖
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

  // Trigger check on Enter key
  sourceInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      handleCheckSource();
    }
  });

  // Clear badges when user edits the text
  sourceInput.addEventListener('input', () => {
    resetBadges();
    hideStatus();
  });
});
