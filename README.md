# ComfyUI Llama TE

超高速的反推节点，用于在 ComfyUI 内加载和推理 Qwen / Gemma4 多模态 GGUF 模型。


推荐使用
【ComfyUI TE整合包 v20260619,B站首个搭载torch2.12 CUDA132整合包,RTX超分/llama反推/LTX2.3/sage2.2】 https://www.bilibili.com/video/BV1oxjz62Eb3/?share_source=copy_web&vd_source=a74fe7a15dbf45f77a4ef19aacacd83c

推荐使用
ComfyUI TE模式启动器 v7 
便捷安装 github上的节点和轮子
链接：https://pan.quark.cn/s/228999e7c788


## 更新

### v3.3

- `Qwen TE 模型加载器` 新增 MTP 加速支持设置。支持带有内置 MTP / NextN 层的 Qwen3.5、Qwen3.6、Qwen3.8 GGUF 纯文本推理；加载视觉 mmproj 时会自动关闭，并在日志中输出启用状态、接受率和速度统计。
- `Qwen TE 模型加载器` 新增 Flash Attention 三态设置：默认“不开启”时不修改 llama.cpp 当前参数，只有用户明确选择“开启”或“关闭”时才覆盖，并在日志中显示实际设置结果。
- 多轮对话新增 `11-28 px` 字体大小快捷调节。
- 新增分片 GGUF 加载。模型下拉框只显示第一片。
- `Qwen llama TE 多轮对话聊天` 右上角新增“卸载模型”按钮，可直接释放当前 Qwen 模型；队列忙碌时会显示原因，避免按钮无响应或在任务执行中误卸载。
- 多轮对话支持在消息中显示已发送图片的缩略图，点击后在当前页面浮动窗口中查看完整图片。
- 多轮对话新增 `11-28 px` 字体大小快捷调节。

### v3.2

- 为部分用户修复环境变量异常导致的使用cpu情况。
- 新增模型加载环境诊断日志，显示当前 Python、`llama_cpp` 位置与版本、请求的 GPU 层数，方便用户确认实际运行环境。

### v3.1
- 多轮对话界面新增上下文环形进度指示器，显示当前已使用和剩余 token 估算、模型上下文上限及当前/最大历史轮数；达到 75% / 90% 时改变颜色，并提示本轮因上下文不足裁剪的历史消息数量。
- 多轮对话中的每条用户消息和助手回复会在操作栏显示该消息的 token 估算及发送/完成时间。


### v3.0

- 新增 `Qwen3.8-VL` 支持，可加载 Qwen3.8 GGUF 主模型及对应视觉投影 mmproj，支持图片与文本推理。
- 新增 `Qwen3.8推理强度`，支持 `xhigh`、`medium`、`low`；
- Qwen3.8 自动使用官方推荐的 `min_p=0.0`，仅对 Qwen3.8 生效，其他模型采样默认不变。
- `Qwen llama TE 图像推理` 新增 `图片2` 到 `图片8`，支持最多 8 路图片在同一次推理中联合分析，并按照已连接输入口顺序识别为 `图1`、`图2` 等。
- LLama TE 节点支持图片输入时先按照“最大边长”自动等比缩小，再使用优化 JPEG 90 编码，减少大图和多图占用的视觉上下文、推理时间及内存。


### v2.0

