#!/usr/bin/env python3
"""Feature-level entity audit and targeted public-page localization for QQ FFO.

This script turns the product feature list into entity-style coverage checks.
It intentionally uses only public web pages and existing local archive files.
"""

from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass, asdict
from datetime import datetime
from html import unescape
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / "docs" / "reference"
FEATURE = ROOT / "docs" / "feature" / "feature.md"
ENTITY_DIR = REF / "entities"
RAW_FFOBAIKE = REF / "raw" / "ffobaike_entity"
MD_FFOBAIKE = REF / "markdown" / "ffobaike_entity"

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X) Codex FFO feature entity audit/1.0"


SCHEMAS: dict[str, dict] = {
    "base_experience": {
        "label": "基础体验",
        "fields": ["name", "source_urls", "local_paths", "rules", "ui_flow", "assets", "single_player_adaptation", "gaps"],
    },
    "profession": {
        "label": "五职业/职业成长",
        "fields": ["name", "role", "creation_options", "stats", "skills", "job_change", "ascension", "skill_icons", "character_images", "source_urls", "gaps"],
    },
    "combat": {
        "label": "战斗刷怪",
        "fields": ["name", "combat_rules", "normal_attack", "active_skills", "passive_skills", "monster_rules", "boss_rules", "death_revival", "automation", "assets", "source_urls", "gaps"],
    },
    "map": {
        "label": "地图任务",
        "fields": ["name", "type", "level_range", "entry_or_transfer", "npcs", "monsters", "tasks", "map_image", "scene_images", "source_urls", "gaps"],
    },
    "equipment": {
        "label": "装备道具",
        "fields": ["name", "slot", "category", "profession", "level", "base_attributes", "durability_repair", "enhance_cap", "enhance_per_level", "socket_rules", "embed_rules", "upgrade_rules", "split_rules", "soul_rules", "drop_or_source", "icon_path", "appearance_path", "source_urls", "gaps"],
    },
    "item": {
        "label": "道具/收集/消耗/卡片",
        "fields": ["name", "category", "effect", "stack_or_limit", "source_or_drop", "used_by_system", "icon_path", "source_urls", "gaps"],
    },
    "pet": {
        "label": "宠物系统",
        "fields": ["name", "capture_source", "food_type", "growth_type", "level_cap", "exp_curve", "trust_rules", "skills", "breed_rules", "equipment", "circle", "image_path", "source_urls", "gaps"],
    },
    "dungeon": {
        "label": "副本活动",
        "fields": ["name", "level_requirement", "entry_npc", "entry_item", "map_style", "map_image", "bosses", "boss_skills", "boss_features", "boss_images", "drops", "frequency", "source_urls", "gaps"],
    },
    "daily": {
        "label": "单机日常",
        "fields": ["name", "entry", "level_requirement", "rules", "frequency", "solo_conversion", "rewards", "images", "source_urls", "gaps"],
    },
    "late_system": {
        "label": "后期养成",
        "fields": ["name", "unlock_condition", "materials", "levels_or_cap", "per_level_growth", "attributes", "slots_or_sets", "source_or_drops", "ui_images", "item_icons", "source_urls", "gaps"],
    },
}


