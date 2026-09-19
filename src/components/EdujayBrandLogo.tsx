import Image from "next/image";

type EdujayBrandLogoProps = {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
  priority?: boolean;
};

const logoSize = {
  sm: "h-8 w-auto",
  md: "h-10 w-auto",
  lg: "h-14 w-auto",
};

const wordSize = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
};

export default function EdujayBrandLogo({
  size = "md",
  showWordmark = true,
  className = "",
  priority = false,
}: EdujayBrandLogoProps) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`} aria-label="Edujay">
      <Image
        src="/edujay-logo.png"
        alt="Edujay"
        width={96}
        height={64}
        className={`${logoSize[size]} shrink-0 object-contain`}
        priority={priority}
        unoptimized
      />
      {showWordmark && (
        <span className={`font-nunito font-black leading-none tracking-tight text-[#061f5f] ${wordSize[size]}`}>
          Edujay
        </span>
      )}
    </span>
  );
}