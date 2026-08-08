# -*- coding: utf-8 -*-
import base64
import gc
import inspect
import io
import os
import re
import urllib.request
import wave
from collections.abc import Mapping
from dataclasses import dataclass
from functools import wraps

import numpy as np
from PIL import Image

import folder_paths
import comfy.model_management as mm

_llama_cpp_import_error = None

try:
    from llama_cpp import Llama
except Exception as exc:
    Llama = None
    _llama_cpp_import_error = exc

try:
    from llama_cpp import GGML_TYPE_Q8_0
except Exception:
    GGML_TYPE_Q8_0 = 8

try:
    from llama_cpp.llama_chat_format import Qwen3VLChatHandler
except Exception:
    Qwen3VLChatHandler = None

try:
    from llama_cpp.llama_chat_format import Qwen35ChatHandler
except Exception:
    Qwen35ChatHandler = None

try:
    from llama_cpp.llama_chat_format import Gemma4ChatHandler
except Exception:
    Gemma4ChatHandler = None


class AnyType(str):
    def __ne__(self, __value: object) -> bool:
        return False


any_type = AnyType("*")

默认图片提示词 = ""
默认图片系统提示词 = "描述这张图,300字左右."
默认文本系统提示词 = "描述这张图,300字左右."
默认音频提示词 = "描述这段音频的内容。"
默认音频系统提示词 = "请分析这段音频并直接给出结果。"
默认KV缓存类型 = "默认(F16)"
Q8_0缓存类型 = "q8_0"
KV缓存类型选项 = [默认KV缓存类型, Q8_0缓存类型]


def _确保_llm目录已注册() -> None:
    folder_name = "LLM"
    llm_dir = os.path.join(folder_paths.models_dir, folder_name)

    supported_exts = set(getattr(folder_paths, "supported_pt_extensions", set()))
    llm_exts = supported_exts | {".gguf"}

    try:
        if folder_name not in folder_paths.folder_names_and_paths:
            folder_paths.folder_names_and_paths[folder_name] = ([llm_dir], llm_exts)
            return

        paths, exts = folder_paths.folder_names_and_paths[folder_name]
        if llm_dir not in paths:
            paths.append(llm_dir)

        if isinstance(exts, set):
            exts.update(llm_exts)
        else:
            folder_paths.folder_names_and_paths[folder_name] = (paths, set(exts) | llm_exts)
    except Exception:
        # 不阻断 ComfyUI 启动；后续节点会提示更具体错误
        return


def _列出llm文件() -> list[str]:
    _确保_llm目录已注册()
    try:
        return folder_paths.get_filename_list("LLM")
    except Exception:
        return []


def _获取_llm文件路径(filename: str) -> str:
    """通过 ComfyUI 的模型注册表解析 LLM 文件路径。"""
    _确保_llm目录已注册()
    model_path = folder_paths.get_full_path("LLM", filename)
    if model_path:
        return model_path
    # 兼容极旧版本 ComfyUI 或未注册 LLM 类别的情况。
    return os.path.join(folder_paths.models_dir, "LLM", filename)


def _图片转base64(image_tensor) -> str:
    """
    编码为 JPEG base64。
    """
    if image_tensor is None:
        return ""

    img = image_tensor[0].cpu().numpy()
    img = np.clip(img * 255.0, 0, 255).astype(np.uint8)
    pil = Image.fromarray(img)
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _缩放图片到最大边(pil: Image.Image, 最大边长: int) -> Image.Image:
    if 最大边长 <= 0:
        return pil
    w, h = pil.size
    long_edge = max(w, h)
    if long_edge <= 最大边长:
        return pil
    scale = 最大边长 / float(long_edge)
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))
    return pil.resize((new_w, new_h), resample=Image.BICUBIC)


def _批量图片索引转base64(image_tensor, index: int, 最大边长: int) -> str:
    if image_tensor is None:
        return ""
    if index < 0 or index >= int(image_tensor.shape[0]):
        return ""
    img = image_tensor[index].cpu().numpy()
    img = np.clip(img * 255.0, 0, 255).astype(np.uint8)
    pil = Image.fromarray(img)
    pil = _缩放图片到最大边(pil, 最大边长)
    buf = io.BytesIO()
    pil.save(buf, format="JPEG", quality=90)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _调用chat_completion(llm, *, messages, params: dict) -> dict:
    """
    兼容不同 llama-cpp-python 版本的参数名差异（例如 presence_penalty vs present_penalty）。
    """
    kwargs = dict(params or {})
    kwargs["messages"] = messages

    try:
        sig = inspect.signature(llm.create_chat_completion)
        allowed = sig.parameters
        has_var_kw = any(p.kind == inspect.Parameter.VAR_KEYWORD for p in allowed.values())
    except Exception:
        sig = None
        allowed = {}
        has_var_kw = True

    if sig is not None:
        if "presence_penalty" in kwargs and "presence_penalty" not in allowed and "present_penalty" in allowed:
            kwargs["present_penalty"] = kwargs.pop("presence_penalty")
        if "present_penalty" in kwargs and "present_penalty" not in allowed and "presence_penalty" in allowed:
            kwargs["presence_penalty"] = kwargs.pop("present_penalty")

        reasoning_keys = {
            "reasoning_budget",
            "reasoning_start",
            "reasoning_end",
            "reasoning_budget_message",
            "reasoning_start_in_prompt",
            "reasoning_start_max_tokens",
        }
        if "reasoning_budget" not in allowed and not has_var_kw:
            kwargs = {k: v for k, v in kwargs.items() if k not in reasoning_keys}
        elif "reasoning_budget" not in allowed and has_var_kw:
            kwargs = {k: v for k, v in kwargs.items() if k not in reasoning_keys}

        if not has_var_kw:
            kwargs = {k: v for k, v in kwargs.items() if k in allowed}

    return llm.create_chat_completion(**kwargs)


def _清洗think块文本(text: str) -> str:
    if not isinstance(text, str) or not text:
        return "" if text is None else str(text)

    cleaned = text
    cleaned = re.sub(r"<think\b[^>]*>.*?</think>", "", cleaned, flags=re.DOTALL | re.IGNORECASE)

    if re.search(r"</think>", cleaned, flags=re.IGNORECASE):
        cleaned = re.sub(r"^.*?</think>\s*", "", cleaned, count=1, flags=re.DOTALL | re.IGNORECASE)

    cleaned = cleaned.replace("<think>", "").replace("</think>", "")
    return cleaned


