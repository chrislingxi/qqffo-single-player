#!/usr/bin/env python3
"""Deep-localize FFO reference data and run field-level consistency checks."""

from __future__ import annotations

import json
import argparse
import re
import time
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed


ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / "docs" / "reference"
RAW = REF / "raw"
MD = REF / "markdown"
STRUCTURED = REF / "structured"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X) Codex FFO deep archiver/1.0"


class TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "noscript"}:
            self.skip += 1
        if tag in {"p", "div", "tr", "td", "th", "li", "br", "h1", "h2", "h3", "table"}:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript"} and self.skip:
            self.skip -= 1
        if tag in {"p", "div", "tr", "li", "h1", "h2", "h3", "table"}:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.skip:
            self.parts.append(data)


class TableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.in_cell = False
        self.buf: list[str] = []
        self.row: list[str] = []
        self.rows: list[list[str]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"td", "th"}:
            self.in_cell = True
            self.buf = []

    def handle_data(self, data: str) -> None:
        if self.in_cell:
            self.buf.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag in {"td", "th"} and self.in_cell:
            self.row.append(" ".join("".join(self.buf).split()))
            self.in_cell = False
        if tag == "tr" and self.row:
            self.rows.append(self.row)
            self.row = []


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        href = dict(attrs).get("href")
        if href:
            self.links.append(href)


def fetch(url: str, *, binary: bool = False, timeout: int = 25) -> bytes | str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Referer": "https://www.ffobaike.com/lookup/pet-cheatsheet.html",
            "Origin": "https://www.ffobaike.com",
            "Accept": "application/json,text/html,application/xhtml+xml,*/*",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
        ctype = resp.headers.get("Content-Type", "")
    if binary:
        return data
    enc = "utf-8"
    m = re.search(r"charset=([\w.-]+)", ctype, re.I)
    if m:
        enc = m.group(1)
    else:
        head = data[:4096].decode("ascii", "ignore")
        m = re.search(r"charset=[\"']?([\w.-]+)", head, re.I)
        if m:
            enc = m.group(1)
    for candidate in [enc, "utf-8", "gb18030", "gbk"]:
        try:
            return data.decode(candidate, errors="replace")
        except LookupError:
            continue
    return data.decode("utf-8", errors="replace")


def text_from_html(markup: str) -> str:
    parser = TextParser()
    parser.feed(markup)
    lines = [" ".join(unescape(x).split()) for x in "".join(parser.parts).splitlines()]
    lines = [x for x in lines if x]
    compact: list[str] = []
    for line in lines:
        if not compact or compact[-1] != line:
            compact.append(line)
    return "\n\n".join(compact)


def write_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def slug(path_or_url: str) -> str:
    name = urllib.parse.unquote(Path(urllib.parse.urlparse(path_or_url).path).name or path_or_url)
    return re.sub(r"[^0-9A-Za-z\u4e00-\u9fff._-]+", "-", name).strip("-")


def archive_official_information() -> list[dict]:
    base = "https://ffo.qq.com/web200708/information/"
    queue = [urllib.parse.urljoin(base, "index.shtml")]
    seen: set[str] = set()
    pages: list[dict] = []
    while queue and len(seen) < 240:
        url = queue.pop(0)
        if url in seen:
            continue
        seen.add(url)
        try:
            html = fetch(url)
        except Exception as exc:
            cached = RAW / "official_deep" / f"{slug(url)}.html"
            if cached.exists():
                html = cached.read_text(encoding="utf-8", errors="replace")
            else:
                pages.append({"url": url, "ok": False, "error": str(exc)})
                continue
        raw_path = RAW / "official_deep" / f"{slug(url)}.html"
        md_path = MD / "official_deep" / f"{slug(url)}.md"
        write_text(raw_path, html)
        text = text_from_html(html)
        write_text(
            md_path,
            "\n".join(
                [
                    f"# 官方旧资料页：{urllib.parse.unquote(url)}",
                    "",
                    f"- URL：{url}",
                    f"- 抓取日期：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                    "- 可信度：高，腾讯官方端游旧资料中心。",
                    "",
                    "## 正文抽取",
                    "",
                    text,
                    "",
                ]
            ),
        )
        pages.append({"url": url, "ok": True, "raw_path": str(raw_path.relative_to(ROOT)), "markdown_path": str(md_path.relative_to(ROOT))})
        parser = LinkParser()
        parser.feed(html)
        for href in parser.links:
            nxt = urllib.parse.urljoin(url, href)
            if not nxt.startswith(base):
                continue
            if re.search(r"/\d+(?:_\d+)*\.htm$", urllib.parse.urlparse(nxt).path) and nxt not in seen and nxt not in queue:
                queue.append(nxt)
        time.sleep(0.08)
    write_json(STRUCTURED / "official_information_pages.json", pages)
    return pages


