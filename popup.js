/* global chrome */

const searchInput = document.getElementById('search');
const extensionList = document.getElementById('extension-list');
const marginTop = 36;
const cacheKey = 'extensionCache';
const settingsKey = 'settingsCache';

let currentIndex = 0;
let searchQuery = '';
let rows = [];
let selectedIds = [];
let vimEnabled = false;
let vimMode = false;
let externalUrl = '';
const rowsById = new Map();

// A single <li> is built once and cloned per row, instead of parsing five
// innerHTML fragments for every extension.
const rowTemplate = document.createElement('li');
{
  const icon = document.createElement('img');
  icon.className = 'extension-icon';
  icon.width = 16;
  icon.height = 16;
  const name = document.createElement('a');
  name.className = 'extension-name';
  const actions = document.createElement('div');
  actions.className = 'row-actions';
  rowTemplate.append(icon, name, actions);
}

// One shared button group, moved into whichever row is hovered or active,
// rather than five hidden <img> per row.
const buttons = document.createElement('div');
buttons.className = 'buttons';

function createButton(name, title, handler) {
  const button = document.createElement('button');
  const img = document.createElement('img');
  img.src = `icons/${name}.svg`;
  img.className = name;
  img.width = 18;
  img.height = 18;
  button.append(img);
  button.title = title;
  button.addEventListener('click', () => {
    const id = buttons.parentElement?.parentElement?.dataset.id;
    if (id)
      handler(id);
  });
  return { button, img };
}

const toggle = createButton('toggle', 'Disable', toggleExtension);
const uninstall = createButton('uninstall', 'Uninstall', uninstallExtension);
const settings = createButton('settings', 'Settings', openExtensionSettings);
buttons.append(toggle.button, uninstall.button, settings.button);

function moveButtonsTo(listItem) {
  const actions = listItem?.querySelector('.row-actions');
  if (!actions || buttons.parentElement === actions)
    return;
  const row = rowsById.get(listItem.dataset.id);
  const state = row?.enabled ? 'enabled' : 'disabled';
  toggle.img.className = state;
  toggle.button.title = state === 'enabled' ? 'Disable' : 'Enable';
  actions.append(buttons);
}

// The check mark and reload spinner are created on demand and removed again,
// so no row carries them at rest. This also lets the reload animation replay:
// the old markup only animated once per popup session.
function flashIndicator(listItem, kind, duration) {
  const actions = listItem?.querySelector('.row-actions');
  if (!actions)
    return;
  actions.querySelector(`.${kind}`)?.remove();
  const span = document.createElement('span');
  span.className = kind;
  const img = document.createElement('img');
  img.src = `icons/${kind}.svg`;
  span.append(img);
  actions.append(span);
  setTimeout(() => span.remove(), duration);
}

// chrome.management lists icons in manifest order, not by size, so the first
// entry is often a 128px bitmap for a 16px slot.
function iconUrl(extension) {
  if (!extension.icons?.length)
    return '';
  return extension.icons.reduce((best, icon) =>
    Math.abs(icon.size - 16) < Math.abs(best.size - 16) ? icon : best).url;
}

// Only the fields the popup actually renders, so the cached copy stays small
// and comparing two lists is a single stringify.
function toRow(extension) {
  return {
    id: extension.id,
    name: extension.name,
    enabled: extension.enabled,
    optionsUrl: extension.optionsUrl || '',
    icon: iconUrl(extension),
  };
}

function sortRows(list) {
  return list.sort((a, b) => {
    if (a.enabled === b.enabled)
      return a.name.localeCompare(b.name);
    return a.enabled ? -1 : 1;
  });
}

function render() {
  rowsById.clear();
  const fragment = document.createDocumentFragment();

  rows.forEach((row) => {
    rowsById.set(row.id, row);

    const listItem = rowTemplate.cloneNode(true);
    listItem.dataset.id = row.id;
    listItem.dataset.name = row.name.toLowerCase();
    listItem.classList.add(row.enabled ? 'enabled' : 'disabled');
    if (selectedIds.includes(row.id))
      listItem.classList.add('selected');
    if (row.optionsUrl)
      listItem.classList.add('has-options');

    const icon = listItem.firstElementChild;
    if (row.icon)
      icon.src = row.icon;
    else
      icon.classList.add('no-icon');

    const name = icon.nextElementSibling;
    name.textContent = row.name;
    name.title = row.name;

    fragment.append(listItem);
  });

  extensionList.replaceChildren(fragment);
  applyFilter();
  updateActiveItem(extensionList.children);
}

// Filtering only ever toggles a class, so it no longer rebuilds the list.
function applyFilter() {
  const query = searchQuery.trim().toLowerCase();
  for (const listItem of extensionList.children) {
    listItem.classList.toggle(
      'hidden',
      query !== '' && !listItem.dataset.name.includes(query),
    );
  }
}

// Any chrome.* call costs ~50ms on a cold popup, because the first IPC from a
// freshly created popup document is slow regardless of which API it is.
// localStorage is renderer-local and synchronous, so the list can be on screen
// before the browser process has answered anything.
function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey));
    return Array.isArray(cached) ? cached : [];
  } catch {
    return [];
  }
}

