#!/usr/bin/env python3
"""Extract a structured dungeon catalog from localized FFO reference pages."""

from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / "docs" / "reference"
MD = REF / "markdown" / "ffobaike_entity"
ENTITY = REF / "entities"

DUNGEONS = {
    "赤枭巢穴": "pworld-feiniaoyouyu.md",
    "八仙结界": "pworld-baxianjiejie.md",
    "花妖巢穴": "pworld-huayao.md",
    "夜影村": "pworld-yeyingcun.md",
    "迷雾沼泽": "pworld-miwuzhaoze.md",
    "冰火双螺": "pworld-binghuoshuangluo.md",
    "灵泽殿": "pworld-lingzedian.md",
    "先祖山": "pworld-xianzushan.md",
    "八仙东海战": "pworld-baxiandonghaizhan.md",
    "妖皇府": "pworld-yaohuangfu.md",
    "昆仑雪": "pworld-kunlunxue.md",
    "通天魔劫塔": "pworld-tongtianmojieta.md",
}

EXPECTED_FEATURE_DUNGEONS = [
    "赤枭巢穴",
    "八仙结界",
    "纯阳宝塔",
    "塔狱",
    "天空之泉",
    "天之眼",
    "失落神殿",
    "花妖巢穴",
    "夜影村",
    "迷雾沼泽",
    "冰火双螺",
    "灵泽殿",
    "先祖山",
    "八仙东海战",
    "妖皇府",
    "昆仑雪",
    "通天魔劫塔",
]

FIELDS = [
    "level_requirement",
    "entry_npc",
    "entry_item",
    "map_style",
    "map_image",
    "bosses",
    "boss_skills",
    "boss_features",
    "boss_images",
    "drops",
    "frequency",
]


@dataclass
class DungeonRecord:
    name: str
    status: str
    level_requirement: str
    entry_npc: str
    entry_item: str
    map_style: str
    map_image: list[str]
    bosses: list[str]
    boss_skills: dict[str, list[str]]
    boss_features: dict[str, list[str]]
    boss_images: dict[str, list[str]]
    drops: list[str]
    frequency: str
    source_urls: list[str]
    local_paths: list[str]
    gaps: list[str]
    confidence: str