EXPECTED_ENTITIES: list[dict] = [
    *[
        {"type": "base_experience", "name": name}
        for name in ["角色创建", "五职业", "转职/飞升", "等级成长", "属性点", "技能学习/加点", "自动寻路", "自动战斗", "自动补给", "地图传送", "任务指引"]
    ],
    *[
        {"type": "profession", "name": name}
        for name in ["战士", "剑客", "刺客", "术士", "药师"]
    ],
    *[
        {"type": "combat", "name": name}
        for name in ["普通攻击", "主动技能", "被动技能", "职业定位", "野外刷怪", "精英怪", "BOSS战", "单人副本", "挂机刷怪", "死亡复活"]
    ],
    *[
        {"type": "map", "name": name}
        for name in ["主城", "新手村", "野外地图", "NPC", "怪物图鉴", "主线任务", "支线任务", "职业任务", "收集任务", "循环任务", "平行世界副本任务"]
    ],
    *[
        {"type": "equipment", "name": name}
        for name in ["基础装备", "职业外套", "武器", "防具", "饰品", "套装", "外甲", "装备耐久/修理", "装备加工", "打孔镶嵌", "装备升级", "拆解", "附魂", "装备基础属性", "背包类装备", "翅膀"]
    ],
    *[
        {"type": "item", "name": name}
        for name in ["收集品", "消耗品", "卡片"]
    ],
    *[
        {"type": "pet", "name": name}
        for name in ["宠物捕捉", "喂养", "召唤", "信赖度", "宠物技能", "命名", "幻化", "宠物技能丸", "宠物培育", "宠物经验", "宠物成长类型", "宠物装备", "宠物法阵"]
    ],
    *[
        {"type": "dungeon", "name": name, "path": path}
        for name, path in [
            ("赤枭巢穴", "/pworld/feiniaoyouyu.html"),
            ("八仙结界", "/pworld/baxianjiejie.html"),
            ("纯阳宝塔", ""),
            ("塔狱", ""),
            ("天空之泉", ""),
            ("天之眼", ""),
            ("失落神殿", ""),
            ("花妖巢穴", "/pworld/huayao.html"),
            ("夜影村", "/pworld/yeyingcun.html"),
            ("迷雾沼泽", "/pworld/miwuzhaoze.html"),
            ("冰火双螺", "/pworld/binghuoshuangluo.html"),
            ("灵泽殿", "/pworld/lingzedian.html"),
            ("先祖山", "/pworld/xianzushan.html"),
            ("八仙东海战", "/pworld/baxiandonghaizhan.html"),
            ("妖皇府", "/pworld/yaohuangfu.html"),
            ("昆仑雪", "/pworld/kunlunxue.html"),
            ("通天魔劫塔", "/pworld/tongtianmojieta.html"),
        ]
    ],
    *[
        {"type": "daily", "name": name, "path": path}
        for name, path in [
            ("试炼", "/act/shilian.html"),
            ("珍珠海域", "/act/pearl.html"),
            ("保卫战", "/act/defend.html"),
            ("天魔劫", "/act/omen.html"),
            ("通天塔", "/act/bable.html"),
            ("怪物猎杀令", "/act/guaiwulieshaling.html"),
        ]
    ],
    *[
        {"type": "late_system", "name": name, "path": path}
        for name, path in [
            ("幻神", ""),
            ("法宝", ""),
            ("灵", ""),
            ("战魂", ""),
            ("典籍卡", "/system/poker.html"),
            ("称号", "/system/title.html"),
            ("110级新等级", "/system/lv110.html"),
            ("装备祝福", "/system/star-suit.html"),
            ("龙翼秘宝", "/system/longyi.html"),
            ("翅膀雕花", "/system/diaohua.html"),
        ]
    ],
]

TARGETED_FFOBAIKE_PATHS = sorted(
    {
        *(row.get("path") for row in EXPECTED_ENTITIES if row.get("path")),
        "/lookup/arm-code.html",
        "/lookup/avatar-dressing.html",
        "/lookup/combine.html",
        "/lookup/drop-rate.html",
        "/lookup/item-cheatsheet.html",
        "/lookup/arm-split.html",
        "/lookup/unreleased-item.html",
        "/lookup/pet-cheatsheet.html",
        "/lookup/pet-level-exp.html",
        "/lookup/ugc-trade-limit.html",
        "/lookup/gold-limit.html",
        "/act/battle.html",
        "/act/bingfengxueyuan.html",
        "/act/cross-boss.html",
        "/act/kunlongyuan.html",
        "/act/linglongta.html",
        "/act/recurring-collection.html",
        "/act/yunhuang.html",
        "/pworld/baixiaosheng.html",
        "/system/action.html",
        "/system/awake.html",
        "/system/bazhewushuang.html",
        "/system/peak.html",
        "/system/petcircle.html",
        "/system/qianhuan.html",
        "/system/skills/excesuit-skill.html",
        "/system/teleport.html",
        "/system/vip.html",
        "/system/skills/ss.html",
        "/system/wuxing.html",
    }
)


class TextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style", "noscript", "svg"}:
            self.skip += 1
        if not self.skip and tag in {"p", "div", "tr", "td", "th", "li", "br", "h1", "h2", "h3", "table"}:
            self.parts.append("\n")
        if not self.skip and tag == "img":
            alt = dict(attrs).get("alt") or ""
            if alt:
                self.parts.append(f"\n[图片: {alt}]\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style", "noscript", "svg"} and self.skip:
            self.skip -= 1
        if not self.skip and tag in {"p", "div", "tr", "li", "h1", "h2", "h3", "table"}:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.skip:
            self.parts.append(data)


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


