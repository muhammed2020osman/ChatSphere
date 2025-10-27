import { NextAuthOptions } from "next-auth";
import { db } from "@/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "replit",
      name: "Replit",
      type: "oauth",
      authorization: {
        url: "https://replit.com/oauth",
        params: {
          scope: "read:user",
        },
      },
      token: "https://replit.com/oauth/token",
      userinfo: "https://replit.com/oauth/userinfo",
      clientId: process.env.REPLIT_CLIENT_ID,
      clientSecret: process.env.REPLIT_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    },
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: "/api/auth/signin",
    error: "/api/auth/error",
  },
  session: {
    strategy: "jwt",
  },
};
