"""Build published pages from data/catalog.json and design templates."""
from pathlib import Path
import hashlib
import html
import json
import re

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "catalog.json"


def lookup(data, path):
    value = data
    for part in path.split("/"):
        if isinstance(value, list):
            if value and isinstance(value[0], dict) and "id" in value[0]:
                value = next(item for item in value if item["id"] == part)
            else:
                value = value[int(part)]
        else:
            value = value[part]
    return value


def validate(data):
    if data["schemaVersion"] != 1:
        raise ValueError("Unsupported data format")
    for group in ("projects", "built"):
        records = data[group]
        ids = [item["id"] for item in records]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate IDs in " + group)
        if not records:
            raise ValueError("Empty " + group)
        if not any(item.get('status', 'published') == 'published' for item in records):
            raise ValueError('At least one published record required in ' + group)
        for item in records:
            if item.get('status', 'published') not in ('published', 'draft', 'archived'):
                raise ValueError('Invalid status: ' + item['id'])
            if not re.fullmatch(r'[A-Za-z0-9_-]+', item['id']) or not item['name'].strip():
                raise ValueError('Invalid ID or name: ' + item['id'])
    legacy = [item['legacyId'] for item in data['built']]
    if len(legacy) != len(set(legacy)) or any(not re.fullmatch(r'[A-Za-z0-9_-]+', x) for x in legacy):
        raise ValueError('Invalid or duplicate portfolio IDs')
    serialized = json.dumps(data, ensure_ascii=False)
    if re.search(r'<script|javascript:|onerror\s*=|onload\s*=', serialized, re.I):
        raise ValueError('Executable markup is not allowed in catalog data')
    if not re.fullmatch(r'\+\d{10,15}', data['contacts']['phone']):
        raise ValueError('Invalid contact phone')
    for key, value in data['contacts'].items():
        if key != 'phone' and value and (not value.startswith('https://') or re.search(r'''[<>"'`\s]''', value)):
            raise ValueError('Invalid contact URL: ' + key)
    for project in data["projects"]:
        for key in ("warm", "fin"):
            if not isinstance(project[key], (int, float)) or project[key] < 0:
                raise ValueError("Invalid price for " + project["id"])
        if project['fin'] < project['warm']:
            raise ValueError('Finish price below warm price: ' + project['id'])
        for key in ('area', 'terArea', 'beds'):
            if not isinstance(project[key], (int, float)) or project[key] < 0:
                raise ValueError('Invalid area or bedroom count: ' + project['id'])
        for image in project["media"].values():
            check_asset("katalog/" + image)
    for building in data["built"]:
        if len(building["photos"]) != len(building["caps"]):
            raise ValueError("Missing photo captions for " + building["id"])
        for image in [building["cover"], *building["photos"], *building.get("plans", [])]:
            check_asset("img/" + image + ".webp")
    for image in data["assets"].values():
        if not image.startswith(("https://", "http://", "data:")):
            check_asset(image)


def check_asset(relative):
    asset = (ROOT / relative).resolve()
    if not asset.is_relative_to(ROOT) or not asset.is_file():
        raise ValueError("Missing image: " + relative)


def portfolio(data):
    result = {}
    for building in data["built"]:
        completion = next((v for k, v in building.get("specs", []) if k.startswith("Сдан")), "")
        source = building["presentation"]
        fields = {
            "dim": building["dim"],
            "inside": ", ".join(building.get("inside", [])),
            "completion": completion,
        }
        facts = [[item["label"], fields[item["from"]] if "from" in item else item["value"]] for item in source["fields"]]
        photos = [[image, caption, 0] for image, caption in zip(building["photos"], building["caps"])]
        plans = [[image, caption, 1] for image, caption in zip(building.get("plans", []), building.get("planCaps", []))]
        result[building["legacyId"]] = {
            "title": building["name"], "facts": facts,
            "note": source.get("note"), "spec": source.get("spec"),
            "video": source.get("video"), "reviews": source.get("reviews", []),
            "photos": photos + plans,
        }
    return result


