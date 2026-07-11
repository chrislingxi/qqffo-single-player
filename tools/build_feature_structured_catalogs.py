#!/usr/bin/env python3
"""Build compact structured catalogs for feature audit follow-up."""

from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
REF = ROOT / "docs" / "reference"
ENTITY = REF / "entities"


def read_json(path: str):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""


def build_pet_catalog() -> None:
    pet_catalog = read_json("docs/reference/structured/pet_catalog_ffobaike.json")
    level_exp = read_json("docs/reference/structured/pet_level_exp_ffobaike.json")
    skills = read_json("docs/reference/structured/pet_skills_bwiki.json")
    details = pet_catalog.get("details", [])
    traits = Counter((row.get("traits") or "未标注") for row in pet_catalog.get("list", []))
    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "scope": "宠物系统结构化汇总；仅使用本地化公开端游资料。",
        "pet_count": len(details),
        "max_pet_level": max((row["level"] for row in level_exp), default=None),
        "level_exp_rows": len(level_exp),
        "pet_skill_count": len(skills),
        "growth_or_traits_counter": dict(traits),
        "sources": [
            "docs/reference/structured/pet_catalog_ffobaike.json",
            "docs/reference/structured/pet_level_exp_ffobaike.json",
            "docs/reference/structured/pet_skills_bwiki.json",
            "docs/reference/markdown/ffobaike_entity/lookup-pet-cheatsheet.md",
            "docs/reference/markdown/ffobaike_entity/lookup-pet-level-exp.md",
            "docs/reference/markdown/ffobaike_entity/system-petcircle.md",
        ],
        "fields": {
            "capture_source": "官方宠物系统页、宠物图鉴页提供捕捉/宠物来源线索；单宠物捕捉点仍需按图鉴逐项补。",
            "food_type": "旧官方宠物喂养页提供喂养规则；单宠物食性在当前结构化 JSON 中未独立字段化。",
            "growth_type": "FFO百科 pet list 的 traits 字段当前大多为空；需继续从旧官方/图鉴抽取成长类型。",
            "level_cap": max((row["level"] for row in level_exp), default=None),
            "exp_curve": level_exp,
            "skills": skills,
            "equipment": "宠物装备资料分布在日常/副本产出与 BWIKI，总量未结构化成表。",
            "circle": "docs/reference/markdown/ffobaike_entity/system-petcircle.md",
        },
        "copyright_note": "图片仅供内部研究参考，禁止直接复用为游戏资产。",
    }
    (ENTITY / "pet-system-catalog.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = [
        "# 宠物系统结构化目录",
        "",
        f"- 生成时间：{payload['generated_at']}",
        f"- 宠物数量：{payload['pet_count']}",
        f"- 宠物最高等级：{payload['max_pet_level']}",
        f"- 宠物技能：{payload['pet_skill_count']} 个",
        "- 版权：图片仅供内部研究参考，禁止直接复用为游戏资产。",
        "",
        "## 本地来源",
        "",
        *[f"- `{src}`" for src in payload["sources"]],
        "",
        "## 宠物技能",
        "",
        "| 学习等级 | 技能 | 类型 | 最高等级 | 效果 |",
        "| ---: | --- | --- | ---: | --- |",
    ]
    for skill in skills:
        lines.append(f"| {skill.get('learn_level','')} | {skill.get('name','')} | {skill.get('type','')} | {skill.get('max_skill_level','')} | {skill.get('effect','')} |")
    lines += [
        "",
        "## 仍需字段化",
        "",
        "- 单宠物捕捉点/食性/成长类型：当前本地有宠物图鉴与描述，但没有完整字段化。",
        "- 宠物装备：当前资料散落在副本/活动产出，未形成装备表。",
    ]
    (ENTITY / "pet-system-catalog.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_equipment_catalog() -> None:
    official_basic = read(ROOT / "docs/reference/markdown/official/official-QQ自由幻想-资料专区-6a91e4b7.md")
    qianhuan = read(ROOT / "docs/reference/markdown/ffobaike_entity/system-qianhuan.md")
    awake = read(ROOT / "docs/reference/markdown/ffobaike_entity/system-awake.md")
    diaohua = read(ROOT / "docs/reference/markdown/ffobaike_entity/system-diaohua.md")
    wing_index = read(ROOT / "docs/reference/wing-equipment-style-index.md")
    snippets = {
        "durability_repair": [line for line in official_basic.splitlines() if any(k in line for k in ["耐久度", "全部修理", "特殊修理", "最大耐久度"])][:12],
        "qianhuan_backpack": [line for line in qianhuan.splitlines() if "背包" in line or "千幻装备位" in line or "加工等级" in line][:30],
        "awake_backpack": [line for line in awake.splitlines() if "背包" in line or "觉醒" in line][:40],
        "wing_diaohua": [line for line in diaohua.splitlines() if "翅膀" in line or "雕花" in line or "加工" in line or "百雀灵" in line or "孔雀翎" in line or "凤凰羽" in line][:60],
    }
    wing_names = []
    for line in diaohua.splitlines():
        if any(k in line for k in ["恶魔翅膀", "天使翅膀", "烈焰之翼", "幻想之翼", "光之翼", "暗之翼"]):
            wing_names += re.split(r"[、，, ]+", line)
    wing_names = sorted({x.strip() for x in wing_names if "翼" in x or "翅膀" in x})
    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "scope": "装备/背包/翅膀 feature 结构化汇总；仅使用本地化公开端游资料。",
        "sources": [
            "docs/reference/markdown/official/official-QQ自由幻想-资料专区-6a91e4b7.md",
            "docs/reference/markdown/ffobaike_entity/system-qianhuan.md",
            "docs/reference/markdown/ffobaike_entity/system-awake.md",
            "docs/reference/markdown/ffobaike_entity/system-diaohua.md",
            "docs/reference/wing-equipment-style-index.md",
        ],
        "wing_names_from_diaohua": wing_names,
        "snippets": snippets,
        "known_gaps": [
            "普通背包类装备完整代码表/属性表未抓到；FFO百科 arm-code 为前端工具页，仍需追 JS 数据源。",
            "烈焰恶魔这类翅膀的逐级加工属性未在公开页面中字段化出现；当前仅有雕花之翼 1-15 加工规则与翅膀雕花套装属性。",
            "基础恶魔/天使翅膀只有官方 40x40 图标，缺高清穿戴图。",
        ],
        "copyright_note": "图片仅供内部研究参考，禁止直接复用为游戏资产。",
    }
    (ENTITY / "equipment-system-catalog.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    lines = [
        "# 装备/背包/翅膀结构化目录",
        "",
        f"- 生成时间：{payload['generated_at']}",
        "- 版权：图片仅供内部研究参考，禁止直接复用为游戏资产。",
        "",
        "## 本地来源",
        "",
        *[f"- `{src}`" for src in payload["sources"]],
        "",
        "## 翅膀名称",
        "",
        *[f"- {name}" for name in wing_names],
        "",
        "## 关键规则摘录",
        "",
    ]
    for key, rows in snippets.items():
        lines += [f"### {key}", ""]
        lines += [f"- {row}" for row in rows]
        lines.append("")
    lines += ["## 仍需补齐", ""]
    lines += [f"- {gap}" for gap in payload["known_gaps"]]
    (ENTITY / "equipment-system-catalog.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    ENTITY.mkdir(parents=True, exist_ok=True)
    build_pet_catalog()
    build_equipment_catalog()
    print(json.dumps({"built": ["pet-system-catalog", "equipment-system-catalog"]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
