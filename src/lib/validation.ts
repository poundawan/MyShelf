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

export const gameCategories = ["BOARD_GAME", "ROLE_PLAYING", "OTHER"] as const;
export const playerLevels = ["BEGINNER", "INTERMEDIATE", "CONFIRMED"] as const;
export const itemConditions = ["NEW", "LIKE_NEW", "GOOD", "WORN"] as const;
export const cardRarities = ["COMMON", "RARE", "FOIL", "MYTHIC"] as const;
export const eventTypes = ["BOARD_GAME", "ROLE_PLAYING", "TCG", "DISCOVERY"] as const;

export const gameCopySchema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(120),
  category: z.enum(gameCategories),
  condition: z.enum(itemConditions),
  minPlayers: z.string().optional().or(z.literal("")),
  maxPlayers: z.string().optional().or(z.literal("")),
  durationMin: z.string().optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  photoUrl: z.string().trim().url("URL de photo invalide").optional().or(z.literal("")),
});

export const cardCopySchema = z.object({
  name: z.string().trim().min(1, "Nom de carte requis").max(120),
  setName: z.string().trim().max(120).optional().or(z.literal("")),
  rarity: z.enum(cardRarities),
  mode: z.enum(["DOUBLE", "WANT"]),
});

export const eventSchema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(120),
  type: z.enum(eventTypes),
  level: z.enum(playerLevels),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  bringList: z.string().trim().max(500).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Indique une ville").max(80),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  startAt: z
    .string()
    .min(1, "Indique une date et une heure")
    .transform((value, ctx) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) { ctx.addIssue({ code: "custom", message: "Date invalide" }); return z.NEVER; }
      if (date.getTime() < Date.now()) { ctx.addIssue({ code: "custom", message: "La date doit être dans le futur" }); return z.NEVER; }
      return date;
    }),
  endAt: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((value, ctx) => {
      if (!value) return undefined;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) { ctx.addIssue({ code: "custom", message: "Date de fin invalide" }); return z.NEVER; }
      return date;
    }),
  maxParticipants: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((value, ctx) => {
      if (!value) return undefined;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) { ctx.addIssue({ code: "custom", message: "Nombre de places invalide" }); return z.NEVER; }
      return n;
    }),
});
