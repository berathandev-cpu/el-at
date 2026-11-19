import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /** Ailede kullanıcıyı tanımlamak için kullanılan #ID... formatındaki kimlik. */
      publicId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    publicId?: string | null;
  }
}
