// Lets other extensions open any extension's toolbar popup, as if its toolbar button were clicked.
// Extensions without a popup get their click action instead (action.onClicked), as with a real click.
// Request, sent to Vivaldi's UI with chrome.runtime.sendMessage("mpognobbkildjkofajifpdfhcoklimli", ...):
//   {action: "openPopup", extensionId, windowId}. Answers {ok: true} or {error}.
// The popup that is open, including the one that asked, is closed first, as a toolbar click does.
// Uses the extensions toolbar's own handler for chrome.action.openPopup (extensionSubscriber), found through
// React fibers (written against Vivaldi 8.3). If a Vivaldi update renames it, requests answer {error}.
(() => {
  const DEBUG = false; // true logs each request to the UI console (vivaldi://inspect/#apps, inspect window.html)
  const log = (...a) => { if (DEBUG) console.log("open-extension-popup:", ...a); };

  let myWindowId = null;
  chrome.windows.getCurrent().then((w) => { myWindowId = w.id; });

  // This window's extensions toolbar component. There can be a second one in the toolbar editor; skip it.
  function findToolbar() {
    const el = document.getElementById("browser");
    const key = el && Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    if (!key) return null;
    let root = el[key];
    while (root.return) root = root.return;
    const stack = [root];
    while (stack.length) {
      const f = stack.pop();
      const s = f.stateNode;
      if (typeof s?.extensionSubscriber === "function" && s._toolbarButtons && !s.props?.inEditor) return s;
      if (f.sibling && f !== root) stack.push(f.sibling);
      if (f.child) stack.push(f.child);
    }
    return null;
  }

  chrome.runtime.onMessageExternal.addListener((msg, _sender, respond) => {
    if (msg?.action !== "openPopup") return false;
    if (myWindowId === null || msg.windowId !== myWindowId) return false; // another window's request
    log("request:", msg);
    const id = msg.extensionId;
    if (typeof id !== "string") {
      respond({ error: "invalid request" });
      return false;
    }
    const toolbar = findToolbar();
    if (!toolbar) {
      console.warn("open-extension-popup: extensions toolbar not found");
      respond({ error: "extensions toolbar not found" });
      return false;
    }
    if (!toolbar.state?.extensions?.has?.(id)) {
      respond({ error: "extension has no toolbar action" });
      return false;
    }
    respond({ ok: true });
    // After the answer is on its way: opening the popup replaces the asking popup. Close it first the way a
    // toolbar click does; extensionSubscriber alone only hides it in state and leaves its webview drawn.
    setTimeout(() => {
      if (toolbar.state.popupVisible) toolbar.popupWantsToClose();
      toolbar.extensionSubscriber(id);
    });
    return false;
  });
})();
