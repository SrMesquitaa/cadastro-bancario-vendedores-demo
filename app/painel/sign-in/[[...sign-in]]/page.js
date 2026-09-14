import { SignIn } from "@clerk/nextjs";
import LogoLink from "@/components/LogoLink";

export default function SignInPage() {
  return (
    <main className="min-h-screen flex flex-col items-center bg-gradient-to-br from-[#040464] to-[#0A0A7A] p-6">
      <div className="flex justify-center pt-8 pb-6">
        <LogoLink />
      </div>
      <SignIn />
    </main>
  );
}
