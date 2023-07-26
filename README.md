# drive2gource

drive2goruce creates a [gource](https://gource.io) compatible log from the history of a Google Drive folder.

## Limitations

Google Drive's history data is complex. The code here is sufficient to handle the data we threw at it, but there are edge cases and activity types we don't handle; you may need to make some changes to get it to work on your folders. If you do, we'd appreciate if you send a pull request!

## Usage

The code here is split between Google Apps Script to get the raw activity data and a local Node.js script to process it into Goruce format; this split allows access to the Google API without dealing with OAuth while also allowing fast local iteration on the tricky conversion code.

1. Make sure you have Node.js and Gource installed. The latter is available as `gource` from Homebrew and most Linux package managers; Windows builds of Gource are also available, but this script hasn't been tested there.
2. Find the ID of the Google Drive folder you want to visualize. This will look something like `1RmiS97L0x0k_CQRbK8__Vuqt4X7ijWr7`; it can be found by navigating to the folder in the Google Drive web UI and looking at the URL.
3. [Create a Google Apps Script project](https://script.google.com/home) and paste in the contents of `get-history.js`, substituting in the folder ID from the previous step at the top.
4. In "Services" on the left, add "Drive Activity API" and "Peopleapi" (the latter is needed to get human-readable names for editors), keeping the default options.
5. Click "Run" at the top.
   - If this is the first time, click through the permission prompt. (The script requires permission to read from Google Drive and Google Drive activity for obvious reason; write to Google Drive so we can store the output somewhere, and "access your contacts" to get the names of other editors.)
6. When it's done, it'll save a `.ndjson` file to your My Drive folder, and print the download link; download it.
7. Run `node history-to-gource.mjs RootFolderId path/to/log.ndjson "Your Name" > gource.log`.
   - The last parameter (your name) is only required if you appear in the activity log; Google Apps Script makes it easy enough to get the names of other editors but surprisingly difficult to get your own, so we ask for it manually.
8. Run `gource gource.log` (plus whatever other Gource parameters you'd like).
   - See [Gource's docs](https://github.com/acaudwell/Gource) for a full list of parameters. You'll probably want to set `--seconds-per-day` to something less than the default of 10, and `--max-file-lag` (which limits how long, in seconds, Gource can delay showing an event to make the animation look better) to something close to your `--seconds-per-day` to prevent the animation from getting too far out of sync. `--high-dpi` (Gource v0.53+) is well worth setting if you have a monitor that supports it.
   - To generate a video (as opposed to viewing the visualization directly in Gource), see [Gource's docs](https://github.com/acaudwell/Gource/wiki/Videos#ffmpeg-using-x264-codec).

## Contributing

Thank you for considering contributing to an Open Source project of the US
Government! For more information about our contribution guidelines, see
[CONTRIBUTING.md](CONTRIBUTING.md)

## Security

For more information about our Security, Vulnerability, and Responsible
Disclosure Policies, see [SECURITY.md](SECURITY.md).

## Authors and Maintainers

A full list of contributors can be found on [https://github.cms.gov/dsacms/drive2gource/graphs/contributors](https://github.cms.gov/dsacms/drive2gource/graphs/contributors).

## Public domain

This project is licensed within in the public domain within the United States,
and copyright and related rights in the work worldwide are waived through the
[CC0 1.0 Universal public domain
dedication](https://creativecommons.org/publicdomain/zero/1.0/).

All contributions to this project will be released under the CC0 dedication. By
submitting a pull request or issue, you are agreeing to comply with this waiver
of copyright interest.
