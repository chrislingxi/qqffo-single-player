#!/usr/bin/env python3
"""Localize images referenced by feature entity pages.

Images are saved for internal research reference only. They must not be used as
game assets.
"""

from __future__ import annotations

import base64
import csv
import hashlib
import json
import mimetypes
import re
import subprocess
import sys
from dataclasses import asdict, dataclass
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlparse


ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / "docs" / "reference"
RAW = REF / "raw" / "ffobaike_entity"
OUT = REF / "assets" / "entity_localized"
ENTITY = REF / "entities"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X) Codex FFO entity image localizer/1.0"
EXCLUDED_STEMS = {
    "lookup-unreleased-item",  # 废案道具，不属于当前 feature 美术基线。
}


@dataclass
class ImageRecord:
    source_page: str
    source_file: str
    category: str
    alt: str
    source_url: str
    local_path: str
    status: str
    bytes: int
    sha256: str
    copyright_note: str
    error: str = ""


class ImageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.images: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "img":
            return
        row = {k.lower(): v or "" for k, v in attrs}
        src = row.get("src") or row.get("data-src") or row.get("data-original") or ""
        if src:
            self.images.append({"src": src, "alt": row.get("alt", ""), "title": row.get("title", "")})


def safe_name(value: str, fallback: str = "image") -> str:
    value = value.strip().replace(".html", "")
    value = re.sub(r"[^0-9A-Za-z\u4e00-\u9fff._-]+", "-", value).strip("-")
    return value[:90] or fallback


def page_url_from_file(path: Path) -> str:
    stem = path.stem
    if stem.startswith("system-skills-"):
        return "https://www.ffobaike.com/system/skills/" + stem.removeprefix("system-skills-") + ".html"
    if "-" in stem:
        first, rest = stem.split("-", 1)
        return f"https://www.ffobaike.com/{first}/{rest}.html"
    return f"https://www.ffobaike.com/{stem}.html"


def category_for(raw_file: Path, alt: str) -> str:
    stem = raw_file.stem
    if stem.startswith("pworld-"):
        if "地图" in alt:
            return "dungeon_map"
        if any(word in alt for word in ["套装", "装备", "翅膀", "外套"]):
            return "dungeon_reward_equipment"
        return "dungeon_boss_or_monster"
    if stem.startswith("act-"):
        return "daily_activity"
    if stem.startswith("lookup-arm") or "装备" in alt or "套装" in alt:
        return "equipment_item"
    if stem.startswith("lookup-item"):
        return "item_icon"
    if stem.startswith("system-"):
        return "late_system"
    return "misc"


def extension_from(src: str, content_type: str, data_prefix: str = "") -> str:
    if data_prefix:
        guessed = mimetypes.guess_extension(data_prefix.split(";")[0].replace("data:", ""))
        return guessed or ".bin"
    parsed = urlparse(src)
    suffix = Path(parsed.path).suffix
    if suffix and len(suffix) <= 6:
        return suffix
    return mimetypes.guess_extension(content_type.split(";")[0]) or ".bin"


def fetch_bytes(url: str) -> tuple[bytes, str]:
    result = subprocess.run(
        ["curl", "-L", "--silent", "--show-error", "--max-time", "7", "--connect-timeout", "4", "-A", UA, "-D", "-", url],
        capture_output=True,
        check=False,
        timeout=9,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode("utf-8", errors="ignore") or f"curl exit {result.returncode}")
    blob = result.stdout
    marker = b"\r\n\r\n"
    if marker not in blob:
        return blob, ""
    headers, body = blob.rsplit(marker, 1)
    content_type = ""
    for line in headers.decode("iso-8859-1", errors="ignore").splitlines():
        if line.lower().startswith("content-type:"):
            content_type = line.split(":", 1)[1].strip()
    return body, content_type


def decode_data_uri(src: str) -> tuple[bytes, str]:
    prefix, payload = src.split(",", 1)
    if ";base64" not in prefix:
        raise ValueError("unsupported non-base64 data URI")
    return base64.b64decode(payload), prefix


