#!/usr/bin/env python3
"""Regenerate every SEO/AEO artifact from one place.

SITE_URL below is the single source of truth for the production domain. Running
this script rewrites, for every content page:
  <title>, meta description, canonical, Open Graph, Twitter card, JSON-LD
and regenerates sitemap.xml, robots.txt and llms.txt. Redirect stubs get a
canonical pointing at their target page. The FAQPage schema is built from the
visible FAQ HTML, so the two never disagree.

Usage (from anywhere; Python 3.8+, no dependencies):
    python3 scripts/seo_build.py          # write files
    python3 scripts/seo_build.py --check  # validate only, exit 1 on problems

After editing page copy, a title or a description, re-run it and commit the result.
"""
import datetime
import html
import json
import pathlib
import re
import subprocess
import sys

# ---------------------------------------------------------------------------
# Site-wide configuration
# ---------------------------------------------------------------------------
SITE_URL = 'https://manifestadviso.rs'  # no trailing slash, no www, no sub-path
SITE_NAME = 'Manifest Advisors'
TITLE_SUFFIX = ' | Manifest Advisors'
OG_IMAGE = '/assets/og-image.png'  # 1200x630
OG_IMAGE_ALT = 'Manifest Advisors — Your next move matters.'
LOGO = '/assets/icon-512.png'      # 512x512
PERSON_IMAGE = '/assets/manifest/jen-portrait-preview.png'
BOOKING_URL = 'https://app.acuityscheduling.com/schedule/11f21259/'

# sameAs: only profiles that already appear on the site. Do not invent URLs.
ORG_SAME_AS = [
    'https://testimonial.to/manifestadvisors/all',
    # TODO(human): add the firm's own profiles once they exist / are confirmed, e.g.
    #   LinkedIn company page (https://www.linkedin.com/company/...),
    #   Crunchbase organization page, Google Business Profile, Wikidata item.
]
PERSON_SAME_AS = [
    'https://www.linkedin.com/in/jtacheff/',
    'https://twitter.com/jenntacheff',
    # TODO(human): confirm the X/Twitter handle is still active, and add Jen's
    #   Crunchbase person page, SXSW / Techstars mentor profile and speaker pages if public.
]

KNOWS_ABOUT = ['Growth strategy', 'Go-to-market strategy', 'Fund launches', 'Fundraising',
               'Brand storytelling', 'Executive coaching', 'Innovation', 'Artificial intelligence']

ROOT = pathlib.Path(__file__).resolve().parent.parent
ORG_ID = f'{SITE_URL}/#organization'
PERSON_ID = f'{SITE_URL}/#jen-tacheff'
WEBSITE_ID = f'{SITE_URL}/#website'