def archive_ffobaike_pet_data(fetch_details: bool = False) -> tuple[list[dict], list[dict], list[dict]]:
    asset_dir = RAW / "ffobaike" / "assets"
    asset_dir.mkdir(parents=True, exist_ok=True)
    pages = {
        "pet_cheatsheet_html": "https://www.ffobaike.com/lookup/pet-cheatsheet.html",
        "pet_level_exp_html": "https://www.ffobaike.com/lookup/pet-level-exp.html",
        "pet_cheatsheet_js": "https://www.ffobaike.com/assets/lookup_pet-cheatsheet.md.Pc2M1g9V.lean.js",
        "pet_level_exp_js": "https://www.ffobaike.com/assets/lookup_pet-level-exp.md.CdwwcARx.lean.js",
        "theme_js": "https://www.ffobaike.com/assets/chunks/theme.46mgmc2C.js",
    }
    downloaded: list[dict] = []
    for key, url in pages.items():
        try:
            data = fetch(url)
            path = asset_dir / f"{key}{'.js' if url.endswith('.js') else '.html'}"
            write_text(path, data)
            downloaded.append({"key": key, "url": url, "ok": True, "path": str(path.relative_to(ROOT))})
        except Exception as exc:
            downloaded.append({"key": key, "url": url, "ok": False, "error": str(exc)})

    pet_list = json.loads(fetch("https://api.ffobaike.com/pet/list"))
    write_json(RAW / "ffobaike" / "api" / "pet-list.json", pet_list)
    def fetch_detail(item: dict) -> tuple[dict | None, dict | None]:
        uid = item.get("uid")
        try:
            detail = json.loads(fetch(f"https://api.ffobaike.com/pet/detail?uid={uid}", timeout=5))
            return {"uid": uid, **detail}, None
        except Exception as exc:
            try:
                detail = json.loads(fetch(f"https://api.ffobaike.com/pet/detail?uid={uid}", timeout=5))
                return {"uid": uid, **detail}, None
            except Exception as exc2:
                return None, {"uid": uid, "name": item.get("name"), "error": str(exc2 or exc)}

    details: list[dict] = []
    failed: list[dict] = []
    if fetch_details:
        executor = ThreadPoolExecutor(max_workers=24)
        futures = [executor.submit(fetch_detail, item) for item in pet_list]
        try:
            for future in as_completed(futures, timeout=150):
                detail, fail = future.result()
                if detail:
                    details.append(detail)
                if fail:
                    failed.append(fail)
        except Exception as exc:
            failed.append({"uid": None, "name": "DETAIL_FETCH_ABORTED", "error": str(exc)})
        finally:
            executor.shutdown(wait=False, cancel_futures=True)
        details.sort(key=lambda row: row.get("uid", 0))
        failed.sort(key=lambda row: row.get("uid") or 0)
    else:
        failed.append(
            {
                "uid": None,
                "name": "DETAIL_FETCH_SKIPPED",
                "error": "宠物详情接口仅补描述/apng_count，默认跳过以保证核心字段本地化闭环；可用 --fetch-pet-details 单独补。",
            }
        )
    write_json(RAW / "ffobaike" / "api" / "pet-details.json", details)
    write_json(STRUCTURED / "pet_catalog_ffobaike.json", {"list": pet_list, "details": details, "failed_details": failed})

    exp_js = (asset_dir / "pet_level_exp_js.js").read_text(encoding="utf-8", errors="replace")
    rows = parse_html_table_rows(exp_js)
    exp_rows = []
    for row in rows:
        if len(row) == 3 and row[0].isdigit():
            exp_rows.append({"level": int(row[0]), "upgrade_exp": int(row[1]), "total_exp": int(row[2])})
    write_json(STRUCTURED / "pet_level_exp_ffobaike.json", exp_rows)
    return downloaded, pet_list, exp_rows