def compile_pages(data):
    revision = hashlib.sha256(DATA.read_bytes()).hexdigest()[:12]
    payload = dict(data)
    payload['projects'] = [x for x in data['projects'] if x.get('status', 'published') == 'published']
    payload['built'] = [x for x in data['built'] if x.get('status', 'published') == 'published']
    payload["portfolio"] = portfolio(payload)
    script = "/* Generated by scripts/build.py. Edit data/catalog.json. */\nwindow.STUDIO_DATA = " + json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c") + ";\n"
    files = {Path("data/catalog.js"): script}

    def token(match):
        kind, path = match.group(1), match.group(2)
        value = str(lookup(data, path))
        if kind == "phone" and len(value) == 12 and value.startswith("+7"):
            value = value[:2] + " " + value[2:5] + " " + value[5:8] + "-" + value[8:10] + "-" + value[10:]
        if kind == "photo":
            value = "img/" + value + ".webp"
        return html.escape(value, quote=kind != "text")

    for template in sorted((ROOT / "templates").rglob("*.html")):
        relative = template.relative_to(ROOT / "templates")
        source = template.read_text(encoding="utf-8")
        source = re.sub(r"\{\{(text|attr|photo|phone):([^{}]+)\}\}", token, source)
        source = source.replace("__DATA_REVISION__", revision)
        if relative.as_posix() == 'promo.html':
            source = studio_portfolio(source, payload)
        # Static HTML and JavaScript template strings use the same contact links.
        for key in ("telegram", "channel", "avito"):
            source = source.replace("${STUDIO_DATA.contacts." + key + "}", data["contacts"][key])
        if data['contacts'].get('write'):
            source = source.replace('https://vk.me/zagorodnaya_studia', html.escape(data['contacts']['write'], quote=True))
        if "{{text:" in source or "__DATA_REVISION__" in source:
            raise ValueError("Unresolved template in " + str(relative))
        files[relative] = source
    standalone = ROOT / 'builder-desktop-draft.html'
    if standalone.exists():
        content = standalone.read_text(encoding='utf-8')
        content = re.sub(r'data/catalog\.js\?v=[^"\s]+', 'data/catalog.js?v=' + revision, content)
        files[Path('builder-desktop-draft.html')] = content
    return files


def studio_portfolio(source, data):
    """Use the same publication order and records as the browser catalog."""
    e = lambda x: html.escape(str(x), quote=True)
    buildings = data['built']
    first = buildings[0]
    key = e(first['legacyId'])
    facts = lambda b: ''.join('<dt>' + e(k) + '</dt><dd>' + e(v) + '</dd>' for k, v in data['portfolio'][b['legacyId']]['facts'])
    hero = ('<div class="hero__tag tag" data-house="' + key + '"><h1>' + e(first['name']) +
            '</h1><dl>' + facts(first) + '</dl><a class="more" data-house="' + key + '" href="#dom/' + key + '">Фото и план →</a></div>')
    source = re.sub(r'<div class="hero__tag tag".*?</div>', lambda m: hero, source, count=1, flags=re.S)
    def photo(m):
        block = m.group(0)
        block = re.sub(r'data-house="[^"]+"', 'data-house="' + key + '"', block)
        block = re.sub(r'<img[^>]+>', '<img src="img/' + e(first['cover']) + '.webp" alt="' + e(first['name']) + '">', block, count=1)
        if first['id'] != 'chernyj-6x8' or first['cover'] != 'hero-1':
            block = block.replace('class="hero__warm"', 'class="hero__warm" style="display:none"')
        return block
    source = re.sub(r'<figure class="hero__photo".*?</figure>', photo, source, count=1, flags=re.S)
    if first['id'] != 'chernyj-6x8':
        source = re.sub(r'<p class="hero__note".*?</p>', '', source, count=1, flags=re.S)
    cards = []
    for i, b in enumerate(buildings[1:], 1):
        bid = e(b['legacyId'])
        cards.append('<a class="exhibit tag" style="--i:' + str(i) + '" data-house="' + bid + '" href="#dom/' + bid +
                     '"><figure data-sc-tilt="5"><img src="img/' + e(b['cover']) + '.webp" width="760" height="570" alt="' +
                     e(b['name']) + '" loading="lazy"></figure><h3>' + e(b['name']) + '</h3><dl>' + facts(b) +
                     '</dl><p class="more">Фото и план →</p></a>')
    source = re.sub(r'<a class="exhibit tag".*?(?=<div class="rail__end">)', lambda m: '\n'.join(cards) + '\n        ', source, count=1, flags=re.S)
    return source


def main():
    data = json.loads(DATA.read_text(encoding="utf-8"))
    validate(data)
    files = compile_pages(data)
    # Prepare every output before replacing any published source.
    for relative, content in files.items():
        destination = ROOT / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.with_suffix(destination.suffix + ".new").write_text(content, encoding="utf-8", newline=(chr(13) + chr(10) if relative.parts[0] == "katalog" else chr(10)))
    for relative in files:
        destination = ROOT / relative
        destination.with_suffix(destination.suffix + ".new").replace(destination)
    print(f"Built {len(files) - 1} pages with {len(data['projects'])} projects and {len(data['built'])} completed objects.")


if __name__ == "__main__":
    main()