def safe_name(text: str) -> str:
    text = text.strip("/").replace(".html", "")
    return re.sub(r"[^0-9A-Za-z\u4e00-\u9fff._-]+", "-", text).strip("-") or "index"


def curl(url: str) -> str:
    result = subprocess.run(
        ["curl", "-L", "--silent", "--show-error", "--max-time", "16", "--connect-timeout", "6", "-A", UA, url],
        capture_output=True,
        check=False,
        timeout=18,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.decode("utf-8", errors="ignore") or f"curl exit {result.returncode}")
    return result.stdout.decode("utf-8", errors="replace")


def fetch_targeted_pages() -> list[dict]:
    RAW_FFOBAIKE.mkdir(parents=True, exist_ok=True)
    MD_FFOBAIKE.mkdir(parents=True, exist_ok=True)
    rows: list[dict] = []
    for path in TARGETED_FFOBAIKE_PATHS:
        url = "https://www.ffobaike.com" + path
        slug = safe_name(path)
        raw_path = RAW_FFOBAIKE / f"{slug}.html"
        md_path = MD_FFOBAIKE / f"{slug}.md"
        status = "exists"
        error = ""
        try:
            if raw_path.exists() and raw_path.stat().st_size > 1000:
                html = raw_path.read_text(encoding="utf-8", errors="replace")
            else:
                html = curl(url)
                raw_path.write_text(html, encoding="utf-8")
                status = "downloaded"
            text = text_from_html(html)
            md_path.write_text(
                "\n".join(
                    [
                        f"# FFO百科实体页：{path}",
                        "",
                        f"- URL：{url}",
                        f"- 抓取日期：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                        "- 可信度：中，玩家百科；用于补实体字段，需与官方资料互校。",
                        "",
                        "## 正文抽取",
                        "",
                        text,
                        "",
                    ]
                ),
                encoding="utf-8",
            )
            ok = True
        except Exception as exc:  # noqa: BLE001
            ok = False
            error = str(exc)
        rows.append(
            {
                "url": url,
                "ok": ok,
                "status": status if ok else "failed",
                "raw_path": str(raw_path.relative_to(ROOT)),
                "markdown_path": str(md_path.relative_to(ROOT)),
                "error": error,
            }
        )
    return rows


def load_local_text_index() -> list[dict]:
    entries: list[dict] = []
    for path in sorted(REF.rglob("*.md")):
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        entries.append({"path": str(path.relative_to(ROOT)), "text": text})
    return entries


def load_art_index() -> list[dict]:
    path = REF / "art" / "catalog.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8")).get("records", [])


def find_evidence(name: str, entries: list[dict], limit: int = 8) -> list[dict]:
    variants = {name, name.replace("巢穴", ""), name.replace("结界", "的结界")}
    if name == "赤枭巢穴":
        variants.add("赤枭的巢穴")
    if name == "八仙结界":
        variants.add("八仙的结界")
    if name == "失落神殿":
        variants.add("失落的神殿")
    if name == "翅膀":
        variants.update(["翅膀雕花", "烈焰之翼", "幻想之翼", "恶魔翅膀", "天使翅膀"])
    preferred_slugs = {
        "赤枭巢穴": "pworld-feiniaoyouyu",
        "八仙结界": "pworld-baxianjiejie",
        "花妖巢穴": "pworld-huayao",
        "夜影村": "pworld-yeyingcun",
        "迷雾沼泽": "pworld-miwuzhaoze",
        "冰火双螺": "pworld-binghuoshuangluo",
        "灵泽殿": "pworld-lingzedian",
        "先祖山": "pworld-xianzushan",
        "八仙东海战": "pworld-baxiandonghaizhan",
        "妖皇府": "pworld-yaohuangfu",
        "昆仑雪": "pworld-kunlunxue",
        "通天魔劫塔": "pworld-tongtianmojieta",
        "试炼": "act-shilian",
        "珍珠海域": "act-pearl",
        "保卫战": "act-defend",
        "天魔劫": "act-omen",
        "通天塔": "act-bable",
        "怪物猎杀令": "act-guaiwulieshaling",
        "翅膀雕花": "system-diaohua",
        "龙翼秘宝": "system-longyi",
        "典籍卡": "system-poker",
        "称号": "system-title",
        "110级新等级": "system-lv110",
        "装备祝福": "system-star-suit",
        "宠物法阵": "system-petcircle",
        "地图传送": "system-teleport",
        "收集任务": "act-recurring-collection",
        "宠物成长类型": "lookup-pet-cheatsheet",
        "宠物经验": "lookup-pet-level-exp",
        "宠物捕捉": "lookup-pet-cheatsheet",
        "喂养": "lookup-pet-cheatsheet",
        "宠物技能": "lookup-pet-cheatsheet",
        "幻神": "system-qianhuan",
        "战魂": "system-bazhewushuang",
        "灵": "system-bazhewushuang",
        "装备耐久/修理": "official-QQ自由幻想-资料专区-6a91e4b7",
        "装备觉醒": "system-awake",
        "翅膀": "system-diaohua",
        "背包类装备": "lookup-arm-code",
    }
    hits: list[dict] = []
    preferred = preferred_slugs.get(name)
    if preferred:
        for entry in entries:
            if preferred in entry["path"]:
                hits.append({"path": entry["path"], "matched": [name, preferred]})
                break
    for entry in entries:
        if any(hit["path"] == entry["path"] for hit in hits):
            continue
        text = entry["text"]
        if any(v and v in text for v in variants):
            hits.append({"path": entry["path"], "matched": [v for v in variants if v and v in text][:5]})
            if len(hits) >= limit:
                break
    return hits


