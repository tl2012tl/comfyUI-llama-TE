import { app } from "../../scripts/app.js";

const NODE_TYPE = "QwenTE_SkillLoader";

app.registerExtension({
    name: "QwenTE.SkillLoaderPath",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        const hiddenPath = nodeData.input?.hidden?.skill_folder_path;
        const skillPath = String(
            typeof hiddenPath === "string"
                ? hiddenPath
                : hiddenPath?.default || ""
        );
        const originalOnNodeCreated = nodeType.prototype.onNodeCreated;

        nodeType.prototype.onNodeCreated = function () {
            originalOnNodeCreated?.apply(this, arguments);
            if (typeof this.addDOMWidget !== "function") return;
            if (this.__qwenSkillPathWidget) return;

            const node = this;
            const getWidget = (name) => node.widgets?.find((item) => item?.name === name);
            const setWidgetValue = (name, value) => {
                const widget = getWidget(name);
                if (!widget) return false;
                widget.value = value;
                try {
                    widget.callback?.(value);
                } catch (error) {
                    console.warn("[QwenTE] failed to update Skill loader widget", error);
                }
                const index = node.widgets.indexOf(widget);
                if (index >= 0) {
                    node.widgets_values ??= [];
                    node.widgets_values[index] = value;
                }
                return true;
            };
            const hideWidget = (widget) => {
                if (!widget || widget.__qwenSkillHidden) return;
                widget.__qwenSkillHidden = true;
                widget.hidden = true;
                widget.computeSize = () => [0, -4];
                widget.draw = () => {};
                widget.mouse = () => false;
                for (const element of [widget.element, widget.domElement, widget.el, widget.container]) {
                    if (!element?.style) continue;
                    element.style.display = "none";
                    element.style.visibility = "hidden";
                    element.style.width = "0";
                    element.style.height = "0";
                    element.style.margin = "0";
                    element.style.padding = "0";
                }
            };
            hideWidget(getWidget("加载文件名"));
            hideWidget(getWidget("加载文件内容"));

            const root = document.createElement("div");
            const label = document.createElement("div");
            const path = document.createElement("div");
            const controls = document.createElement("div");
            const loadButton = document.createElement("button");
            const clearButton = document.createElement("button");
            const status = document.createElement("div");
            label.textContent = "Skill文件放置路径：";
            path.textContent = skillPath;
            loadButton.textContent = "加载 Skill/提示词";
            clearButton.textContent = "清除文件";
            status.textContent = "未加载临时文件";
            controls.append(loadButton, clearButton);
            root.append(label, path, controls, status);
            root.style.boxSizing = "border-box";
            root.style.width = "100%";
            root.style.minHeight = "26px";
            root.style.padding = "4px 6px";
            root.style.border = "1px solid rgba(255, 255, 255, 0.12)";
            root.style.borderRadius = "4px";
            root.style.background = "rgba(0, 0, 0, 0.16)";
            root.style.color = "#cfd5dc";
            root.style.fontSize = "10px";
            root.style.lineHeight = "13px";
            root.style.whiteSpace = "normal";
            root.style.overflowWrap = "anywhere";
            root.title = skillPath;
            label.style.fontWeight = "600";
            path.style.marginBottom = "4px";
            controls.style.display = "flex";
            controls.style.gap = "4px";
            controls.style.alignItems = "center";
            loadButton.style.flex = "1 1 auto";
            clearButton.style.flex = "0 0 auto";
            for (const button of [loadButton, clearButton]) {
                button.type = "button";
                button.style.minHeight = "24px";
                button.style.padding = "2px 7px";
                button.style.border = "1px solid rgba(255, 255, 255, 0.16)";
                button.style.borderRadius = "3px";
                button.style.background = "rgba(255, 255, 255, 0.08)";
                button.style.color = "inherit";
                button.style.font = "inherit";
                button.style.cursor = "pointer";
            }
            status.style.color = "#9da8b5";
            status.style.marginTop = "3px";
            status.style.overflowWrap = "anywhere";

            const getPathHeight = (width) => {
                const availableWidth = Math.max(Number(width || 300) - 12, 120);
                const charsPerLine = Math.max(18, Math.floor(availableWidth / 5.5));
                const pathLineCount = Math.max(1, Math.ceil(skillPath.length / charsPerLine));
                return 8 + (1 + pathLineCount) * 13 + 24 + 17;
            };

            const originalOnResize = this.onResize;
            const updatePathLayout = (size) => {
                const pathHeight = getPathHeight(size?.[0] || this.size?.[0]);
                root.style.height = `${pathHeight}px`;
                root.style.minHeight = `${pathHeight}px`;
                const requiredNodeHeight = 54 + pathHeight;
                if (!this.__qwenSkillPathResizing && (this.size?.[1] || 0) < requiredNodeHeight) {
                    this.__qwenSkillPathResizing = true;
                    this.setSize([this.size?.[0] || 300, requiredNodeHeight]);
                    this.__qwenSkillPathResizing = false;
                }
                this.graph?.setDirtyCanvas?.(true, true);
            };

            this.onResize = function (size) {
                originalOnResize?.apply(this, arguments);
                updatePathLayout(size);
            };

            const widget = this.addDOMWidget(
                "qwen_te_skill_folder_path",
                "qwen_te_skill_folder_path",
                root,
                {
                    hideOnZoom: false,
                    serialize: false,
                    getMinHeight: () => getPathHeight(this.size?.[0]),
                },
            );
            widget.computeSize = (width) => [width, getPathHeight(width)];
            this.__qwenSkillPathWidget = widget;
            this.setSize([
                Math.max(this.size?.[0] || 0, 300),
                Math.max(this.size?.[1] || 0, 82),
            ]);
            updatePathLayout(this.size);

            const refreshStatus = () => {
                const fileName = String(getWidget("加载文件名")?.value || "").trim();
                const content = String(getWidget("加载文件内容")?.value || "");
                status.textContent = fileName && content.trim() ? `已加载：${fileName}` : "未加载临时文件";
                clearButton.disabled = !(fileName && content.trim());
                clearButton.style.opacity = clearButton.disabled ? "0.5" : "1";
                node.graph?.setDirtyCanvas?.(true, true);
            };

            loadButton.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".md,.txt,text/markdown,text/plain";
                input.onchange = () => {
                    const file = input.files?.[0];
                    if (!file) return;
                    const extension = file.name.toLowerCase().split(".").pop();
                    if (extension !== "md" && extension !== "txt") {
                        status.textContent = "仅支持 .md 或 .txt 文件";
                        return;
                    }
                    const reader = new FileReader();
                    reader.onerror = () => {
                        status.textContent = "文件读取失败";
                    };
                    reader.onload = () => {
                        const content = String(reader.result || "");
                        setWidgetValue("加载文件名", file.name);
                        setWidgetValue("加载文件内容", content);
                        setWidgetValue("skill", "自动选择");
                        refreshStatus();
                    };
                    reader.readAsText(file, "UTF-8");
                };
                input.click();
            };
            clearButton.onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                setWidgetValue("加载文件名", "");
                setWidgetValue("加载文件内容", "");
                refreshStatus();
            };
            const originalOnConfigure = node.onConfigure;
            node.onConfigure = function () {
                const result = originalOnConfigure?.apply(this, arguments);
                setTimeout(refreshStatus, 0);
                return result;
            };
            refreshStatus();
        };
    },
});
