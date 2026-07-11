#!/usr/bin/env python3
"""Localize QQ FFO art reference images for offline research.

The downloaded files are for internal reference only. They must not be reused as
game assets.
"""

from __future__ import annotations

import csv
import hashlib
import json
import mimetypes
import re
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, asdict
from datetime import datetime, timezone, timedelta
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "docs" / "reference"
ASSET_ROOT = REFERENCE / "assets" / "localized"
ART_ROOT = REFERENCE / "art"
CATALOG_PATH = REFERENCE / "catalog.json"
PET_CATALOG_PATH = REFERENCE / "structured" / "pet_catalog_ffobaike.json"
PET_SKILL_HTML = REFERENCE / "raw" / "bwiki" / "bwiki-宠物技能.html"
OFFICIAL_DEEP = REFERENCE / "raw" / "official_deep"

CST = timezone(timedelta(hours=8))
TODAY = datetime.now(CST).strftime("%Y-%m-%d")

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

COPYRIGHT_NOTE = (
    "仅作内部研究、风格分析和功能对标参考；版权归腾讯/原站或相应权利人，"
    "禁止直接复用为游戏资产。"
)

OFFICIAL_SELECTED_PAGES = {
    "1_5.htm.html": ("role_character", "官方职业介绍"),
    "2_2.htm.html": ("map_scene", "官方地图一览"),
    "2_4.htm.html": ("map_scene", "官方怪物图鉴"),
    "2_5.htm.html": ("quest_scene", "官方任务列表"),
    "3_1.htm.html": ("equipment_item", "官方装备系统"),
    "3_2.htm.html": ("skill_system", "官方技能系统"),
    "3_3.htm.html": ("pet_system", "官方宠物系统"),
    "4_1.htm.html": ("dungeon_activity", "官方平行世界"),
}

BWIKI_EXTRA_PAGES = {
    "基础装备": ("equipment_item", "BWIKI 基础装备"),
    "装备觉醒": ("equipment_item", "BWIKI 装备觉醒"),
    "宠物道具": ("equipment_item", "BWIKI 宠物道具"),
    "幻神技能": ("skill_icon", "BWIKI 幻神技能"),
}

DECORATIVE_HINTS = (
    "shop_",
    "information_",
    "imformation_",
    "information_top",
    "information_line",
    "client_content_",
    "content_",
    "top_",
    "menu",
    "nav",
    "logo",
    "btn",
    "button",
    "line",
    "dot",
    "bg",
)


@dataclass
class Candidate:
    category: str
    name: str
    image_url: str
    source_url: str
    source_name: str
    source_type: str
    source_page: str = ""
    alt: str = ""
    title: str = ""
    confidence: str = "medium"


class ImageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.images: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "img":
            return
        item = {k.lower(): v or "" for k, v in attrs}
        if item.get("src"):
            self.images.append(item)


def safe_name(text: str, fallback: str = "image") -> str:
    text = urllib.parse.unquote(text or "").strip()
    text = re.sub(r"[\\/:*?\"<>|#%&=+{}$!@`~\s]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-._")
    return (text or fallback)[:80]


def absolutize(src: str, base_url: str) -> str:
    src = src.strip()
    if src.startswith("//"):
        return "https:" + src
    return urllib.parse.urljoin(base_url, src)


def ext_from_response(url: str, content_type: str, data: bytes) -> str:
    path_ext = Path(urllib.parse.urlparse(url).path).suffix.lower()
    if path_ext in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".apng", ".bmp"}:
        return path_ext
    guessed = mimetypes.guess_extension(content_type.split(";")[0].strip())
    if guessed:
        return ".jpg" if guessed == ".jpe" else guessed
    if data.startswith(b"\x89PNG"):
        return ".png"
    if data.startswith(b"\xff\xd8"):
        return ".jpg"
    if data.startswith(b"GIF"):
        return ".gif"
    return ".bin"


def is_image_bytes(path: Path) -> bool:
    if not path.exists() or path.stat().st_size < 40:
        return False
    head = path.read_bytes()[:16]
    return (
        head.startswith(b"\x89PNG")
        or head.startswith(b"\xff\xd8")
        or head.startswith(b"GIF")
        or head.startswith(b"RIFF")
        or head.startswith(b"BM")
    )