function writeCache(list) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify(list));
  } catch {
    // quota or private mode; the popup still works, just without a fast path
  }
}

// chrome.storage.local stays the source of truth — settings.js writes only
// there. This is a read-through mirror so the popup can apply the settings at
// script start instead of ~50ms in.
function readSettingsCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(settingsKey));
    return cached && typeof cached === 'object' ? cached : {};
  } catch {
    return {};
  }
}

function applyEditingMode(enabled) {
  vimEnabled = enabled;
  vimMode = enabled;
  if (enabled)
    searchInput.blur();
  else
    searchInput.focus();
}

// Re-renders only when something actually changed, so the usual case is an
// invisible no-op rather than a flash.
function reconcile(fresh) {
  const changed = JSON.stringify(fresh) !== JSON.stringify(rows);
  if (changed) {
    rows = fresh;
    render();
  }
  writeCache(fresh);
  return changed;
}

async function refresh() {
  const fresh = sortRows((await chrome.management.getAll()).map(toRow));
  const known = new Set(fresh.map(row => row.id));
  selectedIds = selectedIds.filter(id => known.has(id));
  reconcile(fresh);
}

// One re-fetch and one re-render for the whole batch, not one per extension.
async function applyEnabled(ids, enabled) {
  await Promise.all(
    ids.map(id =>
      chrome.management.setEnabled(id, enabled).catch(e => console.error(e))),
  );
  await refresh();
}

async function reloadExtensions(ids) {
  await Promise.all(
    ids.map(async (id) => {
      try {
        await chrome.management.setEnabled(id, false);
        await chrome.management.setEnabled(id, true);
      } catch (e) {
        console.error(e);
      }
    }),
  );
  await refresh();
}

function toggleExtension(id) {
  // The current state is already known; no need to ask the browser for it.
  const row = rowsById.get(id);
  if (row)
    applyEnabled([id], !row.enabled);
}

async function uninstallExtension(id) {
  try {
    await chrome.management.uninstall(id);
  } catch {
    return; // user dismissed the confirmation dialog
  }
  await refresh();
}

function openExtensionSettings(id) {
  chrome.tabs.create({ url: `chrome://extensions/?id=${id}` });
}

function openExtensionOptions(id) {
  const row = rowsById.get(id);
  if (row?.optionsUrl)
    chrome.tabs.create({ url: row.optionsUrl });
}

function openExternal(id) {
  const row = rowsById.get(id);
  if (!row?.enabled || !externalUrl)
    return;
  const url = externalUrl.replace('%s', encodeURIComponent(row.name));
  chrome.runtime.sendNativeMessage(
    'com.twio142.extension_manager',
    { url },
    () => {
      if (chrome.runtime.lastError)
        console.error(chrome.runtime.lastError);
    },
  );
}

function nextVisible(items, from, step) {
  if (items.length === 0)
    return -1;
  let index = from;
  for (let tries = 0; tries < items.length; tries++) {
    index += step;
    if (index >= items.length)
      index = 0;
    else if (index < 0)
      index = items.length - 1;
    if (!items[index].matches('.hidden'))
      return index;
  }
  return -1;
}

function updateActiveItem(items) {
  for (let i = 0; i < items.length; i++) {
    items[i].classList.remove('active');
  }
  if (currentIndex >= 0 && currentIndex < items.length) {
    const active = items[currentIndex];
    active.classList.add('active');
    moveButtonsTo(active);
    active.scrollIntoView({ block: 'nearest' });
    const top = active.getBoundingClientRect().top;
    const offset = top < marginTop ? top - marginTop : 0;
    window.scrollBy(0, offset);
  }
}

function toggleSelection(listItem) {
  listItem.classList.toggle('selected');
  if (listItem.classList.contains('selected')) {
    selectedIds.push(listItem.dataset.id);
  } else {
    selectedIds = selectedIds.filter(id => id !== listItem.dataset.id);
  }
}

extensionList.addEventListener('click', (event) => {
  const link = event.target.closest('a.extension-name');
  if (link)
    openExternal(link.parentElement.dataset.id);
});

extensionList.addEventListener('mouseover', (event) => {
  const listItem = event.target.closest('li');
  if (listItem)
    moveButtonsTo(listItem);
});

extensionList.addEventListener('mouseleave', () => {
  moveButtonsTo(extensionList.querySelector('.active'));
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  applyFilter();
  const items = extensionList.children;
  const firstItem = extensionList.querySelector('li:not(.hidden)');
  if (firstItem) {
    if (extensionList.querySelector('.active.hidden'))
      currentIndex = [...items].indexOf(firstItem);
    updateActiveItem(items);
  }
});

