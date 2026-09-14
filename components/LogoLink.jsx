import Image from "next/image";
import Link from "next/link";

export default function LogoLink({ className = "" }) {
  return (
    <Link href="/" className={`inline-block ${className}`}>
      <Image
        src="/logo-empresa.svg"
        alt="NovaVenda"
        width={220}
        height={52}
        className="opacity-90 hover:opacity-100 transition-opacity"
      />
    </Link>
  );
}