def compact(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip(" ：:，,")


def find_first(text: str, patterns: list[str]) -> str:
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return compact(match.group(1))
    return ""


def image_alts(text: str) -> list[str]:
    return re.findall(r"\[图片: ([^\]]+)\]", text)


def source_url(text: str) -> str:
    return find_first(text, [r"- URL：(.+)"])


def extract_bosses(text: str) -> tuple[list[str], dict[str, list[str]], dict[str, list[str]], dict[str, list[str]]]:
    alts = image_alts(text)
    boss_candidates: list[str] = []
    for match in re.finditer(r"([^\n：:]{1,18})（BOSS）", text):
        boss_candidates.append(compact(match.group(1)))
    for alt in alts:
        if alt and not any(word in alt for word in ["地图", "套装", "装备", "道具", "奖励"]):
            nearby = re.search(re.escape(alt) + r".{0,120}?(?:BOSS|首领)", text, re.S)
            if nearby:
                boss_candidates.append(compact(alt))
    bosses = []
    for boss in boss_candidates:
        if boss and boss not in bosses:
            bosses.append(boss)

    boss_skills: dict[str, list[str]] = {}
    boss_features: dict[str, list[str]] = {}
    boss_images: dict[str, list[str]] = {}
    for idx, boss in enumerate(bosses):
        start = text.find(boss)
        if start < 0:
            continue
        ends = [text.find(next_boss, start + len(boss)) for next_boss in bosses[idx + 1 :]]
        ends = [x for x in ends if x > start]
        end = min(ends) if ends else min(len(text), start + 4500)
        block = text[start:end]
        skills: list[str] = []
        for line in block.splitlines():
            line = compact(line)
            if not line:
                continue
            if re.search(r"(技能|狂暴|召唤|攻击|伤害|降低|眩晕|减速|中毒|无敌|隐身|仇恨|免疫|变身)", line):
                if line not in skills and len(line) <= 180:
                    skills.append(line)
        boss_skills[boss] = skills[:30]
        features = []
        for line in block.splitlines():
            line = compact(line)
            if re.search(r"(特性|特点|免疫|阶段|血量|每隔|随机|召唤|不可|必须|法宝|打法|注意)", line):
                if line not in features and len(line) <= 180:
                    features.append(line)
        boss_features[boss] = features[:30]
        boss_images[boss] = [alt for alt in alts if alt == boss or boss in alt or alt in boss]
    return bosses, boss_skills, boss_features, boss_images


def extract_drops(text: str) -> list[str]:
    drops: list[str] = []
    sections = re.split(r"(?:副本产出|副本奖励|奖励|掉落|产出)", text)
    if len(sections) > 1:
        block = sections[-1][:2500]
        for line in block.splitlines():
            line = compact(line)
            if line and len(line) <= 160 and not line.startswith(("页面", "Sidebar", "Main Navigation")):
                drops.append(line)
    return drops[:60]


def parse_one(name: str, filename: str) -> DungeonRecord:
    path = MD / filename
    if not path.exists():
        return DungeonRecord(name, "missing", "", "", "", "", [], [], {}, {}, {}, [], "", [], [], FIELDS[:], "无本地实体页")
    text = path.read_text(encoding="utf-8", errors="replace")
    imgs = image_alts(text)
    bosses, boss_skills, boss_features, boss_images = extract_bosses(text)
    level_requirement = find_first(text, [r"等级要求[：:]\s*([^\n]+)", r"等级[：:]\s*([^\n]+)"])
    entry_npc = find_first(text, [r"副本入口[：:]\s*([^\n]+)", r"入口[：:]\s*([^\n]+)", r"进入NPC[：:]\s*([^\n]+)"])
    entry_item = find_first(text, [r"(?:副本)?钥匙[：:]\s*([^\n]+)", r"门票[：:]\s*([^\n]+)", r"消耗[：:]\s*([^\n]+)"])
    frequency = find_first(text, [r"副本进入次数[：:]\s*([^\n]+)", r"进入次数[：:]\s*([^\n]+)", r"次数[：:]\s*([^\n]+)"])
    map_image = [x for x in imgs if "地图" in x]
    map_style = "；".join(map_image) or find_first(text, [r"地图[：:]\s*([^\n]+)"])
    drops = extract_drops(text)
    values = {
        "level_requirement": level_requirement,
        "entry_npc": entry_npc,
        "entry_item": entry_item,
        "map_style": map_style,
        "map_image": map_image,
        "bosses": bosses,
        "boss_skills": boss_skills,
        "boss_features": boss_features,
        "boss_images": boss_images,
        "drops": drops,
        "frequency": frequency,
    }
    gaps = []
    for field in FIELDS:
        value = values[field]
        if not value:
            gaps.append(field)
        elif isinstance(value, dict) and not any(value.values()):
            gaps.append(field)
    confidence = "中，玩家百科结构化抽取；需与官方页互校。"
    status = "complete" if not gaps else "partial"
    return DungeonRecord(
        name=name,
        status=status,
        level_requirement=level_requirement,
        entry_npc=entry_npc,
        entry_item=entry_item,
        map_style=map_style,
        map_image=map_image,
        bosses=bosses,
        boss_skills=boss_skills,
        boss_features=boss_features,
        boss_images=boss_images,
        drops=drops,
        frequency=frequency,
        source_urls=[source_url(text)] if source_url(text) else [],
        local_paths=[str(path.relative_to(ROOT))],
        gaps=gaps,
        confidence=confidence,
    )


def main() -> None:
    ENTITY.mkdir(parents=True, exist_ok=True)
    records = [parse_one(name, DUNGEONS[name]) if name in DUNGEONS else DungeonRecord(name, "missing", "", "", "", "", [], [], {}, {}, {}, [], "", [], [], FIELDS[:], "未找到端游公开实体页") for name in EXPECTED_FEATURE_DUNGEONS]
    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "scope": "feature 副本活动结构化目录；仅使用本地化公开端游资料。",
        "fields": FIELDS,
        "records": [asdict(r) for r in records],
    }
    (ENTITY / "dungeon-catalog.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = [
        "# 副本活动结构化目录",
        "",
        f"- 生成时间：{payload['generated_at']}",
        "- 可信度：FFO百科为玩家百科，官方资料优先；本表用于离线对标和缺口定位。",
        "- 图片版权：本地图片仅供内部研究参考，禁止直接复用为游戏资产。",
        "",
        "| 副本 | 状态 | 等级 | 入口 | 次数 | Boss | 地图图 | 缺口 |",
        "| --- | --- | --- | --- | --- | --- | --- | --- |",
    ]
    for r in records:
        lines.append(
            "| "
            + " | ".join(
                [
                    r.name,
                    r.status,
                    r.level_requirement or "-",
                    r.entry_npc or "-",
                    r.frequency or "-",
                    "、".join(r.bosses) or "-",
                    "、".join(r.map_image) or "-",
                    "、".join(r.gaps) or "-",
                ]
            )
            + " |"
        )
    lines += ["", "## 明细", ""]
    for r in records:
        lines += [
            f"### {r.name}",
            "",
            f"- 来源：{'; '.join(r.source_urls) or '缺'}",
            f"- 本地页：{'; '.join(r.local_paths) or '缺'}",
            f"- 等级/入口/次数：{r.level_requirement or '缺'} / {r.entry_npc or '缺'} / {r.frequency or '缺'}",
            f"- 地图：{', '.join(r.map_image) or '缺'}",
            f"- Boss：{', '.join(r.bosses) or '缺'}",
            f"- 缺口：{', '.join(r.gaps) or '无'}",
            "",
        ]
        for boss in r.bosses:
            lines += [f"#### {boss}", ""]
            if r.boss_images.get(boss):
                lines.append(f"- 图片：{', '.join(r.boss_images[boss])}")
            if r.boss_skills.get(boss):
                lines.append("- 技能/机制：")
                for skill in r.boss_skills[boss][:12]:
                    lines.append(f"  - {skill}")
            lines.append("")
    (ENTITY / "dungeon-catalog.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"records": len(records), "complete": sum(1 for r in records if r.status == "complete"), "missing": sum(1 for r in records if r.status == "missing")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