# ---------------------------------------------------------------------------
# Per-page metadata. Key = path under the site root ('' is the homepage).
# title: shown before TITLE_SUFFIX (whole title must be <= 60 chars)
# description: <= 155 chars. crumb: breadcrumb label. kind: schema shape.
# ---------------------------------------------------------------------------
PAGES = {
    '': dict(kind='home', crumb='Home',
             title='Jen Tacheff’s Strategy & Growth Advisory',
             description='Manifest Advisors is a strategy and growth advisory founded by Jen Tacheff in 2019, helping leaders launch funds, scale companies, and enter new markets.'),
    'about/': dict(kind='about', crumb='About Jen Tacheff',
                   title='About Jen Tacheff, Founder',
                   description='Jennifer Tacheff founded Manifest Advisors in 2019. Growth strategist, executive coach, Techstars All-Star Mentor, and UC Berkeley Haas lecturer.'),
    'contact/': dict(kind='contact', crumb='Contact',
                     title='Contact Jen Tacheff',
                     description='Get in touch with Manifest Advisors: connect with founder Jen Tacheff on LinkedIn to talk growth strategy, fundraising, storytelling, and leadership.'),
    'faq/': dict(kind='faq', crumb='FAQ',
                 title='Frequently Asked Questions',
                 description='Answers about Manifest Advisors: what the firm does, who founded it, who it works with, how engagements start, and how it differs from similar names.'),
    'services/': dict(kind='collection', crumb='Services',
                      title='Advisory Services for Growth & Funds',
                      description='Five strategy services from Manifest Advisors and founder Jen Tacheff: go-to-market, funds and fundraising, brand, leadership coaching, and AI.'),
    'services/growth-go-to-market/': dict(kind='service', crumb='Growth & Go-to-Market', service='Growth & Go-to-Market',
                                          title='Growth & Go-to-Market Strategy',
                                          description='Manifest Advisors helps founders and companies with go-to-market strategy, growth and revenue planning, fractional leadership, and new-market launches.'),
    'services/funds-fundraising/': dict(kind='service', crumb='Funds & Fundraising', service='Funds & Fundraising',
                                        title='Fund Launch & Fundraising Strategy',
                                        description='Manifest Advisors helps fund builders and founders with fund positioning, fundraising narratives, and partnerships. Strategy, not investment advice.'),
    'services/brand-storytelling/': dict(kind='service', crumb='Brand & Storytelling', service='Brand & Storytelling',
                                         title='Brand Positioning & Storytelling',
                                         description='Manifest Advisors shapes positioning, messaging, founder and brand stories, and campaigns that make a complex company easy to understand.'),
    'services/leadership-coaching/': dict(kind='service', crumb='Leadership & Coaching', service='Leadership & Coaching',
                                          title='Founder & Executive Coaching',
                                          description='Founder coaching, executive coaching, strategy sessions, and ongoing partnership with Jen Tacheff, a 2023 Techstars All-Star Mentor.'),
    'services/innovation-ai/': dict(kind='service', crumb='Innovation & AI', service='Innovation & AI',
                                    title='Innovation & AI Go-to-Market',
                                    description='Manifest Advisors helps teams bring new technology to market: innovation strategy, AI go-to-market, convenings, and human-centered ecosystems.'),
    'work/': dict(kind='collection', crumb='Work',
                  title='Selected Work & Case Studies',
                  description='Case studies from Manifest Advisors and Jen Tacheff across growth, venture, brand, leadership, innovation, and social impact.'),
    'work/alana-karen/': dict(kind='case', crumb='Alana Karen',
                              title='Alana Karen: Personal Brand Case Study',
                              description='How Jen Tacheff helped technology leader, author, and speaker Alana Karen with personal brand, marketing, and positioning.'),
    'work/berkeley-haas/': dict(kind='case', crumb='UC Berkeley Haas',
                                title='UC Berkeley Haas Visiting Lecturer',
                                description='Jen Tacheff taught growth, innovation, go-to-market, and entrepreneurship workshops as a visiting lecturer at UC Berkeley Haas, 2021–2024.'),
    'work/chabot-space-science/': dict(kind='case', crumb='Chabot Space & Science Center',
                                       title='Chabot Space & Science Center Case Study',
                                       description='Jen Tacheff led corporate relations, membership programs, speaker series, and science partnerships at Chabot Space & Science Center.'),
    'work/commongenius/': dict(kind='case', crumb='CommonGenius',
                               title='CommonGenius Go-to-Market Case Study',
                               description='As VP of Growth and Innovation at CommonGenius, Jen Tacheff led go-to-market and activations at SXSW, TechCrunch, and Collision.'),
    'work/founder-advisory/': dict(kind='case', crumb='Founder & creative advisory',
                                   title='Founder & Creative Advisory Case Study',
                                   description='One-to-one advisory from Jen Tacheff that helps founders clarify their stories, explore growth opportunities, and lead through change.'),
    'work/girls-inc/': dict(kind='case', crumb='Girls Inc.',
                            title='Girls Inc. $20M Capital Campaign',
                            description='Jen Tacheff led marketing and fundraising for a $20M+ capital campaign for the Girls Inc. center in downtown Oakland.'),
    'work/gofundme-classy/': dict(kind='case', crumb='GoFundMe / Classy',
                                  title='GoFundMe / Classy AI Go-to-Market',
                                  description='Manifest Advisors supported go-to-market for new AI and data products at GoFundMe and Classy, informing the roadmap and brand visibility.'),
    'work/google-global-accelerator/': dict(kind='case', crumb='Google Global Accelerator',
                                            title='Google Global Accelerator Case Study',
                                            description='Manifest Advisors turned Google Global Accelerator founder stories and new technologies into global campaigns.'),
    'work/hustle/': dict(kind='case', crumb='Hustle',
                         title='Hustle Brand & Marketing Case Study',
                         description='As Head of Brand, Marketing and Communications at Hustle, Jen Tacheff led full-funnel campaigns, partnerships, and positioning.'),
    'work/mothercoders/': dict(kind='case', crumb='MotherCoders',
                               title='MotherCoders Strategic Advisory',
                               description='Jen Tacheff advised MotherCoders on fundraising, marketing, pitch decks, and leadership succession through a founder CEO transition.'),
    'work/noesis-humanconnections-ai/': dict(kind='case', crumb='Noēsis / HumanConnections.AI',
                                             title='Noēsis / HumanConnections.AI Case Study',
                                             description='Jen Tacheff helped create HumanConnections.AI and led AI workshops with Harvard and the University of Cambridge as a Noēsis senior advisor.'),
    'work/onramp/': dict(kind='case', crumb='Onramp',
                         title='Onramp Growth & Go-to-Market Case Study',
                         description='As CMO and CGO at Onramp, Jen Tacheff led growth and go-to-market and helped win Twitch, Amazon, Google, Coinbase, and Vanguard.'),
    'work/pwv-zeal-redwoodjs/': dict(kind='case', crumb='Preston-Werner Ventures / ZEAL / RedwoodJS',
                                     title='PWV, ZEAL & RedwoodJS Case Study',
                                     description='Fractional CMO and COO work for Preston-Werner Ventures, ZEAL, and RedwoodJS: developer engagement, partnerships, and the first RedwoodJS Conference.'),
    'work/the-divisible/': dict(kind='case', crumb='Jubilee Productions / THE DIVISIBLE',
                                title='THE DIVISIBLE Film Launch Case Study',
                                description='Jen Tacheff was associate producer and marketing advisor for THE DIVISIBLE, the first short film from Jubilee Productions.'),
    'work/the-go-game-weve/': dict(kind='case', crumb='The Go Game / Weve',
                                   title='The Go Game / Weve Case Study',
                                   description='Manifest Advisors led go-to-market for The Go Game and Weve pandemic pivot: brand relaunch, new website, and 300+ weekly demo registrations.'),
    'work/w-fund-switch/': dict(kind='case', crumb='W Fund / SWITCH',
                                title='W Fund / SWITCH Founder Coaching',
                                description='As partner and board member at W Fund and SWITCH, Jen Tacheff built and co-led a coaching program for founders and executives.'),
    'work/women-who-code/': dict(kind='case', crumb='Women Who Code',
                                 title='Women Who Code Growth Case Study',
                                 description='Jen Tacheff was VP of Partnerships and Growth on the Women Who Code founding leadership team, building a global technical community.'),
    'testimonials/': dict(kind='page', crumb='Testimonials',
                          title='Client Testimonials & Recommendations',
                          description='28 recommendations from founders, executives, and collaborators who have worked with Jen Tacheff and Manifest Advisors.'),
    'blog/': dict(kind='collection', crumb='Blog',
                  title='Blog: Ideas on Growth, Funds & AI',
                  description='Manifest Advisors blog: speaking and events, founder mentorship, AI and human connection, storytelling, and how engagements begin.'),
    'blog/ai-and-human-connection/': dict(kind='post', crumb='AI and human connection',
                                          title='AI and Human Connection',
                                          description='How HumanConnections.AI brings a human question into AI development, and Jen Tacheff’s work with Noēsis, Harvard, and Cambridge.'),
    'blog/founder-mentorship/': dict(kind='post', crumb='Founder mentorship',
                                     title='Founder Mentorship: A Sounding Board',
                                     description='Founders need room to think alongside the pressure to act. How Jen Tacheff mentors founders through Techstars, SXSW, and W Fund.'),
    'blog/speaking-and-events/': dict(kind='post', crumb='Speaking & events',
                                      title='Speaking, Workshops & Convenings',
                                      description='Jen Tacheff’s speaking, workshops, and convenings, from founder workshops at UC Berkeley Haas to conversations about AI and society.'),
    'blog/stories-beyond-business/': dict(kind='post', crumb='Stories beyond business',
                                          title='Stories Beyond the Boardroom',
                                          description='How a clear story helps a founder, an author, or a creative team find its audience, with examples from Manifest Advisors’ work.'),
    'blog/techstars-all-star/': dict(kind='post', crumb='Techstars All-Star Mentor',
                                     title='2023 Techstars All-Star Mentor',
                                     description='Techstars named Jennifer Tacheff a 2023 All-Star Mentor for the Techstars Anywhere Remote Accelerator, announced February 2024.'),
    'blog/your-next-move/': dict(kind='post', crumb='Your next move',
                                 title='Five Starting Points for Your Next Move',
                                 description='Launching a fund, scaling a company, and entering a new market ask different questions. Five ways an engagement with Manifest Advisors begins.'),
}