def parse_html_table_rows(markup: str) -> list[list[str]]:
    parser = TableParser()
    parser.feed(markup)
    return parser.rows


def archive_bwiki_pet_skills() -> list[dict]:
    url = "https://wiki.biligame.com/qqffo/%E5%AE%A0%E7%89%A9%E6%8A%80%E8%83%BD"
    html = fetch(url)
    raw_path = RAW / "bwiki" / "bwiki-宠物技能.html"
    md_path = MD / "bwiki" / "bwiki-宠物技能.md"
    write_text(raw_path, html)
    rows = parse_html_table_rows(html)
    skills: list[dict] = []
    for row in rows:
        if len(row) >= 6 and row[0].isdigit():
            skills.append(
                {
                    "learn_level": int(row[0]),
                    "name": row[2],
                    "type": row[3],
                    "max_skill_level": int(row[4]) if row[4].isdigit() else row[4],
                    "effect": row[5],
                    "source_url": url,
                }
            )
    write_json(STRUCTURED / "pet_skills_bwiki.json", skills)
    lines = [
        "# BWIKI 宠物技能",
        "",
        f"- URL：{url}",
        f"- 抓取日期：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "- 可信度：中，玩家维护 BWIKI；用于补官方旧资料未抓到的技能效果表。",
        "",
        "| 学习等级 | 技能 | 类别 | 最高等级 | 效果 |",
        "| --- | --- | --- | --- | --- |",
    ]
    for skill in skills:
        effect = str(skill["effect"]).replace("|", "｜")
        lines.append(f"| {skill['learn_level']} | {skill['name']} | {skill['type']} | {skill['max_skill_level']} | {effect} |")
    write_text(md_path, "\n".join(lines) + "\n")
    return skills


def extract_official_pet_capture_rows() -> list[dict]:
    path = MD / "official_deep" / "3_3.htm.md"
    if not path.exists():
        path = MD / "official" / "official-QQ自由幻想-资料专区-5c0b8d4b.md"
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = [x.strip() for x in text.splitlines() if x.strip()]
    tools = {"捕兽夹", "老君壶", "玉净瓶", "捆仙索", "天地绫", "混天锁夭塔"}
    rows: list[dict] = []
    if "宠物名" not in lines:
        return rows
    body = lines[lines.index("宠物名") + 4 :]
    cur: list[str] = []
    for item in body:
        if item.startswith("宠物喂养") or item.startswith("宠物召唤"):
            break
        cur.append(item)
        if item in tools and cur:
            nums = [x for x in cur[1:-1] if x.isdigit()]
            rows.append(
                {
                    "name": cur[0],
                    "required_player_level": int(nums[0]) if nums else None,
                    "required_reputation": int(nums[1]) if len(nums) > 1 else None,
                    "capture_tool": item,
                    "source_url": "https://ffo.qq.com/web200708/information/3_3.htm",
                }
            )
            cur = []
    write_json(STRUCTURED / "pet_capture_official.json", rows)
    return rows


