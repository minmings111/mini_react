import {
  applyPatch,
  cloneVNode,
  createRealNode,
  diff,
  domToVNode,
  getNodeByPath,
  PATCH_TYPES,
  VNODE_TYPES,
} from "../../src/index.js";

const SAMPLE_HTML = `
  <article class="scene-root" data-tone="calm">
    <header>
      <span class="demo-eyebrow">Virtual DOM Lab</span>
      <h3>Actual DOM</h3>
    </header>
    <section class="summary-grid">
      <div>
        <strong>Document</strong>
        <span>브라우저가 가진 실제 트리</span>
      </div>
      <div>
        <strong>VDOM</strong>
        <span>JS 객체 트리 스냅샷</span>
      </div>
      <div>
        <strong>Patch</strong>
        <span>변경된 부분만 DOM 반영</span>
      </div>
    </section>
    <footer class="action-stack">
      <button type="button" class="scene-cta">Actual DOM은 Patch 전까지 유지</button>
    </footer>
  </article>
`;

const refs = {
  actualHost: document.getElementById("actual-host"),
  testHost: document.getElementById("test-host"),
  htmlSource: document.getElementById("html-source"),
  applySourceButton: document.getElementById("apply-source-button"),
  sourceSyncChip: document.getElementById("source-sync-chip"),
  actualChip: document.getElementById("actual-chip"),
  selectionChip: document.getElementById("selection-chip"),
  historyChip: document.getElementById("history-chip"),
  liveDiffChip: document.getElementById("live-diff-chip"),
  patchCountChip: document.getElementById("patch-count-chip"),
  previousTree: document.getElementById("previous-tree"),
  currentTree: document.getElementById("current-tree"),
  patchList: document.getElementById("patch-list"),
  domOpList: document.getElementById("dom-op-list"),
  mutationList: document.getElementById("mutation-list"),
  historyList: document.getElementById("history-list"),
  metricRead: document.getElementById("metric-read"),
  metricDiff: document.getElementById("metric-diff"),
  metricPatch: document.getElementById("metric-patch"),
  metricPaint: document.getElementById("metric-paint"),
  patchButton: document.getElementById("patch-button"),
  undoButton: document.getElementById("undo-button"),
  redoButton: document.getElementById("redo-button"),
  resetButton: document.getElementById("reset-button"),
  addChildButton: document.getElementById("add-child-button"),
  replaceTagButton: document.getElementById("replace-tag-button"),
  deleteNodeButton: document.getElementById("delete-node-button"),
};

const state = {
  baselineVNode: null,
  actualRoot: null,
  testRoot: null,
  selectedNode: null,
  previousVNode: null,
  liveVNode: null,
  stagedPatches: [],
  lastDomOps: [],
  mutationLog: [],
  history: [],
  pointer: 0,
  observer: null,
  internalMutationDepth: 0,
  refreshQueued: false,
  highlightTimer: 0,
  pipelineTimers: [],
  sourceDirty: false,
};

const IGNORED_TEST_ATTRS = new Set(["contenteditable", "spellcheck"]);

initialize();

function initialize() {
  seedActualDomFromHtml();
  bindEvents();
  setupMutationObserver();
  syncDerivedState();
  renderAll();
  setStatus("실제 DOM을 읽어 Virtual DOM으로 만들고, 그 스냅샷으로 테스트 영역을 렌더링했습니다.");
  playPipeline(["read"]);
  exposeDebugHelpers();
}

function seedActualDomFromHtml() {
  refs.actualHost.innerHTML = SAMPLE_HTML.trim();
  state.actualRoot = refs.actualHost.firstElementChild;

  const initialVNode = domToVNode(state.actualRoot);
  state.baselineVNode = cloneVNode(initialVNode);
  state.history = [makeHistoryEntry("State 0", "초기 로드", initialVNode, [], "초기 Actual DOM 스냅샷")];
  state.pointer = 0;

  renderActualFromVNode(initialVNode);
  renderTestFromVNode(initialVNode);
}

