"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { AccountDeletionError, deleteOwnAccount } from "@/lib/account-lifecycle";

export type DeleteAccountState = { error?: string; needsAnotherParent?: boolean };

async function signOutWithNotice(notice: "cikis" | "hesap-silindi") {
  (await cookies()).set("elat-account-notice", notice, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.AUTH_URL?.startsWith("https://") ?? false,
    maxAge: 120,
    path: "/giris",
  });
  await signOut({ redirectTo: `/giris?durum=${notice}` });
}

export async function signOutCurrentAccount(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris");

  await signOutWithNotice("cikis");
}

export async function deleteCurrentAccount(
  _previous: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/giris");

  if (formData.get("intent") !== "delete-self") {
    return { error: "Hesabını silmek için açılan onayı kullan." };
  }
  if (formData.get("expectedUserId") !== session.user.id) {
    return { error: "Oturumun değişti. Ben bölümünü yenileyip tekrar dene." };
  }

  try {
    await deleteOwnAccount(session.user.id);
  } catch (error) {
    if (error instanceof AccountDeletionError) {
      return { error: error.message, needsAnotherParent: error.code === "LAST_PARENT" };
    }
    console.error("Account deletion failed", error instanceof Error ? error.name : "unknown");
    return { error: "Hesap silinemedi. Biraz sonra tekrar dene." };
  }

  await signOutWithNotice("hesap-silindi");
  return {};
}
