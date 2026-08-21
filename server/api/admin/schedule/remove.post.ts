import { db, eq, ne, schedules, songs, and } from "~/drizzle/db";
import { restoreReplayRequestsToPending } from "~~/server/utils/scheduleReplayBinding";
import { getServerDate } from "~~/server/utils/serverTime";

export default defineEventHandler(async (event) => {
  // 验证管理员权限
  const user = event.context.user;
  if (!user || !["SONG_ADMIN", "ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    throw createError({
      statusCode: 403,
      message: "需要歌曲管理员及以上权限",
    });
  }

  try {
    const body = await readBody(event);
    const { scheduleId } = body;

    if (!scheduleId) {
      throw createError({
        statusCode: 400,
        message: "缺少排期 ID",
      });
    }

    const scheduleIdNumber = Number(scheduleId);

    console.log(`准备删除排期 ID=${scheduleIdNumber}`);

    const result = await db.transaction(async (tx) => {
      const existingSchedule = await tx
        .select({
          id: schedules.id,
          songId: schedules.songId,
          isDraft: schedules.isDraft,
        })
        .from(schedules)
        .where(eq(schedules.id, scheduleIdNumber))
        .limit(1)
        .for("update")
        .then((rows) => rows[0]);

      if (!existingSchedule) return null;

      const song = await tx
        .select({ title: songs.title })
        .from(songs)
        .where(eq(songs.id, existingSchedule.songId))
        .limit(1)
        .then((rows) => rows[0]);

      console.log(`找到排期 ID=${scheduleIdNumber}, 歌曲=${song?.title || "未知歌曲"}`);

      const deletedSchedule = await tx
        .delete(schedules)
        .where(eq(schedules.id, scheduleIdNumber))
        .returning();

      console.log(`成功删除排期 ID=${scheduleIdNumber}`);

      if (!existingSchedule.isDraft) {
        const otherSchedules = await tx
          .select({ id: schedules.id })
          .from(schedules)
          .where(
            and(
              eq(schedules.songId, existingSchedule.songId),
              eq(schedules.isDraft, false),
              ne(schedules.id, scheduleIdNumber),
            ),
          )
          .limit(1);

        if (otherSchedules.length === 0) {
          const restoredCount = await restoreReplayRequestsToPending({
            tx,
            songIds: [existingSchedule.songId],
            at: getServerDate(),
          });

          if (restoredCount > 0) {
            console.log(`恢复了 ${restoredCount} 个重播申请状态为 PENDING`);
          }
        } else {
          console.log(`该歌曲仍有其他正式排期，不恢复重播申请状态`);
        }
      }

      return deletedSchedule;
    });

    if (!result) {
      console.log(`排期不存在 ID=${scheduleIdNumber}`);
      return {
        success: false,
        message: "排期不存在或已被删除",
      };
    }

    return {
      success: true,
      schedule: result,
    };
  } catch (error: any) {
    console.error("移除排期失败:", error);

    // 处理数据库特定错误
    if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
      return {
        success: false,
        message: "排期不存在或已被删除",
      };
    }

    // 确保返回一个成功=false的响应，而不是抛出错误
    return {
      success: false,
      message: error.message || "移除排期失败",
      error: error.code || "UNKNOWN_ERROR",
    };
  }
});
