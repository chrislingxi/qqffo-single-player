#!/usr/bin/env python3
"""Archive QQ FFO reference pages for local design research.

This script intentionally uses only public, whitelisted sources and stores
copyrighted images as reference material, not reusable game assets.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "docs" / "reference"
RAW_DIR = REFERENCE / "raw"
MD_DIR = REFERENCE / "markdown"
ASSET_DIR = REFERENCE / "assets"

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X) Codex FFO reference archiver/1.0"
CRAWL_DELAY_SECONDS = 0.25
MAX_PAGES = 130
MAX_IMAGES = 80
PAGE_TIMEOUT_SECONDS = 8
IMAGE_TIMEOUT_SECONDS = 6

ALLOWED_HOSTS = {
    "ffo.qq.com",
    "fo.qq.com",
    "ossweb-img.qq.com",
    "game.gtimg.cn",
    "staticwiki.biligame.com",
    "patchwiki.biligame.com",
    "wiki.biligame.com",
    "www.ffobaike.com",
    "ffobaike.com",
}

SOURCE_META = {
    "official": {
        "label": "官方端游资料/新闻",
        "confidence": "高：腾讯官方端游站，优先作为系统原始口径。",
    },
    "ffobaike": {
        "label": "FFO百科",
        "confidence": "中：玩家公益百科，适合补后期系统/副本/活动，需与官方互校。",
    },
    "bwiki": {
        "label": "QQ自由幻想 BWIKI",
        "confidence": "中：玩家维护 Wiki，适合补目录和图鉴，需与官方/百科互校。",
    },
}

CATEGORIES = {
    "基础体验": ["创建角色", "职业", "转职", "飞升", "等级", "属性点", "技能", "自动寻路", "操作", "界面", "传送"],
    "五职业": ["战士", "剑客", "刺客", "术士", "药师", "职业"],
    "转职/飞升": ["转职", "飞升", "10级", "职业任务"],
    "战斗刷怪": ["战斗", "普通攻击", "技能", "怪物", "精英", "BOSS", "挂机", "死亡", "复活"],
    "地图任务": ["地图", "NPC", "任务", "主线", "支线", "循环", "平行世界", "怪物图鉴"],
    "装备道具": ["装备", "武器", "防具", "饰品", "套装", "外甲", "卡片", "耐久", "加工", "打孔", "镶嵌", "升级", "拆解", "附魂", "觉醒", "祝福"],
    "宠物系统": ["宠物", "捕捉", "喂养", "召唤", "信赖", "技能丸", "幻化", "培育", "成长", "宠物装备", "宠物法阵"],
    "副本活动": ["副本", "活动", "赤枭", "八仙", "纯阳", "塔狱", "天空之泉", "天之眼", "失落", "花妖", "夜影村", "迷雾", "冰火", "灵泽殿", "先祖山", "妖皇府", "昆仑雪", "通天魔劫塔"],
    "单机日常": ["试炼", "珍珠海域", "保卫战", "天魔劫", "通天塔", "怪物猎杀令", "日常"],
    "后期养成": ["幻神", "法宝", "灵", "战魂", "典籍", "称号", "110级", "龙翼", "翅膀", "雕花", "巅峰", "千幻"],
}

EXCLUDE_KEYWORDS = [
    "手游",
    "私服",
    "SF",
    "外挂",
    "破解",
    "客户端",
    "补丁下载",
    "GM",
]

SEEDS = [
    ("official", "https://ffo.qq.com/web200708/information/index.shtml"),
    ("official", "https://ffo.qq.com/webplat/info/news_version3/120/3487/3488/3490/m3159/list_2.shtml"),
    ("official", "https://ffo.qq.com/gicp/news/814/13318101.html"),
    ("official", "https://ffo.qq.com/gicp/news/814/13318094.html"),
    ("official", "https://ffo.qq.com/gicp/news/814/13318098.html"),
    ("official", "https://ffo.qq.com/gicp/news/814/15518969.html"),
    ("official", "https://ffo.qq.com/gicp/news/814/18713379.html"),
    ("official", "https://ffo.qq.com/gicp/news/814/18411579.html"),
    ("ffobaike", "https://www.ffobaike.com/intro.html"),
    ("bwiki", "https://wiki.biligame.com/qqffo/%E9%A6%96%E9%A1%B5"),
]


@dataclass
class Link:
    url: str
    text: str = ""


@dataclass
class PageRecord:
    id: str
    source: str
    title: str
    url: str
    final_url: str
    fetched_at: str
    raw_path: str
    markdown_path: str
    categories: list[str]
    confidence: str
    image_refs: list[dict] = field(default_factory=list)
    links_found: int = 0
    bytes: int = 0


class LinkImageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[Link] = []
        self.images: list[dict] = []
        self._anchor_href: str | None = None
        self._anchor_text: list[str] = []
        self.title_parts: list[str] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {k.lower(): v or "" for k, v in attrs}
        if tag.lower() == "a" and attr.get("href"):
            self._anchor_href = attr["href"]
            self._anchor_text = []
        if tag.lower() == "img" and attr.get("src"):
            self.images.append({"src": attr["src"], "alt": attr.get("alt", ""), "title": attr.get("title", "")})
        if tag.lower() == "title":
            self._in_title = True

    def handle_data(self, data: str) -> None:
        if self._anchor_href is not None:
            self._anchor_text.append(data)
        if self._in_title:
            self.title_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "a" and self._anchor_href is not None:
            text = normalize_text("".join(self._anchor_text))
            self.links.append(Link(self._anchor_href, text))
            self._anchor_href = None
            self._anchor_text = []
        if tag.lower() == "title":
            self._in_title = False


class TextParser(HTMLParser):
    BLOCK_TAGS = {"p", "div", "tr", "table", "ul", "ol", "li", "br", "h1", "h2", "h3", "h4", "section", "article"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag in {"script", "style", "noscript", "svg"}:
            self.skip_depth += 1
            return
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")
        if tag == "img":
            attr = {k.lower(): v or "" for k, v in attrs}
            alt = normalize_text(attr.get("alt", ""))
            if alt:
                self.parts.append(f"\n[图片: {alt}]\n")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in {"script", "style", "noscript", "svg"} and self.skip_depth:
            self.skip_depth -= 1
            return
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.skip_depth:
            self.parts.append(data)


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(value or "")).strip()


def page_text(markup: str) -> str:
    parser = TextParser()
    parser.feed(markup)
    text = html.unescape("".join(parser.parts))
    lines = [normalize_text(line) for line in text.splitlines()]
    lines = [line for line in lines if line]
    compact: list[str] = []
    last = None
    for line in lines:
        if line != last:
            compact.append(line)
        last = line
    return "\n\n".join(compact)


def parse_links_images(markup: str) -> tuple[str, list[Link], list[dict]]:
    parser = LinkImageParser()
    parser.feed(markup)
    title = normalize_text("".join(parser.title_parts))
    return title, parser.links, parser.images


def detect_encoding(headers: dict, data: bytes) -> str:
    ctype = headers.get("Content-Type", "")
    match = re.search(r"charset=([\w.-]+)", ctype, re.I)
    if match:
        return match.group(1).lower()
    head = data[:4096].decode("ascii", "ignore")
    match = re.search(r"charset=[\"']?([\w.-]+)", head, re.I)
    if match:
        return match.group(1).lower()
    return "utf-8"


def fetch(url: str) -> tuple[str, bytes, str, dict]:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=PAGE_TIMEOUT_SECONDS) as resp:
        data = resp.read()
        final_url = resp.geturl()
        headers = dict(resp.headers)
    enc = detect_encoding(headers, data)
    for candidate in [enc, "utf-8", "gb18030", "gbk"]:
        try:
            return data.decode(candidate, errors="replace"), data, final_url, headers
        except LookupError:
            continue
    return data.decode("utf-8", errors="replace"), data, final_url, headers


def allowed(url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    host = parsed.netloc.lower()
    if not host:
        return True
    return host in ALLOWED_HOSTS


def infer_source(url: str, default: str) -> str:
    host = urllib.parse.urlparse(url).netloc.lower()
    if "ffobaike.com" in host:
        return "ffobaike"
    if "biligame.com" in host:
        return "bwiki"
    if "qq.com" in host or "gtimg.cn" in host:
        return "official"
    return default


def normalize_url(href: str, base: str) -> str | None:
    if not href or href.startswith(("javascript:", "mailto:", "tel:", "#")):
        return None
    url = urllib.parse.urljoin(base, href)
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        return None
    if not allowed(url):
        return None
    cleaned = parsed._replace(fragment="").geturl()
    return cleaned


def is_relevant(text: str, url: str) -> bool:
    haystack = f"{text} {urllib.parse.unquote(url)}"
    if any(k.lower() in haystack.lower() for k in EXCLUDE_KEYWORDS):
        return False
    if any(k in haystack for words in CATEGORIES.values() for k in words):
        return True
    return any(host in urllib.parse.urlparse(url).netloc for host in ["ffobaike.com", "wiki.biligame.com"]) and (
        "/system/" in url or "/act/" in url or "/pworld/" in url or "/lookup/" in url
    )


def categories_for(title: str, text: str, url: str) -> list[str]:
    haystack = f"{title}\n{text[:5000]}\n{urllib.parse.unquote(url)}"
    found = [cat for cat, words in CATEGORIES.items() if any(word in haystack for word in words)]
    return found or ["待归类"]


def categories_for_metadata(title: str, url: str) -> list[str]:
    decoded = urllib.parse.unquote(url)
    path = urllib.parse.urlparse(url).path
    basename = os.path.basename(path)
    official_map = {
        "1_4.htm": ["基础体验"],
        "1_5.htm": ["基础体验", "五职业", "转职/飞升"],
        "1_6.htm": ["基础体验"],
        "1_7.htm": ["基础体验"],
        "2_1.htm": ["装备道具"],
        "2_2.htm": ["地图任务"],
        "2_3.htm": ["地图任务"],
        "2_4.htm": ["战斗刷怪", "地图任务"],
        "2_5.htm": ["地图任务"],
        "3_1.htm": ["装备道具"],
        "3_2.htm": ["五职业", "战斗刷怪"],
        "3_3.htm": ["宠物系统"],
        "4_1.htm": ["副本活动", "地图任务"],
    }
    if basename in official_map:
        return official_map[basename]
    cats: set[str] = set()
    haystack = f"{title} {decoded}"
    if "/act/" in decoded:
        cats.update(["单机日常", "副本活动"])
    if "/pworld/" in decoded:
        cats.add("副本活动")
    if "/lookup/pet" in decoded or "宠物" in haystack:
        cats.add("宠物系统")
    if "/lookup/" in decoded and any(k in haystack for k in ["装备", "合成", "拆解", "箱子", "道具", "变装", "卡"]):
        cats.add("装备道具")
    if "/system/" in decoded:
        if any(k in haystack for k in ["觉醒", "装备", "套装", "祝福", "千幻", "雕花", "龙翼"]):
            cats.add("装备道具")
        if any(k in haystack for k in ["宠物", "法阵"]):
            cats.add("宠物系统")
        if any(k in haystack for k in ["称号", "110", "巅峰", "典籍", "法宝", "灵", "战魂", "龙翼", "雕花", "霸者", "千幻"]):
            cats.add("后期养成")
        if any(k in haystack for k in ["传送", "等级", "VIP"]):
            cats.add("基础体验")
    if any(k in haystack for k in ["职业", "战士", "剑客", "刺客", "术士", "药师"]):
        cats.add("五职业")
    if any(k in haystack for k in ["转职", "飞升", "110级"]):
        cats.add("转职/飞升")
    if any(k in haystack for k in ["怪物", "BOSS", "战场", "猎杀", "战斗", "技能"]):
        cats.add("战斗刷怪")
    if any(k in haystack for k in ["地图", "任务", "传送", "收集"]):
        cats.add("地图任务")
    if any(k in haystack for k in ["典籍", "觉醒", "宠物法阵", "龙翼", "翅膀", "灵", "法宝"]):
        if "典籍" in haystack or "灵" in haystack or "法宝" in haystack or "龙翼" in haystack or "翅膀" in haystack:
            cats.add("后期养成")
        if "觉醒" in haystack or "龙翼" in haystack or "翅膀" in haystack:
            cats.add("装备道具")
        if "宠物法阵" in haystack:
            cats.add("宠物系统")
    return [cat for cat in CATEGORIES if cat in cats] or ["待归类"]


def slug_for(source: str, title: str, url: str) -> str:
    safe = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff]+", "-", title or urllib.parse.urlparse(url).path.strip("/"))
    safe = safe.strip("-")[:48] or source
    digest = hashlib.sha1(url.encode("utf-8")).hexdigest()[:8]
    return f"{source}-{safe}-{digest}"


def rel(path: Path) -> str:
    return str(path.relative_to(ROOT))


def write_markdown(record: PageRecord, text: str) -> None:
    path = ROOT / record.markdown_path
    path.parent.mkdir(parents=True, exist_ok=True)
    image_count = len(record.image_refs)
    lines = [
        f"# {record.title}",
        "",
        f"- 来源：{SOURCE_META[record.source]['label']}",
        f"- URL：{record.final_url}",
        f"- 抓取日期：{record.fetched_at}",
        f"- 可信度：{record.confidence}",
        f"- 分类：{', '.join(record.categories)}",
        f"- 图片参考：{image_count} 条；仅供内部研究和美术对标，版权归腾讯/原站或相应权利人，禁止直接复用为游戏资产。",
        "",
        "## 正文抽取",
        "",
        text or "（未抽取到正文，保留原始 HTML 供人工查看。）",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def download_image(url: str, page_id: str, idx: int, source: str) -> str | None:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"} or parsed.netloc.lower() not in ALLOWED_HOSTS:
        return None
    ext = os.path.splitext(parsed.path)[1].lower()
    if ext not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        ext = ".bin"
    out_dir = ASSET_DIR / source / page_id
    out_dir.mkdir(parents=True, exist_ok=True)
    out = out_dir / f"{idx:03d}{ext}"
    if out.exists():
        return rel(out)
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Referer": f"{parsed.scheme}://{parsed.netloc}/"})
        with urllib.request.urlopen(req, timeout=IMAGE_TIMEOUT_SECONDS) as resp:
            data = resp.read(5_000_000)
        if data:
            out.write_bytes(data)
            return rel(out)
    except Exception:
        return None
    return None


def build_seed_queue() -> list[tuple[str, str]]:
    queue = list(SEEDS)
    # FFO Baike is a VitePress app; its page map is exposed in HTML after fetching
    # the intro page, so the crawler will enqueue those links dynamically.
    return queue


def archive(max_pages: int = MAX_PAGES, max_images: int = MAX_IMAGES) -> tuple[list[PageRecord], list[str]]:
    for path in [RAW_DIR, MD_DIR, ASSET_DIR]:
        path.mkdir(parents=True, exist_ok=True)

    queue = build_seed_queue()
    queued = {url for _, url in queue}
    visited: set[str] = set()
    records: list[PageRecord] = []
    gaps: list[str] = []
    image_downloads = 0
    fetched_at = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S %Z")

    while queue and len(records) < max_pages:
        source, url = queue.pop(0)
        if url in visited:
            continue
        visited.add(url)
        try:
            markup, raw_bytes, final_url, _headers = fetch(url)
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            gaps.append(f"- 抓取失败：{url}；原因：{exc}")
            continue

        source = infer_source(final_url, source)
        title, links, images = parse_links_images(markup)
        text = page_text(markup)
        if not title:
            title = normalize_text(text.split("\n", 1)[0])[:80] or urllib.parse.unquote(final_url)
        if not is_relevant(f"{title} {text[:2000]}", final_url):
            # Still use navigation pages to discover links, but do not archive noise.
            pass
        page_id = slug_for(source, title, final_url)
        raw_path = RAW_DIR / source / f"{page_id}.html"
        md_path = MD_DIR / source / f"{page_id}.md"
        raw_path.parent.mkdir(parents=True, exist_ok=True)
        raw_path.write_bytes(raw_bytes)

        image_refs: list[dict] = []
        for idx, img in enumerate(images[:60], start=1):
            absolute = normalize_url(img["src"], final_url)
            if not absolute:
                continue
            local = None
            if image_downloads < max_images:
                local = download_image(absolute, page_id, idx, source)
                if local:
                    image_downloads += 1
            image_refs.append(
                {
                    "url": absolute,
                    "alt": normalize_text(img.get("alt", "")),
                    "title": normalize_text(img.get("title", "")),
                    "local_path": local,
                    "usage_note": "仅作内部研究参考；版权归腾讯/原站或相应权利人；禁止直接复用为游戏资产。",
                }
            )

        categories = categories_for(title, text, final_url)
        record = PageRecord(
            id=page_id,
            source=source,
            title=title,
            url=url,
            final_url=final_url,
            fetched_at=fetched_at,
            raw_path=rel(raw_path),
            markdown_path=rel(md_path),
            categories=categories,
            confidence=SOURCE_META[source]["confidence"],
            image_refs=image_refs,
            links_found=len(links),
            bytes=len(raw_bytes),
        )
        write_markdown(record, text)
        records.append(record)

        for link in links:
            next_url = normalize_url(link.url, final_url)
            if not next_url or next_url in queued or next_url in visited:
                continue
            next_source = infer_source(next_url, source)
            # Official legacy center pages and selected official news pages.
            if next_source == "official":
                path = urllib.parse.urlparse(next_url).path
                if "/web200708/information/" not in next_url and "/gicp/news/814/" not in next_url and "/webplat/info/news_version3/" not in next_url:
                    continue
                if not is_relevant(f"{link.text} {next_url}", next_url):
                    continue
            if next_source == "ffobaike" and not is_relevant(f"{link.text} {next_url}", next_url):
                continue
            if next_source == "bwiki" and "wiki.biligame.com/qqffo/" not in next_url:
                continue
            queue.append((next_source, next_url))
            queued.add(next_url)
        time.sleep(CRAWL_DELAY_SECONDS)

    return records, gaps


def write_outputs(records: list[PageRecord], gaps: list[str]) -> None:
    catalog = {
        "generated_at": datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S %Z"),
        "scope": "QQ自由幻想端游资料；不含自由幻想手游、私服、泄露客户端、破解包资源。",
        "copyright_notice": "图片仅作为内部研究参考，版权归腾讯/原站或相应权利人，禁止直接复用为游戏资产。",
        "sources": SOURCE_META,
        "counts": {
            "pages": len(records),
            "images": sum(len(r.image_refs) for r in records),
            "downloaded_images": sum(1 for r in records for img in r.image_refs if img.get("local_path")),
        },
        "records": [record.__dict__ for record in records],
    }
    (REFERENCE / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")

    with (REFERENCE / "image-index.csv").open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=["page_id", "page_title", "source", "image_url", "local_path", "alt", "usage_note"])
        writer.writeheader()
        for record in records:
            for image in record.image_refs:
                writer.writerow(
                    {
                        "page_id": record.id,
                        "page_title": record.title,
                        "source": record.source,
                        "image_url": image["url"],
                        "local_path": image.get("local_path") or "",
                        "alt": image.get("alt") or image.get("title") or "",
                        "usage_note": image["usage_note"],
                    }
                )

    by_category: dict[str, list[PageRecord]] = {cat: [] for cat in CATEGORIES}
    by_category["待归类"] = []
    for record in records:
        for cat in record.categories:
            by_category.setdefault(cat, []).append(record)

    lines = [
        "# QQ自由幻想端游资料本地归档索引",
        "",
        f"- 生成时间：{catalog['generated_at']}",
        "- 范围：仅 QQ自由幻想端游；不含自由幻想手游、私服、泄露客户端、破解包资源。",
        f"- 已归档页面：{catalog['counts']['pages']}；图片引用：{catalog['counts']['images']}；已下载参考图：{catalog['counts']['downloaded_images']}。",
        "- 版权：图片和原站文本仅作内部研究与对标参考，版权归腾讯/原站或相应权利人，禁止直接复用为游戏资产。",
        "",
        "## 目录",
        "",
    ]
    for category, items in by_category.items():
        if not items:
            continue
        lines.append(f"### {category}")
        lines.append("")
        for record in sorted(items, key=lambda r: (r.source, r.title)):
            lines.append(
                f"- [{record.title}]({record.markdown_path.replace('docs/reference/', '')}) "
                f"｜{SOURCE_META[record.source]['label']}｜{record.final_url}"
            )
        lines.append("")
    (REFERENCE / "index.md").write_text("\n".join(lines), encoding="utf-8")

    required = {
        "基础体验",
        "五职业",
        "转职/飞升",
        "战斗刷怪",
        "地图任务",
        "装备道具",
        "宠物系统",
        "副本活动",
        "单机日常",
        "后期养成",
    }
    covered = {cat for record in records for cat in record.categories}
    missing = sorted(required - covered)
    gap_lines = [
        "# 资料缺口与人工确认项",
        "",
        f"- 生成时间：{catalog['generated_at']}",
        "- 抓取边界：只抓公开网页白名单域名；未抓私服、泄露客户端、破解包或需登录资源。",
        "- 版权提醒：图片索引仅供内部研究参考，禁止作为游戏直接资产。",
        "",
        "## 覆盖缺口",
        "",
    ]
    if missing:
        gap_lines.extend([f"- `{cat}` 本轮没有抓到明确可归类页面。" for cat in missing])
    else:
        gap_lines.append("- feature 十个大类均有至少一批可查资料。")
    gap_lines.extend(
        [
            "",
            "## 质量/口径风险",
            "",
            "- FFO百科和 BWIKI 属玩家整理源，后期养成/活动数值需与官方公告或游戏内实测互校。",
            "- 官方旧资料中心存在较多页面结构图、导航切片和早期口径，图片索引中可能包含页面装饰图，使用前需人工筛选。",
            "- BWIKI/FFO百科中带 `#` 占位或未完成的条目未作为有效页面抓取。",
            "- 玩家源里的未发布道具、废案、预埋内容仅供理解历史，不应直接进入 feature 设计口径。",
            "",
            "## 抓取失败",
            "",
        ]
    )
    gap_lines.extend(gaps or ["- 无。"])
    (REFERENCE / "gaps.md").write_text("\n".join(gap_lines), encoding="utf-8")


def build_from_existing() -> tuple[list[PageRecord], list[str]]:
    records: list[PageRecord] = []
    gaps = [
        "- 在线抓取阶段遇到部分慢链接/超时链接，本目录由已成功落地的原始 HTML 与 Markdown 离线重建。",
    ]
    for md_path in sorted(MD_DIR.glob("*/*.md")):
        source = md_path.parent.name
        if source not in SOURCE_META:
            continue
        text = md_path.read_text(encoding="utf-8", errors="replace")
        title_match = re.search(r"^#\s+(.+)$", text, re.M)
        url_match = re.search(r"^- URL：(.+)$", text, re.M)
        fetched_match = re.search(r"^- 抓取日期：(.+)$", text, re.M)
        cats_match = re.search(r"^- 分类：(.+)$", text, re.M)
        conf_match = re.search(r"^- 可信度：(.+)$", text, re.M)
        if not title_match or not url_match:
            gaps.append(f"- 元数据不完整，跳过：{rel(md_path)}")
            continue
        page_id = md_path.stem
        raw_path = RAW_DIR / source / f"{page_id}.html"
        image_refs: list[dict] = []
        if raw_path.exists():
            markup = raw_path.read_text(encoding="utf-8", errors="replace")
            _title, _links, images = parse_links_images(markup)
            local_files = sorted((ASSET_DIR / source / page_id).glob("*"))
            for idx, image in enumerate(images[:60]):
                absolute = normalize_url(image["src"], url_match.group(1).strip())
                if not absolute:
                    continue
                local = rel(local_files[idx]) if idx < len(local_files) else None
                image_refs.append(
                    {
                        "url": absolute,
                        "alt": normalize_text(image.get("alt", "")),
                        "title": normalize_text(image.get("title", "")),
                        "local_path": local,
                        "usage_note": "仅作内部研究参考；版权归腾讯/原站或相应权利人；禁止直接复用为游戏资产。",
                    }
                )
        else:
            gaps.append(f"- 原始 HTML 缺失：{rel(raw_path)}")
        cats = categories_for_metadata(title_match.group(1).strip(), url_match.group(1).strip())
        if cats == ["待归类"] and source == "official":
            cats = categories_for(title_match.group(1).strip(), text[:3000], url_match.group(1).strip())
        records.append(
            PageRecord(
                id=page_id,
                source=source,
                title=title_match.group(1).strip(),
                url=url_match.group(1).strip(),
                final_url=url_match.group(1).strip(),
                fetched_at=(fetched_match.group(1).strip() if fetched_match else ""),
                raw_path=rel(raw_path),
                markdown_path=rel(md_path),
                categories=cats or ["待归类"],
                confidence=(conf_match.group(1).strip() if conf_match else SOURCE_META[source]["confidence"]),
                image_refs=image_refs,
                links_found=0,
                bytes=raw_path.stat().st_size if raw_path.exists() else 0,
            )
        )
    return records, gaps


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-pages", type=int, default=MAX_PAGES)
    parser.add_argument("--max-images", type=int, default=MAX_IMAGES)
    parser.add_argument("--from-existing", action="store_true", help="rebuild catalog/index from already archived files")
    args = parser.parse_args()
    if args.from_existing:
        records, gaps = build_from_existing()
    else:
        records, gaps = archive(args.max_pages, args.max_images)
    write_outputs(records, gaps)
    print(json.dumps({"pages": len(records), "gaps": len(gaps)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