SECTION_CRUMBS = {'services': 'Services', 'work': 'Work', 'blog': 'Blog'}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
TODAY = datetime.date.today().isoformat()


def url(path):
    """Absolute URL on the canonical domain. path is '' or 'dir/' or '/asset'."""
    return SITE_URL + '/' + path.lstrip('/')


def git(*args):
    try:
        return subprocess.run(['git', *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ''


def last_modified(files):
    """Last commit date touching any of files; today if any of them has uncommitted changes."""
    if git('status', '--porcelain', '--', *files):
        return TODAY
    return git('log', '-1', '--format=%ad', '--date=short', '--', *files) or TODAY


def first_published(files):
    dates = git('log', '--diff-filter=A', '--format=%ad', '--date=short', '--', *files).split()
    return min(dates) if dates else TODAY


def text(fragment):
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', fragment))).strip()


def attr(value):
    return html.escape(value, quote=True)


def page_file(path):
    return ROOT / path / 'index.html'


def ldjson(data):
    raw = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    return raw.replace('</', '<\\/')  # never close the <script> early


# ---------------------------------------------------------------------------
# Structured data
# ---------------------------------------------------------------------------
def sitewide_graph():
    services = [(p, m['service']) for p, m in PAGES.items() if m['kind'] == 'service']
    org = {
        '@type': 'Organization', '@id': ORG_ID, 'name': SITE_NAME,
        'alternateName': ['Manifest', 'Manifest Advisor'],
        'url': url(''),
        'logo': {'@type': 'ImageObject', 'url': url(LOGO), 'width': 512, 'height': 512},
        'image': url(OG_IMAGE),
        'description': ('Manifest Advisors is a strategy and growth advisory firm founded by Jennifer (Jen) Tacheff in '
                        'October 2019. It works with founders, startups, venture funds, global companies, and '
                        'mission-driven organizations at critical growth moments—launching a fund, scaling a company, '
                        'or entering a new market.'),
        'disambiguatingDescription': ('Strategy and growth advisory firm at manifestadviso.rs, founded by Jen Tacheff in 2019. '
                                      'Not a financial planner or registered investment adviser, and not affiliated with '
                                      'manifest-advisor.com, Manifest wealth management (manifestplanning.com), or the '
                                      'SEC-registered Manifest Advisors LLC (CRD #307739).'),
        'slogan': 'Your next move matters.',
        'foundingDate': '2019-10',
        'founder': {'@id': PERSON_ID},
        'areaServed': 'Worldwide',
        'knowsAbout': KNOWS_ABOUT,
        'sameAs': ORG_SAME_AS,
        'contactPoint': {'@type': 'ContactPoint', 'contactType': 'sales', 'url': url('contact/'),
                         'availableLanguage': 'English'},
        'hasOfferCatalog': {'@type': 'OfferCatalog', 'name': 'Services', 'itemListElement': [
            {'@type': 'Offer', 'itemOffered': {'@type': 'Service', '@id': url(p) + '#service', 'name': name,
                                               'url': url(p), 'provider': {'@id': ORG_ID}}}
            for p, name in services]},
    }
    person = {
        '@type': 'Person', '@id': PERSON_ID, 'name': 'Jennifer Tacheff', 'alternateName': 'Jen Tacheff',
        'givenName': 'Jennifer', 'familyName': 'Tacheff',
        'jobTitle': 'Founder & CEO', 'worksFor': {'@id': ORG_ID},
        'url': url('about/'), 'image': url(PERSON_IMAGE),
        'description': 'Founder of Manifest Advisors. Growth strategist, ecosystem builder, startup mentor, and executive coach.',
        'alumniOf': {'@type': 'CollegeOrUniversity', 'name': 'University of California, San Diego'},
        'affiliation': [
            {'@type': 'Organization', 'name': 'Techstars', 'url': 'https://www.techstars.com/',
             'description': 'Lead Mentor, Techstars Anywhere Accelerator; 2023 Techstars All-Star Mentor'},
            {'@type': 'CollegeOrUniversity', 'name': 'UC Berkeley Haas School of Business', 'url': 'https://haas.berkeley.edu/',
             'description': 'Visiting Lecturer, Growth & Innovation (2021–2024)'},
            {'@type': 'Organization', 'name': 'SXSW', 'url': 'https://www.sxsw.com/',
             'description': 'Member of the Board of Advisors'},
        ],
        'award': ['2023 Techstars All-Star Mentor',
                  'Women Transforming Technology Executive Leadership recognition (2018)'],
        'knowsAbout': KNOWS_ABOUT,
        'sameAs': PERSON_SAME_AS,
    }
    website = {
        '@type': 'WebSite', '@id': WEBSITE_ID, 'name': SITE_NAME, 'alternateName': ['Manifest', 'Manifest Advisor'],
        'url': url(''), 'publisher': {'@id': ORG_ID}, 'inLanguage': 'en-US',
    }
    return [org, person, website]


def breadcrumb(path, meta):
    items = [('Home', '')]
    parts = path.strip('/').split('/') if path else []
    if len(parts) == 2:
        items.append((SECTION_CRUMBS[parts[0]], parts[0] + '/'))
    if path:
        items.append((meta['crumb'], path))
    return {
        '@type': 'BreadcrumbList', '@id': url(path) + '#breadcrumb',
        'itemListElement': [{'@type': 'ListItem', 'position': i, 'name': n, 'item': url(p)}
                            for i, (n, p) in enumerate(items, 1)],
    }


def faq_entities(src):
    out = []
    for q, a in re.findall(r'<h2 class="faq-question">(.*?)</h2>\s*<div class="faq-answer">(.*?)</div>', src, re.S):
        # Visible answer text only: paragraphs and list items, not the "read more" link.
        bits = re.findall(r'<(p|li)\b[^>]*>(.*?)</\1>', a, re.S)
        answer = ' '.join(text(b) for _, b in bits)
        out.append({'@type': 'Question', 'name': text(q), 'acceptedAnswer': {'@type': 'Answer', 'text': answer}})
    return out


def page_graph(path, meta, src, dates):
    page_url = url(path)
    kind = meta['kind']
    page_type = {'home': 'WebPage', 'about': 'AboutPage', 'contact': 'ContactPage', 'faq': 'FAQPage',
                 'collection': 'CollectionPage'}.get(kind, 'WebPage')
    webpage = {
        '@type': page_type, '@id': page_url + '#webpage', 'url': page_url,
        'name': meta['title'] if kind != 'home' else SITE_NAME,
        'description': meta['description'],
        'isPartOf': {'@id': WEBSITE_ID},
        'about': {'@id': PERSON_ID if kind == 'about' else ORG_ID},
        'primaryImageOfPage': {'@type': 'ImageObject', 'url': url(OG_IMAGE), 'width': 1200, 'height': 630},
        'breadcrumb': {'@id': page_url + '#breadcrumb'},
        'dateModified': dates['modified'],
        'inLanguage': 'en-US',
    }
    graph = sitewide_graph() + [breadcrumb(path, meta), webpage]
    if kind == 'about':
        webpage['mainEntity'] = {'@id': PERSON_ID}
    elif kind == 'faq':
        webpage['mainEntity'] = faq_entities(src)
    elif kind == 'service':
        summary = re.search(r'<p class="answer-summary">(.*?)</p>', src, re.S)
        graph.append({
            '@type': 'Service', '@id': page_url + '#service', 'name': meta['service'], 'serviceType': meta['service'],
            'description': text(summary.group(1)) if summary else meta['description'],
            'url': page_url, 'provider': {'@id': ORG_ID}, 'areaServed': 'Worldwide',
        })
        webpage['mainEntity'] = {'@id': page_url + '#service'}
    elif kind == 'post':
        headline = text(re.search(r'<h1[^>]*>(.*?)</h1>', src, re.S).group(1))
        graph.append({
            '@type': 'BlogPosting', '@id': page_url + '#article', 'headline': headline,
            'description': meta['description'], 'url': page_url,
            'mainEntityOfPage': {'@id': page_url + '#webpage'},
            'author': {'@id': PERSON_ID}, 'publisher': {'@id': ORG_ID},
            'datePublished': dates['published'], 'dateModified': dates['modified'],
            'image': {'@type': 'ImageObject', 'url': url(OG_IMAGE), 'width': 1200, 'height': 630},
            'inLanguage': 'en-US',
        })
        webpage['mainEntity'] = {'@id': page_url + '#article'}
    elif kind == 'case':
        webpage['mentions'] = {'@id': PERSON_ID}
    return {'@context': 'https://schema.org', '@graph': graph}


# ---------------------------------------------------------------------------
# <head> rewriting
# ---------------------------------------------------------------------------
SEO_TAG = re.compile(
    r'<meta name="(?:description|author|robots)"[^>]*>'
    r'|<link rel="canonical"[^>]*>'
    r'|<meta property="(?:og|article):[^"]*"[^>]*>'
    r'|<meta name="twitter:[^"]*"[^>]*>'
    r'|<script type="application/ld\+json">.*?</script>', re.S)


def head_block(path, meta, src, dates):
    title = meta['title'] + TITLE_SUFFIX
    desc = meta['description']
    canonical = url(path)
    og_type = 'article' if meta['kind'] == 'post' else 'website'
    tags = [
        f'<title>{attr(title)}</title>',
        f'<meta name="description" content="{attr(desc)}">',
        '<meta name="author" content="Jennifer Tacheff">',
        '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">',
        f'<link rel="canonical" href="{canonical}">',
        f'<meta property="og:site_name" content="{SITE_NAME}">',
        '<meta property="og:locale" content="en_US">',
        f'<meta property="og:type" content="{og_type}">',
        f'<meta property="og:url" content="{canonical}">',
        f'<meta property="og:title" content="{attr(title)}">',
        f'<meta property="og:description" content="{attr(desc)}">',
        f'<meta property="og:image" content="{url(OG_IMAGE)}">',
        '<meta property="og:image:type" content="image/png">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        f'<meta property="og:image:alt" content="{attr(OG_IMAGE_ALT)}">',
    ]
    if og_type == 'article':
        tags += [f'<meta property="article:published_time" content="{dates["published"]}">',
                 f'<meta property="article:modified_time" content="{dates["modified"]}">',
                 '<meta property="article:author" content="Jennifer Tacheff">']
    tags += [
        '<meta name="twitter:card" content="summary_large_image">',
        f'<meta name="twitter:title" content="{attr(title)}">',
        f'<meta name="twitter:description" content="{attr(desc)}">',
        f'<meta name="twitter:image" content="{url(OG_IMAGE)}">',
        f'<meta name="twitter:image:alt" content="{attr(OG_IMAGE_ALT)}">',
        f'<script type="application/ld+json">{ldjson(page_graph(path, meta, src, dates))}</script>',
    ]
    return ''.join(tags)


def page_dates(path, meta):
    files = [str(page_file(path).relative_to(ROOT))]
    modified = last_modified(files)
    published = modified
    if meta['kind'] == 'post':
        # Posts moved from /sparks/ to /blog/; the original add date lives on the old path.
        published = first_published(files + [files[0].replace('blog/', 'sparks/', 1)])
    return {'published': published, 'modified': modified}


def rewrite_page(path, meta):
    f = page_file(path)
    src = f.read_text()
    head_end = src.index('</head>')
    head, body = src[:head_end], src[head_end:]
    head = SEO_TAG.sub('', head)
    block = head_block(path, meta, body, page_dates(path, meta))
    head, n = re.subn(r'<title>.*?</title>', lambda _: block, head, count=1, flags=re.S)
    assert n == 1, f'{f}: no <title>'
    out = head + body
    if out != src:
        f.write_text(out)
    return out


# ---------------------------------------------------------------------------
# Redirect stubs, sitemap, robots, llms.txt
# ---------------------------------------------------------------------------
def redirect_stubs():
    for f in sorted(ROOT.rglob('index.html')):
        src = f.read_text()
        if 'http-equiv="refresh"' not in src[:800]:
            continue
        target = re.search(r'http-equiv="refresh" content="0;url=([^"]+)"', src).group(1)
        rel = (f.parent / target).resolve().relative_to(ROOT).as_posix()
        dest = '' if rel == '.' else rel.rstrip('/') + '/'
        new = re.sub(r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url(dest)}">', src)
        if new != src:
            f.write_text(new)
        yield f, dest


def write(name, content):
    p = ROOT / name
    if not p.exists() or p.read_text() != content:
        p.write_text(content)


def sitemap(dates):
    rows = []
    for path in PAGES:
        prio = '1.0' if path == '' else ('0.8' if PAGES[path]['kind'] in ('service', 'about', 'faq') else '0.6')
        rows.append(f'  <url><loc>{url(path)}</loc><lastmod>{dates[path]["modified"]}</lastmod><priority>{prio}</priority></url>')
    write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n'
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(rows) + '\n</urlset>\n')


AI_CRAWLERS = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
               'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Applebot',
               'Googlebot', 'Bingbot']


