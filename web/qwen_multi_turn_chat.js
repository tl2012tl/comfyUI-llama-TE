import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_CLASS = "QwenTE_MultiTurnChat";
const CHAT_MIN_HEIGHT = 260;
const CHAT_NODE_CHROME_HEIGHT = 110;
const CHAT_WIDGET_PADDING = 10;

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
            gap: 7px;
            min-height: 22px;
            color: #b8c0ca;
            font-size: 11px;
        }
        .qwen-te-chat__stage {
            padding: 3px 7px;
            color: #f4c982;
            border: 1px solid #765d32;
            border-radius: 4px;
            background: #332b1d;
        }
        .qwen-te-chat__skill {
            overflow: hidden;
            color: #9daab8;
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
            justify-content: flex-end;
            min-height: 22px;
            margin-top: 4px;
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
            margin: 0 0 8px;
            padding: 7px 9px;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            border: 1px solid #414348;
            border-radius: 5px;
            background: #292b2f;
        }
        .qwen-te-chat__message--user {
            margin-left: 24px;
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
            font-size: 15px;
            line-height: 1.55;
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
            font: 13px/1.5 Consolas, "Courier New", monospace;
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

async function buildChatOnlyPrompt(node) {
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
    prompt.output = scopedOutput;
    return prompt;
}

function setupChatNode(node) {
    injectStyles();

    const userWidget = node.widgets?.find((widget) => widget.name === "用户消息");
    const historyWidget = node.widgets?.find((widget) => widget.name === "对话历史JSON");
    const requestWidget = node.widgets?.find((widget) => widget.name === "请求ID");
    const currentImagesWidget = node.widgets?.find((widget) => widget.name === "当前图片JSON");
    if (!userWidget || !historyWidget || !requestWidget || !currentImagesWidget || typeof node.addDOMWidget !== "function") return;

    if (!isHistoryJson(historyWidget.value)) {
        const legacyValues = node.widgets_values;
        historyWidget.value = isHistoryJson(legacyValues?.[12]) ? legacyValues[12] : "[]";
        requestWidget.value = typeof legacyValues?.[13] === "string" ? legacyValues[13] : "";
        currentImagesWidget.value = "[]";
    }

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
    const stage = createElement("span", "qwen-te-chat__stage", "未开始");
    const skillLabel = createElement("span", "qwen-te-chat__skill", "普通对话");
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
    actions.append(sendButton, insertImageButton, clearButton);
    composeMain.append(attachments, input);
    composer.append(composeMain, actions);
    flow.append(createElement("span", "", "流程"), stage, skillLabel);
    root.append(flow, messages, options, composer, status, fileInput);

    for (const eventName of ["pointerdown", "mousedown", "mouseup", "click", "dblclick", "wheel"]) {
        root.addEventListener(eventName, (event) => event.stopPropagation());
    }

    const render = () => {
        const history = parseHistory(historyWidget.value);
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
            const copyMessageButton = createElement("button", "qwen-te-chat__message-copy", "⧉");
            copyMessageButton.type = "button";
            copyMessageButton.title = "复制这条消息";
            copyMessageButton.setAttribute("aria-label", "复制这条消息");
            copyMessageButton.addEventListener("click", (event) => {
                event.stopPropagation();
                copyText(item.content);
            });
            messageActions.append(copyMessageButton);
            if (item.role === "assistant" && index === history.length - 1) {
                const regenerateButton = createElement("button", "qwen-te-chat__message-copy", "↻");
                regenerateButton.type = "button";
                regenerateButton.title = "重新生成这条消息";
                regenerateButton.setAttribute("aria-label", "重新生成这条消息");
                regenerateButton.addEventListener("click", (event) => {
                    event.stopPropagation();
                    regenerateLastReply();
                });
                messageActions.append(regenerateButton);
            }
            block.append(
                createElement(
                    "span",
                    "qwen-te-chat__role",
                    item.role === "user" ? (imageCount ? `用户 · 图片${imageCount}` : "用户") : "助手"
                ),
                createMessageContent(item.content, copyText),
                messageActions
            );
            messages.append(block);
        });
        messages.scrollTop = messages.scrollHeight;
    };

    const renderFlow = () => {
        const state = parseFlowState(flowWidget?.value);
        stage.textContent = String(state.stage || "未开始");
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
        const history = parseHistory(historyWidget.value);
        const assistantIndex = history.length - 1;
        const userIndex = assistantIndex - 1;
        if (
            assistantIndex < 1 ||
            history[assistantIndex]?.role !== "assistant" ||
            history[userIndex]?.role !== "user"
        ) return;

        const assistantMessage = history[assistantIndex];
        const userMessage = history[userIndex];
        historyWidget.value = JSON.stringify(history.slice(0, userIndex));
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

        userWidget.value = text;
        requestWidget.value = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        setBusy(true);
        node.graph?.setDirtyCanvas?.(true, true);

        try {
            const prompt = await buildChatOnlyPrompt(node);
            await api.queuePrompt(0, prompt);
            status.textContent = "已加入队列...";
        } catch (error) {
            setBusy(false, `加入队列失败：${error?.message || error}`, "error");
        }
    };

    sendButton.addEventListener("click", send);
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
        historyWidget.value = "[]";
        userWidget.value = "";
        requestWidget.value = `${Date.now()}-clear`;
        currentImagesWidget.value = "[]";
        if (flowWidget) flowWidget.value = "{}";
        if (optionsWidget) optionsWidget.value = "[]";
        input.value = "";
        render();
        renderFlow();
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
        const rawHistory = firstValue(output?.对话历史JSON);
        if (typeof rawHistory === "string") historyWidget.value = rawHistory;
        const rawFlow = firstValue(output?.流程状态JSON);
        if (flowWidget && typeof rawFlow === "string") flowWidget.value = rawFlow;
        const rawOptions = firstValue(output?.选项JSON);
        if (optionsWidget) optionsWidget.value = typeof rawOptions === "string" ? rawOptions : "[]";
        const sent = Boolean(firstValue(output?.已发送));
        if (sent) {
            userWidget.value = "";
            currentImagesWidget.value = "[]";
            input.value = "";
        }
        render();
        renderFlow();
        renderAttachments();
        setBusy(false);
        this.graph?.setDirtyCanvas?.(true, true);
    };

    const originalOnConfigure = node.onConfigure;
    node.onConfigure = function () {
        const result = originalOnConfigure?.apply(this, arguments);
        window.setTimeout(() => {
            render();
            renderFlow();
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
        renderAttachments();
    }, 0);
}

app.registerExtension({
    name: "QwenTE.MultiTurnChat",
    nodeCreated(node) {
        if (node.constructor?.comfyClass === NODE_CLASS) setupChatNode(node);
    },
});
