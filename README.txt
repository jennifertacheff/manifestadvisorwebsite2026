MANIFEST ADVISORS — COMPLETE HTML WEBSITE

This archive contains the complete exported website: all 35 content pages,
120 legacy redirects, CSS, JavaScript, images, logos, local fonts, 3D assets,
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

You can also double-click index.html: pages, navigation, and the 3D hero
shape all work from disk. Browsers block the blog search and the service
page animations on file://, so use the local server to see those.
No npm installation or build step is needed.

HOST THE WEBSITE
Upload the contents of this folder to any static web host. All links are
relative, so it works at a domain root or in a subfolder (for example
GitHub Pages at https://<user>.github.io/<repo>/). The homepage is
index.html. Keep the folder structure intact so links,
fonts, images, and animation assets continue to work. serve.py and the
Mac/Windows launchers are only needed for local viewing.

EDIT THE WEBSITE
Page content is in the HTML files. Shared styling is in the CSS files, and
interactive behavior is in the JavaScript files. assets/ contains images,
logos, fonts, and animation data. The homepage's 3D hero shape is embedded
(base64 GLB) in assets/hero.js. pages.json is the blog search
index. manifest-data.js contains homepage carousel and testimonial data.

The contact actions link to Manifest's existing inquiry page, booking
scheduler, and Jen's LinkedIn profile. Those destinations require internet
access; the site assets are included locally.

If you host this export on a different domain, update the canonical and Open
Graph URLs in the HTML files, plus sitemap.xml and robots.txt, for that domain.
They currently point to the GitHub Pages site at
https://jennifertacheff.github.io/manifestadvisorwebsite2026/.

SEO: every page carries canonical, Open Graph, Twitter card, and JSON-LD
(schema.org) tags. The social share image is assets/og-image.png; its source
is assets/og/og-image.html (render it at 1200x630 to regenerate). The favicon
set (assets/favicon.svg and the PNG sizes) comes from assets/og/favicon-preview.html.

BRAND SEARCH ("manifest advisors" / "manifest advisor")
The homepage title, description, and JSON-LD lead with "Manifest Advisors"
and list "Manifest" and "Manifest Advisor" as alternate names. Keep the name
written exactly "Manifest Advisors" in new copy and on outside profiles.

Google shows a site name and favicon only for a domain or subdomain, not a
subfolder like jennifertacheff.github.io/manifestadvisorwebsite2026/, and it
only reads robots.txt at the root of a host. Ranking first for the brand
depends on moving this site onto a domain Manifest owns:
1. Replace the inquiry form first. The contact page and footer link to
   https://www.manifestadviso.rs/contact-us, which is on Squarespace and goes
   away when the domain moves.
2. Point the domain at GitHub Pages (repo Settings > Pages > Custom domain)
   and update the DNS records at the registrar.
3. Swap the base URL everywhere, for example:
       grep -rl 'https://jennifertacheff.github.io/manifestadvisorwebsite2026/' . \
         | xargs sed -i '' 's#https://jennifertacheff.github.io/manifestadvisorwebsite2026/#https://www.manifestadviso.rs/#g'
   Then remove the site's own domain from the Organization "sameAs" list in
   index.html.
4. contact-us/, home/, speaking/, growth-strategy/, coaching/, and
   founder-coaching/ redirect the old Squarespace URLs to their new pages so
   their search history carries over. Keep them.
5. Verify the domain in Google Search Console and submit sitemap.xml.

AI ANSWER ENGINES (ChatGPT, Perplexity, Claude, Google AI Overviews)
- faq/ answers the questions people ask about Manifest in plain, quotable
  sentences. Its FAQPage JSON-LD repeats the visible answers word for word;
  edit both together so they never disagree.
- llms.txt is a plain-text summary of the firm with links to the key pages.
  Update its facts when the site's facts change.
- robots.txt allows every crawler, including AI crawlers such as GPTBot,
  OAI-SearchBot, ClaudeBot, and PerplexityBot. Keep it that way.
- Microsoft Copilot, and in part ChatGPT search, draw on Bing's index, so
  also verify the site in Bing Webmaster Tools and submit sitemap.xml there.
