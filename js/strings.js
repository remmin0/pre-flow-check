/*
 * Pre-Flow Check — all UI copy, one object per language.
 * Keys are looked up with PFC.t('dot.path', { vars }). Arrays are allowed.
 * Card titles are intentionally bilingual in both languages (part of the card design).
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
      storageWarning: '無法存取瀏覽器儲存空間（可能是私密瀏覽模式或空間已滿）。App 仍可使用，但資料不會被保存，請記得匯出備份。',
      next: '下一步',
      back: '上一步',
      home: '首頁',
      close: '關閉',
      cancel: '取消',
      save: '儲存',
      today: '今天',
      yesterday: '昨天',
      minutes: '{m} 分鐘',
      device: { touch: '觸控', keyboard: '鍵盤', mouse: '滑鼠' },

      homeView: {
        title: '心流羅盤',
        subtitle: 'Pre-Flow Check',
        intro: '開工前花 4 分鐘，量一量此刻的狀態，看看現在適不適合進入心流。',
        start: '開始今日測量',
        logFlow: '記錄心流',
        history: '歷史',
        settings: '設定與資料',
        baselineBuilding: '基線建立中 {n} / {total}',
        baselineReady: '基線已建立 · 以最近 {n} 次為準',
        baselineDevice: '（{device}）',
        latest: '最近一次：{when} · 準備指數 {index}',
        empty: '還沒有紀錄。第一次測量之後，這條地平線會開始畫出你的狀態起伏。',
        reminder: '{when} 的測量還沒有記錄心流。專注結束了嗎？',
        reminderBtn: '現在記錄',
        timerRunning: '專注計時中 · 剩 {time}',
        timerDone: '專注時間結束了，記錄一下這次的心流吧。',
        timerOpen: '查看計時',
        horizonLabel: '你過去的準備指數起伏，小人站在最近一次。'
      },

      step: {
        label: '第 {n} 步 / 共 4 步',
        s1Title: '此刻的你',
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
        low: '1 很低',
        high: '10 很高',
        needAll: '三題都選好就能前往下一步。',
        s2Title: '今天的背景',
        s2Hint: '每一項都可以略過。',
        sleep: '昨晚睡了幾小時',
        wake: '今天幾點起床',
        awake: '已清醒 {h} 小時',
        caffeine: '今天喝了幾杯含咖啡因飲料',
        lastCup: '最後一杯的時間',
        wearable: '穿戴裝置數據（選填）',
        hrv: 'HRV（毫秒）',
        rhr: '靜止心率（bpm）',
        readiness: '裝置準備度分數（0–100）',
        task: '接下來要做的事',
        outOfRange: '超出範圍，這項不會被儲存',
        decrease: '減少',
        increase: '增加',
        clear: '清除',
        s3Title: '反應測驗',
        s3Intro: '接下來 3 分鐘，畫面中央會不定時出現一個黃色圓圈，裡面的數字會從 0 開始跳。',
        s3How: '一看到就盡快點擊畫面任何地方，或按空白鍵。',
        s3Tip1: '找個安靜的地方，測驗期間不要切換 App 或分頁。',
        s3Tip2: '圓圈出現前就按，會算作「搶先」。',
        s3Tip3: '測驗中只會看到上方一條細細的進度條。',
        s3Start: '開始測驗',
        s3Fast: '（測試模式：縮短為 {s} 秒）'
      },

      task: { deep: '深度思考', creative: '創作', learning: '學習', admin: '行政雜務', other: '其他' },

      pvt: {
        tooEarly: '太早了！',
        noResponse: '沒有反應，繼續…',
        progress: '測驗進度',
        surfaceLabel: '反應測驗區：看到黃色圓圈就點擊或按空白鍵',
        interruptedTitle: '測驗被中斷了',
        interruptedBody: '切換 App、分頁或離開畫面會讓計時不準，所以這次結果已標記為無效。',
        retest: '重新測驗',
        skip: '略過，只用主觀評分',
        saving: '正在計算…'
      },

      result: {
        prompt: '深呼吸，依序點開三張牌',
        cardBack: '第 {n} 張牌，點擊翻開',
        cardLocked: '第 {n} 張牌（請先翻開前一張）',
        titleAria: 'Pre-Flow Check 結果',
        sessionNo: 'No. {n}',
        archetypeLabel: '狀態原型',
        readinessLabel: '準備指數',
        guidanceLabel: '今日指引',
        energyTension: '能量 {e} · 緊張 {t}',
        slower: '反應速度比你平常慢 {p}%',
        faster: '反應速度比你平常快 {p}%',
        same: '反應速度和你平常差不多',
        lapsesLine: '失誤（≥355 ms）{n} 次，你平常約 {m} 次',
        provisional: '暫定，基線建立中',
        provisionalHint: '目前只根據主觀評分估算。再完成 {k} 次{device}測量，就會改用你的個人基線。',
        invalidPvt: '這次反應測驗無效，指數只根據主觀評分。',
        breatheBtn: '開始 2 分鐘呼吸',
        details: '詳細數據',
        rtChart: '反應時間分布',
        rtChartDesc: '每一條代表落在該區間的反應次數；355 ms 右側為失誤。',
        lapseZone: '失誤 ≥355',
        count: '{n} 次',
        metric: '項目',
        todayCol: '今天',
        baselineCol: '你的基線',
        diffCol: '相對基線',
        afterBaseline: '基線建立後顯示',
        better: '較好',
        worse: '較差',
        similar: '持平',
        focusTimer: '開始專注計時',
        logFlow: '記錄心流',
        backHistory: '回到歷史',
        backHome: '回首頁',
        pvtSummary: '有效反應 {n} 次 · 搶先 {f} 次',
        weightsUsed: '計入指數的項目'
      },

      archetype: {
        calmFire: {
          zh: '平靜之火', en: 'THE CALM FIRE',
          tag: '高能量、低緊張：最適合進入心流',
          desc: '有精神又不慌張，是最容易沉浸進去的狀態。'
        },
        storm: {
          zh: '風暴', en: 'THE STORM',
          tag: '高能量、高緊張：有力量，但容易分心',
          desc: '能量很足，但緊繃感會把注意力往外拉。先讓心跳慢下來。'
        },
        stillLake: {
          zh: '靜湖', en: 'THE STILL LAKE',
          tag: '低能量、低緊張：放鬆，但有點遲緩',
          desc: '心很平靜，只是引擎還沒熱。動一動、補點水再開始。'
        },
        fog: {
          zh: '迷霧', en: 'THE FOG',
          tag: '低能量、高緊張：疲倦又煩躁',
          desc: '累了又不安穩，硬撐通常事倍功半。先照顧好自己。'
        }
      },

      cards: {
        readiness: { zh: '準備指數', en: 'READINESS' },
        guidance: { zh: '今日指引', en: "TODAY'S GUIDANCE" }
      },

      rec: {
        deep: {
          main: '適合挑戰最困難的深度工作，現在就開始，記得關閉通知。',
          actions: ['把最難的那件事排在第一個', '關閉通知，手機放到視線外', '先寫下這段專注要完成的一個具體成果']
        },
        breathe: {
          main: '狀態很好但有點緊繃。先做 2 分鐘慢呼吸（吸氣 4 秒、吐氣 6 秒），再開始深度工作。',
          actions: ['跟著呼吸動畫做 2 分鐘', '把讓你掛心的事寫下來，暫時放一邊', '然後從最重要的任務開始']
        },
        steady: {
          main: '適合中等難度的任務，切成 25 分鐘的番茄鐘來做。',
          actions: ['挑一件明確、中等難度的任務', '專注 25 分鐘，休息 5 分鐘', '每個番茄鐘結束時起身動一動']
        },
        recover: {
          main: '現在不適合硬拚深度工作，先做機械性的事，或讓自己恢復一下。',
          actions: ['處理機械性、低風險的雜務', '小睡 10–20 分鐘，或出去走一走', '先喝一杯水，晚點再測一次']
        }
      },
      note: {
        postLunchDip: '現在是 13–15 點，午後精神下滑是正常的生理節律，不必太在意。'
      },

      metric: {
        speed: '反應速度（1/s）',
        medianRt: '反應時間中位數',
        fast10: '最快 10% 平均',
        slow10: '最慢 10% 平均',
        lapses: '失誤次數（≥355 ms）',
        falseStarts: '搶先次數',
        kss: 'KSS 嗜睡度',
        energy: '能量',
        tension: '緊張',
        sleepHours: '睡眠時數',
        hrv: 'HRV',
        deviceReadiness: '裝置準備度',
        hour: '測量時刻',
        index: '準備指數'
      },

      timer: {
        title: '專注中',
        pick: '要專注多久？',
        remaining: '剩餘時間',
        finish: '提前結束並記錄',
        cancel: '取消計時',
        done: '時間到！',
        hint: '可以放心切換 App，回來時計時仍然準確。',
        doneHint: '辛苦了。趁記憶還新鮮，記錄這次的心流吧。'
      },

      breathe: {
        title: '慢呼吸',
        inhale: '吸氣',
        exhale: '吐氣',
        remaining: '剩 {t}',
        done: '完成了。準備好就開始吧。',
        finish: '完成',
        stop: '結束'
      },

      flow: {
        title: '記錄心流',
        session: '對應的測量',
        sessionOption: '{when} · 準備指數 {index}',
        logged: '（已記錄）',
        duration: '實際專注時間（分鐘）',
        rating: '這段時間的心流程度',
        ratingLow: '1 完全沒進入狀態',
        ratingHigh: '10 完全沉浸，忘了時間',
        task: '任務類型',
        interruptions: '被打斷次數（選填）',
        notes: '筆記（選填）',
        save: '儲存心流記錄',
        saved: '已儲存。',
        noSessions: '還沒有可以對應的測量。先完成一次今日測量吧。',
        needRating: '請選擇心流程度。',
        overwrite: '這次測量已經有心流記錄，儲存會覆蓋舊的。'
      },

      history: {
        title: '歷史',
        tabHorizon: '地平線',
        tabInsights: '洞察',
        tabTime: '時段',
        empty: '還沒有紀錄。完成第一次測量後，這裡會畫出你的地平線。',
        legend: '線的高度 = 準備指數 · ★ = 心流評分（越大越高） · 空心點 = 暫定',
        prev: '前一次',
        next: '後一次',
        openCards: '翻開這天的牌',
        flowRating: '心流 {r} / 10',
        noFlow: '尚未記錄心流',
        logFlow: '補記心流',
        chartLabel: '準備指數歷史地平線，共 {n} 次測量。用左右方向鍵瀏覽。',
        pointLabel: '{when}，準備指數 {index}'
      },

      insights: {
        needMore: '還需要 {k} 次心流記錄才能分析（目前 {n} / {total}）。每次專注後記錄心流，就能找出影響你的因素。',
        title: '對你影響最大的因素',
        allTitle: '所有因素',
        caveat: '相關不等於因果：這些只是你資料中一起出現的趨勢，背後可能還有其他原因。',
        method: '方法：Spearman 等級相關，樣本為有心流記錄的測量。',
        r: 'r = {r}',
        n: 'n = {n}',
        strength: { negligible: '幾乎無關', weak: '弱相關', moderate: '中度相關', strong: '強相關' },
        up: '{metric}越高，心流評分通常越高',
        down: '{metric}越高，心流評分通常越低',
        hourUp: '越晚測量，心流評分通常越高',
        hourDown: '越早測量，心流評分通常越高',
        none: '目前沒有明顯的因素（所有 |r| < 0.1）。',
        axisNeg: '負相關',
        axisPos: '正相關'
      },

      timeOfDay: {
        title: '你在哪個時段狀態最好？',
        best: '你的準備指數通常在「{bucket}」最高（平均 {mean}，n = {n}）。',
        needMore: '每個時段至少要有 2 次測量才能比較。多在不同時段測幾次吧。',
        mean: '平均 {mean}',
        bucket: {
          early: '清晨 5–9', morning: '上午 9–12', midday: '中午 12–14',
          afternoon: '下午 14–18', evening: '傍晚 18–21', night: '夜間 21–5'
        }
      },

      settings: {
        title: '設定與資料',
        language: '語言',
        data: '資料',
        count: '目前共有 {n} 次測量，全部存在這個瀏覽器裡。',
        exportJson: '匯出 JSON 備份',
        importJson: '匯入 JSON',
        exportCsv: '匯出 CSV',
        clear: '清除所有資料',
        importOk: '已匯入：新增 {added} 筆，共 {total} 筆。',
        importErr: {
          parse: '這個檔案不是有效的 JSON。',
          shape: '檔案格式不對，看起來不是心流羅盤的備份。',
          version: '這個備份來自較新的版本，請先更新 App。'
        },
        clearConfirm1: '確定要刪除所有測量與心流記錄嗎？此動作無法復原，建議先匯出備份。',
        clearConfirm2: '請輸入「{word}」以確認刪除。',
        clearWord: '刪除',
        clearContinue: '繼續',
        clearConfirm: '永久刪除',
        clearDone: '所有資料已清除。',
        baselines: '基線狀態',
        baselineLine: '{device}：{n} / {total} 次',
        about: '指標說明與科學依據',
        privacy: '所有資料只存在你的瀏覽器裡，不會傳送到任何地方。換手機或清除瀏覽器資料前，請先匯出 JSON 備份。',
        storageOk: '瀏覽器儲存：正常',
        storageOff: '瀏覽器儲存：無法使用'
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
      storageWarning: 'Browser storage is unavailable (private browsing or storage full). The app still works, but nothing will be saved — export a backup before you leave.',
      next: 'Next',
      back: 'Back',
      home: 'Home',
      close: 'Close',
      cancel: 'Cancel',
      save: 'Save',
      today: 'Today',
      yesterday: 'Yesterday',
      minutes: '{m} min',
      device: { touch: 'touch', keyboard: 'keyboard', mouse: 'mouse' },

      homeView: {
        title: 'Pre-Flow Check',
        subtitle: '心流羅盤',
        intro: 'Spend 4 minutes before focused work to see whether you are ready for flow right now.',
        start: "Start today's check",
        logFlow: 'Log flow',
        history: 'History',
        settings: 'Settings & data',
        baselineBuilding: 'Building baseline {n} / {total}',
        baselineReady: 'Baseline ready · last {n} sessions',
        baselineDevice: ' ({device})',
        latest: 'Latest: {when} · Readiness {index}',
        empty: 'No sessions yet. After your first check, this horizon will start tracing your ups and downs.',
        reminder: "Your check-in from {when} has no flow log yet. Done focusing?",
        reminderBtn: 'Log it now',
        timerRunning: 'Focus timer · {time} left',
        timerDone: "Focus time is up — log how much flow you felt.",
        timerOpen: 'Open timer',
        horizonLabel: 'Your past Readiness Index as a horizon; the figure stands at the latest point.'
      },

      step: {
        label: 'Step {n} of 4',
        s1Title: 'How you are right now',
        kssQ: 'How sleepy do you feel right now?',
        kss: {
          1: 'Extremely alert',
          3: 'Alert',
          5: 'Neither alert nor sleepy',
          7: 'Sleepy, but no effort to stay awake',
          9: 'Very sleepy, fighting to stay awake'
        },
        energyQ: 'How much energy do I have right now?',
        tensionQ: 'How tense, irritated or anxious am I right now?',
        low: '1 very low',
        high: '10 very high',
        needAll: 'Answer all three to continue.',
        s2Title: "Today's context",
        s2Hint: 'Every field is optional.',
        sleep: 'Hours slept last night',
        wake: 'Woke up at',
        awake: 'Awake for {h} h',
        caffeine: 'Caffeinated drinks today',
        lastCup: 'Time of last cup',
        wearable: 'Wearable data (optional)',
        hrv: 'HRV (ms)',
        rhr: 'Resting heart rate (bpm)',
        readiness: 'Device readiness score (0–100)',
        task: 'What comes next',
        outOfRange: "Out of range — won't be saved",
        decrease: 'Decrease',
        increase: 'Increase',
        clear: 'Clear',
        s3Title: 'Reaction test',
        s3Intro: 'For the next 3 minutes, a yellow circle with a counter running up from 0 will appear in the middle at random moments.',
        s3How: 'As soon as you see it, tap anywhere or press Space — as fast as you can.',
        s3Tip1: "Find a quiet spot and don't switch apps or tabs during the test.",
        s3Tip2: 'Responding before the circle appears counts as a false start.',
        s3Tip3: 'During the test you will only see a thin progress bar at the top.',
        s3Start: 'Start test',
        s3Fast: '(test mode: shortened to {s} s)'
      },

      task: { deep: 'Deep thinking', creative: 'Creating', learning: 'Learning', admin: 'Admin & chores', other: 'Other' },

      pvt: {
        tooEarly: 'Too early!',
        noResponse: 'No response — continuing…',
        progress: 'Test progress',
        surfaceLabel: 'Reaction test area: tap or press Space when the yellow circle appears',
        interruptedTitle: 'The test was interrupted',
        interruptedBody: 'Switching apps or tabs breaks the timing, so this run has been marked invalid.',
        retest: 'Retake the test',
        skip: 'Skip — use self-ratings only',
        saving: 'Calculating…'
      },

      result: {
        prompt: 'Take a deep breath and turn the three cards over, one by one',
        cardBack: 'Card {n}, tap to reveal',
        cardLocked: 'Card {n} (turn the previous card first)',
        titleAria: 'Pre-Flow Check results',
        sessionNo: 'No. {n}',
        archetypeLabel: 'State archetype',
        readinessLabel: 'Readiness Index',
        guidanceLabel: "Today's guidance",
        energyTension: 'Energy {e} · Tension {t}',
        slower: 'Your reactions are {p}% slower than usual',
        faster: 'Your reactions are {p}% faster than usual',
        same: 'Your reactions are about the same as usual',
        lapsesLine: 'Lapses (≥355 ms): {n} — you usually have about {m}',
        provisional: 'Provisional — baseline in progress',
        provisionalHint: 'Based on self-ratings only. {k} more {device} sessions until your personal baseline takes over.',
        invalidPvt: 'The reaction test was invalid, so the index uses self-ratings only.',
        breatheBtn: 'Start 2-minute breathing',
        details: 'Details',
        rtChart: 'Reaction-time distribution',
        rtChartDesc: 'Each bar counts responses in that range; everything right of 355 ms is a lapse.',
        lapseZone: 'lapse ≥355',
        count: '{n} responses',
        metric: 'Metric',
        todayCol: 'Today',
        baselineCol: 'Your baseline',
        diffCol: 'vs. baseline',
        afterBaseline: 'after baseline',
        better: 'better',
        worse: 'worse',
        similar: 'similar',
        focusTimer: 'Start focus timer',
        logFlow: 'Log flow',
        backHistory: 'Back to history',
        backHome: 'Home',
        pvtSummary: '{n} valid responses · {f} false starts',
        weightsUsed: 'Counted in the index'
      },

      archetype: {
        calmFire: {
          zh: '平靜之火', en: 'THE CALM FIRE',
          tag: 'High energy, low tension — the best state for flow',
          desc: 'Awake without being rushed: the easiest state to sink into deep work.'
        },
        storm: {
          zh: '風暴', en: 'THE STORM',
          tag: 'High energy, high tension — powerful but easily distracted',
          desc: 'Plenty of energy, but the tension keeps pulling attention outward. Slow down first.'
        },
        stillLake: {
          zh: '靜湖', en: 'THE STILL LAKE',
          tag: 'Low energy, low tension — relaxed but sluggish',
          desc: "Calm, but the engine hasn't warmed up. Move a little and drink some water."
        },
        fog: {
          zh: '迷霧', en: 'THE FOG',
          tag: 'Low energy, high tension — tired and irritable',
          desc: 'Tired and unsettled. Pushing through rarely pays off here — look after yourself first.'
        }
      },

      cards: {
        readiness: { zh: '準備指數', en: 'READINESS' },
        guidance: { zh: '今日指引', en: "TODAY'S GUIDANCE" }
      },

      rec: {
        deep: {
          main: 'A good moment for your hardest deep work. Start now, and silence notifications.',
          actions: ['Put the hardest task first', 'Silence notifications and put your phone out of sight', 'Write down one concrete outcome for this session']
        },
        breathe: {
          main: "You're sharp but wound up. Do 2 minutes of slow breathing (in 4 s, out 6 s), then start deep work.",
          actions: ['Follow the breathing animation for 2 minutes', "Jot down what's on your mind and set it aside", 'Then begin with your most important task']
        },
        steady: {
          main: 'Good for medium-difficulty tasks. Work in 25-minute pomodoros.',
          actions: ['Pick one clear, medium-difficulty task', 'Focus 25 minutes, rest 5', 'Stand up and move between pomodoros']
        },
        recover: {
          main: "Not the moment to force deep work. Do mechanical tasks, or recover first.",
          actions: ['Handle mechanical, low-stakes tasks', 'Take a 10–20 minute nap or a short walk', 'Drink a glass of water and check again later']
        }
      },
      note: {
        postLunchDip: "It's between 13:00 and 15:00 — a post-lunch dip in alertness is normal."
      },

      metric: {
        speed: 'Response speed (1/s)',
        medianRt: 'Median RT',
        fast10: 'Fastest 10% mean',
        slow10: 'Slowest 10% mean',
        lapses: 'Lapses (≥355 ms)',
        falseStarts: 'False starts',
        kss: 'KSS sleepiness',
        energy: 'Energy',
        tension: 'Tension',
        sleepHours: 'Sleep hours',
        hrv: 'HRV',
        deviceReadiness: 'Device readiness',
        hour: 'Time of day',
        index: 'Readiness Index'
      },

      timer: {
        title: 'Focusing',
        pick: 'How long will you focus?',
        remaining: 'Time left',
        finish: 'Finish early & log',
        cancel: 'Cancel timer',
        done: "Time's up!",
        hint: 'You can switch apps — the timer stays accurate.',
        doneHint: 'Nice work. Log your flow while it is still fresh.'
      },

      breathe: {
        title: 'Slow breathing',
        inhale: 'Breathe in',
        exhale: 'Breathe out',
        remaining: '{t} left',
        done: 'Done. Start whenever you are ready.',
        finish: 'Done',
        stop: 'Stop'
      },

      flow: {
        title: 'Log your flow',
        session: 'Which check-in',
        sessionOption: '{when} · Readiness {index}',
        logged: ' (logged)',
        duration: 'Actual focus time (minutes)',
        rating: 'How much flow did you feel?',
        ratingLow: '1 not at all',
        ratingHigh: '10 fully absorbed, lost track of time',
        task: 'Task type',
        interruptions: 'Interruptions (optional)',
        notes: 'Notes (optional)',
        save: 'Save flow log',
        saved: 'Saved.',
        noSessions: "No check-ins yet. Do today's check first.",
        needRating: 'Pick a flow rating.',
        overwrite: 'This check-in already has a flow log; saving will replace it.'
      },

      history: {
        title: 'History',
        tabHorizon: 'Horizon',
        tabInsights: 'Insights',
        tabTime: 'Time of day',
        empty: 'No sessions yet. After your first check, your horizon will appear here.',
        legend: 'Height = Readiness Index · ★ = flow rating (bigger = higher) · hollow = provisional',
        prev: 'Previous',
        next: 'Next',
        openCards: "See this day's cards",
        flowRating: 'Flow {r} / 10',
        noFlow: 'No flow log yet',
        logFlow: 'Log flow',
        chartLabel: 'Readiness Index history horizon, {n} sessions. Use the arrow keys to browse.',
        pointLabel: '{when}, Readiness {index}'
      },

      insights: {
        needMore: 'Log flow for {k} more sessions to unlock insights ({n} / {total}). Log flow after each focus block to learn what drives it.',
        title: 'What affects your flow most',
        allTitle: 'All factors',
        caveat: 'Correlation is not causation: these are patterns that show up together in your data, and something else may explain them.',
        method: 'Method: Spearman rank correlation over check-ins that have a flow log.',
        r: 'r = {r}',
        n: 'n = {n}',
        strength: { negligible: 'negligible', weak: 'weak', moderate: 'moderate', strong: 'strong' },
        up: 'Higher {metric} tends to go with more flow',
        down: 'Higher {metric} tends to go with less flow',
        hourUp: 'Later check-ins tend to go with more flow',
        hourDown: 'Earlier check-ins tend to go with more flow',
        none: 'No clear factor yet (all |r| < 0.1).',
        axisNeg: 'negative',
        axisPos: 'positive'
      },

      timeOfDay: {
        title: 'When are you sharpest?',
        best: 'Your Readiness Index is usually highest in the {bucket} slot (mean {mean}, n = {n}).',
        needMore: 'Each time slot needs at least 2 check-ins to compare. Try checking in at different times.',
        mean: 'mean {mean}',
        bucket: {
          early: 'Early 5–9', morning: 'Morning 9–12', midday: 'Midday 12–14',
          afternoon: 'Afternoon 14–18', evening: 'Evening 18–21', night: 'Night 21–5'
        }
      },

      settings: {
        title: 'Settings & data',
        language: 'Language',
        data: 'Data',
        count: '{n} sessions, all stored in this browser.',
        exportJson: 'Export JSON backup',
        importJson: 'Import JSON',
        exportCsv: 'Export CSV',
        clear: 'Clear all data',
        importOk: 'Imported: {added} new, {total} total.',
        importErr: {
          parse: "This file isn't valid JSON.",
          shape: "This doesn't look like a Pre-Flow Check backup.",
          version: 'This backup comes from a newer version — please update the app first.'
        },
        clearConfirm1: 'Delete every check-in and flow log? This cannot be undone. Export a backup first.',
        clearConfirm2: 'Type “{word}” to confirm.',
        clearWord: 'DELETE',
        clearContinue: 'Continue',
        clearConfirm: 'Delete forever',
        clearDone: 'All data cleared.',
        baselines: 'Baselines',
        baselineLine: '{device}: {n} / {total} sessions',
        about: 'About the measures',
        privacy: 'All data stays in your browser and is never sent anywhere. Export a JSON backup before switching phones or clearing browser data.',
        storageOk: 'Browser storage: OK',
        storageOff: 'Browser storage: unavailable'
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
