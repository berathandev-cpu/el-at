"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";

import { signIn } from "@/auth";

export async function signInWithGoogle(formData: FormData) {
  const callbackUrl = formData.get("callbackUrl");
  const redirectTo =
    typeof callbackUrl === "string" &&
    callbackUrl.startsWith("/") &&
    !callbackUrl.startsWith("//") &&
    !callbackUrl.includes("\\")
      ? callbackUrl
      : "/bugun";

  await signIn("google", { redirectTo });
}

export async function signInWithDemo(formData: FormData) {
  if (process.env.NODE_ENV !== "development" || process.env.AUTH_DEMO_MODE !== "true") {
    return;
  }

  const profile = formData.get("profile");
  const password = formData.get("password");
  if (
    (profile !== "parent" && profile !== "child") ||
    typeof password !== "string"
  ) {
    return;
  }

  try {
    await signIn("demo", { profile, password, redirectTo: "/bugun" });
  } catch (error) {
    if (error instanceof AuthError && error.type === "CredentialsSignin") {
      redirect("/giris?error=CredentialsSignin");
    }
    throw error;
  }
}
