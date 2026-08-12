import { SERVER_ERROR_CODES } from "../config/constants.ts";
import { createApiError } from "../utils/apiError.ts";
import {
  fingerprintQuotaAdjustment,
  fingerprintSongQuotaConsumption,
  getQuotaPeriodWindow,
  resolveQuotaReturn,
  selectQuotaConsumption,
} from "../utils/song-quota-policy.ts";

const ERROR_CODES = {
  insufficient: SERVER_ERROR_CODES.SONG_QUOTA_INSUFFICIENT,
  negativeBalance: SERVER_ERROR_CODES.SONG_QUOTA_NEGATIVE_BALANCE,
  alreadyReturned: SERVER_ERROR_CODES.SONG_QUOTA_ALREADY_RETURNED,
  invalidAdjustment: SERVER_ERROR_CODES.SONG_QUOTA_INVALID_ADJUSTMENT,
  cardUnavailable: SERVER_ERROR_CODES.SONG_QUOTA_LEGACY_CARD_UNAVAILABLE,
  idempotencyConflict: SERVER_ERROR_CODES.SONG_QUOTA_IDEMPOTENCY_CONFLICT,
} as const;

type QuotaSettings = {
  songQuotaEnabled: boolean;
  songQuotaPeriodType: "DAILY" | "WEEKLY" | "MONTHLY";
  songQuotaPeriodAmount: number;
  adminSongQuotaExempt: boolean;
  blockOnSongQuotaInsufficient: boolean;
};