function bindEvents() {
  refs.patchButton.addEventListener("click", handlePatch);
  refs.undoButton.addEventListener("click", () => jumpToHistory(state.pointer - 1));
  refs.redoButton.addEventListener("click", () => jumpToHistory(state.pointer + 1));
  refs.resetButton.addEventListener("click", handleReset);

  refs.addChildButton.addEventListener("click", handleAddChild);
  refs.replaceTagButton.addEventListener("click", handleReplaceTag);
  refs.deleteNodeButton.addEventListener("click", handleDeleteNode);
  refs.applySourceButton.addEventListener("click", handleApplySource);
  refs.htmlSource.addEventListener("input", () => {
    state.sourceDirty = true;
    renderSourceEditor();
    renderButtons();
    previewSourceInput();
  });

  refs.testHost.addEventListener("click", handleTestStageClick);
  refs.testHost.addEventListener("input", () => {
    logMutation({
      kind: "input",
      detail: "contenteditable 입력이 발생했습니다. 브라우저 DOM이 바로 바뀌었습니다.",
    });
    scheduleRefresh();
  });
}

function setupMutationObserver() {
  state.observer = new MutationObserver((records) => {
    if (isInternalMutation()) return;

    for (const record of records) {
      if (record.type === "characterData") {
        logMutation({
          kind: "characterData",
          detail: `텍스트 변경: ${truncate(record.target.textContent || "", 72)}`,
        });
      } else if (record.type === "attributes") {
        if (record.attributeName && record.attributeName.startsWith("data-lab-")) {
          continue;
        }
        const target = record.target;
        logMutation({
          kind: "attributes",
          detail: `<${target.tagName.toLowerCase()}> 속성 ${record.attributeName} 변경`,
        });
      } else if (record.type === "childList") {
        const added = record.addedNodes.length;
        const removed = record.removedNodes.length;
        if (added || removed) {
          logMutation({
            kind: "childList",
            detail: `자식 노드 변화: +${added}, -${removed}`,
          });
        }
      }
    }

    scheduleRefresh();
  });

  state.observer.observe(refs.testHost, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
  });
}

function scheduleRefresh() {
  if (state.refreshQueued) return;
  state.refreshQueued = true;

  window.requestAnimationFrame(() => {
    state.refreshQueued = false;
    syncDerivedState();
    renderAll();
  });
}

function syncDerivedState() {
  state.previousVNode = cloneVNode(state.history[state.pointer].vnode);
  state.liveVNode = state.testRoot ? sanitizeVNode(domToVNode(state.testRoot)) : null;
  state.stagedPatches = state.liveVNode ? diff(state.previousVNode, state.liveVNode) : [];

  if (state.selectedNode && !refs.testHost.contains(state.selectedNode)) {
    state.selectedNode = null;
  }
}

function renderAll() {
  renderTree(refs.previousTree, state.previousVNode);
  renderTree(refs.currentTree, state.liveVNode, state.stagedPatches);
  renderPatchList();
  renderDomOps();
  renderMutationLog();
  renderHistory();
  renderMetrics();
  renderChips();
  renderButtons();
  renderSourceEditor();
}

function renderMetrics() {
  refs.metricRead.textContent = `${countNodes(state.previousVNode)} nodes`;
  refs.metricDiff.textContent = `${state.stagedPatches.length} patches`;
  refs.metricPatch.textContent = `${state.lastDomOps.length} ops`;
  refs.metricPaint.textContent = describeImpact(analyzePaintImpact(state.stagedPatches)).shortLabel;
}

function renderChips() {
  refs.actualChip.textContent = `History ${state.pointer} / ${Math.max(0, state.history.length - 1)}`;
  refs.historyChip.textContent = state.history[state.pointer].stateName;
  refs.liveDiffChip.textContent = state.stagedPatches.length
    ? `${state.stagedPatches.length}개 변경 대기`
    : "Actual과 동일";
  refs.patchCountChip.textContent = `${state.stagedPatches.length} patches`;
  refs.selectionChip.textContent = state.selectedNode
    ? `선택: <${state.selectedNode.tagName.toLowerCase()}>`
    : "선택 없음";
}

