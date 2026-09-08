import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit faire au moins 2 caractères").max(60),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  city: z.string().trim().min(2, "Indique ta ville").max(80),
  password: z.string().min(8, "8 caractères minimum"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const itemCategories = ["BOARD_GAME", "ROLE_PLAYING", "OTHER"] as const;
export const itemConditions = ["NEW", "LIKE_NEW", "GOOD", "WORN"] as const;

export const itemSchema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  category: z.enum(itemCategories),
  condition: z.enum(itemConditions),
  photoUrl: z.string().trim().url("URL de photo invalide").optional().or(z.literal("")),
});

export const eventLevels = ["ALL_LEVELS", "BEGINNER", "INTERMEDIATE", "EXPERT"] as const;
export const eventRecurrences = ["ONE_OFF", "WEEKLY", "MONTHLY"] as const;

export const eventSchema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  gameType: z.enum(itemCategories),
  gameName: z.string().trim().max(120).optional().or(z.literal("")),
  level: z.enum(eventLevels),
  recurrence: z.enum(eventRecurrences),
  city: z.string().trim().min(2, "Indique une ville").max(80),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  startAt: z
    .string()
    .min(1, "Indique une date et une heure")
    .transform((value, ctx) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        ctx.addIssue({ code: "custom", message: "Date invalide" });
        return z.NEVER;
      }
      if (date.getTime() < Date.now()) {
        ctx.addIssue({ code: "custom", message: "La date doit être dans le futur" });
        return z.NEVER;
      }
      return date;
    }),
  maxParticipants: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((value, ctx) => {
      if (!value) return undefined;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) {
        ctx.addIssue({ code: "custom", message: "Nombre de places invalide" });
        return z.NEVER;
      }
      return n;
    }),
});
