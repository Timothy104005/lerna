(function (global) {
  const KNOWN_FUNCTIONS = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    log: (value) => Math.log10(value),
    ln: (value) => Math.log(value),
    sqrt: (value) => Math.sqrt(value),
    abs: (value) => Math.abs(value),
    exp: (value) => Math.exp(value),
  };

  const KNOWN_CONSTANTS = {
    pi: Math.PI,
    e: Math.E,
  };

  const GRAPH_COLORS = [
    "#4a7c74",
    "#c08a3e",
    "#8b5e8f",
    "#4874a6",
    "#b35d4d",
    "#5b7b51",
  ];

  const DEFAULT_VIEW = {
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10,
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeTiny(value) {
    if (!Number.isFinite(value)) return value;
    return Math.abs(value) < 1e-12 ? 0 : value;
  }

  function trimPlain(value) {
    if (!value.includes(".")) return value === "-0" ? "0" : value;
    let next = value.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
    return next === "-0" || next === "" ? "0" : next;
  }

  function trimExponent(value) {
    const pieces = value.split("e");
    if (pieces.length !== 2) return value;
    const mantissa = trimPlain(pieces[0]);
    let exponent = pieces[1].replace(/^([+-])0+$/, "$10");
    exponent = exponent.replace(/^([+-])0+(\d)/, "$1$2");
    return mantissa + "e" + exponent;
  }

  function formatNumber(value) {
    const normalized = normalizeTiny(value);
    if (!Number.isFinite(normalized)) return "Error";
    const abs = Math.abs(normalized);
    if (abs !== 0 && (abs >= 1e10 || abs < 1e-6)) {
      return trimExponent(normalized.toExponential(11));
    }
    const raw = Number(normalized.toPrecision(12)).toString();
    return raw.includes("e") ? trimExponent(raw) : trimPlain(raw);
  }

  function normalizeInput(input) {
    return String(input || "")
      .replace(/\u03c0/g, "pi")
      .replace(/\u221a/g, "sqrt")
      .replace(/[×·]/g, "*")
      .replace(/\u00f7/g, "/")
      .trim();
  }

  function splitEquation(input) {
    if (!input) return { ok: false, kind: "empty", expression: "", error: "" };
    if (!/=/.test(input)) {
      return { ok: true, kind: "function", expression: input };
    }
    const pieces = input.split("=");
    if (pieces.length !== 2) {
      return {
        ok: false,
        kind: "error",
        expression: "",
        error: "Only a single equation is supported.",
      };
    }
    const left = pieces[0].trim().toLowerCase();
    const right = pieces[1].trim();
    if (left !== "y") {
      return {
        ok: false,
        kind: "error",
        expression: "",
        error: "Only y = f(x) expressions are supported.",
      };
    }
    if (!right) {
      return {
        ok: false,
        kind: "error",
        expression: "",
        error: "Enter an expression after y =",
      };
    }
    return { ok: true, kind: "function", expression: right };
  }

  function rawTokenize(input) {
    const tokens = [];
    let index = 0;

    while (index < input.length) {
      const char = input[index];
      if (/\s/.test(char)) {
        index += 1;
        continue;
      }
      if (/\d|\./.test(char)) {
        let cursor = index + 1;
        let sawDot = char === ".";
        while (cursor < input.length) {
          const next = input[cursor];
          if (/\d/.test(next)) {
            cursor += 1;
            continue;
          }
          if (next === "." && !sawDot) {
            sawDot = true;
            cursor += 1;
            continue;
          }
          break;
        }
        tokens.push({
          type: "number",
          value: Number(input.slice(index, cursor)),
        });
        index = cursor;
        continue;
      }
      if (/[A-Za-z_]/.test(char)) {
        let cursor = index + 1;
        while (cursor < input.length && /[A-Za-z0-9_]/.test(input[cursor])) {
          cursor += 1;
        }
        tokens.push({
          type: "name",
          value: input.slice(index, cursor),
        });
        index = cursor;
        continue;
      }
      if ("+-*/^()|".includes(char)) {
        tokens.push({ type: char });
        index += 1;
        continue;
      }
      throw new Error("Unexpected token: " + char);
    }

    return tokens;
  }

  function canEndValue(token) {
    return (
      token &&
      ["number", "variable", "constant", ")", "abs_close"].includes(token.type)
    );
  }

  function canStartValue(token) {
    return (
      token &&
      ["number", "variable", "constant", "function", "(", "abs_open"].includes(
        token.type,
      )
    );
  }

  function annotatePipes(tokens) {
    let expectingValue = true;
    return tokens.map((token) => {
      if (token.type === "|") {
        const mapped = { type: expectingValue ? "abs_open" : "abs_close" };
        expectingValue = mapped.type === "abs_open";
        return mapped;
      }
      expectingValue = !canEndValue(token);
      return token;
    });
  }

  function classifyNames(tokens) {
    return tokens.map((token) => {
      if (token.type !== "name") return token;
      const value = token.value.toLowerCase();
      if (value === "x") return { type: "variable", value: "x" };
      if (value in KNOWN_CONSTANTS) return { type: "constant", value };
      if (value in KNOWN_FUNCTIONS) return { type: "function", value };
      throw new Error("Unknown symbol: " + token.value);
    });
  }

  function insertImplicitMultiplication(tokens) {
    const nextTokens = [];
    for (let index = 0; index < tokens.length; index += 1) {
      const token = tokens[index];
      const previous = nextTokens[nextTokens.length - 1];
      if (canEndValue(previous) && canStartValue(token)) {
        nextTokens.push({ type: "*" });
      }
      nextTokens.push(token);
    }
    return nextTokens;
  }

  function parseTokens(tokens) {
    let index = 0;

    function peek() {
      return tokens[index] || null;
    }

    function match(type) {
      const token = peek();
      if (!token || token.type !== type) return null;
      index += 1;
      return token;
    }

    function expect(type, message) {
      const token = match(type);
      if (!token) throw new Error(message || "Expected " + type);
      return token;
    }

    function parseExpression() {
      return parseAdditive();
    }

    function parseAdditive() {
      let node = parseMultiplicative();
      for (;;) {
        const operator = match("+") || match("-");
        if (!operator) break;
        node = {
          type: "binary",
          operator: operator.type,
          left: node,
          right: parseMultiplicative(),
        };
      }
      return node;
    }

    function parseMultiplicative() {
      let node = parseFactor();
      for (;;) {
        const operator = match("*") || match("/");
        if (!operator) break;
        node = {
          type: "binary",
          operator: operator.type,
          left: node,
          right: parseFactor(),
        };
      }
      return node;
    }

    function parseFactor() {
      if (match("+")) return parseFactor();
      if (match("-")) {
        return { type: "unary", operator: "-", value: parseFactor() };
      }
      return parsePower();
    }

    function parsePower() {
      const left = parsePrimary();
      if (match("^")) {
        return {
          type: "binary",
          operator: "^",
          left,
          right: parseFactor(),
        };
      }
      return left;
    }

    function parseFunctionArgument() {
      if (!peek()) throw new Error("Function is missing an argument.");
      return parsePrimary();
    }

    function parsePrimary() {
      const token = peek();
      if (!token) throw new Error("Incomplete expression.");

      if (token.type === "number") {
        index += 1;
        return { type: "number", value: token.value };
      }
      if (token.type === "variable") {
        index += 1;
        return { type: "variable", value: token.value };
      }
      if (token.type === "constant") {
        index += 1;
        return { type: "constant", value: token.value };
      }
      if (token.type === "function") {
        index += 1;
        return {
          type: "call",
          name: token.value,
          argument: parseFunctionArgument(),
        };
      }
      if (token.type === "(") {
        index += 1;
        const expression = parseExpression();
        expect(")", "Missing closing parenthesis.");
        return expression;
      }
      if (token.type === "abs_open") {
        index += 1;
        const expression = parseExpression();
        expect("abs_close", "Missing closing | for absolute value.");
        return {
          type: "call",
          name: "abs",
          argument: expression,
        };
      }
      throw new Error("Unexpected token.");
    }

    const ast = parseExpression();
    if (index !== tokens.length) throw new Error("Unexpected trailing input.");
    return ast;
  }

  function evaluateAst(node, scope) {
    switch (node.type) {
      case "number":
        return node.value;
      case "variable":
        return scope[node.value];
      case "constant":
        return KNOWN_CONSTANTS[node.value];
      case "unary":
        return -evaluateAst(node.value, scope);
      case "binary": {
        const left = evaluateAst(node.left, scope);
        const right = evaluateAst(node.right, scope);
        if (node.operator === "+") return left + right;
        if (node.operator === "-") return left - right;
        if (node.operator === "*") return left * right;
        if (node.operator === "/") {
          if (Math.abs(right) < 1e-12) throw new Error("Division by zero.");
          return left / right;
        }
        return Math.pow(left, right);
      }
      case "call": {
        const value = evaluateAst(node.argument, scope);
        if (!Number.isFinite(value)) throw new Error("Invalid input.");
        if (node.name === "log" || node.name === "ln" || node.name === "sqrt") {
          if ((node.name === "sqrt" && value < 0) || (node.name !== "sqrt" && value <= 0)) {
            throw new Error("Domain error.");
          }
        }
        if ((node.name === "asin" || node.name === "acos") && (value < -1 || value > 1)) {
          throw new Error("Domain error.");
        }
        return KNOWN_FUNCTIONS[node.name](value);
      }
      default:
        throw new Error("Unsupported expression.");
    }
  }

  function parseGraphExpression(input) {
    const normalized = normalizeInput(input);
    const equation = splitEquation(normalized);
    if (!equation.ok) {
      return {
        ok: false,
        kind: equation.kind,
        error: equation.error,
        normalized: equation.expression,
      };
    }
    try {
      const tokens = insertImplicitMultiplication(
        classifyNames(annotatePipes(rawTokenize(equation.expression))),
      );
      const ast = parseTokens(tokens);
      return {
        ok: true,
        kind: equation.kind,
        error: "",
        normalized: equation.expression,
        ast,
      };
    } catch (error) {
      return {
        ok: false,
        kind: "error",
        error: error && error.message ? error.message : "Invalid expression.",
        normalized: equation.expression,
      };
    }
  }

  function evaluateCompiled(compiled, xValue) {
    if (!compiled || !compiled.ok) throw new Error("Expression is not valid.");
    return normalizeTiny(evaluateAst(compiled.ast, { x: xValue }));
  }

  function sampleSegments(compiled, view, width, height) {
    if (!compiled || !compiled.ok) return [];
    const steps = Math.max(240, Math.min(1600, Math.round(width * 1.5)));
    const yRange = Math.max(1, view.yMax - view.yMin);
    const clipLimit = yRange * 8;
    const breakJump = yRange * 2.5;
    const segments = [];
    let current = [];
    let previous = null;

    for (let index = 0; index <= steps; index += 1) {
      const ratio = index / steps;
      const x = view.xMin + ratio * (view.xMax - view.xMin);
      let y = NaN;
      try {
        y = evaluateCompiled(compiled, x);
      } catch {
        y = NaN;
      }

      if (!Number.isFinite(y) || Math.abs(y) > clipLimit) {
        if (current.length > 1) segments.push(current);
        current = [];
        previous = null;
        continue;
      }

      const point = { x, y };
      if (previous && Math.abs(point.y - previous.y) > breakJump) {
        if (current.length > 1) segments.push(current);
        current = [point];
      } else {
        current.push(point);
      }
      previous = point;
    }

    if (current.length > 1) segments.push(current);
    return segments;
  }

  function fitVisibleExpressions(compiledRows, fallbackView) {
    const baseView = fallbackView || DEFAULT_VIEW;
    const visible = (compiledRows || []).filter((row) => row && row.compiled && row.compiled.ok);
    if (!visible.length) return { ...DEFAULT_VIEW };

    let minY = Infinity;
    let maxY = -Infinity;
    let sampleCount = 320;

    visible.forEach((row) => {
      for (let index = 0; index <= sampleCount; index += 1) {
        const ratio = index / sampleCount;
        const x = baseView.xMin + ratio * (baseView.xMax - baseView.xMin);
        try {
          const y = evaluateCompiled(row.compiled, x);
          if (Number.isFinite(y) && Math.abs(y) < 1e6) {
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
          }
        } catch {}
      }
    });

    if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
      return { ...DEFAULT_VIEW };
    }

    if (Math.abs(maxY - minY) < 1e-6) {
      minY -= 2;
      maxY += 2;
    }

    const yPadding = Math.max(1, (maxY - minY) * 0.12);
    return {
      xMin: baseView.xMin,
      xMax: baseView.xMax,
      yMin: minY - yPadding,
      yMax: maxY + yPadding,
    };
  }

  function niceStep(rawStep) {
    const power = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const normalized = rawStep / power;
    let step = 10;
    if (normalized <= 1) step = 1;
    else if (normalized <= 2) step = 2;
    else if (normalized <= 5) step = 5;
    return step * power;
  }

  function createTicks(min, max, targetCount) {
    const range = Math.max(1e-9, max - min);
    const step = niceStep(range / Math.max(2, targetCount));
    const start = Math.ceil(min / step) * step;
    const ticks = [];
    for (let value = start; value <= max + step * 0.5; value += step) {
      ticks.push(normalizeTiny(value));
    }
    return { step, ticks };
  }

  function worldToScreenX(value, view, width) {
    return ((value - view.xMin) / (view.xMax - view.xMin)) * width;
  }

  function worldToScreenY(value, view, height) {
    return height - ((value - view.yMin) / (view.yMax - view.yMin)) * height;
  }

  function screenToWorldX(value, view, width) {
    return view.xMin + (value / width) * (view.xMax - view.xMin);
  }

  function screenToWorldY(value, view, height) {
    return view.yMin + ((height - value) / height) * (view.yMax - view.yMin);
  }

  function traceAtPointer(compiledRows, view, width, height, screenX, screenY) {
    const xValue = screenToWorldX(screenX, view, width);
    const yValue = screenToWorldY(screenY, view, height);
    let best = null;

    compiledRows.forEach((row) => {
      if (!row || !row.compiled || !row.compiled.ok || row.enabled === false) return;
      try {
        const y = evaluateCompiled(row.compiled, xValue);
        if (!Number.isFinite(y)) return;
        const px = worldToScreenX(xValue, view, width);
        const py = worldToScreenY(y, view, height);
        const distance = Math.abs(py - screenY);
        if (!best || distance < best.distance) {
          best = {
            rowId: row.id,
            x: xValue,
            y,
            label: row.text,
            screenX: px,
            screenY: py,
            pointerDistance: distance,
            distance:
              Math.abs(py - screenY) + Math.abs(worldToScreenY(yValue, view, height) - screenY) * 0.05,
          };
        }
      } catch {}
    });

    if (!best) return null;
    if (compiledRows.length > 1 && best.pointerDistance > 42) return null;
    return best;
  }

  global.YPTGraphCore = {
    DEFAULT_VIEW: { ...DEFAULT_VIEW },
    GRAPH_COLORS: GRAPH_COLORS.slice(),
    clamp,
    formatNumber,
    parseGraphExpression,
    evaluateCompiled,
    sampleSegments,
    fitVisibleExpressions,
    createTicks,
    worldToScreenX,
    worldToScreenY,
    screenToWorldX,
    screenToWorldY,
    traceAtPointer,
  };
})(window);