def _清洗gemma4输出文本(text: str, 保留think块: bool) -> str:
    if not isinstance(text, str) or not text:
        return "" if text is None else str(text)

    cleaned = text.replace("\r\n", "\n")

    if not 保留think块:
        cleaned = re.sub(r"<\|channel\>\s*(?:thought)?\s*\n?.*?<channel\|>", "", cleaned, flags=re.DOTALL | re.IGNORECASE)

    if not 保留think块:
        cleaned = re.sub(r"<think\b[^>]*>.*?</think>", "", cleaned, flags=re.DOTALL | re.IGNORECASE)
        if re.search(r"</think>", cleaned, flags=re.IGNORECASE):
            cleaned = re.sub(r"^.*?</think>\s*", "", cleaned, count=1, flags=re.DOTALL | re.IGNORECASE)

    cleaned = re.sub(r"<\|channel\>\s*[\w-]*\s*\n?", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.replace("<channel|>", "")
    cleaned = cleaned.replace("<|think|>", "")
    cleaned = cleaned.replace("<think>", "").replace("</think>", "")
    return cleaned.strip()


def _llama构造参数是否可用(param_name: str) -> bool | None:
    if Llama is None:
        return None

    try:
        sig = inspect.signature(Llama.__init__)
    except Exception:
        return None

    return param_name in sig.parameters


def _抛出llama_cpp不可用错误() -> None:
    message = "未检测到 llama-cpp-python（llama_cpp）。请先安装/更新该依赖。"
    if _llama_cpp_import_error is not None:
        detail = f"{type(_llama_cpp_import_error).__name__}: {_llama_cpp_import_error}"
        raise RuntimeError(f"{message}\n原始导入错误：{detail}") from _llama_cpp_import_error
    raise RuntimeError(message)


def _解析kv缓存类型(value: str | None) -> int | None:
    if not value or value == 默认KV缓存类型:
        return None
    if value == Q8_0缓存类型:
        return GGML_TYPE_Q8_0
    raise ValueError(f"未知 KV 缓存类型：{value}")


def _规范化随机种子(seed_value):
    try:
        seed_value = int(seed_value)
    except Exception:
        return None

    if seed_value < 0:
        return None
    return seed_value


def _重置llm推理状态(llm) -> None:
    try:
        ctx = getattr(llm, "_ctx", None)
        if ctx is not None and hasattr(ctx, "memory_clear"):
            ctx.memory_clear(True)
    except Exception:
        pass

    try:
        hybrid_cache_mgr = getattr(llm, "_hybrid_cache_mgr", None)
        if hybrid_cache_mgr is not None and hasattr(hybrid_cache_mgr, "clear"):
            hybrid_cache_mgr.clear()
    except Exception:
        pass

    try:
        batch = getattr(llm, "_batch", None)
        if batch is not None and hasattr(batch, "reset"):
            batch.reset()
    except Exception:
        pass

    try:
        input_ids = getattr(llm, "input_ids", None)
        if input_ids is not None and hasattr(input_ids, "fill"):
            input_ids.fill(0)
    except Exception:
        pass

    try:
        reset = getattr(llm, "reset", None)
        if callable(reset):
            reset()
        elif hasattr(llm, "n_tokens"):
            llm.n_tokens = 0
    except Exception:
        pass


def _创建多模态聊天处理器(handler_class, mmproj_path: str, **kwargs):
    try:
        return handler_class(mmproj_path=mmproj_path, **kwargs)
    except TypeError as exc:
        error_text = str(exc)
        rejects_mmproj_path = "mmproj_path" in error_text and "unexpected" in error_text.lower()
        requires_clip_model_path = "clip_model_path" in error_text and "required" in error_text.lower()
        if not (rejects_mmproj_path or requires_clip_model_path):
            raise
        return handler_class(clip_model_path=mmproj_path, **kwargs)


def _创建qwen35聊天处理器(mmproj_path: str, *, enable_thinking: bool, preserve_thinking: bool):
    if Qwen35ChatHandler is None:
        raise RuntimeError("当前 llama-cpp-python 不支持 Qwen35ChatHandler，请更新 llama-cpp-python。")

    candidate_kwargs = [
        {
            "enable_thinking": enable_thinking,
            "add_vision_id": True,
            "preserve_thinking": preserve_thinking,
            "verbose": False,
        },
        {
            "enable_thinking": enable_thinking,
            "preserve_thinking": preserve_thinking,
            "verbose": False,
        },
        {
            "enable_thinking": enable_thinking,
            "add_vision_id": True,
            "verbose": False,
        },
        {
            "enable_thinking": enable_thinking,
            "verbose": False,
        },
    ]

    last_error = None
    for kwargs in candidate_kwargs:
        try:
            return _创建多模态聊天处理器(Qwen35ChatHandler, mmproj_path, **kwargs)
        except TypeError as exc:
            last_error = exc

    if last_error is not None:
        raise last_error
    raise RuntimeError("创建 Qwen35ChatHandler 失败。")


def _读取音频字段(audio_data, key: str, default=None):
    if audio_data is None:
        return default

    if isinstance(audio_data, Mapping):
        return audio_data.get(key, default)

    getter = getattr(audio_data, "get", None)
    if callable(getter):
        try:
            return getter(key, default)
        except TypeError:
            try:
                return getter(key)
            except Exception:
                pass
        except Exception:
            pass

    if hasattr(audio_data, key):
        return getattr(audio_data, key)

    try:
        return audio_data[key]
    except Exception:
        return default


def _comfy音频转wav_base64(audio_data) -> str:
    waveform = _读取音频字段(audio_data, "waveform")
    sample_rate = _读取音频字段(audio_data, "sample_rate")
    if sample_rate is None:
        sample_rate = _读取音频字段(audio_data, "sampler_rate")

    if waveform is None or sample_rate is None:
        raise ValueError("ComfyUI 音频输入缺少 waveform 或 sample_rate。")

    if hasattr(waveform, "detach"):
        waveform = waveform.detach()
    if hasattr(waveform, "cpu"):
        waveform = waveform.cpu()

    if hasattr(waveform, "numpy"):
        wav_np = waveform.numpy()
    else:
        wav_np = np.asarray(waveform)

    if wav_np.ndim == 3:
        wav_np = wav_np[0]
    elif wav_np.ndim == 1:
        wav_np = wav_np[np.newaxis, :]

    if wav_np.ndim != 2:
        raise ValueError(f"ComfyUI 音频 waveform 维度不受支持：{wav_np.shape}")

    wav_np = np.asarray(wav_np, dtype=np.float32)
    wav_np = np.nan_to_num(wav_np, nan=0.0, posinf=1.0, neginf=-1.0)
    wav_np = np.clip(wav_np, -1.0, 1.0)

    pcm16 = (wav_np.T * 32767.0).astype(np.int16, copy=False)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        wav_file.setnchannels(int(wav_np.shape[0]))
        wav_file.setsampwidth(2)
        wav_file.setframerate(int(sample_rate))
        wav_file.writeframes(pcm16.tobytes())

    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _构建gemma4音频输入项(audio_source: str = "", comfy_audio=None) -> dict:
    if comfy_audio is not None:
        return {
            "type": "input_audio",
            "input_audio": {
                "data": _comfy音频转wav_base64(comfy_audio),
                "format": "wav",
            },
        }

    source = (audio_source or "").strip()
    if not source:
        raise ValueError("请提供音频路径/URL，或接入 ComfyUI 的 AUDIO 输入。")

    lower_source = source.lower()
    if lower_source.startswith("data:audio/"):
        header, sep, payload = source.partition(",")
        if not sep or not payload:
            raise ValueError("data URI 音频内容无效。")
        if "wav" in header:
            audio_format = "wav"
        elif "mpeg" in header or "mp3" in header:
            audio_format = "mp3"
        else:
            raise ValueError("当前 Gemma4 TE 音频节点仅支持 WAV 或 MP3 的 data URI。")
        return {
            "type": "input_audio",
            "input_audio": {
                "data": payload,
                "format": audio_format,
            },
        }

    if lower_source.startswith("http://") or lower_source.startswith("https://"):
        req = urllib.request.Request(source, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as response:
            audio_bytes = response.read()
            content_type = (response.headers.get("Content-Type", "") or "").lower()

        if not audio_bytes:
            raise ValueError(f"下载音频失败或内容为空：{source}")

        if "wav" in content_type or lower_source.endswith(".wav"):
            audio_format = "wav"
        elif "mpeg" in content_type or "mp3" in content_type or lower_source.endswith(".mp3"):
            audio_format = "mp3"
        else:
            raise ValueError("当前 Gemma4 TE 音频节点仅支持在线 WAV/MP3 音频。")

        return {
            "type": "input_audio",
            "input_audio": {
                "data": base64.b64encode(audio_bytes).decode("utf-8"),
                "format": audio_format,
            },
        }

    if not os.path.exists(source):
        raise FileNotFoundError(f"找不到音频文件：{source}")

    ext = os.path.splitext(source)[1].lower()
    if ext == ".wav":
        audio_format = "wav"
    elif ext == ".mp3":
        audio_format = "mp3"
    else:
        raise ValueError("当前 Gemma4 TE 音频节点先支持本地 WAV/MP3 文件。若要用其他格式，可先转成 WAV 或 MP3。")

    with open(source, "rb") as f:
        audio_b64 = base64.b64encode(f.read()).decode("utf-8")

    return {
        "type": "input_audio",
        "input_audio": {
            "data": audio_b64,
            "format": audio_format,
        },
    }


def _本地图片文件转data_uri(image_path: str, 最大边长: int) -> str:
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"找不到图片文件：{image_path}")

    with Image.open(image_path) as pil:
        if pil.mode != "RGB":
            pil = pil.convert("RGB")
        pil = _缩放图片到最大边(pil, 最大边长)
        buf = io.BytesIO()
        pil.save(buf, format="JPEG", quality=90)
    image_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{image_b64}"


def _构建gemma4图片输入项(image_source: str = "", comfy_image=None, *, 最大边长: int = 1024) -> list[dict]:
    image_items: list[dict] = []

    if comfy_image is not None:
        total_images = int(comfy_image.shape[0]) if hasattr(comfy_image, "shape") else 0
        for index in range(total_images):
            img_b64 = _批量图片索引转base64(comfy_image, index, int(最大边长))
            if not img_b64:
                continue
            image_items.append(
                {
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"},
                }
            )
        return image_items

    source = (image_source or "").strip()
    if not source:
        return image_items

    lower_source = source.lower()
    if lower_source.startswith("data:image/"):
        image_items.append({"type": "image_url", "image_url": {"url": source}})
        return image_items

    if lower_source.startswith("http://") or lower_source.startswith("https://"):
        image_items.append({"type": "image_url", "image_url": {"url": source}})
        return image_items

    image_items.append(
        {
            "type": "image_url",
            "image_url": {"url": _本地图片文件转data_uri(source, int(最大边长))},
        }
    )
    return image_items


@dataclass
class _QwenModel:
    llm: object
    settings: dict
    chat_handler: object | None = None


class _QwenStorage:
    model: _QwenModel | None = None

    @classmethod
    def unload(cls) -> None:
        try:
            if cls.model and getattr(cls.model.llm, "close", None):
                cls.model.llm.close()
        except Exception:
            pass
        cls.model = None
        gc.collect()
        mm.soft_empty_cache()

    @classmethod
    def load(cls, config: dict) -> _QwenModel:
        if Llama is None:
            _抛出llama_cpp不可用错误()

        if cls.model and cls.model.settings == config:
            return cls.model

        cls.unload()

        model_path = _获取_llm文件路径(config["model"])
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"找不到模型文件：{model_path}")

        mmproj = config.get("mmproj", "无")
        mmproj_path = None
        if mmproj and mmproj != "无":
            mmproj_path = _获取_llm文件路径(mmproj)
            if not os.path.exists(mmproj_path):
                raise FileNotFoundError(f"找不到 mmproj 文件：{mmproj_path}")

        family = config["family"]
        think = config["think"]
        preserve_thinking = bool(config.get("preserve_thinking", False))
        cpu_moe = bool(config.get("cpu_moe", False))
        n_cpu_moe = int(config.get("n_cpu_moe", 0) or 0)
        cache_type_k = config.get("cache_type_k", 默认KV缓存类型)
        cache_type_v = config.get("cache_type_v", 默认KV缓存类型)

        chat_handler = None
        if mmproj_path:
            if family == "Qwen3-VL":
                if Qwen3VLChatHandler is None:
                    raise RuntimeError("当前 llama-cpp-python 不支持 Qwen3VLChatHandler，请更新 llama-cpp-python。")
                # Qwen3 的 thinking 参数名在不同版本可能不同，这里做兜底。
                try:
                    chat_handler = _创建多模态聊天处理器(Qwen3VLChatHandler, mmproj_path, force_reasoning=think, verbose=False)
                except Exception:
                    try:
                        chat_handler = _创建多模态聊天处理器(Qwen3VLChatHandler, mmproj_path, use_think_prompt=think, verbose=False)
                    except Exception:
                        chat_handler = _创建多模态聊天处理器(Qwen3VLChatHandler, mmproj_path, verbose=False)
            elif family in ("Qwen3.5-VL", "Qwen3.6-VL"):
                chat_handler = _创建qwen35聊天处理器(
                    mmproj_path,
                    enable_thinking=think,
                    preserve_thinking=preserve_thinking,
                )
            else:
                raise ValueError(f"未知模型系列：{family}")

        n_ctx = int(config.get("n_ctx", 8192))
        n_gpu_layers = int(config.get("n_gpu_layers", -1))

        llama_kwargs = {
            "model_path": model_path,
            "chat_handler": chat_handler,
            "n_ctx": n_ctx,
            "n_gpu_layers": n_gpu_layers,
            "verbose": False,
        }

        if _llama构造参数是否可用("ctx_checkpoints") is not False:
            llama_kwargs["ctx_checkpoints"] = 0

        type_k = _解析kv缓存类型(cache_type_k)
        type_v = _解析kv缓存类型(cache_type_v)
        wants_custom_kv_type = type_k is not None or type_v is not None
        supports_type_k = _llama构造参数是否可用("type_k")
        supports_type_v = _llama构造参数是否可用("type_v")

        if wants_custom_kv_type and (supports_type_k is False or supports_type_v is False):
            raise RuntimeError("当前 llama-cpp-python 不支持 type_k/type_v（KV cache 量化），请更新该依赖后再使用 q8_0。")

        if type_k is not None:
            llama_kwargs["type_k"] = type_k
        if type_v is not None:
            llama_kwargs["type_v"] = type_v

        if family == "Qwen3.6-VL":
            supports_cpu_moe = _llama构造参数是否可用("cpu_moe")
            supports_n_cpu_moe = _llama构造参数是否可用("n_cpu_moe")

            wants_cpu_moe = cpu_moe
            wants_n_cpu_moe = n_cpu_moe > 0 and not cpu_moe

            if (wants_cpu_moe and supports_cpu_moe is False) or (wants_n_cpu_moe and supports_n_cpu_moe is False):
                raise RuntimeError("当前 llama-cpp-python 不支持 cpu_moe / n_cpu_moe，请更新到 0.3.37 或更高版本。")

            if wants_cpu_moe:
                llama_kwargs["cpu_moe"] = True
            elif wants_n_cpu_moe:
                llama_kwargs["n_cpu_moe"] = n_cpu_moe

        llm = Llama(**llama_kwargs)

        cls.model = _QwenModel(llm=llm, settings=dict(config), chat_handler=chat_handler)
        return cls.model


