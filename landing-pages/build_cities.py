#!/usr/bin/env python3
"""Generates static SEO city landing pages from cities.json + city-template.html."""
import base64
import json
import html
from pathlib import Path

ROOT = Path(__file__).parent
DATA = json.loads((ROOT / "cities.json").read_text(encoding="utf-8"))
TEMPLATE = (ROOT / "city-template.html").read_text(encoding="utf-8")
TEMPLATE_V6 = (ROOT / "city-template-v6.html").read_text(encoding="utf-8")
INDEX_TEMPLATE = (ROOT / "city-index-template.html").read_text(encoding="utf-8")
DIST = ROOT / "dist" / "cities"
HERO_BG_PATH = ROOT.parent / "assets" / "hero-bg.jpg"
CITY_PAGES_V6_DIR = ROOT / "city-pages-v6"
V6_HOME_SOURCE = ROOT.parent / "v6" / "hero.html"

# Real Google reviews (verbatim, from the v6 homepage). La Jolla's page leads
# with Sophia's review since it explicitly mentions her La Jolla vacation home.
V6_REVIEWS = [
    {"name": "Sophia M.", "initial": "S", "text": "I hired EzClean while staying at my vacation home in La Jolla, San Diego, and I couldn't be happier with the experience. Every surface was spotless and the attention to detail was impressive. The cleaners arrived right on time and were incredibly friendly and professional throughout. I would highly recommend EZClean to anyone looking for reliable, top-quality cleaning services in the San Diego area."},
    {"name": "Anelise D.", "initial": "A", "text": "We recently moved to the area and needed a deep cleaning at our new place. Easy to schedule and they showed up promptly. Rebecca was very professional and listened to all my requests and left the place nice and clean! Highly recommend them!"},
    {"name": "Charles H.", "initial": "C", "text": "We are delighted with the care, service, clear communication, and special little extras with the team! Highly recommend! Our cottage always looks and smells freshly clean. Linens and towels are freshly washed and folded."},
    {"name": "Abe C.", "initial": "A", "text": "Used them several times and always professional, flexible and does a great job. Even flexible with next day cleanings when I forget to schedule early in the week!"},
    {"name": "Ana C.", "initial": "A", "text": "Amazing service and super helpful!! Super recommend!"},
    {"name": "Marcelo R.", "initial": "M", "text": "I would like to express my gratitude and complete satisfaction with EZClean's services. The team performed an impeccable cleaning, attending to every detail with great professionalism, care, and efficiency. Special mention goes to Ms. Sarah, who provided excellent service from the very first contact. I would certainly recommend EZClean to anyone looking for top-quality service."},
    {"name": "Lu M.", "initial": "L", "text": "An outstanding experience from beginning to end. The team was professional, punctual, and paid exceptional attention to every detail. Everything was impeccably clean, and the level of care truly exceeded my expectations. I highly recommend their services and will certainly be using them again."},
]

LA_JOLLA_NEIGHBORHOODS = ["La Jolla Village", "Bird Rock", "La Jolla Shores", "Windansea", "Muirlands", "Mount Soledad"]

LA_JOLLA_SEO_COPY = [
    "Living in La Jolla can mean different things for different homeowners. Some properties are primary residences, while others are vacation homes, condos or short-term rentals that need reliable cleaning between stays.",
    "EZClean Pros provides professional cleaning designed around those different needs.",
    "For homeowners, recurring residential cleaning helps keep kitchens, bathrooms, bedrooms and living areas consistently maintained without letting household cleaning take over your schedule.",
    "For vacation homeowners, reliable cleaning can help make sure the property is ready before your arrival or after time away.",
    "For short-term rental and Airbnb properties, detailed turnover cleaning helps reset the space between guests and keep the property ready for the next check-in.",
    "Our cleaning process follows a detailed checklist designed to create greater consistency from one visit to the next.",
    "Whenever possible, we also prioritize continuity with the professional servicing your home, helping them become familiar with your space and preferences over time.",
    "The result is a cleaning experience designed to be reliable, detailed and easier for you to manage.",
]

LA_JOLLA_NEARBY = [
    {"name": "Pacific Beach", "href": "/cities/pacific-beach/"},
    {"name": "Clairemont", "href": "/cities/clairemont/"},
    {"name": "Point Loma", "href": "/cities/point-loma/"},
    {"name": "Mission Valley", "href": "/cities/mission-valley/"},
    {"name": "San Diego", "href": "/"},
]

brand = DATA["brand"]
areas_list_str = ", ".join(brand["areas"])


