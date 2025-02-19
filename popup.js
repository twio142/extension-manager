/* global chrome */

document.addEventListener('DOMContentLoaded', async () => {
  const searchInput = document.getElementById('search');
  const extensionList = document.getElementById('extension-list');
  let currentIndex = 0;
  const { initWithVim } = await chrome.storage.local.get('initWithVim');
  let vimMode = !!initWithVim;
  if (!vimMode)
    searchInput.focus();
  let searchQuery = '';
  let allExtensions = [];
  let selectedIds = [];
  const marginTop = 36;
  const { externalUrl } = await chrome.storage.local.get('externalUrl');

  function fetchExtensions() {
    chrome.management.getAll((extensions) => {
      allExtensions = extensions;
      displayExtensions();
    });
  }

  function displayExtensions() {
    const extensions = allExtensions.sort((a, b) => {
      if (a.enabled === b.enabled) {
        return a.name.localeCompare(b.name);
      }
      return a.enabled ? -1 : 1;
    });
    extensionList.innerHTML = '';
    extensions.forEach((extension) => {
      const listItem = document.createElement('li');
      listItem.setAttribute('data-id', extension.id);
      if (selectedIds.includes(extension.id)) {
        listItem.classList.add('selected');
      }
      const icon = document.createElement('img');
      icon.src = extension.icons ? extension.icons[0].url : 'icons/default.svg';
      icon.classList.add('extension-icon');
      listItem.appendChild(icon);

      const a = document.createElement('a');
      a.textContent = extension.name;
      a.title = extension.name;
      a.classList.add('extension-name');
      if (extension.enabled && externalUrl) {
        a.href = externalUrl.replace('%s', encodeURIComponent(extension.name));
      }

      const state = extension.enabled ? 'enabled' : 'disabled';
      listItem.classList.add(state);

      if (extension.optionsUrl) {
        listItem.classList.add('has-options');
      }

      const buttonContainer = document.createElement('div');
      buttonContainer.classList.add('buttons');

      const check = document.createElement('span');
      check.classList.add('check');
      check.innerHTML = '<img src="icons/check.svg" class="d-none"/>';
      const reload = document.createElement('span');
      reload.classList.add('reload');
      reload.innerHTML = '<img src="icons/reload.svg" class="d-none"/>';

      const toggleButton = document.createElement('button');
      toggleButton.innerHTML = `<img src="icons/toggle.svg" class=${state}/>`;
      toggleButton.title = state === 'enabled' ? 'Disable' : 'Enable';
      toggleButton.addEventListener('click', () => {
        toggleExtension(extension.id);
      });

      const uninstallButton = document.createElement('button');
      uninstallButton.innerHTML
        = '<img src="icons/uninstall.svg" class="uninstall"/>';
      uninstallButton.title = 'Uninstall';
      uninstallButton.addEventListener('click', () => {
        uninstallExtension(extension.id);
      });

      const settingsButton = document.createElement('button');
      settingsButton.innerHTML
        = '<img src="icons/settings.svg" class="settings"/>';
      settingsButton.title = 'Settings';
      settingsButton.addEventListener('click', () => {
        openExtensionSettings(extension.id);
      });

      listItem.appendChild(a);
      listItem.appendChild(buttonContainer);

      buttonContainer.appendChild(check);
      buttonContainer.appendChild(reload);
      buttonContainer.appendChild(toggleButton);
      buttonContainer.appendChild(uninstallButton);
      buttonContainer.appendChild(settingsButton);
      extensionList.appendChild(listItem);

      if (!fuzzyMatch(extension)) {
        listItem.classList.add('hidden');
      }
    });
    updateActiveItem(extensionList.getElementsByTagName('li'));
  }

  function toggleExtension(extensionId) {
    chrome.management.get(extensionId, (extensionInfo) => {
      if (extensionInfo.enabled) {
        disableExtension(extensionId);
      } else {
        enableExtension(extensionId);
      }
    });
  }

  function enableExtension(extensionId) {
    chrome.management.setEnabled(extensionId, true, () => {
      fetchExtensions();
    });
  }

  function disableExtension(extensionId) {
    chrome.management.setEnabled(extensionId, false, () => {
      fetchExtensions();
    });
  }

  function reloadExtension(extensionId) {
    chrome.management.setEnabled(extensionId, false, () =>
      chrome.management.setEnabled(extensionId, true));
  }

  function uninstallExtension(extensionId) {
    chrome.management.uninstall(extensionId, () => {
      fetchExtensions();
    });
  }

  function openExtensionSettings(extensionId) {
    chrome.tabs.create({ url: `chrome://extensions/?id=${extensionId}` });
  }

  function openExtensionOptions(extensionId) {
    chrome.management.get(extensionId, (extensionInfo) => {
      if (extensionInfo && extensionInfo.optionsUrl) {
        chrome.tabs.create({ url: extensionInfo.optionsUrl });
      }
    });
  }

  function fuzzyMatch(extension) {
    return (
      searchQuery.trim() === ''
      || extension.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    displayExtensions();
    const items = extensionList.getElementsByTagName('li');
    const firstItem = extensionList.querySelector('li:not(.hidden)');
    if (firstItem) {
      if (extensionList.querySelector('.active.hidden')) {
        currentIndex = Array.from(items).indexOf(firstItem);
      }
      updateActiveItem(items);
    }
  });

  if (initWithVim) {
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        searchInput.value = '';
        searchInput.blur();
        searchQuery = '';
        displayExtensions();
        vimMode = true;
      } else if (event.key === 'Enter' && !event.ctrlKey) {
        searchInput.blur();
        event.stopPropagation();
        vimMode = true;
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    const items = extensionList.getElementsByTagName('li');
    const activeItem = extensionList.querySelector('.active');
    if (
      ((vimMode || event.ctrlKey) && event.code === 'KeyJ')
      || event.key === 'ArrowDown'
    ) {
      if (event.altKey && activeItem) {
        // Toggle selection and move to next item
        event.preventDefault();
        activeItem.classList.toggle('selected');
        if (activeItem.classList.contains('selected')) {
          selectedIds.push(activeItem.getAttribute('data-id'));
        } else {
          selectedIds = selectedIds.filter(
            id => id !== activeItem.getAttribute('data-id'),
          );
        }
      }
      currentIndex++;
      if (currentIndex >= items.length) {
        currentIndex = 0;
      }
      while (items[currentIndex].matches('.hidden')) {
        currentIndex++;
        if (currentIndex >= items.length) {
          currentIndex = 0;
        }
      }
      updateActiveItem(items);
    } else if (
      ((vimMode || event.ctrlKey) && event.code === 'KeyK')
      || event.key === 'ArrowUp'
    ) {
      if (event.altKey && activeItem) {
        // Toggle selection
        event.preventDefault();
        activeItem.classList.toggle('selected');
        if (activeItem.classList.contains('selected')) {
          selectedIds.push(activeItem.getAttribute('data-id'));
        } else {
          selectedIds = selectedIds.filter(
            id => id !== activeItem.getAttribute('data-id'),
          );
        }
      } else {
        currentIndex--;
        if (currentIndex < 0) {
          currentIndex = items.length - 1;
        }
        while (items[currentIndex].matches('.hidden')) {
          currentIndex--;
          if (currentIndex < 0) {
            currentIndex = items.length - 1;
          }
        }
        updateActiveItem(items);
      }
    } else if (event.code === 'Tab' && activeItem) {
      event.preventDefault();
      if (event.shiftKey) {
        activeItem.classList.remove('selected');
        selectedIds = selectedIds.filter(
          id => id !== activeItem.getAttribute('data-id'),
        );
      } else {
        activeItem.classList.toggle('selected');
        if (activeItem.classList.contains('selected')) {
          selectedIds.push(activeItem.getAttribute('data-id'));
        } else {
          selectedIds = selectedIds.filter(
            id => id !== activeItem.getAttribute('data-id'),
          );
        }
        currentIndex++;
        if (currentIndex >= items.length) {
          currentIndex = 0;
        }
        while (items[currentIndex].matches('.hidden')) {
          currentIndex++;
          if (currentIndex >= items.length) {
            currentIndex = 0;
          }
        }
        updateActiveItem(items);
      }
    } else if (event.code === 'KeyH' && event.altKey) {
      // Unselect last selected
      event.preventDefault();
      const lastSelected = [...extensionList.querySelectorAll('.selected')].at(
        -1,
      );
      if (lastSelected) {
        lastSelected.classList.remove('selected');
        selectedIds = selectedIds.filter(
          id => id !== lastSelected.getAttribute('data-id'),
        );
      }
    } else if (vimMode && event.key === '/') {
      event.preventDefault();
      searchInput.focus();
      vimMode = false;
    } else if (event.key === 'Enter') {
      // Activate using external URL
      event.preventDefault();
      event.stopPropagation();
      activeItem.querySelector('a').click();
    } else if (
      activeItem?.matches('.enabled.has-options')
      && event.code === 'KeyO'
      && (vimMode || event.ctrlKey)
    ) {
      // Open options
      event.preventDefault();
      openExtensionOptions(activeItem.getAttribute('data-id'));
    } else if (event.code === 'KeyS' && event.ctrlKey && activeItem) {
      // Open settings
      event.preventDefault();
      openExtensionSettings(activeItem.getAttribute('data-id'));
    } else if (event.code === 'KeyX' && event.ctrlKey && activeItem) {
      // Uninstall
      event.preventDefault();
      uninstallExtension(activeItem.getAttribute('data-id'));
    } else if (event.ctrlKey && ['KeyE', 'KeyD', 'KeyR'].includes(event.code)) {
      // Enable, Disable, Reload
      event.preventDefault();
      let extensions = [...extensionList.querySelectorAll('.selected')];
      if (extensions.length === 0) {
        extensions = [activeItem];
      }
      const func
        = event.code === 'KeyE'
          ? enableExtension
          : event.code === 'KeyD'
            ? disableExtension
            : reloadExtension;
      for (let i = 0; i < extensions.length; i++) {
        extensions[i].querySelector('.reload img').classList.remove('d-none');
        setTimeout(() => {
          extensions[i].querySelector('.reload img').classList.add('d-none');
        }, 1500);
        func(extensions[i].getAttribute('data-id'));
      }
    } else if (event.code === 'KeyY' && event.ctrlKey) {
      // Copy extension ID
      event.preventDefault();
      navigator.clipboard.writeText(activeItem.getAttribute('data-id'));
      activeItem.querySelector('.check img').classList.remove('d-none');
      setTimeout(() => {
        activeItem.querySelector('.check img').classList.add('d-none');
      }, 800);
    }
  });

  function updateActiveItem(items) {
    for (let i = 0; i < items.length; i++) {
      items[i].classList.remove('active');
    }
    if (currentIndex >= 0 && currentIndex < items.length) {
      items[currentIndex].classList.add('active');
      items[currentIndex].scrollIntoView({ block: 'nearest' });
      const top = items[currentIndex].getBoundingClientRect().top;
      const offset = top < marginTop ? top - marginTop : 0;
      window.scrollBy(0, offset);
    }
  }

  fetchExtensions();
});
