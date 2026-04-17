import * as React from "react";
import { cn } from "./lib/utils";

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-12 h-12 text-sm",
  xl: "w-20 h-20 text-xl",
} as const;

export interface UserAvatarProps
  extends React.HTMLAttributes<HTMLDivElement> {
  imageUrl?: string | null;
  initials: string;
  alt?: string;
  size?: keyof typeof sizeClasses;
  /** Background for the initials fallback (e.g. "bg-primary text-on-primary"). */
  fallbackClassName?: string;
  /** Additional classes applied to the image (for borders, shadows). */
  imageClassName?: string;
  onImageError?: () => void;
}

const UserAvatar = React.forwardRef<HTMLDivElement, UserAvatarProps>(
  (
    {
      className,
      imageUrl,
      initials,
      alt,
      size = "md",
      fallbackClassName = "bg-primary text-on-primary",
      imageClassName,
      onImageError,
      ...props
    },
    ref
  ) => {
    const sizeClass = sizeClasses[size];
    const baseRound = "rounded-full shrink-0";

    if (imageUrl) {
      return (
        // eslint-disable-next-line jsx-a11y/alt-text
        <img
          src={imageUrl}
          alt={alt ?? initials}
          onError={onImageError}
          className={cn(baseRound, "object-cover", sizeClass, imageClassName, className)}
        />
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          baseRound,
          "flex items-center justify-center font-headline font-bold",
          sizeClass,
          fallbackClassName,
          className
        )}
        {...props}
      >
        {initials}
      </div>
    );
  }
);
UserAvatar.displayName = "UserAvatar";

export { UserAvatar };