def hero_bg_css(inline_assets=False):
    """Real deploys reference the shared static file (cached once across all city
    pages). inline_assets=True is only for self-contained previews (e.g. Artifact),
    which can't resolve a relative /assets/ path."""
    if not inline_assets:
        return "url('/assets/hero-bg.jpg')"
    data = base64.b64encode(HERO_BG_PATH.read_bytes()).decode("ascii")
    return f"url('data:image/jpeg;base64,{data}')"


def build_jsonld(city):
    return json.dumps({
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": brand["name"],
        "image": brand["ogImage"],
        "url": f"{brand['url']}cities/{city['slug']}/",
        "telephone": "+1-858-370-5205",
        "email": brand["email"],
        "description": city["metaDescription"],
        "areaServed": {"@type": "City", "name": city["name"]},
    }, ensure_ascii=True, separators=(",", ":"))


def build_breadcrumb_jsonld(city):
    base = brand["url"].rstrip("/")
    return json.dumps({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{base}/"},
            {"@type": "ListItem", "position": 2, "name": "Cities", "item": f"{base}/cities/"},
            {"@type": "ListItem", "position": 3, "name": city["name"], "item": f"{base}/cities/{city['slug']}/"},
        ],
    }, ensure_ascii=True, separators=(",", ":"))


def build_faq_jsonld(city):
    return json.dumps({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": faq["q"],
                "acceptedAnswer": {"@type": "Answer", "text": faq["a"]},
            }
            for faq in city["faqs"]
        ],
    }, ensure_ascii=True, separators=(",", ":"))


def build_review_jsonld(city, review):
    return json.dumps({
        "@context": "https://schema.org",
        "@type": "Review",
        "itemReviewed": {"@type": "LocalBusiness", "name": brand["name"]},
        "author": {"@type": "Person", "name": review["name"]},
        "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5"},
        "reviewBody": review["quote"],
    }, ensure_ascii=True, separators=(",", ":"))


def render(city, inline_assets=False):
    review = DATA["reviews"][city["slug"]]
    canonical = f"{brand['url']}cities/{city['slug']}/"
    body_html = "".join(f"<p>{p}</p>" for p in city["body"])  # authored HTML, may contain trusted internal <a> links

    service_cards = "".join(
        f'    <a class="svc-card" href="/services/{s["slug"]}/">\n'
        f'      <span class="num">{i:02d}</span>\n'
        f'      <h3>{html.escape(s["title"])}</h3>\n'
        f'      <p>{html.escape(s["desc"])}</p>\n'
        f"    </a>\n"
        for i, s in enumerate(DATA["services"], start=1)
    )
    reason_cards = "".join(
        f'    <div class="reason">\n'
        f'      <div class="num-row"><span class="num">{i:02d}</span><h3>{html.escape(r["title"])}</h3></div>\n'
        f'      <p>{html.escape(r["desc"])}</p>\n'
        f"    </div>\n"
        for i, r in enumerate(DATA["reasons"], start=1)
    )
    footer_service_links = "".join(
        f'            <a href="/services/{s["slug"]}/">{html.escape(s["title"])}</a>\n'
        for s in DATA["services"]
    )
    faq_items = "".join(
        f'      <details class="faq-item">\n'
        f'        <summary>{html.escape(faq["q"])}</summary>\n'
        f'        <p>{html.escape(faq["a"])}</p>\n'
        f"      </details>\n"
        for faq in city["faqs"]
    )

    jsonld = (
        f'<script type="application/ld+json">{build_jsonld(city)}</script>\n'
        f'<script type="application/ld+json">{build_breadcrumb_jsonld(city)}</script>\n'
        f'<script type="application/ld+json">{build_review_jsonld(city, review)}</script>\n'
        f'<script type="application/ld+json">{build_faq_jsonld(city)}</script>'
    )

    replacements = {
        "{{META_TITLE}}": html.escape(city["metaTitle"]),
        "{{META_DESCRIPTION}}": html.escape(city["metaDescription"]),
        "{{CANONICAL}}": canonical,
        "{{OG_IMAGE}}": brand["ogImage"],
        "{{JSONLD}}": jsonld,
        "{{HERO_BG}}": hero_bg_css(inline_assets),
        "{{CITY_NAME}}": html.escape(city["name"]),
        "{{H1}}": html.escape(city["h1"]),
        "{{LEDE}}": html.escape(city["lede"]),
        "{{BODY_HTML}}": body_html,
        "{{SERVICE_CARDS}}": service_cards,
        "{{REASON_CARDS}}": reason_cards,
        "{{FAQ_ITEMS}}": faq_items,
        "{{FOOTER_SERVICE_LINKS}}": footer_service_links,
        "{{REVIEW_STARS}}": html.escape(review["stars"]),
        "{{REVIEW_QUOTE}}": html.escape(review["quote"]),
        "{{REVIEW_NAME}}": html.escape(review["name"]),
        "{{PHONE_HREF}}": brand["phoneHref"],
        "{{PHONE_DISPLAY}}": brand["phoneDisplay"],
        "{{EMAIL}}": brand["email"],
        "{{TAGLINE}}": html.escape(brand["tagline"]),
        "{{AREAS_LIST}}": html.escape(areas_list_str),
    }

    out = TEMPLATE
    for token, value in replacements.items():
        out = out.replace(token, value)
    return out