- 新增 `Qwen llama TE 多轮对话聊天` 节点，支持在 ComfyUI 内用本地模型进行连续多轮对话，并保留对话历史。
- 新增 `Qwen llama TE Skill加载器` 节点，可从插件目录下的 `skills` 文件夹加载 Skill。
- 支持固定选择 Skill，也支持根据首次任务自动匹配 Skill。
- 支持自动读取 Skill 的 `SKILL.md`，并根据任务需要按需加载 `references` 文件，减少无关内容进入上下文。
- 新增 Skill 流程状态记录，可显示当前 Skill、流程阶段、已加载参考资料和待确认选项；模型返回的选项可直接点击继续对话。
- 支持 Skill 的需求确认、阶段推进和最终结果标记，避免在信息不足时直接生成最终内容。
- 新增 `h3-prompt-writing` Skill，支持将用户需求整理为 MiniMax H3 的 T2VA、I2VA、FL2VA、L2VA、Ref2VA 视频提示词格式。
- 支持 H3 Skill 按需读取文生视频、首帧、首尾帧及全参考模式的专用提示词规则和参考资料。
- 内置多种 H3 官方视频创作风格 Skill：`3D动画短片生成器`、`品牌宣传短片生成器`、`双人游戏开场视频生成器`、`手绘实拍融合视频生成器`、`极简产品广告生成器`、`音乐MV动态字幕生成器`、`纸拼贴讲解动画生成器`、`纸艺定格科普视频生成器`。
- 这些风格 Skill 支持分阶段确认，可分别完成创意构思、素材与角色设定、分镜规划、提示词编写以及视频制作方案整理。
- 多轮对话界面支持复制单条消息、复制代码块，以及重新生成最后一条助手回复。

### v1.0

- 支持 Gemma4 12B。

## 功能

- 支持 Qwen3-VL、Qwen3.5-VL、Qwen3.6-VL、Qwen3.8-VL。
- 支持 Gemma4 图片反推、文本推理、音频推理。
- 支持图片、逐帧、视频抽帧、纯文本输入模式。
- 支持 Gemma4 图片 + 音频 + 文本联合输入。
- 支持 KV cache 类型选择，例如默认 F16 / q8_0。
- 支持 Qwen3.6 MoE 专家权重 CPU offload：`cpu_moe` / `n_cpu_moe`。
- 支持 Gemma4 思考预算 token，用于限制 thought 通道的生成长度。
- 支持 ComfyUI 全局释放显存时同步卸载 llama.cpp 模型。

## 安装

将本插件放到 ComfyUI 的 `custom_nodes` 目录：

```text
ComfyUI/custom_nodes/comfyUI-llama-TE
```