def is_image_payload(content_type: str, data: bytes) -> bool:
    head = data[:16]
    return content_type.lower().startswith("image/") or (
        head.startswith(b"\x89PNG")
        or head.startswith(b"\xff\xd8")
        or head.startswith(b"GIF")
        or head.startswith(b"RIFF")
        or head.startswith(b"BM")
    )


def looks_decorative(url: str, width: str = "", height: str = "") -> bool:
    path = urllib.parse.urlparse(url).path.lower()
    filename = Path(path).name
    if any(hint in filename for hint in DECORATIVE_HINTS):
        return True
    try:
        w = int(width or 0)
        h = int(height or 0)
    except ValueError:
        return False
    return (w <= 30 or h <= 30) and "character" not in path


def classify_catalog_image(record: dict, image: dict) -> str:
    hay = " ".join(
        [
            record.get("title", ""),
            record.get("url", ""),
            " ".join(record.get("categories", [])),
            image.get("alt", ""),
            image.get("title", ""),
            image.get("url", ""),
        ]
    ).lower()
    if any(k in hay for k in ["pet/", "宠物", "petcircle", "animated-pet"]):
        return "pet_system"
    if any(k in hay for k in ["技能", "skill", "符文"]):
        return "skill_icon"
    if any(k in hay for k in ["地图", "map", "clymapsl", "yunhuang-map", "坐标"]):
        return "map_scene"
    if any(k in hay for k in ["装备", "千幻", "觉醒", "翅膀", "龙翼", "典籍", "法宝", "poker", "qianhuan", "awake", "diaohua", "longyi"]):
        return "equipment_item"
    if any(k in hay for k in ["职业", "角色", "五职业", "character"]):
        return "role_character"
    if any(k in hay for k in ["副本", "活动", "试炼", "通天塔", "珍珠海域", "困龙渊", "战场", "平行世界", "act/"]):
        return "dungeon_activity"
    return "ui_reference"


def load_catalog_candidates() -> list[Candidate]:
    if not CATALOG_PATH.exists():
        return []
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    candidates: list[Candidate] = []
    for record in catalog.get("records", []):
        for image in record.get("image_refs", []):
            url = image.get("url") or image.get("src")
            if not url:
                continue
            category = classify_catalog_image(record, image)
            alt = image.get("alt", "") or image.get("title", "")
            name = alt or record.get("title", "") or Path(urllib.parse.urlparse(url).path).stem
            candidates.append(
                Candidate(
                    category=category,
                    name=name,
                    image_url=url,
                    source_url=record.get("url", ""),
                    source_name=record.get("title", ""),
                    source_type=record.get("source", "catalog"),
                    source_page=record.get("raw_path", ""),
                    alt=image.get("alt", ""),
                    title=image.get("title", ""),
                    confidence="high" if category != "ui_reference" else "low",
                )
            )
    return candidates


def load_pet_candidates() -> list[Candidate]:
    if not PET_CATALOG_PATH.exists():
        return []
    data = json.loads(PET_CATALOG_PATH.read_text(encoding="utf-8"))
    pets = data.get("list", [])
    candidates: list[Candidate] = []
    for pet in pets:
        uid = pet.get("uid")
        image_id = pet.get("id")
        if not image_id:
            continue
        name = pet.get("name") or f"pet-{image_id}"
        candidates.append(
            Candidate(
                category="pet_character",
                name=f"{uid}-{name}",
                image_url=f"https://cdn.ffobaike.com/pet/m{image_id}.png",
                source_url="https://www.ffobaike.com/lookup/pet-cheatsheet.html",
                source_name="FFO百科宠物图鉴",
                source_type="FFO百科",
                confidence="high",
            )
        )
    return candidates


def load_bwiki_skill_icon_candidates() -> list[Candidate]:
    if not PET_SKILL_HTML.exists():
        return []
    html = PET_SKILL_HTML.read_text(encoding="utf-8", errors="ignore")
    parser = ImageParser()
    parser.feed(html)
    candidates: list[Candidate] = []
    for image in parser.images:
        src = absolutize(image["src"], "https://wiki.biligame.com/qqffo/宠物技能")
        alt = image.get("alt", "") or Path(urllib.parse.urlparse(src).path).stem
        if "patchwiki.biligame.com" not in src:
            continue
        if not alt or alt in {"QQ自由幻想WIKI", "QQ自由幻想"}:
            continue
        candidates.append(
            Candidate(
                category="skill_icon",
                name=alt,
                image_url=src,
                source_url="https://wiki.biligame.com/qqffo/宠物技能",
                source_name="BWIKI 宠物技能",
                source_type="BWIKI",
                source_page=str(PET_SKILL_HTML.relative_to(ROOT)),
                alt=alt,
                confidence="high",
            )
        )
    return candidates


