// Settings window script
import { getCurrentWindow } from '@tauri-apps/api/window';

const warningInput = document.getElementById('warning');
const dangerInput = document.getElementById('danger');

// Load saved values
const saved = localStorage.getItem('canary-thresholds');
if (saved) {
  try {
    const parsed = JSON.parse(saved);
    warningInput.value = parsed.warning || 70;
    dangerInput.value = parsed.danger || 85;
  } catch (e) {
    console.error('Failed to parse thresholds:', e);
  }
}

async function closeWindow() {
  try {
    const win = getCurrentWindow();
    await win.close();
  } catch (e) {
    console.error('Failed to close window:', e);
  }
}

document.getElementById('save').addEventListener('click', async () => {
  const warning = parseInt(warningInput.value, 10);
  const danger = parseInt(dangerInput.value, 10);

  if (warning >= danger) {
    alert('Warning must be less than danger threshold');
    return;
  }

  localStorage.setItem('canary-thresholds', JSON.stringify({ warning, danger }));
  await closeWindow();
});

document.getElementById('cancel').addEventListener('click', async () => {
  await closeWindow();
});