```

更新或安装后重启 ComfyUI。

## 模型放置

主模型和 mmproj 文件放到：

```text
ComfyUI/models/LLM
```

示例：

```text
ComfyUI/models/LLM/qwen3.6-vl-35b-a3b-q4_k_m.gguf
ComfyUI/models/LLM/mmproj-qwen3.6-vl.gguf
ComfyUI/models/LLM/Qwen3.8-27B-Q3_K_M.gguf
ComfyUI/models/LLM/Qweb3.8-mmproj-BF16.gguf
ComfyUI/models/LLM/Gemma-4-E4B-It-BF16.gguf
ComfyUI/models/LLM/mmproj-Gemma-4-E4B-It-BF16.gguf
```

## 节点

### Qwen TE 模型加载器

用于加载 Qwen VL 模型。

主要参数：

- `模型系列`：`Qwen3-VL`、`Qwen3.5-VL`、`Qwen3.6-VL`、`Qwen3.8-VL`。
- `主模型`：GGUF 主模型文件。
- `视觉投影mmproj`：多模态模型需要选择对应 mmproj。
- `启用思考`：控制模型是否进入 reasoning / think 模式。
- `保留历史think`：仅新版 Qwen35ChatHandler 支持，用于保留历史 `<think>` 内容。
- `上下文长度`：对应 llama.cpp 的 `n_ctx`。
- `GPU层数`：对应 `n_gpu_layers`，`-1` 通常表示尽可能多放到 GPU。
- `KV缓存K类型` / `KV缓存V类型`：默认 F16，也可尝试 q8_0 降低显存占用。
- `MoE专家上CPU`：仅 Qwen3.6 生效，把全部 MoE 专家权重放到 CPU 内存。
- `前N层专家上CPU`：仅 Qwen3.6 生效，把前 N 层 MoE 专家权重放到 CPU 内存。
- `Qwen3.8推理强度`：仅 Qwen3.8 生效，支持 `xhigh`、`medium`、`low`，并放在加载器参数末尾以保持旧工作流参数顺序。

Qwen3.8 在采样字段仍为旧默认值时，会根据“启用思考”自动选择推荐采样：思考模式使用 `1.0 / 0.95 / 20`，非思考模式使用 `0.7 / 0.80 / 20`；手动修改过的字段不会被覆盖。

> 注意：`cpu_moe` / `n_cpu_moe` 主要用于显存不够时，不一定会加速，很多情况下会更慢。

### Qwen TE 图像推理

用于 Qwen 图片反推、视频抽帧分析、逐帧分析、纯文本推理。

输入模式：

- `图片`：支持 `图片`、`图片2` 到 `图片8` 共 8 个输入口；每个已连接输入口读取第 1 张，并在一次推理中共同发送给模型分析。
- `逐帧`：逐张图片分别推理。
- `视频`：从输入图片序列中均匀抽帧，一次性送入模型。
- `文本`：不需要图片，只进行文本对话。

`最大边长` 默认 1024。所有 Qwen 图片输入（包括多图和视频帧）都会先等比缩小到该上限，再使用优化的渐进式 JPEG 90 编码。发生尺寸缩小时，后端日志会显示原始尺寸、压缩后尺寸和编码大小。数值越大，图片细节越多，但视觉上下文、推理时间和显存占用也会增加。

### Gemma4 TE 模型加载器

用于加载 Gemma4 模型。

主要参数：

- `主模型`：Gemma4 GGUF 主模型。
- `视觉投影mmproj`：Gemma4 多模态推理需要 mmproj。
- `启用思考`：Gemma4 handler 的 `enable_thinking`。
- `上下文长度`：对应 `n_ctx`。
- `GPU层数`：对应 `n_gpu_layers`。
- `KV缓存K类型` / `KV缓存V类型`：KV cache 类型。

Gemma4 E2B / E4B 做音频推理时建议使用 BF16 mmproj，其他量化可能导致音频效果下降。

### Gemma4 TE 图片推理

用于 Gemma4 图片反推、视频抽帧分析、逐帧分析、纯文本推理。

主要参数：

- `最大边长`：默认 1024。
- `最大生成token`：控制最大输出长度。
- `温度` / `top_p` / `top_k`：采样参数。
- `输出think块`：是否保留 Gemma4 thought 内容。
- `思考预算token`：限制 Gemma4 首个 thought 通道的 token 数。

`思考预算token` 说明：

- `-1`：不限制。
- `0`：进入思考后立即结束。
- `128 / 256 / 512`：最多允许对应数量的思考 token。

### Gemma4 TE 音频推理

用于 Gemma4 音频理解，也支持图片 + 音频 + 文本联合输入。

支持输入：

- ComfyUI `AUDIO`。
- 本地 WAV / MP3 路径。
- HTTP(S) WAV / MP3 URL。
- `data:audio/...;base64,...`。
- 可选 ComfyUI `IMAGE` 或图片路径 / URL。

注意：Gemma4 31B / 26BA4B 通常只支持 Vision + Text；Gemma4 E2B / E4B 才是音频 + 图片 + 文本的完整多模态方向。

## 常用建议

- 如果速度慢，先降低 `最大生成token`。
- 如果模型长时间思考，使用 `思考预算token=0/128/256`。
- 如果图片细节不重要，把 `最大边长` 从 1024 降到 512 可以明显加快图片推理。
- 如果显存紧张，可以尝试 KV cache q8_0。
- 如果 Qwen3.6 显存不够，可以尝试 `MoE专家上CPU` 或 `前N层专家上CPU`，但速度可能下降。
- Gemma4 音频推理建议使用 BF16 mmproj。

## 故障排查

### 找不到模型文件

确认模型放在：

```text
ComfyUI/models/LLM
```

放入后重启 ComfyUI，或者刷新节点列表。

### 图像推理提示没有 mmproj

图片 / 音频 / 多模态推理需要在模型加载器里选择对应的 `视觉投影mmproj`。
