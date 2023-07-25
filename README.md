# drive2gource

drive2goruce creates a [gource](https://gource.io) compatible log from the history of a Google Drive folder.

## Limitations

Google Drive's history data is complex. The code here is sufficient to handle the data we threw at it, but there are edge cases and activity types we don't handle; you may need to make some changes to get it to work on your folders. If you do, we'd appreciate if you send a pull request!

## Usage

The code here is split between Google Apps Script to get the raw activity data and a local Node.js script to process it into Goruce format; this split allows access to the Google API without dealing with OAuth while also allowing fast local iteration on the tricky conversion code.

0. Make sure you have Node.js and Gource installed. The latter is available as `gource` from Homebrew and most Linux package managers; Windows builds of Gource are also available, but this script hasn't been tested there.
1. Find the ID of the Google Drive folder you want to visualize. This will look something like `1RmiS97L0x0k_CQRbK8__Vuqt4X7ijWr7`; it can be found by navigating to the folder in the Google Drive web UI and looking at the URL.
2. Clone this repo locally, and substitute in the folder ID at the top of `get-history.js` and `history-to-gource.mjs`, eg `const root = "items/1RmiS97L0x0k_CQRbK8__Vuqt4X7ijWr7";`
3. [Create a Google Apps Script project](https://script.google.com/home) and paste in the contents of `get-history.js`.
4. In "Services" on the left, add "Drive Activity API" and "Peopleapi" (the latter is needed to get human-readable names for editors), keeping the default options.
5. In Google Apps Script, click `Deploy > Test deployment`. Click the gear next to `Select type`, and select `Web app`. Copy the URL that appears and navigate there. It'll take a while to load, depending on the length of history; for our folder with about 6 months of work, it takes around a minute.

   - If this is the first time, click through the Google OAuth prompt.

6. Save the resulting output as `history.ndjson` in the cloned repo.
7. Run `node history-to-gource.mjs > gource.log`.
8. Run `gource gource.log` (plus whatever other Gource parameters you'd like).
