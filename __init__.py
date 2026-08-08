# -*- coding: utf-8 -*-
"""
ComfyUI  Qwen3/Qwen3.5 llama TE 插件
"""

from .nodes import (
    QwenTE模型加载器,
    QwenTE图像推理,
    QwenTE卸载模型,
    Gemma4TE模型加载器,
    Gemma4TE图像推理,
    Gemma4TE音频推理,
    Gemma4TE卸载模型,
)
from .multi_turn_chat import QwenTE多轮对话, QwenTE对话增强设置
from .skill_loader import QwenTESkill加载器

NODE_CLASS_MAPPINGS = {
    "QwenTE_ModelLoader": QwenTE模型加载器,
    "QwenTE_ImageInfer": QwenTE图像推理,
    "QwenTE_Unload": QwenTE卸载模型,
    "QwenTE_MultiTurnChat": QwenTE多轮对话,
    "QwenTE_ChatSettings": QwenTE对话增强设置,
    "QwenTE_SkillLoader": QwenTESkill加载器,
    "Gemma4TE_ModelLoader": Gemma4TE模型加载器,
    "Gemma4TE_ImageInfer": Gemma4TE图像推理,
    "Gemma4TE_AudioInfer": Gemma4TE音频推理,
    "Gemma4TE_Unload": Gemma4TE卸载模型,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "QwenTE_ModelLoader": "Qwen llama TE 模型加载器",
    "QwenTE_ImageInfer": "Qwen llama TE 图像推理",
    "QwenTE_Unload": "Qwen llama TE 卸载模型",
    "QwenTE_MultiTurnChat": "Qwen llama TE 多轮对话聊天",
    "QwenTE_ChatSettings": "Qwen llama TE 对话增强设置",
    "QwenTE_SkillLoader": "Qwen llama TE Skill加载器",
    "Gemma4TE_ModelLoader": "Gemma4 llama TE 模型加载器",
    "Gemma4TE_ImageInfer": "Gemma4 llama TE 图片推理",
    "Gemma4TE_AudioInfer": "Gemma4 llama TE 音频推理",
    "Gemma4TE_Unload": "Gemma4 llama TE 卸载模型",
}

WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
