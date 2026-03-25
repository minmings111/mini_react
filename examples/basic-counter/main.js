import { h, render } from "../../src/index.js";

let count = 0;
const container = document.getElementById("app");

function CounterApp() {
  return h(
    "div",
    { className: "counter-app" },
    h("h1", null, `Count: ${count}`),
    h("p", null, "JSX 없이 만드는 mini-react 예제"),
    h("button", { type: "button" }, "버튼은 아직 동작 연결 전")
  );
}

function update() {
  count += 1;
  const result = render(CounterApp(), container);
  console.log(result.patches);
}

render(CounterApp(), container);
window.updateCounterExample = update;