class _Gemma4Storage:
    model: _QwenModel | None = None

    @classmethod
    def unload(cls) -> None:
        try:
            if cls.model and getattr(cls.model.llm, "close", None):
                cls.model.llm.close()
        except Exception:
            pass
        cls.model = None
        gc.collect()
        mm.soft_empty_cache()

    @classmethod
    def load(cls, config: dict) -> _QwenModel:
        if Llama is None:
            _抛出llama_cpp不可用错误()

        if Gemma4ChatHandler is None:
            raise RuntimeError("当前 llama-cpp-python 不支持 Gemma4ChatHandler，请先合入或安装带 Gemma4 支持的版本。")

        if cls.model and cls.model.settings == config:
            return cls.model

        cls.unload()

        model_path = _获取_llm文件路径(config["model"])
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"找不到模型文件：{model_path}")

        mmproj = config.get("mmproj", "无")
        mmproj_path = None
        if mmproj and mmproj != "无":
            mmproj_path = _获取_llm文件路径(mmproj)
            if not os.path.exists(mmproj_path):
                raise FileNotFoundError(f"找不到 mmproj 文件：{mmproj_path}")

        think = bool(config.get("think", False))
        cache_type_k = config.get("cache_type_k", 默认KV缓存类型)
        cache_type_v = config.get("cache_type_v", 默认KV缓存类型)

        chat_handler = None
        if mmproj_path:
            chat_handler = _创建多模态聊天处理器(
                Gemma4ChatHandler,
                mmproj_path,
                enable_thinking=think,
                verbose=False,
            )

        n_ctx = int(config.get("n_ctx", 8192))
        n_gpu_layers = int(config.get("n_gpu_layers", -1))

        llama_kwargs = {
            "model_path": model_path,
            "chat_handler": chat_handler,
            "n_ctx": n_ctx,
            "n_gpu_layers": n_gpu_layers,
            "verbose": False,
        }

        if _llama构造参数是否可用("ctx_checkpoints") is not False:
            llama_kwargs["ctx_checkpoints"] = 0

        type_k = _解析kv缓存类型(cache_type_k)
        type_v = _解析kv缓存类型(cache_type_v)
        wants_custom_kv_type = type_k is not None or type_v is not None
        supports_type_k = _llama构造参数是否可用("type_k")
        supports_type_v = _llama构造参数是否可用("type_v")

        if wants_custom_kv_type and (supports_type_k is False or supports_type_v is False):
            raise RuntimeError("当前 llama-cpp-python 不支持 type_k/type_v（KV cache 量化），请更新该依赖后再使用 q8_0。")

        if type_k is not None:
            llama_kwargs["type_k"] = type_k
        if type_v is not None:
            llama_kwargs["type_v"] = type_v

        llm = Llama(**llama_kwargs)

        cls.model = _QwenModel(llm=llm, settings=dict(config), chat_handler=chat_handler)
        return cls.model


