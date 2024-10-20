chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension Manager installed');
});

function enableExtension(extensionId) {
  chrome.management.setEnabled(extensionId, true, () => {
    console.log(`Enabled extension: ${extensionId}`);
  });
}

function disableExtension(extensionId) {
  chrome.management.setEnabled(extensionId, false, () => {
    console.log(`Disabled extension: ${extensionId}`);
  });
}

function uninstallExtension(extensionId) {
  chrome.management.uninstall(extensionId, () => {
    console.log(`Uninstalled extension: ${extensionId}`);
  });
}

function openExtensionSettings(extensionId) {
  chrome.management.get(extensionId, (extensionInfo) => {
    if (extensionInfo && extensionInfo.optionsUrl) {
      chrome.tabs.create({ url: extensionInfo.optionsUrl });
    } else {
      console.log(`No settings page for extension: ${extensionId}`);
    }
  });
}