def robots():
    lines = ['# Manifest Advisors — https://manifestadviso.rs', '# All crawlers, including AI answer engines, are welcome.', '',
             'User-agent: *', 'Allow: /', '']
    for bot in AI_CRAWLERS:
        lines += [f'User-agent: {bot}', 'Allow: /', '']
    lines.append(f'Sitemap: {url("sitemap.xml")}')
    write('robots.txt', '\n'.join(lines) + '\n')


def llms():
    L = lambda p: url(p)
    content = f"""# Manifest Advisors

> Manifest Advisors ({SITE_URL.split('//')[1]}) is a strategy and growth advisory firm founded by Jennifer (Jen) Tacheff in October 2019. It works with founders, startups, venture funds, global companies, and mission-driven organizations at critical growth moments—launching a fund, scaling a company, or entering a new market.

Key facts:

- Name: Manifest Advisors (also shortened to "Manifest"). Website: {L('')}. Tagline: "Your next move matters."
- Founded: October 2019, by Jennifer (Jen) Tacheff, Founder & CEO.
- Founder: Jennifer Tacheff, a growth strategist, ecosystem builder, startup mentor, and executive coach. She was named a 2023 Techstars All-Star Mentor, has taught as a visiting lecturer at UC Berkeley's Haas School of Business, and has served on the SXSW Board of Advisors.
- Services: Growth & Go-to-Market, Funds & Fundraising, Brand & Storytelling, Leadership & Coaching, and Innovation & AI.
- Engagements can take the form of strategic advice, coaching, a defined project, or fractional leadership (including fractional CMO and COO roles).
- Engagements have included Google Global Accelerator, GoFundMe and Classy, Preston-Werner Ventures and ZEAL, and The Go Game and Weve.
- Track record: $4B+ raised by the portfolio of a $50M fund Manifest built, 147 countries reached by a global community it scaled, 50+ products launched for startups and global brands, 1,000+ ventures vetted, and $150M+ in capital and revenue unlocked for clients.
- Manifest Advisors is not a financial planning or investment advisory firm, and it does not manage money or give investment advice.

## Not to be confused with

Several unrelated organizations use similar names. Manifest Advisors at {SITE_URL.split('//')[1]} is not affiliated with any of them:

- manifest-advisor.com: a separate fractional marketing consultancy.
- Manifest (manifestplanning.com): a wealth management firm based in Minnesota.
- Manifest Advisors LLC, SEC-registered investment adviser (CRD #307739): a separate registered investment adviser.

## Start here

- [Home]({L('')}): Overview of Manifest Advisors, its five services, and selected client stories.
- [FAQ]({L('faq/')}): Plain answers about what Manifest Advisors does, who founded it, who it works with, and how engagements start.
- [About Jen Tacheff]({L('about/')}): Founder biography and full career history.
- [Contact]({L('contact/')}): Connect with Jen Tacheff on LinkedIn.

## Services

- [Growth & Go-to-Market]({L('services/growth-go-to-market/')}): Go-to-market strategy, growth and revenue, fractional leadership, and market entry and launches.
- [Funds & Fundraising]({L('services/funds-fundraising/')}): Fund positioning, fundraising narratives, ecosystem and partnerships, and founder readiness.
- [Brand & Storytelling]({L('services/brand-storytelling/')}): Positioning and messaging, founder and brand stories, and campaigns and experiences.
- [Leadership & Coaching]({L('services/leadership-coaching/')}): Founder coaching, executive coaching, strategy sessions, and ongoing partnership.
- [Innovation & AI]({L('services/innovation-ai/')}): Innovation strategy, AI go-to-market, programs and convenings, and human-centered ecosystems.

## Work and proof

- [Selected work]({L('work/')}): Case studies across growth, venture, brand, leadership, innovation, and social impact.
- [Testimonials]({L('testimonials/')}): 28 recommendations from founders, executives, and collaborators.

## Optional

- [Blog]({L('blog/')}): Articles on speaking, founder mentorship, AI and human connection, and working with Manifest.
- [Five starting points for your next move]({L('blog/your-next-move/')}): How an engagement with Manifest typically begins.
"""
    write('llms.txt', content)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