def _安装全局卸载挂钩() -> None:
    """
    将 ComfyUI 全局卸载（comfy.model_management.unload_all_models）挂钩到本插件的卸载逻辑上。

    效果：
    - 点击 TEA/ComfyUI 的“释放显存/释放内存”（/free）触发全局卸载时，会同时 close 掉本插件的 llama_cpp 模型。
    """
    try:
        if hasattr(mm, "_qwen_te_unload_hook_installed") and mm._qwen_te_unload_hook_installed:
            return

        original = getattr(mm, "unload_all_models", None)
        if original is None or not callable(original):
            return

        @wraps(original)
        def wrapped_unload_all_models(*args, **kwargs):
            try:
                _QwenStorage.unload()
            except Exception:
                pass
            try:
                _Gemma4Storage.unload()
            except Exception:
                pass
            return original(*args, **kwargs)

        mm.unload_all_models = wrapped_unload_all_models
        mm._qwen_te_unload_hook_installed = True
    except Exception:
        # 不影响 ComfyUI 启动
        return


_安装全局卸载挂钩()


class QwenTE模型加载器:
    @classmethod
    def INPUT_TYPES(s):
        all_files = _列出llm文件()
        model_list = [f for f in all_files if "mmproj" not in f.lower() and os.path.splitext(f)[1].lower() in [".gguf", ".safetensors", ".bin", ".pth", ".pt"]]
        mmproj_list = ["无"] + [f for f in all_files if "mmproj" in f.lower() and os.path.splitext(f)[1].lower() in [".gguf", ".safetensors", ".bin"]]

        if not model_list:
            model_list = ["（请把模型放到 models/LLM）"]

        return {
            "required": {
                "模型系列": (["Qwen3-VL", "Qwen3.5-VL", "Qwen3.6-VL"], {"default": "Qwen3.6-VL"}),
                "主模型": (model_list, {"tooltip": "主模型文件（建议 .gguf）放到 ComfyUI/models/LLM/"}),
                "视觉投影mmproj": (mmproj_list, {"default": "无", "tooltip": "多模态需要 mmproj；纯文本可选“无”。"}),
                "启用思考": ("BOOLEAN", {"default": False, "tooltip": "Qwen3.5-VL/Qwen3.6-VL: enable_thinking；Qwen3-VL: force_reasoning/use_think_prompt。"}),
                "保留历史think": ("BOOLEAN", {"default": False, "tooltip": "仅对 Qwen3.5-VL / Qwen3.6-VL 的新版 Qwen35ChatHandler 生效。开启后，会把历史轮次中的 <think> 也保留进上下文；默认关闭以节省上下文 token。"}),
                "上下文长度": ("INT", {"default": 8192, "min": 1024, "max": 327680, "step": 256, "tooltip": "对应 llama.cpp 的 n_ctx。"}),
                "GPU层数": ("INT", {"default": -1, "min": -1, "max": 9999, "step": 1, "tooltip": "对应 llama.cpp 的 n_gpu_layers；-1=尽可能多上GPU；0=纯CPU。"}),
                "KV缓存K类型": (KV缓存类型选项, {"default": 默认KV缓存类型, "tooltip": "对应 llama.cpp 的 --cache-type-k / type_k。推荐默认；q8_0-27B模型以上可能提速。"}),
                "KV缓存V类型": (KV缓存类型选项, {"default": 默认KV缓存类型, "tooltip": "对应 llama.cpp 的 --cache-type-v / type_v。推荐默认；q8_0-27B模型以上可能提速。"}),
                "MoE专家上CPU": ("BOOLEAN", {"default": False, "tooltip": "仅对 Qwen3.6-VL 生效。开启后把全部 MoE 专家权重放到 CPU 内存；通常用于显存不够时保命，不一定更快。"}),
                "前N层专家上CPU": ("INT", {"default": 0, "min": 0, "max": 256, "step": 1, "tooltip": "仅对 Qwen3.6-VL 生效。>0 时把前 N 层的 MoE 专家权重放到 CPU；若同时开启“MoE专家上CPU”，则此项忽略。"}),
            }
        }

    RETURN_TYPES = ("QWENLLAMA",)
    RETURN_NAMES = ("qwen模型",)
    FUNCTION = "load"
    CATEGORY = "Qwen TE"

    def load(self, 模型系列, 主模型, 视觉投影mmproj, 启用思考, 保留历史think, 上下文长度, GPU层数, KV缓存K类型, KV缓存V类型, MoE专家上CPU, 前N层专家上CPU):
        if 主模型.startswith("（请把模型放到"):
            raise RuntimeError("未找到可用模型文件。请把模型放到 ComfyUI/models/LLM/ 后重启。")

        config = {
            "family": 模型系列,
            "model": 主模型,
            "mmproj": 视觉投影mmproj,
            "think": bool(启用思考),
            "preserve_thinking": bool(保留历史think),
            "cpu_moe": bool(MoE专家上CPU),
            "n_cpu_moe": int(前N层专家上CPU),
            "n_ctx": int(上下文长度),
            "n_gpu_layers": int(GPU层数),
            "cache_type_k": KV缓存K类型,
            "cache_type_v": KV缓存V类型,
        }
        model = _QwenStorage.load(config)
        return (model,)


