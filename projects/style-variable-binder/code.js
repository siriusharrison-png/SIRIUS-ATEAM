// Style Variable Binder v2.0 - 支持 Paint/Text/Effect Style 绑定
// SIRIUS ATEAM

figma.showUI(__html__, { width: 700, height: 750 });

// ========== 工具函数 ==========

function rgbToHex(r, g, b) {
  function toHex(n) {
    var hex = Math.round(n * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

function colorDistance(c1, c2) {
  var dr = (c1.r - c2.r) * 255;
  var dg = (c1.g - c2.g) * 255;
  var db = (c1.b - c2.b) * 255;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

// 提取名称前缀（第一个 / 之前的部分，或整个名称）
function getNamePrefix(name) {
  var parts = name.split('/');
  return parts[0].toLowerCase().trim();
}

// 提取名称后缀（最后一个 / 之后的部分）
function getNameSuffix(name) {
  var parts = name.split('/');
  return parts[parts.length - 1].toLowerCase().trim();
}

// 检查两个名称是否匹配（前缀或后缀相似）
function namesMatch(styleName, varName) {
  var stylePrefix = getNamePrefix(styleName);
  var varPrefix = getNamePrefix(varName);
  var styleSuffix = getNameSuffix(styleName);
  var varSuffix = getNameSuffix(varName);

  // 检查是否包含相同的关键词
  var styleKeywords = styleName.toLowerCase().replace(/[\/\-_]/g, ' ').split(' ');
  var varKeywords = varName.toLowerCase().replace(/[\/\-_]/g, ' ').split(' ');

  var matchCount = 0;
  for (var i = 0; i < styleKeywords.length; i++) {
    if (styleKeywords[i].length > 1) {
      for (var j = 0; j < varKeywords.length; j++) {
        if (varKeywords[j].length > 1 && styleKeywords[i] === varKeywords[j]) {
          matchCount++;
        }
      }
    }
  }

  return matchCount > 0;
}

// ========== 获取 Styles ==========

function getPaintStyles() {
  var styles = figma.getLocalPaintStyles();
  var result = [];

  for (var i = 0; i < styles.length; i++) {
    var style = styles[i];
    var paint = style.paints[0];
    var color = null;
    var hex = null;
    var hasBoundVariable = false;
    var boundVarInfo = null;

    if (paint && paint.type === 'SOLID') {
      color = paint.color;
      hex = rgbToHex(color.r, color.g, color.b);
      hasBoundVariable = paint.boundVariables && paint.boundVariables.color;

      // 获取已绑定的 Variable 信息
      if (hasBoundVariable) {
        var boundVarId = paint.boundVariables.color.id;
        var boundVar = figma.variables.getVariableById(boundVarId);
        if (boundVar) {
          var collection = figma.variables.getVariableCollectionById(boundVar.variableCollectionId);
          var modeId = collection ? collection.defaultModeId : null;
          var varValue = modeId ? boundVar.valuesByMode[modeId] : null;
          var varHex = null;
          if (varValue && typeof varValue === 'object' && 'r' in varValue) {
            varHex = rgbToHex(varValue.r, varValue.g, varValue.b);
          }
          boundVarInfo = {
            id: boundVar.id,
            name: boundVar.name,
            collectionName: collection ? collection.name : '',
            hex: varHex
          };
        }
      }
    }

    result.push({
      id: style.id,
      name: style.name,
      styleType: 'PAINT',
      paintType: paint ? paint.type : 'UNKNOWN',
      color: color,
      hex: hex,
      hasBoundVariable: !!hasBoundVariable,
      boundVarInfo: boundVarInfo,
      bindableFields: paint && paint.type === 'SOLID' ? ['color'] : []
    });
  }

  return result;
}

function getTextStyles() {
  var styles = figma.getLocalTextStyles();
  var result = [];

  for (var i = 0; i < styles.length; i++) {
    var style = styles[i];
    var boundVars = style.boundVariables || {};

    // 获取已绑定的 Variable 详细信息
    var boundVarInfos = {};
    var fields = ['fontSize', 'lineHeight', 'letterSpacing'];
    for (var f = 0; f < fields.length; f++) {
      var field = fields[f];
      if (boundVars[field]) {
        var boundVarId = boundVars[field].id;
        var boundVar = figma.variables.getVariableById(boundVarId);
        if (boundVar) {
          var collection = figma.variables.getVariableCollectionById(boundVar.variableCollectionId);
          var modeId = collection ? collection.defaultModeId : null;
          var varValue = modeId ? boundVar.valuesByMode[modeId] : null;
          boundVarInfos[field] = {
            id: boundVar.id,
            name: boundVar.name,
            collectionName: collection ? collection.name : '',
            value: varValue
          };
        }
      }
    }

    result.push({
      id: style.id,
      name: style.name,
      styleType: 'TEXT',
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      boundVariables: {
        fontSize: !!boundVars.fontSize,
        fontWeight: !!boundVars.fontWeight,
        lineHeight: !!boundVars.lineHeight,
        letterSpacing: !!boundVars.letterSpacing
      },
      boundVarInfos: boundVarInfos,
      bindableFields: ['fontSize', 'lineHeight', 'letterSpacing']
    });
  }

  return result;
}

function getEffectStyles() {
  var styles = figma.getLocalEffectStyles();
  var result = [];

  for (var i = 0; i < styles.length; i++) {
    var style = styles[i];
    var effects = style.effects;
    var effectInfo = [];

    for (var j = 0; j < effects.length; j++) {
      var effect = effects[j];
      if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
        effectInfo.push({
          type: effect.type,
          radius: effect.radius,
          offsetX: effect.offset ? effect.offset.x : 0,
          offsetY: effect.offset ? effect.offset.y : 0,
          spread: effect.spread || 0,
          color: effect.color
        });
      }
    }

    result.push({
      id: style.id,
      name: style.name,
      styleType: 'EFFECT',
      effects: effectInfo,
      bindableFields: ['radius', 'spread', 'offsetX', 'offsetY']
    });
  }

  return result;
}

// ========== 获取 Variables ==========

function getVariablesByType(type) {
  var collections = figma.variables.getLocalVariableCollections();
  var variables = [];

  for (var i = 0; i < collections.length; i++) {
    var collection = collections[i];
    var varIds = collection.variableIds;

    for (var j = 0; j < varIds.length; j++) {
      var varId = varIds[j];
      var variable = figma.variables.getVariableById(varId);

      if (variable && variable.resolvedType === type) {
        var modeId = collection.defaultModeId;
        var value = variable.valuesByMode[modeId];

        if (type === 'COLOR' && value && typeof value === 'object' && 'r' in value) {
          variables.push({
            id: variable.id,
            name: variable.name,
            collectionName: collection.name,
            type: 'COLOR',
            color: { r: value.r, g: value.g, b: value.b },
            hex: rgbToHex(value.r, value.g, value.b),
            value: null
          });
        } else if (type === 'FLOAT' && typeof value === 'number') {
          variables.push({
            id: variable.id,
            name: variable.name,
            collectionName: collection.name,
            type: 'FLOAT',
            value: value,
            color: null,
            hex: null
          });
        }
      }
    }
  }

  return variables;
}

// ========== 匹配逻辑 ==========

function findPaintMatches(styles, colorVars) {
  var matches = [];

  for (var i = 0; i < styles.length; i++) {
    var style = styles[i];

    if (style.paintType !== 'SOLID' || !style.color) {
      matches.push({
        style: style,
        field: 'color',
        variable: null,
        distance: Infinity,
        matchType: 'skip',
        reason: style.paintType !== 'SOLID' ? '非纯色' : '无颜色'
      });
      continue;
    }

    if (style.hasBoundVariable) {
      matches.push({
        style: style,
        field: 'color',
        variable: style.boundVarInfo,
        distance: 0,
        matchType: 'bound',
        reason: '已绑定'
      });
      continue;
    }

    // 先按颜色值找最接近的
    var bestMatch = null;
    var minDistance = Infinity;
    var nameMatched = false;

    for (var j = 0; j < colorVars.length; j++) {
      var variable = colorVars[j];
      var dist = colorDistance(style.color, variable.color);

      // 优先选择名称匹配的
      var isNameMatch = namesMatch(style.name, variable.name);

      if (dist < minDistance || (dist === minDistance && isNameMatch && !nameMatched)) {
        minDistance = dist;
        bestMatch = variable;
        nameMatched = isNameMatch;
      }
    }

    var matchType = 'none';
    if (minDistance < 1) matchType = nameMatched ? 'exact_name' : 'exact';
    else if (minDistance < 20) matchType = nameMatched ? 'close_name' : 'close';
    else matchType = 'far';

    matches.push({
      style: style,
      field: 'color',
      variable: bestMatch,
      distance: minDistance,
      matchType: matchType,
      nameMatched: nameMatched,
      reason: null
    });
  }

  return matches;
}

function findTextMatches(styles, floatVars) {
  var matches = [];
  var fields = ['fontSize', 'lineHeight', 'letterSpacing'];

  for (var i = 0; i < styles.length; i++) {
    var style = styles[i];

    for (var f = 0; f < fields.length; f++) {
      var field = fields[f];
      var styleValue = style[field];

      // 处理 lineHeight 的特殊情况
      if (field === 'lineHeight' && styleValue && typeof styleValue === 'object') {
        if (styleValue.unit === 'PIXELS') {
          styleValue = styleValue.value;
        } else if (styleValue.unit === 'PERCENT') {
          styleValue = styleValue.value; // 百分比值
        } else {
          styleValue = null; // AUTO
        }
      }

      // 处理 letterSpacing
      if (field === 'letterSpacing' && styleValue && typeof styleValue === 'object') {
        if (styleValue.unit === 'PIXELS') {
          styleValue = styleValue.value;
        } else {
          styleValue = styleValue.value; // PERCENT
        }
      }

      if (styleValue === null || styleValue === undefined) {
        continue;
      }

      if (style.boundVariables && style.boundVariables[field]) {
        var boundInfo = style.boundVarInfos ? style.boundVarInfos[field] : null;
        matches.push({
          style: style,
          field: field,
          fieldValue: styleValue,
          variable: boundInfo,
          distance: 0,
          matchType: 'bound',
          reason: '已绑定'
        });
        continue;
      }

      // 找值最接近且名称匹配的 Variable
      var bestMatch = null;
      var minDistance = Infinity;
      var nameMatched = false;

      for (var j = 0; j < floatVars.length; j++) {
        var variable = floatVars[j];
        var varName = variable.name.toLowerCase();

        // 检查 Variable 名称是否与字段相关
        var isRelevant = false;
        if (field === 'fontSize' && (varName.indexOf('font') >= 0 || varName.indexOf('size') >= 0 || varName.indexOf('text') >= 0)) {
          isRelevant = true;
        } else if (field === 'lineHeight' && (varName.indexOf('line') >= 0 || varName.indexOf('height') >= 0)) {
          isRelevant = true;
        } else if (field === 'letterSpacing' && (varName.indexOf('letter') >= 0 || varName.indexOf('spacing') >= 0 || varName.indexOf('tracking') >= 0)) {
          isRelevant = true;
        }

        if (!isRelevant) continue;

        var dist = Math.abs(styleValue - variable.value);
        var isNameMatch = namesMatch(style.name, variable.name);

        if (dist < minDistance) {
          minDistance = dist;
          bestMatch = variable;
          nameMatched = isNameMatch;
        }
      }

      if (bestMatch) {
        var matchType = minDistance < 0.5 ? 'exact' : (minDistance < 5 ? 'close' : 'far');
        if (nameMatched) matchType += '_name';

        matches.push({
          style: style,
          field: field,
          fieldValue: styleValue,
          variable: bestMatch,
          distance: minDistance,
          matchType: matchType,
          nameMatched: nameMatched,
          reason: null
        });
      }
    }
  }

  return matches;
}

function findEffectMatches(styles, floatVars, colorVars) {
  var matches = [];

  for (var i = 0; i < styles.length; i++) {
    var style = styles[i];

    if (!style.effects || style.effects.length === 0) {
      continue;
    }

    // 为阴影效果找匹配的 radius Variable
    var effect = style.effects[0]; // 只处理第一个效果

    // 找 radius 匹配
    var bestRadiusMatch = null;
    var minRadiusDist = Infinity;

    for (var j = 0; j < floatVars.length; j++) {
      var variable = floatVars[j];
      var varName = variable.name.toLowerCase();

      // 检查是否是阴影相关的 Variable
      if (varName.indexOf('shadow') >= 0 || varName.indexOf('blur') >= 0 || varName.indexOf('radius') >= 0) {
        var dist = Math.abs(effect.radius - variable.value);
        if (dist < minRadiusDist) {
          minRadiusDist = dist;
          bestRadiusMatch = variable;
        }
      }
    }

    if (bestRadiusMatch && minRadiusDist < 2) {
      matches.push({
        style: style,
        field: 'radius',
        fieldValue: effect.radius,
        variable: bestRadiusMatch,
        distance: minRadiusDist,
        matchType: minRadiusDist < 0.5 ? 'exact' : 'close',
        nameMatched: namesMatch(style.name, bestRadiusMatch.name),
        reason: null
      });
    }
  }

  return matches;
}

// ========== 绑定操作 ==========

function bindPaintStyle(styleId, variableId) {
  var style = figma.getStyleById(styleId);
  var variable = figma.variables.getVariableById(variableId);

  if (!style || !variable) {
    return { success: false, error: 'Style 或 Variable 不存在' };
  }

  try {
    var paints = style.paints.slice();
    if (paints.length === 0 || paints[0].type !== 'SOLID') {
      return { success: false, error: '不是纯色样式' };
    }

    var newPaint = figma.variables.setBoundVariableForPaint(paints[0], 'color', variable);
    style.paints = [newPaint];

    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function bindTextStyle(styleId, field, variableId) {
  var style = figma.getStyleById(styleId);
  var variable = figma.variables.getVariableById(variableId);

  if (!style || !variable) {
    return { success: false, error: 'Style 或 Variable 不存在' };
  }

  try {
    style.setBoundVariable(field, variable);
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function bindEffectStyle(styleId, field, variableId, effectIndex) {
  var style = figma.getStyleById(styleId);
  var variable = figma.variables.getVariableById(variableId);

  if (!style || !variable) {
    return { success: false, error: 'Style 或 Variable 不存在' };
  }

  try {
    // Effect style 绑定更复杂，需要特殊处理
    var effects = style.effects.slice();
    var effect = effects[effectIndex || 0];

    if (field === 'radius') {
      effect = figma.variables.setBoundVariableForEffect(effect, 'radius', variable);
      effects[effectIndex || 0] = effect;
      style.effects = effects;
    }

    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ========== 解除绑定 ==========

function unbindPaintStyle(styleId) {
  var style = figma.getStyleById(styleId);
  if (!style) {
    return { success: false, error: 'Style 不存在' };
  }

  try {
    var paints = style.paints.slice();
    if (paints.length === 0 || paints[0].type !== 'SOLID') {
      return { success: false, error: '不是纯色样式' };
    }

    // 获取当前颜色值，创建不绑定变量的新 paint
    var currentPaint = paints[0];
    var color = currentPaint.color;

    var newPaint = {
      type: 'SOLID',
      color: { r: color.r, g: color.g, b: color.b },
      opacity: currentPaint.opacity !== undefined ? currentPaint.opacity : 1,
      visible: currentPaint.visible !== undefined ? currentPaint.visible : true,
      blendMode: currentPaint.blendMode || 'NORMAL'
    };

    style.paints = [newPaint];
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function unbindTextStyle(styleId, field) {
  var style = figma.getStyleById(styleId);
  if (!style) {
    return { success: false, error: 'Style 不存在' };
  }

  try {
    style.setBoundVariable(field, null);
    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function unbindEffectStyle(styleId, field, effectIndex) {
  var style = figma.getStyleById(styleId);
  if (!style) {
    return { success: false, error: 'Style 不存在' };
  }

  try {
    var effects = style.effects.slice();
    var effect = effects[effectIndex || 0];

    // 创建不绑定变量的新 effect
    var newEffect = {
      type: effect.type,
      visible: effect.visible,
      radius: effect.radius,
      color: effect.color,
      blendMode: effect.blendMode,
      offset: effect.offset,
      spread: effect.spread
    };

    effects[effectIndex || 0] = newEffect;
    style.effects = effects;

    return { success: true, error: null };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ========== 初始化和消息处理 ==========

function init() {
  try {
    var paintStyles = getPaintStyles();
    var textStyles = getTextStyles();

    var colorVars = getVariablesByType('COLOR');
    var floatVars = getVariablesByType('FLOAT');

    var paintMatches = findPaintMatches(paintStyles, colorVars);
    var textMatches = findTextMatches(textStyles, floatVars);

    figma.ui.postMessage({
      type: 'init',
      data: {
        paintMatches: paintMatches,
        textMatches: textMatches,
        stats: {
          paintStyles: paintStyles.length,
          textStyles: textStyles.length,
          colorVars: colorVars.length,
          floatVars: floatVars.length
        }
      }
    });
  } catch (e) {
    console.error('init error:', e);
    figma.ui.postMessage({
      type: 'init',
      data: {
        paintMatches: [],
        textMatches: [],
        error: e.message
      }
    });
  }
}

figma.ui.onmessage = function(msg) {
  if (msg.type === 'unbind-all') {
    var results = [];

    for (var i = 0; i < msg.items.length; i++) {
      var item = msg.items[i];
      var result;

      if (item.styleType === 'PAINT') {
        result = unbindPaintStyle(item.styleId);
      } else if (item.styleType === 'TEXT') {
        result = unbindTextStyle(item.styleId, item.field);
      } else if (item.styleType === 'EFFECT') {
        result = unbindEffectStyle(item.styleId, item.field, 0);
      }

      results.push({
        styleId: item.styleId,
        field: item.field,
        success: result ? result.success : false,
        error: result ? result.error : 'Unknown type'
      });
    }

    figma.ui.postMessage({
      type: 'unbind-all-result',
      results: results
    });

    init();
  }
  else if (msg.type === 'bind-all') {
    var results = [];

    for (var i = 0; i < msg.items.length; i++) {
      var item = msg.items[i];
      var result;

      if (item.styleType === 'PAINT') {
        result = bindPaintStyle(item.styleId, item.variableId);
      } else if (item.styleType === 'TEXT') {
        result = bindTextStyle(item.styleId, item.field, item.variableId);
      } else if (item.styleType === 'EFFECT') {
        result = bindEffectStyle(item.styleId, item.field, item.variableId, 0);
      }

      results.push({
        styleId: item.styleId,
        field: item.field,
        success: result ? result.success : false,
        error: result ? result.error : 'Unknown type'
      });
    }

    figma.ui.postMessage({
      type: 'bind-all-result',
      results: results
    });

    init();
  }
  else if (msg.type === 'refresh') {
    init();
  }
  else if (msg.type === 'ready') {
    init();
  }
  else if (msg.type === 'close') {
    figma.closePlugin();
  }
};