def fetch_text(url: str) -> str:
    command = [
        "curl",
        "-L",
        "--silent",
        "--show-error",
        "--max-time",
        "12",
        "--connect-timeout",
        "5",
        "-A",
        USER_AGENT,
        url,
    ]
    result = subprocess.run(command, capture_output=True, check=False, timeout=14)
    if result.returncode != 0:
        return ""
    return result.stdout.decode("utf-8", errors="ignore")


def load_bwiki_extra_candidates() -> list[Candidate]:
    raw_dir = REFERENCE / "raw" / "bwiki"
    raw_dir.mkdir(parents=True, exist_ok=True)
    candidates: list[Candidate] = []
    for page_name, (category, source_name) in BWIKI_EXTRA_PAGES.items():
        encoded = urllib.parse.quote(page_name)
        url = f"https://wiki.biligame.com/qqffo/{encoded}"
        raw_path = raw_dir / f"bwiki-art-{safe_name(page_name)}.html"
        if raw_path.exists():
            html = raw_path.read_text(encoding="utf-8", errors="ignore")
        else:
            html = fetch_text(url)
            if html:
                raw_path.write_text(html, encoding="utf-8")
        if not html:
            continue
        parser = ImageParser()
        parser.feed(html)
        for image in parser.images:
            src = absolutize(image["src"], url)
            if "patchwiki.biligame.com" not in src:
                continue
            alt = image.get("alt", "") or image.get("title", "")
            name = alt or Path(urllib.parse.urlparse(src).path).stem
            if not name or name in {"QQ自由幻想WIKI", "QQ自由幻想"}:
                continue
            candidates.append(
                Candidate(
                    category=category,
                    name=name,
                    image_url=src,
                    source_url=url,
                    source_name=source_name,
                    source_type="BWIKI",
                    source_page=str(raw_path.relative_to(ROOT)),
                    alt=alt,
                    title=image.get("title", ""),
                    confidence="high",
                )
            )
    return candidates


def load_official_candidates() -> list[Candidate]:
    candidates: list[Candidate] = []
    for filename, (default_category, source_name) in OFFICIAL_SELECTED_PAGES.items():
        path = OFFICIAL_DEEP / filename
        if not path.exists():
            continue
        html = path.read_text(encoding="utf-8", errors="ignore")
        parser = ImageParser()
        parser.feed(html)
        source_url = f"https://ffo.qq.com/web200708/information/{filename.removesuffix('.html')}"
        for image in parser.images:
            url = absolutize(image["src"], source_url)
            width, height = image.get("width", ""), image.get("height", "")
            category = default_category
            confidence = "high"
            if looks_decorative(url, width, height):
                category = "ui_reference"
                confidence = "low"
            elif "character/" in url.lower():
                category = "role_character"
            elif "webpic" in url.lower() or "map" in url.lower():
                category = "map_scene"
            elif "spic" in url.lower() and default_category == "skill_system":
                category = "skill_system"
            name = image.get("alt", "") or Path(urllib.parse.urlparse(url).path).stem
            candidates.append(
                Candidate(
                    category=category,
                    name=name,
                    image_url=url,
                    source_url=source_url,
                    source_name=source_name,
                    source_type="官方端游资料中心",
                    source_page=str(path.relative_to(ROOT)),
                    alt=image.get("alt", ""),
                    title=image.get("title", ""),
                    confidence=confidence,
                )
            )
    return candidates


def dedupe(candidates: Iterable[Candidate]) -> list[Candidate]:
    seen: dict[str, Candidate] = {}
    priority = {
        "pet_character": 9,
        "skill_icon": 8,
        "role_character": 7,
        "map_scene": 6,
        "equipment_item": 6,
        "skill_system": 5,
        "pet_system": 5,
        "dungeon_activity": 4,
        "quest_scene": 4,
        "ui_reference": 1,
    }
    for candidate in candidates:
        key = candidate.image_url
        if key not in seen or priority.get(candidate.category, 0) > priority.get(seen[key].category, 0):
            seen[key] = candidate
    return list(seen.values())


