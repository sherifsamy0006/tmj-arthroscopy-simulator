// r59 workspace: page tabs, the simulator deck (lens left, position map right) and a tabbed
// dock below it. The same canvases and controls move between the simulator and the manual
// controls tab, so both show one lens and one locator.
const workspace = document.querySelector('#workspace');
const deck = document.querySelector('#split-deck');
const layout = document.querySelector('#workspace-layout');
const slots = [
  ['.scope .scope-circle', '#split-lens'],
  ['#motion-status', '#lens-status'],
  ['.anatomy .map-wrap', '#split-map'],
  ['.procedure-actions', '#dock-actions'],
  ['#procedure-steps', '#dock-procedure'],
  ['.procedure-text', '#dock-procedure'],
  ['.fluid-bar', '#dock-fluid'],
  ['.roof-visibility', '#split-map-options'],
  ['.guide-visibility', '#split-map-options'],
  ['.names-visibility', '#split-map-options'],
  ['.rim-visibility', '#split-map-options'],
  ['.map-tools', '#split-map-options'],
  ['#anatomy-key', '#split-map-key']
].map(([selector, destination]) => {
  const element = workspace.querySelector(selector);
  const marker = document.createComment(selector);
  element.before(marker);
  return { element, marker, destination: deck.querySelector(destination) };
});

function showLayout() {
  const split = layout.value === 'split';
  const locator = document.querySelector('#locator-mode');
  if (split && locator.value !== '3d') {
    locator.value = '3d';
    locator.dispatchEvent(new Event('change'));
  }
  // The simulator has no drag-mode buttons: drag steers, the wheel moves in and out.
  const drag = document.querySelector('#scope-drag');
  if (split && drag.value !== 'aim') {
    drag.value = 'aim';
    drag.dispatchEvent(new Event('change'));
  }
  for (const { element, marker, destination } of slots) {
    if (split) destination.append(element);
    else marker.after(element);
  }
  deck.hidden = !split;
  workspace.classList.toggle('split', split);
  document.body.classList.toggle('split-layout', split);
}

const tabs = [...document.querySelectorAll('[data-tab]')];
function showTab(name) {
  document.body.dataset.tab = name;
  for (const tab of tabs) tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
  if (name === 'simulator' || name === 'controls') {
    layout.value = name === 'controls' ? 'full' : 'split';
    showLayout();
  }
  window.scrollTo(0, 0);
}
for (const tab of tabs) tab.addEventListener('click', () => showTab(tab.dataset.tab));

const dockTabs = [...document.querySelectorAll('[data-dock]')];
function showDock(name) {
  for (const tab of dockTabs) tab.setAttribute('aria-selected', String(tab.dataset.dock === name));
  for (const panel of document.querySelectorAll('[data-dock-panel]')) panel.hidden = panel.dataset.dockPanel !== name;
}
for (const tab of dockTabs) tab.addEventListener('click', () => showDock(tab.dataset.dock));

layout.addEventListener('change', showLayout);
showTab('simulator');
showDock('procedure');
