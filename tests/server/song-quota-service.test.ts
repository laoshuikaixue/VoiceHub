import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { SERVER_ERROR_CODES } from "../../server/config/constants.ts";
import {
  createSongQuotaDrizzleAdapter,
  runSongQuotaDrizzleTransaction,
} from "../../server/services/songQuotaDrizzleAdapter.ts";
import {
  adjustPermanentSongQuota,
  buildPublicSongQuotaTransaction,
  buildSongQuotaAccountResponse,
  consumeSongQuota,
  executeSequentialSongImports,
  executeSongQuotaSubmission,
  executeSongWithdrawal,
  getSongQuotaAccount,
  listSongQuotaTransactions,
  refreshSongQuotaPeriod,
  returnSongQuota,
} from "../../server/services/songQuotaService.ts";
import { serverErrors as enServerErrors } from "../../app/utils/locale/en-US.ts";
import { serverErrors as zhServerErrors } from "../../app/utils/locale/zh-CN.ts";

const NOW = new Date("2026-08-11T04:00:00.000Z");
const SETTINGS = {
  songQuotaEnabled: true,
  songQuotaPeriodType: "WEEKLY",
  songQuotaPeriodAmount: 3,
  adminSongQuotaExempt: true,
  blockOnSongQuotaInsufficient: true,
};

function createStore(initialAccount = null) {
  let account = initialAccount ? { ...initialAccount } : null;
  const transactions = [];
  const songs = new Map();
  let transactionTail = Promise.resolve();

  return {
    transactions,
    songs,
    async ensureAccount(userId) {
      account ??= {
        id: 1,
        userId,
        periodicBalance: 0,
        permanentBalance: 0,
        periodKey: null,
        createdAt: NOW,
        updatedAt: NOW,
      };
    },
    async lockAccount(userId) {
      return account?.userId === userId ? { ...account } : null;
    },
    async lockIdempotencyKey() {},
    async updateAccount(accountId, changes) {
      assert.equal(account?.id, accountId);
      account = { ...account, ...changes };
      return { ...account };
    },
    async findTransactionByIdempotencyKey(idempotencyKey) {
      const existing = transactions.find((item) => item.idempotencyKey === idempotencyKey);
      return existing ? { ...existing } : null;
    },
    async insertTransaction(values) {
      const existing = values.idempotencyKey
        ? transactions.find((item) => item.idempotencyKey === values.idempotencyKey)
        : null;
      if (existing) return { ...existing };
      const transaction = { id: transactions.length + 1, ...values };
      transactions.push(transaction);
      return { ...transaction };
    },
    async attachTransactionToSong(transactionId, songId) {
      const transaction = transactions.find((item) => item.id === transactionId);
      if (!transaction || transaction.songId !== null) return null;
      transaction.songId = songId;
      return { ...transaction };
    },
    async lockSong(songId) {
      const song = songs.get(songId);
      return song ? { ...song } : null;
    },
    async markSongReturned(songId, transactionId) {
      const song = songs.get(songId);
      if (!song || song.quotaReturned) return null;
      const updated = { ...song, quotaReturned: true, quotaReturnTransactionId: transactionId };
      songs.set(songId, updated);
      return { ...updated };
    },
    async lockLegacyCard(cardId) {
      return this.cards.get(cardId) ?? null;
    },
    async lockLegacyCardByCode(code) {
      return Array.from(this.cards.values()).find((card) => card.code === code) ?? null;
    },
    async markLegacyCardConverted(cardId, userId, convertedAt) {
      const card = this.cards.get(cardId);
      if (!card || card.status !== "AVAILABLE") return null;
      const updated = { ...card, status: "CONVERTED", redeemedBy: userId, redeemedAt: convertedAt };
      this.cards.set(cardId, updated);
      return updated;
    },
    async listTransactions(input) {
      const page = input.page;
      const limit = input.limit;
      const start = (page - 1) * limit;
      return {
        items: transactions.slice(start, start + limit).map((item) => ({ ...item })),
        total: transactions.length,
        page,
        limit,
      };
    },
    async transaction(operation) {
      const previous = transactionTail;
      let release;
      transactionTail = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      const accountSnapshot = account ? { ...account } : null;
      const transactionCount = transactions.length;
      const songSnapshot = new Map(Array.from(songs, ([id, song]) => [id, { ...song }]));
      const cardSnapshot = new Map(Array.from(this.cards, ([id, card]) => [id, { ...card }]));
      try {
        return await operation(this);
      } catch (error) {
        account = accountSnapshot;
        transactions.splice(transactionCount);
        songs.clear();
        for (const [id, song] of songSnapshot) songs.set(id, song);
        this.cards.clear();
        for (const [id, card] of cardSnapshot) this.cards.set(id, card);
        throw error;
      } finally {
        release();
      }
    },
    cards: new Map(),
    get account() {
      return account ? { ...account } : null;
    },
  };
}

