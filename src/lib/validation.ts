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

export const itemCategories = ["BOOK", "GAME", "OTHER"] as const;
export const itemConditions = ["NEW", "LIKE_NEW", "GOOD", "WORN"] as const;

export const itemSchema = z.object({
  title: z.string().trim().min(1, "Titre requis").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  category: z.enum(itemCategories),
  condition: z.enum(itemConditions),
  photoUrl: z.string().trim().url("URL de photo invalide").optional().or(z.literal("")),
});
