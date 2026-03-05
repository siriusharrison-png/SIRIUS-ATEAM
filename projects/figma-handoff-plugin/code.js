/// <reference types="@figma/plugin-typings" />
// code.ts - Figma Plugin Main Logic
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
figma.ui.onmessage = (msg) => __awaiter(this, void 0, void 0, function* () {
    if (msg.type === "generate-code") {
        const selection = figma.currentPage.selection;
        if (selection.length > 0) {
            const nodeData = extractNodeData(selection[0]);
            const code = generateCode(nodeData, msg.specs);
            figma.ui.postMessage({ type: "code-generated", code: code });
        }
        else {
            figma.ui.postMessage({ type: "code-generated", code: "// 请先选择一个组件" });
        }
    }
    else if (msg.type === "save-specs") {
        const selection = figma.currentPage.selection;
        if (selection.length > 0) {
            yield saveSpecsToNode(selection[0], msg.specs);
            figma.notify("Specs saved!");
        }
    }
    else if (msg.type === "load-specs") {
        const selection = figma.currentPage.selection;
        if (selection.length > 0) {
            const specs = yield loadSpecsFromNode(selection[0]);
            figma.ui.postMessage({ type: "specs-loaded", data: specs });
        }
    }
    else if (msg.type === "add-specs-to-figma") {
        const selection = figma.currentPage.selection;
        if (selection.length > 0) {
            yield addSpecsToFigma(selection[0], msg.markdown, msg.componentName);
        }
    }
});
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
            opacity: fill.opacity !== undefined ? fill.opacity : 1,
        };
    }
    return { type: fill.type };
}
// 保存规范到节点
function saveSpecsToNode(node, specs) {
    return __awaiter(this, void 0, void 0, function* () {
        node.setPluginData("handoff-specs", JSON.stringify(specs));
    });
}
// 从节点加载规范
function loadSpecsFromNode(node) {
    return __awaiter(this, void 0, void 0, function* () {
        const data = node.getPluginData("handoff-specs");
        if (data) {
            return JSON.parse(data);
        }
        return null;
    });
}
// 将规范添加到 Figma 画布
function addSpecsToFigma(node, markdown, componentName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // 加载字体
            yield figma.loadFontAsync({ family: "Inter", style: "Regular" });
            yield figma.loadFontAsync({ family: "Inter", style: "Bold" });
            // 创建外框 Frame
            const frame = figma.createFrame();
            frame.name = componentName + " - 设计说明";
            frame.fills = [{ type: "SOLID", color: { r: 1, g: 0.98, b: 0.94 } }]; // 浅黄色背景
            frame.strokes = [{ type: "SOLID", color: { r: 0.9, g: 0.85, b: 0.7 } }];
            frame.strokeWeight = 1;
            frame.cornerRadius = 8;
            frame.layoutMode = "VERTICAL";
            frame.primaryAxisSizingMode = "AUTO";
            frame.counterAxisSizingMode = "AUTO";
            frame.paddingTop = 16;
            frame.paddingRight = 16;
            frame.paddingBottom = 16;
            frame.paddingLeft = 16;
            frame.itemSpacing = 8;
            // 创建标题
            const title = figma.createText();
            title.fontName = { family: "Inter", style: "Bold" };
            title.characters = "📋 " + componentName + " 设计说明";
            title.fontSize = 14;
            title.fills = [{ type: "SOLID", color: { r: 0.2, g: 0.2, b: 0.2 } }];
            frame.appendChild(title);
            // 创建分隔线
            const divider = figma.createRectangle();
            divider.name = "divider";
            divider.resize(300, 1);
            divider.fills = [{ type: "SOLID", color: { r: 0.85, g: 0.8, b: 0.65 } }];
            frame.appendChild(divider);
            // 创建内容文本
            const content = figma.createText();
            content.fontName = { family: "Inter", style: "Regular" };
            content.characters = markdown;
            content.fontSize = 12;
            content.lineHeight = { value: 18, unit: "PIXELS" };
            content.fills = [{ type: "SOLID", color: { r: 0.3, g: 0.3, b: 0.3 } }];
            frame.appendChild(content);
            // 定位到选中节点旁边
            if ("x" in node && "y" in node && "width" in node) {
                frame.x = node.x + node.width + 40;
                frame.y = node.y;
            }
            // 选中新创建的 Frame
            figma.currentPage.selection = [frame];
            figma.viewport.scrollAndZoomIntoView([frame]);
            figma.notify("设计说明已添加到画布 ✓");
            figma.ui.postMessage({ type: "specs-added-success" });
        }
        catch (error) {
            figma.notify("添加失败：" + error, { error: true });
            figma.ui.postMessage({ type: "specs-added-error", error: String(error) });
        }
    });
}
// ============ 代码生成逻辑 ============
// 颜色映射到 Tailwind 类名
function colorToTailwind(color, type) {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    // 常见颜色映射
    const colorMap = {
        '255,255,255': 'white',
        '0,0,0': 'black',
        '51,51,51': 'gray-800',
        '102,102,102': 'gray-600',
        '153,153,153': 'gray-400',
        '240,240,240': 'gray-100',
        '229,229,229': 'gray-200',
    };
    const key = r + ',' + g + ',' + b;
    if (colorMap[key]) {
        return type + '-' + colorMap[key];
    }
    // 返回 hex 作为 arbitrary value
    const hex = '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
    return type + '-[' + hex + ']';
}
// 间距映射
function spacingToTailwind(value) {
    const spacingMap = {
        0: '0', 4: '1', 8: '2', 12: '3', 16: '4', 20: '5', 24: '6', 32: '8', 40: '10', 48: '12', 64: '16'
    };
    return spacingMap[value] || '[' + value + 'px]';
}
// 圆角映射
function radiusToTailwind(value) {
    if (value === 0)
        return '';
    if (value === 4)
        return 'rounded-sm';
    if (value === 6)
        return 'rounded-md';
    if (value === 8)
        return 'rounded-lg';
    if (value >= 9999)
        return 'rounded-full';
    return 'rounded-[' + value + 'px]';
}
// 转换为 PascalCase
function toPascalCase(str) {
    return str
        .replace(/[-_\s]+(.)?/g, function (_, c) { return c ? c.toUpperCase() : ''; })
        .replace(/^(.)/, function (c) { return c.toUpperCase(); });
}
// 提取 Tailwind 类名
function extractClassNames(node) {
    const classes = [];
    // Layout
    if (node.layoutMode === 'HORIZONTAL') {
        classes.push('flex');
    }
    else if (node.layoutMode === 'VERTICAL') {
        classes.push('flex', 'flex-col');
    }
    // Gap
    if (node.itemSpacing) {
        classes.push('gap-' + spacingToTailwind(node.itemSpacing));
    }
    // Padding
    if (node.paddingTop || node.paddingRight || node.paddingBottom || node.paddingLeft) {
        const pt = node.paddingTop || 0;
        const pr = node.paddingRight || 0;
        const pb = node.paddingBottom || 0;
        const pl = node.paddingLeft || 0;
        if (pt === pr && pr === pb && pb === pl && pt > 0) {
            classes.push('p-' + spacingToTailwind(pt));
        }
        else {
            if (pt)
                classes.push('pt-' + spacingToTailwind(pt));
            if (pr)
                classes.push('pr-' + spacingToTailwind(pr));
            if (pb)
                classes.push('pb-' + spacingToTailwind(pb));
            if (pl)
                classes.push('pl-' + spacingToTailwind(pl));
        }
    }
    // Background
    if (node.fills && node.fills.length > 0) {
        const fill = node.fills[0];
        if (fill.type === 'SOLID' && fill.color) {
            classes.push(colorToTailwind(fill.color, 'bg'));
        }
    }
    // Border radius
    if (node.cornerRadius) {
        const radius = radiusToTailwind(node.cornerRadius);
        if (radius)
            classes.push(radius);
    }
    // 尺寸
    if (node.width && node.height) {
        classes.push('w-[' + Math.round(node.width) + 'px]');
        classes.push('h-[' + Math.round(node.height) + 'px]');
    }
    return classes;
}
// 提取文字类名
function extractTextClasses(node) {
    const classes = [];
    // Font size
    if (node.fontSize) {
        const sizeMap = {
            12: 'text-xs', 14: 'text-sm', 16: 'text-base', 18: 'text-lg', 20: 'text-xl', 24: 'text-2xl'
        };
        classes.push(sizeMap[node.fontSize] || 'text-[' + node.fontSize + 'px]');
    }
    // Font weight
    if (node.fontWeight) {
        const weightMap = {
            400: '', 500: 'font-medium', 600: 'font-semibold', 700: 'font-bold'
        };
        const weight = weightMap[node.fontWeight];
        if (weight)
            classes.push(weight);
    }
    // Text color
    if (node.fills && node.fills.length > 0) {
        const fill = node.fills[0];
        if (fill.type === 'SOLID' && fill.color) {
            classes.push(colorToTailwind(fill.color, 'text'));
        }
    }
    return classes;
}
// 生成子节点代码
function generateChildren(node, indent) {
    if (!node.children || node.children.length === 0) {
        return '';
    }
    var spaces = '';
    for (var i = 0; i < indent; i++) {
        spaces += '  ';
    }
    var result = '';
    for (var j = 0; j < node.children.length; j++) {
        var child = node.children[j];
        if (child.type === 'TEXT') {
            var textClasses = extractTextClasses(child);
            var textContent = child.characters || '';
            result += spaces + '<span className="' + textClasses.join(' ') + '">' + textContent + '</span>\n';
        }
        else if (child.type === 'FRAME' || child.type === 'GROUP' || child.type === 'INSTANCE' || child.type === 'COMPONENT') {
            var childClasses = extractClassNames(child);
            result += spaces + '<div className="' + childClasses.join(' ') + '">\n';
            result += generateChildren(child, indent + 1);
            result += spaces + '</div>\n';
        }
        else if (child.type === 'RECTANGLE' || child.type === 'ELLIPSE') {
            var shapeClasses = extractClassNames(child);
            result += spaces + '<div className="' + shapeClasses.join(' ') + '" />\n';
        }
    }
    return result;
}
// 生成组件代码
function generateCode(nodeData, specs) {
    const componentName = toPascalCase(nodeData.name);
    const classNames = extractClassNames(nodeData);
    const children = generateChildren(nodeData, 2);
    var code = '';
    // 添加组件注释
    code += '// ' + nodeData.name + ' Component\n';
    code += '// 尺寸: ' + Math.round(nodeData.width || 0) + ' x ' + Math.round(nodeData.height || 0) + '\n\n';
    code += 'export default function ' + componentName + '() {\n';
    code += '  return (\n';
    code += '    <div className="' + classNames.join(' ') + '">\n';
    code += children;
    code += '    </div>\n';
    code += '  )\n';
    code += '}';
    return code;
}
