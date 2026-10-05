/**
 * Diálogos modales y avisos flotantes.
 * Sin dependencias: se crean y destruyen bajo demanda.
 */

function buildBackdrop() {
  const bd = document.createElement('div');
  bd.className = 'dialog-backdrop';
  return bd;
}

function buildDialog({ title, body, confirmLabel, cancelLabel, danger }) {
  const dlg = document.createElement('div');
  dlg.className = 'dialog';
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('aria-modal', 'true');
  dlg.setAttribute('aria-label', title);

  const h = document.createElement('h2');
  h.className = 'dialog__title';
  h.textContent = title;

  const b = document.createElement('div');
  b.className = 'dialog__body';
  if (typeof body === 'string') b.textContent = body;
  else if (body) b.append(body);

  const actions = document.createElement('div');
  actions.className = 'dialog__actions';

  dlg.append(h, b, actions);
  return { dlg, actions };
}

function closeButton(actions, label, { primary, danger } = {}) {
  const btn = document.createElement('button');
  btn.className = 'btn';
  if (primary) btn.classList.add('btn--primary');
  if (danger) btn.classList.add('btn--danger');
  btn.textContent = label;
  actions.append(btn);
  return btn;
}

function trap(container) {
  const focusables = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  function onKey(ev) {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      container.dispatchEvent(new CustomEvent('dialog:cancel'));
      return;
    }
    if (ev.key !== 'Tab') return;
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  }
  container.addEventListener('keydown', onKey);
  return () => container.removeEventListener('keydown', onKey);
}

function open({ title, body, confirmLabel, cancelLabel, danger }) {
  return new Promise((resolve) => {
    const bd = buildBackdrop();
    const { dlg, actions } = buildDialog({ title, body, danger });
    bd.append(dlg);

    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      release();
      bd.remove();
      document.removeEventListener('keydown', onDocKey, true);
      resolve(value);
    };

    const cancelBtn = cancelLabel
      ? closeButton(actions, cancelLabel)
      : null;
    const okBtn = closeButton(actions, confirmLabel ?? 'Aceptar', {
      primary: !danger,
      danger,
    });

    if (cancelBtn) cancelBtn.addEventListener('click', () => done(false));
    okBtn.addEventListener('click', () => done(true));
    bd.addEventListener('click', (ev) => {
      if (ev.target === bd) done(false);
    });
    bd.addEventListener('dialog:cancel', () => done(false));

    function onDocKey(ev) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        done(false);
      }
    }
    document.addEventListener('keydown', onDocKey, true);

    document.body.append(bd);
    const release = trap(dlg);
    (cancelBtn ?? okBtn).focus();
  });
}

/** Confirmación. Devuelve true si el usuario acepta. */
export function confirmDialog(opts) {
  return open({
    confirmLabel: 'Aceptar',
    cancelLabel: 'Cancelar',
    ...opts,
  });
}

/** Aviso simple. */
export function alertDialog(opts) {
  return open({ ...opts, cancelLabel: null }).then(() => undefined);
}

/** Aviso flotante breve. */
export function toast(message, type = 'info', ms = 2600) {
  const t = document.createElement('div');
  t.className = `toast${type === 'error' ? ' toast--error' : ''}`;
  t.textContent = message;
  t.setAttribute('role', 'status');
  document.body.append(t);
  setTimeout(() => t.remove(), ms);
}
