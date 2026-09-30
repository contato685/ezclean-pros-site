#!/usr/bin/env python3
"""Generates static SEO landing pages for each service from services.json + template.html."""
import json
import html
from pathlib import Path

ROOT = Path(__file__).parent
DATA = json.loads((ROOT / "services.json").read_text(encoding="utf-8"))
TEMPLATE = (ROOT / "template.html").read_text(encoding="utf-8")
INDEX_TEMPLATE = (ROOT / "index-template.html").read_text(encoding="utf-8")
DIST = ROOT / "dist" / "services"

brand = DATA["brand"]
areas_list_str = ", ".join(brand["areas"])


def build_jsonld(service):
    return json.dumps({
        "@context": "https://schema.org",
        "@type": "Service",
        "name": service["h1"],
        "serviceType": service["serviceType"],
        "description": service["metaDescription"],
        "provider": {
            "@type": "LocalBusiness",
            "name": brand["name"],
            "telephone": "+1-858-370-5205",
            "email": brand["email"],
            "url": brand["url"],
        },
        "areaServed": [{"@type": "City", "name": a} for a in brand["areas"]],
        "url": f"{brand['url']}services/{service['slug']}/",
    }, ensure_ascii=True, separators=(",", ":"))


def build_breadcrumb_jsonld(service):
    base = brand["url"].rstrip("/")
    return json.dumps({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{base}/"},
            {"@type": "ListItem", "position": 2, "name": "Services", "item": f"{base}/services/"},
            {"@type": "ListItem", "position": 3, "name": service["cardTitle"], "item": f"{base}/services/{service['slug']}/"},
        ],
    }, ensure_ascii=True, separators=(",", ":"))


def render(service):
    canonical = f"{brand['url']}services/{service['slug']}/"
    tags_html = "".join(f'<span class="tag">{html.escape(t)}</span>' for t in service["tags"])
    # body paragraphs are authored HTML (may contain trusted internal <a> links), not escaped
    body_html = "".join(f"<p>{p}</p>" for p in service["body"])
    jsonld = build_jsonld(service)
    breadcrumb_jsonld = build_breadcrumb_jsonld(service)
    combined_jsonld = (
        f'<script type="application/ld+json">{jsonld}</script>\n'
        f'<script type="application/ld+json">{breadcrumb_jsonld}</script>'
    )

    replacements = {
        "{{META_TITLE}}": html.escape(service["metaTitle"]),
        "{{META_DESCRIPTION}}": html.escape(service["metaDescription"]),
        "{{CANONICAL}}": canonical,
        "{{OG_IMAGE}}": brand["ogImage"],
        "{{JSONLD}}": combined_jsonld,
        "{{CARD_TITLE}}": html.escape(service["cardTitle"]),
        "{{H1}}": html.escape(service["h1"]),
        "{{SHORT_DESC}}": html.escape(service["shortDesc"]),
        "{{TAGS_HTML}}": tags_html,
        "{{BODY_HTML}}": body_html,
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


def build_index_jsonld():
    base = brand["url"].rstrip("/")
    item_list = json.dumps({
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i + 1,
                "name": s["cardTitle"],
                "url": f"{base}/services/{s['slug']}/",
            }
            for i, s in enumerate(DATA["services"])
        ],
    }, ensure_ascii=True, separators=(",", ":"))
    breadcrumb = json.dumps({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{base}/"},
            {"@type": "ListItem", "position": 2, "name": "Services", "item": f"{base}/services/"},
        ],
    }, ensure_ascii=True, separators=(",", ":"))
    return (
        f'<script type="application/ld+json">{item_list}</script>\n'
        f'<script type="application/ld+json">{breadcrumb}</script>'
    )


def render_index():
    cards_html = ""
    for i, s in enumerate(DATA["services"], start=1):
        cards_html += (
            f'    <a class="card" href="/services/{s["slug"]}/">\n'
            f'      <div class="num">{i:02d}</div>\n'
            f'      <h2>{html.escape(s["cardTitle"])}</h2>\n'
            f'      <p>{html.escape(s["shortDesc"])}</p>\n'
            f"    </a>\n"
        )

    replacements = {
        "{{META_TITLE}}": html.escape("Cleaning Services in San Diego | EZClean Pros"),
        "{{META_DESCRIPTION}}": html.escape(
            "All EZClean Pros services in one place: residential, deep cleaning, office & "
            "janitorial, real estate turnover, vacation rental, and Airbnb turnover cleaning "
            "across San Diego. Call (858) 370-5205."
        ),
        "{{CANONICAL}}": f"{brand['url']}services/",
        "{{OG_IMAGE}}": brand["ogImage"],
        "{{JSONLD}}": build_index_jsonld(),
        "{{SERVICE_CARDS}}": cards_html,
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
    for service in DATA["services"]:
        page_dir = DIST / service["slug"]
        page_dir.mkdir(parents=True, exist_ok=True)
        out_path = page_dir / "index.html"
        out_path.write_text(render(service), encoding="utf-8")
        print(f"built {out_path.relative_to(ROOT)}")

    index_path = DIST / "index.html"
    index_path.write_text(render_index(), encoding="utf-8")
    print(f"built {index_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