document.addEventListener('keydown', (event) => {
  const items = extensionList.children;
  const activeItem = extensionList.querySelector('.active');
  if (
    ((vimMode || event.ctrlKey) && ['KeyJ', 'KeyN'].includes(event.code))
    || event.key === 'ArrowDown'
  ) {
    if (event.altKey && activeItem) {
      // Toggle selection and move to next item
      event.preventDefault();
      toggleSelection(activeItem);
    }
    const next = nextVisible(items, currentIndex, 1);
    if (next >= 0) {
      currentIndex = next;
      updateActiveItem(items);
    }
  } else if (
    ((vimMode || event.ctrlKey) && ['KeyK', 'KeyP'].includes(event.code))
    || event.key === 'ArrowUp'
  ) {
    if (event.altKey && activeItem) {
      // Toggle selection
      event.preventDefault();
      toggleSelection(activeItem);
    } else {
      const previous = nextVisible(items, currentIndex, -1);
      if (previous >= 0) {
        currentIndex = previous;
        updateActiveItem(items);
      }
    }
  } else if (event.code === 'Tab' && activeItem) {
    event.preventDefault();
    if (event.shiftKey) {
      activeItem.classList.remove('selected');
      selectedIds = selectedIds.filter(id => id !== activeItem.dataset.id);
    } else {
      toggleSelection(activeItem);
      const next = nextVisible(items, currentIndex, 1);
      if (next >= 0) {
        currentIndex = next;
        updateActiveItem(items);
      }
    }
  } else if (event.code === 'KeyH' && event.altKey) {
    // Unselect last selected
    event.preventDefault();
    const lastSelected = [...extensionList.querySelectorAll('.selected')].at(-1);
    if (lastSelected) {
      lastSelected.classList.remove('selected');
      selectedIds = selectedIds.filter(id => id !== lastSelected.dataset.id);
    }
  } else if (vimMode && event.key === '/') {
    event.preventDefault();
    searchInput.focus();
    vimMode = false;
  } else if (event.key === 'Enter') {
    // Activate using external URL
    event.preventDefault();
    event.stopPropagation();
    if (activeItem)
      openExternal(activeItem.dataset.id);
  } else if (
    activeItem?.matches('.enabled.has-options')
    && event.code === 'KeyO'
    && (vimMode || event.ctrlKey)
  ) {
    // Open options
    event.preventDefault();
    openExtensionOptions(activeItem.dataset.id);
  } else if (event.code === 'KeyS' && event.ctrlKey && activeItem) {
    // Open settings
    event.preventDefault();
    openExtensionSettings(activeItem.dataset.id);
  } else if (event.code === 'KeyX' && event.ctrlKey && activeItem) {
    // Uninstall
    event.preventDefault();
    uninstallExtension(activeItem.dataset.id);
  } else if (event.ctrlKey && ['KeyE', 'KeyD', 'KeyR'].includes(event.code)) {
    // Enable, Disable, Reload
    event.preventDefault();
    let selected = [...extensionList.querySelectorAll('.selected')];
    if (selected.length === 0 && activeItem)
      selected = [activeItem];
    if (selected.length === 0)
      return;
    const ids = selected.map(listItem => listItem.dataset.id);
    const done
      = event.code === 'KeyR'
        ? reloadExtensions(ids)
        : applyEnabled(ids, event.code === 'KeyE');
    // Flash after the re-render, otherwise the indicators are wiped by it.
    done.then(() =>
      ids.forEach(id =>
        flashIndicator(
          extensionList.querySelector(`li[data-id="${id}"]`),
          'reload',
          1500,
        )));
  } else if (event.code === 'KeyY' && event.ctrlKey && activeItem) {
    // Copy extension ID
    event.preventDefault();
    navigator.clipboard.writeText(activeItem.dataset.id);
    flashIndicator(activeItem, 'check', 800);
  }
});

// Attached unconditionally, since the editing mode may still be corrected by
// the authoritative read below.
searchInput.addEventListener('keydown', (event) => {
  if (!vimEnabled)
    return;
  if (event.key === 'Escape') {
    event.preventDefault();
    searchInput.value = '';
    searchInput.blur();
    searchQuery = '';
    applyFilter();
    vimMode = true;
  } else if (event.key === 'Enter' && !event.ctrlKey) {
    searchInput.blur();
    event.stopPropagation();
    vimMode = true;
  }
});

// First paint and first focus, synchronously, before any chrome.* call.
const cachedSettings = readSettingsCache();
externalUrl = cachedSettings.externalUrl || '';
applyEditingMode(!!cachedSettings.initWithVim);

rows = readCache();
if (rows.length)
  render();

(async () => {
  const extensionsPromise = chrome.management.getAll();
  const settingsPromise = chrome.storage.local.get([
    'initWithVim',
    'externalUrl',
  ]);

  const stored = await settingsPromise;
  externalUrl = stored.externalUrl || '';

  // Only override the mode the cache already applied if it was actually wrong,
  // and only while the user hasn't started typing.
  if (!!stored.initWithVim !== vimEnabled && searchInput.value === '')
    applyEditingMode(!!stored.initWithVim);

  localStorage.setItem(
    settingsKey,
    JSON.stringify({
      initWithVim: !!stored.initWithVim,
      externalUrl: stored.externalUrl || '',
    }),
  );

  reconcile(sortRows((await extensionsPromise).map(toRow)));
})();
