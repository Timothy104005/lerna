(function (global) {
  function createToolsKit(ReactLib, graphCoreInput) {
    const React = ReactLib;
    const graphCore = graphCoreInput || global.YPTGraphCore || {};

    function uid(prefix) {
      return (
        prefix +
        "_" +
        Date.now().toString(36) +
        "_" +
        Math.random().toString(36).slice(2, 8)
      );
    }

    function palette() {
      return Array.isArray(graphCore.GRAPH_COLORS) && graphCore.GRAPH_COLORS.length
        ? graphCore.GRAPH_COLORS.slice()
        : ["#4a7c74", "#c08a3e", "#8b5e8f", "#4874a6", "#b35d4d", "#5b7b51"];
    }

    function defaultGraphView() {
      const view = graphCore.DEFAULT_VIEW || {
        xMin: -10,
        xMax: 10,
        yMin: -10,
        yMax: 10,
      };
      return {
        xMin: view.xMin,
        xMax: view.xMax,
        yMin: view.yMin,
        yMax: view.yMax,
        traceX: null,
        traceY: null,
        traceRowId: null,
        selectedExpressionId: null,
      };
    }

    function normalizeGraphViewShape(view) {
      const next = { ...defaultGraphView(), ...(view || {}) };
      let xMin = Number(next.xMin);
      let xMax = Number(next.xMax);
      let yMin = Number(next.yMin);
      let yMax = Number(next.yMax);
      if (!Number.isFinite(xMin) || !Number.isFinite(xMax) || xMax - xMin < 0.5) {
        xMin = -10;
        xMax = 10;
      }
      if (!Number.isFinite(yMin) || !Number.isFinite(yMax) || yMax - yMin < 0.5) {
        yMin = -10;
        yMax = 10;
      }
      return {
        ...next,
        xMin,
        xMax,
        yMin,
        yMax,
        traceX: Number.isFinite(next.traceX) ? next.traceX : null,
        traceY: Number.isFinite(next.traceY) ? next.traceY : null,
        traceRowId: next.traceRowId || null,
        selectedExpressionId: next.selectedExpressionId || null,
      };
    }

    function compileGraphText(text) {
      return typeof graphCore.parseGraphExpression === "function"
        ? graphCore.parseGraphExpression(text)
        : { ok: false, kind: "error", error: "Graph core unavailable." };
    }

    function sanitizeGraphExpressionRow(row, index) {
      const text = typeof row?.text === "string" ? row.text : "";
      const compiled = text.trim()
        ? compileGraphText(text)
        : { ok: false, kind: "empty", error: "" };
      const colors = palette();
      return {
        id: row?.id || uid("expr"),
        text,
        enabled: row?.enabled !== false,
        color: row?.color || colors[index % colors.length],
        error: compiled.ok ? "" : compiled.error,
        kind: compiled.kind || (compiled.ok ? "function" : "error"),
      };
    }

    function createGraphExpressionRow(text, index) {
      return sanitizeGraphExpressionRow({ text: text || "" }, index || 0);
    }

    function createInitialGraphState() {
      const row = createGraphExpressionRow("", 0);
      return {
        expressions: [row],
        hoveredExpressionId: null,
        showTable: false,
        table: {
          start: -5,
          step: 1,
          count: 9,
        },
        view: normalizeGraphViewShape({
          ...defaultGraphView(),
          selectedExpressionId: row.id,
        }),
      };
    }

    function ensureGraphStateShape(graph) {
      const expressions =
        Array.isArray(graph?.expressions) && graph.expressions.length
          ? graph.expressions.map((row, index) =>
              sanitizeGraphExpressionRow(row, index),
            )
          : createInitialGraphState().expressions;
      return {
        expressions,
        hoveredExpressionId:
          graph?.hoveredExpressionId &&
          expressions.some((row) => row.id === graph.hoveredExpressionId)
            ? graph.hoveredExpressionId
            : null,
        showTable: graph?.showTable === true,
        table: {
          start: Number.isFinite(Number(graph?.table?.start))
            ? Number(graph.table.start)
            : -5,
          step:
            Number.isFinite(Number(graph?.table?.step)) &&
            Math.abs(Number(graph.table.step)) > 1e-6
              ? Number(graph.table.step)
              : 1,
          count:
            Number.isFinite(Number(graph?.table?.count)) &&
            Number(graph.table.count) >= 5
              ? Math.min(15, Math.round(Number(graph.table.count)))
              : 9,
        },
        view: normalizeGraphViewShape({
          ...graph?.view,
          selectedExpressionId:
            graph?.view?.selectedExpressionId &&
            expressions.some(
              (row) => row.id === graph.view.selectedExpressionId,
            )
              ? graph.view.selectedExpressionId
              : expressions[0]?.id || null,
        }),
      };
    }

    function createInitialCalcState() {
      return {
        expression: "",
        ans: 0,
        lastResultText: "0",
        lastResultValue: 0,
        history: [],
        shift: false,
        modeOpen: false,
        angleMode: "DEG",
        afterEval: false,
      };
    }

    function ensureCalcStateShape(calc) {
      const base = createInitialCalcState();
      return {
        ...base,
        ...(calc || {}),
        history: Array.isArray(calc?.history) ? calc.history.slice(0, 8) : [],
        angleMode: calc?.angleMode === "RAD" ? "RAD" : "DEG",
        lastResultText:
          typeof calc?.lastResultText === "string"
            ? calc.lastResultText
            : base.lastResultText,
        lastResultValue: Number.isFinite(calc?.lastResultValue)
          ? calc.lastResultValue
          : base.lastResultValue,
      };
    }

    function createInitialLearnToolsState() {
      return {
        activeTool: null,
        calculator: createInitialCalcState(),
        graph: createInitialGraphState(),
      };
    }

    function ensureLearnToolsStateShape(state) {
      return {
        activeTool:
          state?.activeTool === "calc" || state?.activeTool === "graph"
            ? state.activeTool
            : null,
        calculator: ensureCalcStateShape(state?.calculator),
        graph: ensureGraphStateShape(state?.graph),
      };
    }

    function formatNumber(value) {
      if (typeof graphCore.formatNumber === "function") {
        return graphCore.formatNumber(value);
      }
      return String(value);
    }

    function formatCalcExpression(expression) {
      return expression
        ? expression
            .replace(/pow10\(/g, "10^(")
            .replace(/sqrt\(/g, "\u221A(")
            .replace(/sqr\(/g, "x\u00B2(")
            .replace(/inv\(/g, "1/x(")
            .replace(/exp\(/g, "e^(")
            .replace(/\bpi\b/g, "\u03C0")
            .replace(/\*/g, " \u00D7 ")
            .replace(/\//g, " \u00F7 ")
        : "0";
    }

    function calcNeedsValue(expression) {
      return (
        !expression ||
        /[\+\-\*\/\^\(]$/.test(expression) ||
        /EXP$/.test(expression) ||
        /EXP[+-]$/.test(expression)
      );
    }

    function calcEndsWithValue(expression) {
      return /(Ans|pi|e|\d|\)|%)$/.test(expression);
    }

    function calcEndsWithNumber(expression) {
      return /(\d|\.)$/.test(expression);
    }

    function calcParenBalance(expression) {
      let balance = 0;
      for (const char of expression) {
        if (char === "(") balance += 1;
        if (char === ")") balance -= 1;
      }
      return balance;
    }

    function calcTokenize(expression) {
      const tokens = [];
      let index = 0;
      while (index < expression.length) {
        const char = expression[index];
        if (/\s/.test(char)) {
          index += 1;
          continue;
        }
        if (/\d|\./.test(char)) {
          let cursor = index + 1;
          let sawDot = char === ".";
          while (cursor < expression.length) {
            const next = expression[cursor];
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
          if (expression.slice(cursor, cursor + 3) === "EXP") {
            cursor += 3;
            if (expression[cursor] === "+" || expression[cursor] === "-") {
              cursor += 1;
            }
            const expStart = cursor;
            while (cursor < expression.length && /\d/.test(expression[cursor])) {
              cursor += 1;
            }
            if (expStart === cursor) {
              throw new Error("Invalid scientific notation");
            }
            const raw = expression.slice(index, cursor);
            tokens.push({
              type: "number",
              value: Number(raw.replace("EXP", "e")),
            });
            index = cursor;
            continue;
          }
          tokens.push({
            type: "number",
            value: Number(expression.slice(index, cursor)),
          });
          index = cursor;
          continue;
        }
        if (/[A-Za-z]/.test(char)) {
          let cursor = index + 1;
          while (cursor < expression.length && /[A-Za-z]/.test(expression[cursor])) {
            cursor += 1;
          }
          tokens.push({
            type: "name",
            value: expression.slice(index, cursor),
          });
          index = cursor;
          continue;
        }
        if ("+-*/^%()".includes(char)) {
          tokens.push({ type: char });
          index += 1;
          continue;
        }
        throw new Error("Unexpected token");
      }
      return tokens;
    }

    function calcApplyFunction(name, value, angleMode) {
      const inDegrees = angleMode !== "RAD";
      const toRadians = (next) => (inDegrees ? (next * Math.PI) / 180 : next);
      const fromRadians = (next) => (inDegrees ? (next * 180) / Math.PI : next);
      switch (name) {
        case "sin":
          return Math.sin(toRadians(value));
        case "cos":
          return Math.cos(toRadians(value));
        case "tan":
          return Math.tan(toRadians(value));
        case "asin":
          if (value < -1 || value > 1) throw new Error("Domain error");
          return fromRadians(Math.asin(value));
        case "acos":
          if (value < -1 || value > 1) throw new Error("Domain error");
          return fromRadians(Math.acos(value));
        case "atan":
          return fromRadians(Math.atan(value));
        case "log":
          if (value <= 0) throw new Error("Domain error");
          return Math.log10(value);
        case "ln":
          if (value <= 0) throw new Error("Domain error");
          return Math.log(value);
        case "pow10":
          return Math.pow(10, value);
        case "exp":
          return Math.exp(value);
        case "sqrt":
          if (value < 0) throw new Error("Domain error");
          return Math.sqrt(value);
        case "sqr":
          return Math.pow(value, 2);
        case "inv":
          if (Math.abs(value) < 1e-12) throw new Error("Division by zero");
          return 1 / value;
        default:
          throw new Error("Unknown function");
      }
    }

    function calcEvaluateExpression(expression, context) {
      const tokens = calcTokenize(expression);
      let index = 0;
      const angleMode = context?.angleMode === "RAD" ? "RAD" : "DEG";
      const ans = Number.isFinite(context?.ans) ? context.ans : 0;

      function peek() {
        return tokens[index] || null;
      }

      function expect(type) {
        const token = peek();
        if (!token || token.type !== type) {
          throw new Error("Unexpected token");
        }
        index += 1;
        return token;
      }

      function parsePrimary() {
        const token = peek();
        if (!token) throw new Error("Incomplete expression");
        if (token.type === "number") {
          index += 1;
          return token.value;
        }
        if (token.type === "name") {
          index += 1;
          if (token.value === "Ans") return ans;
          if (token.value === "pi") return Math.PI;
          if (token.value === "e") return Math.E;
          expect("(");
          const inner = parseExpression();
          expect(")");
          return calcApplyFunction(token.value, inner, angleMode);
        }
        if (token.type === "(") {
          index += 1;
          const inner = parseExpression();
          expect(")");
          return inner;
        }
        throw new Error("Unexpected token");
      }

      function parsePercent() {
        let value = parsePrimary();
        while (peek() && peek().type === "%") {
          index += 1;
          value /= 100;
        }
        return value;
      }

      function parsePower() {
        const value = parsePercent();
        if (peek() && peek().type === "^") {
          index += 1;
          return Math.pow(value, parseSigned());
        }
        return value;
      }

      function parseSigned() {
        if (peek() && (peek().type === "+" || peek().type === "-")) {
          const sign = peek().type;
          index += 1;
          const value = parseSigned();
          return sign === "-" ? -value : value;
        }
        return parsePower();
      }

      function parseMultiplicative() {
        let value = parseSigned();
        while (peek() && (peek().type === "*" || peek().type === "/")) {
          const operator = peek().type;
          index += 1;
          const next = parseSigned();
          if (operator === "/" && Math.abs(next) < 1e-12) {
            throw new Error("Division by zero");
          }
          value = operator === "*" ? value * next : value / next;
        }
        return value;
      }

      function parseExpression() {
        let value = parseMultiplicative();
        while (peek() && (peek().type === "+" || peek().type === "-")) {
          const operator = peek().type;
          index += 1;
          const next = parseMultiplicative();
          value = operator === "+" ? value + next : value - next;
        }
        return value;
      }

      const value = parseExpression();
      if (index !== tokens.length) throw new Error("Unexpected token");
      return Math.abs(value) < 1e-12 ? 0 : value;
    }

    function calcResolvePreview(expression, context) {
      try {
        const value = calcEvaluateExpression(expression, context);
        return { ok: true, value, text: formatNumber(value) };
      } catch {
        return { ok: false, value: null, text: "Error" };
      }
    }

    function zoomGraphViewAroundPoint(view, worldX, worldY, factor) {
      const width = view.xMax - view.xMin;
      const height = view.yMax - view.yMin;
      const xRatio = (worldX - view.xMin) / width;
      const yRatio = (worldY - view.yMin) / height;
      const nextWidth = width * factor;
      const nextHeight = height * factor;
      return normalizeGraphViewShape({
        ...view,
        xMin: worldX - nextWidth * xRatio,
        xMax: worldX + nextWidth * (1 - xRatio),
        yMin: worldY - nextHeight * yRatio,
        yMax: worldY + nextHeight * (1 - yRatio),
        traceX: null,
        traceY: null,
        traceRowId: null,
      });
    }

    function GraphViewport(props) {
      const {
        lang,
        rows,
        view,
        trace,
        hoveredExpressionId,
        onViewChange,
        onTraceChange,
        onHoverChange,
      } = props;
      const zh = lang === "zh";
      const h = React.createElement;
      const containerRef = React.useRef(null);
      const canvasRef = React.useRef(null);
      const dragRef = React.useRef(null);
      const [size, setSize] = React.useState({ width: 760, height: 560 });

      const xTicks = React.useMemo(
        () =>
          typeof graphCore.createTicks === "function"
            ? graphCore.createTicks(
                view.xMin,
                view.xMax,
                Math.max(5, Math.round(size.width / 92)),
              )
            : { ticks: [] },
        [view.xMin, view.xMax, size.width],
      );
      const yTicks = React.useMemo(
        () =>
          typeof graphCore.createTicks === "function"
            ? graphCore.createTicks(
                view.yMin,
                view.yMax,
                Math.max(4, Math.round(size.height / 78)),
              )
            : { ticks: [] },
        [view.yMin, view.yMax, size.height],
      );

      React.useEffect(() => {
        if (!containerRef.current) return;
        const element = containerRef.current;
        function updateSize() {
          setSize({
            width: Math.max(360, Math.round(element.clientWidth || 760)),
            height: Math.max(420, Math.round(element.clientHeight || 560)),
          });
        }
        updateSize();
        if (typeof ResizeObserver !== "undefined") {
          const observer = new ResizeObserver(updateSize);
          observer.observe(element);
          return () => observer.disconnect();
        }
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
      }, []);

      React.useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(size.width * dpr);
        canvas.height = Math.round(size.height * dpr);
        canvas.style.width = size.width + "px";
        canvas.style.height = size.height + "px";
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.clearRect(0, 0, size.width, size.height);
        context.fillStyle = "#fcfcfa";
        context.fillRect(0, 0, size.width, size.height);

        function drawLine(x1, y1, x2, y2) {
          context.beginPath();
          context.moveTo(x1, y1);
          context.lineTo(x2, y2);
          context.stroke();
        }

        context.strokeStyle = "#eef2f1";
        context.lineWidth = 1;
        (xTicks.ticks || []).forEach((tick) => {
          const x = graphCore.worldToScreenX(tick, view, size.width);
          drawLine(x, 0, x, size.height);
        });
        (yTicks.ticks || []).forEach((tick) => {
          const y = graphCore.worldToScreenY(tick, view, size.height);
          drawLine(0, y, size.width, y);
        });

        context.strokeStyle = "#cfd8d5";
        context.lineWidth = 1.2;
        if (view.xMin < 0 && view.xMax > 0) {
          const axisX = graphCore.worldToScreenX(0, view, size.width);
          drawLine(axisX, 0, axisX, size.height);
        }
        if (view.yMin < 0 && view.yMax > 0) {
          const axisY = graphCore.worldToScreenY(0, view, size.height);
          drawLine(0, axisY, size.width, axisY);
        }

        context.font = "11px ui-sans-serif, system-ui, sans-serif";
        context.fillStyle = "#94a3b8";
        (xTicks.ticks || []).forEach((tick) => {
          const x = graphCore.worldToScreenX(tick, view, size.width);
          context.fillText(formatNumber(tick), x + 4, size.height - 8);
        });
        (yTicks.ticks || []).forEach((tick) => {
          const y = graphCore.worldToScreenY(tick, view, size.height);
          context.fillText(formatNumber(tick), 8, y - 6);
        });

        rows.forEach((row) => {
          if (!row.enabled || !row.compiled?.ok) return;
          context.strokeStyle = row.color;
          context.lineJoin = "round";
          context.lineCap = "round";
          context.lineWidth =
            row.id === hoveredExpressionId || row.id === view.selectedExpressionId
              ? 2.4
              : 1.8;
          const segments =
            typeof graphCore.sampleSegments === "function"
              ? graphCore.sampleSegments(row.compiled, view, size.width, size.height)
              : [];
          segments.forEach((segment) => {
            context.beginPath();
            segment.forEach((point, index) => {
              const x = graphCore.worldToScreenX(point.x, view, size.width);
              const y = graphCore.worldToScreenY(point.y, view, size.height);
              if (index === 0) context.moveTo(x, y);
              else context.lineTo(x, y);
            });
            context.stroke();
          });
        });

        if (trace && Number.isFinite(trace.x) && Number.isFinite(trace.y)) {
          const tx = graphCore.worldToScreenX(trace.x, view, size.width);
          const ty = graphCore.worldToScreenY(trace.y, view, size.height);
          context.save();
          context.strokeStyle = "rgba(100, 116, 139, 0.5)";
          context.setLineDash([5, 5]);
          drawLine(tx, 0, tx, size.height);
          context.setLineDash([]);
          context.fillStyle = trace.color || "#4a7c74";
          context.beginPath();
          context.arc(tx, ty, 4.5, 0, Math.PI * 2);
          context.fill();
          context.strokeStyle = "#ffffff";
          context.lineWidth = 2;
          context.stroke();
          context.restore();
        }
      }, [rows, view, trace, hoveredExpressionId, size.width, size.height, xTicks, yTicks]);

      function clearTrace() {
        onTraceChange(null);
        onHoverChange(null);
      }

      function pointerPosition(event) {
        if (!canvasRef.current) return null;
        const rect = canvasRef.current.getBoundingClientRect();
        return {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        };
      }

      function handlePointerMove(event) {
        const point = pointerPosition(event);
        if (!point) return;
        if (dragRef.current) {
          const drag = dragRef.current;
          const dx =
            ((point.x - drag.startX) / size.width) *
            (drag.view.xMax - drag.view.xMin);
          const dy =
            ((point.y - drag.startY) / size.height) *
            (drag.view.yMax - drag.view.yMin);
          onViewChange({
            ...drag.view,
            xMin: drag.view.xMin - dx,
            xMax: drag.view.xMax - dx,
            yMin: drag.view.yMin + dy,
            yMax: drag.view.yMax + dy,
            traceX: null,
            traceY: null,
            traceRowId: null,
          });
          return;
        }
        if (typeof graphCore.traceAtPointer !== "function") return;
        const hit = graphCore.traceAtPointer(
          rows,
          view,
          size.width,
          size.height,
          point.x,
          point.y,
        );
        if (!hit) {
          clearTrace();
          return;
        }
        const row = rows.find((candidate) => candidate.id === hit.rowId);
        onTraceChange({
          x: hit.x,
          y: hit.y,
          rowId: hit.rowId,
          color: row?.color,
          label: row?.text || "",
        });
        onHoverChange(hit.rowId);
      }

      function handlePointerDown(event) {
        const point = pointerPosition(event);
        if (!point) return;
        dragRef.current = {
          pointerId: event.pointerId,
          startX: point.x,
          startY: point.y,
          view: { ...view },
        };
        if (event.currentTarget.setPointerCapture) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }

      function handlePointerUp(event) {
        if (dragRef.current && dragRef.current.pointerId === event.pointerId) {
          dragRef.current = null;
        }
      }

      function handleWheel(event) {
        if (!canvasRef.current) return;
        event.preventDefault();
        const point = pointerPosition(event);
        if (!point) return;
        const worldX = graphCore.screenToWorldX(point.x, view, size.width);
        const worldY = graphCore.screenToWorldY(point.y, view, size.height);
        const factor = event.deltaY < 0 ? 0.88 : 1.14;
        onViewChange(zoomGraphViewAroundPoint(view, worldX, worldY, factor));
      }

      return h(
        "div",
        {
          className: "ypt-graph-viewport-wrap",
          ref: containerRef,
        },
        [
          h("canvas", {
            key: "canvas",
            ref: canvasRef,
            className: "ypt-graph-canvas",
            onPointerMove: handlePointerMove,
            onPointerDown: handlePointerDown,
            onPointerUp: handlePointerUp,
            onPointerLeave: () => {
              if (!dragRef.current) clearTrace();
            },
            onWheel: handleWheel,
          }),
          !rows.some((row) => row.enabled && row.compiled?.ok)
            ? h(
                "div",
                {
                  key: "empty",
                  className: "ypt-graph-empty",
                },
                [
                  h(
                    "p",
                    {
                      key: "empty-title",
                      className: "text-sm font-medium text-[#64748b]",
                    },
                    zh ? "輸入函數開始繪圖" : "Start plotting by entering an expression",
                  ),
                  h(
                    "p",
                    {
                      key: "empty-copy",
                      className: "text-xs text-[#9ca3af]",
                    },
                    zh
                      ? "例如 y = x^2、sin(x)、log(x)、|x|"
                      : "Try y = x^2, sin(x), log(x), or |x|",
                  ),
                ],
              )
            : null,
          trace && Number.isFinite(trace.x) && Number.isFinite(trace.y)
            ? h(
                "div",
                {
                  key: "trace",
                  className: "ypt-graph-trace-pill",
                  style: {
                    left:
                      Math.max(
                        12,
                        Math.min(
                          size.width - 220,
                          graphCore.worldToScreenX(trace.x, view, size.width),
                        ),
                      ) + "px",
                    top:
                      Math.max(
                        16,
                        Math.min(
                          size.height - 18,
                          graphCore.worldToScreenY(trace.y, view, size.height),
                        ),
                      ) + "px",
                  },
                },
                [
                  h(
                    "div",
                    { key: "trace-title", className: "ypt-graph-trace-title" },
                    trace.label || "y = f(x)",
                  ),
                  h(
                    "div",
                    { key: "trace-value", className: "ypt-graph-trace-value" },
                    "(" + formatNumber(trace.x) + ", " + formatNumber(trace.y) + ")",
                  ),
                ],
              )
            : null,
        ],
      );
    }

    function deleteCalcTail(expression) {
      if (!expression) return "";
      const patterns = [
        "pow10(",
        "sqrt(",
        "sqr(",
        "inv(",
        "asin(",
        "acos(",
        "atan(",
        "sin(",
        "cos(",
        "tan(",
        "log(",
        "ln(",
        "exp(",
        "Ans",
        "pi",
        "EXP",
      ];
      for (const pattern of patterns) {
        if (expression.endsWith(pattern)) {
          return expression.slice(0, -pattern.length);
        }
      }
      return expression.slice(0, -1);
    }

    function findTrailingValueRange(expression) {
      if (!expression || calcNeedsValue(expression)) return null;
      const end = expression.length;
      if (expression.endsWith("%")) {
        const range = findTrailingValueRange(expression.slice(0, -1));
        return range ? { start: range.start, end } : null;
      }
      if (expression.endsWith(")")) {
        let depth = 0;
        for (let index = end - 1; index >= 0; index -= 1) {
          const char = expression[index];
          if (char === ")") depth += 1;
          if (char === "(") {
            depth -= 1;
            if (depth === 0) {
              let start = index;
              while (start - 1 >= 0 && /[A-Za-z]/.test(expression[start - 1])) {
                start -= 1;
              }
              return { start, end };
            }
          }
        }
        return null;
      }
      const match = expression.match(
        /(?:Ans|pi|e|(?:\d+(?:\.\d*)?|\.\d+)(?:EXP[+-]?\d+)?)$/,
      );
      return match ? { start: end - match[0].length, end } : null;
    }

    function wrapCalcTrailingValue(expression, fnName) {
      const range = findTrailingValueRange(expression);
      if (range) {
        const chunk = expression.slice(range.start, range.end);
        return (
          expression.slice(0, range.start) +
          fnName +
          "(" +
          chunk +
          ")" +
          expression.slice(range.end)
        );
      }
      return calcEndsWithValue(expression)
        ? expression + "*" + fnName + "("
        : expression + fnName + "(";
    }

    function appendCalcFactor(expression, chunk) {
      return calcEndsWithValue(expression) ? expression + "*" + chunk : expression + chunk;
    }

    function previewExpression(expression) {
      if (!expression) return "";
      if (calcNeedsValue(expression)) return expression;
      const balance = calcParenBalance(expression);
      return balance > 0 ? expression + ")".repeat(balance) : expression;
    }

    function CalculatorWorkspace(props) {
      const { lang, calc, setCalc, onBack } = props;
      const zh = lang === "zh";
      const h = React.createElement;

      const preview = React.useMemo(() => {
        if (calc.afterEval) {
          return {
            ok: true,
            text: calc.lastResultText || formatNumber(calc.ans || 0),
            value: Number.isFinite(calc.lastResultValue)
              ? calc.lastResultValue
              : calc.ans || 0,
          };
        }
        const candidate = previewExpression(calc.expression);
        if (!candidate) {
          return { ok: true, text: formatNumber(calc.ans || 0), value: calc.ans || 0 };
        }
        return calcResolvePreview(candidate, {
          angleMode: calc.angleMode,
          ans: calc.ans,
        });
      }, [
        calc.afterEval,
        calc.expression,
        calc.angleMode,
        calc.ans,
        calc.lastResultText,
        calc.lastResultValue,
      ]);

      const keys = React.useMemo(
        () => [
          [
            {
              id: "shift",
              label: "SHIFT",
              secondary: "",
              kind: "utility",
              onPress: () =>
                setCalc((previous) => ({
                  ...previous,
                  shift: !previous.shift,
                })),
            },
            {
              id: "mode",
              label: "MODE",
              secondary: "",
              kind: "utility",
              onPress: () =>
                setCalc((previous) => ({
                  ...previous,
                  modeOpen: !previous.modeOpen,
                })),
            },
            {
              id: "ans",
              label: "Ans",
              secondary: "π",
              kind: "function",
              onPress: () =>
                setCalc((previous) => {
                  const useSecondary = previous.shift;
                  const token = useSecondary ? "pi" : "Ans";
                  const base = previous.afterEval ? "" : previous.expression;
                  return {
                    ...previous,
                    expression: appendCalcFactor(base, token),
                    afterEval: false,
                    shift: useSecondary ? false : previous.shift,
                  };
                }),
            },
            {
              id: "clear",
              label: "CLR",
              secondary: "",
              kind: "utility",
              onPress: () =>
                setCalc((previous) => ({
                  ...previous,
                  expression: "",
                  afterEval: false,
                })),
            },
            {
              id: "del",
              label: "DEL",
              secondary: "",
              kind: "utility",
              onPress: () =>
                setCalc((previous) => ({
                  ...previous,
                  expression: deleteCalcTail(previous.expression),
                  afterEval: false,
                })),
            },
          ],
          [
            {
              id: "sin",
              label: "sin",
              secondary: "asin",
              kind: "function",
              onPress: () =>
                setCalc((previous) => {
                  const fnName = previous.shift ? "asin" : "sin";
                  const base = previous.afterEval ? "" : previous.expression;
                  return {
                    ...previous,
                    expression: wrapCalcTrailingValue(base, fnName),
                    afterEval: false,
                    shift: previous.shift ? false : previous.shift,
                  };
                }),
            },
            {
              id: "cos",
              label: "cos",
              secondary: "acos",
              kind: "function",
              onPress: () =>
                setCalc((previous) => {
                  const fnName = previous.shift ? "acos" : "cos";
                  const base = previous.afterEval ? "" : previous.expression;
                  return {
                    ...previous,
                    expression: wrapCalcTrailingValue(base, fnName),
                    afterEval: false,
                    shift: previous.shift ? false : previous.shift,
                  };
                }),
            },
            {
              id: "tan",
              label: "tan",
              secondary: "atan",
              kind: "function",
              onPress: () =>
                setCalc((previous) => {
                  const fnName = previous.shift ? "atan" : "tan";
                  const base = previous.afterEval ? "" : previous.expression;
                  return {
                    ...previous,
                    expression: wrapCalcTrailingValue(base, fnName),
                    afterEval: false,
                    shift: previous.shift ? false : previous.shift,
                  };
                }),
            },
            {
              id: "log",
              label: "log",
              secondary: "10^x",
              kind: "function",
              onPress: () =>
                setCalc((previous) => {
                  const fnName = previous.shift ? "pow10" : "log";
                  const base = previous.afterEval ? "" : previous.expression;
                  return {
                    ...previous,
                    expression: wrapCalcTrailingValue(base, fnName),
                    afterEval: false,
                    shift: previous.shift ? false : previous.shift,
                  };
                }),
            },
            {
              id: "ln",
              label: "ln",
              secondary: "e^x",
              kind: "function",
              onPress: () =>
                setCalc((previous) => {
                  const fnName = previous.shift ? "exp" : "ln";
                  const base = previous.afterEval ? "" : previous.expression;
                  return {
                    ...previous,
                    expression: wrapCalcTrailingValue(base, fnName),
                    afterEval: false,
                    shift: previous.shift ? false : previous.shift,
                  };
                }),
            },
          ],
          [
            {
              id: "square",
              label: "x²",
              secondary: "√x",
              kind: "function",
              onPress: () =>
                setCalc((previous) => {
                  const fnName = previous.shift ? "sqrt" : "sqr";
                  const base = previous.afterEval ? "" : previous.expression;
                  return {
                    ...previous,
                    expression: wrapCalcTrailingValue(base, fnName),
                    afterEval: false,
                    shift: previous.shift ? false : previous.shift,
                  };
                }),
            },
            {
              id: "power",
              label: "^",
              secondary: "",
              kind: "operator",
              value: "^",
            },
            {
              id: "sqrt",
              label: "√",
              secondary: "",
              kind: "function",
              onPress: () =>
                setCalc((previous) => {
                  const base = previous.afterEval ? "" : previous.expression;
                  return {
                    ...previous,
                    expression: wrapCalcTrailingValue(base, "sqrt"),
                    afterEval: false,
                  };
                }),
            },
            {
              id: "exp",
              label: "EXP",
              secondary: "e",
              kind: "function",
              onPress: () =>
                setCalc((previous) => {
                  if (previous.shift) {
                    const base = previous.afterEval ? "" : previous.expression;
                    return {
                      ...previous,
                      expression: appendCalcFactor(base, "e"),
                      afterEval: false,
                      shift: false,
                    };
                  }
                  const base = previous.afterEval ? "" : previous.expression;
                  if (!calcEndsWithNumber(base) || /EXP[+-]?\d*$/.test(base)) {
                    return previous;
                  }
                  return {
                    ...previous,
                    expression: base + "EXP",
                    afterEval: false,
                  };
                }),
            },
            {
              id: "percent",
              label: "%",
              secondary: "",
              kind: "operator",
              value: "%",
            },
          ],
          [
            { id: "7", label: "7", secondary: "", kind: "number", value: "7" },
            { id: "8", label: "8", secondary: "", kind: "number", value: "8" },
            { id: "9", label: "9", secondary: "", kind: "number", value: "9" },
            { id: "divide", label: "÷", secondary: "", kind: "operator", value: "/" },
            { id: "open", label: "(", secondary: "", kind: "operator", value: "(" },
          ],
          [
            { id: "4", label: "4", secondary: "", kind: "number", value: "4" },
            { id: "5", label: "5", secondary: "", kind: "number", value: "5" },
            { id: "6", label: "6", secondary: "", kind: "number", value: "6" },
            { id: "multiply", label: "×", secondary: "", kind: "operator", value: "*" },
            { id: "close", label: ")", secondary: "", kind: "operator", value: ")" },
          ],
          [
            { id: "1", label: "1", secondary: "", kind: "number", value: "1" },
            { id: "2", label: "2", secondary: "", kind: "number", value: "2" },
            { id: "3", label: "3", secondary: "", kind: "number", value: "3" },
            { id: "minus", label: "-", secondary: "", kind: "operator", value: "-" },
            {
              id: "inverse",
              label: "1/x",
              secondary: "",
              kind: "function",
              onPress: () =>
                setCalc((previous) => {
                  const base = previous.afterEval ? "" : previous.expression;
                  return {
                    ...previous,
                    expression: wrapCalcTrailingValue(base, "inv"),
                    afterEval: false,
                  };
                }),
            },
          ],
          [
            { id: "0", label: "0", secondary: "", kind: "number", value: "0" },
            { id: "dot", label: ".", secondary: "", kind: "number", value: "." },
            { id: "negate", label: "(-)", secondary: "", kind: "utility", value: "negate" },
            { id: "plus", label: "+", secondary: "", kind: "operator", value: "+" },
            { id: "equals", label: "=", secondary: "", kind: "equals", value: "=" },
          ],
        ],
        [setCalc],
      );

      const triggerButton = React.useCallback(
        (button) => {
          if (typeof button.onPress === "function") {
            button.onPress();
            return;
          }
          if (button.kind === "number") {
            setCalc((previous) => {
              let expression = previous.afterEval ? "" : previous.expression;
              const value = button.value || button.label;
              if (value === ".") {
                if (/EXP[+-]?$/.test(expression)) return previous;
                const segmentMatch = expression.match(/[^+\-*/^()]*$/);
                const segment = segmentMatch ? segmentMatch[0] : "";
                if (segment.includes(".")) return previous;
                if (!expression || calcNeedsValue(expression)) {
                  expression += "0.";
                } else if (calcEndsWithValue(expression) && !calcEndsWithNumber(expression)) {
                  expression += "*0.";
                } else {
                  expression += ".";
                }
              } else if (calcEndsWithNumber(expression) || /EXP[+-]?$/.test(expression)) {
                expression += value;
              } else if (calcEndsWithValue(expression)) {
                expression += "*" + value;
              } else {
                expression += value;
              }
              return {
                ...previous,
                expression,
                afterEval: false,
              };
            });
            return;
          }
          if (button.kind === "operator") {
            if (button.value === "%") {
              setCalc((previous) => {
                if (!calcEndsWithValue(previous.expression) || previous.expression.endsWith("%")) {
                  return previous;
                }
                return {
                  ...previous,
                  expression: previous.expression + "%",
                  afterEval: false,
                };
              });
              return;
            }
            if (button.value === "(") {
              setCalc((previous) => {
                const expression = previous.afterEval ? "" : previous.expression;
                return {
                  ...previous,
                  expression: appendCalcFactor(expression, "("),
                  afterEval: false,
                };
              });
              return;
            }
            if (button.value === ")") {
              setCalc((previous) => {
                if (
                  calcParenBalance(previous.expression) <= 0 ||
                  calcNeedsValue(previous.expression)
                ) {
                  return previous;
                }
                return {
                  ...previous,
                  expression: previous.expression + ")",
                  afterEval: false,
                };
              });
              return;
            }
            setCalc((previous) => {
              let expression = previous.afterEval ? "Ans" : previous.expression;
              if (!expression) {
                if (button.value === "-") {
                  return { ...previous, expression: "-", afterEval: false };
                }
                return previous;
              }
              if (/EXP$/.test(expression)) {
                if (button.value === "-" || button.value === "+") {
                  return {
                    ...previous,
                    expression: expression + button.value,
                    afterEval: false,
                  };
                }
                return previous;
              }
              if (/EXP[+-]$/.test(expression)) return previous;
              if (calcNeedsValue(expression)) {
                if (button.value === "-") {
                  return {
                    ...previous,
                    expression: expression + "-",
                    afterEval: false,
                  };
                }
                return previous;
              }
              return {
                ...previous,
                expression: expression + button.value,
                afterEval: false,
              };
            });
            return;
          }
          if (button.kind === "equals" || button.value === "=") {
            setCalc((previous) => {
              const candidate = previewExpression(previous.expression);
              if (!candidate) return previous;
              try {
                const value = calcEvaluateExpression(candidate, previous);
                const resultText = formatNumber(value);
                const history = [
                  {
                    id: uid("calc"),
                    expression: candidate,
                    result: resultText,
                    value,
                    angleMode: previous.angleMode,
                  },
                  ...previous.history,
                ].slice(0, 6);
                return {
                  ...previous,
                  expression: candidate,
                  ans: value,
                  lastResultText: resultText,
                  lastResultValue: value,
                  history,
                  afterEval: true,
                  shift: false,
                  modeOpen: false,
                };
              } catch {
                return {
                  ...previous,
                  afterEval: false,
                };
              }
            });
            return;
          }
          if (button.value === "negate") {
            setCalc((previous) => {
              const expression = previous.afterEval ? "" : previous.expression;
              if (!expression || calcNeedsValue(expression)) {
                return {
                  ...previous,
                  expression: expression + "-",
                  afterEval: false,
                };
              }
              return previous;
            });
          }
        },
        [setCalc],
      );

      React.useEffect(() => {
        function handleKeyDown(event) {
          const target = event.target;
          if (
            target &&
            (target.tagName === "INPUT" ||
              target.tagName === "TEXTAREA" ||
              target.tagName === "SELECT" ||
              target.isContentEditable)
          ) {
            return;
          }
          const key = event.key;
          const map = {
            Enter: { kind: "equals", value: "=" },
            Backspace: { onPress: () => keys[0][4].onPress() },
            Escape: { onPress: () => keys[0][3].onPress() },
            "+": { kind: "operator", value: "+" },
            "-": { kind: "operator", value: "-" },
            "*": { kind: "operator", value: "*" },
            "/": { kind: "operator", value: "/" },
            "^": { kind: "operator", value: "^" },
            "(": { kind: "operator", value: "(" },
            ")": { kind: "operator", value: ")" },
            ".": { kind: "number", value: "." },
          };
          if (/^\d$/.test(key)) {
            event.preventDefault();
            triggerButton({ kind: "number", value: key, label: key });
            return;
          }
          if (!map[key]) return;
          event.preventDefault();
          triggerButton(map[key]);
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
      }, [keys, triggerButton]);

      return h("div", { className: "ypt-calc-shell" }, [
        h(
          "div",
          { key: "head", className: "ypt-tool-workspace-head" },
          [
            h("div", { key: "copy" }, [
              h(
                "p",
                { key: "eyebrow", className: "ypt-tool-workspace-eyebrow" },
                zh ? "工程計算機" : "Engineering calculator",
              ),
              h(
                "p",
                { key: "title", className: "ypt-tool-workspace-title" },
                "Casio-inspired workflow",
              ),
            ]),
            h(
              "button",
              {
                key: "back",
                type: "button",
                className: "ypt-tool-back-btn",
                onClick: onBack,
              },
              zh ? "返回工具" : "Back to Tools",
            ),
          ],
        ),
        h("div", { key: "device", className: "ypt-calc-device" }, [
          h("div", { key: "display", className: "ypt-calc-display" }, [
            h("div", { key: "meta", className: "ypt-calc-display-meta" }, [
              h("span", { key: "shift" }, calc.shift ? "SHIFT" : "READY"),
              h("span", { key: "mode" }, calc.angleMode),
              h("span", { key: "ans" }, "Ans " + formatNumber(calc.ans)),
            ]),
            h(
              "div",
              { key: "expression", className: "ypt-calc-display-expression" },
              calc.expression ? formatCalcExpression(calc.expression) : (zh ? "等待輸入" : "Ready"),
            ),
            h(
              "div",
              { key: "result", className: "ypt-calc-display-result" },
              preview.text,
            ),
            h(
              "div",
              { key: "hint", className: "ypt-calc-display-hint" },
              preview.ok ? (zh ? "即時預覽" : "Live preview") : "Error",
            ),
          ]),
          calc.modeOpen
            ? h("div", { key: "mode-panel", className: "ypt-calc-mode-panel" }, [
                h(
                  "div",
                  { key: "mode-head", className: "ypt-calc-mode-head" },
                  zh ? "模式設定" : "Mode settings",
                ),
                h("div", { key: "mode-actions", className: "ypt-calc-mode-actions" }, [
                  h(
                    "button",
                    {
                      key: "deg",
                      type: "button",
                      className:
                        "ypt-calc-mode-btn" +
                        (calc.angleMode === "DEG" ? " is-active" : ""),
                      onClick: () =>
                        setCalc((previous) => ({
                          ...previous,
                          angleMode: "DEG",
                        })),
                    },
                    "DEG",
                  ),
                  h(
                    "button",
                    {
                      key: "rad",
                      type: "button",
                      className:
                        "ypt-calc-mode-btn" +
                        (calc.angleMode === "RAD" ? " is-active" : ""),
                      onClick: () =>
                        setCalc((previous) => ({
                          ...previous,
                          angleMode: "RAD",
                        })),
                    },
                    "RAD",
                  ),
                  h(
                    "button",
                    {
                      key: "history",
                      type: "button",
                      className: "ypt-calc-mode-btn",
                      onClick: () =>
                        setCalc((previous) => ({
                          ...previous,
                          history: [],
                          modeOpen: false,
                        })),
                    },
                    zh ? "清除歷史" : "Clear history",
                  ),
                  h(
                    "button",
                    {
                      key: "ans-reset",
                      type: "button",
                      className: "ypt-calc-mode-btn",
                      onClick: () =>
                        setCalc((previous) => ({
                          ...previous,
                          ans: 0,
                        })),
                    },
                    zh ? "重設 Ans" : "Reset Ans",
                  ),
                ]),
              ])
            : null,
          h("div", { key: "history", className: "ypt-calc-history" }, [
            calc.history.length
              ? calc.history.map((entry) =>
                  h(
                    "button",
                    {
                      key: entry.id,
                      type: "button",
                      className: "ypt-calc-history-card",
                      onClick: () =>
                        setCalc((previous) => ({
                          ...previous,
                          expression: entry.expression,
                          afterEval: false,
                          modeOpen: false,
                        })),
                    },
                    [
                      h("div", { key: "top", className: "ypt-calc-history-top" }, [
                        h(
                          "div",
                          { key: "expression", className: "ypt-calc-history-expression" },
                          formatCalcExpression(entry.expression),
                        ),
                        h(
                          "div",
                          { key: "mode", className: "ypt-calc-history-mode" },
                          entry.angleMode,
                        ),
                      ]),
                      h(
                        "div",
                        { key: "result", className: "ypt-calc-history-result" },
                        entry.result,
                      ),
                    ],
                  ),
                )
              : h(
                  "div",
                  { key: "empty-history", className: "ypt-calc-history-empty" },
                  zh ? "尚無歷史紀錄" : "History will appear here",
                ),
          ]),
          h(
            "div",
            { key: "keypad", className: "ypt-calc-keypad" },
            keys.flat().map((button) =>
              h(
                "button",
                {
                  key: button.id,
                  type: "button",
                  className:
                    "ypt-calc-key ypt-calc-key--" +
                    button.kind +
                    (button.id === "shift" && calc.shift ? " ypt-calc-key--active" : ""),
                  onClick: () => triggerButton(button),
                },
                [
                  h(
                    "span",
                    { key: "secondary", className: "ypt-calc-key-secondary" },
                    button.secondary || " ",
                  ),
                  h(
                    "span",
                    {
                      key: "label",
                      className:
                        "ypt-calc-key-label" +
                        (String(button.label).length > 3 ? " ypt-calc-key-label--small" : ""),
                    },
                    button.label,
                  ),
                ],
              ),
            ),
          ),
        ]),
      ]);
    }

    function GraphWorkspace(props) {
      const { lang, graph, setGraph, onBack } = props;
      const zh = lang === "zh";
      const h = React.createElement;

      const compiledRows = React.useMemo(
        () =>
          graph.expressions.map((row, index) => {
            const text = typeof row?.text === "string" ? row.text : "";
            const compiled = text.trim()
              ? compileGraphText(text)
              : { ok: false, kind: "empty", error: "" };
            return {
              id: row?.id || uid("expr"),
              text,
              enabled: row?.enabled !== false,
              color: row?.color || palette()[index % palette().length],
              error: compiled.ok ? "" : compiled.error,
              kind: compiled.kind || (compiled.ok ? "function" : "error"),
              compiled,
            };
          }),
        [graph.expressions],
      );

      const selectedId =
        graph.view.selectedExpressionId &&
        compiledRows.some((row) => row.id === graph.view.selectedExpressionId)
          ? graph.view.selectedExpressionId
          : compiledRows[0]?.id || null;

      const selectedRow =
        compiledRows.find((row) => row.id === selectedId) || compiledRows[0] || null;

      const trace =
        Number.isFinite(graph.view.traceX) &&
        Number.isFinite(graph.view.traceY) &&
        graph.view.traceRowId
          ? {
              x: graph.view.traceX,
              y: graph.view.traceY,
              rowId: graph.view.traceRowId,
              color:
                compiledRows.find((row) => row.id === graph.view.traceRowId)?.color ||
                "#4a7c74",
              label:
                compiledRows.find((row) => row.id === graph.view.traceRowId)?.text || "",
            }
          : null;

      const tableRows = React.useMemo(() => {
        if (!selectedRow || !selectedRow.compiled?.ok) return [];
        const start = Number(graph.table.start) || 0;
        const step = Number(graph.table.step) || 1;
        const count = Math.max(5, Math.min(15, Number(graph.table.count) || 9));
        const rows = [];
        for (let index = 0; index < count; index += 1) {
          const x = start + index * step;
          let yText = "undefined";
          try {
            const y = graphCore.evaluateCompiled(selectedRow.compiled, x);
            yText = Number.isFinite(y) ? formatNumber(y) : "undefined";
          } catch {
            yText = "undefined";
          }
          rows.push({
            x: formatNumber(x),
            y: yText,
          });
        }
        return rows;
      }, [graph.table.start, graph.table.step, graph.table.count, selectedRow]);

      function patchGraph(updater) {
        setGraph((previous) => {
          const current = ensureGraphStateShape(previous);
          const next = typeof updater === "function" ? updater(current) : updater;
          return ensureGraphStateShape(next);
        });
      }

      function patchRows(updater) {
        patchGraph((previous) => {
          const nextRows =
            typeof updater === "function" ? updater(previous.expressions) : updater;
          const selectedExpressionId =
            previous.view.selectedExpressionId &&
            nextRows.some((row) => row.id === previous.view.selectedExpressionId)
              ? previous.view.selectedExpressionId
              : nextRows[0]?.id || null;
          return {
            ...previous,
            expressions: nextRows,
            view: {
              ...previous.view,
              selectedExpressionId,
            },
          };
        });
      }

      return h("div", { className: "ypt-graph-shell" }, [
        h(
          "div",
          { key: "head", className: "ypt-tool-workspace-head ypt-tool-workspace-head--flush" },
          [
            h("div", { key: "copy" }, [
              h(
                "p",
                { key: "eyebrow", className: "ypt-tool-workspace-eyebrow" },
                zh ? "二維繪圖" : "2D graphing",
              ),
              h(
                "p",
                { key: "title", className: "ypt-tool-workspace-title" },
                "Expression workspace",
              ),
            ]),
            h(
              "button",
              {
                key: "back",
                type: "button",
                className: "ypt-tool-back-btn",
                onClick: onBack,
              },
              zh ? "返回工具" : "Back to Tools",
            ),
          ],
        ),
        h("div", { key: "workspace", className: "ypt-graph-workspace" }, [
          h("section", { key: "panel", className: "ypt-graph-panel" }, [
            h("div", { key: "panel-head", className: "ypt-graph-panel-header" }, [
              h("div", { key: "copy", className: "min-w-0" }, [
                h(
                  "p",
                  { key: "title", className: "ypt-graph-section-title" },
                  zh ? "函數列表" : "Expression list",
                ),
                h(
                  "p",
                  { key: "copy", className: "ypt-graph-section-copy" },
                  zh
                    ? "支援 y = ...、裸表達式、絕對值與隱式乘法。"
                    : "Supports y = ..., bare expressions, abs, and implicit multiplication.",
                ),
              ]),
              h(
                "button",
                {
                  key: "add",
                  type: "button",
                  className: "ypt-graph-add-btn",
                  onClick: () =>
                    patchRows((rows) => [
                      ...rows,
                      createGraphExpressionRow("", rows.length),
                    ]),
                },
                zh ? "+ 新函數" : "+ Add row",
              ),
            ]),
            h(
              "div",
              { key: "list", className: "ypt-graph-expression-list" },
              compiledRows.map((row, index) =>
                h(
                  "div",
                  {
                    key: row.id,
                    className:
                      "ypt-graph-row" +
                      (selectedId === row.id || graph.hoveredExpressionId === row.id
                        ? " is-selected"
                        : "") +
                      (!row.enabled ? " is-disabled" : ""),
                    onMouseEnter: () =>
                      patchGraph((previous) => ({
                        ...previous,
                        hoveredExpressionId: row.id,
                      })),
                    onMouseLeave: () =>
                      patchGraph((previous) => ({
                        ...previous,
                        hoveredExpressionId: null,
                      })),
                  },
                  [
                    h("div", { key: "top", className: "ypt-graph-row-top" }, [
                      h("button", {
                        key: "visible",
                        type: "button",
                        className:
                          "ypt-graph-visibility " +
                          (row.enabled ? "is-on" : "is-off"),
                        style: { color: row.color },
                        onClick: () =>
                          patchRows((rows) =>
                            rows.map((candidate) =>
                              candidate.id === row.id
                                ? { ...candidate, enabled: !candidate.enabled }
                                : candidate,
                            ),
                          ),
                      }),
                      h("span", {
                        key: "chip",
                        className: "ypt-graph-color-chip",
                        style: { backgroundColor: row.color },
                      }),
                      h("input", {
                        key: "input",
                        className: "ypt-graph-input",
                        value: row.text,
                        onFocus: () =>
                          patchGraph((previous) => ({
                            ...previous,
                            view: {
                              ...previous.view,
                              selectedExpressionId: row.id,
                            },
                          })),
                        onChange: (event) =>
                          patchRows((rows) =>
                            rows.map((candidate) =>
                              candidate.id === row.id
                                ? sanitizeGraphExpressionRow(
                                    {
                                      ...candidate,
                                      text: event.target.value,
                                    },
                                    index,
                                  )
                                : candidate,
                            ),
                          ),
                        placeholder: index === 0 ? "y = x^2" : "sin(x)",
                      }),
                      h(
                        "button",
                        {
                          key: "up",
                          type: "button",
                          className: "ypt-graph-icon-btn",
                          onClick: () => {
                            if (index === 0) return;
                            patchRows((rows) => {
                              const next = rows.slice();
                              const swap = next[index - 1];
                              next[index - 1] = next[index];
                              next[index] = swap;
                              return next;
                            });
                          },
                        },
                        "↑",
                      ),
                      h(
                        "button",
                        {
                          key: "down",
                          type: "button",
                          className: "ypt-graph-icon-btn",
                          onClick: () => {
                            if (index >= compiledRows.length - 1) return;
                            patchRows((rows) => {
                              const next = rows.slice();
                              const swap = next[index + 1];
                              next[index + 1] = next[index];
                              next[index] = swap;
                              return next;
                            });
                          },
                        },
                        "↓",
                      ),
                      h(
                        "button",
                        {
                          key: "delete",
                          type: "button",
                          className: "ypt-graph-icon-btn",
                          onClick: () => {
                            if (compiledRows.length === 1) {
                              patchRows([createGraphExpressionRow("", 0)]);
                              return;
                            }
                            patchRows((rows) =>
                              rows.filter((candidate) => candidate.id !== row.id),
                            );
                          },
                        },
                        "×",
                      ),
                    ]),
                    h("div", { key: "meta", className: "ypt-graph-row-meta" }, [
                      h(
                        "span",
                        { key: "kind" },
                        row.compiled?.ok
                          ? row.compiled.normalized || row.text || "y = f(x)"
                          : zh
                            ? "等待有效表達式"
                            : "Waiting for a valid expression",
                      ),
                      h(
                        "span",
                        { key: "toggle" },
                        row.enabled ? (zh ? "已啟用" : "Enabled") : (zh ? "已停用" : "Disabled"),
                      ),
                    ]),
                    row.error
                      ? h(
                          "div",
                          { key: "error", className: "ypt-graph-row-error" },
                          row.error,
                        )
                      : null,
                  ],
                ),
              ),
            ),
            graph.showTable
              ? h("div", { key: "table", className: "ypt-graph-table" }, [
                  h(
                    "div",
                    { key: "table-title", className: "ypt-graph-section-title" },
                    zh ? "數值表" : "Value table",
                  ),
                  selectedRow
                    ? h(
                        "div",
                        { key: "table-copy", className: "ypt-graph-section-copy" },
                        selectedRow.text || (zh ? "請先輸入函數" : "Select an expression"),
                      )
                    : null,
                  h("div", { key: "controls", className: "ypt-graph-table-controls" }, [
                    h("div", { key: "start", className: "ypt-graph-table-field" }, [
                      h("label", { key: "label" }, "x start"),
                      h("input", {
                        key: "input",
                        type: "number",
                        value: graph.table.start,
                        onChange: (event) =>
                          patchGraph((previous) => ({
                            ...previous,
                            table: {
                              ...previous.table,
                              start: Number(event.target.value),
                            },
                          })),
                      }),
                    ]),
                    h("div", { key: "step", className: "ypt-graph-table-field" }, [
                      h("label", { key: "label" }, "step"),
                      h("input", {
                        key: "input",
                        type: "number",
                        value: graph.table.step,
                        onChange: (event) =>
                          patchGraph((previous) => ({
                            ...previous,
                            table: {
                              ...previous.table,
                              step: Number(event.target.value),
                            },
                          })),
                      }),
                    ]),
                  ]),
                  h(
                    "div",
                    { key: "grid", className: "ypt-graph-table-grid" },
                    [
                      h("div", { key: "head", className: "ypt-graph-table-row ypt-graph-table-row--head" }, [
                        h("div", { key: "x" }, "x"),
                        h("div", { key: "y" }, "y"),
                      ]),
                      ...tableRows.map((row, index) =>
                        h("div", { key: "row-" + index, className: "ypt-graph-table-row" }, [
                          h("div", { key: "x" }, row.x),
                          h("div", { key: "y" }, row.y),
                        ]),
                      ),
                    ],
                  ),
                ])
              : null,
          ]),
          h("section", { key: "main", className: "ypt-graph-main" }, [
            h("div", { key: "toolbar", className: "ypt-graph-toolbar" }, [
              h("div", { key: "copy", className: "ypt-graph-toolbar-copy" }, [
                h(
                  "div",
                  { key: "title", className: "ypt-graph-section-title" },
                  zh ? "畫布" : "Viewport",
                ),
                h(
                  "div",
                  { key: "copy", className: "ypt-graph-section-copy" },
                  zh
                    ? "滑鼠滾輪縮放，拖曳平移，懸停查看座標。"
                    : "Wheel to zoom, drag to pan, hover to inspect coordinates.",
                ),
              ]),
              h("div", { key: "actions", className: "ypt-graph-toolbar-actions" }, [
                h(
                  "button",
                  {
                    key: "table-toggle",
                    type: "button",
                    className:
                      "ypt-graph-toolbar-btn" + (graph.showTable ? " is-active" : ""),
                    onClick: () =>
                      patchGraph((previous) => ({
                        ...previous,
                        showTable: !previous.showTable,
                      })),
                  },
                  zh ? "數值表" : "Table",
                ),
                h(
                  "button",
                  {
                    key: "zoom-in",
                    type: "button",
                    className: "ypt-graph-toolbar-btn",
                    onClick: () =>
                      patchGraph((previous) => {
                        const centerX = (previous.view.xMin + previous.view.xMax) / 2;
                        const centerY = (previous.view.yMin + previous.view.yMax) / 2;
                        return {
                          ...previous,
                          view: zoomGraphViewAroundPoint(previous.view, centerX, centerY, 0.84),
                        };
                      }),
                  },
                  zh ? "放大" : "Zoom in",
                ),
                h(
                  "button",
                  {
                    key: "zoom-out",
                    type: "button",
                    className: "ypt-graph-toolbar-btn",
                    onClick: () =>
                      patchGraph((previous) => {
                        const centerX = (previous.view.xMin + previous.view.xMax) / 2;
                        const centerY = (previous.view.yMin + previous.view.yMax) / 2;
                        return {
                          ...previous,
                          view: zoomGraphViewAroundPoint(previous.view, centerX, centerY, 1.16),
                        };
                      }),
                  },
                  zh ? "縮小" : "Zoom out",
                ),
                h(
                  "button",
                  {
                    key: "fit",
                    type: "button",
                    className: "ypt-graph-toolbar-btn",
                    onClick: () =>
                      patchGraph((previous) => ({
                        ...previous,
                        view: normalizeGraphViewShape({
                          ...graphCore.fitVisibleExpressions(
                            compiledRows.filter((row) => row.enabled && row.compiled?.ok),
                            previous.view,
                          ),
                          selectedExpressionId: previous.view.selectedExpressionId,
                        }),
                      })),
                  },
                  zh ? "適配" : "Fit",
                ),
                h(
                  "button",
                  {
                    key: "reset",
                    type: "button",
                    className: "ypt-graph-toolbar-btn",
                    onClick: () =>
                      patchGraph((previous) => ({
                        ...previous,
                        view: normalizeGraphViewShape({
                          ...defaultGraphView(),
                          selectedExpressionId: previous.view.selectedExpressionId,
                        }),
                      })),
                  },
                  zh ? "重設" : "Reset",
                ),
              ]),
            ]),
            h(GraphViewport, {
              key: "viewport",
              lang,
              rows: compiledRows,
              view: graph.view,
              trace,
              hoveredExpressionId: graph.hoveredExpressionId,
              onViewChange: (nextView) =>
                patchGraph((previous) => ({
                  ...previous,
                  view: normalizeGraphViewShape({
                    ...nextView,
                    selectedExpressionId: previous.view.selectedExpressionId,
                  }),
                })),
              onTraceChange: (nextTrace) =>
                patchGraph((previous) => ({
                  ...previous,
                  view: {
                    ...previous.view,
                    traceX: nextTrace?.x ?? null,
                    traceY: nextTrace?.y ?? null,
                    traceRowId: nextTrace?.rowId ?? null,
                  },
                })),
              onHoverChange: (rowId) =>
                patchGraph((previous) => ({
                  ...previous,
                  hoveredExpressionId: rowId,
                })),
            }),
          ]),
        ]),
      ]);
    }

    function ToolsSectionV16(props) {
      const { lang, toolsState, setToolsState } = props;
      const zh = lang === "zh";
      const h = React.createElement;
      const [localToolsState, setLocalToolsState] = React.useState(() =>
        createInitialLearnToolsState(),
      );
      const isControlled = toolsState && typeof setToolsState === "function";
      const state = ensureLearnToolsStateShape(
        isControlled ? toolsState : localToolsState,
      );

      const patchTools = React.useCallback(
        (updater) => {
          const apply = (previous) => {
            const safePrevious = ensureLearnToolsStateShape(previous);
            const next =
              typeof updater === "function" ? updater(safePrevious) : updater;
            return ensureLearnToolsStateShape(next);
          };
          if (isControlled) {
            setToolsState((previous) => apply(previous));
          } else {
            setLocalToolsState((previous) => apply(previous));
          }
        },
        [isControlled, setToolsState],
      );

      const setCalc = React.useCallback(
        (updater) =>
          patchTools((previous) => ({
            ...previous,
            calculator:
              typeof updater === "function"
                ? ensureCalcStateShape(updater(previous.calculator))
                : ensureCalcStateShape(updater),
          })),
        [patchTools],
      );

      const setGraph = React.useCallback(
        (updater) =>
          patchTools((previous) => ({
            ...previous,
            graph:
              typeof updater === "function"
                ? ensureGraphStateShape(updater(previous.graph))
                : ensureGraphStateShape(updater),
          })),
        [patchTools],
      );

      const toolCards = [
        {
          id: "calc",
          icon: "fx",
          title: zh ? "工程計算機" : "Engineering Calculator",
          copy: zh
            ? "SHIFT、DEG/RAD、Ans、歷史紀錄與密集按鍵布局。"
            : "SHIFT, DEG/RAD, Ans, history, and a compact keypad layout.",
        },
        {
          id: "graph",
          icon: "y=f(x)",
          title: zh ? "函數圖形" : "Function Grapher",
          copy: zh
            ? "多式子列表、畫布縮放平移、追蹤與數值表。"
            : "Multiple expressions, viewport pan/zoom, trace, and value table.",
        },
      ];

      if (state.activeTool === "calc") {
        return h(CalculatorWorkspace, {
          lang,
          calc: state.calculator,
          setCalc,
          onBack: () =>
            patchTools((previous) => ({
              ...previous,
              activeTool: null,
            })),
        });
      }

      if (state.activeTool === "graph") {
        return h(GraphWorkspace, {
          lang,
          graph: state.graph,
          setGraph,
          onBack: () =>
            patchTools((previous) => ({
              ...previous,
              activeTool: null,
            })),
        });
      }

      return h("div", null, [
        h(
          "p",
          { key: "copy", className: "text-sm text-[#6b7280] mb-4" },
          zh
            ? "在 Learn 中直接使用工程計算與二維函數繪圖。"
            : "Use engineering calculation and 2D graphing directly inside Learn.",
        ),
        h(
          "div",
          { key: "grid", className: "ypt-tool-home-grid" },
          toolCards.map((tool) =>
            h(
              "button",
              {
                key: tool.id,
                type: "button",
                className: "ypt-tool-card",
                onClick: () =>
                  patchTools((previous) => ({
                    ...previous,
                    activeTool: tool.id,
                  })),
              },
              [
                h(
                  "div",
                  { key: "badge", className: "ypt-tool-card-badge" },
                  tool.icon,
                ),
                h(
                  "p",
                  { key: "title", className: "ypt-tool-card-title" },
                  tool.title,
                ),
                h(
                  "p",
                  { key: "copy", className: "ypt-tool-card-copy" },
                  tool.copy,
                ),
              ],
            ),
          ),
        ),
      ]);
    }

    return {
      createInitialLearnToolsState,
      ensureLearnToolsStateShape,
      ToolsSectionV16,
    };
  }

  global.YPTToolsReactV16 = {
    createToolsKit,
  };
})(window);