function renderButtons() {
  const hasSelection = Boolean(state.selectedNode);
  const canDeleteSelection = hasSelection && state.selectedNode !== state.testRoot;

  refs.patchButton.disabled = !state.liveVNode || state.stagedPatches.length === 0;
  refs.undoButton.disabled = state.pointer === 0;
  refs.redoButton.disabled = state.pointer >= state.history.length - 1;
  refs.addChildButton.disabled = !hasSelection;
  refs.replaceTagButton.disabled = !hasSelection;
  refs.deleteNodeButton.disabled = !canDeleteSelection;
  refs.applySourceButton.disabled = !state.sourceDirty || !refs.htmlSource.value.trim();
}

function renderSourceEditor() {
  if (!state.sourceDirty) {
    refs.htmlSource.value = serializeCurrentTestHtml();
  }

  refs.sourceSyncChip.textContent = state.sourceDirty ? "편집 중" : "동기화됨";
}

function renderPatchList() {
  refs.patchList.replaceChildren();

  if (!state.stagedPatches.length) {
    refs.patchList.append(createEmptyItem("지금은 Diff 결과가 없습니다. 테스트 영역을 수정하면 여기 표시됩니다."));
    return;
  }

  state.stagedPatches.forEach((patch, index) => {
    refs.patchList.append(renderEventItem(`${index + 1}. ${patch.type}`, describePatch(patch)));
  });
}

function renderDomOps() {
  refs.domOpList.replaceChildren();

  if (!state.lastDomOps.length) {
    refs.domOpList.append(createEmptyItem("아직 실제 DOM에 적용된 Patch가 없습니다."));
    return;
  }

  state.lastDomOps.forEach((operation, index) => {
    refs.domOpList.append(renderEventItem(`${index + 1}. ${operation.api}`, operation.detail));
  });
}

function renderMutationLog() {
  refs.mutationList.replaceChildren();

  if (!state.mutationLog.length) {
    refs.mutationList.append(createEmptyItem("MutationObserver가 아직 사용자 편집을 감지하지 않았습니다."));
    return;
  }

  state.mutationLog.forEach((entry, index) => {
    refs.mutationList.append(renderEventItem(`${index + 1}. ${entry.kind}`, entry.detail));
  });
}

function renderHistory() {
  refs.historyList.replaceChildren();

  state.history.forEach((entry, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `history-button${index === state.pointer ? " is-active" : ""}`;
    button.addEventListener("click", () => jumpToHistory(index));
    button.innerHTML = `
      <strong>${entry.stateName}</strong>
      <div class="history-meta">${entry.summary}</div>
      <div class="history-meta">${entry.patchSummary}</div>
    `;
    refs.historyList.append(button);
  });
}

function renderTree(container, vnode, patches = []) {
  container.replaceChildren();

  if (!vnode) {
    container.append(createEmptyItem("루트 Virtual DOM이 없습니다."));
    return;
  }

  const changedPaths = new Set(getChangedTreePaths(patches).map(serializeTreePath));
  const rows = flattenVNode(vnode);
  rows.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "tree-row";
    rowEl.style.setProperty("--depth", String(row.depth));

    if (changedPaths.has(serializeTreePath(row.path))) {
      rowEl.classList.add("is-changed");
    }

    const kind = document.createElement("span");
    kind.className = "tree-kind";
    kind.textContent = row.kind;

    const label = document.createElement("code");
    label.className = "tree-label";
    label.textContent = row.label;

    rowEl.append(kind, label);
    container.append(rowEl);
  });
}

function flattenVNode(vnode, depth = 0, rows = [], path = []) {
  if (vnode.nodeType === VNODE_TYPES.TEXT) {
    rows.push({
      depth,
      kind: "text",
      label: JSON.stringify(vnode.props?.nodeValue ?? ""),
      path: [...path],
    });
    return rows;
  }

  const attrs = Object.entries(vnode.props || {})
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  rows.push({
    depth,
    kind: "node",
    label: `<${vnode.type}${attrs ? ` ${attrs}` : ""}>`,
    path: [...path],
  });

  (vnode.children || []).forEach((child, index) =>
    flattenVNode(child, depth + 1, rows, [...path, index])
  );
  return rows;
}

