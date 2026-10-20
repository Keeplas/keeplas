import type { IconName } from "@/components/icon";

export const ITEM_ICONS: readonly { name: IconName; words: string[] }[] = [
  {
    name: "document",
    words: ["document", "file", "pdf", "contract", "contrat", "fichier"],
  },
  {
    name: "note",
    words: ["note", "text", "letter", "texte", "lettre", "message"],
  },
  { name: "photo", words: ["photo", "picture", "image", "scan"] },
  { name: "image-gallery", words: ["gallery", "album", "photos", "galerie"] },
  {
    name: "mic",
    words: ["voice", "audio", "recording", "voix", "enregistrement"],
  },
  { name: "video", words: ["video", "film", "movie", "vidéo"] },
  { name: "folder", words: ["folder", "archive", "dossier", "classeur"] },
  {
    name: "home",
    words: ["home", "house", "property", "maison", "propriété", "logement"],
  },
  {
    name: "lock",
    words: ["lock", "secret", "private", "safe", "coffre", "privé"],
  },
  {
    name: "passkey",
    words: ["key", "password", "login", "clé", "mot de passe", "identifiant"],
  },
  {
    name: "shield-check",
    words: ["insurance", "protection", "assurance", "garantie"],
  },
  { name: "user-circle", words: ["account", "profile", "compte", "profil"] },
  { name: "user", words: ["person", "identity", "id", "personne", "identité"] },
  {
    name: "people",
    words: ["family", "children", "kids", "famille", "enfants"],
  },
  { name: "phone", words: ["phone", "mobile", "call", "téléphone", "appel"] },
  { name: "mail", words: ["mail", "email", "letter", "courrier", "e-mail"] },
  {
    name: "globe",
    words: ["web", "website", "internet", "online", "site", "en ligne"],
  },
  {
    name: "laptop",
    words: ["computer", "laptop", "device", "ordinateur", "appareil"],
  },
  {
    name: "map-pin",
    words: ["place", "address", "location", "lieu", "adresse"],
  },
  {
    name: "clock",
    words: ["time", "deadline", "schedule", "date", "échéance", "rendez-vous"],
  },
  {
    name: "activity",
    words: ["health", "medical", "doctor", "santé", "médical", "médecin"],
  },
  {
    name: "lifebuoy",
    words: ["help", "emergency", "urgent", "urgence", "aide"],
  },
  { name: "inbox", words: ["inbox", "unsorted", "boîte", "à trier"] },
  {
    name: "edit",
    words: ["signature", "sign", "draft", "brouillon", "signer"],
  },
  {
    name: "send",
    words: ["wishes", "instructions", "message", "souhaits", "consignes"],
  },
  { name: "pin", words: ["pin", "important", "favorite", "favori", "épingle"] },
  {
    name: "flash",
    words: ["energy", "electricity", "utility", "énergie", "électricité"],
  },
  { name: "camera", words: ["camera", "appareil photo", "picture"] },
  { name: "cloud-upload", words: ["cloud", "backup", "sauvegarde", "nuage"] },
  {
    name: "shield-alert",
    words: ["warning", "risk", "danger", "alerte", "risque"],
  },
  {
    name: "check-circle",
    words: ["done", "approved", "valid", "validé", "approuvé"],
  },
  { name: "info", words: ["info", "information", "details", "détails"] },
];

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .trim();

export function searchIcons(
  query: string,
): readonly { name: IconName; words: string[] }[] {
  const needle = normalize(query);
  if (!needle) return ITEM_ICONS;
  return ITEM_ICONS.filter(
    (icon) =>
      normalize(icon.name).includes(needle) ||
      icon.words.some((word) => normalize(word).includes(needle)),
  );
}
