let handler = null;

export function setToastHandler(fn) {
  handler = typeof fn === 'function' ? fn : null;
}

export function showToast({ type = 'info', title = '', message = '' } = {}) {
  if (handler) {
    handler({ type, title, message });
    return true;
  }
  return false;
}
