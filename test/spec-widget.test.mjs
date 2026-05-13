import assert from "node:assert/strict";
import test from "node:test";
import { renderSpecWidgetLines, specFooterStatus, specWidgetVisibleWidth } from "../extensions/widgets/spec-widget.ts";

const theme = {
  fg: (_color, text) => text,
  bg: (_color, text) => text,
  bold: (text) => text,
};

const CREATED_TS = Date.UTC(2026, 4, 13); // 2026-05-13
const NOW_TS = Date.UTC(2026, 4, 13, 12, 30, 45); // 12h 30m 45s later

function record(overrides = {}) {
  return {
    id: "2026-05-13-specs-footer-widget",
    title: "Specs footer widget",
    status: "draft",
    focused: true,
    path: "specs/2026-05-13-specs-footer-widget",
    artifacts: {
      product: true,
      tech: true,
      milestones: true,
      researchReports: 1,
    },
    lastAudit: null,
    latestMilestones: [
      { date: "2026-05-13 18:04:02", summary: "Implemented the specs footer/widget UI" },
      { date: "2026-05-13 17:45:05", summary: "Completed initial research and spec drafting" },
      { date: "2026-05-13 17:34:11", summary: "Started the specs footer widget feature" },
    ],
    milestonesTotal: 4,
    createdTimestamp: CREATED_TS,
    ...overrides,
  };
}

test("focused draft spec renders heading with status and dynamic elapsed time", () => {
  const lines = renderSpecWidgetLines(record(), theme, 96, { specCount: 2, now: NOW_TS });

  assert.match(lines[0], /^◆ Spec 2026-05-13-specs-footer-widget · draft/);
  assert.match(lines[0], /0DAY 12:30:45/);
  assert.match(lines[1], /^├─ 2026-05-13 18:04:02/);
  assert.match(lines[1], /Implemented the specs footer\/widget UI/);
  assert.match(lines[2], /^├─ 2026-05-13 17:45:05/);
  assert.match(lines[3], /^└─ 2026-05-13 17:34:11/);
});

test("elapsed time increments across day boundary", () => {
  const dayLater = CREATED_TS + 86401 * 1000; // 1 day + 1 second
  const lines = renderSpecWidgetLines(record(), theme, 96, { specCount: 1, now: dayLater });
  assert.match(lines[0], /1DAY 00:00:01/);
});

test("completed spec uses checkmark icon", () => {
  const spec = record({
    status: "completed",
    artifacts: { product: true, tech: false, milestones: true, researchReports: 3 },
    latestMilestones: [
      { date: "2026-05-13 20:11:00", summary: "Refactored to compact layout" },
      { date: "2026-05-13 18:04:02", summary: "Implemented footer/widget UI" },
    ],
    milestonesTotal: 5,
  });
  const lines = renderSpecWidgetLines(spec, theme, 96, { specCount: 1, now: NOW_TS });

  assert.match(lines[0], /^✓ Spec 2026-05-13-specs-footer-widget · completed/);
  assert.match(lines[0], /0DAY 12:30:45/);
  assert.match(lines[1], /^├─ 2026-05-13 20:11:00/);
  assert.match(lines.at(-1) ?? "", /^└─ 2026-05-13 18:04:02/);
  assert.equal(specFooterStatus(spec, { specCount: 1 }), "specs: 2026-05-13-specs-footer-widget · completed");
});

test("spec without milestones renders only heading with zero time", () => {
  const spec = record({ latestMilestones: [], milestonesTotal: 0 });
  const lines = renderSpecWidgetLines(spec, theme, 96, { specCount: 1, now: CREATED_TS });

  assert.equal(lines.length, 1);
  assert.match(lines[0], /^◆ Spec 2026-05-13-specs-footer-widget · draft/);
  assert.match(lines[0], /0DAY 00:00:00/);
});

test("unfocused registry renders guidance tree", () => {
  const lines = renderSpecWidgetLines(null, theme, 96, { specCount: 4 });

  assert.equal(lines.length, 2);
  assert.match(lines[0], /^◇ Specs unfocused/);
  assert.match(lines[0], /4 specs/);
  assert.match(lines[1], /^└─.*\/spec-status/);
  assert.equal(specFooterStatus(null, { specCount: 4 }), "specs: unfocused [4]");
});

test("empty registry returns no widget or footer status", () => {
  assert.deepEqual(renderSpecWidgetLines(null, theme, 96, { specCount: 0 }), []);
  assert.equal(specFooterStatus(null, { specCount: 0 }), undefined);
});

test("long content is width safe", () => {
  const lines = renderSpecWidgetLines(record({
    id: "2026-05-13-a-very-long-spec-id-that-should-be-truncated-instead-of-overflowing",
    latestMilestones: [
      { date: "2026-05-13 18:04:02", summary: "A very long milestone summary that should be truncated instead of overflowing the terminal widget width" },
    ],
  }), theme, 40, { specCount: 8, now: NOW_TS });

  assert.ok(lines.length > 0);
  for (const line of lines) {
    assert.ok(specWidgetVisibleWidth(line) <= 40, `${specWidgetVisibleWidth(line)} > 40: ${line}`);
  }
});