def localize_one(raw_file: Path, source_page: str, src: str, alt: str, index: int) -> ImageRecord:
    category = category_for(raw_file, alt)
    category_dir = OUT / category / raw_file.stem
    category_dir.mkdir(parents=True, exist_ok=True)
    source_url = src if src.startswith("data:") else urljoin(source_page, src)
    try:
        if src.startswith("data:"):
            data, prefix = decode_data_uri(src)
            ext = extension_from(src, "", prefix)
        else:
            data, content_type = fetch_bytes(source_url)
            ext = extension_from(source_url, content_type)
        digest = hashlib.sha256(data).hexdigest()
        filename = f"{index:03d}-{safe_name(alt or Path(urlparse(src).path).stem, 'image')}-{digest[:10]}{ext}"
        local_path = category_dir / filename
        if not local_path.exists():
            local_path.write_bytes(data)
        status = "ok" if len(data) > 200 else "too_small"
        return ImageRecord(
            source_page=source_page,
            source_file=str(raw_file.relative_to(ROOT)),
            category=category,
            alt=alt,
            source_url=source_url if not source_url.startswith("data:") else "data-uri-in-page",
            local_path=str(local_path.relative_to(ROOT)),
            status=status,
            bytes=len(data),
            sha256=digest,
            copyright_note="仅供内部研究参考；版权归腾讯/原站点及原作者所有，禁止直接复用为游戏资产。",
        )
    except Exception as exc:  # noqa: BLE001 - archive audit should keep going
        return ImageRecord(
            source_page=source_page,
            source_file=str(raw_file.relative_to(ROOT)),
            category=category,
            alt=alt,
            source_url=source_url if not source_url.startswith("data:") else "data-uri-in-page",
            local_path="",
            status="failed",
            bytes=0,
            sha256="",
            copyright_note="仅供内部研究参考；版权归腾讯/原站点及原作者所有，禁止直接复用为游戏资产。",
            error=str(exc),
        )


def main() -> None:
    ENTITY.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    records: list[ImageRecord] = []
    for raw_file in sorted(RAW.glob("*.html")):
        if raw_file.stem in EXCLUDED_STEMS:
            continue
        parser = ImageParser()
        parser.feed(raw_file.read_text(encoding="utf-8", errors="replace"))
        if not parser.images:
            continue
        source_page = page_url_from_file(raw_file)
        for idx, image in enumerate(parser.images, start=1):
            alt = image.get("alt") or image.get("title") or Path(urlparse(image["src"]).path).stem
            print(f"[{raw_file.stem}] {idx}/{len(parser.images)} {alt}", file=sys.stderr, flush=True)
            records.append(localize_one(raw_file, source_page, image["src"], alt, idx))

    json_path = ENTITY / "entity-image-index.json"
    csv_path = ENTITY / "entity-image-index.csv"
    md_path = ENTITY / "entity-image-index.md"
    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "scope": "FFO百科 feature 实体页图片本地化；仅内部研究参考，禁止直接复用。",
        "records": [asdict(r) for r in records],
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(asdict(records[0]).keys()) if records else ["source_page"])
        writer.writeheader()
        for record in records:
            writer.writerow(asdict(record))
    ok = sum(1 for r in records if r.status == "ok")
    failed = sum(1 for r in records if r.status != "ok")
    lines = [
        "# 实体页图片本地索引",
        "",
        f"- 生成时间：{payload['generated_at']}",
        "- 范围：FFO百科 feature 实体页图片。仅供内部研究参考；版权归腾讯/原站点及原作者所有，禁止直接复用为游戏资产。",
        f"- 图片记录：{len(records)}；OK：{ok}；异常：{failed}。",
        "",
        "| 分类 | 图片 | 来源页 | 本地路径 | 状态 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for r in records:
        lines.append(f"| {r.category} | {r.alt} | {r.source_page} | `{r.local_path}` | {r.status} |")
    md_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"records": len(records), "ok": ok, "non_ok": failed}, ensure_ascii=False))


if __name__ == "__main__":
    main()
