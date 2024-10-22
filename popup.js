document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search');
  const extensionList = document.getElementById('extension-list');
  let currentIndex = 0;
  let vimMode = true;
  let searchQuery = '';
  let allExtensions = [];
  let selectedIds = [];
  const marginTop = 36;

  function fetchExtensions() {
    chrome.management.getAll((extensions) => {
      allExtensions = extensions;
      displayExtensions();
    });
  }

  function displayExtensions() {
    let extensions = allExtensions
      .sort((a, b) => {
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

      const span = document.createElement('span');
      span.textContent = extension.name;
      span.title = extension.name;
      span.classList.add('extension-name');

      const state = extension.enabled ? 'enabled' : 'disabled';
      listItem.classList.add(state);

      const buttonContainer = document.createElement('div');
      buttonContainer.classList.add('buttons');

      const check = document.createElement('span');
      check.innerHTML = '<img src="icons/check.svg" class="check d-none"/>';

      const toggleButton = document.createElement('button');
      toggleButton.innerHTML = `<img src="icons/toggle.svg" class=${state}/>`;
      toggleButton.title = state === 'enabled' ? 'Disable' : 'Enable';
      toggleButton.addEventListener('click', () => {
        toggleExtension(extension.id);
      });

      const uninstallButton = document.createElement('button');
      uninstallButton.innerHTML = '<img src="icons/uninstall.svg" class="uninstall"/>';
      uninstallButton.title = 'Uninstall';
      uninstallButton.addEventListener('click', () => {
        uninstallExtension(extension.id);
      });

      const settingsButton = document.createElement('button');
      settingsButton.innerHTML = '<img src="icons/settings.svg" class="settings"/>';
      settingsButton.title = 'Settings';
      settingsButton.addEventListener('click', () => {
        openExtensionSettings(extension.id);
      });

      listItem.appendChild(span);
      listItem.appendChild(buttonContainer);

      buttonContainer.appendChild(check);
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
    chrome.management.setEnabled(extensionId, false, () => {
      chrome.management.setEnabled(extensionId, true, () => {
        fetchExtensions();
      });
    });
  }

  function uninstallExtension(extensionId) {
    chrome.management.uninstall(extensionId, () => {
      fetchExtensions();
    });
  }

  function openExtension(extensionId) {
    chrome.tabs.create({ url: `chrome://extensions/?id=${extensionId}` });
  }

  function openExtensionSettings(extensionId) {
    chrome.management.get(extensionId, (extensionInfo) => {
      if (extensionInfo && extensionInfo.optionsUrl) {
        chrome.tabs.create({ url: extensionInfo.optionsUrl });
      }
    });
  }

  function fuzzyMatch(extension) {
    return searchQuery.trim() == '' || extension.name.toLowerCase().includes(searchQuery.toLowerCase());
  }

  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    displayExtensions();
  });

  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      searchInput.value = '';
      searchInput.blur();
      searchQuery = '';
      displayExtensions();
      vimMode = true;
    } else if (event.key === 'Enter') {
      searchInput.blur();
      const items = extensionList.getElementsByTagName('li');
      const firstItem = extensionList.querySelector('li:not(.hidden)');
      if (firstItem) {
        if (extensionList.querySelector('.active').matches('.hidden')) {
          currentIndex = Array.from(items).indexOf(firstItem);
        }

        updateActiveItem(items);
      }
      event.stopPropagation();
      vimMode = true;
    }
  });

  document.addEventListener('keydown', (event) => {
    if (vimMode) {
      const items = extensionList.getElementsByTagName('li');
      const activeItem = extensionList.querySelector('.active');
      if (event.code === 'KeyJ') {
        if (event.altKey && activeItem) {
          // Toggle selection and move to next item
          activeItem.classList.toggle('selected');
          if (activeItem.classList.contains('selected')) {
            selectedIds.push(activeItem.getAttribute('data-id'));
          } else {
            selectedIds = selectedIds.filter((id) => id !== activeItem.getAttribute('data-id'));
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
      } else if (event.code === 'KeyK') {
        if (event.altKey && activeItem) {
          // Toggle selection
          activeItem.classList.toggle('selected');
          if (activeItem.classList.contains('selected')) {
            selectedIds.push(activeItem.getAttribute('data-id'));
          } else {
            selectedIds = selectedIds.filter((id) => id !== activeItem.getAttribute('data-id'));
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
      } else if (event.code == "Tab" && activeItem) {
        if (event.shiftKey) {
          activeItem.classList.remove('selected');
          selectedIds = selectedIds.filter((id) => id !== activeItem.getAttribute('data-id'));
        } else {
          event.preventDefault();
          activeItem.classList.toggle('selected');
          if (activeItem.classList.contains('selected')) {
            selectedIds.push(activeItem.getAttribute('data-id'));
          } else {
            selectedIds = selectedIds.filter((id) => id !== activeItem.getAttribute('data-id'));
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
        const lastSelected = [...extensionList.querySelectorAll('.selected')].at(-1);
        if (lastSelected) {
          lastSelected.classList.remove('selected');
          selectedIds = selectedIds.filter((id) => id !== lastSelected.getAttribute('data-id'));
        }
      } else if (event.key === '/') {
        event.preventDefault();
        searchInput.focus();
        vimMode = false;
      } else if (['Enter', 'o'].includes(event.key) && !event.altKey && !event.ctrlKey && activeItem) {
        openExtensionSettings(activeItem.getAttribute('data-id'));
      } else if (event.code == 'KeyS' && event.ctrlKey && activeItem) {
        openExtension(activeItem.getAttribute('data-id'));
      } else if (event.code == 'KeyX' && event.ctrlKey && activeItem) {
        uninstallExtension(activeItem.getAttribute('data-id'));
      } else if (event.ctrlKey && ['KeyE', 'KeyD', 'KeyR'].includes(event.code)) {
        let extensions = [...extensionList.querySelectorAll('.selected')];
        if (extensions.length == 0) {
          extensions = [activeItem];
        }
        let func = event.code == 'KeyE' ? enableExtension : event.code == 'KeyD' ? disableExtension : reloadExtension;
        for (let i = 0; i < extensions.length; i++) {
          func(extensions[i].getAttribute('data-id'));
        }
      } else if (event.code == 'KeyY' && event.ctrlKey) {
        navigator.clipboard.writeText(activeItem.getAttribute('data-id'));
        activeItem.querySelector('.check').classList.remove('d-none');
        setTimeout(() => {
          activeItem.querySelector('.check').classList.add('d-none');
        }, 1000);
      }
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