class QwenTE图像推理:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "qwen模型": ("QWENLLAMA",),
                "输入模式": (["图片", "逐帧", "视频", "文本"], {"default": "图片", "tooltip": "图片=只读第1张；逐帧=一张一张推理；视频=抽帧后一次性推理；文本=仅文字输入，无需图片。"}),
                "提示词": ("STRING", {"default": 默认图片提示词, "multiline": True}),
                "系统提示词": ("STRING", {"default": 默认图片系统提示词, "multiline": True}),
                "最多帧数": ("INT", {"default": 24, "min": 2, "max": 1024, "step": 1, "tooltip": "视频模式下从输入图片序列中均匀抽取的帧数。"}),
                "最大边长": ("INT", {"default": 1024, "min": 128, "max": 16384, "step": 64, "tooltip": "对输入图片做缩放以提速（取最长边）。"}),
                "最大生成token": ("INT", {"default": 1024, "min": 20, "max": 0xffffffffffffffff, "step": 1, "tooltip": "UI 使用 64 位整数上限，实际生成长度仍受模型上下文长度与可用显存约束。"}),
                "温度": ("FLOAT", {"default": 0.7, "min": 0.0, "max": 2.0, "step": 0.01}),
                "top_p": ("FLOAT", {"default": 0.9, "min": 0.0, "max": 1.0, "step": 0.01}),
                "top_k": ("INT", {"default": 20, "min": 0, "max": 200, "step": 1}),
                "重复惩罚": ("FLOAT", {"default": 1.0, "min": 0.5, "max": 2.0, "step": 0.01}),
                "频率惩罚": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 2.0, "step": 0.01}),
                "存在惩罚": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 2.0, "step": 0.01}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff, "step": 1, "control_after_generate": True, "tooltip": "随机种子。可用 ComfyUI 的生成后控制来固定、递增、递减或随机。"}),
                "输出think块": ("BOOLEAN", {"default": True, "tooltip": "开启=保留模型原始 `<think>...</think>` 输出；关闭=仅在最终结果里移除 think 块。"}),
                "生成后自动卸载模型": ("BOOLEAN", {"default": False, "tooltip": "生成完成后自动执行 Qwen llama TE 卸载模型，释放模型显存。"}),
            },
            "optional": {
                "图片": ("IMAGE",),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("文本",)
    FUNCTION = "run"
    CATEGORY = "Qwen TE"

    def run(
        self,
        qwen模型,
        输入模式,
        提示词,
        系统提示词,
        最多帧数,
        最大边长,
        最大生成token,
        温度,
        top_p,
        top_k,
        重复惩罚,
        频率惩罚,
        存在惩罚,
        seed,
        输出think块,
        生成后自动卸载模型=False,
        图片=None,
    ):
        # 卸载后 / 引用失效时：自动重载与同步到当前有效模型
        need_reload = False
        if _QwenStorage.model is None:
            need_reload = True
        elif qwen模型 is not _QwenStorage.model:
            if hasattr(qwen模型, "settings") and getattr(qwen模型, "settings") == _QwenStorage.model.settings:
                qwen模型 = _QwenStorage.model
            else:
                need_reload = True

        if need_reload:
            if not hasattr(qwen模型, "settings"):
                raise RuntimeError("输入的模型对象缺少配置信息，无法自动重载。请先运行“Qwen TE 模型加载器”。")
            _QwenStorage.load(qwen模型.settings)
            qwen模型 = _QwenStorage.model

        if not hasattr(qwen模型, "llm") or qwen模型.llm is None:
            raise RuntimeError("模型对象内部 llm 实例无效，请检查模型文件完整性，或重新加载模型。")

        llm = qwen模型.llm

        messages = []
        system_text = (系统提示词 or "").strip()

        if 输入模式 == "文本":
            if not system_text or system_text == 默认图片系统提示词:
                system_text = 默认文本系统提示词
        elif 输入模式 == "视频" and system_text:
            system_text = "请将输入的图片序列当做视频而不是静态帧序列, " + system_text

        if system_text:
            messages.append({"role": "system", "content": system_text})

        total_images = int(图片.shape[0]) if 图片 is not None else 0
        if 输入模式 in ("图片", "逐帧", "视频") and total_images == 0:
            raise ValueError("未检测到图片输入。")

        if 输入模式 == "图片":
            frame_indices = [0]
        elif 输入模式 == "逐帧":
            frame_indices = list(range(total_images))
        elif 输入模式 == "视频":
            if total_images == 1:
                frame_indices = [0]
            else:
                count = min(max(int(最多帧数), 2), total_images)
                frame_indices = np.linspace(0, total_images - 1, count, dtype=int).tolist()
        elif 输入模式 == "文本":
            frame_indices = []
        else:
            raise ValueError(f"未知输入模式：{输入模式}")

        params = {
            "max_tokens": int(最大生成token),
            "temperature": float(温度),
            "top_p": float(top_p),
            "top_k": int(top_k),
            "repeat_penalty": float(重复惩罚),
            "frequency_penalty": float(频率惩罚),
            "presence_penalty": float(存在惩罚),
            "seed": _规范化随机种子(seed),
            "stream": False,
            "stop": ["</s>"],
        }

        prompt_text = (提示词 or "").strip()
        if 输入模式 == "文本":
            if not prompt_text:
                raise ValueError("文本模式下，提示词不能为空。")

            messages.append({"role": "user", "content": prompt_text})
            _重置llm推理状态(llm)
            out = _调用chat_completion(llm, messages=messages, params=params)
            try:
                text = out["choices"][0]["message"]["content"]
            except Exception:
                text = str(out)
        elif 输入模式 == "逐帧":
            user_content = [{"type": "text", "text": prompt_text}, {"type": "image_url", "image_url": {"url": ""}}]
            messages.append({"role": "user", "content": user_content})

            out_parts = []
            for idx, frame_index in enumerate(frame_indices):
                if mm.processing_interrupted():
                    raise mm.InterruptProcessingException()
                img_b64 = _批量图片索引转base64(图片, frame_index, int(最大边长))
                if not img_b64:
                    continue
                user_content[1]["image_url"]["url"] = f"data:image/jpeg;base64,{img_b64}"
                _重置llm推理状态(llm)
                out = _调用chat_completion(llm, messages=messages, params=params)
                try:
                    part = out["choices"][0]["message"]["content"]
                except Exception:
                    part = str(out)
                if len(frame_indices) > 1:
                    out_parts.append(f"====== 第{idx+1}帧 ======\n{part}".strip())
                else:
                    out_parts.append(str(part).strip())
            text = "\n\n".join([p for p in out_parts if p])
        else:
            user_content = [{"type": "text", "text": prompt_text}]
            for frame_index in frame_indices:
                img_b64 = _批量图片索引转base64(图片, frame_index, int(最大边长))
                if not img_b64:
                    continue
                user_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}})
            messages.append({"role": "user", "content": user_content})
            _重置llm推理状态(llm)
            out = _调用chat_completion(llm, messages=messages, params=params)
            try:
                text = out["choices"][0]["message"]["content"]
            except Exception:
                text = str(out)

        if not bool(输出think块):
            text = _清洗think块文本(text)

        if mm.processing_interrupted():
            raise mm.InterruptProcessingException()

        result_text = text.lstrip().removeprefix(": ").strip()
        if bool(生成后自动卸载模型):
            _QwenStorage.unload()
        return (result_text,)