def request_image(url: str, referer: str) -> tuple[bytes, str]:
    command = [
        "curl",
        "-L",
        "--silent",
        "--show-error",
        "--max-time",
        "8",
        "--connect-timeout",
        "4",
        "-A",
        USER_AGENT,
        "-H",
        "Accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "-H",
        f"Referer: {referer or 'https://ffo.qq.com/'}",
        "-w",
        "\n%{content_type}",
        url,
    ]
    result = subprocess.run(command, capture_output=True, check=False, timeout=10)
    if result.returncode != 0:
        message = result.stderr.decode("utf-8", errors="ignore").strip()
        raise RuntimeError(message or f"curl exit {result.returncode}")
    payload, sep, content_type = result.stdout.rpartition(b"\n")
    if not sep:
        raise RuntimeError("curl response missing content type trailer")
    return payload, content_type.decode("utf-8", errors="ignore")


def download(candidate: Candidate, index: int) -> dict:
    url_hash = hashlib.sha1(candidate.image_url.encode("utf-8")).hexdigest()[:10]
    base = safe_name(candidate.name, f"image-{index}")
    category_dir = ASSET_ROOT / candidate.category
    category_dir.mkdir(parents=True, exist_ok=True)
    provisional = category_dir / f"{index:04d}-{base}-{url_hash}"
    row = asdict(candidate)
    row.update(
        {
            "id": f"{candidate.category}-{index:04d}-{url_hash}",
            "crawl_date": TODAY,
            "copyright_note": COPYRIGHT_NOTE,
            "status": "pending",
            "local_path": "",
            "bytes": 0,
            "content_type": "",
            "error": "",
        }
    )
    existing = list(category_dir.glob(f"*-{base}-{url_hash}.*"))
    if existing:
        path = existing[0]
        if not is_image_bytes(path):
            path.unlink()
        else:
            row.update(
                {
                    "status": "exists",
                    "local_path": str(path.relative_to(ROOT)),
                    "bytes": path.stat().st_size,
                    "content_type": mimetypes.guess_type(path.name)[0] or "",
                }
            )
            return row
    existing = []
    for attempt in range(2):
        try:
            data, content_type = request_image(candidate.image_url, candidate.source_url)
            if not is_image_payload(content_type, data):
                raise ValueError(f"not an image: {content_type or 'unknown content type'}")
            if len(data) < 40:
                raise ValueError(f"too small: {len(data)} bytes")
            ext = ext_from_response(candidate.image_url, content_type, data)
            path = provisional.with_suffix(ext)
            path.write_bytes(data)
            row.update(
                {
                    "status": "downloaded",
                    "local_path": str(path.relative_to(ROOT)),
                    "bytes": len(data),
                    "content_type": content_type,
                }
            )
            return row
        except Exception as exc:  # noqa: BLE001
            row["error"] = f"{type(exc).__name__}: {exc}"
            if attempt == 0:
                time.sleep(0.4)
    row["status"] = "failed"
    return row


