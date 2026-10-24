document.addEventListener('DOMContentLoaded', () => {
  const enterSourceBtn = document.getElementById('enter-source-btn');
  const initialView = document.getElementById('initial-view');
  const inputView = document.getElementById('input-view');
  const checkSourceBtn = document.getElementById('check-source-btn');
  const sourceInput = document.getElementById('source-input');
  const statusMessage = document.getElementById('status-message');

  // When "Enter source" is clicked, hide initial button and show input view
  enterSourceBtn.addEventListener('click', () => {
    initialView.classList.add('hidden');
    inputView.classList.remove('hidden');
    sourceInput.focus();
  });

  // Action when "Check source" button is clicked
  const handleCheckSource = () => {
    const value = sourceInput.value.trim();

    if (!value) {
      showStatus('Please enter a source before checking.', true);
      sourceInput.focus();
      return;
    }

    showStatus(`Source received: "${value}". Ready for verification logic!`, false);
  };

  checkSourceBtn.addEventListener('click', handleCheckSource);

  // Allow pressing Enter in the input field to trigger the check
  sourceInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      handleCheckSource();
    }
  });

  function showStatus(text, isError = false) {
    statusMessage.textContent = text;
    statusMessage.classList.remove('hidden');
    if (isError) {
      statusMessage.classList.add('error');
    } else {
      statusMessage.classList.remove('error');
    }
  }
});
