// Style Variable Binder v2.1 - 孤儿绑定检测 + 智能名称匹配
// SIRIUS ATEAM

figma.showUI(__html__, { width: 720, height: 800 });

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

// ========== 字重解析 ==========

// 从 fontName.style 解析字重数值
function parseFontWeight(fontStyle) {
  if (!fontStyle) return null;

  var style = fontStyle.toLowerCase();

  // 常见字重名称映射
  var weightMap = {
    'thin': 100,
    'hairline': 100,
    'extralight': 200,
    'extra light': 200,
    'ultralight': 200,
    'ultra light': 200,
    'light': 300,
    'regular': 400,
    'normal': 400,
    'book': 400,
    'medium': 500,
    'semibold': 600,
    'semi bold': 600,
    'demibold': 600,
    'demi bold': 600,
    'bold': 700,
    'extrabold': 800,
    'extra bold': 800,
    'ultrabold': 800,
    'ultra bold': 800,
    'black': 900,
    'heavy': 900
  };

  // 先尝试精确匹配
  for (var key in weightMap) {
    if (style === key) {
      return weightMap[key];
    }
  }

  // 再尝试包含匹配（处理 "Bold Italic" 等情况）
  // 按优先级从高到低检查
  var priorities = ['black', 'heavy', 'extrabold', 'extra bold', 'ultrabold', 'ultra bold',
                    'bold', 'semibold', 'semi bold', 'demibold', 'demi bold',
                    'medium', 'regular', 'normal', 'book',
                    'light', 'extralight', 'extra light', 'ultralight', 'ultra light',
                    'thin', 'hairline'];

  for (var i = 0; i < priorities.length; i++) {
    if (style.indexOf(priorities[i]) >= 0) {
      return weightMap[priorities[i]];
    }
  }

  // 默认返回 400 (Regular)
  return 400;
}

// ========== 智能名称匹配 v2.1 ==========

// 标准化名称：移除所有分隔符，转小写
function normalizeName(name) {
  return name.toLowerCase().replace(/[\/\-_\s\.]/g, '');
}

// 提取名称关键词
function extractKeywords(name) {
  return name.toLowerCase()
    .replace(/[\/\-_\.]/g, ' ')
    .split(' ')
    .filter(function(k) { return k.length > 0; });
}

// 计算名称相似度分数 (0-100)
function calculateNameSimilarity(styleName, varName) {
  // 1. 完全标准化匹配
  var normalizedStyle = normalizeName(styleName);
  var normalizedVar = normalizeName(varName);

  if (normalizedStyle === normalizedVar) {
    return 100; // 完全匹配
  }

  // 2. 包含关系
  if (normalizedStyle.indexOf(normalizedVar) >= 0 || normalizedVar.indexOf(normalizedStyle) >= 0) {
    return 80;
  }

  // 3. 关键词匹配
  var styleKeywords = extractKeywords(styleName);
  var varKeywords = extractKeywords(varName);

  var matchCount = 0;
  var totalKeywords = Math.max(styleKeywords.length, varKeywords.length);

  for (var i = 0; i < styleKeywords.length; i++) {
    for (var j = 0; j < varKeywords.length; j++) {
      if (styleKeywords[i] === varKeywords[j]) {
        matchCount++;
        break;
      }
    }
  }

  if (totalKeywords > 0) {
    return Math.round((matchCount / totalKeywords) * 60); // 最高60分
  }

  return 0;
}

// 检查两个名称是否匹配（兼容旧接口）
function namesMatch(styleName, varName) {
  return calculateNameSimilarity(styleName, varName) >= 40;
}

// ========== 孤儿绑定检测与清理 ==========

function cleanOrphanBinding(style, field) {
  try {
    if (style.type === 'PAINT') {
      var paints = style.paints.slice();
      if (paints.length > 0 && paints[0].type === 'SOLID') {
        var currentPaint = paints[0];
        var newPaint = {
          type: 'SOLID',
          color: { r: currentPaint.color.r, g: currentPaint.color.g, b: currentPaint.color.b },
          opacity: currentPaint.opacity !== undefined ? currentPaint.opacity : 1,
          visible: currentPaint.visible !== undefined ? currentPaint.visible : true,
          blendMode: currentPaint.blendMode || 'NORMAL'
        };
        style.paints = [newPaint];
        return true;
      }
    } else if (style.type === 'TEXT' && field) {
      style.setBoundVariable(field, null);
      return true;
    }
  } catch (e) {
    console.error('清理孤儿绑定失败:', e);
  }
  return false;
}

