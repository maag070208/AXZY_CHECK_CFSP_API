import { z } from "zod";
import { CreateScheduleSchema, UpdateScheduleSchema } from "./schemas/schedule.schema";

export type IScheduleCreateRequest = z.infer<typeof CreateScheduleSchema>["body"];
export type IScheduleUpdateRequest = z.infer<typeof UpdateScheduleSchema>["body"];
