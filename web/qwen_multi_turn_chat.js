import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_CLASS = "QwenTE_MultiTurnChat";
const CHAT_MIN_HEIGHT = 260;
const CHAT_NODE_CHROME_HEIGHT = 110;
const CHAT_WIDGET_PADDING = 10;
const CHAT_FONT_SIZE_DEFAULT = 15;
const CHAT_FONT_SIZE_MIN = 11;
const CHAT_FONT_SIZE_MAX = 28;
let activeImagePreview = null;
let activeImagePreviewKeyHandler = null;

function injectStyles() {
    if (document.getElementById("qwen-te-chat-styles")) return;

    const style = document.createElement("style");
    style.id = "qwen-te-chat-styles";
    style.textContent = `
        .qwen-te-chat {
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 8px;
            width: 100%;
            height: 100%;
            min-height: 260px;
            padding: 8px;
            color: var(--input-text, #e5e7eb);
            background: var(--comfy-menu-bg, #202124);
            border: 1px solid var(--border-color, #444);
            border-radius: 6px;
            font: 13px/1.45 Arial, sans-serif;
        }
        .qwen-te-chat__messages {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            padding: 2px;
            scrollbar-width: thin;
        }
        .qwen-te-chat__flow {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            min-height: 44px;
            color: #b8c0ca;
            font-size: 11px;
        }
        .qwen-te-chat__flow-summary {
            display: flex;
            flex: 1 1 auto;
            align-items: center;
            gap: 7px;
            min-width: 0;
            overflow: hidden;
        }
        .qwen-te-chat__flow-tools {
            box-sizing: border-box;
            display: flex;
            height: 44px;
            flex: 0 0 auto;
            align-items: center;
            gap: 6px;
            padding: 2px 4px;
            background: #25272a;
            border: 1px solid #3d4146;
            border-radius: 5px;
        }
        .qwen-te-chat__stage {
            max-width: 76px;
            flex: 0 1 auto;
            overflow: hidden;
            padding: 3px 7px;
            color: #f4c982;
            border: 1px solid #765d32;
            border-radius: 4px;
            background: #332b1d;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .qwen-te-chat__skill {
            flex: 1 1 auto;
            min-width: 0;
            overflow: hidden;
            color: #9daab8;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .qwen-te-chat__font-size {
            box-sizing: border-box;
            display: grid;
            grid-template-columns: 18px 24px 18px;
            width: 62px;
            height: 24px;
            flex: 0 0 62px;
            align-items: center;
            overflow: hidden;
            color: #b8c0ca;
            background: #292c30;
            border: 1px solid #464b51;
            border-radius: 4px;
        }
        .qwen-te-chat__font-button {
            width: 18px;
            height: 22px;
            padding: 0;
            color: #c7ced6;
            background: transparent;
            border: 0;
            cursor: pointer;
            font: 15px/22px Arial, sans-serif;
        }
        .qwen-te-chat__font-button:hover:not(:disabled) {
            color: #ffffff;
            background: #3a3e43;
        }
        .qwen-te-chat__font-button:disabled {
            cursor: default;
            opacity: 0.3;
        }
        .qwen-te-chat__font-value {
            overflow: hidden;
            text-align: center;
            color: #dce2e8;
            font: 10px/22px Arial, sans-serif;
            white-space: nowrap;
        }
        .qwen-te-chat__unload {
            height: 28px;
            flex: 0 0 auto;
            padding: 0 6px;
            color: #b8c0ca;
            background: #292c30;
            border: 1px solid #464b51;
            border-radius: 4px;
            cursor: pointer;
            font: 11px/26px Arial, sans-serif;
            white-space: nowrap;
        }
        .qwen-te-chat__unload:hover:not(:disabled) {
            color: #f2b4b4;
            background: #3a292b;
            border-color: #70454a;
        }
        .qwen-te-chat__unload:disabled {
            cursor: default;
            opacity: 0.45;
        }
        .qwen-te-chat__context {
            box-sizing: border-box;
            display: flex;
            align-items: center;
            gap: 6px;
            width: 140px;
            height: 38px;
            flex: 0 0 140px;
            padding: 0 6px;
            border-right: 1px solid #3d4146;
            border-left: 1px solid #3d4146;
        }
        .qwen-te-chat__context-ring {
            position: relative;
            display: grid;
            width: 38px;
            height: 38px;
            flex: 0 0 38px;
            place-items: center;
            border-radius: 50%;
            background: conic-gradient(#5d9f80 0deg, #45494f 0deg);
        }
        .qwen-te-chat__context-ring::after {
            position: absolute;
            inset: 4px;
            content: "";
            border-radius: 50%;
            background: var(--comfy-menu-bg, #202124);
        }
        .qwen-te-chat__context-percent {
            position: relative;
            z-index: 1;
            color: #edf1f5;
            font-size: 9px;
            font-weight: 700;
        }
        .qwen-te-chat__context-meta {
            display: flex;
            flex-direction: column;
            min-width: 0;
            line-height: 1.2;
        }
        .qwen-te-chat__context-tokens {
            color: #d6dce3;
            font-size: 10px;
            white-space: nowrap;
        }
        .qwen-te-chat__context-rounds {
            color: #aeb9c5;
            font-size: 9px;
            white-space: nowrap;
        }
        .qwen-te-chat__context-note {
            max-width: 82px;
            overflow: hidden;
            color: #88929d;
            font-size: 9px;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .qwen-te-chat__options {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            flex: 0 0 auto;
        }
        .qwen-te-chat__message-actions {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            min-height: 22px;
            margin-top: 4px;
        }
        .qwen-te-chat__message-meta {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
            overflow: hidden;
            color: #89939e;
            font-size: 10px;
            white-space: nowrap;
        }
        .qwen-te-chat__message-time {
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .qwen-te-chat__message-controls {
            display: flex;
            align-items: center;
            flex: 0 0 auto;
        }
        .qwen-te-chat__message-copy {
            width: 24px;
            height: 22px;
            padding: 0;
            color: #aeb4bd;
            background: transparent;
            border: 0;
            border-radius: 4px;
            cursor: pointer;
            font: 16px/22px Arial, sans-serif;
        }
        .qwen-te-chat__message-copy:hover {
            color: #ffffff;
            background: #3b3e43;
        }
        .qwen-te-chat__option {
            min-height: 27px;
            padding: 3px 8px;
            color: #e5edf6;
            background: #303d4b;
            border: 1px solid #4b657d;
            border-radius: 4px;
            cursor: pointer;
            font: inherit;
            text-align: left;
        }
        .qwen-te-chat__option:hover:not(:disabled) {
            background: #3c5268;
        }
        .qwen-te-chat__option:disabled {
            cursor: default;
            opacity: 0.55;
        }
        .qwen-te-chat__empty {
            display: grid;
            height: 100%;
            place-items: center;
            color: #9ca3af;
        }
        .qwen-te-chat__message {
            box-sizing: border-box;
            margin: 0 0 8px;
            padding: 7px 9px;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            border: 1px solid #414348;
            border-radius: 5px;
            background: #292b2f;
        }
        .qwen-te-chat__message--user {
            width: fit-content;
            max-width: calc(100% - 24px);
            margin-right: 0;
            margin-left: auto;
            border-color: #3f6858;
            background: #253b33;
        }
        .qwen-te-chat__role {
            display: block;
            margin-bottom: 3px;
            color: #aeb4bd;
            font-size: 11px;
            font-weight: 600;
        }
        .qwen-te-chat__message-content {
            min-width: 0;
            font-size: var(--qwen-te-chat-font-size, 15px);
            line-height: 1.55;
        }
        .qwen-te-chat__message-images {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin: 2px 0 7px;
        }
        .qwen-te-chat__message-image-link {
            position: relative;
            box-sizing: border-box;
            display: block;
            width: 96px;
            height: 72px;
            flex: 0 0 96px;
            padding: 0;
            overflow: hidden;
            color: #cfd8d3;
            background: #171a19;
            border: 1px solid #4b5f56;
            border-radius: 4px;
            cursor: zoom-in;
        }
        .qwen-te-chat__message-image {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        .qwen-te-chat__message-image-label {
            position: absolute;
            right: 5px;
            bottom: 5px;
            padding: 2px 5px;
            color: #f2f5f3;
            background: rgba(20, 24, 22, 0.78);
            border-radius: 3px;
            font-size: 10px;
            line-height: 1.2;
        }
        .qwen-te-chat__preview {
            position: fixed;
            inset: 0;
            z-index: 100000;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 42px;
            background: rgba(0, 0, 0, 0.82);
            cursor: zoom-out;
        }
        .qwen-te-chat__preview-image {
            display: block;
            max-width: min(92vw, 1400px);
            max-height: 88vh;
            object-fit: contain;
            cursor: default;
            user-select: none;
        }
        .qwen-te-chat__preview-close {
            position: fixed;
            top: 14px;
            right: 18px;
            width: 36px;
            height: 36px;
            padding: 0;
            color: #fff;
            background: rgba(28, 30, 33, 0.92);
            border: 1px solid #6b7077;
            border-radius: 4px;
            cursor: pointer;
            font: 26px/32px Arial, sans-serif;
        }
        .qwen-te-chat__preview-close:hover {
            background: #44484e;
        }
        .qwen-te-chat__code {
            overflow-x: auto;
            margin: 6px 0 2px;
            padding: 9px 10px;
            color: #e6edf3;
            background: #17191c;
            border: 1px solid #40444a;
            border-radius: 4px;
            white-space: pre;
            scrollbar-width: thin;
            font-family: Consolas, "Courier New", monospace;
            font-size: var(--qwen-te-chat-font-size, 15px);
            line-height: 1.5;
        }
        .qwen-te-chat__code-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            min-height: 22px;
            margin: -2px -3px 5px;
        }
        .qwen-te-chat__code-language {
            color: #8f9aa6;
            font: 10px/1.2 Arial, sans-serif;
        }
        .qwen-te-chat__code-copy {
            width: 24px;
            height: 22px;
            padding: 0;
            color: #aeb4bd;
            background: transparent;
            border: 0;
            border-radius: 4px;
            cursor: pointer;
            font: 16px/22px Arial, sans-serif;
        }
        .qwen-te-chat__code-copy:hover {
            color: #ffffff;
            background: #3b3e43;
        }
        .qwen-te-chat__composer {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 6px;
            flex: 0 0 auto;
        }
        .qwen-te-chat__compose-main {
            display: flex;
            flex-direction: column;
            min-width: 0;
            gap: 5px;
        }
        .qwen-te-chat__attachments {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
        }
        .qwen-te-chat__attachments:empty {
            display: none;
        }
        .qwen-te-chat__attachment {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            max-width: 100%;
            height: 24px;
            padding: 0 6px;
            color: #d9ede4;
            background: #263c33;
            border: 1px solid #416957;
            border-radius: 4px;
            font-size: 11px;
        }
        .qwen-te-chat__attachment-remove {
            width: 18px;
            height: 18px;
            padding: 0;
            color: #d7ddd9;
            background: transparent;
            border: 0;
            cursor: pointer;
            font-size: 16px;
            line-height: 16px;
        }
        .qwen-te-chat__input {
            box-sizing: border-box;
            width: 100%;
            height: 96px;
            min-height: 96px;
            max-height: 110px;
            resize: vertical;
            padding: 7px 8px;
            color: var(--input-text, #f3f4f6);
            background: var(--comfy-input-bg, #17181a);
            border: 1px solid var(--border-color, #4b4d52);
            border-radius: 4px;
            outline: none;
            font: inherit;
            font-size: var(--qwen-te-chat-font-size, 15px);
            line-height: 1.45;
        }
        .qwen-te-chat__input:focus {
            border-color: #55a07e;
        }
        .qwen-te-chat__actions {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }
        .qwen-te-chat__button {
            min-width: 58px;
            height: 28px;
            padding: 0 10px;
            color: #f4f4f5;
            background: #3b3e43;
            border: 1px solid #565a60;
            border-radius: 4px;
            cursor: pointer;
            font: inherit;
        }
        .qwen-te-chat__button:hover:not(:disabled) {
            background: #494d53;
        }
        .qwen-te-chat__button--send {
            background: #347257;
            border-color: #438e6c;
        }
        .qwen-te-chat__button--send:hover:not(:disabled) {
            background: #3d8264;
        }
        .qwen-te-chat__button:disabled {
            cursor: default;
            opacity: 0.55;
        }
        .qwen-te-chat__status {
            flex: 0 0 auto;
            min-height: 18px;
            color: #9ca3af;
            font-size: 11px;
        }
        .qwen-te-chat__status[data-state="busy"] {
            color: #72c69e;
        }
        .qwen-te-chat__status[data-state="error"] {
            color: #ef8b8b;
        }
    `;
    document.head.appendChild(style);
}

