/**
 * Oda puan sınırları. Ayrı bir dosyada çünkü src/lib/rooms.ts Prisma
 * client'ı import ediyor — client component'lerden (formlardaki min/max
 * gösterimi gibi) oraya import atmak Prisma'yı tarayıcı paketine sızdırıyor.
 */
export const MIN_BASE_SCORE = 1;
export const MAX_BASE_SCORE = 500;