function handlePatch() {
  syncDerivedState();

  if (!state.liveVNode) {
    setStatus("테스트 영역의 루트 요소를 읽을 수 없습니다.");
    return;
  }

  if (!state.stagedPatches.length) {
    setStatus("Diff 결과가 비어 있어서 실제 DOM에 반영할 내용이 없습니다.");
    playPipeline(["read", "diff"]);
    renderAll();
    return;
  }

  const patchesToApply = state.stagedPatches.map((patch) => ({ ...patch }));
  const patchCount = patchesToApply.length;

  clearPatchMarks();

  const result = applyPatchesWithLog(state.actualRoot, patchesToApply, refs.actualHost);
  state.actualRoot = result.root;

  if (refs.actualHost.firstChild !== state.actualRoot) {
    refs.actualHost.replaceChildren();
    if (state.actualRoot) refs.actualHost.append(state.actualRoot);
  }

  markPatchedNodes(result.touchedNodes);

  const nextEntry = makeHistoryEntry(
    `State ${state.pointer + 1}`,
    `Patch ${state.pointer + 1}`,
    state.liveVNode,
    patchesToApply,
    `${result.operations.length}개의 DOM API 호출로 실제 영역 갱신`
  );
  state.history = [...state.history.slice(0, state.pointer + 1), nextEntry];
  state.pointer = state.history.length - 1;
  state.lastDomOps = result.operations;

  syncDerivedState();
  renderAll();

  setStatus(
    `${result.operations.length}개의 DOM API 호출로 ${patchCount}개의 변경을 실제 DOM에 반영했습니다.`
  );
  playPipeline(["read", "diff", "patch", "paint"]);
}

function jumpToHistory(index) {
  if (index < 0 || index >= state.history.length || index === state.pointer) return;

  const entry = state.history[index];
  state.pointer = index;
  clearPatchMarks();
  clearSelectedNode();

  renderActualFromVNode(entry.vnode);
  renderTestFromVNode(entry.vnode);
  state.lastDomOps = [
    {
      api: "history.restore",
      detail: `${entry.stateName} 스냅샷으로 실제 영역과 테스트 영역을 다시 렌더링했습니다.`,
    },
  ];

  syncDerivedState();
  renderAll();

  setStatus(`${entry.stateName}로 이동했습니다. 실제 영역과 테스트 영역이 함께 되돌아갔습니다.`);
  playPipeline(["read", "paint"]);
}

function handleReset() {
  clearPatchMarks();
  clearSelectedNode();
  state.lastDomOps = [];
  state.mutationLog = [];
  state.history = [makeHistoryEntry("State 0", "초기 로드", state.baselineVNode, [], "초기 샘플로 복원")];
  state.pointer = 0;

  renderActualFromVNode(state.baselineVNode);
  renderTestFromVNode(state.baselineVNode);
  syncDerivedState();
  renderAll();

  setStatus("초기 샘플 상태로 복원했습니다. 테스트 영역의 수정과 forward history는 모두 정리됐습니다.");
  playPipeline(["read", "diff"]);
}

function renderActualFromVNode(vnode) {
  refs.actualHost.replaceChildren();
  const nextRoot = createRealNode(cloneVNode(vnode));
  refs.actualHost.append(nextRoot);
  state.actualRoot = nextRoot;
}

function renderTestFromVNode(vnode) {
  withInternalMutation(() => {
    refs.testHost.replaceChildren();
    const nextRoot = createRealNode(cloneVNode(vnode));
    decorateTestRoot(nextRoot);
    refs.testHost.append(nextRoot);
    state.testRoot = nextRoot;
  });
  state.sourceDirty = false;
}

function decorateTestRoot(root) {
  root.setAttribute("contenteditable", "true");
  root.setAttribute("spellcheck", "false");
  root.setAttribute("data-lab-root", "true");
}

