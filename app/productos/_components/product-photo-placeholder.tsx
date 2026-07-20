export function ProductPhotoPlaceholder({ size = "lg" }: { size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-10 w-10",
    md: "h-20 w-20",
    lg: "h-48 w-full max-w-sm",
  };

  const iconSize = size === "sm" ? "text-lg" : size === "md" ? "text-2xl" : "text-4xl";

  return (
    <div
      data-testid="product-photo-placeholder"
      className={`${sizeClasses[size]} flex items-center justify-center rounded-[8px] border border-[var(--border)] bg-[#F6F7F6]`}
    >
      <span className={`${iconSize} text-[#9AA7AB]`} aria-hidden="true">
        📷
      </span>
    </div>
  );
}
