async (page) => {
  await page.evaluate(() => {
    const today = "2026-04-22";
    const now = new Date().toISOString();
    const state = {
      user: { id: "u1", name: "H", email: "h@example.com", bio: "" },
      page: "planner",
      timerState: "idle",
      timerSeconds: 0,
      subjects: [
        { id: "s1", name: "數學", color: "#4a7c74" },
        { id: "s2", name: "英文", color: "#7c6a4a" },
      ],
      decks: [
        {
          id: "d1",
          title: "英文單字",
          description: "",
          subjectId: "s2",
          defaultFrontLang: "zh",
          defaultBackLang: "zh",
          createdAt: now,
          updatedAt: now,
          cards: [
            {
              id: "card1",
              deckId: "d1",
              front: "ancestral",
              back: "祖先的、祖傳的",
              frontLang: "zh",
              backLang: "zh",
              masteryStatus: "new",
              starred: false,
              order: 0,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      ],
      cards: [],
      notes: [],
      tasks: [
        {
          id: "t1",
          title: "複習微積分第三章",
          subjectId: "s1",
          scheduledDate: today,
          dueDate: "2026-04-25",
          priority: "high",
          completedSessions: 0,
          completed: false,
          createdAt: today,
        },
        {
          id: "t2",
          title: "背單字 Unit 5-6",
          subjectId: "s2",
          scheduledDate: today,
          priority: "medium",
          completedSessions: 0,
          completed: false,
          createdAt: today,
        },
      ],
      sessions: [],
      countdowns: [{ id: "cd1", title: "英文期末考", date: "2026-04-25", subjectId: "s2" }],
      groups: [],
      studyBlocks: [
        { id: "sb1", title: "英文單字", date: today, startTime: "14:00", durationMinutes: 60, subjectId: "s2", createdAt: today },
        { id: "sb2", title: "數學複習", date: today, startTime: "19:00", durationMinutes: 60, subjectId: "s1", createdAt: today },
      ],
      milestones: [],
      interruptionLogs: [],
      allowlist: [],
      restrictionProfiles: [],
      managedFocusActive: false,
      fullscreenActive: false,
      cycleActive: false,
      cycleRunning: false,
      cyclePhase: "focus",
      cycleCount: 0,
      cycleSecondsLeft: 0,
      cycleTodayCount: 0,
      settings: {
        lang: "zh",
        accent: "#4a7c74",
        dailyGoalMinutes: 120,
        dailyReviewTarget: 10,
        sessionReflection: true,
        density: "comfortable",
        showWeeklyGoal: false,
        managedFocusEnabled: false,
        platformCapability: "web_only",
      },
    };
    localStorage.setItem("ypt_app_state_v6", JSON.stringify(state));
    localStorage.removeItem("ypt_v23_upgrade_v1");
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "月" }).click();
  await page.waitForTimeout(500);

  const planner = await page.evaluate(() => {
    const nav = [...document.querySelectorAll(".lerna-mobile-bottomnav button")]
      .map((b) => b.textContent.trim())
      .filter(Boolean);
    const cards = [...document.querySelectorAll(".lerna-plan-month-card")];
    const card22 = cards.find((el) => /^22\b/.test(el.textContent.trim()));
    return {
      title: document.title,
      nav,
      card22: card22 ? card22.innerText : "",
      hiddenMonthBadges: card22
        ? [...card22.querySelectorAll(".lerna-month-mobile-hide")].filter((el) => getComputedStyle(el).display === "none").length
        : -1,
      monthCardCount: cards.length,
    };
  });

  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("ypt_app_state_v6"));
    state.page = "learn";
    localStorage.setItem("ypt_app_state_v6", JSON.stringify(state));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /建立字卡組/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /英文單字/ }).first().click();
  await page.waitForTimeout(500);
  const learn = await page.evaluate(() => ({
    title: document.title,
    pronounceButtons: [...document.querySelectorAll("[aria-label*=朗讀], [aria-label*=Pronounce]")]
      .map((b) => b.getAttribute("aria-label")),
  }));

  await page.evaluate(() => {
    localStorage.setItem("ypt_v23_upgrade_v1", JSON.stringify({
      avatar: { kind: "image", value: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", bg: "#112233" },
    }));
    const state = JSON.parse(localStorage.getItem("ypt_app_state_v6"));
    delete state.settings.avatarKind;
    delete state.settings.avatarValue;
    delete state.settings.avatarBg;
    localStorage.setItem("ypt_app_state_v6", JSON.stringify(state));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  const avatar = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("ypt_v23_upgrade_v1"));
    return {
      storedKind: stored.avatar && stored.avatar.kind,
      overlayImages: document.querySelectorAll(".ypt-v23-avatar-overlay img").length,
    };
  });

  return { planner, learn, avatar };
}
