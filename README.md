# Extension Manager

A Chrome extension that manages all installed extensions.

## Installation

> [!NOTE]
> The provided installation script supports macOS and Linux only.

1. **Download** the [latest release](https://github.com/twio142/extension_manager/releases/latest) and unpack it.
2. **Install extension:**
   - Go to your browser's extensions page (e.g., `chrome://extensions`).
   - Enable "Developer mode", click "Load unpacked", and select the unpacked directory.
3. **Run installer:**
   - In your terminal, `cd` into the unpacked directory.
   - Run `./install.sh` and paste the Extension ID from the extensions page when prompted.
4. **Restart** your browser.

## Features

- [x] Hotkeys for each action
    - `Enter`: activate the extension (using an external URL of your choice)
    - `ctrl-e`: enable the extension
    - `ctrl-d`: disable the extension
    - `ctrl-r`: reload the extension
    - `ctrl-o`: open the options page (if available)
    - `ctrl-s`: open the extension in `chrome://extensions`
    - `ctrl-y`: copy the extension id
    - `tab`: select multiple extensions
    - `ctrl-j` / `ctrl-n`: move down
    - `ctrl-k` / `ctrl-p`: move up
- [x] Select multiple extensions and perform actions on them with hotkeys
- [x] Settings
    - External URL to activate an extension
- [x] Dark theme
- [x] Allow user to set the initial editing mode: vim / emacs

### External URL

You can set an external URL to activate an extension, as if you clicked on its icon in the toolbar.

The URL should contain `%s` as a placeholder for the extension's name.

Feel free to utilize any external tool that works for you.