function firstValue(value) {
    return Array.isArray(value) ? value[0] : value;
}

function parseHistory(raw) {
    try {
        const value = JSON.parse(raw || "[]");
        if (!Array.isArray(value)) return [];
        return value.filter((item) =>
            item &&
            (item.role === "user" || item.role === "assistant") &&
            typeof item.content === "string"
        );
    } catch (_) {
        return [];
    }
}

function validHistoryRaw(raw) {
    if (typeof raw !== "string") return null;
    try {
        return Array.isArray(JSON.parse(raw || "")) ? raw : null;
    } catch (_) {
        return null;
    }
}

function parseImages(raw) {
    try {
        const value = JSON.parse(raw || "[]");
        if (!Array.isArray(value)) return [];
        return value.filter((item) =>
            item &&
            typeof (item.filename ?? item.name) === "string" &&
            (item.filename ?? item.name)
        ).map((item) => ({
            filename: item.filename ?? item.name,
            subfolder: item.subfolder || "",
            type: "input",
        }));
    } catch (_) {
        return [];
    }
}

function parseFlowState(raw) {
    try {
        const value = JSON.parse(raw || "{}");
        return value && typeof value === "object" ? value : {};
    } catch (_) {
        return {};
    }
}

function parseContextState(raw) {
    if (raw && typeof raw === "object") return raw;
    try {
        const value = JSON.parse(raw || "{}");
        return value && typeof value === "object" ? value : {};
    } catch (_) {
        return {};
    }
}

