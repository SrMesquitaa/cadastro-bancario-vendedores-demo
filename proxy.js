import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware(async (auth, req) => {
  const { pathname } = req.nextUrl;
  const protegido =
    pathname.startsWith("/painel") &&
    !pathname.startsWith("/painel/sign-in") &&
    !pathname.startsWith("/painel/sign-up");
  if (protegido) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|.*\\..*).*)",
    "/(api|trpc)(.*)",
  ],
};