function sanitizeVNode(vnode) {
  if (!vnode) return null;

  if (vnode.nodeType === VNODE_TYPES.TEXT) {
    return cloneVNode(vnode);
  }

  const filteredProps = Object.fromEntries(
    Object.entries(vnode.props || {}).filter(([key]) => {
      if (IGNORED_TEST_ATTRS.has(key)) return false;
      if (key.startsWith("data-lab-")) return false;
      return true;
    })
  );

  return {
    nodeType: vnode.nodeType,
    type: vnode.type,
    props: filteredProps,
    children: (vnode.children || []).map((child) => sanitizeVNode(child)).filter(Boolean),
  };
}

function handleTestStageClick(event) {
  if (!state.testRoot || !state.testRoot.contains(event.target)) return;
  const selected = event.target.closest("*") || state.testRoot;
  setSelectedNode(selected);
}

function clearSelectedNode() {
  withInternalMutation(() => {
    if (state.selectedNode && state.selectedNode.isConnected) {
      state.selectedNode.removeAttribute("data-lab-selected");
    }
    state.selectedNode = null;
  });
}

function setSelectedNode(node) {
  withInternalMutation(() => {
    if (state.selectedNode && state.selectedNode.isConnected) {
      state.selectedNode.removeAttribute("data-lab-selected");
    }

    state.selectedNode = node;

    if (state.selectedNode) {
      state.selectedNode.setAttribute("data-lab-selected", "true");
    }
  });

  renderButtons();
  renderChips();
}

function handleAddChild() {
  if (!state.selectedNode) return;

  const tagName = state.selectedNode.tagName.toLowerCase();
  let child;

  if (tagName === "ul" || tagName === "ol") {
    child = document.createElement("li");
    child.textContent = "새 항목: 브라우저에서 추가된 노드";
  } else if (tagName === "section" || tagName === "article" || tagName === "div" || tagName === "footer") {
    child = document.createElement("p");
    child.textContent = "새 문단: 이 노드는 다음 Patch에서 CREATE로 기록됩니다.";
  } else {
    child = document.createElement("span");
    child.textContent = "새 노드";
  }

  state.selectedNode.append(child);
  setStatus(`<${tagName}> 아래에 새 자식 노드를 추가했습니다. 다음 Patch에서 CREATE가 생성됩니다.`);
  scheduleRefresh();
}

function handleReplaceTag() {
  if (!state.selectedNode) return;

  const current = state.selectedNode;
  const currentTag = current.tagName.toLowerCase();
  const nextTag = getReplacementTag(currentTag);
  const replacement = document.createElement(nextTag);

  for (const name of current.getAttributeNames()) {
    if (name.startsWith("data-lab-")) continue;
    replacement.setAttribute(name, current.getAttribute(name) ?? "");
  }

  while (current.firstChild) {
    replacement.append(current.firstChild);
  }

  current.replaceWith(replacement);

  if (current === state.testRoot) {
    withInternalMutation(() => {
      decorateTestRoot(replacement);
      state.testRoot = replacement;
    });
  }

  setSelectedNode(replacement);
  setStatus(`<${currentTag}>를 <${nextTag}>로 바꿨습니다. 다음 Diff에서 REPLACE가 생성됩니다.`);
  scheduleRefresh();
}

function handleDeleteNode() {
  if (!state.selectedNode || state.selectedNode === state.testRoot) {
    setStatus("루트 노드는 삭제하지 않도록 막아두었습니다. 대신 태그를 교체하거나 자식을 조정해 보세요.");
    return;
  }

  const current = state.selectedNode;
  const parent = current.parentElement;
  const tagName = current.tagName.toLowerCase();
  current.remove();

  setSelectedNode(parent || state.testRoot);
  setStatus(`<${tagName}>를 삭제했습니다. 다음 Patch에서 REMOVE가 생성됩니다.`);
  scheduleRefresh();
}

function handleApplySource() {
  const applied = applySourceToTestHost();
  if (!applied) return;

  state.sourceDirty = false;
  syncDerivedState();
  renderAll();
  setStatus("HTML 코드 편집 내용으로 테스트 영역을 다시 렌더링했습니다.");
  playPipeline(["read", "diff"]);
}