function formatTokenCount(value) {
    const tokens = Math.max(0, Number(value) || 0);
    if (tokens < 1000) return String(Math.round(tokens));
    const scaled = tokens / 1000;
    return `${scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1)}k`;
}

function formatMessageTime(value) {
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (part) => String(part).padStart(2, "0");
    const now = new Date();
    const sameDay =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
    const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    return sameDay ? clock : `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${clock.slice(0, 5)}`;
}

function parseOptions(raw) {
    try {
        const value = JSON.parse(raw || "[]");
        return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()) : [];
    } catch (_) {
        return [];
    }
}

function isHistoryJson(raw) {
    try {
        return Array.isArray(JSON.parse(raw || ""));
    } catch (_) {
        return false;
    }
}

async function uploadChatImage(file, index) {
    const safeName = String(file.name || "image.png").replace(/[^a-zA-Z0-9._-]+/g, "_");
    const uploadName = `qwen_chat_${Date.now()}_${index}_${safeName}`;
    const body = new FormData();
    body.append("image", file, uploadName);
    body.append("type", "input");
    body.append("subfolder", "qwen_te_chat");
    body.append("overwrite", "false");

    const response = await api.fetchApi("/upload/image", { method: "POST", body });
    if (!response?.ok) throw new Error(`图片上传失败 (${response?.status || "unknown"})`);
    const result = await response.json();
    return {
        filename: result.name || uploadName,
        subfolder: result.subfolder || "qwen_te_chat",
        type: "input",
    };
}

function hideBackendWidget(widget) {
    if (!widget) return;
    widget.type = `converted-widget:qwen-te-chat-${widget.name}`;
    widget.computeSize = () => [0, -4];
    widget.serializeValue = async () => widget.value;
    if (widget.inputEl) widget.inputEl.style.display = "none";
    if (widget.element) widget.element.style.display = "none";
}

function createElement(tag, className, text = "") {
    const element = document.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    return element;
}

function buildChatImageUrl(imageRef) {
    if (!imageRef?.filename) return "";
    const params = new URLSearchParams({
        filename: String(imageRef.filename),
        type: String(imageRef.type || "input"),
        subfolder: String(imageRef.subfolder || ""),
    });
    return api.apiURL(`/view?${params.toString()}`);
}

function closeImagePreview() {
    if (activeImagePreviewKeyHandler) {
        document.removeEventListener("keydown", activeImagePreviewKeyHandler);
        activeImagePreviewKeyHandler = null;
    }
    activeImagePreview?.remove();
    activeImagePreview = null;
}

function openImagePreview(url, label) {
    closeImagePreview();

    const overlay = createElement("div", "qwen-te-chat__preview");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", label || "图片预览");

    const image = createElement("img", "qwen-te-chat__preview-image");
    image.src = url;
    image.alt = label || "图片预览";

    const closeButton = createElement("button", "qwen-te-chat__preview-close", "×");
    closeButton.type = "button";
    closeButton.title = "关闭图片预览";
    closeButton.setAttribute("aria-label", "关闭图片预览");
    closeButton.addEventListener("click", closeImagePreview);
    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) closeImagePreview();
    });
    for (const eventName of ["pointerdown", "mousedown", "mouseup", "click", "dblclick", "wheel"]) {
        overlay.addEventListener(eventName, (event) => event.stopPropagation());
    }

    activeImagePreviewKeyHandler = (event) => {
        if (event.key === "Escape") closeImagePreview();
    };
    document.addEventListener("keydown", activeImagePreviewKeyHandler);
    overlay.append(image, closeButton);
    document.body.append(overlay);
    activeImagePreview = overlay;
    closeButton.focus();
}