type QuotaAccount = {
  id: number;
  userId: number;
  periodicBalance: number;
  permanentBalance: number;
  periodKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type QuotaTransaction = Record<string, unknown> & {
  id: number;
  quotaType: "PERIODIC" | "PERMANENT";
  periodKey: string | null;
  requestFingerprint?: string | null;
};
type QuotaSong = Record<string, unknown> & {
  id: number;
  requesterId: number;
  cardCodeId: number | null;
  hitRequestId?: number | null;
  played?: boolean;
  quotaConsumed: boolean;
  quotaType: "PERIODIC" | "PERMANENT" | null;
  quotaPeriodKey: string | null;
  quotaReturned: boolean;
};
type LegacyCard = Record<string, unknown> & { status: string };
type PaginatedQuotaResult = {
  items: Array<Record<string, unknown>>;
  total: number;
  page: number;
  limit: number;
};

type QuotaAdapter = {
  ensureAccount(userId: number): Promise<void>;
  lockAccount(userId: number): Promise<QuotaAccount | null>;
  lockIdempotencyKey(idempotencyKey: string): Promise<void>;
  updateAccount(
    accountId: number,
    changes: Partial<QuotaAccount>,
    expected?: Partial<Pick<QuotaAccount, "periodicBalance" | "permanentBalance" | "periodKey">>,
  ): Promise<QuotaAccount | null>;
  findTransactionByIdempotencyKey?(idempotencyKey: string): Promise<QuotaTransaction | null>;
  insertTransaction(values: Record<string, unknown>): Promise<QuotaTransaction>;
  attachTransactionToSong?(transactionId: number, songId: number): Promise<QuotaTransaction | null>;
  lockSong?(songId: number): Promise<QuotaSong | null>;
  markSongReturned?(songId: number, transactionId: number): Promise<QuotaSong | null>;
  lockLegacyCard?(cardId: number): Promise<LegacyCard | null>;
  lockLegacyCardByCode?(code: string): Promise<LegacyCard | null>;
  markLegacyCardConverted?(
    cardId: number,
    userId: number,
    convertedAt: Date,
  ): Promise<LegacyCard | null>;
  listTransactions?(input: Record<string, unknown>): Promise<PaginatedQuotaResult>;
  listAccounts?(input: Record<string, unknown>): Promise<PaginatedQuotaResult>;
  getAccountDetails?(userId: number): Promise<Record<string, unknown> | null>;
};

function requireAccount(account: QuotaAccount | null): QuotaAccount {
  if (!account) {
    throw new Error("点歌额度账户创建失败");
  }
  return account;
}

async function lockOrCreateAccount(dbOrTx: QuotaAdapter, userId: number) {
  await dbOrTx.ensureAccount(userId);
  return requireAccount(await dbOrTx.lockAccount(userId));
}

export function buildSongQuotaAccountResponse(
  account: QuotaAccount,
  settings: QuotaSettings,
  now: Date,
  isAdministrator: boolean,
) {
  const { nextRefreshAt } = getQuotaPeriodWindow(settings.songQuotaPeriodType, now);
  const consumption =
    !settings.songQuotaEnabled || (isAdministrator && settings.adminSongQuotaExempt)
      ? null
      : selectQuotaConsumption(account);
  return {
    userId: account.userId,
    periodicBalance: account.periodicBalance,
    permanentBalance: account.permanentBalance,
    totalBalance: account.periodicBalance + account.permanentBalance,
    periodKey: account.periodKey,
    periodType: settings.songQuotaPeriodType,
    periodAmount: settings.songQuotaPeriodAmount,
    nextRefreshAt: nextRefreshAt.toISOString(),
    estimatedConsumptionType: consumption?.quotaType ?? null,
    enabled: settings.songQuotaEnabled,
    insufficientBlocked: settings.blockOnSongQuotaInsufficient,
  };
}

export async function getSongQuotaAccount(
  dbOrTx: QuotaAdapter,
  userId: number,
  settings: QuotaSettings,
  now: Date,
) {
  const account = await lockOrCreateAccount(dbOrTx, userId);
  if (!settings.songQuotaEnabled) return account;
  return refreshSongQuotaPeriod(dbOrTx, account, settings, now);
}

export async function refreshSongQuotaPeriod(
  tx: QuotaAdapter,
  account: QuotaAccount,
  settings: QuotaSettings,
  now: Date,
) {
  const { periodKey } = getQuotaPeriodWindow(settings.songQuotaPeriodType, now);
  if (account.periodKey === periodKey) return account;

  if (account.periodKey && account.periodicBalance > 0) {
    await tx.insertTransaction({
      accountId: account.id,
      quotaType: "PERIODIC",
      source: "PERIOD_EXPIRED",
      delta: -account.periodicBalance,
      balanceAfter: 0,
      periodKey: account.periodKey,
      idempotencyKey: `period-expire:${account.userId}:${account.periodKey}`,
      createdAt: now,
    });
  }

  const updated = requireAccount(
    await tx.updateAccount(
      account.id,
      {
        periodicBalance: settings.songQuotaPeriodAmount,
        periodKey,
        updatedAt: now,
      },
      {
        periodicBalance: account.periodicBalance,
        periodKey: account.periodKey,
      },
    ),
  );
  await tx.insertTransaction({
    accountId: account.id,
    quotaType: "PERIODIC",
    source: "PERIOD_GRANT",
    delta: settings.songQuotaPeriodAmount,
    balanceAfter: settings.songQuotaPeriodAmount,
    periodKey,
    idempotencyKey: `period-grant:${account.userId}:${periodKey}`,
    createdAt: now,
  });
  return updated;
}

export async function consumeSongQuota(
  tx: QuotaAdapter,
  input: {
    userId: number;
    songId: number | null;
    requestId: string;
    settings: QuotaSettings;
    now: Date;
    isAdministrator: boolean;
  },
) {
  if (input.isAdministrator && input.settings.adminSongQuotaExempt) return null;
  if (!input.settings.songQuotaEnabled) return null;

  const requestId = typeof input.requestId === "string" ? input.requestId.trim() : "";
  if (!requestId) {
    throw new Error("点歌额度消费必须提供 requestId");
  }
  const idempotencyKey = `song-consume:${requestId}`;
  const requestFingerprint = fingerprintSongQuotaConsumption({ userId: input.userId, requestId });
  await tx.lockIdempotencyKey(idempotencyKey);
  const existing = await tx.findTransactionByIdempotencyKey?.(idempotencyKey);
  if (existing) {
    if (existing.requestFingerprint !== requestFingerprint) {
      throw createApiError(409, ERROR_CODES.idempotencyConflict, "幂等键已用于不同的额度消费请求");
    }
    const account = await lockOrCreateAccount(tx, input.userId);
    return {
      quotaType: existing.quotaType,
      periodKey: existing.periodKey,
      transactionId: existing.id,
      account,
    };
  }

  const account = await getSongQuotaAccount(tx, input.userId, input.settings, input.now);
  const consumption = selectQuotaConsumption(account);
  if (!consumption) {
    if (!input.settings.blockOnSongQuotaInsufficient) return null;
    throw createApiError(400, ERROR_CODES.insufficient, "点歌额度不足");
  }

  const balanceField =
    consumption.quotaType === "PERIODIC" ? "periodicBalance" : "permanentBalance";
  const currentBalance = account[balanceField];
  const updated = requireAccount(
    await tx.updateAccount(
      account.id,
      {
        [balanceField]: currentBalance - 1,
        updatedAt: input.now,
      },
      {
        [balanceField]: currentBalance,
      },
    ),
  );
  const balanceAfter =
    consumption.quotaType === "PERIODIC" ? updated.periodicBalance : updated.permanentBalance;
  const transaction = await tx.insertTransaction({
    accountId: account.id,
    quotaType: consumption.quotaType,
    source: "SONG_REQUEST",
    delta: -1,
    balanceAfter,
    periodKey: consumption.quotaType === "PERIODIC" ? account.periodKey : null,
    idempotencyKey,
    requestFingerprint,
    songId: input.songId,
    createdAt: input.now,
  });

  return {
    quotaType: consumption.quotaType,
    periodKey: consumption.quotaType === "PERIODIC" ? account.periodKey : null,
    transactionId: transaction.id,
    account: updated,
  };
}

export async function executeSequentialSongImports<
  T extends { id: number },
  R extends { id: number },
>(songs: T[], requestSong: (song: T, index: number) => Promise<R>) {
  const details: Array<
    | { sourceId: number; success: true; songId: number }
    | { sourceId: number; success: false; error: string }
  > = [];
  for (const [index, song] of songs.entries()) {
    try {
      const result = await requestSong(song, index);
      details.push({ sourceId: song.id, success: true, songId: result.id });
    } catch (error) {
      details.push({
        sourceId: song.id,
        success: false,
        error: error instanceof Error ? error.message : "导入失败",
      });
    }
  }
  return {
    total: songs.length,
    success: details.filter((item) => item.success).length,
    failed: details.filter((item) => !item.success).length,
    details,
  };
}

export async function executeSongQuotaSubmission<T extends { id: number }>(
  tx: QuotaAdapter,
  input: {
    userId: number;
    requestId: string;
    settings: QuotaSettings;
    now: Date;
    isAdministrator: boolean;
    insertSong: (quotaSnapshot: {
      quotaConsumed: boolean;
      quotaType: "PERIODIC" | "PERMANENT" | null;
      quotaTransactionId: number | null;
      quotaPeriodKey: string | null;
    }) => Promise<T>;
  },
) {
  const consumption = await consumeSongQuota(tx, {
    userId: input.userId,
    songId: null,
    requestId: input.requestId,
    settings: input.settings,
    now: input.now,
    isAdministrator: input.isAdministrator,
  });
  const song = await input.insertSong({
    quotaConsumed: consumption !== null,
    quotaType: consumption?.quotaType ?? null,
    quotaTransactionId: consumption?.transactionId ?? null,
    quotaPeriodKey: consumption?.periodKey ?? null,
  });
  if (consumption) {
    if (!tx.attachTransactionToSong) {
      throw new Error("额度适配器不支持流水歌曲回填");
    }
    const attached = await tx.attachTransactionToSong(consumption.transactionId, song.id);
    if (!attached) {
      throw new Error("点歌额度流水歌曲回填失败");
    }
  }
  return song;
}

export async function returnSongQuota(
  tx: QuotaAdapter,
  input: { songId: number; settings: QuotaSettings; now: Date },
) {
  if (!tx.lockSong || !tx.markSongReturned) {
    throw new Error("额度适配器不支持歌曲返还");
  }
  const song = await tx.lockSong(input.songId);
  if (!song?.quotaConsumed || !song.quotaType) return null;
  if (song.quotaReturned) {
    throw createApiError(409, ERROR_CODES.alreadyReturned, "点歌额度已返还");
  }

  const account = await getSongQuotaAccount(tx, song.requesterId, input.settings, input.now);
  const currentPeriodKey = getQuotaPeriodWindow(
    input.settings.songQuotaPeriodType,
    input.now,
  ).periodKey;
  const status = resolveQuotaReturn(song.quotaType, song.quotaPeriodKey, currentPeriodKey);
  const nextBalance =
    status === "RETURNED"
      ? song.quotaType === "PERIODIC"
        ? account.periodicBalance + 1
        : account.permanentBalance + 1
      : song.quotaType === "PERIODIC"
        ? account.periodicBalance
        : account.permanentBalance;

  const updated =
    status === "RETURNED"
      ? requireAccount(
          await tx.updateAccount(
            account.id,
            {
              [song.quotaType === "PERIODIC" ? "periodicBalance" : "permanentBalance"]: nextBalance,
              updatedAt: input.now,
            },
            {
              [song.quotaType === "PERIODIC" ? "periodicBalance" : "permanentBalance"]:
                song.quotaType === "PERIODIC" ? account.periodicBalance : account.permanentBalance,
            },
          ),
        )
      : account;
  const transaction = await tx.insertTransaction({
    accountId: account.id,
    quotaType: song.quotaType,
    source: status === "RETURNED" ? "SONG_WITHDRAW_RETURN" : "SONG_WITHDRAW_EXPIRED",
    delta: status === "RETURNED" ? 1 : 0,
    balanceAfter: nextBalance,
    periodKey: song.quotaPeriodKey,
    idempotencyKey: `song-return:${input.songId}`,
    songId: input.songId,
    createdAt: input.now,
  });
  const marked = await tx.markSongReturned(input.songId, transaction.id);
  if (!marked) {
    throw createApiError(409, ERROR_CODES.alreadyReturned, "点歌额度已返还");
  }

  return { status, transaction, account: updated };
}

export async function executeSongWithdrawal(
  tx: QuotaAdapter,
  input: {
    songId: number;
    operatorId: number;
    settings: QuotaSettings;
    now: Date;
    validateLockedSong?: (song: QuotaSong) => Promise<void>;
    releaseLegacyCard: (input: {
      songId: number;
      cardCodeId: number;
      operatorId: number;
      now: Date;
    }) => Promise<unknown>;
    deleteDraftSchedules: (song: QuotaSong) => Promise<void>;
    deleteSongRelations: (song: QuotaSong) => Promise<void>;
    decrementRequestTime: (song: QuotaSong) => Promise<void>;
    deleteSong: (song: QuotaSong) => Promise<void>;
  },
) {
  if (!tx.lockSong) {
    throw new Error("额度适配器不支持歌曲锁定");
  }
  if (typeof input.deleteDraftSchedules !== "function") {
    throw new Error("撤回歌曲必须提供草稿排期清理步骤");
  }
  const song = await tx.lockSong(input.songId);
  if (!song) {
    throw createApiError(404, SERVER_ERROR_CODES.SONG_NOT_FOUND, "歌曲不存在或已被删除");
  }
  await input.validateLockedSong?.(song);

  let quotaReturnResult: "RETURNED" | "EXPIRED" | "NOT_APPLICABLE" = "NOT_APPLICABLE";
  if (song.cardCodeId) {
    const releaseResult = await input.releaseLegacyCard({
      songId: song.id,
      cardCodeId: song.cardCodeId,
      operatorId: input.operatorId,
      now: input.now,
    });
    if (
      !releaseResult ||
      typeof releaseResult !== "object" ||
      !("changed" in releaseResult) ||
      releaseResult.changed !== true
    ) {
      throw createApiError(
        409,
        SERVER_ERROR_CODES.SONG_CARD_RELEASE_FAILED,
        "点歌券释放失败，撤回已终止",
        { releaseResult },
      );
    }
  } else {
    const result = await returnSongQuota(tx, {
      songId: song.id,
      settings: input.settings,
      now: input.now,
    });
    quotaReturnResult = result?.status ?? "NOT_APPLICABLE";
  }

  await input.deleteDraftSchedules(song);
  await input.deleteSongRelations(song);
  await input.decrementRequestTime(song);
  await input.deleteSong(song);
  return { quotaReturnResult };
}

export async function adjustPermanentSongQuota(
  tx: QuotaAdapter,
  input: {
    userId: number;
    delta: number;
    source: "ADMIN_ADJUST" | "ADMIN_BULK_ADJUST" | "OPEN_API_ADJUST" | "LEGACY_CARD_CONVERT";
    now: Date;
    idempotencyKey: string;
    requestFingerprint: string;
    [key: string]: unknown;
  },
) {
  if (!Number.isSafeInteger(input.delta) || input.delta === 0) {
    throw createApiError(400, ERROR_CODES.invalidAdjustment, "额度调整值必须为非零整数");
  }
  const idempotencyKey =
    typeof input.idempotencyKey === "string" ? input.idempotencyKey.trim() : "";
  const requestFingerprint =
    typeof input.requestFingerprint === "string" ? input.requestFingerprint.trim() : "";
  if (!idempotencyKey || !requestFingerprint) {
    throw new Error("永久额度调整必须提供幂等键和请求指纹");
  }
  await tx.lockIdempotencyKey(idempotencyKey);
  if (tx.findTransactionByIdempotencyKey) {
    const existing = await tx.findTransactionByIdempotencyKey(idempotencyKey);
    if (existing) {
      const account = await lockOrCreateAccount(tx, input.userId);
      if (
        existing.requestFingerprint !== input.requestFingerprint ||
        existing.accountId !== account.id
      ) {
        throw createApiError(
          409,
          ERROR_CODES.idempotencyConflict,
          "幂等键已用于不同的额度调整请求",
        );
      }
      return { account, transaction: existing };
    }
  }
  const account = await lockOrCreateAccount(tx, input.userId);
  const permanentBalance = account.permanentBalance + input.delta;
  if (permanentBalance < 0) {
    throw createApiError(400, ERROR_CODES.negativeBalance, "调整后额度不能小于零");
  }
  const updated = requireAccount(
    await tx.updateAccount(
      account.id,
      {
        permanentBalance,
        updatedAt: input.now,
      },
      {
        permanentBalance: account.permanentBalance,
      },
    ),
  );
  const transaction = await tx.insertTransaction({
    ...input,
    accountId: account.id,
    quotaType: "PERMANENT",
    balanceAfter: permanentBalance,
    createdAt: input.now,
  });
  return { account: updated, transaction };
}

export async function convertLegacyCardToQuota(
  tx: QuotaAdapter,
  input: { userId: number; cardId?: number; cardCode?: string; now: Date },
) {
  if (!tx.markLegacyCardConverted) {
    throw new Error("额度适配器不支持旧点歌券兑换");
  }
  const card = typeof input.cardCode === "string"
    ? await tx.lockLegacyCardByCode?.(input.cardCode)
    : typeof input.cardId === "number"
      ? await tx.lockLegacyCard?.(input.cardId)
      : null;
  if (!card || card.status !== "AVAILABLE" || typeof card.id !== "number") {
    throw createApiError(409, ERROR_CODES.cardUnavailable, "旧点歌券不可兑换");
  }
  const converted = await tx.markLegacyCardConverted(card.id, input.userId, input.now);
  if (!converted) {
    throw createApiError(409, ERROR_CODES.cardUnavailable, "旧点歌券不可兑换");
  }
  return adjustPermanentSongQuota(tx, {
    userId: input.userId,
    delta: 1,
    source: "LEGACY_CARD_CONVERT",
    now: input.now,
    idempotencyKey: `legacy-card:${card.id}`,
    requestFingerprint: fingerprintQuotaAdjustment({ userId: input.userId, delta: 1 }),
    legacyCardId: card.id,
  });
}

export function buildPublicSongQuotaTransaction(transaction: Record<string, unknown>) {
  return {
    id: transaction.id,
    quotaType: transaction.quotaType,
    source: transaction.source,
    delta: transaction.delta,
    balanceAfter: transaction.balanceAfter,
    periodKey: transaction.periodKey,
    songId: transaction.songId,
    legacyCardId: transaction.legacyCardId,
    publicDescription: transaction.publicDescription,
    createdAt: transaction.createdAt,
  };
}

export async function listSongQuotaTransactions(
  dbOrTx: QuotaAdapter,
  input: Record<string, unknown>,
) {
  if (!dbOrTx.listTransactions) {
    throw new Error("额度适配器不支持流水查询");
  }
  return dbOrTx.listTransactions(input);
}


export async function adjustPermanentSongQuotaByOperation(
  tx: QuotaAdapter,
  input: {
    userId: number;
    operation: "INCREMENT" | "DECREMENT" | "SET";
    amount: number;
    source: "ADMIN_ADJUST";
    now: Date;
    idempotencyKey: string;
    requestFingerprint: string;
    [key: string]: unknown;
  },
) {
  await tx.lockIdempotencyKey(input.idempotencyKey);
  const existing = await tx.findTransactionByIdempotencyKey?.(input.idempotencyKey);
  if (existing) {
    const account = await lockOrCreateAccount(tx, input.userId);
    if (
      existing.requestFingerprint !== input.requestFingerprint ||
      existing.accountId !== account.id
    ) {
      throw createApiError(
        409,
        ERROR_CODES.idempotencyConflict,
        "幂等键已用于不同的额度调整请求",
      );
    }
    return { account, transaction: existing };
  }
  const account = await lockOrCreateAccount(tx, input.userId);
  const delta =
    input.operation === "INCREMENT"
      ? input.amount
      : input.operation === "DECREMENT"
        ? -input.amount
        : input.amount - account.permanentBalance;
  if (delta === 0) {
    throw createApiError(400, ERROR_CODES.invalidAdjustment, "设定值必须与当前永久额度不同");
  }
  return adjustPermanentSongQuota(tx, { ...input, delta });
}

export function buildAdminSongQuotaTransaction(transaction: Record<string, unknown>) {
  return {
    id: transaction.id,
    user: {
      id: transaction.userId,
      name: transaction.userName,
      username: transaction.username,
    },
    quotaType: transaction.quotaType,
    source: transaction.source,
    delta: transaction.delta,
    balanceAfter: transaction.balanceAfter,
    periodKey: transaction.periodKey,
    songId: transaction.songId,
    legacyCardId: transaction.legacyCardId,
    administratorId: transaction.administratorId,
    publicDescription: transaction.publicDescription,
    internalNote: transaction.internalNote,
    externalReference: transaction.externalReference,
    createdAt: transaction.createdAt,
  };
}

export async function listSongQuotaAccounts(
  dbOrTx: QuotaAdapter,
  input: Record<string, unknown>,
) {
  if (!dbOrTx.listAccounts) throw new Error("额度适配器不支持账户列表查询");
  return dbOrTx.listAccounts(input);
}

export async function getSongQuotaAccountDetails(dbOrTx: QuotaAdapter, userId: number) {
  if (!dbOrTx.getAccountDetails) throw new Error("额度适配器不支持账户详情查询");
  return dbOrTx.getAccountDetails(userId);
}