function getReplacementTag(tagName) {
  const map = {
    article: "section",
    section: "aside",
    aside: "section",
    p: "h4",
    h3: "p",
    h4: "p",
    ul: "ol",
    ol: "ul",
    li: "p",
    button: "a",
    a: "button",
    span: "strong",
    strong: "span",
    div: "section",
    footer: "section",
  };
  return map[tagName] || "section";
}

function analyzePaintImpact(patches) {
  if (!patches.length) return "idle";
  if (
    patches.some(
      (patch) =>
        patch.type === PATCH_TYPES.CREATE ||
        patch.type === PATCH_TYPES.REMOVE ||
        patch.type === PATCH_TYPES.REPLACE
    )
  ) {
    return "high";
  }
  if (
    patches.some(
      (patch) =>
        patch.type === PATCH_TYPES.UPDATE_TEXT ||
        (patch.type === PATCH_TYPES.UPDATE_PROP &&
          (patch.key === "class" ||
            patch.key === "className" ||
            patch.key === "style"))
    )
  ) {
    return "medium";
  }
  return "low";
}

function describeImpact(level) {
  if (level === "high") {
    return { shortLabel: "Reflow 가능성 높음" };
  }
  if (level === "medium") {
    return { shortLabel: "Layout 체크 필요" };
  }
  if (level === "low") {
    return { shortLabel: "속성 중심" };
  }
  return { shortLabel: "대기 중" };
}

function renderEventItem(title, detail) {
  const item = document.createElement("li");
  item.className = "event-item";

  const strong = document.createElement("strong");
  strong.textContent = title;

  const content = document.createElement("div");
  content.className = "history-meta";
  content.textContent = detail;

  item.append(strong, content);
  return item;
}

function createEmptyItem(message) {
  const item = document.createElement("li");
  item.className = "event-item";
  const paragraph = document.createElement("p");
  paragraph.className = "event-empty";
  paragraph.textContent = message;
  item.append(paragraph);
  return item;
}

function countNodes(vnode) {
  if (!vnode) return 0;
  if (vnode.nodeType === VNODE_TYPES.TEXT) return 1;
  return 1 + (vnode.children || []).reduce((sum, child) => sum + countNodes(child), 0);
}

function describePatch(patch) {
  if (patch.type === PATCH_TYPES.CREATE) {
    return `parent path ${formatPath(patch.path)} 아래에 ${describeVNode(patch.node)} 생성`;
  }
  if (patch.type === PATCH_TYPES.REMOVE) {
    return `path ${formatPath(patch.path)} 노드 제거`;
  }
  if (patch.type === PATCH_TYPES.REPLACE) {
    return `path ${formatPath(patch.path)} 노드를 ${describeVNode(patch.newNode)}로 교체`;
  }
  if (patch.type === PATCH_TYPES.UPDATE_TEXT) {
    return `path ${formatPath(patch.path)} 텍스트를 ${JSON.stringify(truncate(patch.newValue, 48))}로 변경`;
  }
  return `path ${formatPath(patch.path)} 속성 변경: ${describeAttrPatch(patch)}`;
}

function describeAttrPatch(patch) {
  if (patch.type !== PATCH_TYPES.UPDATE_PROP) return "none";
  if (patch.newValue == null) {
    return `${patch.key} removed`;
  }
  return `${patch.key}="${patch.newValue}"`;
}

function formatPath(path) {
  return path || "root";
}

function makeHistoryEntry(stateName, summary, vnode, patches, patchSummary) {
  return {
    stateName,
    summary,
    vnode: cloneVNode(vnode),
    patchSummary:
      patchSummary ||
      (patches.length
        ? `${patches.map((patch) => patch.type).join(", ")}`
        : "변경 없음"),
  };
}

function setStatus(message) {
  return message;
}

function getChangedTreePaths(patches) {
  return patches.map((patch) => {
    return parsePatchPath(patch.path);
  });
}

function serializeTreePath(path) {
  return path.join(".");
}

function logMutation(entry) {
  state.mutationLog = [entry, ...state.mutationLog].slice(0, 10);
}

function withInternalMutation(fn) {
  state.internalMutationDepth += 1;
  try {
    fn();
  } finally {
    state.internalMutationDepth = Math.max(0, state.internalMutationDepth - 1);
  }
}

