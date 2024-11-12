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
