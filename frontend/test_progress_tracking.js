// test_progress_tracking.js
// Tests progress tracking logic, localStorage persistence, and page reload behavior.

class MockLocalStorage {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

const mockStorage = new MockLocalStorage();
global.localStorage = mockStorage;

// Simulation helper matching App.jsx logic
function simulateRoadmapProgress(roadmap) {
  const allMilestones = roadmap.milestones || [];
  const allTasks = allMilestones.flatMap((m) =>
    Array.isArray(m.tasks) ? m.tasks : typeof m.tasks === 'string' ? [m.tasks] : []
  );

  const getCheckedTasks = () => {
    const checked = {};
    allTasks.forEach((t) => {
      const isChecked =
        mockStorage.getItem(`roadmap_${roadmap.id}_task_${t}`) === 'true' ||
        mockStorage.getItem(`roadmap_${roadmap.id}_${t}`) === 'true';
      if (isChecked) checked[t] = true;
    });
    return checked;
  };

  const toggleTask = (taskText) => {
    const keyWithTask = `roadmap_${roadmap.id}_task_${taskText}`;
    const keySimple = `roadmap_${roadmap.id}_${taskText}`;
    const isCurrentlyChecked = mockStorage.getItem(keyWithTask) === 'true';
    if (!isCurrentlyChecked) {
      mockStorage.setItem(keyWithTask, 'true');
      mockStorage.setItem(keySimple, 'true');
    } else {
      mockStorage.removeItem(keyWithTask);
      mockStorage.removeItem(keySimple);
    }
  };

  const getProgressStats = () => {
    const checked = getCheckedTasks();
    const total = allTasks.length;
    const completed = allTasks.filter((t) => Boolean(checked[t])).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      completed,
      total,
      percentage,
      displayText: `${completed} of ${total} tasks complete`,
      percentText: `${percentage}%`,
    };
  };

  return {
    allTasks,
    getCheckedTasks,
    toggleTask,
    getProgressStats,
  };
}

async function runTests() {
  console.log('--- Test 1: Freshly Generated Roadmap (ID 7) ---');
  const freshRoadmap = {
    id: 7,
    original_idea: 'A smart plant watering reminder bot for Telegram',
    milestones: [
      { week: 1, goal: 'Scaffold project', tasks: ['Setup Node.js repo', 'Create Telegram Bot token', 'Configure webhook'] },
      { week: 2, goal: 'Sensor integration', tasks: ['Read soil moisture data', 'Calculate threshold alerts', 'Format Telegram notification'] },
    ],
  };

  // Persist active roadmap as App.jsx does
  mockStorage.setItem('ideaforge_active_roadmap_id', String(freshRoadmap.id));
  mockStorage.setItem('ideaforge_active_roadmap', JSON.stringify(freshRoadmap));
  mockStorage.setItem('ideaforge_active_view', 'generator');

  let sim = simulateRoadmapProgress(freshRoadmap);
  console.log('Initial stats:', sim.getProgressStats().displayText, sim.getProgressStats().percentText);
  if (sim.getProgressStats().completed !== 0 || sim.getProgressStats().total !== 6) {
    throw new Error('Initial task count failed');
  }

  // Check 2 tasks
  sim.toggleTask('Setup Node.js repo');
  sim.toggleTask('Create Telegram Bot token');

  let statsAfterCheck = sim.getProgressStats();
  console.log('Stats after checking 2 tasks:', statsAfterCheck.displayText, statsAfterCheck.percentText);
  if (statsAfterCheck.completed !== 2 || statsAfterCheck.percentage !== 33) {
    throw new Error(`Expected 2 of 6 (33%), got ${statsAfterCheck.displayText} (${statsAfterCheck.percentText})`);
  }

  // Verify localStorage keys
  const expectedKey1 = `roadmap_7_task_Setup Node.js repo`;
  if (mockStorage.getItem(expectedKey1) !== 'true') {
    throw new Error(`Expected localStorage key ${expectedKey1} to be 'true'`);
  }
  console.log('Verified localStorage key:', expectedKey1, '=', mockStorage.getItem(expectedKey1));

  console.log('\n--- Test 2: Simulate Page Reload ---');
  // Re-read active roadmap from localStorage (simulating page reload in App.jsx useEffect)
  const restoredId = mockStorage.getItem('ideaforge_active_roadmap_id');
  const restoredRoadmap = JSON.parse(mockStorage.getItem('ideaforge_active_roadmap'));
  if (restoredId !== '7' || !restoredRoadmap) {
    throw new Error('Failed to restore active roadmap on reload');
  }

  let reloadedSim = simulateRoadmapProgress(restoredRoadmap);
  let reloadedStats = reloadedSim.getProgressStats();
  console.log('Reloaded stats:', reloadedStats.displayText, reloadedStats.percentText);
  if (reloadedStats.completed !== 2 || reloadedStats.percentage !== 33) {
    throw new Error('Progress stats did not persist across reload');
  }
  console.log('Checkmarks and progress successfully persisted across reload!');

  console.log('\n--- Test 3: Reopened from History (Roadmap ID 4) ---');
  const historyRoadmap = {
    id: 4,
    original_idea: 'Study group finder',
    milestones: [
      { week: 1, goal: 'Setup', tasks: ['Task A', 'Task B', 'Task C', 'Task D'] },
      { week: 2, goal: 'Auth', tasks: ['Task E', 'Task F', 'Task G', 'Task H'] },
    ],
  };

  mockStorage.setItem('ideaforge_active_roadmap_id', String(historyRoadmap.id));
  mockStorage.setItem('ideaforge_active_roadmap', JSON.stringify(historyRoadmap));
  mockStorage.setItem('ideaforge_active_view', 'saved_roadmap');

  let historySim = simulateRoadmapProgress(historyRoadmap);
  console.log('History roadmap initial stats:', historySim.getProgressStats().displayText);
  if (historySim.getProgressStats().completed !== 0 || historySim.getProgressStats().total !== 8) {
    throw new Error('History roadmap initial count incorrect');
  }

  // Check 4 tasks in history roadmap
  historySim.toggleTask('Task A');
  historySim.toggleTask('Task B');
  historySim.toggleTask('Task C');
  historySim.toggleTask('Task D');

  let historyStats = historySim.getProgressStats();
  console.log('History stats after 4 tasks:', historyStats.displayText, historyStats.percentText);
  if (historyStats.completed !== 4 || historyStats.percentage !== 50) {
    throw new Error(`Expected 4 of 8 (50%), got ${historyStats.displayText} (${historyStats.percentText})`);
  }

  // Reload history roadmap page
  const reloadedHistoryRoadmap = JSON.parse(mockStorage.getItem('ideaforge_active_roadmap'));
  let reloadedHistorySim = simulateRoadmapProgress(reloadedHistoryRoadmap);
  let reloadedHistoryStats = reloadedHistorySim.getProgressStats();
  console.log('Reloaded history stats:', reloadedHistoryStats.displayText, reloadedHistoryStats.percentText);
  if (reloadedHistoryStats.completed !== 4 || reloadedHistoryStats.percentage !== 50) {
    throw new Error('History roadmap progress failed to persist across reload');
  }

  // Verify roadmap 7 progress was not affected by roadmap 4
  let checkRoadmap7Again = simulateRoadmapProgress(freshRoadmap).getProgressStats();
  console.log('Roadmap 7 isolated check:', checkRoadmap7Again.displayText, checkRoadmap7Again.percentText);
  if (checkRoadmap7Again.completed !== 2) {
    throw new Error('Progress isolation between roadmaps failed');
  }

  console.log('\nALL PROGRESS TRACKING & PERSISTENCE TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