class QwenTE卸载模型:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"任意输入": (any_type,)}}

    RETURN_TYPES = (any_type,)
    RETURN_NAMES = ("任意输出",)
    FUNCTION = "run"
    CATEGORY = "Qwen TE"

    def run(self, 任意输入):
        _QwenStorage.unload()
        return (任意输入,)


class Gemma4TE模型加载器:
    @classmethod
    def INPUT_TYPES(s):
        all_files = _列出llm文件()
        model_list = [f for f in all_files if "mmproj" not in f.lower() and os.path.splitext(f)[1].lower() in [".gguf", ".safetensors", ".bin", ".pth", ".pt"]]
        mmproj_list = ["无"] + [f for f in all_files if "mmproj" in f.lower() and os.path.splitext(f)[1].lower() in [".gguf", ".safetensors", ".bin"]]

        if not model_list:
            model_list = ["（请把模型放到 models/LLM）"]

        return {
            "required": {
                "主模型": (model_list, {"tooltip": "Gemma4 主模型文件（建议 .gguf）放到 ComfyUI/models/LLM/"}),
                "视觉投影mmproj": (mmproj_list, {"default": "无", "tooltip": "Gemma4 多模态需要 mmproj；E2B/E4B 音频建议使用 BF16 mmproj。纯文本可选“无”。"}),
                "启用思考": ("BOOLEAN", {"default": False, "tooltip": "Gemma4 专用 enable_thinking；新版 handler 注明主要适用于 31B/26BA4B，E2B/E4B 通常保持默认。"}),
                "上下文长度": ("INT", {"default": 8192, "min": 1024, "max": 327680, "step": 256, "tooltip": "对应 llama.cpp 的 n_ctx。"}),
                "GPU层数": ("INT", {"default": -1, "min": -1, "max": 9999, "step": 1, "tooltip": "对应 llama.cpp 的 n_gpu_layers；-1=尽可能多上GPU；0=纯CPU。"}),
                "KV缓存K类型": (KV缓存类型选项, {"default": 默认KV缓存类型, "tooltip": "对应 llama.cpp 的 --cache-type-k / type_k。"}),
                "KV缓存V类型": (KV缓存类型选项, {"default": 默认KV缓存类型, "tooltip": "对应 llama.cpp 的 --cache-type-v / type_v。"}),
            }
        }

    RETURN_TYPES = ("GEMMA4LLAMA",)
    RETURN_NAMES = ("gemma4模型",)
    FUNCTION = "load"
    CATEGORY = "Gemma4 TE"

    def load(self, 主模型, 视觉投影mmproj, 启用思考, 上下文长度, GPU层数, KV缓存K类型, KV缓存V类型):
        if 主模型.startswith("（请把模型放到"):
            raise RuntimeError("未找到可用模型文件。请把模型放到 ComfyUI/models/LLM/ 后重启。")

        config = {
            "family": "Gemma4",
            "model": 主模型,
            "mmproj": 视觉投影mmproj,
            "think": bool(启用思考),
            "n_ctx": int(上下文长度),
            "n_gpu_layers": int(GPU层数),
            "cache_type_k": KV缓存K类型,
            "cache_type_v": KV缓存V类型,
        }
        model = _Gemma4Storage.load(config)
        return (model,)


