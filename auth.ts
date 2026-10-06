import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isAllowedEmail } from "@/lib/auth/domain";

const allowedDomain = (process.env.ALLOWED_EMAIL_DOMAIN || "anduintransact.com").toLowerCase();

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true, // runs behind Dokploy's reverse proxy
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: { params: { hd: allowedDomain, prompt: "select_account" } },
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      return profile?.email_verified === true && isAllowedEmail(profile.email, allowedDomain);
    },
  },
});