def validate(rendered):
    problems = []
    titles, descs = {}, {}
    for path, src in rendered.items():
        head = src[:src.index('</head>')]
        t = text(re.search(r'<title>(.*?)</title>', head, re.S).group(1))
        d = html.unescape(re.search(r'<meta name="description" content="([^"]*)"', head).group(1))
        if len(t) > 60: problems.append(f'/{path}: title {len(t)} chars')
        if not t.endswith(TITLE_SUFFIX.strip(' ')): problems.append(f'/{path}: title suffix')
        if len(d) > 155: problems.append(f'/{path}: description {len(d)} chars')
        if t in titles: problems.append(f'/{path}: duplicate title with /{titles[t]}')
        if d in descs: problems.append(f'/{path}: duplicate description with /{descs[d]}')
        titles[t], descs[d] = path, path
        if len(re.findall(r'<h1\b', src)) != 1: problems.append(f'/{path}: needs exactly one <h1>')
        canon = re.findall(r'<link rel="canonical" href="([^"]+)"', head)
        if canon != [url(path)]: problems.append(f'/{path}: canonical {canon}')
        for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', src, re.S):
            try:
                data = json.loads(block)
            except json.JSONDecodeError as e:
                problems.append(f'/{path}: JSON-LD parse error {e}')
                continue
            ids, refs = set(), set()

            def walk(node):
                if isinstance(node, dict):
                    if '@id' in node:
                        (ids if len(node) > 1 else refs).add(node['@id'])
                    for v in node.values(): walk(v)
                elif isinstance(node, list):
                    for v in node: walk(v)
            walk(data)
            for r in sorted(refs - ids):
                problems.append(f'/{path}: unresolved @id {r}')
        for img in re.findall(r'<img\b[^>]*>', src):
            if not re.search(r'\balt="', img): problems.append(f'/{path}: <img> without alt: {img[:80]}')
    return problems