def js_str(value):
    return json.dumps(value, ensure_ascii=False)


def render_v6_home():
    """Wraps the v6 San Diego page fragment as a standalone city page."""
    content = V6_HOME_SOURCE.read_text(encoding="utf-8")
    section_marker = '\n<section class="hero">'
    section_index = content.find(section_marker)
    if section_index < 0:
        raise ValueError("Could not find the v6 hero section marker")
    prefix = (
        '<!DOCTYPE html>\n<html lang="en">\n<head>\n'
        '<meta charset="UTF-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        '<link rel="canonical" href="https://ezcleaning.services/cities/san-diego/">\n'
    )
    return (
        prefix
        + content[:section_index]
        + "\n</head>\n<body>"
        + content[section_index:]
        + "\n</body>\n</html>\n"
    )


def render_v6(city):
    """Renders the redesigned v6-style city page. Only La Jolla uses this
    template today; area/nearby/SEO-copy content below is La Jolla-specific
    and will need per-city data once the other cities move to this design."""
    canonical = f"{brand['url']}cities/{city['slug']}/"
    review = DATA["reviews"][city["slug"]]

    jsonld = (
        f'<script type="application/ld+json">{build_jsonld(city)}</script>\n'
        f'<script type="application/ld+json">{build_breadcrumb_jsonld(city)}</script>\n'
        f'<script type="application/ld+json">{build_review_jsonld(city, review)}</script>\n'
        f'<script type="application/ld+json">{build_faq_jsonld(city)}</script>'
    )

    neighborhood_pills = "".join(
        f'      <span class="area-pill">{html.escape(n)}</span>\n' for n in LA_JOLLA_NEIGHBORHOODS
    )
    seo_copy = "".join(f"    <p>{html.escape(p)}</p>\n" for p in LA_JOLLA_SEO_COPY)
    nearby_pills = "".join(
        f'      <a class="nearby-pill" href="{a["href"]}">{html.escape(a["name"])}</a>\n' for a in LA_JOLLA_NEARBY
    )

    faqs = city["faqs"]
    half = (len(faqs) + 1) // 2
    columns = [faqs[:half], faqs[half:]]
    faq_columns = ""
    idx = 0
    for col in columns:
        faq_columns += '      <div class="faq-col">\n'
        for faq in col:
            idx += 1
            faq_columns += (
                f'        <div class="faq-item" data-faq>\n'
                f'          <h3>\n'
                f'            <button type="button" class="faq-question" aria-expanded="false" aria-controls="faq-panel-{idx}" id="faq-trigger-{idx}">\n'
                f'              <span>{html.escape(faq["q"])}</span>\n'
                f'              <span class="faq-icon" aria-hidden="true"><span class="faq-icon-h"></span><span class="faq-icon-v"></span></span>\n'
                f'            </button>\n'
                f'          </h3>\n'
                f'          <div class="faq-answer-wrap"><div class="faq-answer-inner">\n'
                f'            <div class="faq-answer" id="faq-panel-{idx}" role="region" aria-labelledby="faq-trigger-{idx}">{html.escape(faq["a"])}</div>\n'
                f'          </div></div>\n'
                f'        </div>\n'
            )
        faq_columns += "      </div>\n"

    before_after_js = ",\n".join(
        f'  {{ before: "/assets/before-after/before-{i:02d}.jpeg", after: "/assets/before-after/after-{i:02d}.png" }}'
        for i in range(1, 18)
    )
    reviews_js = ",\n".join(
        f'  {{ name: {js_str(r["name"])}, initial: {js_str(r["initial"])}, text: {js_str(r["text"])} }}'
        for r in V6_REVIEWS
    )

    replacements = {
        "{{META_TITLE}}": html.escape(city["metaTitle"]),
        "{{META_DESCRIPTION}}": html.escape(city["metaDescription"]),
        "{{CANONICAL}}": canonical,
        "{{OG_IMAGE}}": brand["ogImage"],
        "{{JSONLD}}": jsonld,
        "{{CITY_NAME}}": html.escape(city["name"]),
        "{{CITY_NAME_UPPER}}": html.escape(city["name"].upper()),
        "{{HERO_EYEBROW}}": html.escape(city["heroEyebrow"]),
        "{{H1}}": html.escape(city["h1"]),
        "{{LEDE}}": html.escape(city["lede"]),
        "{{INTRO_KICKER}}": html.escape(city["introKicker"]),
        "{{INTRO_H2}}": html.escape(city["introH2"]),
        "{{INTRO_P1}}": html.escape(city["introP1"]),
        "{{INTRO_P2}}": html.escape(city["introP2"]),
        "{{NEIGHBORHOOD_PILLS}}": neighborhood_pills,
        "{{SEO_COPY}}": seo_copy,
        "{{NEARBY_PILLS}}": nearby_pills,
        "{{FAQ_COLUMNS}}": faq_columns,
        "{{BEFORE_AFTER_PAIRS_JS}}": before_after_js,
        "{{REVIEWS_JS}}": reviews_js,
        "{{PHONE_HREF}}": brand["phoneHref"],
        "{{PHONE_DISPLAY}}": brand["phoneDisplay"],
        "{{EMAIL}}": brand["email"],
        "{{TAGLINE}}": html.escape(brand["tagline"]),
    }

    out = TEMPLATE_V6
    for token, value in replacements.items():
        out = out.replace(token, value)
    return out


