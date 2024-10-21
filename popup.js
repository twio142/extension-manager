document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search');
  const extensionList = document.getElementById('extension-list');
  let currentIndex = 0;
  let vimMode = true;
  let searchQuery = '';
  let allExtensions = [];

  function fetchExtensions() {
    chrome.management.getAll((extensions) => {
      allExtensions = extensions;
      displayExtensions();
    });
  }

  function displayExtensions() {
    let extensions = allExtensions
      .filter(fuzzyMatch)
      .sort((a, b) => {
        if (a.enabled === b.enabled) {
          return a.name.localeCompare(b.name);
        }
        return a.enabled ? -1 : 1;
      });
    extensionList.innerHTML = '';
    extensions.forEach((extension, index) => {
      const listItem = document.createElement('li');
      listItem.textContent = extension.name;

      const enableButton = document.createElement('button');
      enableButton.innerHTML = '<img src="icons/enable.svg" class="enable"/>';
      enableButton.title = 'Enable';
      enableButton.addEventListener('click', () => {
        enableExtension(extension.id);
      });

      const disableButton = document.createElement('button');
      disableButton.innerHTML = '<img src="icons/disable.svg" class="disable"/>';
      disableButton.title = 'Disable';
      disableButton.addEventListener('click', () => {
        disableExtension(extension.id);
      });

      const uninstallButton = document.createElement('button');
      uninstallButton.innerHTML = '<img src="icons/uninstall.svg" class="uninstall"/>';
      uninstallButton.title = 'Uninstall';
      uninstallButton.addEventListener('click', () => {
        uninstallExtension(extension.id);
      });

      const settingsButton = document.createElement('button');
      settingsButton.innerHTML = '<img src="icons/settings.svg" class="icon-settings"/>';
      settingsButton.title = 'Settings';
      settingsButton.addEventListener('click', () => {
        openExtensionSettings(extension.id);
      });

      const enabledIndicator = document.createElement('span');
      enabledIndicator.classList.add(extension.enabled ? 'enabled' : 'disabled');
      listItem.appendChild(enabledIndicator);

      listItem.appendChild(enableButton);
      listItem.appendChild(disableButton);
      listItem.appendChild(uninstallButton);
      listItem.appendChild(settingsButton);
      extensionList.appendChild(listItem);

      if (index === currentIndex) {
        listItem.classList.add('active');
        listItem.scrollIntoView({ block: 'nearest' });
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

  function uninstallExtension(extensionId) {
    chrome.management.uninstall(extensionId, () => {
      fetchExtensions();
    });
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
      vimMode = true;
      currentIndex = 0;
      const items = extensionList.getElementsByTagName('li');
      if (items.length > 0) {
        let activeItem = items.find((item) => item.classList.contains('active'));
        if (!activeItem) {
          items[0].classList.add('active');
          activeItem = items[0];
        }
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }
  });

  document.addEventListener('keydown', (event) => {
    if (vimMode) {
      const items = extensionList.getElementsByTagName('li');
      if (event.key === 'j') {
        if (currentIndex < items.length - 1) {
          currentIndex++;
          updateActiveItem(items);
        }
      } else if (event.key === 'k') {
        if (currentIndex > 0) {
          currentIndex--;
          updateActiveItem(items);
        }
      } else if (event.key === 'Enter') {
        if (currentIndex >= 0 && currentIndex < items.length) {
          items[currentIndex].querySelector('button').click();
        }
      } else if (event.key === '/') {
        event.preventDefault();
        searchInput.focus();
        vimMode = false;
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
    }
  }

  fetchExtensions();
});