function createMessageImages(imageRefs) {
    const validImages = (Array.isArray(imageRefs) ? imageRefs : [])
        .map((imageRef) => ({ imageRef, url: buildChatImageUrl(imageRef) }))
        .filter((item) => item.url);
    if (!validImages.length) return null;

    const gallery = createElement("div", "qwen-te-chat__message-images");
    validImages.forEach(({ imageRef, url }, index) => {
        const previewButton = createElement("button", "qwen-te-chat__message-image-link");
        previewButton.type = "button";
        previewButton.title = `预览图${index + 1}：${imageRef.filename}`;
        previewButton.setAttribute("aria-label", `预览图${index + 1}`);
        previewButton.addEventListener("click", (event) => {
            event.stopPropagation();
            openImagePreview(url, `图${index + 1}`);
        });

        const image = createElement("img", "qwen-te-chat__message-image");
        image.src = url;
        image.alt = `图${index + 1}`;
        image.loading = "lazy";
        image.decoding = "async";
        previewButton.append(image, createElement("span", "qwen-te-chat__message-image-label", `图${index + 1}`));
        gallery.append(previewButton);
    });
    return gallery;
}

function createMessageContent(text, onCopy) {
    const content = createElement("div", "qwen-te-chat__message-content");
    const source = String(text || "");
    const fence = /```([^\n`]*)\n([\s\S]*?)```/g;
    let cursor = 0;
    let match;

    while ((match = fence.exec(source)) !== null) {
        if (match.index > cursor) content.append(document.createTextNode(source.slice(cursor, match.index)));
        const pre = createElement("pre", "qwen-te-chat__code");
        const language = match[1].trim();
        const codeText = match[2].replace(/\n$/, "");
        const codeHeader = createElement("div", "qwen-te-chat__code-header");
        if (language) codeHeader.append(createElement("span", "qwen-te-chat__code-language", language));
        const copyCodeButton = createElement("button", "qwen-te-chat__code-copy", "⧉");
        copyCodeButton.type = "button";
        copyCodeButton.title = "复制代码块";
        copyCodeButton.setAttribute("aria-label", "复制代码块");
        copyCodeButton.addEventListener("click", (event) => {
            event.stopPropagation();
            onCopy?.(codeText);
        });
        codeHeader.append(copyCodeButton);
        pre.append(codeHeader);
        const code = document.createElement("code");
        code.textContent = codeText;
        pre.append(code);
        content.append(pre);
        cursor = fence.lastIndex;
    }

    if (cursor < source.length) content.append(document.createTextNode(source.slice(cursor)));
    return content;
}

function isPromptLink(value, output) {
    if (!Array.isArray(value) || value.length !== 2) return false;
    const sourceId = value[0];
    const outputSlot = value[1];
    const validSource =
        typeof sourceId === "number" ||
        (typeof sourceId === "string" && /^\d+$/.test(sourceId));
    return (
        validSource &&
        typeof outputSlot === "number" &&
        Number.isFinite(outputSlot) &&
        Boolean(output?.[String(sourceId)] ?? output?.[Number(sourceId)])
    );
}

function collectPromptLinks(value, output, result = new Set()) {
    if (isPromptLink(value, output)) {
        result.add(String(value[0]));
        return result;
    }
    if (Array.isArray(value)) {
        for (const item of value) collectPromptLinks(item, output, result);
    } else if (value && typeof value === "object") {
        for (const item of Object.values(value)) collectPromptLinks(item, output, result);
    }
    return result;
}

async function buildChatOnlyPrompt(node, chatInputs = null) {
    const prompt = await app.graphToPrompt();
    const output = prompt?.output;
    const targetId = String(node.id);
    if (!output || !(output[targetId] ?? output[Number(targetId)])) {
        throw new Error("当前聊天节点不在可执行提示中，请检查模型连接。");
    }

    const keep = new Set();
    const addWithAncestors = (nodeId) => {
        const id = String(nodeId);
        if (keep.has(id)) return;
        const apiNode = output[id] ?? output[Number(id)];
        if (!apiNode) return;
        keep.add(id);
        for (const sourceId of collectPromptLinks(apiNode.inputs || {}, output)) {
            addWithAncestors(sourceId);
        }
    };
    addWithAncestors(targetId);

    const scopedOutput = {};
    for (const [id, apiNode] of Object.entries(output)) {
        if (keep.has(String(id))) scopedOutput[id] = apiNode;
    }
    const targetNode = scopedOutput[targetId] ?? scopedOutput[Number(targetId)];
    if (targetNode?.inputs && chatInputs) {
        Object.assign(targetNode.inputs, chatInputs);
    }
    prompt.output = scopedOutput;
    return prompt;
}

function setupChatNode(node) {
    injectStyles();
    node.properties ||= {};

    const userWidget = node.widgets?.find((widget) => widget.name === "用户消息");
    const historyWidget = node.widgets?.find((widget) => widget.name === "对话历史JSON");
    const requestWidget = node.widgets?.find((widget) => widget.name === "请求ID");
    const currentImagesWidget = node.widgets?.find((widget) => widget.name === "当前图片JSON");
    if (!userWidget || !historyWidget || !requestWidget || !currentImagesWidget || typeof node.addDOMWidget !== "function") return;

    if (!isHistoryJson(historyWidget.value)) {
        const legacyValues = node.widgets_values;
        const recoveredHistory = [
            node.__qwenTeLastValidHistoryRaw,
            legacyValues?.[12],
        ].map(validHistoryRaw).find((value) => value !== null);
        historyWidget.value = recoveredHistory ?? "[]";
        requestWidget.value = typeof legacyValues?.[13] === "string" ? legacyValues[13] : "";
        currentImagesWidget.value = "[]";
    }
    let lastValidHistoryRaw = validHistoryRaw(historyWidget.value) ?? "[]";
    node.__qwenTeLastValidHistoryRaw = lastValidHistoryRaw;

    hideBackendWidget(userWidget);
    hideBackendWidget(historyWidget);
    hideBackendWidget(requestWidget);
    hideBackendWidget(currentImagesWidget);
    const flowWidget = node.widgets?.find((widget) => widget.name === "流程状态JSON");
    if (flowWidget) hideBackendWidget(flowWidget);
    const optionsWidget = node.widgets?.find((widget) => widget.name === "选项JSON");
    if (optionsWidget) hideBackendWidget(optionsWidget);

    const root = createElement("div", "qwen-te-chat");
    const messages = createElement("div", "qwen-te-chat__messages");
    const flow = createElement("div", "qwen-te-chat__flow");
    const flowSummary = createElement("div", "qwen-te-chat__flow-summary");
    const flowTools = createElement("div", "qwen-te-chat__flow-tools");
    const stage = createElement("span", "qwen-te-chat__stage", "未开始");
    const skillLabel = createElement("span", "qwen-te-chat__skill", "普通对话");
    const contextMeter = createElement("div", "qwen-te-chat__context");
    const contextRing = createElement("div", "qwen-te-chat__context-ring");
    const contextPercent = createElement("span", "qwen-te-chat__context-percent", "--");
    const contextMeta = createElement("div", "qwen-te-chat__context-meta");
    const contextTokens = createElement("span", "qwen-te-chat__context-tokens", "已用约 --");
    const contextRounds = createElement("span", "qwen-te-chat__context-rounds", "轮数 --/--");
    const contextNote = createElement("span", "qwen-te-chat__context-note", "上下文估算");
    const fontSizeControl = createElement("div", "qwen-te-chat__font-size");
    const decreaseFontButton = createElement("button", "qwen-te-chat__font-button", "−");
    const fontSizeValue = createElement("span", "qwen-te-chat__font-value");
    const increaseFontButton = createElement("button", "qwen-te-chat__font-button", "+");
    const unloadButton = createElement("button", "qwen-te-chat__unload", "卸载模型");
    const options = createElement("div", "qwen-te-chat__options");
    const composer = createElement("div", "qwen-te-chat__composer");
    const composeMain = createElement("div", "qwen-te-chat__compose-main");
    const attachments = createElement("div", "qwen-te-chat__attachments");
    const input = createElement("textarea", "qwen-te-chat__input");
    const actions = createElement("div", "qwen-te-chat__actions");
    const sendButton = createElement("button", "qwen-te-chat__button qwen-te-chat__button--send", "发送");
    const insertImageButton = createElement("button", "qwen-te-chat__button", "插入图片");
    const clearButton = createElement("button", "qwen-te-chat__button", "清空");
    const fileInput = document.createElement("input");
    const status = createElement("div", "qwen-te-chat__status", "准备就绪");

    input.placeholder = "输入消息，Enter 发送，Shift+Enter 换行";
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.multiple = true;
    fileInput.style.display = "none";
    sendButton.type = "button";
    insertImageButton.type = "button";
    clearButton.type = "button";
    decreaseFontButton.type = "button";
    increaseFontButton.type = "button";
    decreaseFontButton.title = "减小聊天字体";
    decreaseFontButton.setAttribute("aria-label", "减小聊天字体");
    increaseFontButton.title = "增大聊天字体";
    increaseFontButton.setAttribute("aria-label", "增大聊天字体");
    fontSizeValue.setAttribute("aria-live", "polite");
    fontSizeControl.setAttribute("role", "group");
    fontSizeControl.setAttribute("aria-label", "聊天字体大小");
    flowTools.setAttribute("role", "toolbar");
    flowTools.setAttribute("aria-label", "聊天工具");
    unloadButton.type = "button";
    unloadButton.title = "卸载 Qwen llama TE 模型";
    unloadButton.setAttribute("aria-label", "卸载 Qwen llama TE 模型");
    actions.append(sendButton, insertImageButton, clearButton);
    composeMain.append(attachments, input);
    composer.append(composeMain, actions);
    contextRing.append(contextPercent);
    contextMeta.append(contextTokens, contextRounds, contextNote);
    contextMeter.append(contextRing, contextMeta);
    fontSizeControl.append(decreaseFontButton, fontSizeValue, increaseFontButton);
    flowSummary.append(stage, skillLabel);
    flowTools.append(fontSizeControl, contextMeter, unloadButton);
    flow.append(flowSummary, flowTools);
    root.append(flow, messages, options, composer, status, fileInput);

    for (const eventName of ["pointerdown", "mousedown", "mouseup", "click", "dblclick", "wheel"]) {
        root.addEventListener(eventName, (event) => event.stopPropagation());
    }

    const applyChatFontSize = (value, markDirty = false) => {
        const numericValue = Number(value);
        const nextValue = Math.min(
            CHAT_FONT_SIZE_MAX,
            Math.max(
                CHAT_FONT_SIZE_MIN,
                Number.isFinite(numericValue) ? Math.round(numericValue) : CHAT_FONT_SIZE_DEFAULT
            )
        );
        node.properties.qwenTeChatFontSize = nextValue;
        root.style.setProperty("--qwen-te-chat-font-size", `${nextValue}px`);
        fontSizeValue.textContent = String(nextValue);
        fontSizeValue.title = `当前聊天字体：${nextValue}px`;
        decreaseFontButton.disabled = nextValue <= CHAT_FONT_SIZE_MIN;
        increaseFontButton.disabled = nextValue >= CHAT_FONT_SIZE_MAX;
        if (markDirty) node.graph?.setDirtyCanvas?.(true, true);
    };
    decreaseFontButton.addEventListener("click", () => {
        applyChatFontSize(Number(node.properties.qwenTeChatFontSize) - 1, true);
    });
    increaseFontButton.addEventListener("click", () => {
        applyChatFontSize(Number(node.properties.qwenTeChatFontSize) + 1, true);
    });
    applyChatFontSize(node.properties.qwenTeChatFontSize);

    const commitHistoryRaw = (raw, { allowEmptyRegression = false } = {}) => {
        const validRaw = validHistoryRaw(raw);
        if (validRaw === null) return false;
        if (
            !allowEmptyRegression &&
            parseHistory(validRaw).length === 0 &&
            parseHistory(lastValidHistoryRaw).length > 0
        ) return false;
        historyWidget.value = validRaw;
        lastValidHistoryRaw = validRaw;
        node.__qwenTeLastValidHistoryRaw = validRaw;
        return true;
    };

    const protectedHistory = () => {
        if (!commitHistoryRaw(historyWidget.value)) {
            historyWidget.value = lastValidHistoryRaw;
            status.textContent = "检测到历史数据异常，已恢复上一次有效对话";
            status.dataset.state = "error";
        }
        return parseHistory(lastValidHistoryRaw);
    };

    const render = () => {
        const history = protectedHistory();
        messages.replaceChildren();
        if (!history.length) {
            messages.append(createElement("div", "qwen-te-chat__empty", "暂无对话"));
            return;
        }

        history.forEach((item, index) => {
            const imageCount = Array.isArray(item.images) ? item.images.length : 0;
            const block = createElement(
                "div",
                `qwen-te-chat__message qwen-te-chat__message--${item.role}`
            );
            const messageActions = createElement("div", "qwen-te-chat__message-actions");
            const messageMeta = createElement("div", "qwen-te-chat__message-meta");
            const messageControls = createElement("div", "qwen-te-chat__message-controls");
            const tokenCount = Number(item.token_count);
            if (Number.isFinite(tokenCount) && tokenCount >= 0) {
                const tokenLabel = createElement(
                    "span",
                    "qwen-te-chat__message-tokens",
                    `${Math.round(tokenCount)} tokens`
                );
                tokenLabel.title = imageCount
                    ? "包含文本、消息模板开销和图片视觉 token 估算"
                    : "使用当前模型 tokenizer 统计，并包含少量消息模板开销";
                messageMeta.append(tokenLabel);
            }
            const formattedTime = formatMessageTime(item.created_at);
            if (formattedTime) {
                const timeLabel = createElement("span", "qwen-te-chat__message-time", formattedTime);
                timeLabel.title = new Date(Number(item.created_at)).toLocaleString();
                messageMeta.append(timeLabel);
            }
            const copyMessageButton = createElement("button", "qwen-te-chat__message-copy", "⧉");
            copyMessageButton.type = "button";
            copyMessageButton.title = "复制这条消息";
            copyMessageButton.setAttribute("aria-label", "复制这条消息");
            copyMessageButton.addEventListener("click", (event) => {
                event.stopPropagation();
                copyText(item.content);
            });
            messageControls.append(copyMessageButton);
            if (item.role === "assistant" && index === history.length - 1) {
                const regenerateButton = createElement("button", "qwen-te-chat__message-copy", "↻");
                regenerateButton.type = "button";
                regenerateButton.title = "重新生成这条消息";
                regenerateButton.setAttribute("aria-label", "重新生成这条消息");
                regenerateButton.addEventListener("click", (event) => {
                    event.stopPropagation();
                    regenerateLastReply();
                });
                messageControls.append(regenerateButton);
            }
            messageActions.append(messageMeta, messageControls);
            block.append(createElement(
                "span",
                "qwen-te-chat__role",
                item.role === "user" ? (imageCount ? `用户 · 图片${imageCount}` : "用户") : "助手"
            ));
            const imageGallery = item.role === "user" ? createMessageImages(item.images) : null;
            if (imageGallery) block.append(imageGallery);
            block.append(createMessageContent(item.content, copyText), messageActions);
            messages.append(block);
        });
        messages.scrollTop = messages.scrollHeight;
    };

    const renderFlow = () => {
        const state = parseFlowState(flowWidget?.value);
        stage.textContent = String(state.stage || "未开始");
        stage.title = stage.textContent;
        skillLabel.textContent = state.skill_name || state.skill || "普通对话";
        skillLabel.title = skillLabel.textContent;
        options.replaceChildren();
        const optionValues = parseOptions(optionsWidget?.value || "[]");
        optionValues.forEach((value) => {
            const button = createElement("button", "qwen-te-chat__option", value);
            button.type = "button";
            button.title = "发送此选项";
            button.addEventListener("click", () => {
                if (node.__qwenTeChatBusy) return;
                input.value = value;
                send();
            });
            options.append(button);
        });
    };

    const renderContext = () => {
        const state = parseContextState(node.properties.qwenTeContextState);
        const usedTokens = Math.max(0, Number(state.used_tokens) || 0);
        const promptBudget = Math.max(0, Number(state.prompt_budget) || 0);
        const contextLimit = Math.max(0, Number(state.context_limit) || 0);
        const outputReserve = Math.max(0, Number(state.output_reserve) || 0);
        const trimmedMessages = Math.max(0, Number(state.trimmed_messages) || 0);
        const currentRounds = Math.max(0, Number(state.current_rounds) || 0);
        const maxRounds = Math.max(0, Number(state.max_rounds) || 0);
        const remainingTokens = Math.max(0, Number(state.remaining_tokens) || 0);

        if (!promptBudget || !contextLimit) {
            contextPercent.textContent = "--";
            contextTokens.textContent = "已用约 --";
            contextRounds.textContent = "轮数 --/--";
            contextNote.textContent = "剩余约 --";
            contextRing.style.background = "conic-gradient(#5d9f80 0deg, #45494f 0deg)";
            contextMeter.title = "完成一次回复后显示上下文占用估算";
            return;
        }

        const rawPercent = usedTokens / promptBudget * 100;
        const displayPercent = Math.max(0, Math.round(rawPercent));
        const ringPercent = Math.min(100, Math.max(0, rawPercent));
        const color = rawPercent >= 90 ? "#d66f6f" : rawPercent >= 75 ? "#d4a653" : "#5d9f80";
        contextPercent.textContent = `${displayPercent}%`;
        contextTokens.textContent = `已用约 ${formatTokenCount(usedTokens)}`;
        contextRounds.textContent = `轮数 ${currentRounds}/${maxRounds || "--"}`;
        contextNote.textContent = trimmedMessages > 0
            ? `剩余约 ${formatTokenCount(remainingTokens)} · 裁${trimmedMessages}`
            : `剩余约 ${formatTokenCount(remainingTokens)}`;
        contextRing.style.background = `conic-gradient(${color} ${ringPercent * 3.6}deg, #45494f 0deg)`;
        contextMeter.title = [
            `当前已使用约 ${Math.round(usedTokens)} tokens`,
            `当前剩余约 ${Math.round(remainingTokens)} tokens`,
            `模型上下文上限 ${Math.round(contextLimit)} tokens`,
            `已预留输出 ${Math.round(outputReserve)} tokens`,
            `当前保留历史 ${Math.round(currentRounds)} / ${Math.round(maxRounds)} 轮`,
            trimmedMessages > 0 ? `本轮因上下文不足裁剪了 ${trimmedMessages} 条历史消息` : "本轮未裁剪历史消息",
        ].join("\n");
    };

    const renderAttachments = () => {
        const images = parseImages(currentImagesWidget.value);
        attachments.replaceChildren();
        images.forEach((imageRef, index) => {
            const chip = createElement("span", "qwen-te-chat__attachment");
            chip.title = imageRef.filename;
            const label = createElement("span", "", `图片${index + 1}`);
            const removeButton = createElement("button", "qwen-te-chat__attachment-remove", "×");
            removeButton.type = "button";
            removeButton.title = `移除图片${index + 1}`;
            removeButton.addEventListener("click", () => {
                const next = parseImages(currentImagesWidget.value);
                next.splice(index, 1);
                currentImagesWidget.value = JSON.stringify(next);
                renderAttachments();
                node.graph?.setDirtyCanvas?.(true, true);
            });
            chip.append(label, removeButton);
            attachments.append(chip);
        });
        const attachmentHeight = images.length ? attachments.offsetHeight + 5 : 0;
        actions.style.marginTop = `${attachmentHeight}px`;
    };

    const copyText = async (value) => {
        if (!value) {
            status.textContent = "暂无可复制内容";
            status.dataset.state = "error";
            return false;
        }
        try {
            await navigator.clipboard.writeText(value);
        } catch (_) {
            const textarea = document.createElement("textarea");
            textarea.value = value;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.append(textarea);
            textarea.select();
            document.execCommand("copy");
            textarea.remove();
        }
        status.textContent = "已复制这条消息";
        status.dataset.state = "idle";
        return true;
    };

    const regenerateLastReply = () => {
        if (node.__qwenTeChatBusy) return;
        const history = protectedHistory();
        const assistantIndex = history.length - 1;
        const userIndex = assistantIndex - 1;
        if (
            assistantIndex < 1 ||
            history[assistantIndex]?.role !== "assistant" ||
            history[userIndex]?.role !== "user"
        ) return;

        const assistantMessage = history[assistantIndex];
        const userMessage = history[userIndex];
        commitHistoryRaw(
            JSON.stringify(history.slice(0, userIndex)),
            { allowEmptyRegression: true }
        );
        input.value = userMessage.content;
        currentImagesWidget.value = JSON.stringify(userMessage.images || []);
        if (flowWidget) {
            const fallbackState = parseFlowState(flowWidget.value);
            fallbackState.final_result = "";
            fallbackState.stage = "重新生成";
            flowWidget.value = JSON.stringify(assistantMessage.flow_before || fallbackState);
        }
        if (optionsWidget) optionsWidget.value = "[]";
        render();
        renderFlow();
        renderAttachments();
        send();
    };

    const setBusy = (busy, message = busy ? "正在生成..." : "准备就绪", state = busy ? "busy" : "idle") => {
        node.__qwenTeChatBusy = busy;
        sendButton.disabled = busy;
        insertImageButton.disabled = busy;
        clearButton.disabled = busy;
        input.disabled = busy;
        options.querySelectorAll("button").forEach((button) => { button.disabled = busy; });
        status.textContent = message;
        status.dataset.state = state;
    };

    const send = async () => {
        const text = input.value.trim();
        if (!text || node.__qwenTeChatBusy) return;

        protectedHistory();
        userWidget.value = text;
        requestWidget.value = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setBusy(true);
        node.graph?.setDirtyCanvas?.(true, true);

        try {
            const prompt = await buildChatOnlyPrompt(node, {
                "用户消息": text,
                "对话历史JSON": lastValidHistoryRaw,
                "请求ID": requestWidget.value,
                "当前图片JSON": currentImagesWidget.value,
                "流程状态JSON": flowWidget?.value || "{}",
                "选项JSON": optionsWidget?.value || "[]",
            });
            await api.queuePrompt(0, prompt);
            status.textContent = "已加入队列...";
        } catch (error) {
            setBusy(false, `加入队列失败：${error?.message || error}`, "error");
        }
    };

    sendButton.addEventListener("click", send);
    unloadButton.addEventListener("click", async () => {
        if (node.__qwenTeUnloadBusy) return;
        node.__qwenTeUnloadBusy = true;
        unloadButton.disabled = true;
        status.textContent = "正在卸载 Qwen 模型...";
        status.dataset.state = "busy";
        try {
            const response = await api.fetchApi("/qwen_te/unload", { method: "POST" });
            let payload = {};
            try {
                payload = await response.json();
            } catch (_) {
                payload = {};
            }
            if (!response.ok || payload.ok === false) {
                if (response.status === 409) {
                    throw new Error("当前有运行中或排队任务，请等待完成后再卸载模型");
                }
                throw new Error(payload.error || `HTTP ${response.status}`);
            }
            status.textContent = payload.unloaded ? "Qwen 模型已卸载" : "当前没有已加载的 Qwen 模型";
            status.dataset.state = "idle";
        } catch (error) {
            status.textContent = `卸载失败：${error?.message || error}`;
            status.dataset.state = "error";
        } finally {
            node.__qwenTeUnloadBusy = false;
            unloadButton.disabled = false;
        }
    });
    insertImageButton.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
        const files = Array.from(fileInput.files || []);
        fileInput.value = "";
        if (!files.length || node.__qwenTeChatBusy) return;

        setBusy(true, "正在上传图片...");
        try {
            const current = parseImages(currentImagesWidget.value);
            const startIndex = current.length;
            for (let index = 0; index < files.length; index += 1) {
                current.push(await uploadChatImage(files[index], startIndex + index));
            }
            currentImagesWidget.value = JSON.stringify(current);
            renderAttachments();
            setBusy(false, `已插入 ${files.length} 张图片`);
            node.graph?.setDirtyCanvas?.(true, true);
            input.focus();
        } catch (error) {
            setBusy(false, `插入图片失败：${error?.message || error}`, "error");
        }
    });
    clearButton.addEventListener("click", () => {
        commitHistoryRaw("[]", { allowEmptyRegression: true });
        userWidget.value = "";
        requestWidget.value = `${Date.now()}-clear`;
        currentImagesWidget.value = "[]";
        if (flowWidget) flowWidget.value = "{}";
        if (optionsWidget) optionsWidget.value = "[]";
        node.properties.qwenTeContextState = {};
        input.value = "";
        render();
        renderFlow();
        renderContext();
        renderAttachments();
        setBusy(false, "会话已清空");
        node.graph?.setDirtyCanvas?.(true, true);
    });
    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            send();
        }
    });

    const domWidget = node.addDOMWidget("qwen_te_chat", "qwen_te_chat", root, {
        getMinHeight: () => CHAT_MIN_HEIGHT + CHAT_WIDGET_PADDING,
        getMaxHeight: () => undefined,
        getHeight: () => Math.max(
            CHAT_MIN_HEIGHT + CHAT_WIDGET_PADDING,
            (node.size?.[1] || 470) - CHAT_NODE_CHROME_HEIGHT + CHAT_WIDGET_PADDING
        ),
        hideOnZoom: false,
        serialize: false,
    });

    const updateChatLayout = (size = node.size) => {
        const nodeHeight = Number(size?.[1] ?? node.size?.[1] ?? 470);
        const chatHeight = Math.max(CHAT_MIN_HEIGHT, nodeHeight - CHAT_NODE_CHROME_HEIGHT);
        root.style.height = `${chatHeight}px`;
        root.style.minHeight = `${CHAT_MIN_HEIGHT}px`;
        node.graph?.setDirtyCanvas?.(true, true);
    };

    domWidget.computeSize = (width) => {
        const nodeHeight = Number(node.size?.[1] ?? 470);
        const chatHeight = Math.max(CHAT_MIN_HEIGHT, nodeHeight - CHAT_NODE_CHROME_HEIGHT);
        return [Math.max(280, width || node.size?.[0] || 360), chatHeight + CHAT_WIDGET_PADDING];
    };
    domWidget.afterResize = () => updateChatLayout();
    const domWidgetIndex = node.widgets.indexOf(domWidget);
    if (domWidgetIndex > 0) {
        node.widgets.splice(domWidgetIndex, 1);
        node.widgets.unshift(domWidget);
    }

    const originalOnResize = node.onResize;
    node.onResize = function (size) {
        const result = originalOnResize?.apply(this, arguments);
        updateChatLayout(size || this.size);
        return result;
    };

    const originalOnExecuted = node.onExecuted;
    node.onExecuted = function (output) {
        originalOnExecuted?.apply(this, arguments);
        const sent = Boolean(firstValue(output?.已发送));
        const previousHistory = parseHistory(lastValidHistoryRaw);
        const rawHistory = firstValue(output?.对话历史JSON);
        const candidateRaw = validHistoryRaw(rawHistory);
        const candidateHistory = candidateRaw === null ? null : parseHistory(candidateRaw);
        let historyError = "";
        if (candidateHistory === null) {
            if (sent || typeof rawHistory === "string") {
                historyError = "返回的历史数据异常，已保留发送前的对话";
            }
        } else if (candidateHistory.length === 0 && (sent || previousHistory.length > 0)) {
            historyError = "返回了异常空历史，已保留发送前的对话";
        } else {
            commitHistoryRaw(candidateRaw);
        }
        const rawFlow = firstValue(output?.流程状态JSON);
        if (flowWidget && typeof rawFlow === "string") flowWidget.value = rawFlow;
        const rawOptions = firstValue(output?.选项JSON);
        if (optionsWidget) optionsWidget.value = typeof rawOptions === "string" ? rawOptions : "[]";
        const rawContextState = firstValue(output?.上下文状态JSON);
        if (typeof rawContextState === "string") {
            node.properties.qwenTeContextState = parseContextState(rawContextState);
        }
        if (sent && !historyError) {
            userWidget.value = "";
            currentImagesWidget.value = "[]";
            input.value = "";
        }
        render();
        renderFlow();
        renderContext();
        renderAttachments();
        if (historyError) {
            setBusy(false, historyError, "error");
        } else {
            setBusy(false);
        }
        this.graph?.setDirtyCanvas?.(true, true);
    };

    const originalOnConfigure = node.onConfigure;
    node.onConfigure = function () {
        const result = originalOnConfigure?.apply(this, arguments);
        window.setTimeout(() => {
            applyChatFontSize(this.properties?.qwenTeChatFontSize);
            render();
            renderFlow();
            renderContext();
            renderAttachments();
        }, 0);
        return result;
    };

    const handleExecutionFailure = (event) => {
        if (!node.__qwenTeChatBusy) return;
        setBusy(false, "生成失败，请查看 ComfyUI 日志", "error");
    };
    api.addEventListener("execution_error", handleExecutionFailure);
    api.addEventListener("execution_interrupted", handleExecutionFailure);

    const originalOnRemoved = node.onRemoved;
    node.onRemoved = function () {
        api.removeEventListener("execution_error", handleExecutionFailure);
        api.removeEventListener("execution_interrupted", handleExecutionFailure);
        return originalOnRemoved?.apply(this, arguments);
    };

    node.setSize([
        Math.max(node.size?.[0] || 0, 390),
        Math.max(node.size?.[1] || 0, 470),
    ]);
    window.setTimeout(() => {
        updateChatLayout();
        render();
        renderFlow();
        renderContext();
        renderAttachments();
    }, 0);
}

app.registerExtension({
    name: "QwenTE.MultiTurnChat",
    nodeCreated(node) {
        if (node.constructor?.comfyClass === NODE_CLASS) setupChatNode(node);
    },
});
