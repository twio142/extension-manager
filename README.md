# Extension Manager

A Chrome extension that manages all installed extensions.

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
- [x] Select multiple extensions and perform actions on them with hotkeys
- [x] Settings
    - External URL to activate an extension
- [x] Dark theme

### External URL

You can set an external URL to activate an extension, as if you clicked on its icon in the toolbar.

The URL should contain `%s` as a placeholder for the extension's name.

Feel free to utilize any external tool that works for you.