class Gemma4TE图像推理:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "gemma4模型": ("GEMMA4LLAMA",),
                "输入模式": (["图片", "逐帧", "视频", "文本"], {"default": "图片", "tooltip": "图片=只读第1张；逐帧=一张一张推理；视频=抽帧后一次性推理；文本=仅文字输入，无需图片。"}),
                "提示词": ("STRING", {"default": 默认图片提示词, "multiline": True}),
                "系统提示词": ("STRING", {"default": 默认图片系统提示词, "multiline": True}),
                "最多帧数": ("INT", {"default": 24, "min": 2, "max": 1024, "step": 1, "tooltip": "视频模式下从输入图片序列中均匀抽取的帧数。"}),
                "最大边长": ("INT", {"default": 1024, "min": 128, "max": 16384, "step": 64, "tooltip": "对输入图片做缩放以提速（取最长边）。"}),
                "最大生成token": ("INT", {"default": 1024, "min": 20, "max": 8192, "step": 1, "tooltip": "Gemma4 官方图片示例使用 512；文本长回复可手动调大。"}),
                "温度": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 2.0, "step": 0.01, "tooltip": "Gemma4 官方推荐采样配置：temperature=1.0。"}),
                "top_p": ("FLOAT", {"default": 0.95, "min": 0.0, "max": 1.0, "step": 0.01, "tooltip": "Gemma4 官方推荐采样配置：top_p=0.95。"}),
                "top_k": ("INT", {"default": 64, "min": 0, "max": 200, "step": 1, "tooltip": "Gemma4 官方推荐采样配置：top_k=64。"}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff, "step": 1, "control_after_generate": True, "tooltip": "随机种子。可用 ComfyUI 的生成后控制来固定、递增、递减或随机。"}),
                "输出think块": ("BOOLEAN", {"default": False, "tooltip": "开启=尽量保留 Gemma4 思考文本；关闭=只保留最终答案，并清理通道控制标记。"}),
                "思考预算token": ("INT", {"default": -1, "min": -1, "max": 8192, "step": 1, "tooltip": "新版 llama-cpp-python reasoning_budget。-1=不限制；0=进入思考后立即结束；>0=限制首个 Gemma4 thought 通道 token 数。"}),
            },
            "optional": {
                "图片": ("IMAGE",),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("文本",)
    FUNCTION = "run"
    CATEGORY = "Gemma4 TE"

    def run(
        self,
        gemma4模型,
        输入模式,
        提示词,
        系统提示词,
        最多帧数,
        最大边长,
        最大生成token,
        温度,
        top_p,
        top_k,
        seed,
        输出think块,
        思考预算token=-1,
        图片=None,
    ):
        need_reload = False
        if _Gemma4Storage.model is None:
            need_reload = True
        elif gemma4模型 is not _Gemma4Storage.model:
            if hasattr(gemma4模型, "settings") and getattr(gemma4模型, "settings") == _Gemma4Storage.model.settings:
                gemma4模型 = _Gemma4Storage.model
            else:
                need_reload = True

        if need_reload:
            if not hasattr(gemma4模型, "settings"):
                raise RuntimeError("输入的 Gemma4 模型对象缺少配置信息，无法自动重载。请先运行“Gemma4 TE 模型加载器”。")
            _Gemma4Storage.load(gemma4模型.settings)
            gemma4模型 = _Gemma4Storage.model

        if not hasattr(gemma4模型, "llm") or gemma4模型.llm is None:
            raise RuntimeError("Gemma4 模型对象内部 llm 实例无效，请检查模型文件完整性，或重新加载模型。")

        llm = gemma4模型.llm
        chat_handler = getattr(gemma4模型, "chat_handler", None)

        messages = []
        system_text = (系统提示词 or "").strip()

        if 输入模式 == "文本":
            if not system_text or system_text == 默认图片系统提示词:
                system_text = 默认文本系统提示词
        elif 输入模式 == "视频" and system_text:
            system_text = "请将输入的图片序列当做视频而不是静态帧序列, " + system_text

        if system_text:
            messages.append({"role": "system", "content": system_text})

        total_images = int(图片.shape[0]) if 图片 is not None else 0
        if 输入模式 in ("图片", "逐帧", "视频") and total_images == 0:
            raise ValueError("未检测到图片输入。")
        if 输入模式 in ("图片", "逐帧", "视频") and chat_handler is None:
            raise RuntimeError("当前 Gemma4 模型未加载 mmproj，无法进行图像推理。请在“Gemma4 TE 模型加载器”里选择对应的 mmproj。")

        if 输入模式 == "图片":
            frame_indices = [0]
        elif 输入模式 == "逐帧":
            frame_indices = list(range(total_images))
        elif 输入模式 == "视频":
            if total_images == 1:
                frame_indices = [0]
            else:
                count = min(max(int(最多帧数), 2), total_images)
                frame_indices = np.linspace(0, total_images - 1, count, dtype=int).tolist()
        elif 输入模式 == "文本":
            frame_indices = []
        else:
            raise ValueError(f"未知输入模式：{输入模式}")

        params = {
            "max_tokens": int(最大生成token),
            "temperature": float(温度),
            "top_p": float(top_p),
            "top_k": int(top_k),
            "seed": _规范化随机种子(seed),
            "stream": False,
            "stop": ["</s>"],
        }
        reasoning_budget = int(思考预算token)
        if reasoning_budget >= 0:
            params.update({
                "reasoning_budget": reasoning_budget,
                "reasoning_start": "<|channel>",
                "reasoning_end": "<channel|>",
                "reasoning_start_max_tokens": None,
            })

        prompt_text = (提示词 or "").strip()
        if 输入模式 == "文本":
            if not prompt_text:
                raise ValueError("文本模式下，提示词不能为空。")

            messages.append({"role": "user", "content": prompt_text})
            _重置llm推理状态(llm)
            out = _调用chat_completion(llm, messages=messages, params=params)
            try:
                text = out["choices"][0]["message"]["content"]
            except Exception:
                text = str(out)
        elif 输入模式 == "逐帧":
            user_content = [{"type": "text", "text": prompt_text}, {"type": "image_url", "image_url": {"url": ""}}]
            messages.append({"role": "user", "content": user_content})

            out_parts = []
            for idx, frame_index in enumerate(frame_indices):
                if mm.processing_interrupted():
                    raise mm.InterruptProcessingException()
                img_b64 = _批量图片索引转base64(图片, frame_index, int(最大边长))
                if not img_b64:
                    continue
                user_content[1]["image_url"]["url"] = f"data:image/jpeg;base64,{img_b64}"
                _重置llm推理状态(llm)
                out = _调用chat_completion(llm, messages=messages, params=params)
                try:
                    part = out["choices"][0]["message"]["content"]
                except Exception:
                    part = str(out)
                part = _清洗gemma4输出文本(part, bool(输出think块))
                if len(frame_indices) > 1:
                    out_parts.append(f"====== 第{idx+1}帧 ======\n{part}".strip())
                else:
                    out_parts.append(str(part).strip())
            text = "\n\n".join([p for p in out_parts if p])
        else:
            user_content = [{"type": "text", "text": prompt_text}]
            for frame_index in frame_indices:
                img_b64 = _批量图片索引转base64(图片, frame_index, int(最大边长))
                if not img_b64:
                    continue
                user_content.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{img_b64}"}})
            messages.append({"role": "user", "content": user_content})
            _重置llm推理状态(llm)
            out = _调用chat_completion(llm, messages=messages, params=params)
            try:
                text = out["choices"][0]["message"]["content"]
            except Exception:
                text = str(out)

        text = _清洗gemma4输出文本(text, bool(输出think块))

        if mm.processing_interrupted():
            raise mm.InterruptProcessingException()

        return (text.lstrip().removeprefix(": ").strip(),)


class Gemma4TE卸载模型:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"任意输入": (any_type,)}}

    RETURN_TYPES = (any_type,)
    RETURN_NAMES = ("任意输出",)
    FUNCTION = "run"
    CATEGORY = "Gemma4 TE"

    def run(self, 任意输入):
        _Gemma4Storage.unload()
        return (任意输入,)