def main():
    check_only = '--check' in sys.argv
    rendered, dates = {}, {}
    on_disk = {f.parent.relative_to(ROOT).as_posix() + '/' for f in ROOT.rglob('index.html')
               if 'http-equiv="refresh"' not in f.read_text()[:800] and not f.relative_to(ROOT).as_posix().startswith('assets/')}
    on_disk = {'' if p == './' else p for p in on_disk}
    if on_disk != set(PAGES):
        sys.exit(f'PAGES out of sync with content pages: missing {sorted(on_disk - set(PAGES))}, extra {sorted(set(PAGES) - on_disk)}')
    for path, meta in PAGES.items():
        if not page_file(path).exists():
            sys.exit(f'missing page for {path!r}')
        if check_only:
            rendered[path] = page_file(path).read_text()
        else:
            rendered[path] = rewrite_page(path, meta)
        dates[path] = page_dates(path, meta)
    stubs = list(redirect_stubs()) if not check_only else []
    if not check_only:
        sitemap(dates)
        robots()
        llms()
    problems = validate(rendered)
    for p in problems:
        print('PROBLEM', p)
    print(f'{len(rendered)} pages, {len(stubs)} redirect stubs, {len(problems)} problems')
    sys.exit(1 if problems else 0)


if __name__ == '__main__':
    main()