FIELD_PATTERNS: dict[str, list[str]] = {
    "source_urls": ["URL：", "来源：", "https://"],
    "local_paths": ["docs/reference", "markdown/"],
    "rules": ["规则", "说明", "方法", "需求", "要求"],
    "ui_flow": ["界面", "NPC", "点击", "按钮"],
    "assets": ["[图片:", "local_path", "assets/"],
    "single_player_adaptation": ["单机", "iPhone", "本地"],
    "role": ["定位", "职业", "战士", "剑客", "刺客", "术士", "药师"],
    "creation_options": ["创建角色", "性别", "发型", "发色"],
    "stats": ["属性", "力量", "智慧", "体质", "敏捷", "精神"],
    "skills": ["技能", "主动", "被动", "效果"],
    "job_change": ["转职", "职业任务"],
    "ascension": ["飞升", "仙职"],
    "skill_icons": ["技能图标", "skill_icon", "[图片:"],
    "character_images": ["character", "角色", "[图片:"],
    "combat_rules": ["战斗", "攻击", "伤害", "命中", "暴击"],
    "normal_attack": ["普通攻击", "普攻"],
    "active_skills": ["主动技能", "技能"],
    "passive_skills": ["被动技能"],
    "monster_rules": ["怪物", "精英"],
    "boss_rules": ["BOSS", "Boss", "boss"],
    "death_revival": ["死亡", "复活"],
    "automation": ["自动", "挂机"],
    "type": ["类型", "主城", "野外", "副本"],
    "level_range": ["等级", "级"],
    "entry_or_transfer": ["进入", "传送", "NPC"],
    "npcs": ["NPC"],
    "monsters": ["怪物"],
    "tasks": ["任务"],
    "map_image": ["地图", "[图片:"],
    "scene_images": ["场景", "[图片:"],
    "slot": ["部位", "武器", "防具", "背包", "帽子", "翅膀"],
    "category": ["类型", "分类", "装备", "道具"],
    "profession": ["职业", "通用", "战士", "剑客", "刺客", "术士", "药师"],
    "level": ["等级", "级"],
    "base_attributes": ["防御", "魔法防御", "攻击", "属性", "重量", "负重"],
    "durability_repair": ["耐久", "修理"],
    "enhance_cap": ["最高等级", "加工最高", "强化", "加工"],
    "enhance_per_level": ["每级", "每多一级", "+1", "等级变化"],
    "socket_rules": ["打孔", "孔"],
    "embed_rules": ["镶嵌", "卡片"],
    "upgrade_rules": ["升级"],
    "split_rules": ["拆解"],
    "soul_rules": ["附魂"],
    "drop_or_source": ["掉落", "产出", "获得", "来源"],
    "icon_path": ["图标", "[图片:"],
    "appearance_path": ["外观", "穿戴", "[图片:"],
    "effect": ["效果", "作用"],
    "stack_or_limit": ["上限", "数量", "限制"],
    "source_or_drop": ["来源", "掉落", "产出"],
    "used_by_system": ["用于", "合成", "加工"],
    "capture_source": ["捕捉", "捆仙索"],
    "food_type": ["草食", "肉食", "杂食", "喂养"],
    "growth_type": ["成长", "资质"],
    "level_cap": ["最高等级", "等级上限", "80"],
    "exp_curve": ["经验", "升级经验"],
    "trust_rules": ["信赖"],
    "breed_rules": ["培育", "二代"],
    "equipment": ["宠物装备"],
    "circle": ["宠物法阵"],
    "image_path": ["pet_character", "[图片:"],
    "level_requirement": ["等级需求", "进入要求", "等级"],
    "entry_npc": ["NPC", "入口", "进入方法"],
    "entry_item": ["钥匙", "道具", "信物", "传送装置"],
    "map_style": ["地图", "场景", "样式"],
    "bosses": ["BOSS", "Boss", "boss"],
    "boss_skills": ["技能", "招式", "机制"],
    "boss_features": ["特征", "机制", "阶段"],
    "boss_images": ["BOSS", "[图片:", "boss"],
    "drops": ["掉落", "奖励", "产出"],
    "frequency": ["每日", "每周", "次数", "活动时间"],
    "entry": ["入口", "进入", "NPC"],
    "solo_conversion": ["单机", "单人"],
    "rewards": ["奖励", "产出"],
    "images": ["[图片:", "assets/"],
    "unlock_condition": ["开启", "解锁", "条件", "需求"],
    "materials": ["材料", "道具"],
    "levels_or_cap": ["等级", "上限", "最高"],
    "per_level_growth": ["每级", "加工", "强化"],
    "attributes": ["属性", "攻击", "防御", "生命", "负重"],
    "slots_or_sets": ["套装", "槽", "部位"],
    "source_or_drops": ["来源", "掉落", "产出"],
    "ui_images": ["界面", "[图片:"],
    "item_icons": ["图标", "[图片:"],
}


