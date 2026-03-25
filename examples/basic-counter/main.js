import { h, render } from "../../src/index.js";

let count = 0;
const container = document.getElementById("app");
const debugPanel = document.getElementById("debug-panel");
const incrementButton = document.getElementById("increment-button");
const decrementButton = document.getElementById("decrement-button");
const resetButton = document.getElementById("reset-button");

function formatValue(value) {
  return JSON.stringify(
    value,
    (key, currentValue) => {
      if (typeof currentValue === "function") {
        return `[Function ${currentValue.name || "anonymous"}]`;
      }

      return currentValue;
    },
    2
  );
}

function getPatchTypes(patches) {
  if (patches.length === 0) {
    return "[]";
  }

  return patches.map((patch) => patch.type).join(", ");
}

function CounterApp() {
  return h(
    "div",
    { className: "counter-app" },
    h("h1", null, `Count: ${count}`),
    h("p", null, "JSX 없이 render, diff, commit 흐름을 확인합니다."),
    h("p", null, count % 2 === 0 ? "현재 count는 짝수입니다." : "현재 count는 홀수입니다."),
    h(
      "ul",
      null,
      h("li", null, `double: ${count * 2}`),
      h("li", null, `absolute: ${Math.abs(count)}`),
      h("li", null, `sign: ${count === 0 ? "zero" : count > 0 ? "positive" : "negative"}`)
    )
  );
}

function renderDebugPanel(result) {
  debugPanel.innerHTML = "";

  const sections = [
    ["state", { count }],
    ["oldVdom", result.oldVNode],
    ["newVdom", result.newVNode],
    ["diff 결과", result.patches],
    ["patch count", result.patches.length],
    ["patch types", getPatchTypes(result.patches)],
  ];

  sections.forEach(([title, value]) => {
    const wrapper = document.createElement("section");
    const heading = document.createElement("h3");
    const pre = document.createElement("pre");

    heading.textContent = title;
    pre.textContent =
      typeof value === "string" ? value : formatValue(value);

    wrapper.appendChild(heading);
    wrapper.appendChild(pre);
    debugPanel.appendChild(wrapper);
  });
}

function update(nextCount) {
  count = nextCount;
  const result = render(CounterApp(), container);
  renderDebugPanel(result);
  console.log(result.patches);
}

incrementButton.addEventListener("click", () => {
  update(count + 1);
});

decrementButton.addEventListener("click", () => {
  update(count - 1);
});

resetButton.addEventListener("click", () => {
  update(0);
});

update(count);
