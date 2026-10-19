/*
 * Pre-Flow Check — all UI copy, one object per language.
 * Keys are looked up with PFC.t('dot.path', { vars }). Arrays are allowed.
 * Copy is deliberately short: one idea per screen, a few words per line.
 * Card titles stay bilingual in both languages (part of the card design).
 */
(function (root) {
  'use strict';

  const STRINGS = {
    'zh-TW': {
      appName: 'Pre-Flow Check · 心流羅盤',
      appShort: '心流羅盤',
      htmlLang: 'zh-Hant-TW',
      disclaimer: '本工具僅供個人自我觀察，非醫療或診斷用途。',
      langToggle: 'EN',
      langToggleLabel: 'Switch to English',
      storageWarning: '無法存取瀏覽器儲存空間，資料不會被保存。記得匯出備份。',
      next: '下一步',
      back: '返回',
      close: '關閉',
      skip: '略過',
      cancel: '取消',
      save: '儲存',
      today: '今天',
      yesterday: '昨天',
      minutes: '{m} 分鐘',
      device: { touch: '觸控', keyboard: '鍵盤', mouse: '滑鼠' },

      nav: { home: '首頁', history: '歷史', log: '記錄心流', settings: '設定與資料' },

      welcome: {
        slides: [
          { t: '開工前，先看看自己', s: '只要 4 分鐘' },
          { t: '3 個感覺 + 1 個反應', s: '點一點，玩一下' },
          { t: '抽三張牌', s: '拿到今日指引' }
        ],
        start: '開始',
        label: '導覽'
      },

      homeView: {
        ask: '準備好了嗎？',
        start: '開始今日測量',
        baselineBuilding: '基線建立中 {n} / {total}',
        baselineReady: '基線已建立',
        last: '上次 {index}',
        reminder: '上次還沒記錄心流',
        timerRunning: '專注中 · {time}',
        timerDone: '專注結束 · 記錄一下'
      },

      step: {
        label: '第 {n} 步 / 共 {total} 步',
        kssQ: '現在有多想睡？',
        kss: {
          1: '極度清醒',
          3: '清醒',
          5: '既不清醒也不想睡',
          7: '想睡，但不費力就能保持清醒',
          9: '非常想睡，需要努力對抗睡意'
        },
        energyQ: '我現在的精神/能量是幾分？',
        tensionQ: '我現在的緊張、煩躁或焦慮是幾分？',
        low: '很低',
        high: '很高',
        ctxTitle: '今天的狀態',
        ctxHint: '都可以略過',
        sleep: '昨晚睡了',
        hoursUnit: '小時',
        task: '接下來做什麼？',
        more: '更多',
        wake: '起床時間',
        awake: '已清醒 {h} 小時',
        caffeine: '咖啡因',
        cupsUnit: '杯',
        lastCup: '最後一杯',
        hrv: 'HRV（ms）',
        rhr: '靜止心率',
        readiness: '裝置準備度',
        outOfRange: '超出範圍',
        decrease: '減少',
        increase: '增加',
        pvtTitle: '看到黃點，立刻點',
        pvtSub: '3 分鐘 · 點任何地方，或按空白鍵',
        pvtNote: '太早按算搶先 · 別切換 App',
        pvtStart: '開始',
        fast: '測試模式：{s} 秒'
      },

      task: { deep: '深度思考', creative: '創作', learning: '學習', admin: '行政雜務', other: '其他' },

      pvt: {
        tooEarly: '太早了！',
        noResponse: '沒反應，繼續…',
        progress: '測驗進度',
        surfaceLabel: '反應測驗：看到黃點就點擊或按空白鍵',
        interruptedTitle: '測驗中斷了',
        interruptedBody: '離開畫面會讓計時不準。',
        retest: '重測',
        skip: '只用感覺評分',
        saving: '洗牌中…'
      },

      result: {
        prompt: '深呼吸，依序點開三張牌',
        cardBack: '第 {n} 張牌，點擊翻開',
        cardLocked: '第 {n} 張牌（先翻前一張）',
        titleAria: '今日三張牌',
        energyTension: '能量 {e} · 緊張 {t}',
        slower: '反應速度比你平常慢 {p}%',
        faster: '反應速度比你平常快 {p}%',
        same: '反應速度和你平常差不多',
        lapsesLine: '失誤 {n} 次 · 平常約 {m}',
        provisional: '暫定，基線建立中',
        provisionalHint: '再 {k} 次{device}測量就準了',
        invalidPvt: '反應測驗無效，只看感覺',
        breatheBtn: '先呼吸 2 分鐘',
        details: '詳細數據',
        rtChart: '反應時間',
        rtChartDesc: '355 ms 右側為失誤',
        lapseZone: '失誤 ≥355',
        count: '{n} 次',
        metric: '項目',
        todayCol: '今天',
        baselineCol: '平常',
        diffCol: '差異',
        afterBaseline: '基線後顯示',
        better: '較好',
        worse: '較差',
        similar: '持平',
        focusTimer: '開始專注計時',
        logFlow: '記錄心流',
        backHistory: '回到歷史',
        backHome: '回首頁',
        pvtSummary: '有效 {n} 次 · 搶先 {f} 次',
        weightsUsed: '計入指數'
      },

      archetype: {
        calmFire: { zh: '平靜之火', en: 'THE CALM FIRE', tag: '最適合心流', desc: '有精神，不慌張。' },
        storm: { zh: '風暴', en: 'THE STORM', tag: '有力量，但容易分心', desc: '能量足，先讓心慢下來。' },
        stillLake: { zh: '靜湖', en: 'THE STILL LAKE', tag: '放鬆，但有點遲緩', desc: '心很靜，引擎還沒熱。' },
        fog: { zh: '迷霧', en: 'THE FOG', tag: '疲倦又煩躁', desc: '先照顧好自己。' }
      },

      cards: {
        readiness: { zh: '準備指數', en: 'READINESS' },
        guidance: { zh: '今日指引', en: "TODAY'S GUIDANCE" }
      },

      rec: {
        deep: {
          main: '適合挑戰最困難的深度工作，現在就開始，記得關閉通知。',
          actions: ['最難的先做', '關通知', '寫下一個目標']
        },
        breathe: {
          main: '狀態好但緊繃。先慢呼吸 2 分鐘（吸 4 秒、吐 6 秒）。',
          actions: ['呼吸 2 分鐘', '寫下煩心事', '再開始']
        },
        steady: {
          main: '適合中等難度任務，用 25 分鐘番茄鐘。',
          actions: ['選一件中等任務', '專注 25 · 休 5', '起身動一動']
        },
        recover: {
          main: '先別硬拚。做機械性的事，或先恢復一下。',
          actions: ['做機械性雜務', '小睡 10–20 分', '喝水、散步']
        }
      },
      note: { postLunchDip: '13–15 點的午後低谷很正常。' },

      metric: {
        speed: '反應速度（1/s）',
        medianRt: '反應時間中位數',
        fast10: '最快 10%',
        slow10: '最慢 10%',
        lapses: '失誤（≥355 ms）',
        falseStarts: '搶先',
        kss: 'KSS 嗜睡度',
        energy: '能量',
        tension: '緊張',
        sleepHours: '睡眠',
        hrv: 'HRV',
        deviceReadiness: '裝置準備度',
        hour: '測量時刻',
        index: '準備指數'
      },

      timer: {
        title: '專注中',
        pick: '專注多久？',
        finish: '結束並記錄',
        cancel: '取消計時',
        done: '時間到',
        hint: '可以切換 App，時間照算',
        ideaPlaceholder: '冒出雜念？丟進罐子',
        ideaDrop: '丟進罐子',
        ideasCount: '罐子裡 {n} 個想法',
        ideasTitle: '雜念罐',
        ideasEmpty: '還是空的',
        remove: '刪除'
      },

      breathe: {
        title: '慢呼吸',
        inhale: '吸氣',
        exhale: '吐氣',
        remaining: '剩 {t}',
        done: '好了，開始吧',
        finish: '完成',
        stop: '結束'
      },

      flow: {
        title: '記錄心流',
        session: '哪一次測量',
        sessionOption: '{when} · {index}',
        logged: '（已記錄）',
        duration: '專注了幾分鐘',
        rating: '有多投入？',
        ratingLow: '完全沒進入',
        ratingHigh: '忘了時間',
        task: '做了什麼',
        interruptions: '被打斷幾次',
        notes: '筆記',
        ideas: '罐子裡的想法',
        save: '儲存',
        saved: '已儲存',
        noSessions: '還沒有測量。',
        needRating: '選一個分數',
        overwrite: '會覆蓋上次的紀錄'
      },

      history: {
        title: '歷史',
        tabStars: '星圖',
        tabInsights: '洞察',
        tabTime: '時段',
        empty: '還沒有紀錄',
        legend: '高度 = 準備指數 · 星星越大 = 心流越高 · 空心 = 暫定',
        prev: '前一次',
        next: '後一次',
        openCards: '看這天的牌',
        flowRating: '心流 {r} / 10',
        noFlow: '未記錄心流',
        logFlow: '補記',
        ideas: '{n} 個雜念',
        chartLabel: '準備指數星圖，共 {n} 次。用左右鍵瀏覽。',
        pointLabel: '{when}，準備指數 {index}'
      },

      insights: {
        needMore: '再記錄 {k} 次心流，就能看出規律',
        title: '對你影響最大的因素',
        allTitle: '所有因素',
        caveat: '相關不等於因果。',
        method: 'Spearman 等級相關',
        r: 'r = {r}',
        n: 'n = {n}',
        strength: { negligible: '幾乎無關', weak: '弱', moderate: '中等', strong: '強' },
        up: '{metric}越高，心流越好',
        down: '{metric}越高，心流越差',
        hourUp: '越晚測量，心流越好',
        hourDown: '越早測量，心流越好',
        none: '還看不出明顯因素',
        axisNeg: '負',
        axisPos: '正'
      },

      timeOfDay: {
        title: '你的黃金時段',
        best: '「{bucket}」最好 · 平均 {mean} · n = {n}',
        needMore: '每個時段至少 2 次才比較',
        mean: '{mean}',
        bucket: {
          early: '清晨 5–9', morning: '上午 9–12', midday: '中午 12–14',
          afternoon: '下午 14–18', evening: '傍晚 18–21', night: '夜間 21–5'
        }
      },

      settings: {
        title: '設定與資料',
        language: '語言',
        data: '資料',
        count: '{n} 筆紀錄，只存在這台裝置',
        exportJson: '匯出備份',
        importJson: '匯入備份',
        exportCsv: '匯出 CSV',
        clear: '清除所有資料',
        importOk: '已匯入：新增 {added}，共 {total}',
        importErr: {
          parse: '檔案不是有效的 JSON',
          shape: '這不是心流羅盤的備份',
          version: '備份來自較新版本，請先更新'
        },
        clearConfirm1: '刪除全部紀錄？無法復原。',
        clearConfirm2: '輸入「{word}」確認',
        clearWord: '刪除',
        clearContinue: '繼續',
        clearConfirm: '永久刪除',
        clearDone: '已清除',
        baselines: '基線',
        baselineLine: '{device} {n} / {total}',
        about: '指標說明與科學依據',
        tour: '再看一次導覽',
        privacy: '資料只存在你的瀏覽器，不會上傳。',
        storageOk: '儲存正常',
        storageOff: '無法儲存'
      },

      about: {
        title: '指標說明與科學依據',
        sections: [
          {
            h: '這個工具在做什麼',
            p: [
              '開工前，用 4 分鐘測量此刻的嗜睡程度、能量、緊張與反應速度，並和「你自己的平常狀態」比較，估算你現在進入心流的準備程度。工作結束後記錄心流程度，累積夠多資料後，就能看出哪些因素真正影響你的心流。'
            ]
          },
          {
            h: 'KSS 嗜睡量表',
            p: [
              'Karolinska Sleepiness Scale（Åkerstedt & Gillberg, 1990）是 1–9 分的主觀嗜睡量表，常用於睡眠與疲勞研究。分數越高代表越想睡；在指數中會反向計分。'
            ]
          },
          {
            h: '能量與緊張',
            p: [
              '依據 Thayer 的能量—緊張情緒/喚起模型（Thayer, 1989）：「能量」與「緊張」是兩個獨立的向度。高能量、低緊張的「平靜能量」最有利於專注；高緊張會讓能量變得浮躁。',
              '能量會計入準備指數；緊張不計入指數，而是用來決定狀態原型與建議。'
            ]
          },
          {
            h: '3 分鐘反應測驗（PVT-B）',
            p: [
              '心理動作警覺測驗（Psychomotor Vigilance Test）是測量持續注意力最常用的工具之一。這裡採用 Basner、Mollicone 與 Dinges（2011）驗證的 3 分鐘版本 PVT-B：刺激間隔 2–5 秒，反應時間 ≥355 毫秒算一次「失誤」，<100 毫秒或刺激出現前就按算「搶先」。',
              '主要指標是「平均反應速度」（每次 1000 ÷ 反應時間的平均，單位 1/秒），它對疲勞相當敏感。也會記錄中位數、最快與最慢 10% 的平均、失誤與搶先次數。',
              '不同裝置（觸控、鍵盤、滑鼠）的延遲差異很大，所以反應測驗的基線會依裝置分開計算。瀏覽器的計時精度有限，數字適合拿來跟自己比較，不適合跟研究資料直接比較。'
            ]
          },
          {
            h: '準備指數怎麼算',
            p: [
              '個人基線 = 同一種裝置最近 14 次有效測量（至少 5 次才啟用）的平均與標準差；主觀評分與背景數據則不分裝置。每個指標換算成 z 分數（方向統一為越高越好），再加權平均：反應速度 35%、失誤 20%（反向）、KSS 20%（反向）、能量 15%、睡眠/HRV/裝置準備度合計 10%（有填才算，沒填的權重會按比例分給其他項目）。',
              '準備指數 = 50 + 15 × 加權平均 z，限制在 0–100。50 代表「跟你平常一樣」。基線不足 5 次時，只用 KSS 與能量估算，並標示為「暫定」。'
            ]
          },
          {
            h: '四種狀態原型',
            p: [
              '平靜之火（高能量、低緊張）、風暴（高能量、高緊張）、靜湖（低能量、低緊張）、迷霧（低能量、高緊張）。高低是跟你自己的平均比較；資料不足時以 6 分為界。'
            ]
          },
          {
            h: '建議規則',
            p: [
              '指數 ≥60 且緊張 ≤5：挑戰最困難的深度工作。指數 ≥60 但緊張 >5：先做 2 分鐘慢呼吸。指數 40–59：中等難度任務、25 分鐘番茄鐘。指數 <40 或失誤明顯高於平常：先做機械性工作，或小睡、散步、喝水。13–15 點會附註午後低谷是正常的。'
            ]
          },
          {
            h: '心流記錄與洞察',
            p: [
              '心流程度用 1–10 分自評。若想更嚴謹，可參考 Rheinberg 等人的心流短量表（Flow Short Scale）。累積 10 次以上有心流記錄的測量後，「洞察」會用 Spearman 等級相關，找出和你心流評分最相關的因素。相關不等於因果。'
            ]
          },
          {
            h: '隱私',
            p: [
              '沒有帳號、沒有伺服器。所有資料只存在這個瀏覽器的 localStorage，不會傳送到任何地方。請定期在「設定與資料」匯出備份。'
            ]
          },
          {
            h: '參考文獻',
            refs: true
          }
        ]
      }
    },

    en: {
      appName: 'Pre-Flow Check · 心流羅盤',
      appShort: 'Pre-Flow Check',
      htmlLang: 'en',
      disclaimer: 'For personal self-observation only. Not a medical or diagnostic tool.',
      langToggle: '中',
      langToggleLabel: '切換為繁體中文',
      storageWarning: "Browser storage is unavailable — nothing will be saved. Export a backup.",
      next: 'Next',
      back: 'Back',
      close: 'Close',
      skip: 'Skip',
      cancel: 'Cancel',
      save: 'Save',
      today: 'Today',
      yesterday: 'Yesterday',
      minutes: '{m} min',
      device: { touch: 'touch', keyboard: 'keyboard', mouse: 'mouse' },

      nav: { home: 'Home', history: 'History', log: 'Log flow', settings: 'Settings' },

      welcome: {
        slides: [
          { t: 'Check in before you dive in', s: 'Just 4 minutes' },
          { t: '3 feelings + 1 reflex', s: 'Tap, then play' },
          { t: 'Draw three cards', s: "Get today's guide" }
        ],
        start: 'Start',
        label: 'Intro'
      },

      homeView: {
        ask: 'Ready to flow?',
        start: "Start today's check",
        baselineBuilding: 'Building baseline {n} / {total}',
        baselineReady: 'Baseline ready',
        last: 'Last {index}',
        reminder: 'Last check has no flow log',
        timerRunning: 'Focusing · {time}',
        timerDone: 'Focus done · log it'
      },

      step: {
        label: 'Step {n} of {total}',
        kssQ: 'How sleepy are you?',
        kss: {
          1: 'Extremely alert',
          3: 'Alert',
          5: 'Neither alert nor sleepy',
          7: 'Sleepy, but no effort to stay awake',
          9: 'Very sleepy, fighting to stay awake'
        },
        energyQ: 'How much energy right now?',
        tensionQ: 'How tense or anxious right now?',
        low: 'very low',
        high: 'very high',
        ctxTitle: 'Today so far',
        ctxHint: 'All optional',
        sleep: 'Slept',
        hoursUnit: 'h',
        task: "What's next?",
        more: 'More',
        wake: 'Woke at',
        awake: 'Awake {h} h',
        caffeine: 'Caffeine',
        cupsUnit: 'cups',
        lastCup: 'Last cup',
        hrv: 'HRV (ms)',
        rhr: 'Resting HR',
        readiness: 'Device readiness',
        outOfRange: 'Out of range',
        decrease: 'Decrease',
        increase: 'Increase',
        pvtTitle: 'See the dot? Tap!',
        pvtSub: '3 minutes · tap anywhere or press Space',
        pvtNote: 'Too early counts · stay in the app',
        pvtStart: 'Start',
        fast: 'Test mode: {s} s'
      },

      task: { deep: 'Deep work', creative: 'Creating', learning: 'Learning', admin: 'Admin', other: 'Other' },

      pvt: {
        tooEarly: 'Too early!',
        noResponse: 'Missed — keep going',
        progress: 'Test progress',
        surfaceLabel: 'Reaction test: tap or press Space when the yellow dot appears',
        interruptedTitle: 'Test interrupted',
        interruptedBody: 'Leaving the screen breaks the timing.',
        retest: 'Retake',
        skip: 'Use ratings only',
        saving: 'Shuffling…'
      },

      result: {
        prompt: 'Take a breath. Turn the three cards, one by one',
        cardBack: 'Card {n}, tap to reveal',
        cardLocked: 'Card {n} (turn the previous one first)',
        titleAria: "Today's three cards",
        energyTension: 'Energy {e} · Tension {t}',
        slower: 'Reactions {p}% slower than usual',
        faster: 'Reactions {p}% faster than usual',
        same: 'Reactions about as usual',
        lapsesLine: 'Lapses {n} · usually {m}',
        provisional: 'Provisional — baseline in progress',
        provisionalHint: '{k} more {device} checks to calibrate',
        invalidPvt: 'Reflex test invalid — ratings only',
        breatheBtn: 'Breathe 2 min first',
        details: 'Details',
        rtChart: 'Reaction times',
        rtChartDesc: 'Right of 355 ms = lapse',
        lapseZone: 'lapse ≥355',
        count: '{n}',
        metric: 'Metric',
        todayCol: 'Today',
        baselineCol: 'Usual',
        diffCol: 'Diff',
        afterBaseline: 'after baseline',
        better: 'better',
        worse: 'worse',
        similar: 'similar',
        focusTimer: 'Start focus timer',
        logFlow: 'Log flow',
        backHistory: 'Back to history',
        backHome: 'Home',
        pvtSummary: '{n} valid · {f} false starts',
        weightsUsed: 'In the index'
      },

      archetype: {
        calmFire: { zh: '平靜之火', en: 'THE CALM FIRE', tag: 'Best for flow', desc: 'Awake, unhurried.' },
        storm: { zh: '風暴', en: 'THE STORM', tag: 'Powerful, distractible', desc: 'Lots of energy. Slow down first.' },
        stillLake: { zh: '靜湖', en: 'THE STILL LAKE', tag: 'Relaxed, sluggish', desc: "Calm, engine not warm yet." },
        fog: { zh: '迷霧', en: 'THE FOG', tag: 'Tired, irritable', desc: 'Look after yourself first.' }
      },

      cards: {
        readiness: { zh: '準備指數', en: 'READINESS' },
        guidance: { zh: '今日指引', en: "TODAY'S GUIDANCE" }
      },

      rec: {
        deep: {
          main: 'Tackle your hardest deep work. Start now, notifications off.',
          actions: ['Hardest first', 'Notifications off', 'Write one goal']
        },
        breathe: {
          main: "Sharp but tense. Breathe slowly for 2 minutes (in 4 s, out 6 s).",
          actions: ['Breathe 2 min', 'Jot down worries', 'Then begin']
        },
        steady: {
          main: 'Good for medium tasks, in 25-minute pomodoros.',
          actions: ['Pick a medium task', 'Focus 25 · rest 5', 'Move between']
        },
        recover: {
          main: "Don't force it. Do mechanical tasks, or recover first.",
          actions: ['Mechanical tasks', 'Nap 10–20 min', 'Water, a walk']
        }
      },
      note: { postLunchDip: 'A 13:00–15:00 dip is normal.' },

      metric: {
        speed: 'Speed (1/s)',
        medianRt: 'Median RT',
        fast10: 'Fastest 10%',
        slow10: 'Slowest 10%',
        lapses: 'Lapses (≥355 ms)',
        falseStarts: 'False starts',
        kss: 'KSS sleepiness',
        energy: 'Energy',
        tension: 'Tension',
        sleepHours: 'Sleep',
        hrv: 'HRV',
        deviceReadiness: 'Device readiness',
        hour: 'Time of day',
        index: 'Readiness'
      },

      timer: {
        title: 'Focusing',
        pick: 'How long?',
        finish: 'Finish & log',
        cancel: 'Cancel timer',
        done: "Time's up",
        hint: 'Switch apps freely — time keeps running',
        ideaPlaceholder: 'Stray thought? Drop it in the jar',
        ideaDrop: 'Drop',
        ideasCount: '{n} in the jar',
        ideasTitle: 'Idea jar',
        ideasEmpty: 'Empty for now',
        remove: 'Remove'
      },

      breathe: {
        title: 'Slow breathing',
        inhale: 'Breathe in',
        exhale: 'Breathe out',
        remaining: '{t} left',
        done: 'Done. Go.',
        finish: 'Done',
        stop: 'Stop'
      },

      flow: {
        title: 'Log flow',
        session: 'Which check',
        sessionOption: '{when} · {index}',
        logged: ' (logged)',
        duration: 'Minutes focused',
        rating: 'How absorbed?',
        ratingLow: 'not at all',
        ratingHigh: 'lost in it',
        task: 'Task',
        interruptions: 'Interruptions',
        notes: 'Notes',
        ideas: 'From your idea jar',
        save: 'Save',
        saved: 'Saved',
        noSessions: 'No checks yet.',
        needRating: 'Pick a score',
        overwrite: 'Replaces the previous log'
      },

      history: {
        title: 'History',
        tabStars: 'Stars',
        tabInsights: 'Insights',
        tabTime: 'Time',
        empty: 'Nothing yet',
        legend: 'Height = readiness · bigger star = more flow · hollow = provisional',
        prev: 'Previous',
        next: 'Next',
        openCards: "See that day's cards",
        flowRating: 'Flow {r} / 10',
        noFlow: 'No flow log',
        logFlow: 'Log it',
        ideas: '{n} stray thoughts',
        chartLabel: 'Readiness star map, {n} sessions. Use arrow keys to browse.',
        pointLabel: '{when}, readiness {index}'
      },

      insights: {
        needMore: 'Log flow {k} more times to see patterns',
        title: 'What drives your flow',
        allTitle: 'All factors',
        caveat: 'Correlation is not causation.',
        method: 'Spearman rank correlation',
        r: 'r = {r}',
        n: 'n = {n}',
        strength: { negligible: 'negligible', weak: 'weak', moderate: 'moderate', strong: 'strong' },
        up: 'More {metric}, more flow',
        down: 'More {metric}, less flow',
        hourUp: 'Later checks, more flow',
        hourDown: 'Earlier checks, more flow',
        none: 'No clear factor yet',
        axisNeg: '−',
        axisPos: '+'
      },

      timeOfDay: {
        title: 'Your best hours',
        best: '{bucket} is best · avg {mean} · n = {n}',
        needMore: 'Need 2+ checks per slot',
        mean: '{mean}',
        bucket: {
          early: 'Early 5–9', morning: 'Morning 9–12', midday: 'Midday 12–14',
          afternoon: 'Afternoon 14–18', evening: 'Evening 18–21', night: 'Night 21–5'
        }
      },

      settings: {
        title: 'Settings',
        language: 'Language',
        data: 'Data',
        count: '{n} sessions, on this device only',
        exportJson: 'Export backup',
        importJson: 'Import backup',
        exportCsv: 'Export CSV',
        clear: 'Clear all data',
        importOk: 'Imported: {added} new, {total} total',
        importErr: {
          parse: "Not a valid JSON file",
          shape: "Not a Pre-Flow Check backup",
          version: 'Backup is from a newer version — update first'
        },
        clearConfirm1: 'Delete everything? This cannot be undone.',
        clearConfirm2: 'Type “{word}” to confirm',
        clearWord: 'DELETE',
        clearContinue: 'Continue',
        clearConfirm: 'Delete forever',
        clearDone: 'Cleared',
        baselines: 'Baselines',
        baselineLine: '{device} {n} / {total}',
        about: 'About the measures',
        tour: 'Replay intro',
        privacy: 'Your data stays in this browser. Nothing is uploaded.',
        storageOk: 'Storage OK',
        storageOff: 'Storage unavailable'
      },

      about: {
        title: 'About the measures',
        sections: [
          {
            h: 'What this tool does',
            p: [
              'Before work, it spends 4 minutes measuring your sleepiness, energy, tension and reaction speed, compares them with your own usual state, and estimates how ready you are for flow. After work you log how much flow you felt; once enough data builds up, you can see which factors actually predict your flow.'
            ]
          },
          {
            h: 'Karolinska Sleepiness Scale (KSS)',
            p: [
              'A 1–9 self-rating of sleepiness (Åkerstedt & Gillberg, 1990), widely used in sleep and fatigue research. Higher means sleepier; it is reverse-scored in the index.'
            ]
          },
          {
            h: 'Energy and tension',
            p: [
              "Based on Thayer's energy–tension model of mood and arousal (Thayer, 1989): energy and tension are separate dimensions. Calm energy (high energy, low tension) is the most favourable for focus; high tension makes energy jittery.",
              'Energy counts toward the Readiness Index. Tension does not — it drives the state archetype and the recommendation.'
            ]
          },
          {
            h: '3-minute reaction test (PVT-B)',
            p: [
              'The Psychomotor Vigilance Test is one of the most widely used measures of sustained attention. This app uses the 3-minute PVT-B validated by Basner, Mollicone and Dinges (2011): inter-stimulus intervals of 2–5 s, a lapse at RT ≥ 355 ms, and a false start for RT < 100 ms or a response before the stimulus.',
              'The main metric is mean response speed (the mean of 1000 ÷ RT, in 1/s), which is sensitive to fatigue. Median RT, fastest and slowest 10%, lapses and false starts are recorded too.',
              'Touchscreens, keyboards and mice have very different latencies, so reaction-test baselines are kept separately per device. Browser timing is limited: compare these numbers with yourself, not with research data.'
            ]
          },
          {
            h: 'How the Readiness Index works',
            p: [
              'Personal baseline = mean and SD of your last 14 valid sessions on the same device (enabled at 5); self-ratings and context data are pooled across devices. Each metric becomes a z-score oriented so higher is better, then a weighted mean is taken: speed 35%, lapses 20% (inverted), KSS 20% (inverted), energy 15%, and sleep/HRV/device readiness 10% combined (only when provided — missing weight is redistributed proportionally).',
              'Readiness Index = 50 + 15 × weighted mean z, clamped to 0–100. 50 means “like your usual self”. With fewer than 5 baseline sessions, a provisional index is estimated from KSS and energy only.'
            ]
          },
          {
            h: 'The four archetypes',
            p: [
              'The Calm Fire (high energy, low tension), The Storm (high, high), The Still Lake (low, low), The Fog (low energy, high tension). High and low are judged against your own mean, or a threshold of 6 while data is scarce.'
            ]
          },
          {
            h: 'Recommendation rules',
            p: [
              'Index ≥ 60 and tension ≤ 5: tackle your hardest deep work. Index ≥ 60 and tension > 5: 2 minutes of slow breathing first. Index 40–59: medium-difficulty tasks in 25-minute pomodoros. Index < 40 or lapses clearly above usual: mechanical tasks, or a nap, a walk, some water first. Between 13:00 and 15:00 a note explains the normal post-lunch dip.'
            ]
          },
          {
            h: 'Flow logs and insights',
            p: [
              'Flow is a single 1–10 self-rating. For a more rigorous measure, see the Flow Short Scale by Rheinberg and colleagues. After 10 or more check-ins with a flow log, Insights uses Spearman rank correlation to show which factors move with your flow. Correlation is not causation.'
            ]
          },
          {
            h: 'Privacy',
            p: [
              'No account, no server. All data lives in this browser’s localStorage and is never sent anywhere. Export a backup regularly from Settings & data.'
            ]
          },
          {
            h: 'References',
            refs: true
          }
        ]
      }
    }
  };

  // Verified references (shared by both languages).
  const REFERENCES = [
    {
      text: 'Basner, M., Mollicone, D., & Dinges, D. F. (2011). Validity and sensitivity of a brief psychomotor vigilance test (PVT-B) to total and partial sleep deprivation. Acta Astronautica, 69(11–12), 949–959.',
      url: 'https://doi.org/10.1016/j.actaastro.2011.07.015'
    },
    {
      text: 'Åkerstedt, T., & Gillberg, M. (1990). Subjective and objective sleepiness in the active individual. International Journal of Neuroscience, 52(1–2), 29–37.',
      url: 'https://doi.org/10.3109/00207459008994241'
    },
    {
      text: 'Thayer, R. E. (1989). The Biopsychology of Mood and Arousal. New York: Oxford University Press.',
      url: null
    },
    {
      text: 'Rheinberg, F., Vollmeyer, R., & Engeser, S. (2003). Die Erfassung des Flow-Erlebens [The assessment of flow experience]. In J. Stiensmeier-Pelster & F. Rheinberg (Eds.), Diagnostik von Motivation und Selbstkonzept (Tests und Trends, N.F. Band 2). Göttingen: Hogrefe.',
      url: null
    }
  ];

  root.PFC = root.PFC || {};
  root.PFC.STRINGS = STRINGS;
  root.PFC.REFERENCES = REFERENCES;
  if (typeof module === 'object' && module.exports) module.exports = { STRINGS, REFERENCES };
})(typeof globalThis !== 'undefined' ? globalThis : this);
