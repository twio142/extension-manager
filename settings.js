const button = document.querySelector("button");
button.addEventListener("click", () => {
  const url = document.querySelector("#external-url").value;
  try {
    new URL(url);
    if (!url.includes("%s")) throw new Error("Missing %s");
  } catch (e) {
    alert(e.message || "Invalid URL");
    return;
  }
  chrome.storage.local.set({ externalUrl: url }, () => {
    button.textContent = "Saved!";
    setTimeout(() => {
      button.textContent = "Save";
    }, 1000);
  });
});
chrome.storage.local.get("externalUrl", (data) => {
  document.querySelector("#external-url").value = data.externalUrl || "";
});

const vimRadio = document.querySelector("#vim-mode");
const emacsRadio = document.querySelector("#emacs-mode");

vimRadio.addEventListener("change", () => {
  if (vimRadio.checked) {
    emacsRadio.checked = false;
    chrome.storage.local.set({ initWithVim: true });
  } else {
    chrome.storage.local.set({ initWithVim: false });
  }
});

emacsRadio.addEventListener("change", () => {
  if (emacsRadio.checked) {
    vimRadio.checked = false;
    chrome.storage.local.set({ initWithVim: false });
  } else {
    chrome.storage.local.set({ initWithVim: true });
  }
});

chrome.storage.local.get("initWithVim", (data) => {
  if (data.initWithVim) {
    vimRadio.checked = true;
    emacsRadio.checked = false;
  } else {
    vimRadio.checked = false;
    emacsRadio.checked = true;
  }
});
