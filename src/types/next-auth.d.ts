import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "operator" | "technician";
    } & DefaultSession["user"];
  }

  interface User {
    role: "admin" | "operator" | "technician";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "admin" | "operator" | "technician";
  }
}
