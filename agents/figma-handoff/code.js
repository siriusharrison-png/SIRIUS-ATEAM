/// <reference types="@figma/plugin-typings" />
// code.ts - Figma Plugin Main Logic
figma.showUI(__html__, { width: 400, height: 600 });
// 监听菜单命令
figma.on("run", ({ command }) => {
    if (command === "generate") {
        handleGenerate();
    }
    else if (command === "specs") {
        handleSpecs();
    }
});
// 监听选择变化
figma.on("selectionchange", () => {
    const selection = figma.currentPage.selection;
    if (selection.length > 0) {
        const nodeData = extractNodeData(selection[0]);
        figma.ui.postMessage({ type: "selection", data: nodeData });
    }
});
// 监听 UI 消息
figma.ui.onmessage = async (msg) => {
    if (msg.type === "generate-code") {
        const selection = figma.currentPage.selection;
        if (selection.length > 0) {
            const nodeData = extractNodeData(selection[0]);
            figma.ui.postMessage({ type: "node-data", data: nodeData });
        }
    }
    else if (msg.type === "save-specs") {
        const selection = figma.currentPage.selection;
        if (selection.length > 0) {
            await saveSpecsToNode(selection[0], msg.specs);
            figma.notify("Specs saved!");
        }
    }
    else if (msg.type === "load-specs") {
        const selection = figma.currentPage.selection;
        if (selection.length > 0) {
            const specs = await loadSpecsFromNode(selection[0]);
            figma.ui.postMessage({ type: "specs-loaded", data: specs });
        }
    }
};
function handleGenerate() {
    figma.ui.postMessage({ type: "show-tab", tab: "code" });
}
function handleSpecs() {
    figma.ui.postMessage({ type: "show-tab", tab: "specs" });
}
// 提取节点数据
function extractNodeData(node) {
    const data = {
        id: node.id,
        name: node.name,
        type: node.type,
    };
    // 尺寸
    if ("width" in node && "height" in node) {
        data.width = node.width;
        data.height = node.height;
    }
    // 位置
    if ("x" in node && "y" in node) {
        data.x = node.x;
        data.y = node.y;
    }
    // 填充
    if ("fills" in node && Array.isArray(node.fills)) {
        data.fills = node.fills.map(extractFill);
    }
    // 描边
    if ("strokes" in node && Array.isArray(node.strokes)) {
        data.strokes = node.strokes;
        if ("strokeWeight" in node) {
            data.strokeWeight = node.strokeWeight;
        }
    }
    // 圆角
    if ("cornerRadius" in node) {
        data.cornerRadius = node.cornerRadius;
    }
    // 自动布局
    if ("layoutMode" in node) {
        data.layoutMode = node.layoutMode;
        data.itemSpacing = node.itemSpacing;
        data.paddingTop = node.paddingTop;
        data.paddingRight = node.paddingRight;
        data.paddingBottom = node.paddingBottom;
        data.paddingLeft = node.paddingLeft;
    }
    // 文字属性
    if (node.type === "TEXT") {
        const textNode = node;
        data.characters = textNode.characters;
        data.fontSize = textNode.fontSize;
        data.fontWeight = textNode.fontWeight;
        data.textAlignHorizontal = textNode.textAlignHorizontal;
        data.textAlignVertical = textNode.textAlignVertical;
    }
    // 子节点
    if ("children" in node) {
        data.children = node.children.map(extractNodeData);
    }
    return data;
}
function extractFill(fill) {
    if (fill.type === "SOLID") {
        return {
            type: "SOLID",
            color: {
                r: fill.color.r,
                g: fill.color.g,
                b: fill.color.b,
            },
            opacity: fill.opacity ?? 1,
        };
    }
    return { type: fill.type };
}
// 保存规范到节点
async function saveSpecsToNode(node, specs) {
    node.setPluginData("handoff-specs", JSON.stringify(specs));
}
// 从节点加载规范
async function loadSpecsFromNode(node) {
    const data = node.getPluginData("handoff-specs");
    if (data) {
        return JSON.parse(data);
    }
    return null;
}
