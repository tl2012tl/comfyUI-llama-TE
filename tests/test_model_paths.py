# -*- coding: utf-8 -*-
import os
import sys


COMFYUI_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
PLUGIN_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, COMFYUI_DIR)
sys.path.insert(0, PLUGIN_DIR)


def test_llm_path_uses_comfyui_registered_path(monkeypatch):
    import folder_paths
    from nodes import _获取_llm文件路径

    registered_path = r"E:\AI\models\LLM\model.gguf"
    monkeypatch.setattr(folder_paths, "get_full_path", lambda category, filename: registered_path)

    assert _获取_llm文件路径("model.gguf") == registered_path
