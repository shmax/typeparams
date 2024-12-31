import { z } from "zod";

export const FiltersSchema = z.object({
    filters: z.object({
        toyline: z.number(),
        tags: z.array(z.string()),
        isActive: z.boolean(),
    }),
});

export type Filters = z.infer<typeof FiltersSchema>; // { filters: { toyline: number; tags: string[]; isActive: boolean } }