function account(overrides = {}) {
  return {
    id: 1,
    userId: 7,
    periodicBalance: 0,
    permanentBalance: 0,
    periodKey: "2026-W32",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

test("点歌额度服务首次读取按需创建零余额账户", async () => {
  const store = createStore();
  const result = await getSongQuotaAccount(store, 7, { ...SETTINGS, songQuotaEnabled: false }, NOW);
  assert.equal(result.userId, 7);
  assert.equal(result.periodicBalance, 0);
  assert.equal(result.permanentBalance, 0);
  assert.equal(store.transactions.length, 0);
});

test("点歌额度服务惰性刷新先记录过期再发放且同周期仅发放一次", async () => {
  const store = createStore(account({ periodicBalance: 2 }));
  const first = await refreshSongQuotaPeriod(store, await store.lockAccount(7), SETTINGS, NOW);
  const second = await refreshSongQuotaPeriod(store, first, SETTINGS, NOW);
  assert.equal(second.periodicBalance, 3);
  assert.deepEqual(
    store.transactions.map((item) => [item.source, item.delta]),
    [
      ["PERIOD_EXPIRED", -2],
      ["PERIOD_GRANT", 3],
    ],
  );
});

test("点歌额度服务优先扣减周期额度并以永久额度兜底", async () => {
  const periodicStore = createStore(
    account({ periodicBalance: 1, permanentBalance: 2, periodKey: "2026-W33" }),
  );
  const periodic = await consumeSongQuota(periodicStore, {
    userId: 7,
    songId: 10,
    requestId: "request-periodic-10",
    settings: SETTINGS,
    now: NOW,
    isAdministrator: false,
  });
  assert.equal(periodic.quotaType, "PERIODIC");
  assert.equal(periodicStore.account.periodicBalance, 0);

  const permanentStore = createStore(account({ permanentBalance: 2, periodKey: "2026-W33" }));
  const permanent = await consumeSongQuota(permanentStore, {
    userId: 7,
    songId: 11,
    requestId: "request-permanent-11",
    settings: SETTINGS,
    now: NOW,
    isAdministrator: false,
  });
  assert.equal(permanent.quotaType, "PERMANENT");
  assert.equal(permanentStore.account.permanentBalance, 1);
});

test("点歌额度服务余额不足时抛稳定错误码", async () => {
  const store = createStore(account({ periodKey: "2026-W33" }));
  await assert.rejects(
    consumeSongQuota(store, {
      userId: 7,
      songId: 10,
      requestId: "request-insufficient-10",
      settings: SETTINGS,
      now: NOW,
      isAdministrator: false,
    }),
    (error) => error?.data?.code === "SONG_QUOTA_INSUFFICIENT",
  );
});

test("点歌额度服务余额不足但未开启阻止时允许无额度投稿", async () => {
  const store = createStore(account({ periodKey: "2026-W33" }));
  const result = await consumeSongQuota(store, {
    userId: 7,
    songId: 10,
    requestId: "request-insufficient-allowed-10",
    settings: { ...SETTINGS, blockOnSongQuotaInsufficient: false },
    now: NOW,
    isAdministrator: false,
  });
  assert.equal(result, null);
  assert.equal(store.transactions.length, 0);
  assert.equal(store.account.periodicBalance, 0);
  assert.equal(store.account.permanentBalance, 0);
});

test("点歌额度服务管理员免额度时不写扣减流水", async () => {
  const store = createStore();
  const result = await consumeSongQuota(store, {
    userId: 7,
    songId: 10,
    requestId: "request-admin-10",
    settings: SETTINGS,
    now: NOW,
    isAdministrator: true,
  });
  assert.equal(result, null);
  assert.equal(store.transactions.length, 0);
  assert.equal(store.account, null);
});

test("点歌额度服务消费强制使用 requestId 生成幂等键和请求指纹", async () => {
  const store = createStore(account({ periodicBalance: 1, periodKey: "2026-W33" }));
  const result = await consumeSongQuota(store, {
    userId: 7,
    songId: null,
    requestId: " request-consume-1 ",
    settings: SETTINGS,
    now: NOW,
    isAdministrator: false,
  });
  assert.equal(result.transactionId, 1);
  assert.equal(store.transactions[0].idempotencyKey, "song-consume:request-consume-1");
  assert.match(store.transactions[0].requestFingerprint, /^[a-f0-9]{64}$/);
});

test("点歌额度服务拒绝缺少 requestId 的消费", async () => {
  const store = createStore(account({ periodicBalance: 1, periodKey: "2026-W33" }));
  await assert.rejects(
    consumeSongQuota(store, {
      userId: 7,
      songId: null,
      settings: SETTINGS,
      now: NOW,
      isAdministrator: false,
    }),
    /requestId/,
  );
  assert.equal(store.account.periodicBalance, 1);
  assert.equal(store.transactions.length, 0);
});

test("点歌额度服务由调用方事务回滚歌曲创建失败前的扣减", async () => {
  const base = account({ periodicBalance: 1, periodKey: "2026-W33" });
  const store = createStore(base);
  await assert.rejects(
    store.transaction(async (tx) => {
      await consumeSongQuota(tx, {
        userId: 7,
        songId: 10,
        requestId: "request-rollback-10",
        settings: SETTINGS,
        now: NOW,
        isAdministrator: false,
      });
      throw new Error("歌曲创建失败");
    }),
    /歌曲创建失败/,
  );
  assert.deepEqual(store.account, base);
  assert.equal(store.transactions.length, 0);
});

test("额度投稿事务在同一事务内扣减并写入歌曲消费快照", async () => {
  const store = createStore(account({ periodicBalance: 1, periodKey: "2026-W33" }));
  let insertedValues;
  const song = await store.transaction((tx) =>
    executeSongQuotaSubmission(tx, {
      userId: 7,
      requestId: "submission-10",
      settings: SETTINGS,
      now: NOW,
      isAdministrator: false,
      insertSong: async (quotaSnapshot) => {
        insertedValues = { title: "测试歌曲", ...quotaSnapshot };
        return { id: 10, ...insertedValues };
      },
    }),
  );
  assert.equal(song.id, 10);
  assert.equal(store.account.periodicBalance, 0);
  assert.deepEqual(insertedValues, {
    title: "测试歌曲",
    quotaConsumed: true,
    quotaType: "PERIODIC",
    quotaTransactionId: 1,
    quotaPeriodKey: "2026-W33",
  });
  assert.equal(store.transactions[0].songId, 10);
});

test("额度投稿事务由调用方回滚歌曲插入失败前的账户和流水变更", async () => {
  const base = account({ periodicBalance: 1, periodKey: "2026-W33" });
  const store = createStore(base);
  await assert.rejects(
    store.transaction((tx) =>
      executeSongQuotaSubmission(tx, {
        userId: 7,
        requestId: "submission-failed",
        settings: SETTINGS,
        now: NOW,
        isAdministrator: false,
        insertSong: async () => {
          throw new Error("歌曲插入失败");
        },
      }),
    ),
    /歌曲插入失败/,
  );
  assert.deepEqual(store.account, base);
  assert.equal(store.transactions.length, 0);
});

test("额度投稿事务按管理员免额度开关决定是否扣减", async () => {
  const exemptStore = createStore(account({ periodicBalance: 1, periodKey: "2026-W33" }));
  let exemptSnapshot;
  await exemptStore.transaction((tx) =>
    executeSongQuotaSubmission(tx, {
      userId: 7,
      requestId: "submission-admin-exempt",
      settings: SETTINGS,
      now: NOW,
      isAdministrator: true,
      insertSong: async (snapshot) => {
        exemptSnapshot = snapshot;
        return { id: 10 };
      },
    }),
  );
  assert.equal(exemptStore.account.periodicBalance, 1);
  assert.deepEqual(exemptSnapshot, {
    quotaConsumed: false,
    quotaType: null,
    quotaTransactionId: null,
    quotaPeriodKey: null,
  });

  const chargedStore = createStore(account({ periodicBalance: 1, periodKey: "2026-W33" }));
  await chargedStore.transaction((tx) =>
    executeSongQuotaSubmission(tx, {
      userId: 7,
      requestId: "submission-admin-charged",
      settings: { ...SETTINGS, adminSongQuotaExempt: false },
      now: NOW,
      isAdministrator: true,
      insertSong: async () => ({ id: 11 }),
    }),
  );
  assert.equal(chargedStore.account.periodicBalance, 0);
});

test("额度投稿事务在功能关闭或余额不足放行时写默认未消费快照", async () => {
  for (const settings of [
    { ...SETTINGS, songQuotaEnabled: false },
    { ...SETTINGS, blockOnSongQuotaInsufficient: false },
  ]) {
    const store = createStore(account({ periodKey: "2026-W33" }));
    let snapshot;
    await store.transaction((tx) =>
      executeSongQuotaSubmission(tx, {
        userId: 7,
        requestId: `submission-unconsumed-${settings.songQuotaEnabled}`,
        settings,
        now: NOW,
        isAdministrator: false,
        insertSong: async (value) => {
          snapshot = value;
          return { id: 12 };
        },
      }),
    );
    assert.deepEqual(snapshot, {
      quotaConsumed: false,
      quotaType: null,
      quotaTransactionId: null,
      quotaPeriodKey: null,
    });
  }
});

test("额度投稿状态返回统一账户契约且管理员免额度无预计消费类型", () => {
  const regular = buildSongQuotaAccountResponse(
    account({ periodicBalance: 2, permanentBalance: 4, periodKey: "2026-W33" }),
    SETTINGS,
    NOW,
    false,
  );
  assert.deepEqual(regular, {
    userId: 7,
    periodicBalance: 2,
    permanentBalance: 4,
    totalBalance: 6,
    periodKey: "2026-W33",
    periodType: "WEEKLY",
    periodAmount: 3,
    nextRefreshAt: "2026-08-16T16:00:00.000Z",
    estimatedConsumptionType: "PERIODIC",
    enabled: true,
    insufficientBlocked: true,
  });
  const administrator = buildSongQuotaAccountResponse(
    account({ periodicBalance: 2, periodKey: "2026-W33" }),
    SETTINGS,
    NOW,
    true,
  );
  assert.equal(administrator.estimatedConsumptionType, null);
  const disabled = buildSongQuotaAccountResponse(
    account({ periodicBalance: 2, periodKey: "2026-W33" }),
    { ...SETTINGS, songQuotaEnabled: false },
    NOW,
    false,
  );
  assert.equal(disabled.estimatedConsumptionType, null);
});

test("额度批量导入按原顺序逐首执行并保留中间失败结果", async () => {
  const calls = [];
  const result = await executeSequentialSongImports(
    [
      { id: 3, title: "第一首" },
      { id: 5, title: "第二首" },
      { id: 8, title: "第三首" },
    ],
    async (song, index) => {
      calls.push([song.id, index]);
      if (song.id === 5) throw new Error("额度不足");
      return { id: song.id + 100 };
    },
  );
  assert.deepEqual(calls, [
    [3, 0],
    [5, 1],
    [8, 2],
  ]);
  assert.deepEqual(result, {
    total: 3,
    success: 2,
    failed: 1,
    details: [
      { sourceId: 3, success: true, songId: 103 },
      { sourceId: 5, success: false, error: "额度不足" },
      { sourceId: 8, success: true, songId: 108 },
    ],
  });
});

test("点歌额度服务返还当前周期额度且拒绝重复返还", async () => {
  const store = createStore(account({ periodKey: "2026-W33" }));
  store.songs.set(10, {
    id: 10,
    requesterId: 7,
    quotaConsumed: true,
    quotaType: "PERIODIC",
    quotaPeriodKey: "2026-W33",
    quotaReturned: false,
  });
  const result = await returnSongQuota(store, { songId: 10, settings: SETTINGS, now: NOW });
  assert.equal(result.status, "RETURNED");
  assert.equal(store.account.periodicBalance, 1);
  await assert.rejects(
    returnSongQuota(store, { songId: 10, settings: SETTINGS, now: NOW }),
    (error) => error?.data?.code === "SONG_QUOTA_ALREADY_RETURNED",
  );
});

test("点歌额度服务跨周期撤回写零变动过期流水", async () => {
  const store = createStore(account({ periodKey: "2026-W33" }));
  store.songs.set(10, {
    id: 10,
    requesterId: 7,
    quotaConsumed: true,
    quotaType: "PERIODIC",
    quotaPeriodKey: "2026-W32",
    quotaReturned: false,
  });
  const result = await returnSongQuota(store, { songId: 10, settings: SETTINGS, now: NOW });
  assert.equal(result.status, "EXPIRED");
  assert.equal(store.account.periodicBalance, 0);
  assert.equal(store.transactions.at(-1).source, "SONG_WITHDRAW_EXPIRED");
  assert.equal(store.transactions.at(-1).delta, 0);
});

test("点歌额度服务永久额度跨周期仍原路返还", async () => {
  const store = createStore(account({ periodKey: "2026-W33" }));
  store.songs.set(10, {
    id: 10,
    requesterId: 7,
    quotaConsumed: true,
    quotaType: "PERMANENT",
    quotaPeriodKey: null,
    quotaReturned: false,
  });
  const result = await returnSongQuota(store, { songId: 10, settings: SETTINGS, now: NOW });
  assert.equal(result.status, "RETURNED");
  assert.equal(store.account.permanentBalance, 1);
});

test("点歌额度服务调整永久额度并拒绝负余额", async () => {
  const store = createStore(account({ permanentBalance: 1 }));
  const result = await adjustPermanentSongQuota(store, {
    userId: 7,
    delta: 2,
    source: "ADMIN_ADJUST",
    now: NOW,
    idempotencyKey: "admin-adjust-1",
    requestFingerprint: "fingerprint-admin-adjust-1",
  });
  assert.equal(result.account.permanentBalance, 3);
  await assert.rejects(
    adjustPermanentSongQuota(store, {
      userId: 7,
      delta: -4,
      source: "ADMIN_ADJUST",
      now: NOW,
      idempotencyKey: "admin-adjust-2",
      requestFingerprint: "fingerprint-admin-adjust-2",
    }),
    (error) => error?.data?.code === "SONG_QUOTA_NEGATIVE_BALANCE",
  );
});

test("点歌额度 Drizzle 事务入口只向服务暴露事务适配器", async () => {
  const tx = {
    insert() {
      return {
        values() {
          return {
            async onConflictDoNothing() {},
          };
        },
      };
    },
  };
  let transactionCalls = 0;
  const transactionDb = {
    async transaction(operation) {
      transactionCalls += 1;
      return operation(tx);
    },
  };
  const result = await runSongQuotaDrizzleTransaction(transactionDb, async (adapter) => {
    await adapter.ensureAccount(7);
    return "ok";
  });
  assert.equal(result, "ok");
  assert.equal(transactionCalls, 1);
});

test("点歌额度 Drizzle 事务入口遇到序列化冲突时有限重试", async () => {
  let attempts = 0;
  const db = {
    async transaction(operation) {
      attempts += 1;
      if (attempts < 3) {
        const error = new Error("serialization failure");
        error.code = "40001";
        throw error;
      }
      return operation({});
    },
  };

  const result = await runSongQuotaDrizzleTransaction(db, async () => "ok");
  assert.equal(result, "ok");
  assert.equal(attempts, 3);
});

test("点歌额度 Drizzle 适配器使用事务级 advisory 锁串行化幂等键", async () => {
  let query;
  const db = {
    async execute(nextQuery) {
      query = nextQuery;
    },
  };
  const adapter = createSongQuotaDrizzleAdapter(db);
  await adapter.lockIdempotencyKey("request-1");
  assert.ok(query);
  assert.equal(
    query.queryChunks.some((chunk) =>
      chunk?.value?.some?.((value) => value.includes("pg_advisory_xact_lock")),
    ),
    true,
  );
});

test("点歌额度 Drizzle 适配器按余额条件执行部分更新", async () => {
  let values;
  let condition;
  const db = {
    update() {
      return {
        set(nextValues) {
          values = nextValues;
          return {
            where(nextCondition) {
              condition = nextCondition;
              return {
                async returning() {
                  return [];
                },
              };
            },
          };
        },
      };
    },
  };
  const adapter = createSongQuotaDrizzleAdapter(db);
  await adapter.updateAccount(
    1,
    { permanentBalance: 2, updatedAt: NOW },
    {
      permanentBalance: 1,
    },
  );
  assert.deepEqual(values, { permanentBalance: 2, updatedAt: NOW });
  assert.ok(condition);
});

test("额度撤回在同一事务返还当前周期额度并返回 RETURNED", async () => {
  const store = createStore(account({ periodKey: "2026-W33" }));
  store.songs.set(10, {
    id: 10,
    requesterId: 7,
    quotaConsumed: true,
    quotaType: "PERIODIC",
    quotaPeriodKey: "2026-W33",
    quotaReturned: false,
  });
  const deleted = [];
  const result = await executeSongWithdrawal(store, {
    songId: 10,
    operatorId: 7,
    settings: SETTINGS,
    now: NOW,
    deleteDraftSchedules: async () => {},
    deleteSongRelations: async (song) => deleted.push(`relations:${song.id}`),
    decrementRequestTime: async () => {},
    deleteSong: async (song) => {
      deleted.push(`song:${song.id}`);
      store.songs.delete(song.id);
    },
  });
  assert.equal(result.quotaReturnResult, "RETURNED");
  assert.equal(store.account.periodicBalance, 1);
  assert.deepEqual(deleted, ["relations:10", "song:10"]);
});

test("额度撤回跨周期只记录 EXPIRED 且永久额度跨期仍返还", async () => {
  const periodicStore = createStore(account({ periodKey: "2026-W33" }));
  periodicStore.songs.set(10, {
    id: 10,
    requesterId: 7,
    quotaConsumed: true,
    quotaType: "PERIODIC",
    quotaPeriodKey: "2026-W32",
    quotaReturned: false,
  });
  const expired = await executeSongWithdrawal(periodicStore, {
    songId: 10,
    operatorId: 7,
    settings: SETTINGS,
    now: NOW,
    deleteDraftSchedules: async () => {},
    deleteSongRelations: async () => {},
    decrementRequestTime: async () => {},
    deleteSong: async () => {},
  });
  assert.equal(expired.quotaReturnResult, "EXPIRED");
  assert.equal(periodicStore.account.periodicBalance, 0);

  const permanentStore = createStore(account({ periodKey: "2026-W33" }));
  permanentStore.songs.set(11, {
    id: 11,
    requesterId: 7,
    quotaConsumed: true,
    quotaType: "PERMANENT",
    quotaPeriodKey: null,
    quotaReturned: false,
  });
  const returned = await executeSongWithdrawal(permanentStore, {
    songId: 11,
    operatorId: 7,
    settings: SETTINGS,
    now: NOW,
    deleteDraftSchedules: async () => {},
    deleteSongRelations: async () => {},
    decrementRequestTime: async () => {},
    deleteSong: async () => {},
  });
  assert.equal(returned.quotaReturnResult, "RETURNED");
  assert.equal(permanentStore.account.permanentBalance, 1);
});

test("额度撤回未消费额度的歌曲返回 NOT_APPLICABLE 并完成清理", async () => {
  const store = createStore(account({ periodKey: "2026-W33" }));
  store.songs.set(10, {
    id: 10,
    requesterId: 7,
    quotaConsumed: false,
    quotaType: null,
    quotaPeriodKey: null,
    quotaReturned: false,
  });
  const deleted = [];
  const result = await executeSongWithdrawal(store, {
    songId: 10,
    operatorId: 7,
    settings: SETTINGS,
    now: NOW,
    deleteDraftSchedules: async () => deleted.push("drafts"),
    deleteSongRelations: async () => deleted.push("relations"),
    decrementRequestTime: async () => {},
    deleteSong: async () => deleted.push("song"),
  });
  assert.equal(result.quotaReturnResult, "NOT_APPLICABLE");
  assert.equal(store.account.periodicBalance, 0);
  assert.deepEqual(deleted, ["drafts", "relations", "song"]);
  assert.equal(store.transactions.length, 0);
});

test("额度撤回返还失败时不删除歌曲及关联数据", async () => {
  const store = createStore(account({ periodKey: "2026-W33" }));
  store.songs.set(10, {
    id: 10,
    requesterId: 7,
    quotaConsumed: true,
    quotaType: "PERIODIC",
    quotaPeriodKey: "2026-W33",
    quotaReturned: true,
  });
  let deleteCalls = 0;
  await assert.rejects(
    executeSongWithdrawal(store, {
      songId: 10,
      operatorId: 7,
      settings: SETTINGS,
      now: NOW,
      deleteDraftSchedules: async () => {
        deleteCalls += 1;
      },
      deleteSongRelations: async () => {
        deleteCalls += 1;
      },
      decrementRequestTime: async () => {
        deleteCalls += 1;
      },
      deleteSong: async () => {
        deleteCalls += 1;
      },
    }),
    (error) => error?.data?.code === "SONG_QUOTA_ALREADY_RETURNED",
  );
  assert.equal(deleteCalls, 0);
  assert.equal(store.songs.has(10), true);
});

test("额度撤回并发重复请求仅一次返还且另一次失败", async () => {
  const store = createStore(account({ periodKey: "2026-W33" }));
  store.songs.set(10, {
    id: 10,
    requesterId: 7,
    quotaConsumed: true,
    quotaType: "PERIODIC",
    quotaPeriodKey: "2026-W33",
    quotaReturned: false,
  });
  const input = {
    songId: 10,
    operatorId: 7,
    settings: SETTINGS,
    now: NOW,
    deleteDraftSchedules: async () => {},
    deleteSongRelations: async () => {},
    decrementRequestTime: async () => {},
    deleteSong: async () => {},
  };
  const results = await Promise.allSettled([
    store.transaction((tx) => executeSongWithdrawal(tx, input)),
    store.transaction((tx) => executeSongWithdrawal(tx, input)),
  ]);
  assert.equal(results.filter((item) => item.status === "fulfilled").length, 1);
  assert.equal(results.filter((item) => item.status === "rejected").length, 1);
  assert.equal(store.account.periodicBalance, 1);
  assert.equal(
    store.transactions.filter((item) => item.source === "SONG_WITHDRAW_RETURN").length,
    1,
  );
});

test("额度撤回缺少草稿清理步骤时在任何状态变更前失败", async () => {
  const store = createStore(account({ periodicBalance: 0, periodKey: "2026-W33" }));
  store.songs.set(10, {
    id: 10,
    requesterId: 7,
    quotaConsumed: true,
    quotaType: "PERIODIC",
    quotaPeriodKey: "2026-W33",
    quotaReturned: false,
  });
  let relationDeleteCalls = 0;

  await assert.rejects(
    store.transaction((tx) =>
      executeSongWithdrawal(tx, {
        songId: 10,
        operatorId: 7,
        settings: SETTINGS,
        now: NOW,
        deleteSongRelations: async () => {
          relationDeleteCalls += 1;
        },
        decrementRequestTime: async () => {},
        deleteSong: async () => {},
      }),
    ),
    /草稿排期清理/,
  );

  assert.equal(relationDeleteCalls, 0);
  assert.equal(store.account.periodicBalance, 0);
  assert.equal(store.transactions.length, 0);
  assert.equal(store.songs.get(10).quotaReturned, false);
});

test("额度撤回清理草稿失败时回滚额度返还且不删除后续关联", async () => {
  const store = createStore(account({ periodicBalance: 0, periodKey: "2026-W33" }));
  store.songs.set(10, {
    id: 10,
    requesterId: 7,
    quotaConsumed: true,
    quotaType: "PERIODIC",
    quotaPeriodKey: "2026-W33",
    quotaReturned: false,
  });
  let relationDeleteCalls = 0;

  await assert.rejects(
    store.transaction((tx) =>
      executeSongWithdrawal(tx, {
        songId: 10,
        operatorId: 7,
        settings: SETTINGS,
        now: NOW,
        deleteDraftSchedules: async () => {
          throw new Error("草稿清理失败");
        },
        deleteSongRelations: async () => {
          relationDeleteCalls += 1;
        },
        decrementRequestTime: async () => {},
        deleteSong: async () => {},
      }),
    ),
    /草稿清理失败/,
  );

  assert.equal(relationDeleteCalls, 0);
  assert.equal(store.account.periodicBalance, 0);
  assert.equal(store.transactions.length, 0);
  assert.equal(store.songs.get(10).quotaReturned, false);
});

test("额度撤回在锁定歌曲后重验权限、播放状态和正式排期", async () => {
  const store = createStore(account({ periodKey: "2026-W33" }));
  store.songs.set(10, {
    id: 10,
    requesterId: 7,
    played: false,
    quotaConsumed: false,
    quotaType: null,
    quotaPeriodKey: null,
    quotaReturned: false,
  });
  const checks = [];
  await executeSongWithdrawal(store, {
    songId: 10,
    operatorId: 7,
    settings: SETTINGS,
    now: NOW,
    validateLockedSong: async (song) => checks.push(`validate:${song.id}`),
    deleteDraftSchedules: async () => checks.push("drafts"),
    deleteSongRelations: async () => checks.push("relations"),
    decrementRequestTime: async () => {},
    deleteSong: async () => checks.push("song"),
  });
  assert.deepEqual(checks, ["validate:10", "drafts", "relations", "song"]);

  const source = readFileSync(
    new URL("../../server/api/songs/withdraw.post.ts", import.meta.url),
    "utf8",
  );
  const transactionStart = source.indexOf(
    ".transaction(async (tx)",
    source.indexOf("const settings = await getSystemSettingsCached()"),
  );
  const transaction = source.slice(
    transactionStart,
    source.indexOf("const { quotaReturnResult } = withdrawalResult"),
  );
  assert.match(transaction, /validateLockedSong:/);
  assert.match(transaction, /lockedSong\.requesterId/);
  assert.match(transaction, /lockedSong\.played/);
  assert.match(transaction, /eq\(schedules\.isDraft, false\)/);
});

test("删除排期仅锁定排期表避免 PostgreSQL 外连接行锁失败", () => {
  const source = readFileSync(
    new URL("../../server/api/admin/schedule/remove.post.ts", import.meta.url),
    "utf8",
  );
  const lockStart = source.indexOf("const existingSchedule = await tx");
  const lockEndCandidates = [
    source.indexOf(".for('update')", lockStart),
    source.indexOf('.for("update")', lockStart),
  ].filter((index) => index >= 0);
  const lockQuery = source.slice(lockStart, Math.min(...lockEndCandidates));

  assert.doesNotMatch(lockQuery, /leftJoin/);
});

test("撤回歌曲会在同一事务删除草稿排期", () => {
  const source = readFileSync(
    new URL("../../server/api/songs/withdraw.post.ts", import.meta.url),
    "utf8",
  );
  const transactionStart = source.indexOf(
    ".transaction(async (tx)",
    source.indexOf("const settings = await getSystemSettingsCached()"),
  );
  const transaction = source.slice(
    transactionStart,
    source.indexOf("const { quotaReturnResult } = withdrawalResult"),
  );
  assert.match(transaction, /deleteDraftSchedules:/);
  assert.match(transaction, /tx\s*\.delete\(schedules\)/);
  assert.match(transaction, /eq\(schedules\.isDraft, true\)/);
});

test("联合投稿人退出也会在锁定歌曲后重验权限、播放状态和正式排期", () => {
  const source = readFileSync(
    new URL("../../server/api/songs/withdraw.post.ts", import.meta.url),
    "utf8",
  );
  const collaboratorBranch = source.slice(
    source.indexOf("// 如果是联合投稿人撤回（退出）"),
    source.indexOf("const settings = await getSystemSettingsCached()"),
  );
  const lockIndex = collaboratorBranch.search(/\.from\(songs\)[\s\S]*?\.for\(['"]update['"]\)/);
  const deleteIndex = collaboratorBranch.indexOf("tx.delete(songCollaborators)");
  assert.ok(lockIndex >= 0, "联合投稿人退出前未锁定 Song");
  assert.ok(deleteIndex > lockIndex, "联合投稿人退出应先锁定 Song 再删除协作关系");
  assert.match(collaboratorBranch, /lockedSong\.played/);
  assert.match(collaboratorBranch, /eq\(schedules\.isDraft, false\)/);
});

test("排期发布和播放状态变更在事务内先锁定 Song", () => {
  const paths = [
    "../../server/api/admin/schedule.post.ts",
    "../../server/api/admin/schedule/publish.post.ts",
    "../../server/api/admin/schedule/bulk-publish.post.ts",
    "../../server/api/admin/songs/mark-played.post.ts",
    "../../server/api/open/songs/mark-played.post.ts",
  ];
  for (const path of paths) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    const transaction = source.slice(source.indexOf("db.transaction"));
    const lockIndex = transaction.search(/\.from\(songs\)[\s\S]*?\.for\(['"]update['"]\)/);
    const mutationIndex = transaction.search(
      /tx\.(?:insert\(schedules\)|update\(schedules\)|update\(songs\))/,
    );
    assert.ok(lockIndex >= 0, `${path} 未锁定 Song`);
    assert.ok(mutationIndex < 0 || lockIndex < mutationIndex, `${path} 应先锁定 Song 再变更状态`);
  }
});

test("多歌曲锁路径统一按 Song.id 升序获取行锁", () => {
  const paths = [
    "../../server/api/admin/schedule/bulk-publish.post.ts",
    "../../server/api/admin/songs/mark-played.post.ts",
    "../../server/api/open/songs/mark-played.post.ts",
  ];
  for (const path of paths) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    const transaction = source.slice(source.indexOf("db.transaction"));
    const multiSongLock = transaction.match(
      /\.from\(songs\)[\s\S]*?\.where\(inArray\(songs\.id, songIds\)\)[\s\S]*?\.for\(['"]update['"]\)/,
    )?.[0];
    assert.ok(multiSongLock, `${path} 未批量锁定 Song`);
    assert.match(multiSongLock, /\.orderBy\(asc\(songs\.id\)\)/, `${path} 未按 Song.id 升序锁定`);
  }
});

test("播放状态写路径在歌曲锁内复用服务端时间", () => {
  const paths = [
    "../../server/api/admin/songs/mark-played.post.ts",
    "../../server/api/open/songs/mark-played.post.ts",
  ];
  for (const path of paths) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    const transaction = source.slice(source.indexOf("db.transaction"));
    assert.match(transaction, /const now = getServerDate\(\)/);
    assert.match(transaction, /updatedAt: now/);
    assert.match(transaction, /at: now/);
    assert.doesNotMatch(transaction, /getBeijingTime\(\)|new Date\(\)/);
  }
});

test("撤回接口直接使用事务返回值避免额度结果被类型收窄", () => {
  const source = readFileSync(
    new URL("../../server/api/songs/withdraw.post.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /const withdrawalResult = await db\s*\.transaction/);
  assert.match(source, /return await executeSongWithdrawal/);
  assert.match(source, /const \{ quotaReturnResult \} = withdrawalResult/);
  assert.doesNotMatch(source, /let quotaReturnResult/);
});

test("额度撤回客户端按 quotaReturnResult 展示返还结果并本地化错误", () => {
  const source = readFileSync(
    new URL("../../app/composables/useSongs.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /data\.quotaReturnResult === 'RETURNED'/);
  assert.match(source, /localizeServerError\(err\)/);
  assert.doesNotMatch(source, /data\.quotaReturned/);
});

test("点歌额度服务强制要求幂等键和请求指纹", async () => {
  const store = createStore(account({ permanentBalance: 1 }));
  await assert.rejects(
    adjustPermanentSongQuota(store, {
      userId: 7,
      delta: 1,
      source: "ADMIN_ADJUST",
      now: NOW,
    }),
    /幂等键和请求指纹/,
  );
  assert.equal(store.account.permanentBalance, 1);
  assert.equal(store.transactions.length, 0);
});

test("点歌额度服务先锁幂等键再查指纹并创建或锁定账户", async () => {
  const store = createStore(account({ permanentBalance: 3 }));
  const calls = [];
  const lockIdempotencyKey = store.lockIdempotencyKey;
  const findTransaction = store.findTransactionByIdempotencyKey;
  const ensureAccount = store.ensureAccount;
  const lockAccount = store.lockAccount;
  store.lockIdempotencyKey = async (...args) => {
    calls.push("lockIdempotencyKey");
    return lockIdempotencyKey(...args);
  };
  store.findTransactionByIdempotencyKey = async (...args) => {
    calls.push("findTransaction");
    return findTransaction(...args);
  };
  store.ensureAccount = async (...args) => {
    calls.push("ensureAccount");
    return ensureAccount(...args);
  };
  store.lockAccount = async (...args) => {
    calls.push("lockAccount");
    return lockAccount(...args);
  };
  store.transactions.push({
    id: 9,
    accountId: 1,
    quotaType: "PERMANENT",
    source: "OPEN_API_ADJUST",
    delta: 2,
    balanceAfter: 3,
    idempotencyKey: "request-1",
    requestFingerprint: "fingerprint-1",
    createdAt: NOW,
  });
  const result = await adjustPermanentSongQuota(store, {
    userId: 7,
    delta: 2,
    source: "OPEN_API_ADJUST",
    now: NOW,
    idempotencyKey: "request-1",
    requestFingerprint: "fingerprint-1",
  });
  assert.deepEqual(calls, [
    "lockIdempotencyKey",
    "findTransaction",
    "ensureAccount",
    "lockAccount",
  ]);
  assert.equal(result.account.permanentBalance, 3);
  assert.equal(result.transaction.id, 9);
});

test("点歌额度服务在修改余额前按幂等键和指纹返回既有结果", async () => {
  const store = createStore(account({ permanentBalance: 3 }));
  store.transactions.push({
    id: 9,
    accountId: 1,
    quotaType: "PERMANENT",
    source: "OPEN_API_ADJUST",
    delta: 2,
    balanceAfter: 3,
    idempotencyKey: "request-1",
    requestFingerprint: "fingerprint-1",
    createdAt: NOW,
  });
  const result = await adjustPermanentSongQuota(store, {
    userId: 7,
    delta: 2,
    source: "OPEN_API_ADJUST",
    now: NOW,
    idempotencyKey: "request-1",
    requestFingerprint: "fingerprint-1",
  });
  assert.equal(store.account.permanentBalance, 3);
  assert.equal(store.transactions.length, 1);
  assert.equal(result.transaction.id, 9);
});

test("点歌额度服务拒绝幂等键相同但指纹不同的调整", async () => {
  const store = createStore(account({ permanentBalance: 3 }));
  store.transactions.push({
    id: 9,
    accountId: 1,
    quotaType: "PERMANENT",
    source: "OPEN_API_ADJUST",
    delta: 2,
    balanceAfter: 3,
    idempotencyKey: "request-1",
    requestFingerprint: "fingerprint-1",
    createdAt: NOW,
  });
  await assert.rejects(
    adjustPermanentSongQuota(store, {
      userId: 7,
      delta: 1,
      source: "OPEN_API_ADJUST",
      now: NOW,
      idempotencyKey: "request-1",
      requestFingerprint: "fingerprint-2",
    }),
    (error) => error?.data?.code === "SONG_QUOTA_IDEMPOTENCY_CONFLICT",
  );
  assert.equal(store.account.permanentBalance, 3);
  assert.equal(store.transactions.length, 1);
});

test("点歌额度服务查询流水委托给适配器", async () => {
  const store = createStore(account());
  await adjustPermanentSongQuota(store, {
    userId: 7,
    delta: 1,
    source: "ADMIN_ADJUST",
    now: NOW,
    idempotencyKey: "admin-list-1",
    requestFingerprint: "fingerprint-admin-list-1",
  });
  const result = await listSongQuotaTransactions(store, { userId: 7, page: 1, limit: 20 });
  assert.equal(result.total, 1);
  assert.equal(result.items[0].source, "ADMIN_ADJUST");
});

test("点歌额度错误码在常量和双语词典中完整同步", () => {
  const expectedCodes = [
    "SONG_QUOTA_DISABLED",
    "SONG_QUOTA_INSUFFICIENT",
    "SONG_QUOTA_ACCOUNT_INVALID",
    "SONG_QUOTA_PERIOD_CONFIG_INVALID",
    "SONG_QUOTA_NEGATIVE_BALANCE",
    "SONG_QUOTA_IDEMPOTENCY_CONFLICT",
    "SONG_QUOTA_ALREADY_RETURNED",
  ];
  for (const code of expectedCodes) {
    assert.equal(SERVER_ERROR_CODES[code], code);
    assert.equal(typeof zhServerErrors[code], "string");
    assert.equal(typeof enServerErrors[code], "string");
  }
});


test("用户额度接口要求登录且仅以当前用户查询账户", () => {
  const source = readFileSync(
    new URL("../../server/api/song-quota/index.get.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /if \(!user\)/);
  assert.match(source, /createApiError\(401/);
  assert.match(source, /getSongQuotaAccount\([\s\S]*?user\.id/);
  assert.doesNotMatch(source, /getQuery\(event\)/);
});

test("用户额度公开流水移除内部字段", () => {
  const result = buildPublicSongQuotaTransaction({
    id: 3,
    quotaType: "PERMANENT",
    source: "LEGACY_CARD_CONVERT",
    delta: 1,
    balanceAfter: 4,
    periodKey: null,
    songId: null,
    publicDescription: "旧券兑换",
    internalNote: "内部备注",
    apiKeyId: "api-key",
    requestFingerprint: "fingerprint",
    snapshot: { secret: true },
    createdAt: NOW,
  });
  assert.deepEqual(result, {
    id: 3,
    quotaType: "PERMANENT",
    source: "LEGACY_CARD_CONVERT",
    delta: 1,
    balanceAfter: 4,
    periodKey: null,
    songId: null,
    publicDescription: "旧券兑换",
    createdAt: NOW,
  });
});


test("用户额度流水按本人归属分页且限制每页数量", async () => {
  const store = createStore(account());
  for (let index = 0; index < 3; index += 1) {
    store.transactions.push({
      id: index + 1,
      accountId: 1,
      quotaType: "PERMANENT",
      source: "ADMIN_ADJUST",
      delta: 1,
      balanceAfter: index + 1,
      periodKey: null,
      createdAt: NOW,
    });
  }
  const result = await listSongQuotaTransactions(store, { userId: 7, page: 2, limit: 2 });
  assert.equal(result.total, 3);
  assert.equal(result.page, 2);
  assert.equal(result.limit, 2);
  assert.deepEqual(result.items.map((item) => item.id), [3]);
});

test("用户额度流水接口固定当前用户归属并返回公开分页数据", () => {
  const source = readFileSync(
    new URL("../../server/api/song-quota/transactions.get.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /if \(!user\)/);
  assert.match(source, /createApiError\(401/);
  assert.match(source, /userId:\s*user\.id/);
  assert.match(source, /buildPublicSongQuotaTransaction/);
  assert.doesNotMatch(source, /query\.userId/);
});


test("RequestForm 管理员判断包含 SONG_ADMIN 并统一复用认证管理员状态", () => {
  const source = readFileSync(
    new URL("../../app/components/Songs/RequestForm.vue", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /user\.role === 'SUPER_ADMIN' \|\| user\.role === 'ADMIN'/);
  assert.match(source, /v-if="user && auth\.isAdmin\.value"/);
  assert.match(source, /if \(user\.value && auth\.isAdmin\.value\)/);
});

test("管理员额度响应脱敏且保留审计所需字段", async () => {
  const service = await import("../../server/services/songQuotaService.ts");
  assert.equal(typeof service.buildAdminSongQuotaTransaction, "function");
  const result = service.buildAdminSongQuotaTransaction({
    id: 8,
    accountId: 2,
    userId: 7,
    userName: "测试用户",
    username: "20260007",
    quotaType: "PERMANENT",
    source: "ADMIN_ADJUST",
    delta: 3,
    balanceAfter: 5,
    periodKey: null,
    songId: null,
    administratorId: 1,
    publicDescription: "活动发放",
    internalNote: "工单 42",
    externalReference: "ticket-42",
    idempotencyKey: "secret-request-id",
    requestFingerprint: "secret-fingerprint",
    apiKeyId: "secret-api-key",
    snapshot: { secret: true },
    createdAt: NOW,
  });
  assert.deepEqual(result, {
    id: 8,
    user: { id: 7, name: "测试用户", username: "20260007" },
    quotaType: "PERMANENT",
    source: "ADMIN_ADJUST",
    delta: 3,
    balanceAfter: 5,
    periodKey: null,
    songId: null,
    administratorId: 1,
    publicDescription: "活动发放",
    internalNote: "工单 42",
    externalReference: "ticket-42",
    createdAt: NOW,
  });
});

test("管理员额度账户列表与详情接口限制系统管理员并仅选择安全字段", () => {
  const listSource = readFileSync(
    new URL("../../server/api/admin/song-quotas/index.get.ts", import.meta.url),
    "utf8",
  );
  const detailSource = readFileSync(
    new URL("../../server/api/admin/song-quotas/[userId].get.ts", import.meta.url),
    "utf8",
  );
  for (const source of [listSource, detailSource]) {
    assert.match(source, /requireSongQuotaAdministrator/);
    assert.doesNotMatch(source, /password|lastLoginIp|email/);
  }
  assert.match(listSource, /search/);
  assert.match(listSource, /listSongQuotaAccounts/);
  assert.match(detailSource, /getSongQuotaAccountDetails/);
});

test("管理员永久额度调整接口使用严格边界、稳定幂等指纹和可重试事务", () => {
  const source = readFileSync(
    new URL("../../server/api/admin/song-quotas/adjust.post.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /adminSongQuotaAdjustmentSchema\.safeParse/);
  assert.match(source, /runSongQuotaDrizzleTransaction/);
  assert.match(source, /adjustPermanentSongQuotaByOperation/);
  assert.match(source, /administratorId:\s*administrator\.id/);
  assert.match(source, /requestId/);
  assert.doesNotMatch(source, /Date\.now\(\)|new Date\(\)/);
});

test("管理员全局额度流水支持受限分页与白名单筛选并脱敏", () => {
  const source = readFileSync(
    new URL("../../server/api/admin/song-quotas/transactions.get.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /adminSongQuotaTransactionQuerySchema\.safeParse/);
  assert.match(source, /listSongQuotaTransactions/);
  assert.match(source, /buildAdminSongQuotaTransaction/);
  assert.match(source, /quotaType/);
  assert.match(source, /source/);
  assert.match(source, /from/);
  assert.match(source, /to/);
  assert.doesNotMatch(source, /requestFingerprint|idempotencyKey|apiKeyId|snapshot/);
});

test("管理员永久额度增加扣减和设定均写差额流水", async () => {
  const service = await import("../../server/services/songQuotaService.ts");
  assert.equal(typeof service.adjustPermanentSongQuotaByOperation, "function");
  const store = createStore(account({ permanentBalance: 5 }));
  const increment = await service.adjustPermanentSongQuotaByOperation(store, {
    userId: 7,
    operation: "INCREMENT",
    amount: 2,
    source: "ADMIN_ADJUST",
    now: NOW,
    idempotencyKey: "admin-op-1",
    requestFingerprint: "admin-op-fingerprint-1",
  });
  assert.equal(increment.transaction.delta, 2);
  const decrement = await service.adjustPermanentSongQuotaByOperation(store, {
    userId: 7,
    operation: "DECREMENT",
    amount: 3,
    source: "ADMIN_ADJUST",
    now: NOW,
    idempotencyKey: "admin-op-2",
    requestFingerprint: "admin-op-fingerprint-2",
  });
  assert.equal(decrement.transaction.delta, -3);
  const set = await service.adjustPermanentSongQuotaByOperation(store, {
    userId: 7,
    operation: "SET",
    amount: 9,
    source: "ADMIN_ADJUST",
    now: NOW,
    idempotencyKey: "admin-op-3",
    requestFingerprint: "admin-op-fingerprint-3",
  });
  assert.equal(set.transaction.delta, 5);
  assert.equal(store.account.permanentBalance, 9);
});

test("管理员永久额度设定重试先命中幂等结果而不按新余额重算", async () => {
  const service = await import("../../server/services/songQuotaService.ts");
  const store = createStore(account({ permanentBalance: 2 }));
  const input = {
    userId: 7,
    operation: "SET",
    amount: 6,
    source: "ADMIN_ADJUST",
    now: NOW,
    idempotencyKey: "admin-set-retry",
    requestFingerprint: "admin-set-retry-fingerprint",
  };
  const first = await service.adjustPermanentSongQuotaByOperation(store, input);
  const second = await service.adjustPermanentSongQuotaByOperation(store, input);
  assert.equal(first.transaction.id, second.transaction.id);
  assert.equal(store.account.permanentBalance, 6);
  assert.equal(store.transactions.length, 1);
});

test("管理员额度调整指纹覆盖操作与内部备注并拒绝跨用户幂等重放", async () => {
  const policy = await import("../../server/utils/song-quota-policy.ts");
  const first = policy.fingerprintQuotaAdjustment({
    userId: 7,
    delta: 3,
    operation: "INCREMENT",
    internalNote: "工单 A",
  });
  const changedOperation = policy.fingerprintQuotaAdjustment({
    userId: 7,
    delta: 3,
    operation: "SET",
    internalNote: "工单 A",
  });
  const changedNote = policy.fingerprintQuotaAdjustment({
    userId: 7,
    delta: 3,
    operation: "INCREMENT",
    internalNote: "工单 B",
  });
  assert.notEqual(first, changedOperation);
  assert.notEqual(first, changedNote);

  const store = createStore(account({ permanentBalance: 1 }));
  store.transactions.push({
    id: 1,
    accountId: 2,
    quotaType: "PERMANENT",
    source: "ADMIN_ADJUST",
    delta: 1,
    balanceAfter: 2,
    periodKey: null,
    idempotencyKey: "admin-cross-user",
    requestFingerprint: "same-fingerprint",
    createdAt: NOW,
  });
  await assert.rejects(
    adjustPermanentSongQuota(store, {
      userId: 7,
      delta: 1,
      source: "ADMIN_ADJUST",
      now: NOW,
      idempotencyKey: "admin-cross-user",
      requestFingerprint: "same-fingerprint",
    }),
    (error) => error?.data?.code === "SONG_QUOTA_IDEMPOTENCY_CONFLICT",
  );
});


test("开放 API 额度使用三项独立最小权限并移除旧券写权限", () => {
  const middleware = readFileSync(
    new URL("../../server/middleware/api-auth.ts", import.meta.url),
    "utf8",
  );
  const permissions = readFileSync(
    new URL("../../server/api/admin/api-keys/permissions.ts", import.meta.url),
    "utf8",
  );
  const manager = readFileSync(
    new URL("../../app/components/Admin/ApiKeyManager.vue", import.meta.url),
    "utf8",
  );
  for (const scope of ["song-quotas:read", "song-quotas:adjust", "song-quota-transactions:read"]) {
    assert.match(middleware, new RegExp(scope));
    assert.match(permissions, new RegExp(scope));
    assert.match(manager, new RegExp(scope));
  }
  assert.doesNotMatch(permissions, /card-codes:write|card-codes:delete/);
  assert.doesNotMatch(manager, /card-codes:write|card-codes:delete/);
});

test("开放 API 额度权限按精确路径和方法隔离", () => {
  const source = readFileSync(
    new URL("../../server/middleware/api-auth.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /normalizedPathname === '\/api\/open\/song-quotas'/);
  assert.match(source, /normalizedPathname === '\/api\/open\/song-quotas\/adjust'/);
  assert.match(source, /normalizedPathname === '\/api\/open\/song-quotas\/transactions'/);
  assert.match(source, /method === 'GET'.*song-quotas:read/s);
  assert.match(source, /method === 'POST'.*song-quotas:adjust/s);
  assert.match(source, /song-quota-transactions:read/);
});

test("开放 API 额度账户查询校验 API Key、用户归属、输入边界并限流", () => {
  const source = readFileSync(
    new URL("../../server/api/open/song-quotas/index.get.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /event\.context\.apiKey/);
  assert.match(source, /openSongQuotaAccountQuerySchema\.safeParse/);
  assert.match(source, /requireOpenSongQuotaUser/);
  assert.match(source, /enforceOpenSongQuotaRateLimit/);
  assert.match(source, /getSongQuotaAccountDetails/);
  assert.doesNotMatch(source, /password|email|lastLoginIp/);
});

test("开放 API 额度流水限定用户归属、分页并输出脱敏字段", () => {
  const source = readFileSync(
    new URL("../../server/api/open/song-quotas/transactions.get.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /openSongQuotaTransactionQuerySchema\.safeParse/);
  assert.match(source, /requireOpenSongQuotaUser/);
  assert.match(source, /userId:\s*user\.id/);
  assert.match(source, /buildPublicSongQuotaTransaction/);
  assert.match(source, /enforceOpenSongQuotaRateLimit/);
  assert.doesNotMatch(source, /internalNote|requestFingerprint|idempotencyKey|snapshot/);
});

test("开放 API 永久额度调整要求幂等键、严格输入、归属与可重试事务", () => {
  const source = readFileSync(
    new URL("../../server/api/open/song-quotas/adjust.post.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /openSongQuotaAdjustmentSchema\.safeParse/);
  assert.match(source, /Idempotency-Key/);
  assert.match(source, /idempotencyKey\.length/);
  assert.match(source, /requireOpenSongQuotaUser/);
  assert.match(source, /enforceOpenSongQuotaRateLimit/);
  assert.match(source, /runSongQuotaDrizzleTransaction/);
  assert.match(source, /adjustPermanentSongQuota/);
  assert.match(source, /source:\s*'OPEN_API_ADJUST'/);
  assert.match(source, /apiKeyId:\s*apiKey\.id/);
  assert.match(source, /fingerprintQuotaAdjustment/);
  assert.doesNotMatch(source, /PERIODIC|Date\.now\(\)|new Date\(\)/);
});

test("开放 API 日志对备注、幂等键和外部单号脱敏", () => {
  const source = readFileSync(
    new URL("../../server/middleware/api-auth.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /sanitizeOpenApiRequestBody/);
  for (const field of ["internalNote", "idempotencyKey", "externalReference"]) {
    assert.match(source, new RegExp(field));
  }
  assert.match(source, /'\[REDACTED\]'/);
});