def field_present(field: str, evidence_text: str, art_rows: list[dict], entity_name: str) -> bool:
    if field == "name":
        return True
    if field == "gaps":
        return True
    if field == "local_paths":
        return bool(evidence_text.strip())
    if field.endswith("path") or field.endswith("images") or field in {"assets", "skill_icons", "character_images", "map_image", "scene_images", "boss_images", "icon_path", "appearance_path", "image_path", "ui_images", "item_icons"}:
        art_text = json.dumps([r for r in art_rows if entity_name in json.dumps(r, ensure_ascii=False)], ensure_ascii=False)
        return bool(art_text) or any(p in evidence_text for p in FIELD_PATTERNS.get(field, []))
    return any(pattern in evidence_text for pattern in FIELD_PATTERNS.get(field, [field]))


def audit_entities(fetch_rows: list[dict]) -> tuple[list[dict], list[dict]]:
    entries = load_local_text_index()
    art_rows = load_art_index()
    audits: list[dict] = []
    gaps: list[dict] = []
    for entity in EXPECTED_ENTITIES:
        schema = SCHEMAS[entity["type"]]
        evidence = find_evidence(entity["name"], entries)
        evidence_text = "\n".join(
            next((e["text"] for e in entries if e["path"] == hit["path"]), "")[:8000]
            for hit in evidence
        )
        present: list[str] = []
        missing: list[str] = []
        for field in schema["fields"]:
            if field_present(field, evidence_text, art_rows, entity["name"]):
                present.append(field)
            else:
                missing.append(field)
        status = "complete" if not missing else ("partial" if evidence else "missing")
        row = {
            **entity,
            "schema_label": schema["label"],
            "required_fields": schema["fields"],
            "present_fields": present,
            "missing_fields": missing,
            "coverage_ratio": round(len(present) / len(schema["fields"]), 3),
            "status": status,
            "evidence": evidence,
        }
        audits.append(row)
        if missing:
            gaps.append({"type": entity["type"], "name": entity["name"], "missing_fields": missing, "evidence": evidence[:3]})
    return audits, gaps


