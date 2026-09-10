import { z } from "zod";

/**
 * Les messages de ces schémas sont des CLÉS de traduction, pas du texte.
 * Les schémas sont construits au chargement du module, bien avant qu'on sache
 * dans quelle langue lit la personne : c'est donc l'action qui traduit, au
 * moment de renvoyer l'erreur.
 */

export const registerSchema = z.object({
  name: z.string().trim().min(2, "validation.name.min").max(60),
  email: z.string().trim().toLowerCase().email("validation.email"),
  city: z.string().trim().min(2, "validation.city").max(80),
  password: z.string().min(8, "validation.password.min"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("validation.email"),
  password: z.string().min(1, "validation.password.required"),
});

export const gameCategories = ["BOARD_GAME", "ROLE_PLAYING", "OTHER"] as const;
export const playerLevels = ["BEGINNER", "INTERMEDIATE", "CONFIRMED"] as const;
export const itemConditions = ["NEW", "LIKE_NEW", "GOOD", "WORN"] as const;
export const cardRarities = ["COMMON", "RARE", "FOIL", "MYTHIC"] as const;
export const eventTypes = ["BOARD_GAME", "ROLE_PLAYING", "TCG", "DISCOVERY"] as const;
export const locales = ["FR", "EN"] as const;

export const gameCopySchema = z.object({
  title: z.string().trim().min(1, "validation.title.required").max(120),
  category: z.enum(gameCategories),
  condition: z.enum(itemConditions),
  minPlayers: z.string().optional().or(z.literal("")),
  maxPlayers: z.string().optional().or(z.literal("")),
  durationMin: z.string().optional().or(z.literal("")),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  photoUrl: z.string().trim().url("validation.photoUrl").optional().or(z.literal("")),
});

export const cardCopySchema = z.object({
  name: z.string().trim().min(1, "validation.cardName.required").max(120),
  setName: z.string().trim().max(120).optional().or(z.literal("")),
  rarity: z.enum(cardRarities),
  mode: z.enum(["DOUBLE", "WANT"]),
});

export const reviewSchema = z.object({
  rating: z
    .string()
    .transform((value, ctx) => {
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1 || n > 5) { ctx.addIssue({ code: "custom", message: "validation.rating" }); return z.NEVER; }
      return n;
    }),
  comment: z.string().trim().min(1, "validation.comment.required").max(1000),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "validation.name.min").max(60),
  city: z.string().trim().min(2, "validation.city").max(80),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
  experienceLevel: z.enum(playerLevels),
  locale: z.enum(locales),
  avatarUrl: z.string().trim().url("validation.photoUrl").optional().or(z.literal("")),
});

export const eventSchema = z.object({
  title: z.string().trim().min(1, "validation.title.required").max(120),
  type: z.enum(eventTypes),
  level: z.enum(playerLevels),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  bringList: z.string().trim().max(500).optional().or(z.literal("")),
  city: z.string().trim().min(2, "validation.eventCity").max(80),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  startAt: z
    .string()
    .min(1, "validation.date.required")
    .transform((value, ctx) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) { ctx.addIssue({ code: "custom", message: "validation.date.invalid" }); return z.NEVER; }
      if (date.getTime() < Date.now()) { ctx.addIssue({ code: "custom", message: "validation.date.future" }); return z.NEVER; }
      return date;
    }),
  endAt: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((value, ctx) => {
      if (!value) return undefined;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) { ctx.addIssue({ code: "custom", message: "validation.endDate.invalid" }); return z.NEVER; }
      return date;
    }),
  languages: z
    .array(z.enum(locales))
    .min(1, "validation.languages.required"),
  maxParticipants: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((value, ctx) => {
      if (!value) return undefined;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 1) { ctx.addIssue({ code: "custom", message: "validation.places.invalid" }); return z.NEVER; }
      return n;
    }),
});

/**
 * Même formulaire que `eventSchema`, sans l'exigence « dans le futur ».
 *
 * À la création, une table dans le passé est forcément une erreur de saisie.
 * À la modification, non : l'organisateur corrige souvent un lieu ou une
 * description alors que la partie vient de commencer, et lui refuser
 * l'enregistrement à cause de la date serait absurde.
 */
export const eventUpdateSchema = eventSchema.extend({
  startAt: z
    .string()
    .min(1, "validation.date.required")
    .transform((value, ctx) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) { ctx.addIssue({ code: "custom", message: "validation.date.invalid" }); return z.NEVER; }
      return date;
    }),
});