def build_index_jsonld():
    base = brand["url"].rstrip("/")
    item_list = json.dumps({
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i + 1,
                "name": c["name"],
                "url": f"{base}/cities/{c['slug']}/",
            }
            for i, c in enumerate(DATA["cities"])
        ],
    }, ensure_ascii=True, separators=(",", ":"))
    breadcrumb = json.dumps({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{base}/"},
            {"@type": "ListItem", "position": 2, "name": "Cities", "item": f"{base}/cities/"},
        ],
    }, ensure_ascii=True, separators=(",", ":"))
    return (
        f'<script type="application/ld+json">{item_list}</script>\n'
        f'<script type="application/ld+json">{breadcrumb}</script>'
    )


def render_index():
    cards_html = ""
    for c in DATA["cities"]:
        cards_html += (
            f'    <a class="card" href="/cities/{c["slug"]}/">\n'
            f'      <h2>{html.escape(c["name"])}</h2>\n'
            f'      <p>{html.escape(c["lede"])}</p>\n'
            f"    </a>\n"
        )

    replacements = {
        "{{META_TITLE}}": html.escape("Cities We Serve | EZClean Pros San Diego"),
        "{{META_DESCRIPTION}}": html.escape(
            "EZClean Pros serves La Jolla, Pacific Beach, Chula Vista, Coronado, National City, "
            "Point Loma, Mission Valley, Clairemont, Carlsbad, and Encinitas. Call (858) 370-5205."
        ),
        "{{CANONICAL}}": f"{brand['url']}cities/",
        "{{OG_IMAGE}}": brand["ogImage"],
        "{{JSONLD}}": build_index_jsonld(),
        "{{CITY_CARDS}}": cards_html,
        "{{PHONE_HREF}}": brand["phoneHref"],
        "{{PHONE_DISPLAY}}": brand["phoneDisplay"],
        "{{EMAIL}}": brand["email"],
        "{{TAGLINE}}": html.escape(brand["tagline"]),
        "{{AREAS_LIST}}": html.escape(areas_list_str),
    }

    out = INDEX_TEMPLATE
    for token, value in replacements.items():
        out = out.replace(token, value)
    return out


def main():
    DIST.mkdir(parents=True, exist_ok=True)
    for city in DATA["cities"]:
        page_dir = DIST / city["slug"]
        page_dir.mkdir(parents=True, exist_ok=True)
        out_path = page_dir / "index.html"
        template_kind = city.get("template")
        if template_kind == "v6-home":
            page_html = render_v6_home()
        elif template_kind == "v6-static":
            static_path = CITY_PAGES_V6_DIR / f"{city['slug']}.html"
            page_html = static_path.read_text(encoding="utf-8")
        elif template_kind == "v6":
            page_html = render_v6(city)
        else:
            page_html = render(city)
        out_path.write_text(page_html, encoding="utf-8")
        print(f"built {out_path.relative_to(ROOT)}")

    index_path = DIST / "index.html"
    index_path.write_text(render_index(), encoding="utf-8")
    print(f"built {index_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