def validate(pages: list[dict], pets: list[dict], exp_rows: list[dict], skills: list[dict], capture_rows: list[dict]) -> list[str]:
    issues: list[str] = []
    required_official = {f"3_3_{i}.htm" for i in range(1, 10)}
    crawled = {Path(urllib.parse.urlparse(p["url"]).path).name for p in pages if p.get("ok")}
    missing_official = sorted(required_official - crawled)
    if missing_official:
        issues.append(f"官方宠物子页未全部本地化：{', '.join(missing_official)}")
    if len(pets) < 300:
        issues.append(f"FFO百科宠物列表数量偏低：{len(pets)}")
    if not exp_rows:
        issues.append("宠物升级经验表为空。")
    elif max(row["level"] for row in exp_rows) < 60:
        issues.append(f"宠物升级经验最高等级不足 60：{max(row['level'] for row in exp_rows)}")
    if len(skills) < 20:
        issues.append(f"宠物技能表数量偏低：{len(skills)}")
    if not capture_rows:
        issues.append("官方可捕捉宠物表为空。")
    pet_names = {p.get("name") for p in pets}
    capture_missing = [row["name"] for row in capture_rows if row["name"] not in pet_names]
    if capture_missing:
        issues.append("官方捕捉表中有宠物未出现在 FFO百科 API 列表，需人工核对别名：" + "、".join(capture_missing[:30]))
    return issues


def write_validation(pages: list[dict], pets: list[dict], exp_rows: list[dict], skills: list[dict], capture_rows: list[dict], issues: list[str]) -> None:
    max_pet_level = max((row["level"] for row in exp_rows), default=None)
    lines = [
        "# FFO 深度本地化自洽检测",
        "",
        f"- 生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        f"- 官方旧资料页：{sum(1 for p in pages if p.get('ok'))} / {len(pages)}",
        f"- FFO百科宠物列表：{len(pets)}",
        f"- 宠物升级经验等级数：{len(exp_rows)}；最高等级：{max_pet_level}",
        f"- BWIKI 宠物技能：{len(skills)}",
        f"- 官方可捕捉宠物：{len(capture_rows)}",
        "",
        "## 结论",
        "",
    ]
    if issues:
        lines.append("存在需要人工确认或继续补抓的问题：")
        lines.extend([f"- {issue}" for issue in issues])
    else:
        lines.append("- 宠物名单、官方捕捉表、宠物升级经验、宠物技能效果表均已本地化；字段级自洽检测通过。")
    lines.extend(
        [
            "",
            "## 本地化文件",
            "",
            "- `docs/reference/structured/pet_catalog_ffobaike.json`",
            "- `docs/reference/structured/pet_capture_official.json`",
            "- `docs/reference/structured/pet_level_exp_ffobaike.json`",
            "- `docs/reference/structured/pet_skills_bwiki.json`",
            "- `docs/reference/structured/official_information_pages.json`",
            "",
            "## 版权/使用边界",
            "",
            "- 本地资料仅供内部研究和玩法对标；图片、文本、数据版权归腾讯/原站或相应权利人，禁止直接复用为游戏资产。",
        ]
    )
    write_text(STRUCTURED / "validation.md", "\n".join(lines) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fetch-pet-details", action="store_true", help="also fetch slow pet detail API")
    parser.add_argument("--skip-official", action="store_true", help="reuse existing official deep crawl")
    args = parser.parse_args()
    for path in [RAW, MD, STRUCTURED]:
        path.mkdir(parents=True, exist_ok=True)
    if args.skip_official and (STRUCTURED / "official_information_pages.json").exists():
        pages = json.loads((STRUCTURED / "official_information_pages.json").read_text(encoding="utf-8"))
    else:
        pages = archive_official_information()
    _downloads, pets, exp_rows = archive_ffobaike_pet_data(fetch_details=args.fetch_pet_details)
    skills = archive_bwiki_pet_skills()
    capture_rows = extract_official_pet_capture_rows()
    issues = validate(pages, pets, exp_rows, skills, capture_rows)
    write_validation(pages, pets, exp_rows, skills, capture_rows, issues)
    print(json.dumps({"official_pages": len(pages), "pets": len(pets), "pet_exp_levels": len(exp_rows), "skills": len(skills), "issues": len(issues)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
