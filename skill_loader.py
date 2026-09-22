# -*- coding: utf-8 -*-
import os
import re
import hashlib


SKILLS_DIR = os.path.join(os.path.dirname(os.path.realpath(__file__)), "skills")
自动选择 = "自动选择"
内联文件最大字节数 = 4 * 1024 * 1024


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


def _支持的skill文件(name: str) -> bool:
    return os.path.splitext(name)[1].lower() in (".md", ".txt")


def _创建skill记录(
    file_path: str,
    *,
    skill_id: str | None = None,
    skill_dir: str | None = None,
    legacy_label: bool = False,
) -> dict:
    """Build a skill entry while keeping legacy directory-based IDs stable."""
    file_path = os.path.realpath(file_path)
    skill_dir = os.path.realpath(skill_dir or os.path.dirname(file_path))
    relative_file = os.path.relpath(file_path, SKILLS_DIR).replace("\\", "/")
    relative_dir = os.path.relpath(skill_dir, SKILLS_DIR).replace("\\", "/")
    if relative_dir == ".":
        relative_dir = ""

    content = _读取文本(file_path)
    metadata = _解析前置信息(content)
    meta_name = _读取meta值(skill_dir, "display-name-zh")
    meta_description = _读取meta值(skill_dir, "summary-cn")
    fallback_name = os.path.splitext(os.path.basename(file_path))[0]
    name = meta_name or metadata.get("name") or fallback_name
    description = meta_description or metadata.get("description") or ""
    entry_id = skill_id or relative_file
    if legacy_label:
        label = f"{name} [{entry_id}]" if name != entry_id else entry_id
    else:
        label = f"{name} [{relative_file}]"
    return {
        "id": entry_id,
        "name": name,
        "label": label,
        "description": description,
        "skill_file": os.path.basename(file_path),
        "skill_path": relative_file,
        "skill_dir": relative_dir,
        "references": _列出references(skill_dir),
    }


def 发现skills() -> list[dict]:
    if not os.path.isdir(SKILLS_DIR):
        return []

    skills = []
    for root, dirnames, filenames in os.walk(SKILLS_DIR):
        # references are loaded on demand by their parent Skill and should not
        # become separate Skill choices in the node dropdown.
        dirnames[:] = sorted(name for name in dirnames if name != "references")
        filenames = sorted(name for name in filenames if _支持的skill文件(name))
        if not filenames:
            continue

        relative_dir = os.path.relpath(root, SKILLS_DIR).replace("\\", "/")
        legacy_dir = relative_dir != "." and re.fullmatch(r"[A-Za-z0-9._-]+", relative_dir or "")
        default_name = "SKILL.md"
        chinese_name = "SKILL.cn.md"
        primary_name = chinese_name if chinese_name in filenames else default_name if default_name in filenames else None

        # Preserve the old directory Skill ID and Chinese-file preference.
        if legacy_dir and primary_name:
            skills.append(
                _创建skill记录(
                    os.path.join(root, primary_name),
                    skill_id=relative_dir,
                    skill_dir=root,
                    legacy_label=True,
                )
            )

        for filename in filenames:
            if filename in (default_name, chinese_name) and primary_name and legacy_dir:
                continue
            file_path = os.path.join(root, filename)
            relative_file = os.path.relpath(file_path, SKILLS_DIR).replace("\\", "/")
            skills.append(_创建skill记录(file_path, skill_id=relative_file, skill_dir=root))

    return sorted(skills, key=lambda item: (item["label"].casefold(), item["id"].casefold()))


def 获取skill(skill_id: str) -> dict | None:
    return next((skill for skill in 发现skills() if skill["id"] == skill_id), None)


def 读取skill正文(skill: dict) -> str:
    skill_path = skill.get("skill_path") or os.path.join(skill["id"], skill["skill_file"])
    return _读取文本(os.path.join(SKILLS_DIR, skill_path))


def 构建内联skill系统提示词(base_system: str, file_name: str, content: str, instruction: str = "") -> str:
    """把浏览器临时加载的 Markdown/TXT 文件包装成系统提示词。"""
    name = os.path.basename(str(file_name or "loaded_skill.txt")) or "loaded_skill.txt"
    text = str(content or "").strip()
    parts = [
        str(base_system or "").strip(),
        f"当前加载文件：{name}\n===== {name} =====\n{text}",
    ]
    if instruction:
        parts.append(str(instruction).strip())
    return "\n\n".join(part for part in parts if part)


def _规范化内联文件(file_name: str, content: str) -> dict | None:
    name = os.path.basename(str(file_name or "").strip())
    text = str(content or "")
    if not text.strip():
        return None
    if not name:
        name = "loaded_skill.txt"
    extension = os.path.splitext(name)[1].lower()
    if extension not in (".md", ".txt"):
        raise ValueError("加载 Skill/提示词只支持 .md 或 .txt 文件。")
    if len(text.encode("utf-8")) > 内联文件最大字节数:
        raise ValueError("加载 Skill/提示词文件不能超过 4 MB。")
    file_id = hashlib.sha256((name + "\0" + text).encode("utf-8")).hexdigest()[:16]
    return {"name": name, "content": text, "source": "local_file", "id": file_id}


def 读取reference(skill: dict, relative_path: str) -> str:
    normalized = str(relative_path or "").replace("\\", "/").strip("/")
    if normalized not in skill["references"]:
        raise ValueError(f"Skill reference 不存在：{normalized}")
    skill_dir_value = skill.get("skill_dir")
    skill_dir = os.path.realpath(
        os.path.join(SKILLS_DIR, skill_dir_value) if skill_dir_value else os.path.join(SKILLS_DIR, skill["id"])
    )
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
            },
            "hidden": {
                "skill_folder_path": SKILLS_DIR,
            },
            "optional": {
                # Filled by the browser file picker. They remain regular
                # widgets so their values are included in queued prompts and
                # can be saved in ComfyUI workflows.
                "加载文件名": ("STRING", {"default": "", "multiline": False}),
                "加载文件内容": ("STRING", {"default": "", "multiline": True}),
            },
        }

    RETURN_TYPES = ("QWEN_TE_SKILL",)
    RETURN_NAMES = ("skill加载器",)
    FUNCTION = "run"
    CATEGORY = "Qwen TE"

    def run(self, skill, 加载文件名="", 加载文件内容="", **kwargs):
        skills = 发现skills()
        selected = ""
        if skill != 自动选择:
            selected_skill = next((item for item in skills if item["label"] == skill or item["id"] == skill), None)
            if selected_skill is None:
                raise ValueError(f"找不到 Skill：{skill}，请刷新节点后重新选择。")
            selected = selected_skill["id"]
        inline_file = _规范化内联文件(加载文件名, 加载文件内容)
        return ({"selected": selected, "skills": skills, "inline_file": inline_file},)