function isInternalMutation() {
  return state.internalMutationDepth > 0;
}

function clearPatchMarks() {
  window.clearTimeout(state.highlightTimer);
  refs.actualHost.querySelectorAll("[data-lab-patched]").forEach((node) => {
    node.removeAttribute("data-lab-patched");
  });
}

function markPatchedNodes(nodes) {
  nodes.forEach((node) => node.setAttribute("data-lab-patched", "true"));
  state.highlightTimer = window.setTimeout(() => {
    clearPatchMarks();
  }, 1500);
}

function playPipeline(stages) {
  state.pipelineTimers.forEach((timer) => window.clearTimeout(timer));
  state.pipelineTimers = [];
  document.querySelectorAll("[data-stage-card]").forEach((card) => card.classList.remove("is-active"));

  stages.forEach((stage, index) => {
    const timer = window.setTimeout(() => {
      const card = document.querySelector(`[data-stage-card="${stage}"]`);
      if (!card) return;
      document.querySelectorAll("[data-stage-card]").forEach((item) => item.classList.remove("is-active"));
      card.classList.add("is-active");
    }, index * 220);
    state.pipelineTimers.push(timer);
  });
}

function truncate(text, maxLength) {
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function runDemoScenario() {
  if (!state.testRoot) return null;

  const header = state.testRoot.children[0];
  const summary = state.testRoot.children[1];
  if (!header || !summary) return null;

  setSelectedNode(summary);
  handleAddChild();

  setSelectedNode(header);
  handleReplaceTag();

  return {
    pointer: state.pointer,
    historyLength: state.history.length,
    stagedPatchTypes: state.stagedPatches.map((patch) => patch.type),
    selection: state.selectedNode ? state.selectedNode.tagName.toLowerCase() : null,
  };
}

function exposeDebugHelpers() {
  window.__VDOM_LAB__ = {
    snapshot: () => ({
      pointer: state.pointer,
      historyLength: state.history.length,
      stagedPatchTypes: state.stagedPatches.map((patch) => patch.type),
      stagedPatchDetails: state.stagedPatches.map((patch) => ({
        type: patch.type,
        path: patch.path,
        index: null,
        node: patch.node?.type || patch.newNode?.type || patch.node?.nodeType || null,
      })),
      domOpApis: state.lastDomOps.map((operation) => operation.api),
      domOpDetails: state.lastDomOps.map((operation) => operation.detail),
      actualText: refs.actualHost.textContent.trim().replace(/\s+/g, " "),
      testText: refs.testHost.textContent.trim().replace(/\s+/g, " "),
      selection: state.selectedNode ? state.selectedNode.tagName.toLowerCase() : null,
    }),
    patch: handlePatch,
    undo: () => jumpToHistory(state.pointer - 1),
    redo: () => jumpToHistory(state.pointer + 1),
    reset: handleReset,
    runScenario: runDemoScenario,
  };
}

function describeVNode(vnode) {
  if (!vnode) return "<null>";
  if (vnode.nodeType === VNODE_TYPES.TEXT) return "<text>";
  return `<${vnode.type}>`;
}

function parsePatchPath(path) {
  if (!path || path === "root") return [];
  return [...path.matchAll(/children\[(\d+)\]/g)].map((match) => Number(match[1]));
}

function getNodeByPathSafe(rootNode, path) {
  if (!rootNode || !path) return null;

  try {
    return getNodeByPath(rootNode, path);
  } catch {
    return null;
  }
}

function pushTouchedNode(touchedNodes, node) {
  const targetNode = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;

  if (!targetNode || touchedNodes.includes(targetNode)) return;
  touchedNodes.push(targetNode);
}

function applyPatchesWithLog(rootNode, patches, container) {
  let nextRoot = rootNode;
  const operations = [];
  const touchedNodes = [];

  patches.forEach((patch) => {
    if (patch.type === PATCH_TYPES.CREATE) {
      const parentBefore = patch.path === "root" ? container : getNodeByPathSafe(nextRoot, patch.path);
      operations.push({
        api: "appendChild",
        detail: `path ${formatPath(patch.path)} 아래에 ${describeVNode(patch.node)}를 생성했습니다.`,
      });
      nextRoot = applyPatch(nextRoot, patch, container);
      if (patch.path === "root") {
        pushTouchedNode(touchedNodes, nextRoot);
      } else {
        pushTouchedNode(touchedNodes, parentBefore?.lastChild || parentBefore);
      }
      return;
    }

    if (patch.type === PATCH_TYPES.REMOVE) {
      const targetBefore = getNodeByPathSafe(nextRoot, patch.path);
      operations.push({
        api: "removeChild",
        detail: `path ${formatPath(patch.path)}의 노드를 제거했습니다.`,
      });
      pushTouchedNode(touchedNodes, targetBefore?.parentNode);
      nextRoot = applyPatch(nextRoot, patch, container);
      return;
    }

    if (patch.type === PATCH_TYPES.REPLACE) {
      const targetBefore = getNodeByPathSafe(nextRoot, patch.path);
      operations.push({
        api: "replaceChild",
        detail: `path ${formatPath(patch.path)}의 노드를 ${describeVNode(patch.newNode)}로 교체했습니다.`,
      });
      nextRoot = applyPatch(nextRoot, patch, container);
      if (patch.path === "root") {
        pushTouchedNode(touchedNodes, nextRoot);
      } else {
        const targetAfter = getNodeByPathSafe(nextRoot, patch.path);
        pushTouchedNode(touchedNodes, targetAfter || targetBefore?.parentNode);
      }
      return;
    }

    if (patch.type === PATCH_TYPES.UPDATE_TEXT) {
      const targetBefore = getNodeByPathSafe(nextRoot, patch.path);
      operations.push({
        api: "nodeValue",
        detail: `path ${formatPath(patch.path)}의 텍스트를 ${JSON.stringify(
          truncate(patch.newValue, 48)
        )}로 변경했습니다.`,
      });
      nextRoot = applyPatch(nextRoot, patch, container);
      pushTouchedNode(touchedNodes, targetBefore);
      return;
    }

    if (patch.type === PATCH_TYPES.UPDATE_PROP) {
      const targetBefore = getNodeByPathSafe(nextRoot, patch.path);
      operations.push({
        api: patch.newValue == null ? "removeAttribute" : "setAttribute",
        detail:
          patch.newValue == null
            ? `path ${formatPath(patch.path)}에서 ${patch.key} 속성을 제거했습니다.`
            : `path ${formatPath(patch.path)}의 ${patch.key} 속성을 ${JSON.stringify(
                patch.newValue
              )}로 설정했습니다.`,
      });
      nextRoot = applyPatch(nextRoot, patch, container);
      pushTouchedNode(touchedNodes, targetBefore);
    }
  });

  return {
    root: nextRoot,
    operations,
    touchedNodes,
  };
}

function serializeCurrentTestHtml() {
  if (!state.testRoot) return "";

  const currentVNode = sanitizeVNode(domToVNode(state.testRoot));
  if (!currentVNode) return "";

  const html = createRealNode(cloneVNode(currentVNode)).outerHTML;
  return html;
}

function previewSourceInput() {
  const applied = applySourceToTestHost();

  if (!applied) {
    return;
  }

  syncDerivedState();
  renderAll();
  setStatus("HTML 코드 편집 내용이 테스트 영역에 미리 반영되었습니다. Patch를 누르면 실제 영역에 적용됩니다.");
  playPipeline(["read", "diff"]);
}

function applySourceToTestHost() {
  const source = refs.htmlSource.value.trim();

  if (!source) {
    return false;
  }

  const template = document.createElement("template");
  template.innerHTML = source;

  const rootElements = [...template.content.children];

  if (rootElements.length !== 1) {
    setStatus("HTML 코드 편집은 루트 요소 1개만 허용합니다.");
    return false;
  }

  const nextRoot = rootElements[0];

  withInternalMutation(() => {
    refs.testHost.replaceChildren();
    decorateTestRoot(nextRoot);
    refs.testHost.append(nextRoot);
    state.testRoot = nextRoot;
  });

  clearSelectedNode();
  return true;
}



