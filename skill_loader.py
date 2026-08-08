# -*- coding: utf-8 -*-
import os
import re


SKILLS_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), "skills")
自动选择 = "自动选择"


def _读取文本(path: str) -> str:
    with open(path, "r", encoding="utf-8-sig") as file:
        return file.read()


def _解析前置信息(text: str) -> dict[str, str]:
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end < 0:
        return {}

    values = {}
    lines = text[3:end].splitlines()
    index = 0
    while index < len(lines):
        match = re.match(r"^([\w-]+):\s*(.*)$", lines[index])
        if not match:
            index += 1
            continue
        key, value = match.groups()
        if value in ("|", ">"):
            index += 1
            parts = []
            while index < len(lines) and (not lines[index].strip() or lines[index][:1].isspace()):
                parts.append(lines[index].strip())
                index += 1
            values[key] = " ".join(part for part in parts if part)
            continue
        values[key] = value.strip().strip("\"'")
        index += 1
    return values


def _读取meta值(skill_dir: str, key: str) -> str:
    path = os.path.join(skill_dir, "meta.yaml")
    if not os.path.isfile(path):
        return ""
    for line in _读取文本(path).splitlines():
        match = re.match(rf"^{re.escape(key)}:\s*(.+?)\s*$", line)
        if match:
            return match.group(1).strip().strip("\"'")
    return ""


def _列出references(skill_dir: str) -> list[str]:
    reference_dir = os.path.join(skill_dir, "references")
    if not os.path.isdir(reference_dir):
        return []
    files = []
    for root, _, names in os.walk(reference_dir):
        for name in names:
            if os.path.splitext(name)[1].lower() not in (".md", ".txt", ".yaml", ".yml", ".json"):
                continue
            relative = os.path.relpath(os.path.join(root, name), skill_dir).replace("\\", "/")
            files.append(relative)
    return sorted(files)


def 发现skills() -> list[dict]:
    if not os.path.isdir(SKILLS_DIR):
        return []

    skills = []
    for skill_id in sorted(os.listdir(SKILLS_DIR)):
        if not re.fullmatch(r"[A-Za-z0-9._-]+", skill_id):
            continue
        skill_dir = os.path.join(SKILLS_DIR, skill_id)
        default_path = os.path.join(skill_dir, "SKILL.md")
        chinese_path = os.path.join(skill_dir, "SKILL.cn.md")
        if not os.path.isfile(default_path) and not os.path.isfile(chinese_path):
            continue

        content_path = chinese_path if os.path.isfile(chinese_path) else default_path
        metadata = _解析前置信息(_读取文本(content_path))
        name = _读取meta值(skill_dir, "display-name-zh") or metadata.get("name") or skill_id
        description = _读取meta值(skill_dir, "summary-cn") or metadata.get("description") or ""
        label = f"{name} [{skill_id}]" if name != skill_id else skill_id
        skills.append(
            {
                "id": skill_id,
                "name": name,
                "label": label,
                "description": description,
                "skill_file": os.path.basename(content_path),
                "references": _列出references(skill_dir),
            }
        )
    return skills


def 获取skill(skill_id: str) -> dict | None:
    return next((skill for skill in 发现skills() if skill["id"] == skill_id), None)


def 读取skill正文(skill: dict) -> str:
    return _读取文本(os.path.join(SKILLS_DIR, skill["id"], skill["skill_file"]))


def 读取reference(skill: dict, relative_path: str) -> str:
    normalized = str(relative_path or "").replace("\\", "/").strip("/")
    if normalized not in skill["references"]:
        raise ValueError(f"Skill reference 不存在：{normalized}")
    skill_dir = os.path.realpath(os.path.join(SKILLS_DIR, skill["id"]))
    path = os.path.realpath(os.path.join(skill_dir, normalized))
    if os.path.commonpath([skill_dir, path]) != skill_dir:
        raise ValueError("Skill reference 路径超出 Skill 目录。")
    return _读取文本(path)


class QwenTESkill加载器:
    @classmethod
    def INPUT_TYPES(cls):
        choices = [自动选择] + [skill["label"] for skill in 发现skills()]
        return {
            "required": {
                "skill": (
                    choices,
                    {
                        "default": 自动选择,
                        "tooltip": "自动选择会根据首次任务匹配 Skill；也可以固定选择一个 Skill。",
                    },
                ),
            }
        }

    RETURN_TYPES = ("QWEN_TE_SKILL",)
    RETURN_NAMES = ("skill加载器",)
    FUNCTION = "run"
    CATEGORY = "Qwen TE"

    def run(self, skill):
        skills = 发现skills()
        selected = ""
        if skill != 自动选择:
            selected_skill = next((item for item in skills if item["label"] == skill or item["id"] == skill), None)
            if selected_skill is None:
                raise ValueError(f"找不到 Skill：{skill}，请刷新节点后重新选择。")
            selected = selected_skill["id"]
        return ({"selected": selected, "skills": skills},)