// ========== 获取 Styles ==========

async function getPaintStyles() {
  var styles = await figma.getLocalPaintStylesAsync();
  var result = [];
  var orphansCleared = 0;

  for (var i = 0; i < styles.length; i++) {
    var style = styles[i];
    var paint = style.paints[0];
    var color = null;
    var hex = null;
    var hasBoundVariable = false;
    var boundVarInfo = null;
    var wasOrphan = false;

    if (paint && paint.type === 'SOLID') {
      color = paint.color;
      hex = rgbToHex(color.r, color.g, color.b);

      // 检查绑定状态
      var hasBinding = paint.boundVariables && paint.boundVariables.color;

      if (hasBinding) {
        var boundVarId = paint.boundVariables.color.id;
        var boundVar = await figma.variables.getVariableByIdAsync(boundVarId);

        if (boundVar) {
          // 正常绑定
          hasBoundVariable = true;
          var collection = await figma.variables.getVariableCollectionByIdAsync(boundVar.variableCollectionId);
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
        } else {
          // 孤儿绑定：Variable 已被删除，标记但不自动清理
          wasOrphan = true;
          orphansCleared++;
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
      bindableFields: paint && paint.type === 'SOLID' ? ['color'] : [],
      wasOrphan: wasOrphan
    });
  }

  // 返回清理统计
  if (orphansCleared > 0) {
    console.log('已自动清理 ' + orphansCleared + ' 个孤儿绑定');
  }

  return result;
}

async function getTextStyles() {
  var styles = await figma.getLocalTextStylesAsync();
  var result = [];
  var orphansCleared = 0;

  for (var i = 0; i < styles.length; i++) {
    var style = styles[i];
    var boundVars = style.boundVariables || {};

    // 获取已绑定的 Variable 详细信息，同时检测孤儿绑定
    var boundVarInfos = {};
    var actualBoundVars = {};
    var fields = ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'];

    var orphanFields = {}; // 记录失效的绑定字段

    for (var f = 0; f < fields.length; f++) {
      var field = fields[f];
      if (boundVars[field]) {
        var boundVarId = boundVars[field].id;
        var boundVar = await figma.variables.getVariableByIdAsync(boundVarId);

        if (boundVar) {
          // 正常绑定
          actualBoundVars[field] = true;
          var collection = await figma.variables.getVariableCollectionByIdAsync(boundVar.variableCollectionId);
          var modeId = collection ? collection.defaultModeId : null;
          var varValue = modeId ? boundVar.valuesByMode[modeId] : null;
          boundVarInfos[field] = {
            id: boundVar.id,
            name: boundVar.name,
            collectionName: collection ? collection.name : '',
            value: varValue
          };
        } else {
          // 孤儿绑定：标记为失效，不自动清理
          orphanFields[field] = true;
          orphansCleared++;
        }
      }
    }

    // 从 fontName.style 解析字重
    var fontWeight = parseFontWeight(style.fontName ? style.fontName.style : null);

    result.push({
      id: style.id,
      name: style.name,
      styleType: 'TEXT',
      fontSize: style.fontSize,
      fontWeight: fontWeight,
      fontStyle: style.fontName ? style.fontName.style : null,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
      boundVariables: {
        fontSize: !!actualBoundVars.fontSize,
        fontWeight: !!actualBoundVars.fontWeight,
        lineHeight: !!actualBoundVars.lineHeight,
        letterSpacing: !!actualBoundVars.letterSpacing
      },
      orphanBindings: orphanFields, // 失效的绑定
      boundVarInfos: boundVarInfos,
      bindableFields: ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing']
    });
  }

  if (orphansCleared > 0) {
    console.log('已自动清理 ' + orphansCleared + ' 个 Text Style 孤儿绑定');
  }

  return result;
}

async function getEffectStyles() {
  var styles = await figma.getLocalEffectStylesAsync();
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
      var variable = await figma.variables.getVariableByIdAsync(varId);

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

    // 检查是否是孤儿绑定 - 仍然为其推荐新的 Variable
    if (style.wasOrphan) {
      // 为孤儿绑定找最佳匹配
      var bestMatch = null;
      var minDistance = Infinity;
      var bestNameSimilarity = 0;

      for (var j = 0; j < colorVars.length; j++) {
        var variable = colorVars[j];
        var dist = colorDistance(style.color, variable.color);
        var nameSim = calculateNameSimilarity(style.name, variable.name);
        var colorScore = Math.max(0, 100 - dist * 5);
        var totalScore = colorScore * 0.7 + nameSim * 0.3;
        var currentBestScore = bestMatch ? (Math.max(0, 100 - minDistance * 5) * 0.7 + bestNameSimilarity * 0.3) : 0;

        if (totalScore > currentBestScore || bestMatch === null) {
          minDistance = dist;
          bestMatch = variable;
          bestNameSimilarity = nameSim;
        }
      }

      matches.push({
        style: style,
        field: 'color',
        variable: bestMatch,
        distance: minDistance,
        matchType: 'orphan',
        nameMatched: bestNameSimilarity >= 40,
        nameSimilarity: bestNameSimilarity,
        reason: '绑定失效'
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

    // 综合颜色距离和名称相似度进行匹配
    var bestMatch = null;
    var minDistance = Infinity;
    var bestNameSimilarity = 0;

    for (var j = 0; j < colorVars.length; j++) {
      var variable = colorVars[j];
      var dist = colorDistance(style.color, variable.color);
      var nameSim = calculateNameSimilarity(style.name, variable.name);

      // 计算综合评分：颜色权重 70%，名称权重 30%
      // 颜色距离转换为分数（0距离=100分，20距离=0分）
      var colorScore = Math.max(0, 100 - dist * 5);
      var totalScore = colorScore * 0.7 + nameSim * 0.3;

      // 优先选择综合分数最高的
      var currentBestScore = bestMatch ? (Math.max(0, 100 - minDistance * 5) * 0.7 + bestNameSimilarity * 0.3) : 0;

      if (totalScore > currentBestScore || bestMatch === null) {
        minDistance = dist;
        bestMatch = variable;
        bestNameSimilarity = nameSim;
      }
    }

    var nameMatched = bestNameSimilarity >= 40;
    var matchType = 'none';

    if (minDistance < 1) {
      matchType = nameMatched ? 'exact_name' : 'exact';
    } else if (minDistance < 20) {
      matchType = nameMatched ? 'close_name' : 'close';
    } else {
      matchType = 'far';
    }

    matches.push({
      style: style,
      field: 'color',
      variable: bestMatch,
      distance: minDistance,
      matchType: matchType,
      nameMatched: nameMatched,
      nameSimilarity: bestNameSimilarity,
      reason: null
    });
  }

  return matches;
}

function findTextMatches(styles, floatVars) {
  var matches = [];
  var fields = ['fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'];

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
          styleValue = styleValue.value;
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

      // 检查是否是孤儿绑定（绑定的 Variable 已被删除）- 仍然推荐新 Variable
      if (style.orphanBindings && style.orphanBindings[field]) {
        // 为孤儿绑定找最佳匹配
        var bestMatch = null;
        var minDistance = Infinity;
        var bestNameSimilarity = 0;

        for (var j = 0; j < floatVars.length; j++) {
          var variable = floatVars[j];
          var varName = variable.name.toLowerCase();
          var collectionName = (variable.collectionName || '').toLowerCase();
          var fullPath = collectionName + '/' + varName;

          // 检查字段相关性
          var isRelevant = false;
          if (field === 'fontSize' && (fullPath.indexOf('font') >= 0 || fullPath.indexOf('size') >= 0 || fullPath.indexOf('text') >= 0)) {
            isRelevant = true;
          } else if (field === 'fontWeight') {
            var weightKeywords = ['weight', 'bold', 'semibold', 'medium', 'regular', 'light', 'thin', 'black', 'extralight'];
            for (var k = 0; k < weightKeywords.length; k++) {
              if (fullPath.indexOf(weightKeywords[k]) >= 0) {
                isRelevant = true;
                break;
              }
            }
            if (isRelevant && (variable.value < 100 || variable.value > 900)) {
              isRelevant = false;
            }
          } else if (field === 'lineHeight' && (fullPath.indexOf('line') >= 0 || fullPath.indexOf('height') >= 0)) {
            isRelevant = true;
          } else if (field === 'letterSpacing' && (fullPath.indexOf('letter') >= 0 || fullPath.indexOf('spacing') >= 0 || fullPath.indexOf('tracking') >= 0)) {
            isRelevant = true;
          }

          if (!isRelevant) continue;

          var dist = Math.abs(styleValue - variable.value);
          var nameSim = calculateNameSimilarity(style.name, variable.name);
          var valueScore = Math.max(0, 100 - dist * 10);
          var totalScore = valueScore * 0.8 + nameSim * 0.2;
          var currentBestScore = bestMatch ? (Math.max(0, 100 - minDistance * 10) * 0.8 + bestNameSimilarity * 0.2) : 0;

          if (totalScore > currentBestScore || bestMatch === null) {
            minDistance = dist;
            bestMatch = variable;
            bestNameSimilarity = nameSim;
          }
        }

        matches.push({
          style: style,
          field: field,
          fieldValue: styleValue,
          variable: bestMatch,
          distance: minDistance,
          matchType: 'orphan',
          nameMatched: bestNameSimilarity >= 40,
          nameSimilarity: bestNameSimilarity,
          reason: '绑定失效'
        });
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
      var bestNameSimilarity = 0;

      for (var j = 0; j < floatVars.length; j++) {
        var variable = floatVars[j];
        var varName = variable.name.toLowerCase();

        // 检查 Variable 名称或 Collection 路径是否与字段相关
        var isRelevant = false;
        var collectionName = (variable.collectionName || '').toLowerCase();
        var fullPath = collectionName + '/' + varName;

        if (field === 'fontSize' && (fullPath.indexOf('font') >= 0 || fullPath.indexOf('size') >= 0 || fullPath.indexOf('text') >= 0)) {
          isRelevant = true;
        } else if (field === 'fontWeight') {
          // 支持多种命名方式：
          // 1. 名称或路径包含 weight
          // 2. 名称包含 bold/semibold/medium/regular/light/thin/black
          // 3. 变量值在字重范围内 (100-900)
          var weightKeywords = ['weight', 'bold', 'semibold', 'medium', 'regular', 'light', 'thin', 'black', 'extralight'];
          var hasWeightKeyword = false;
          for (var k = 0; k < weightKeywords.length; k++) {
            if (fullPath.indexOf(weightKeywords[k]) >= 0) {
              hasWeightKeyword = true;
              break;
            }
          }
          if (hasWeightKeyword && variable.value >= 100 && variable.value <= 900) {
            isRelevant = true;
          }
        } else if (field === 'lineHeight' && (fullPath.indexOf('line') >= 0 || fullPath.indexOf('height') >= 0)) {
          isRelevant = true;
        } else if (field === 'letterSpacing' && (fullPath.indexOf('letter') >= 0 || fullPath.indexOf('spacing') >= 0 || fullPath.indexOf('tracking') >= 0)) {
          isRelevant = true;
        }

        if (!isRelevant) continue;

        var dist = Math.abs(styleValue - variable.value);
        var nameSim = calculateNameSimilarity(style.name, variable.name);

        // 值距离权重更高（80%），因为数值匹配更重要
        var valueScore = Math.max(0, 100 - dist * 10);
        var totalScore = valueScore * 0.8 + nameSim * 0.2;

        var currentBestScore = bestMatch ? (Math.max(0, 100 - minDistance * 10) * 0.8 + bestNameSimilarity * 0.2) : 0;

        if (totalScore > currentBestScore || bestMatch === null) {
          minDistance = dist;
          bestMatch = variable;
          bestNameSimilarity = nameSim;
        }
      }

      if (bestMatch) {
        var nameMatched = bestNameSimilarity >= 40;
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
          nameSimilarity: bestNameSimilarity,
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
  var style = await figma.getStyleByIdAsync(styleId);
  var variable = await figma.variables.getVariableByIdAsync(variableId);

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
  var style = await figma.getStyleByIdAsync(styleId);
  var variable = await figma.variables.getVariableByIdAsync(variableId);

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
  var style = await figma.getStyleByIdAsync(styleId);
  var variable = await figma.variables.getVariableByIdAsync(variableId);

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
  var style = await figma.getStyleByIdAsync(styleId);
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
  var style = await figma.getStyleByIdAsync(styleId);
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
  var style = await figma.getStyleByIdAsync(styleId);
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

async function init() {
  try {
    // 获取样式和变量（孤儿绑定会在这里自动清理）
    var paintStyles = await getPaintStyles();
    var textStyles = await getTextStyles();

    var colorVars = getVariablesByType('COLOR');
    var floatVars = getVariablesByType('FLOAT');

    // 统计孤儿绑定（已被清理的）
    var orphansCleared = 0;
    for (var i = 0; i < paintStyles.length; i++) {
      if (paintStyles[i].wasOrphan) orphansCleared++;
    }

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
          floatVars: floatVars.length,
          orphansCleared: orphansCleared
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

figma.ui.onmessage = async function(msg) {
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

    await init();
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

    await init();
  }
  else if (msg.type === 'refresh') {
    await init();
  }
  else if (msg.type === 'ready') {
    await init();
  }
  else if (msg.type === 'close') {
    figma.closePlugin();
  }
};