def write_outputs(fetch_rows: list[dict], audits: list[dict], gaps: list[dict]) -> None:
    ENTITY_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "scope": "QQ自由幻想端游 feature 实体字段覆盖审计；不含手游、私服、泄露客户端、破解包。",
        "schemas": SCHEMAS,
        "targeted_fetch": fetch_rows,
        "audits": audits,
        "summary": {
            "entities": len(audits),
            "complete": sum(1 for row in audits if row["status"] == "complete"),
            "partial": sum(1 for row in audits if row["status"] == "partial"),
            "missing": sum(1 for row in audits if row["status"] == "missing"),
            "targeted_fetch_ok": sum(1 for row in fetch_rows if row["ok"]),
            "targeted_fetch_failed": sum(1 for row in fetch_rows if not row["ok"]),
        },
    }
    (ENTITY_DIR / "feature-coverage-audit.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    (ENTITY_DIR / "feature-entity-fields.md").write_text(render_schema_md(), encoding="utf-8")
    (ENTITY_DIR / "feature-coverage-audit.md").write_text(render_audit_md(payload, gaps), encoding="utf-8")
    (ENTITY_DIR / "feature-gaps.json").write_text(json.dumps(gaps, ensure_ascii=False, indent=2), encoding="utf-8")
    (ENTITY_DIR / "targeted-fetch.json").write_text(json.dumps(fetch_rows, ensure_ascii=False, indent=2), encoding="utf-8")


def render_schema_md() -> str:
    lines = [
        "# Feature 实体字段标准",
        "",
        "- 范围：QQ自由幻想端游精神复刻 feature。",
        "- 原则：页面抓到不等于覆盖；实体必填字段缺失则进入 gaps。",
        "- 版权：图片只作内部研究参考，禁止直接复用为游戏资产。",
        "",
    ]
    for key, schema in SCHEMAS.items():
        lines += [f"## {schema['label']} `{key}`", "", "| 字段 | 必填含义 |", "| --- | --- |"]
        for field in schema["fields"]:
            lines.append(f"| `{field}` | {FIELD_DESCRIPTIONS.get(field, '待落地字段。')} |")
        lines.append("")
    return "\n".join(lines)


FIELD_DESCRIPTIONS = {
    "name": "实体名称。",
    "source_urls": "原始来源 URL，至少一个。",
    "local_paths": "本地 raw/markdown/structured 路径。",
    "rules": "玩法规则或系统规则。",
    "ui_flow": "入口、NPC、按钮、界面流程。",
    "assets": "相关本地参考图。",
    "single_player_adaptation": "单机 iPhone 版取舍与改造说明。",
    "gaps": "缺失字段和待人工确认项。",
    "slot": "装备部位，例如武器、防具、背包/翅膀等。",
    "base_attributes": "基础属性与数值。",
    "enhance_cap": "加工/强化最高等级。",
    "enhance_per_level": "每级加工/强化属性变化。",
    "map_image": "地图图或路线图。",
    "bosses": "Boss 列表。",
    "boss_skills": "Boss 技能。",
    "boss_images": "Boss 美术图。",
}


def render_audit_md(payload: dict, gaps: list[dict]) -> str:
    summary = payload["summary"]
    lines = [
        "# Feature 覆盖审计",
        "",
        f"- 生成时间：{payload['generated_at']}",
        f"- 实体数：{summary['entities']}；complete：{summary['complete']}；partial：{summary['partial']}；missing：{summary['missing']}。",
        f"- 补抓页面：成功 {summary['targeted_fetch_ok']}；失败 {summary['targeted_fetch_failed']}。",
        "- 结论：本报告按实体字段验收；`partial` 不可视为已覆盖。",
        "",
        "## 高优先缺口",
        "",
    ]
    high = [g for g in gaps if g["type"] in {"equipment", "dungeon", "map", "profession", "late_system"}]
    for gap in high[:80]:
        lines.append(f"- `{gap['type']}` {gap['name']} 缺：{', '.join(gap['missing_fields'])}")
    lines += ["", "## 全量实体审计", "", "| 类型 | 实体 | 状态 | 覆盖率 | 缺失字段 | 证据 |", "| --- | --- | --- | ---: | --- | --- |"]
    for row in payload["audits"]:
        evidence = "<br>".join(hit["path"] for hit in row["evidence"][:3]) if row["evidence"] else ""
        lines.append(
            f"| {row['type']} | {row['name']} | {row['status']} | {row['coverage_ratio']} | "
            f"{', '.join(row['missing_fields'])} | {evidence} |"
        )
    lines += ["", "## 补抓页面", "", "| 状态 | URL | 本地 Markdown | 错误 |", "| --- | --- | --- | --- |"]
    for row in payload["targeted_fetch"]:
        lines.append(f"| {'OK' if row['ok'] else 'FAIL'} | {row['url']} | `{row['markdown_path']}` | {row.get('error','')} |")
    return "\n".join(lines) + "\n"


def main() -> None:
    fetch_rows = fetch_targeted_pages()
    audits, gaps = audit_entities(fetch_rows)
    write_outputs(fetch_rows, audits, gaps)
    print(json.dumps({"fetch": len(fetch_rows), "audits": len(audits), "gaps": len(gaps)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
