MANIFEST ADVISORS — COMPLETE HTML WEBSITE

This archive contains the complete exported website: all 35 content pages,
114 legacy redirects, CSS, JavaScript, images, logos, local fonts, 3D assets,
and Lottie animations.

VIEW THE WEBSITE LOCALLY
1. Extract the entire ZIP.
2. Open the manifest-advisors-website folder.
3. On Mac, launch Start-Mac.command. On Windows, launch Start-Windows.bat.
   These launchers require Python 3 and open the site in your browser.

Alternatively, open a terminal in this folder and run:

    python3 serve.py

On Windows, you can also use:

    py -3 serve.py

The server prints the local address and normally opens http://127.0.0.1:8000/.
Keep the terminal open while viewing the site. Press Ctrl+C to stop it.

Use the local server rather than double-clicking index.html. The site uses
root-relative page links and JavaScript-loaded animation/search assets.
No npm installation or build step is needed.

HOST THE WEBSITE
Upload the contents of this folder to the root of any static web host.
The homepage is index.html. Keep the folder structure intact so links,
fonts, images, and animation assets continue to work. serve.py and the
Mac/Windows launchers are only needed for local viewing.

EDIT THE WEBSITE
Page content is in the HTML files. Shared styling is in the CSS files, and
interactive behavior is in the JavaScript files. assets/ contains images,
logos, fonts, 3D models, and animation data. pages.json is the Sparks search
index. manifest-data.js contains homepage carousel and testimonial data.

The contact actions link to Manifest's existing inquiry page, booking
scheduler, and Jen's LinkedIn profile. Those destinations require internet
access; the site assets are included locally.

If you host this export on a different domain, update the canonical and Open
Graph URLs in the HTML files, plus sitemap.xml and robots.txt, for that domain.