class Gemma4TE音频推理:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "gemma4模型": ("GEMMA4LLAMA",),
                "音频路径或URL": ("STRING", {"default": "", "multiline": False, "tooltip": "可直接填本地 WAV/MP3 路径、data:audio/... URI；如果同时接了 AUDIO 口，则优先使用 AUDIO。"}),
                "图片路径或URL": ("STRING", {"default": "", "multiline": False, "tooltip": "可选。支持本地图片路径、http(s) 图片 URL、data:image/... URI；用于 Gemma4 新版图音联合输入。"}),
                "提示词": ("STRING", {"default": 默认音频提示词, "multiline": True}),
                "系统提示词": ("STRING", {"default": 默认音频系统提示词, "multiline": True}),
                "最大边长": ("INT", {"default": 1024, "min": 128, "max": 16384, "step": 64, "tooltip": "仅用于本地图片或 ComfyUI 图片输入的缩放，取最长边。"}),
                "最大生成token": ("INT", {"default": 1024, "min": 20, "max": 8192, "step": 1, "tooltip": "Gemma4 官方多模态示例常用 512；需要更长回复时可调大。"}),
                "温度": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 2.0, "step": 0.01, "tooltip": "Gemma4 官方推荐采样配置：temperature=1.0。"}),
                "top_p": ("FLOAT", {"default": 0.95, "min": 0.0, "max": 1.0, "step": 0.01, "tooltip": "Gemma4 官方推荐采样配置：top_p=0.95。"}),
                "top_k": ("INT", {"default": 64, "min": 0, "max": 200, "step": 1, "tooltip": "Gemma4 官方推荐采样配置：top_k=64。"}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff, "step": 1, "control_after_generate": True, "tooltip": "随机种子。可用 ComfyUI 的生成后控制来固定、递增、递减或随机。"}),
                "输出think块": ("BOOLEAN", {"default": False, "tooltip": "开启=尽量保留 Gemma4 思考文本；关闭=只保留最终答案，并清理通道控制标记。Gemma4 E2B/E4B 做音频时建议使用 BF16 mmproj。"}),
                "思考预算token": ("INT", {"default": -1, "min": -1, "max": 8192, "step": 1, "tooltip": "新版 llama-cpp-python reasoning_budget。-1=不限制；0=进入思考后立即结束；>0=限制首个 Gemma4 thought 通道 token 数。"}),
            },
            "optional": {
                "音频": ("AUDIO",),
                "图片": ("IMAGE",),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("文本",)
    FUNCTION = "run"
    CATEGORY = "Gemma4 TE"

    def run(
        self,
        gemma4模型,
        音频路径或URL,
        图片路径或URL,
        提示词,
        系统提示词,
        最大边长,
        最大生成token,
        温度,
        top_p,
        top_k,
        seed,
        输出think块,
        思考预算token=-1,
        音频=None,
        图片=None,
    ):
        need_reload = False
        if _Gemma4Storage.model is None:
            need_reload = True
        elif gemma4模型 is not _Gemma4Storage.model:
            if hasattr(gemma4模型, "settings") and getattr(gemma4模型, "settings") == _Gemma4Storage.model.settings:
                gemma4模型 = _Gemma4Storage.model
            else:
                need_reload = True

        if need_reload:
            if not hasattr(gemma4模型, "settings"):
                raise RuntimeError("输入的 Gemma4 模型对象缺少配置信息，无法自动重载。请先运行“Gemma4 TE 模型加载器”。")
            _Gemma4Storage.load(gemma4模型.settings)
            gemma4模型 = _Gemma4Storage.model

        if not hasattr(gemma4模型, "llm") or gemma4模型.llm is None:
            raise RuntimeError("Gemma4 模型对象内部 llm 实例无效，请检查模型文件完整性，或重新加载模型。")

        llm = gemma4模型.llm
        chat_handler = getattr(gemma4模型, "chat_handler", None)

        if chat_handler is None:
            raise RuntimeError("当前 Gemma4 模型未加载 mmproj，无法进行音频推理。请在“Gemma4 TE 模型加载器”里选择对应的 mmproj。")

        prompt_text = (提示词 or "").strip()
        system_text = (系统提示词 or "").strip()

        messages = []
        if system_text:
            messages.append({"role": "system", "content": system_text})

        user_content = []
        if prompt_text:
            user_content.append({"type": "text", "text": prompt_text})
        user_content.extend(
            _构建gemma4图片输入项(
                图片路径或URL,
                图片,
                最大边长=int(最大边长),
            )
        )
        user_content.append(_构建gemma4音频输入项(音频路径或URL, 音频))
        messages.append({"role": "user", "content": user_content})

        params = {
            "max_tokens": int(最大生成token),
            "temperature": float(温度),
            "top_p": float(top_p),
            "top_k": int(top_k),
            "seed": _规范化随机种子(seed),
            "stream": False,
            "stop": ["</s>"],
        }
        reasoning_budget = int(思考预算token)
        if reasoning_budget >= 0:
            params.update({
                "reasoning_budget": reasoning_budget,
                "reasoning_start": "<|channel>",
                "reasoning_end": "<channel|>",
                "reasoning_start_max_tokens": None,
            })

        _重置llm推理状态(llm)
        out = _调用chat_completion(llm, messages=messages, params=params)
        try:
            text = out["choices"][0]["message"]["content"]
        except Exception:
            text = str(out)

        text = _清洗gemma4输出文本(text, bool(输出think块))

        if mm.processing_interrupted():
            raise mm.InterruptProcessingException()

        return (text.lstrip().removeprefix(": ").strip(),)