def write_outputs(rows: list[dict]) -> None:
    ART_ROOT.mkdir(parents=True, exist_ok=True)
    rows = sorted(rows, key=lambda r: (r["category"], r["name"], r["image_url"]))
    (ART_ROOT / "catalog.json").write_text(
        json.dumps(
            {
                "generated_at": datetime.now(CST).isoformat(timespec="seconds"),
                "scope": "QQ自由幻想端游美术参考图；不含手游、私服、客户端泄露/破解资源。",
                "copyright_notice": COPYRIGHT_NOTE,
                "records": rows,
                "counts": counts(rows),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    with (ART_ROOT / "image-index.csv").open("w", encoding="utf-8", newline="") as fh:
        fieldnames = [
            "id",
            "category",
            "name",
            "source_type",
            "source_name",
            "source_url",
            "image_url",
            "local_path",
            "status",
            "bytes",
            "confidence",
            "crawl_date",
            "copyright_note",
            "error",
        ]
        writer = csv.DictWriter(fh, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    write_markdown_index(rows)
    write_gaps(rows)


def counts(rows: list[dict]) -> dict:
    out = {
        "total_records": len(rows),
        "localized_files": sum(1 for r in rows if r["status"] in {"downloaded", "exists"}),
        "failed": sum(1 for r in rows if r["status"] == "failed"),
        "by_category": {},
    }
    for row in rows:
        bucket = out["by_category"].setdefault(row["category"], {"records": 0, "localized": 0, "failed": 0})
        bucket["records"] += 1
        if row["status"] in {"downloaded", "exists"}:
            bucket["localized"] += 1
        if row["status"] == "failed":
            bucket["failed"] += 1
    return out


def write_markdown_index(rows: list[dict]) -> None:
    c = counts(rows)
    lines = [
        "# QQ自由幻想端游美术参考图本地索引",
        "",
        f"- 生成日期：{TODAY}",
        "- 范围：仅 QQ自由幻想端游公开网页资料；不含自由幻想手游、私服、泄露客户端、破解包资源。",
        f"- 版权与使用限制：{COPYRIGHT_NOTE}",
        f"- 总记录：{c['total_records']}；已本地化：{c['localized_files']}；失败：{c['failed']}。",
        "",
        "## 分类统计",
        "",
        "| 分类 | 记录 | 已本地化 | 失败 | 目录 |",
        "| --- | ---: | ---: | ---: | --- |",
    ]
    for category, bucket in sorted(c["by_category"].items()):
        lines.append(
            f"| {category} | {bucket['records']} | {bucket['localized']} | {bucket['failed']} | "
            f"`docs/reference/assets/localized/{category}/` |"
        )
    lines += [
        "",
        "## 机器可读索引",
        "",
        "- `docs/reference/art/catalog.json`：完整图片条目，含来源 URL、抓取日期、可信度、版权说明、本地路径。",
        "- `docs/reference/art/image-index.csv`：便于表格筛选的图片目录。",
        "- `docs/reference/art/gaps.md`：下载失败、来源不完整、需人工复核项。",
        "",
        "## 快速查看",
        "",
        "以下每类列出前 12 条已本地化图片，完整列表见 CSV/JSON。",
    ]
    for category in sorted(c["by_category"]):
        subset = [r for r in rows if r["category"] == category and r["local_path"]][:12]
        lines += ["", f"### {category}", ""]
        if not subset:
            lines.append("- 暂无本地化图片。")
            continue
        for row in subset:
            lines.append(
                f"- {row['name']} ｜ `{row['local_path']}` ｜ 来源：{row['source_type']} {row['source_url']}"
            )
    (ART_ROOT / "index.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_gaps(rows: list[dict]) -> None:
    failed = [r for r in rows if r["status"] == "failed"]
    low = [r for r in rows if r["confidence"] == "low" and r["status"] in {"downloaded", "exists"}]
    lines = [
        "# 美术参考图缺口与复核记录",
        "",
        f"- 生成日期：{TODAY}",
        f"- 使用限制：{COPYRIGHT_NOTE}",
        "",
        "## 下载失败",
        "",
    ]
    if failed:
        for row in failed:
            lines.append(
                f"- [{row['category']}] {row['name']} ｜ {row['image_url']} ｜ 来源：{row['source_url']} ｜ 错误：{row['error']}"
            )
    else:
        lines.append("- 本轮无下载失败。")
    lines += [
        "",
        "## 需人工复核",
        "",
        "- `ui_reference` 多为官网页面装修、按钮、分隔线等网页视觉碎片，不应作为地图/角色/装备原图使用。",
        "- `pet_character` 中 APNG 为百科动画引用，静态 PNG 仍是优先查看对象；是否采用动画帧做动作参考需后续人工判定。",
        "- BWIKI/百科/官网图片均只用于研究与对标，后续产品美术需原创重绘。",
    ]
    if low:
        lines += ["", "### 低可信度图片样例", ""]
        for row in low[:40]:
            lines.append(f"- {row['name']} ｜ `{row['local_path']}` ｜ {row['image_url']}")
    (ART_ROOT / "gaps.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    candidates = dedupe(
        [
            *load_catalog_candidates(),
            *load_pet_candidates(),
            *load_bwiki_skill_icon_candidates(),
            *load_bwiki_extra_candidates(),
            *load_official_candidates(),
        ]
    )
    rows: list[dict] = []
    for idx, candidate in enumerate(candidates, 1):
        rows.append(download(candidate, idx))
        if idx % 100 == 0:
            print(f"processed {idx}/{len(candidates)}")
    write_outputs(rows)
    print(json.dumps(counts(rows), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
