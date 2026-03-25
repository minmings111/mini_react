import test from "node:test";
import assert from "node:assert/strict";

import { diff, h, PATCH_TYPES } from "../src/index.js";

function keyedItem(key, text, props = {}) {
  return h("li", { key, ...props }, text);
}

test("diff returns CREATE when a root node is added", () => {
  const nextNode = h("div", { id: "app" }, "hello");
  const patches = diff(null, nextNode);

  assert.equal(patches.length, 1);
  assert.equal(patches[0].type, PATCH_TYPES.CREATE);
  assert.equal(patches[0].path, "root");
  assert.equal(patches[0].node.type, "div");
});

test("diff returns REMOVE when a root node is removed", () => {
  const previousNode = h("div", { id: "app" }, "hello");
  const patches = diff(previousNode, null);

  assert.deepEqual(patches, [
    {
      type: PATCH_TYPES.REMOVE,
      path: "root",
    },
  ]);
});

test("diff returns REPLACE when node type changes", () => {
  const oldNode = h("div", null, "A");
  const newNode = h("section", null, "A");
  const patches = diff(oldNode, newNode);

  assert.equal(patches.length, 1);
  assert.equal(patches[0].type, PATCH_TYPES.REPLACE);
  assert.equal(patches[0].path, "root");
  assert.equal(patches[0].oldNode.type, "div");
  assert.equal(patches[0].newNode.type, "section");
});

test("diff returns UPDATE_TEXT for changed text node", () => {
  const oldNode = h("div", null, "A");
  const newNode = h("div", null, "B");
  const patches = diff(oldNode, newNode);

  assert.deepEqual(patches, [
    {
      type: PATCH_TYPES.UPDATE_TEXT,
      path: "root.children[0]",
      oldValue: "A",
      newValue: "B",
    },
  ]);
});

test("diff emits only changed UPDATE_PROP patches and ignores key prop", () => {
  const oldNode = h("div", { id: "one", className: "box", key: "stable" });
  const newNode = h("div", {
    id: "two",
    className: "box",
    title: "next",
    key: "stable",
  });

  const patches = diff(oldNode, newNode);

  assert.deepEqual(patches, [
    {
      type: PATCH_TYPES.UPDATE_PROP,
      path: "root",
      key: "id",
      oldValue: "one",
      newValue: "two",
    },
    {
      type: PATCH_TYPES.UPDATE_PROP,
      path: "root",
      key: "title",
      oldValue: undefined,
      newValue: "next",
    },
  ]);
});

test("diff updates only the changed child path instead of replacing the parent", () => {
  const oldNode = h("div", null, h("span", null, "A"), h("strong", null, "B"));
  const newNode = h("div", null, h("span", null, "A"), h("strong", null, "C"));
  const patches = diff(oldNode, newNode);

  assert.deepEqual(patches, [
    {
      type: PATCH_TYPES.UPDATE_TEXT,
      path: "root.children[1].children[0]",
      oldValue: "B",
      newValue: "C",
    },
  ]);
});

test("diff falls back to index-based comparison when children have no keys", () => {
  const oldNode = h("ul", null, h("li", null, "A"), h("li", null, "B"));
  const newNode = h("ul", null, h("li", null, "B"), h("li", null, "A"));
  const patches = diff(oldNode, newNode);

  assert.deepEqual(patches, [
    {
      type: PATCH_TYPES.UPDATE_TEXT,
      path: "root.children[0].children[0]",
      oldValue: "A",
      newValue: "B",
    },
    {
      type: PATCH_TYPES.UPDATE_TEXT,
      path: "root.children[1].children[0]",
      oldValue: "B",
      newValue: "A",
    },
  ]);
});

test("diff uses keys to preserve the matched child during reorder", () => {
  const oldNode = h(
    "ul",
    null,
    keyedItem("a", "A"),
    keyedItem("b", "B")
  );
  const newNode = h(
    "ul",
    null,
    keyedItem("b", "B"),
    keyedItem("a", "A")
  );

  const patches = diff(oldNode, newNode);

  assert.deepEqual(patches, [
    {
      type: PATCH_TYPES.REMOVE,
      path: "root.children[0]",
    },
    {
      type: PATCH_TYPES.CREATE,
      path: "root.children[1]",
      node: keyedItem("a", "A"),
    },
  ]);
});

test("diff uses dynamic paths so a moved keyed node can still receive a minimal update", () => {
  const oldNode = h(
    "ul",
    null,
    keyedItem("a", "A"),
    keyedItem("b", "B", { className: "before" })
  );
  const newNode = h(
    "ul",
    null,
    keyedItem("b", "B", { className: "after" }),
    keyedItem("a", "A")
  );

  const patches = diff(oldNode, newNode);

  assert.deepEqual(patches, [
    {
      type: PATCH_TYPES.REMOVE,
      path: "root.children[0]",
    },
    {
      type: PATCH_TYPES.UPDATE_PROP,
      path: "root.children[0]",
      key: "className",
      oldValue: "before",
      newValue: "after",
    },
    {
      type: PATCH_TYPES.CREATE,
      path: "root.children[1]",
      node: keyedItem("a", "A"),
    },
  ]);
});

test("diff replaces a keyed child when a new keyed child must take its slot", () => {
  const oldNode = h("ul", null, keyedItem("a", "A"), keyedItem("c", "C"));
  const newNode = h("ul", null, keyedItem("a", "A"), keyedItem("b", "B"), keyedItem("c", "C"));

  const patches = diff(oldNode, newNode);

  assert.deepEqual(patches, [
    {
      type: PATCH_TYPES.REPLACE,
      path: "root.children[1]",
      oldNode: keyedItem("c", "C"),
      newNode: keyedItem("b", "B"),
    },
    {
      type: PATCH_TYPES.CREATE,
      path: "root.children[2]",
      node: keyedItem("c", "C"),
    },
  ]);
});

test("diff warns and falls back to index-based diff when duplicate keys are found", () => {
  const oldWarn = console.warn;
  const warnings = [];

  console.warn = (...args) => {
    warnings.push(args.join(" "));
  };

  try {
    const oldNode = h(
      "ul",
      null,
      keyedItem("dup", "A"),
      keyedItem("dup", "B")
    );
    const newNode = h(
      "ul",
      null,
      keyedItem("dup", "A"),
      keyedItem("dup", "C")
    );

    const patches = diff(oldNode, newNode);

    assert.ok(warnings.length >= 1);
    assert.match(warnings[0], /Duplicate key "dup"/);
    assert.deepEqual(patches, [
      {
        type: PATCH_TYPES.UPDATE_TEXT,
        path: "root.children[1].children[0]",
        oldValue: "B",
        newValue: "C",
      },
    ]);
  } finally {
    console.warn = oldWarn;
  }
});

test("diff resolves component vnodes before comparing children", () => {
  function Label({ value }) {
    return h("span", null, value);
  }

  const oldNode = h("div", null, h(Label, { value: "A" }));
  const newNode = h("div", null, h(Label, { value: "B" }));
  const patches = diff(oldNode, newNode);

  assert.deepEqual(patches, [
    {
      type: PATCH_TYPES.UPDATE_TEXT,
      path: "root.children[0].children[0]",
      oldValue: "A",
      newValue: "B",
    },
  ]);
});
